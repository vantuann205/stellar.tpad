#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String};

use crate::TokenContract;
use crate::TokenContractClient;

fn setup(env: &Env) -> (TokenContractClient, Address, Address) {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let contract_id = env.register(TokenContract, ());
    let client = TokenContractClient::new(env, &contract_id);
    client.initialize(
        &admin,
        &7u32,
        &String::from_str(env, "TPad Token"),
        &String::from_str(env, "TPAD"),
        &sac.address(),
    );
    (client, admin, sac.address())
}

#[test]
fn test_balance_default_zero() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let unknown = Address::generate(&env);
    assert_eq!(client.balance(&unknown), 0);
}

#[test]
fn test_allowance_default_zero() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let from = Address::generate(&env);
    let spender = Address::generate(&env);
    assert_eq!(client.allowance(&from, &spender), 0);
}

#[test]
fn test_decimals_name_symbol() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    assert_eq!(client.decimals(), 7u32);
    assert_eq!(client.name(), String::from_str(&env, "TPad Token"));
    assert_eq!(client.symbol(), String::from_str(&env, "TPAD"));
}
