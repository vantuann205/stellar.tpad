// Linear bonding curve: price(S) = base_price + slope * S_tokens
// Buy cost  = N*base + slope*S*N + slope*N*(N-1)/2
// Sell proc = N*base + slope*(S-N)*N + slope*N*(N-1)/2

pub const SCALE: i128 = 10_000_000;

#[inline]
fn to_tokens(raw: i128) -> i128 {
    raw / SCALE
}

pub fn calc_buy_cost(base_price: i128, slope: i128, sold_supply: i128, token_amount: i128) -> i128 {
    let n = to_tokens(token_amount);
    let s = to_tokens(sold_supply);
    n * base_price + slope * s * n + slope * n * (n - 1) / 2
}

pub fn calc_sell_proceeds(
    base_price: i128,
    slope: i128,
    sold_supply: i128,
    token_amount: i128,
) -> i128 {
    let n = to_tokens(token_amount);
    let s = to_tokens(sold_supply);
    n * base_price + slope * (s - n) * n + slope * n * (n - 1) / 2
}

#[cfg(test)]
mod unit_tests {
    use super::*;
    const ONE: i128 = 10_000_000;

    #[test]
    fn round_trip_symmetry() {
        let (base, slope) = (1_000i128, 25_000i128);
        let s = 100_000 * ONE;
        let buy = calc_buy_cost(base, slope, s, ONE);
        let sell = calc_sell_proceeds(base, slope, s + ONE, ONE);
        assert_eq!(buy, sell);
    }
}
