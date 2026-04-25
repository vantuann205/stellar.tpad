#![no_std]
mod types;
mod storage;
mod test;

use soroban_sdk::{contract, contractimpl, panic_with_error, Address, Env, String};
use storage::*;
use types::*;

#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        decimal: u32,
        name: String,
        symbol: String,
        sac: Address,
    ) {
        if env.storage().persistent().has(&DataKey::Admin) {
            panic_with_error!(&env, TokenError::AlreadyInitialized);
        }
        admin.require_auth();
        write_admin(&env, &admin);
        write_decimals(&env, decimal);
        write_name(&env, &name);
        write_symbol(&env, &symbol);
        write_sac(&env, &sac);
    }

    pub fn decimals(env: Env) -> u32 {
        read_decimals(&env)
    }

    pub fn name(env: Env) -> String {
        read_name(&env)
    }

    pub fn symbol(env: Env) -> String {
        read_symbol(&env)
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        read_balance(&env, &id)
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        read_allowance(&env, &from, &spender)
    }

    pub fn admin(env: Env) -> Address {
        read_admin(&env)
    }

    pub fn set_admin(env: Env, new_admin: Address) {
        let current_admin = read_admin(&env);
        current_admin.require_auth();
        write_admin(&env, &new_admin);
    }
}
