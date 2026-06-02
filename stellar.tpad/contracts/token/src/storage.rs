use soroban_sdk::{Address, Env, String};
use crate::types::DataKey;

const BUMP_THRESHOLD: u32 = 120_000; // ~7 days of ledgers
const BUMP_LIMIT: u32 = 250_000;     // ~14 days of ledgers

pub fn read_balance(env: &Env, addr: &Address) -> i128 {
    let key = DataKey::Balance(addr.clone());
    if env.storage().persistent().has(&key) {
        env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_LIMIT);
    }
    env.storage().persistent().get(&key).unwrap_or(0)
}

pub fn write_balance(env: &Env, addr: &Address, amount: i128) {
    let key = DataKey::Balance(addr.clone());
    env.storage().persistent().set(&key, &amount);
    env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_LIMIT);
}

pub fn read_admin(env: &Env) -> Address {
    let key = DataKey::Admin;
    env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_LIMIT);
    env.storage().persistent().get(&key).unwrap()
}

pub fn write_admin(env: &Env, admin: &Address) {
    let key = DataKey::Admin;
    env.storage().persistent().set(&key, admin);
    env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_LIMIT);
}

pub fn read_decimals(env: &Env) -> u32 {
    let key = DataKey::Decimals;
    if env.storage().persistent().has(&key) {
        env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_LIMIT);
    }
    env.storage().persistent().get(&key).unwrap_or(7)
}

pub fn write_decimals(env: &Env, decimals: u32) {
    let key = DataKey::Decimals;
    env.storage().persistent().set(&key, &decimals);
    env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_LIMIT);
}

pub fn read_name(env: &Env) -> String {
    let key = DataKey::Name;
    env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_LIMIT);
    env.storage().persistent().get(&key).unwrap()
}

pub fn write_name(env: &Env, name: &String) {
    let key = DataKey::Name;
    env.storage().persistent().set(&key, name);
    env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_LIMIT);
}

pub fn read_symbol(env: &Env) -> String {
    let key = DataKey::Symbol;
    env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_LIMIT);
    env.storage().persistent().get(&key).unwrap()
}

pub fn write_symbol(env: &Env, symbol: &String) {
    let key = DataKey::Symbol;
    env.storage().persistent().set(&key, symbol);
    env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_LIMIT);
}
