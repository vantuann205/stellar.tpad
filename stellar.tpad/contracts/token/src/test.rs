#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, IntoVal, String};

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

#[test]
fn test_initialize_success() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    assert_eq!(client.decimals(), 7u32);
    assert_eq!(client.name(), String::from_str(&env, "TPad Token"));
    assert_eq!(client.symbol(), String::from_str(&env, "TPAD"));
}

#[test]
#[should_panic]
fn test_initialize_twice_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, sac) = setup(&env);
    // Second call should panic with AlreadyInitialized
    client.initialize(
        &admin,
        &7u32,
        &String::from_str(&env, "TPad Token"),
        &String::from_str(&env, "TPAD"),
        &sac,
    );
}

#[test]
fn test_admin_query() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = setup(&env);
    assert_eq!(client.admin(), admin);
}

#[test]
fn test_set_admin_success() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let new_admin = Address::generate(&env);
    client.set_admin(&new_admin);
    assert_eq!(client.admin(), new_admin);
}

#[test]
#[should_panic]
fn test_set_admin_unauthorized() {
    // Setup with mock_all_auths so initialize works
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let contract_id = env.register(crate::TokenContract, ());
    let client = TokenContractClient::new(&env, &contract_id);
    client.initialize(
        &admin,
        &7u32,
        &String::from_str(&env, "TPad Token"),
        &String::from_str(&env, "TPAD"),
        &sac.address(),
    );

    // Now call set_admin without any auth — should panic because current_admin.require_auth() fails
    let new_admin = Address::generate(&env);
    // Create a new env without mock_all_auths to enforce auth checks
    let env2 = Env::default();
    // Re-register contract in env2 with proper state
    let admin2 = Address::generate(&env2);
    let sac2 = env2.register_stellar_asset_contract_v2(admin2.clone());
    let contract_id2 = env2.register(crate::TokenContract, ());
    let client2 = TokenContractClient::new(&env2, &contract_id2);
    env2.mock_all_auths();
    client2.initialize(
        &admin2,
        &7u32,
        &String::from_str(&env2, "TPad Token"),
        &String::from_str(&env2, "TPAD"),
        &sac2.address(),
    );
    let new_admin2 = Address::generate(&env2);
    // Call without mock_all_auths active for this call — auth will not be satisfied
    // We need to drop mock_all_auths. In soroban-sdk testutils, once mock_all_auths is called
    // it stays for the env. So we use a fresh env without it:
    let env3 = Env::default(); // no mock_all_auths
    let admin3 = Address::generate(&env3);
    let sac3 = env3.register_stellar_asset_contract_v2(admin3.clone());
    let contract_id3 = env3.register(crate::TokenContract, ());
    let client3 = TokenContractClient::new(&env3, &contract_id3);
    // Initialize using mock_all_auths temporarily
    env3.mock_all_auths();
    client3.initialize(
        &admin3,
        &7u32,
        &String::from_str(&env3, "TPad Token"),
        &String::from_str(&env3, "TPAD"),
        &sac3.address(),
    );
    // Now call set_admin — mock_all_auths is still active so this won't panic
    // The correct approach: use mock_auths with wrong address
    let _ = (new_admin, new_admin2, client, client2);
    // Use mock_auths to provide auth for a non-admin address
    let non_admin = Address::generate(&env3);
    let new_admin3 = Address::generate(&env3);
    env3.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &non_admin,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &client3.address,
            fn_name: "set_admin",
            args: (&new_admin3,).into_val(&env3),
            sub_invokes: &[],
        },
    }]);
    client3.set_admin(&new_admin3);
}
