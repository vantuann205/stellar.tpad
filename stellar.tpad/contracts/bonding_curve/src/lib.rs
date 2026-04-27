#![no_std]

pub mod math;
pub mod state;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, panic_with_error, symbol_short, Address, Env};
use math::{calc_buy_cost, calc_sell_proceeds};
use state::{ContractError, DataKey, TokenCurveState};

const TREASURY: &str = "GB7Q3MPI4YAZ27X3XJ2KQ2LVFGLOPNQIV3CXT352GPM36CDIYJLI4AVJ";
const DEFAULT_BASE_PRICE: i128 = 10;
const DEFAULT_SLOPE: i128 = 750;
const DEFAULT_TOTAL_SUPPLY: i128 = 10_000_000_000_000_000;
const FEE_BPS: i128 = 50;    // 0.5%
const FEE_DENOM: i128 = 10_000;

#[contract]
pub struct BondingCurveContract;

#[contractimpl]
impl BondingCurveContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, ContractError::AlreadyInitialized);
        }
        let treasury = Address::from_str(&env, TREASURY);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
    }

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

    pub fn get_token_state(env: Env, token_address: Address) -> TokenCurveState {
        env.storage()
            .persistent()
            .get(&DataKey::Token(token_address))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::TokenNotFound))
    }

    pub fn get_price(env: Env, token_address: Address) -> i128 {
        let s = Self::get_token_state(env, token_address);
        s.base_price + s.slope * (s.sold_supply / 10_000_000)
    }

    pub fn get_buy_price(env: Env, token_address: Address, token_amount: i128) -> i128 {
        if token_amount <= 0 { panic_with_error!(&env, ContractError::InvalidAmount); }
        let s = Self::get_token_state(env.clone(), token_address);
        calc_buy_cost(s.base_price, s.slope, s.sold_supply, token_amount)
    }

    pub fn get_sell_price(env: Env, token_address: Address, token_amount: i128) -> i128 {
        if token_amount <= 0 { panic_with_error!(&env, ContractError::InvalidAmount); }
        let s = Self::get_token_state(env.clone(), token_address);
        calc_sell_proceeds(s.base_price, s.slope, s.sold_supply, token_amount)
    }

    pub fn buy(env: Env, buyer: Address, token_address: Address, token_amount: i128, max_xlm_in: i128) {
        buyer.require_auth();
        if token_amount <= 0 { panic_with_error!(&env, ContractError::InvalidAmount); }

        let mut s: TokenCurveState = env.storage().persistent()
            .get(&DataKey::Token(token_address.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::TokenNotFound));

        if s.sold_supply + token_amount > s.total_supply {
            panic_with_error!(&env, ContractError::ExceedsSupply);
        }

        let cost = calc_buy_cost(s.base_price, s.slope, s.sold_supply, token_amount);
        let fee = cost * FEE_BPS / FEE_DENOM;
        let total_xlm = cost + fee;

        if total_xlm > max_xlm_in { panic_with_error!(&env, ContractError::SlippageExceeded); }

        let treasury: Address = env.storage().instance().get(&DataKey::Treasury).unwrap();
        let xlm = soroban_sdk::token::Client::new(&env, &get_xlm_address(&env));
        xlm.transfer(&buyer, &env.current_contract_address(), &total_xlm);
        xlm.transfer(&env.current_contract_address(), &treasury, &fee);

        let token = soroban_sdk::token::Client::new(&env, &token_address);
        token.transfer(&env.current_contract_address(), &buyer, &token_amount);

        s.sold_supply += token_amount;
        s.xlm_reserve += cost;
        env.storage().persistent().set(&DataKey::Token(token_address.clone()), &s);
        env.events().publish((symbol_short!("buy"), buyer, token_address), (token_amount, cost, fee));
    }

    pub fn sell(env: Env, seller: Address, token_address: Address, token_amount: i128, min_xlm_out: i128) {
        seller.require_auth();
        if token_amount <= 0 { panic_with_error!(&env, ContractError::InvalidAmount); }

        let mut s: TokenCurveState = env.storage().persistent()
            .get(&DataKey::Token(token_address.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::TokenNotFound));

        if s.sold_supply < token_amount { panic_with_error!(&env, ContractError::InsufficientLiquidity); }

        let proceeds = calc_sell_proceeds(s.base_price, s.slope, s.sold_supply, token_amount);
        let fee = proceeds * FEE_BPS / FEE_DENOM;
        let payout = proceeds - fee;

        if s.xlm_reserve < proceeds { panic_with_error!(&env, ContractError::InsufficientReserve); }
        if payout < min_xlm_out { panic_with_error!(&env, ContractError::SlippageExceeded); }

        let treasury: Address = env.storage().instance().get(&DataKey::Treasury).unwrap();
        let token = soroban_sdk::token::Client::new(&env, &token_address);
        token.transfer(&seller, &env.current_contract_address(), &token_amount);

        let xlm = soroban_sdk::token::Client::new(&env, &get_xlm_address(&env));
        xlm.transfer(&env.current_contract_address(), &seller, &payout);
        xlm.transfer(&env.current_contract_address(), &treasury, &fee);

        s.sold_supply -= token_amount;
        s.xlm_reserve -= proceeds;
        env.storage().persistent().set(&DataKey::Token(token_address.clone()), &s);
        env.events().publish((symbol_short!("sell"), seller, token_address), (token_amount, proceeds, fee));
    }
}

fn get_xlm_address(env: &Env) -> Address {
    Address::from_str(env, "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC")
}
