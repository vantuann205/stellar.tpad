#![no_std]
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String};

#[contract]
pub struct TokenFactory;

#[contractimpl]
impl TokenFactory {
    /// Deploy + initialize token atomically using deploy_v2.
    /// Constructor args are passed as a tuple — deploy_v2 calls `initialize(admin, name, symbol)`
    /// inside the same host invocation, no separate invoke_contract needed.
    pub fn create_token(
        env: Env,
        wasm_hash: BytesN<32>,
        salt: BytesN<32>,
        admin: Address,
        name: String,
        symbol: String,
    ) -> Address {
        env.deployer()
            .with_current_contract(salt)
            .deploy_v2(wasm_hash, (admin, name, symbol))
    }
}
