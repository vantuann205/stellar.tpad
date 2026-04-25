#![cfg(test)]

use proptest::prelude::*;
use soroban_sdk::{testutils::{Address as _, Ledger as _}, Address, Env, IntoVal, String};

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

// --- Task 5.2: approve unit tests ---

#[test]
fn test_approve_and_query() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let from = Address::generate(&env);
    let spender = Address::generate(&env);
    let amount: i128 = 1000;
    let expiration_ledger: u32 = env.ledger().sequence() + 100;
    client.approve(&from, &spender, &amount, &expiration_ledger);
    assert_eq!(client.allowance(&from, &spender), amount);
}

#[test]
#[should_panic]
fn test_approve_negative_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let from = Address::generate(&env);
    let spender = Address::generate(&env);
    let expiration_ledger: u32 = env.ledger().sequence() + 100;
    client.approve(&from, &spender, &-1_i128, &expiration_ledger);
}

#[test]
#[should_panic]
fn test_approve_expired_ledger() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let from = Address::generate(&env);
    let spender = Address::generate(&env);
    // Set current ledger to 10, then use expiration_ledger = 5 (< current)
    env.ledger().set_sequence_number(10);
    client.approve(&from, &spender, &500_i128, &5u32);
}

#[test]
fn test_allowance_expiration() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let from = Address::generate(&env);
    let spender = Address::generate(&env);
    let expiration_ledger: u32 = env.ledger().sequence() + 10;
    client.approve(&from, &spender, &500_i128, &expiration_ledger);
    // Advance ledger past expiration
    env.ledger().set_sequence_number(expiration_ledger + 1);
    assert_eq!(client.allowance(&from, &spender), 0);
}

// --- Task 5.3: Property 3 — Approve Round-Trip ---

proptest! {
    #[test]
    fn prop_approve_round_trip(
        amount in 0_i128..1_000_000_i128,
        ledger_offset in 1_u32..1000_u32,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _, _) = setup(&env);
        let from = Address::generate(&env);
        let spender = Address::generate(&env);
        let current = env.ledger().sequence();
        let expiration_ledger = current + ledger_offset;
        client.approve(&from, &spender, &amount, &expiration_ledger);
        prop_assert_eq!(client.allowance(&from, &spender), amount);
    }
}

// --- Task 5.4: Property 4 — Allowance Expiration ---
// Validates: Requirements 3.6

proptest! {
    #[test]
    fn prop_allowance_expiration(
        amount in 1_i128..1_000_000_i128,
        ledger_offset in 1_u32..100_u32,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _, _) = setup(&env);
        let from = Address::generate(&env);
        let spender = Address::generate(&env);
        let current = env.ledger().sequence();
        let expiration_ledger = current + ledger_offset;
        client.approve(&from, &spender, &amount, &expiration_ledger);
        // Advance ledger past expiration
        env.ledger().set_sequence_number(expiration_ledger + 1);
        prop_assert_eq!(client.allowance(&from, &spender), 0);
    }
}

// --- Task 6.3: transfer unit tests ---

#[test]
fn test_transfer_success() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let initial: i128 = 1000;
    let amount: i128 = 400;
    env.as_contract(&client.address, || {
        crate::storage::write_balance(&env, &from, initial);
    });
    client.transfer(&from, &to, &amount);
    assert_eq!(client.balance(&from), initial - amount);
    assert_eq!(client.balance(&to), amount);
}

#[test]
#[should_panic]
fn test_transfer_invalid_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    client.transfer(&from, &to, &0_i128);
}

#[test]
#[should_panic]
fn test_transfer_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    // from has 0 balance, try to transfer 100
    client.transfer(&from, &to, &100_i128);
}

#[test]
fn test_transfer_from_success() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let from = Address::generate(&env);
    let spender = Address::generate(&env);
    let to = Address::generate(&env);
    let initial: i128 = 1000;
    let allowance_amount: i128 = 500;
    let transfer_amount: i128 = 300;
    let expiration_ledger = env.ledger().sequence() + 100;
    env.as_contract(&client.address, || {
        crate::storage::write_balance(&env, &from, initial);
    });
    client.approve(&from, &spender, &allowance_amount, &expiration_ledger);
    client.transfer_from(&spender, &from, &to, &transfer_amount);
    assert_eq!(client.balance(&from), initial - transfer_amount);
    assert_eq!(client.balance(&to), transfer_amount);
    assert_eq!(client.allowance(&from, &spender), allowance_amount - transfer_amount);
}

#[test]
#[should_panic]
fn test_transfer_from_insufficient_allowance() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let from = Address::generate(&env);
    let spender = Address::generate(&env);
    let to = Address::generate(&env);
    let initial: i128 = 1000;
    let allowance_amount: i128 = 100;
    let transfer_amount: i128 = 500;
    let expiration_ledger = env.ledger().sequence() + 100;
    env.as_contract(&client.address, || {
        crate::storage::write_balance(&env, &from, initial);
    });
    client.approve(&from, &spender, &allowance_amount, &expiration_ledger);
    client.transfer_from(&spender, &from, &to, &transfer_amount);
}

// --- Task 6.4: Property 2 — Transfer Balance Delta ---
// Validates: Requirements 4.3, 4.7

