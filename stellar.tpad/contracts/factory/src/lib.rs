#![no_std]
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, Symbol, Vec, Val, IntoVal, String};

#[contract]
pub struct TokenFactory;

#[contractimpl]
impl TokenFactory {
    /// Deploys a new token contract and initializes it in a single atomical step.
    pub fn create_token(
        env: Env,
        wasm_hash: BytesN<32>,
        salt: BytesN<32>,
        admin: Address,
        name: String,
        symbol: String,
    ) -> Address {
        // 1. Deploy the token contract instance
        let contract_id = env
            .deployer()
            .with_current_contract(salt)
            .deploy(wasm_hash);

        // 2. Initialize the token contract
        // Packaging arguments correctly for the 'initialize' function:
        // initialize(admin: Address, name: String, symbol: String)
        let init_args = soroban_sdk::vec![&env, admin.into_val(&env), name.into_val(&env), symbol.into_val(&env)];
        
        // Call 'initialize' on the newly deployed contract.
        env.invoke_contract::<Val>(&contract_id, &soroban_sdk::Symbol::new(&env, "initialize"), init_args);

        // Return the address of the newly created token
        contract_id
    }
}
