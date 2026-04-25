use soroban_sdk::{Address, Env, String};

use crate::types::{AllowanceKey, AllowanceValue, DataKey};

// --- Balance ---

pub fn read_balance(env: &Env, addr: &Address) -> i128 {
    let key = DataKey::Balance(addr.clone());
    env.storage().persistent().get(&key).unwrap_or(0)
}

pub fn write_balance(env: &Env, addr: &Address, amount: i128) {
    let key = DataKey::Balance(addr.clone());
    env.storage().persistent().set(&key, &amount);
}

// --- Allowance ---

pub fn read_allowance(env: &Env, from: &Address, spender: &Address) -> i128 {
    let key = DataKey::Allowance(AllowanceKey {
        from: from.clone(),
        spender: spender.clone(),
    });
    match env.storage().temporary().get::<DataKey, AllowanceValue>(&key) {
        Some(val) => {
            if val.expiration_ledger < env.ledger().sequence() {
                0
            } else {
                val.amount
            }
        }
        None => 0,
    }
}

pub fn read_allowance_value(env: &Env, from: &Address, spender: &Address) -> Option<AllowanceValue> {
    let key = DataKey::Allowance(AllowanceKey {
        from: from.clone(),
        spender: spender.clone(),
    });
    match env.storage().temporary().get::<DataKey, AllowanceValue>(&key) {
        Some(val) => {
            if val.expiration_ledger < env.ledger().sequence() {
                None
            } else {
                Some(val)
            }
        }
        None => None,
    }
}

pub fn write_allowance(
    env: &Env,
    from: &Address,
    spender: &Address,
    amount: i128,
    expiration_ledger: u32,
) {
    let key = DataKey::Allowance(AllowanceKey {
        from: from.clone(),
        spender: spender.clone(),
    });
    let value = AllowanceValue {
        amount,
        expiration_ledger,
    };
    env.storage().temporary().set(&key, &value);
    let current = env.ledger().sequence();
    if expiration_ledger > current {
        let ttl = expiration_ledger - current;
        env.storage().temporary().extend_ttl(&key, ttl, ttl);
    }
}

// --- Admin ---

pub fn read_admin(env: &Env) -> Address {
    env.storage().persistent().get(&DataKey::Admin).unwrap()
}

pub fn write_admin(env: &Env, admin: &Address) {
    env.storage().persistent().set(&DataKey::Admin, admin);
}

// --- Decimals ---

pub fn read_decimals(env: &Env) -> u32 {
    env.storage().persistent().get(&DataKey::Decimals).unwrap()
}

pub fn write_decimals(env: &Env, decimals: u32) {
    env.storage().persistent().set(&DataKey::Decimals, &decimals);
}

// --- Name ---

pub fn read_name(env: &Env) -> String {
    env.storage().persistent().get(&DataKey::Name).unwrap()
}

pub fn write_name(env: &Env, name: &String) {
    env.storage().persistent().set(&DataKey::Name, name);
}

// --- Symbol ---

pub fn read_symbol(env: &Env) -> String {
    env.storage().persistent().get(&DataKey::Symbol).unwrap()
}

pub fn write_symbol(env: &Env, symbol: &String) {
    env.storage().persistent().set(&DataKey::Symbol, symbol);
}

// --- SAC ---

pub fn read_sac(env: &Env) -> Address {
    env.storage().persistent().get(&DataKey::Sac).unwrap()
}

pub fn write_sac(env: &Env, sac: &Address) {
    env.storage().persistent().set(&DataKey::Sac, sac);
}