proptest! {
    #[test]
    fn prop_transfer_balance_delta(
        initial_from in 1_i128..1_000_000_i128,
        amount in 1_i128..500_000_i128,
    ) {
        prop_assume!(initial_from >= amount);
        let env = Env::default();
        env.mock_all_auths();
        let (client, _, _) = setup(&env);
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        env.as_contract(&client.address, || {
            crate::storage::write_balance(&env, &from, initial_from);
        });
        let before_to = client.balance(&to);
        client.transfer(&from, &to, &amount);
        prop_assert_eq!(client.balance(&from), initial_from - amount);
        prop_assert_eq!(client.balance(&to), before_to + amount);
    }
}

// --- Task 6.5: Property 5 — Transfer From Reduces Allowance ---
// Validates: Requirements 5.3, 5.4

proptest! {
    #[test]
    fn prop_transfer_from_reduces_allowance(
        allowance_amount in 1_i128..1_000_000_i128,
        transfer_amount in 1_i128..500_000_i128,
    ) {
        prop_assume!(allowance_amount >= transfer_amount);
        let env = Env::default();
        env.mock_all_auths();
        let (client, _, _) = setup(&env);
        let from = Address::generate(&env);
        let spender = Address::generate(&env);
        let to = Address::generate(&env);
        let expiration_ledger = env.ledger().sequence() + 1000;
        env.as_contract(&client.address, || {
            crate::storage::write_balance(&env, &from, allowance_amount);
        });
        client.approve(&from, &spender, &allowance_amount, &expiration_ledger);
        client.transfer_from(&spender, &from, &to, &transfer_amount);
        prop_assert_eq!(client.allowance(&from, &spender), allowance_amount - transfer_amount);
    }
}

// --- Task 7.3: burn unit tests ---

#[test]
fn test_burn_success() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let from = Address::generate(&env);
    let initial: i128 = 1000;
    let amount: i128 = 400;
    env.as_contract(&client.address, || {
        crate::storage::write_balance(&env, &from, initial);
    });
    client.burn(&from, &amount);
    assert_eq!(client.balance(&from), initial - amount);
}

#[test]
#[should_panic]
fn test_burn_invalid_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let from = Address::generate(&env);
    client.burn(&from, &0_i128);
}

#[test]
#[should_panic]
fn test_burn_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let from = Address::generate(&env);
    client.burn(&from, &100_i128);
}

#[test]
fn test_burn_from_success() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let from = Address::generate(&env);
    let spender = Address::generate(&env);
    let initial: i128 = 1000;
    let allowance_amount: i128 = 500;
    let burn_amount: i128 = 300;
    let expiration_ledger = env.ledger().sequence() + 100;
    env.as_contract(&client.address, || {
        crate::storage::write_balance(&env, &from, initial);
    });
    client.approve(&from, &spender, &allowance_amount, &expiration_ledger);
    client.burn_from(&spender, &from, &burn_amount);
    assert_eq!(client.balance(&from), initial - burn_amount);
    assert_eq!(client.allowance(&from, &spender), allowance_amount - burn_amount);
}

#[test]
#[should_panic]
fn test_burn_from_insufficient_allowance() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let from = Address::generate(&env);
    let spender = Address::generate(&env);
    let initial: i128 = 1000;
    let allowance_amount: i128 = 100;
    let burn_amount: i128 = 500;
    let expiration_ledger = env.ledger().sequence() + 100;
    env.as_contract(&client.address, || {
        crate::storage::write_balance(&env, &from, initial);
    });
    client.approve(&from, &spender, &allowance_amount, &expiration_ledger);
    client.burn_from(&spender, &from, &burn_amount);
}

// --- Task 7.4: Property 6 — Burn Reduces Balance ---
// Validates: Requirements 6.3

proptest! {
    #[test]
    fn prop_burn_reduces_balance(
        initial in 1_i128..1_000_000_i128,
        amount in 1_i128..500_000_i128,
    ) {
        prop_assume!(initial >= amount);
        let env = Env::default();
        env.mock_all_auths();
        let (client, _, _) = setup(&env);
        let from = Address::generate(&env);
        env.as_contract(&client.address, || {
            crate::storage::write_balance(&env, &from, initial);
        });
        client.burn(&from, &amount);
        prop_assert_eq!(client.balance(&from), initial - amount);
    }
}

// --- Task 7.5: Property 9 — Burn From Reduces Allowance ---
// Validates: Requirements 7.3, 7.4

proptest! {
    #[test]
    fn prop_burn_from_reduces_allowance(
        allowance_amount in 1_i128..1_000_000_i128,
        burn_amount in 1_i128..500_000_i128,
    ) {
        prop_assume!(allowance_amount >= burn_amount);
        let env = Env::default();
        env.mock_all_auths();
        let (client, _, _) = setup(&env);
        let from = Address::generate(&env);
        let spender = Address::generate(&env);
        let expiration_ledger = env.ledger().sequence() + 1000;
        env.as_contract(&client.address, || {
            crate::storage::write_balance(&env, &from, allowance_amount);
        });
        client.approve(&from, &spender, &allowance_amount, &expiration_ledger);
        client.burn_from(&spender, &from, &burn_amount);
        prop_assert_eq!(client.allowance(&from, &spender), allowance_amount - burn_amount);
    }
}
