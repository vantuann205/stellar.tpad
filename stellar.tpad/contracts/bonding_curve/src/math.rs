/// Pure bonding curve math — no Env dependency.
///
/// Linear bonding curve: price(S) = base_price + slope * S
/// where S is in TOKEN units (sold_supply / 10^7), price is in stroops.
///
/// This means slope is in stroops per token (not per raw unit).
///
/// Buy cost = integral from S to S+N of price(x) dx  (S, N in token units)
///          = N * base_price + slope * S * N + slope * N * (N - 1) / 2
///
/// Sell proceeds = integral from S-N to S of price(x) dx
///              = N * base_price + slope * (S - N) * N + slope * N * (N - 1) / 2
///
/// Invariant: calc_buy_cost(base, slope, S, N) == calc_sell_proceeds(base, slope, S + N, N)
///
/// Default params:
///   base_price = 1_000 stroops  (0.0001 XLM — near-zero start)
///   slope      = 250_000 stroops/token
///   => at 800k tokens sold: price ≈ 20,000 XLM/token
///   => at 1M  tokens sold: price ≈ 25,000 XLM/token

const SCALE: i128 = 10_000_000; // 10^7 decimals

/// Convert raw token units to token units (divide by 10^7).
#[inline]
fn to_tokens(raw: i128) -> i128 {
    raw / SCALE
}

/// Calculate the total XLM cost (in stroops) to buy `token_amount` raw units
/// when `sold_supply` raw units have already been sold.
pub fn calc_buy_cost(
    base_price: i128,
    slope: i128,
    sold_supply: i128,
    token_amount: i128,
) -> i128 {
    let n = to_tokens(token_amount); // convert to token units
    let s = to_tokens(sold_supply);  // convert to token units
    // N * base_price  +  slope * S * N  +  slope * N * (N-1) / 2
    n * base_price
        + slope * s * n
        + slope * n * (n - 1) / 2
}

/// Calculate the total XLM proceeds (in stroops) from selling `token_amount` raw units
/// when `sold_supply` raw units are currently sold.
pub fn calc_sell_proceeds(
    base_price: i128,
    slope: i128,
    sold_supply: i128,
    token_amount: i128,
) -> i128 {
    let n = to_tokens(token_amount);
    let s = to_tokens(sold_supply);
    // N * base_price  +  slope * (S-N) * N  +  slope * N * (N-1) / 2
    n * base_price
        + slope * (s - n) * n
        + slope * n * (n - 1) / 2
}

#[cfg(test)]
mod unit_tests {
    use super::*;

    // 1 token = 10^7 raw units
    const ONE_TOKEN: i128 = 10_000_000;
    const STROOPS_PER_XLM: i128 = 10_000_000;

    #[test]
    fn test_price_at_zero_supply() {
        // At sold=0, buying 1 token costs base_price stroops
        let cost = calc_buy_cost(1_000, 250_000, 0, ONE_TOKEN);
        assert_eq!(cost, 1_000, "cost at zero supply = base_price * 1 token");
    }

    #[test]
    fn test_price_at_800k_tokens() {
        // At 800k tokens sold, price ≈ 20,000 XLM/token
        let sold = 800_000 * ONE_TOKEN;
        let cost = calc_buy_cost(1_000, 250_000, sold, ONE_TOKEN);
        let price_xlm = cost / STROOPS_PER_XLM;
        assert!(
            price_xlm >= 19_990 && price_xlm <= 20_010,
            "price at 800k tokens should be ~20,000 XLM, got {}",
            price_xlm
        );
    }

    #[test]
    fn test_price_at_1m_tokens() {
        // At 1M tokens sold, price ≈ 25,000 XLM/token
        let sold = 1_000_000 * ONE_TOKEN;
        let cost = calc_buy_cost(1_000, 250_000, sold, ONE_TOKEN);
        let price_xlm = cost / STROOPS_PER_XLM;
        assert!(
            price_xlm >= 24_990 && price_xlm <= 25_010,
            "price at 1M tokens should be ~25,000 XLM, got {}",
            price_xlm
        );
    }

    #[test]
    fn test_round_trip_symmetry() {
        let base = 1_000i128;
        let slope = 250_000i128;
        let s = 500_000 * ONE_TOKEN; // 500k tokens sold
        let n = ONE_TOKEN;           // buy/sell 1 token
        let buy = calc_buy_cost(base, slope, s, n);
        let sell = calc_sell_proceeds(base, slope, s + n, n);
        assert_eq!(buy, sell, "round-trip symmetry must hold");
    }

    #[test]
    fn test_positive_spread() {
        let base = 1_000i128;
        let slope = 250_000i128;
        let s = 500_000 * ONE_TOKEN;
        let n = 10 * ONE_TOKEN; // buy/sell 10 tokens
        let buy = calc_buy_cost(base, slope, s, n);
        let sell = calc_sell_proceeds(base, slope, s, n);
        assert!(buy > sell, "buy cost must exceed sell proceeds at same supply");
    }

    #[test]
    fn test_flat_curve_zero_slope() {
        let base = 1_000i128;
        let slope = 0i128;
        let s = 100_000 * ONE_TOKEN;
        let n = ONE_TOKEN;
        let buy = calc_buy_cost(base, slope, s, n);
        let sell = calc_sell_proceeds(base, slope, s, n);
        assert_eq!(buy, sell, "flat curve: buy == sell");
        assert_eq!(buy, base); // 1 token * base_price
    }
}
