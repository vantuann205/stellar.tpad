#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String};
use crate::{TokenContract, TokenContractClient};

const DEFAULT_SUPPLY: i128 = 1_000_000_000 * 10_000_000;

fn setup(env: &Env) -> (TokenContractClient<'_>, Address) {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let id = env.register(
        TokenContract,
        (
            admin.clone(),
            admin.clone(),
            String::from_str(env, "My Token"),
            String::from_str(env, "MTK"),
        ),
    );
    let client = TokenContractClient::new(env, &id);
    (client, admin)
}

#[test]
fn test_initialize_mints_supply() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    assert_eq!(client.balance(&admin), DEFAULT_SUPPLY);
    assert_eq!(client.decimals(), 7);
    assert_eq!(client.name(), String::from_str(&env, "My Token"));
    assert_eq!(client.symbol(), String::from_str(&env, "MTK"));
}

#[test]
#[should_panic]
fn test_initialize_twice_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    // Already initialized by __constructor, so calling initialize will fail
    client.initialize(&admin, &admin, &String::from_str(&env, "X"), &String::from_str(&env, "X"));
}

#[test]
fn test_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    let to = Address::generate(&env);
    let amount = 1_000_000_000_i128;
    client.transfer(&admin, &to, &amount);
    assert_eq!(client.balance(&admin), DEFAULT_SUPPLY - amount);
    assert_eq!(client.balance(&to), amount);
}

#[test]
#[should_panic]
fn test_transfer_insufficient() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    client.transfer(&from, &to, &1_i128);
}

#[test]
#[should_panic]
fn test_mint_is_disabled() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    let to = Address::generate(&env);
    client.mint(&to, &500_i128);
    assert_eq!(client.balance(&admin), DEFAULT_SUPPLY);
}

#[test]
fn test_burn() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    client.burn(&admin, &1_000_000_i128);
    assert_eq!(client.balance(&admin), DEFAULT_SUPPLY - 1_000_000);
}
