#![no_std]
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String, Symbol, Vec, Val, IntoVal};

#[contract]
pub struct TokenFactory;

#[contractimpl]
impl TokenFactory {
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
        let token_address = env.deployer()
            .with_current_contract(salt)
            .deploy_v2(wasm_hash, (admin.clone(), bonding_curve_address.clone(), name, symbol));

        let args: Vec<Val> = (token_address.clone(), admin).into_val(&env);
        env.invoke_contract::<Val>(&bonding_curve_address, &Symbol::new(&env, "register_token"), args);

        token_address
    }
}
