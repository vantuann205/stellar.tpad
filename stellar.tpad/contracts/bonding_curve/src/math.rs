/// Pure bonding curve math — no Env dependency.
///
/// Linear bonding curve: price(x) = base_price + slope * (x / 10^7)
/// where x is in raw token units (7 decimals).
///
/// Buy cost = integral from S to S+N of price(x) dx
///          = N * base_price + slope * S * N / 10^7 + slope * N * (N - 1) / (2 * 10^7)
///
/// Sell proceeds = integral from S-N to S of price(x) dx
///              = N * base_price + slope * (S - N) * N / 10^7 + slope * N * (N - 1) / (2 * 10^7)
///
/// Invariant: calc_buy_cost(base, slope, S, N) == calc_sell_proceeds(base, slope, S + N, N)

/// Calculate the total XLM cost (in stroops) to buy `token_amount` raw token units
/// when `sold_supply` raw units have already been sold.
///
/// All values use raw units (7 decimals for tokens, stroops for XLM).
pub fn calc_buy_cost(
    base_price: i128,
    slope: i128,
    sold_supply: i128,
    token_amount: i128,
) -> i128 {
    let n = token_amount;
    let s = sold_supply;
    // N * base_price  +  slope * S * N / 10^7  +  slope * N * (N-1) / (2 * 10^7)
    n * base_price
        + slope * s * n / 10_000_000
        + slope * n * (n - 1) / (2 * 10_000_000)
}

/// Calculate the total XLM proceeds (in stroops) from selling `token_amount` raw token units
/// when `sold_supply` raw units are currently sold (i.e. seller holds some of those).
///
/// All values use raw units (7 decimals for tokens, stroops for XLM).
pub fn calc_sell_proceeds(
    base_price: i128,
    slope: i128,
    sold_supply: i128,
    token_amount: i128,
) -> i128 {
    let n = token_amount;
    let s = sold_supply;
    // N * base_price  +  slope * (S-N) * N / 10^7  +  slope * N * (N-1) / (2 * 10^7)
    n * base_price
        + slope * (s - n) * n / 10_000_000
        + slope * n * (n - 1) / (2 * 10_000_000)
}

#[cfg(test)]
mod unit_tests {
    use super::*;

    #[test]
    fn test_buy_cost_zero_supply() {
        // At sold_supply=0, buying 1 token (10^7 raw units) costs base_price * 10^7 stroops
        let cost = calc_buy_cost(100, 1, 0, 10_000_000);
        // N * base_price = 10_000_000 * 100 = 1_000_000_000
        // slope * S * N / 10^7 = 0
        // slope * N * (N-1) / (2 * 10^7) = 1 * 10_000_000 * 9_999_999 / 20_000_000 = 4_999_999
        assert_eq!(cost, 10_000_000 * 100 + 1 * 10_000_000 * 9_999_999 / 20_000_000);
    }

    #[test]
    fn test_round_trip_symmetry_simple() {
        let base = 100i128;
        let slope = 1i128;
        let s = 1_000_000_000i128; // 100 tokens sold
        let n = 10_000_000i128;    // buy/sell 1 token
        let buy = calc_buy_cost(base, slope, s, n);
        let sell = calc_sell_proceeds(base, slope, s + n, n);
        assert_eq!(buy, sell, "round-trip symmetry must hold");
    }

    #[test]
    fn test_positive_spread() {
        // buy at S must cost more than sell at S (because buy pushes price up)
        let base = 100i128;
        let slope = 1i128;
        let s = 5_000_000_000i128;
        let n = 10_000_000i128;
        let buy = calc_buy_cost(base, slope, s, n);
        let sell = calc_sell_proceeds(base, slope, s, n);
        assert!(buy > sell, "buy cost must exceed sell proceeds at same supply");
    }

    #[test]
    fn test_sell_proceeds_zero_slope() {
        // With slope=0, price is flat = base_price, buy == sell
        let base = 500i128;
        let slope = 0i128;
        let s = 1_000_000_000i128;
        let n = 10_000_000i128;
        let buy = calc_buy_cost(base, slope, s, n);
        let sell = calc_sell_proceeds(base, slope, s, n);
        assert_eq!(buy, sell, "flat curve: buy == sell");
        assert_eq!(buy, n * base);
    }
}
