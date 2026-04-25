#![no_std]

pub mod math;
pub mod state;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, panic_with_error, symbol_short, Address, Env};

use math::{calc_buy_cost, calc_sell_proceeds};
use state::{ContractError, DataKey, TokenCurveState};

// Treasury address that receives all fees
const TREASURY: &str = "GCZ2IR57HR7JSKNA5ILVGBWJSUFUHPJHW35RXDQ7HTDBZ2QHURULFP63";

// Default bonding curve parameters
// price(S) = base_price + slope * S_tokens
// At 800k tokens sold: price ≈ 20,000 XLM/token
// At 1M  tokens sold: price ≈ 25,000 XLM/token
const DEFAULT_BASE_PRICE: i128 = 1_000;        // 1,000 stroops = 0.0001 XLM (near-zero start)
const DEFAULT_SLOPE: i128 = 250_000;           // 250,000 stroops per token
const DEFAULT_TOTAL_SUPPLY: i128 = 10_000_000_000_000_000; // 1B * 10^7

#[contract]
pub struct BondingCurveContract;

#[contractimpl]
impl BondingCurveContract {
    /// Initialize the contract once. Stores admin and treasury in instance storage.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, ContractError::AlreadyInitialized);
        }
        let treasury = Address::from_str(&env, TREASURY);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
    }

    /// Register a new token into the bonding curve.
    /// Creates a fresh TokenCurveState with default parameters.
    pub fn register_token(env: Env, token_address: Address, token_admin: Address) {
        if env.storage().persistent().has(&DataKey::Token(token_address.clone())) {
            panic_with_error!(&env, ContractError::TokenAlreadyRegistered);
        }
        let state = TokenCurveState {
            token_address: token_address.clone(),
            admin: token_admin,
            base_price: DEFAULT_BASE_PRICE,
            slope: DEFAULT_SLOPE,
            total_supply: DEFAULT_TOTAL_SUPPLY,
            sold_supply: 0,
            xlm_reserve: 0,
            active: true,
        };
        env.storage().persistent().set(&DataKey::Token(token_address.clone()), &state);
        env.events().publish((symbol_short!("register"), token_address), ());
    }

    /// Get the bonding curve state for a token.
    pub fn get_token_state(env: Env, token_address: Address) -> TokenCurveState {
        env.storage()
            .persistent()
            .get(&DataKey::Token(token_address))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::TokenNotFound))
    }

    /// Current price in stroops = base_price + slope * (sold_supply / 10^7).
    pub fn get_price(env: Env, token_address: Address) -> i128 {
        let s = Self::get_token_state(env, token_address);
        s.base_price + s.slope * (s.sold_supply / 10_000_000)
    }

    /// Total XLM cost (stroops) to buy token_amount raw units (before fee).
    pub fn get_buy_price(env: Env, token_address: Address, token_amount: i128) -> i128 {
        if token_amount <= 0 {
            panic_with_error!(&env, ContractError::InvalidAmount);
        }
        let s = Self::get_token_state(env.clone(), token_address);
        calc_buy_cost(s.base_price, s.slope, s.sold_supply, token_amount)
    }

    /// Total XLM proceeds (stroops) from selling token_amount raw units (before fee).
    pub fn get_sell_price(env: Env, token_address: Address, token_amount: i128) -> i128 {
        if token_amount <= 0 {
            panic_with_error!(&env, ContractError::InvalidAmount);
        }
        let s = Self::get_token_state(env.clone(), token_address);
        calc_sell_proceeds(s.base_price, s.slope, s.sold_supply, token_amount)
    }

    /// Buy token_amount raw units. Transfers XLM from buyer, tokens to buyer.
    /// max_xlm_in is slippage protection (in stroops).
    pub fn buy(
        env: Env,
        buyer: Address,
        token_address: Address,
        token_amount: i128,
        max_xlm_in: i128,
    ) {
        buyer.require_auth();

        if token_amount <= 0 {
            panic_with_error!(&env, ContractError::InvalidAmount);
        }

        let mut s: TokenCurveState = env
            .storage()
            .persistent()
            .get(&DataKey::Token(token_address.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::TokenNotFound));

        if s.sold_supply + token_amount > s.total_supply {
            panic_with_error!(&env, ContractError::ExceedsSupply);
        }

        let cost = calc_buy_cost(s.base_price, s.slope, s.sold_supply, token_amount);
        let fee = cost / 100; // 1%
        let total_xlm = cost + fee;

        if total_xlm > max_xlm_in {
            panic_with_error!(&env, ContractError::SlippageExceeded);
        }

        let treasury: Address = env.storage().instance().get(&DataKey::Treasury).unwrap();

        // Transfer XLM: buyer → contract (cost), contract → treasury (fee)
        let xlm_client = soroban_sdk::token::Client::new(&env, &get_xlm_address(&env));
        xlm_client.transfer(&buyer, &env.current_contract_address(), &total_xlm);
        xlm_client.transfer(&env.current_contract_address(), &treasury, &fee);

        // Transfer tokens: contract → buyer
        let token_client = soroban_sdk::token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &buyer, &token_amount);

        // Update state
        s.sold_supply += token_amount;
        s.xlm_reserve += cost;
        env.storage().persistent().set(&DataKey::Token(token_address.clone()), &s);

        env.events().publish(
            (symbol_short!("buy"), buyer, token_address),
            (token_amount, cost, fee),
        );
    }

    /// Sell token_amount raw units. Transfers tokens from seller, XLM to seller.
    /// min_xlm_out is slippage protection (in stroops).
    pub fn sell(
        env: Env,
        seller: Address,
        token_address: Address,
        token_amount: i128,
        min_xlm_out: i128,
    ) {
        seller.require_auth();

        if token_amount <= 0 {
            panic_with_error!(&env, ContractError::InvalidAmount);
        }

        let mut s: TokenCurveState = env
            .storage()
            .persistent()
            .get(&DataKey::Token(token_address.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::TokenNotFound));

        if s.sold_supply < token_amount {
            panic_with_error!(&env, ContractError::InsufficientLiquidity);
        }

        let proceeds = calc_sell_proceeds(s.base_price, s.slope, s.sold_supply, token_amount);
        let fee = proceeds / 100; // 1%
        let payout = proceeds - fee;

        if s.xlm_reserve < proceeds {
            panic_with_error!(&env, ContractError::InsufficientReserve);
        }

        if payout < min_xlm_out {
            panic_with_error!(&env, ContractError::SlippageExceeded);
        }

        let treasury: Address = env.storage().instance().get(&DataKey::Treasury).unwrap();

        // Transfer tokens: seller → contract
        let token_client = soroban_sdk::token::Client::new(&env, &token_address);
        token_client.transfer(&seller, &env.current_contract_address(), &token_amount);

        // Transfer XLM: contract → seller (payout), contract → treasury (fee)
        let xlm_client = soroban_sdk::token::Client::new(&env, &get_xlm_address(&env));
        xlm_client.transfer(&env.current_contract_address(), &seller, &payout);
        xlm_client.transfer(&env.current_contract_address(), &treasury, &fee);

        // Update state
        s.sold_supply -= token_amount;
        s.xlm_reserve -= proceeds;
        env.storage().persistent().set(&DataKey::Token(token_address.clone()), &s);

        env.events().publish(
            (symbol_short!("sell"), seller, token_address),
            (token_amount, proceeds, fee),
        );
    }
}

/// Returns the native XLM Stellar Asset Contract (SAC) address for Stellar testnet.
fn get_xlm_address(env: &Env) -> Address {
    // Native XLM SAC on Stellar testnet (generated via `stellar contract id asset --asset native`)
    Address::from_str(env, "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC")
}
