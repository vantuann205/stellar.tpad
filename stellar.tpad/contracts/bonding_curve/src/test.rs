#![cfg(test)]

use crate::math::{calc_buy_cost, calc_sell_proceeds};
use proptest::prelude::*;

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
