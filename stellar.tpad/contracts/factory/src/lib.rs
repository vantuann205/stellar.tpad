#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, panic_with_error, symbol_short, Address, BytesN, Env,
    IntoVal, String, Symbol, Val, Vec,
};

#[cfg(test)]
mod test;

#[contract]
pub struct TokenFactory;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum FactoryError {
    InvalidTokenWasm = 1,
}

#[contractimpl]
impl TokenFactory {
    pub fn __constructor(env: Env, token_wasm_hash: BytesN<32>) {
        env.storage()
            .instance()
            .set(&symbol_short!("tokenwasm"), &token_wasm_hash);
        env.storage().instance().extend_ttl(120_000, 250_000);
    }

    // Deploy token + register in bonding curve in one tx (1 signature)
    pub fn create_token(
        env: Env,
        wasm_hash: BytesN<32>,
        salt: BytesN<32>,
        admin: Address,
        bonding_curve_address: Address,
        name: String,
        symbol: String,
    ) -> Address {
        admin.require_auth();
        let canonical_hash: BytesN<32> = env
            .storage()
            .instance()
            .get(&symbol_short!("tokenwasm"))
            .unwrap();
        if wasm_hash != canonical_hash {
            panic_with_error!(&env, FactoryError::InvalidTokenWasm);
        }
        let token_address = env.deployer().with_current_contract(salt).deploy_v2(
            wasm_hash,
            (admin.clone(), bonding_curve_address.clone(), name, symbol),
        );

        let args: Vec<Val> = (token_address.clone(), admin).into_val(&env);
        env.invoke_contract::<Val>(
            &bonding_curve_address,
            &Symbol::new(&env, "register_token"),
            args,
        );

        token_address
    }
}
