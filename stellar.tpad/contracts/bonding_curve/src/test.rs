#![cfg(test)]

use crate::math::{calc_buy_cost, calc_sell_proceeds};
use crate::{BondingCurveContract, BondingCurveContractClient};
use proptest::prelude::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{contract, contractimpl, Address, Env};

// ---------------------------------------------------------------------------
// Mock token contract — implements the SEP-41 transfer interface.
// Used to register a no-op token at the hardcoded XLM address and at the
// project-token address so that buy() can call transfer() without panicking.
// ---------------------------------------------------------------------------
#[contract]
pub struct MockToken;

#[contractimpl]
impl MockToken {
    pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {}
    pub fn balance(_env: Env, _id: Address) -> i128 {
        i128::MAX
    }
}

// ---------------------------------------------------------------------------
// Helper: set up a fresh BondingCurve environment for one proptest iteration.
//
// Returns (env, client, buyer, token_addr) with:
//   - mock_all_auths enabled
//   - BondingCurveContract registered and initialized
//   - token registered on the curve
//   - MockToken registered at the hardcoded XLM address
//   - MockToken registered at token_addr
// ---------------------------------------------------------------------------
fn setup_env() -> (Env, BondingCurveContractClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    // Register the bonding curve contract
    let contract_id = env.register(BondingCurveContract, ());
    let client = BondingCurveContractClient::new(&env, &contract_id);

    // Admin and treasury addresses
    let admin = Address::generate(&env);

    // Initialize the contract (treasury is hardcoded inside initialize)
    client.initialize(&admin);

    // Register a mock token for the project token
    let token_addr = env.register(MockToken, ());

    // Register the project token on the bonding curve
    client.register_token(&token_addr, &admin);

    // Register a MockToken at the hardcoded XLM address so that
    // buy() can call xlm_client.transfer() without panicking.
    let xlm_addr = Address::from_str(
        &env,
        "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
    );
    #[allow(deprecated)]
    env.register_contract(Some(&xlm_addr), MockToken);

    let buyer = Address::generate(&env);

    // SAFETY: the 'static lifetime is sound here because `env` is moved into
    // the returned tuple and outlives the client.
    let client: BondingCurveContractClient<'static> =
        unsafe { core::mem::transmute(client) };

    (env, client, buyer, token_addr)
}

// Feature: stellar-bonding-curve, Property 1: round-trip symmetry
// calc_buy_cost(base, slope, S, N) == calc_sell_proceeds(base, slope, S + N, N)
proptest! {
    #[test]
    fn prop_round_trip_symmetry(
        base_price in 1i128..=10_000i128,
        slope in 0i128..=100i128,
        sold_supply in 0i128..=1_000_000_000i128,
        token_amount in 1i128..=1_000_000i128,
    ) {
        let buy = calc_buy_cost(base_price, slope, sold_supply, token_amount);
        let sell = calc_sell_proceeds(base_price, slope, sold_supply + token_amount, token_amount);
        prop_assert_eq!(buy, sell);
    }
}

// Feature: stellar-bonding-curve, Property 2: positive spread
// calc_buy_cost(base, slope, S, N) > calc_sell_proceeds(base, slope, S, N) when slope > 0
proptest! {
    #[test]
    fn prop_positive_spread(
        sold_supply in 1i128..=1_000_000_000i128,
        token_amount in 1i128..=1_000_000i128,
    ) {
        // slope=1 ensures spread is positive
        let buy = calc_buy_cost(100, 1, sold_supply, token_amount);
        let sell = calc_sell_proceeds(100, 1, sold_supply, token_amount);
        prop_assert!(buy > sell, "buy={} sell={} at S={} N={}", buy, sell, sold_supply, token_amount);
    }
}

// Feature: stellar-bonding-curve, Property 3: buy/sell state invariants
// Validates: Requirements 13.2, 3.1
//
// After buy(N), sold_supply_after == sold_supply_before + N
proptest! {
    #[test]
    fn prop_buy_increases_sold_supply(token_amount in 1i128..=1_000_000i128) {
        let (_env, client, buyer, token_addr) = setup_env();

        let state_before = client.get_token_state(&token_addr);
        let sold_before = state_before.sold_supply;

        // Compute cost + 1% fee for slippage cap (use a generous max)
        let cost = calc_buy_cost(
            state_before.base_price,
            state_before.slope,
            sold_before,
            token_amount,
        );
        let max_xlm_in = cost + cost / 100 + 1; // cost + fee + 1 stroop buffer

        client.buy(&buyer, &token_addr, &token_amount, &max_xlm_in);

        let state_after = client.get_token_state(&token_addr);
        prop_assert_eq!(
            state_after.sold_supply,
            sold_before + token_amount,
            "sold_supply should increase by exactly token_amount={}", token_amount
        );
    }
}

// Feature: stellar-bonding-curve, Property 3: buy/sell state invariants
// Validates: Requirements 13.3, 4.1
//
// After sell(N), sold_supply_after == sold_supply_before - N
proptest! {
    #[test]
    fn prop_sell_decreases_sold_supply(token_amount in 1i128..=1_000_000i128) {
        let (_env, client, buyer, token_addr) = setup_env();

        // First buy N tokens so sold_supply > 0 and the reserve is funded
        let state_init = client.get_token_state(&token_addr);
        let cost = calc_buy_cost(
            state_init.base_price,
            state_init.slope,
            state_init.sold_supply,
            token_amount,
        );
        let max_xlm_in = cost + cost / 100 + 1; // cost + 1% fee + 1 stroop buffer
        client.buy(&buyer, &token_addr, &token_amount, &max_xlm_in);

        // Record sold_supply after the buy (= token_amount, since we started at 0)
        let state_before = client.get_token_state(&token_addr);
        let sold_before = state_before.sold_supply;

        // Sell the same N tokens back; use min_xlm_out = 0 to avoid slippage rejection
        client.sell(&buyer, &token_addr, &token_amount, &0i128);

        let state_after = client.get_token_state(&token_addr);
        prop_assert_eq!(
            state_after.sold_supply,
            sold_before - token_amount,
            "sold_supply should decrease by exactly token_amount={}", token_amount
        );
    }
}
