#![cfg(test)]

use crate::{TokenFactory, TokenFactoryClient};
use soroban_sdk::{contract, contractimpl, testutils::Address as _, Address, BytesN, Env, String};

mod token {
    soroban_sdk::contractimport!(file = "../token/target/wasm32v1-none/release/token.wasm");
}

#[contract]
struct MockBondingCurve;

#[contractimpl]
impl MockBondingCurve {
    pub fn register_token(_env: Env, _token_address: Address, _token_admin: Address) {}
}

#[test]
fn create_token_deploys_initialized_supply_to_bonding_curve() {
    let env = Env::default();
    env.mock_all_auths();

    let wasm_hash = env.deployer().upload_contract_wasm(token::WASM);
    let factory_id = env.register(TokenFactory, (wasm_hash.clone(),));
    let bonding_id = env.register(MockBondingCurve, ());
    let admin = Address::generate(&env);
    let salt = BytesN::from_array(&env, &[7; 32]);

    let token_id = TokenFactoryClient::new(&env, &factory_id).create_token(
        &wasm_hash,
        &salt,
        &admin,
        &bonding_id,
        &String::from_str(&env, "Mainnet Ready"),
        &String::from_str(&env, "READY"),
    );
    let token = token::Client::new(&env, &token_id);

    assert_eq!(token.admin(), admin);
    assert_eq!(token.balance(&bonding_id), 10_000_000_000_000_000);
}

#[test]
#[should_panic]
fn create_token_rejects_unknown_bytecode() {
    let env = Env::default();
    env.mock_all_auths();
    let wasm_hash = env.deployer().upload_contract_wasm(token::WASM);
    let factory_id = env.register(TokenFactory, (wasm_hash,));
    let bonding_id = env.register(MockBondingCurve, ());
    let admin = Address::generate(&env);

    TokenFactoryClient::new(&env, &factory_id).create_token(
        &BytesN::from_array(&env, &[9; 32]),
        &BytesN::from_array(&env, &[8; 32]),
        &admin,
        &bonding_id,
        &String::from_str(&env, "Blocked"),
        &String::from_str(&env, "NOPE"),
    );
}
