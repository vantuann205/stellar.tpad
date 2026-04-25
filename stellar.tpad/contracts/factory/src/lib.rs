#![no_std]
use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, String};

/// Full token supply: 1,000,000,000 with 7 decimals
const FULL_SUPPLY: i128 = 1_000_000_000 * 10_000_000; // 10^16

// Minimal interface to call BondingCurve_Contract.register_token
mod bonding_curve {
    use soroban_sdk::{contractclient, Address, Env};

    #[allow(dead_code)]
    #[contractclient(name = "BondingCurveClient")]
    pub trait BondingCurveInterface {
        fn register_token(env: Env, token_address: Address, token_admin: Address);
    }
}

use bonding_curve::BondingCurveClient;

#[contract]
pub struct TokenFactory;

#[contractimpl]
impl TokenFactory {
    /// Deploy + initialize token, then atomically:
    ///   1. Register the token into BondingCurve_Contract
    ///   2. Transfer full supply (1B tokens) from admin → BondingCurve_Contract
    ///
    /// After this call the bonding curve holds all tokens and trading can start immediately.
    /// `admin` must authorize this transaction (required for the token transfer step).
    pub fn create_token(
        env: Env,
        wasm_hash: BytesN<32>,
        salt: BytesN<32>,
        admin: Address,
        name: String,
        symbol: String,
        bonding_curve: Address,
    ) -> Address {
        // Require admin auth upfront — needed for token.transfer below
        admin.require_auth();

        // 1. Deploy + initialize token contract (mints full supply to admin)
        let token_address: Address = env
            .deployer()
            .with_current_contract(salt)
            .deploy_v2(wasm_hash, (admin.clone(), name, symbol));

        // 2. Register token into BondingCurve_Contract
        let bc_client = BondingCurveClient::new(&env, &bonding_curve);
        bc_client.register_token(&token_address, &admin);

        // 3. Transfer full supply from admin → BondingCurve_Contract
        //    (admin already authorized above, so this is covered)
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&admin, &bonding_curve, &FULL_SUPPLY);

        token_address
    }
}
