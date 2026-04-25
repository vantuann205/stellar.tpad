use soroban_sdk::{Address, Env, String};
use crate::types::DataKey;

pub fn read_balance(env: &Env, addr: &Address) -> i128 {
    env.storage().persistent().get(&DataKey::Balance(addr.clone())).unwrap_or(0)
}

pub fn write_balance(env: &Env, addr: &Address, amount: i128) {
    env.storage().persistent().set(&DataKey::Balance(addr.clone()), &amount);
}

pub fn read_admin(env: &Env) -> Address {
    env.storage().persistent().get(&DataKey::Admin).unwrap()
}

pub fn write_admin(env: &Env, admin: &Address) {
    env.storage().persistent().set(&DataKey::Admin, admin);
}

pub fn read_decimals(env: &Env) -> u32 {
    env.storage().persistent().get(&DataKey::Decimals).unwrap_or(7)
}

pub fn write_decimals(env: &Env, decimals: u32) {
    env.storage().persistent().set(&DataKey::Decimals, &decimals);
}

pub fn read_name(env: &Env) -> String {
    env.storage().persistent().get(&DataKey::Name).unwrap()
}

pub fn write_name(env: &Env, name: &String) {
    env.storage().persistent().set(&DataKey::Name, name);
}

pub fn read_symbol(env: &Env) -> String {
    env.storage().persistent().get(&DataKey::Symbol).unwrap()
}

pub fn write_symbol(env: &Env, symbol: &String) {
    env.storage().persistent().set(&DataKey::Symbol, symbol);
}
