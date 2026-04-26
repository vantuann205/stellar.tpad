#![no_std]
mod types;
mod storage;
mod test;

use soroban_sdk::{contract, contractimpl, panic_with_error, Address, Env, String};
use storage::*;
use types::*;

/// Supply mặc định: 1,000,000,000 với 7 decimals
const DEFAULT_SUPPLY: i128 = 1_000_000_000 * 10_000_000; // 1B * 10^7

#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    /// Constructor — called atomically by factory via deploy_v2.
    /// Mint toàn bộ 1B supply cho recipient (bonding curve pool).
    pub fn __constructor(
        env: Env,
        admin: Address,
        recipient: Address,
        name: String,
        symbol: String,
    ) {
        write_admin(&env, &admin);
        write_decimals(&env, 7);
        write_name(&env, &name);
        write_symbol(&env, &symbol);
        // Mint 1B supply cho recipient (bonding curve pool)
        write_balance(&env, &recipient, DEFAULT_SUPPLY);
        env.events().publish(
            (soroban_sdk::symbol_short!("mint"), recipient.clone()),
            DEFAULT_SUPPLY,
        );
    }

    /// initialize kept for backward compat (direct deploy without factory).
    pub fn initialize(
        env: Env,
        admin: Address,
        recipient: Address,
        name: String,
        symbol: String,
    ) {
        if env.storage().persistent().has(&DataKey::Admin) {
            panic_with_error!(&env, TokenError::AlreadyInitialized);
        }
        write_admin(&env, &admin);
        write_decimals(&env, 7);
        write_name(&env, &name);
        write_symbol(&env, &symbol);
        write_balance(&env, &recipient, DEFAULT_SUPPLY);
        env.events().publish(
            (soroban_sdk::symbol_short!("mint"), recipient.clone()),
            DEFAULT_SUPPLY,
        );
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

    /// Transfer token giữa 2 địa chỉ.
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, TokenError::InvalidAmount);
        }
        let bal = read_balance(&env, &from);
        if bal < amount {
            panic_with_error!(&env, TokenError::InsufficientBalance);
        }
        write_balance(&env, &from, bal - amount);
        write_balance(&env, &to, read_balance(&env, &to) + amount);
        env.events().publish(
            (soroban_sdk::symbol_short!("transfer"), from.clone(), to.clone()),
            amount,
        );
    }

    /// Mint thêm token — chỉ admin.
    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin = read_admin(&env);
        admin.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, TokenError::InvalidAmount);
        }
        write_balance(&env, &to, read_balance(&env, &to) + amount);
        env.events().publish(
            (soroban_sdk::symbol_short!("mint"), to.clone()),
            amount,
        );
    }

    /// Burn token của chính mình.
    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, TokenError::InvalidAmount);
        }
        let bal = read_balance(&env, &from);
        if bal < amount {
            panic_with_error!(&env, TokenError::InsufficientBalance);
        }
        write_balance(&env, &from, bal - amount);
        env.events().publish(
            (soroban_sdk::symbol_short!("burn"), from.clone()),
            amount,
        );
    }

    pub fn admin(env: Env) -> Address {
        read_admin(&env)
    }
}
