/// Pure bonding curve math — no Env dependency.
///
/// Linear bonding curve: price(S) = base_price + slope * S
/// where S is in TOKEN units (sold_supply / 10^7), price is in stroops.
///
/// Buy cost = integral from S to S+N of price(x) dx  (S, N in token units)
///          = N * base_price + slope * S * N + slope * N * (N - 1) / 2
///
/// Sell proceeds = integral from S-N to S of price(x) dx
///              = N * base_price + slope * (S - N) * N + slope * N * (N - 1) / 2
///
/// Loss from round-trip (buy then sell immediately):
///   Loss = slope * N^2 / 2  (slippage from curve)
///   + Fee (0.5% on buy + 0.5% on sell = ~1% total)
///   => Total loss ≈ slippage + 1%
///
/// Params (very slow growth, graduate at 100k XLM):
///   base_price = 10 stroops    (0.000001 XLM — near-zero start)
///   slope      = 750 stroops/token
///   => at 1M tokens sold:   price ≈ 0.075 XLM/token
///   => at 10M tokens sold:  price ≈ 0.75 XLM/token
///   => at 100M tokens sold: price ≈ 7.5 XLM/token

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
    let n = to_tokens(token_amount);
    let s = to_tokens(sold_supply);
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

    const ONE_TOKEN: i128 = 10_000_000;
    const STROOPS_PER_XLM: i128 = 10_000_000;

    #[test]
    fn test_price_at_zero_supply() {
        // At sold=0, buying 1 token costs base_price stroops
        let cost = calc_buy_cost(1_000, 25_000, 0, ONE_TOKEN);
        assert_eq!(cost, 1_000, "cost at zero supply = base_price * 1 token");
    }

    #[test]
    fn test_price_at_100k_tokens() {
        // At 100k tokens sold, price ≈ 0.25 XLM/token
        let sold = 100_000 * ONE_TOKEN;
        let cost = calc_buy_cost(1_000, 25_000, sold, ONE_TOKEN);
        let price_xlm = cost / STROOPS_PER_XLM;
        assert!(
            price_xlm >= 0 && price_xlm <= 1,
            "price at 100k tokens should be ~0.25 XLM, got {}",
            price_xlm
        );
    }

    #[test]
    fn test_round_trip_symmetry() {
        // Buy N then sell N immediately → lose slippage only (no spread)
        let base = 1_000i128;
        let slope = 25_000i128;
        let s = 100_000 * ONE_TOKEN;
        let n = ONE_TOKEN;
        let buy = calc_buy_cost(base, slope, s, n);
        let sell = calc_sell_proceeds(base, slope, s + n, n);
        assert_eq!(buy, sell, "round-trip at same supply should be symmetric");
    }

    #[test]
    fn test_slippage_loss() {
        // Buy 1000 tokens at S=0, sell at S=1000 → lose slippage
        let base = 1_000i128;
        let slope = 25_000i128;
        let n = 1_000 * ONE_TOKEN;
        
        let buy_cost = calc_buy_cost(base, slope, 0, n);
        let sell_proceeds = calc_sell_proceeds(base, slope, n, n);
        
        // Slippage loss = slope * N^2 / 2 = 25000 * 1000 * 1000 / 2 = 12.5M stroops = 1.25 XLM
        let slippage = buy_cost - sell_proceeds;
        let expected_slippage = slope * 1_000 * 1_000 / 2;
        assert_eq!(slippage, expected_slippage, "slippage should match formula");
    }

    #[test]
    fn test_small_trade_high_slippage() {
        // Small trades at low supply have high % slippage
        let base = 1_000i128;
        let slope = 25_000i128;
        let n = 100 * ONE_TOKEN;
        
        let buy_cost = calc_buy_cost(base, slope, 0, n);
        let sell_proceeds = calc_sell_proceeds(base, slope, n, n);
        
        let loss_pct = ((buy_cost - sell_proceeds) * 100) / buy_cost;
        assert!(
            loss_pct > 50,
            "small trades should have high slippage %, got {}%",
            loss_pct
        );
    }

    #[test]
    fn test_large_trade_low_slippage() {
        // Large trades at high supply have lower % slippage
        let base = 1_000i128;
        let slope = 25_000i128;
        let s = 500_000 * ONE_TOKEN;
        let n = 1_000 * ONE_TOKEN;
        
        let buy_cost = calc_buy_cost(base, slope, s, n);
        let sell_proceeds = calc_sell_proceeds(base, slope, s + n, n);
        
        let loss_pct = ((buy_cost - sell_proceeds) * 100) / buy_cost;
        assert!(
            loss_pct < 5,
            "large trades at high supply should have low slippage %, got {}%",
            loss_pct
        );
    }
}
