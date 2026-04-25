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

    pub fn approve(env: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32) {
        from.require_auth();
        if amount < 0 {
            panic_with_error!(&env, TokenError::InvalidAmount);
        }
        if amount > 0 && expiration_ledger < env.ledger().sequence() {
            panic_with_error!(&env, TokenError::InvalidExpirationLedger);
        }
        write_allowance(&env, &from, &spender, amount, expiration_ledger);
        env.events().publish(
            (soroban_sdk::symbol_short!("approve"), from.clone(), spender.clone()),
            (amount, expiration_ledger),
        );
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, TokenError::InvalidAmount);
        }
        let balance_from = read_balance(&env, &from);
        if balance_from < amount {
            panic_with_error!(&env, TokenError::InsufficientBalance);
        }
        write_balance(&env, &from, balance_from - amount);
        let balance_to = read_balance(&env, &to);
        write_balance(&env, &to, balance_to + amount);
        env.events().publish(
            (soroban_sdk::symbol_short!("transfer"), from.clone(), to.clone()),
            amount,
        );
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, TokenError::InvalidAmount);
        }
        let allowance_val = storage::read_allowance_value(&env, &from, &spender);
        let av = match allowance_val {
            Some(v) if v.amount >= amount => v,
            _ => panic_with_error!(&env, TokenError::InsufficientAllowance),
        };
        let balance_from = read_balance(&env, &from);
        if balance_from < amount {
            panic_with_error!(&env, TokenError::InsufficientBalance);
        }
        write_allowance(&env, &from, &spender, av.amount - amount, av.expiration_ledger);
        write_balance(&env, &from, balance_from - amount);
        let balance_to = read_balance(&env, &to);
        write_balance(&env, &to, balance_to + amount);
        env.events().publish(
            (soroban_sdk::symbol_short!("transfer"), from.clone(), to.clone()),
            amount,
        );
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
