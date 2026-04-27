import { query } from '@/lib/db';

const DEFAULT_INITIAL_PRICE = 0.0001;

type CalculateMetricsInput = {
  tokenId: number;
  currentPrice?: number | string | null;
  recordSnapshot?: boolean;
};

type TokenRow = {
  id: number;
  total_supply: string | number | null;
  sold_supply: string | number | null;
  current_price: string | number | null;
  price_snapshot_value: string | number | null;
  created_at: string | Date;
  base_price: string | number | null;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const round4 = (value: number): number => Number(value.toFixed(4));

async function getPriceAtWindow(
  tokenId: number,
  minutes: number,
  tokenCreatedAt: string | Date,
  launchPrice: number
): Promise<number | null> {
  // Get the price snapshot closest to (but before) the window start
  // e.g. for 5m: get the snapshot recorded ~5 minutes ago
  const snapshotResult = await query(
    `SELECT price
     FROM price_snapshots
     WHERE token_id = $1
       AND recorded_at <= NOW() - ($2 * INTERVAL '1 minute')
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [tokenId, minutes]
  );

  if (snapshotResult.rows.length > 0) {
    return toNumber(snapshotResult.rows[0].price, 0);
  }

  // No snapshot before the window — token is younger than the window
  // Use launch price as the baseline (token just started)
  const createdAtMs = new Date(tokenCreatedAt).getTime();
  if (!Number.isNaN(createdAtMs)) {
    const ageMs = Date.now() - createdAtMs;
    if (ageMs < minutes * 60 * 1000) {
      return launchPrice;
    }
  }

  // Token older than window but no snapshot — no data, show 0%
  return null;
}

async function maybeInsertSnapshot(tokenId: number, currentPrice: number): Promise<void> {
  const latestSnapshot = await query(
    `SELECT price, recorded_at
     FROM price_snapshots
     WHERE token_id = $1
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [tokenId]
  );

  if (latestSnapshot.rows.length > 0) {
    const lastPrice = toNumber(latestSnapshot.rows[0].price, -1);
    const recordedAtMs = new Date(latestSnapshot.rows[0].recorded_at).getTime();
    const ageMs = Number.isNaN(recordedAtMs) ? Infinity : Date.now() - recordedAtMs;

    if (lastPrice === currentPrice && ageMs < 15_000) {
      return;
    }
  }

  await query(
    `INSERT INTO price_snapshots (token_id, price, recorded_at)
     VALUES ($1, $2, NOW())`,
    [tokenId, currentPrice]
  );
}

export async function calculateAndStoreTokenMetrics({
  tokenId,
  currentPrice,
  recordSnapshot = false,
}: CalculateMetricsInput) {
  const tokenResult = await query(
    `SELECT id, total_supply, sold_supply, current_price, price_snapshot_value, created_at, base_price
     FROM tokens
     WHERE id = $1
     LIMIT 1`,
    [tokenId]
  );

  if (tokenResult.rows.length === 0) {
    throw new Error('Token not found');
  }

  const token = tokenResult.rows[0] as TokenRow;

  // current_price = price_per_token of the latest trade in purchases.
  // If no trade yet, keep existing price. Never recalculate from sold_supply.
  const latestTradeResult = await query(
    `SELECT price_per_token
     FROM purchases
     WHERE token_id = $1 AND status = 'completed'
     ORDER BY created_at DESC
     LIMIT 1`,
    [tokenId]
  );

  const latestTradePrice = latestTradeResult.rows.length > 0
    ? toNumber(latestTradeResult.rows[0].price_per_token, 0)
    : 0;

  const storedPrice = toNumber(token.current_price, 0);
  const launchPrice = DEFAULT_INITIAL_PRICE;

  // Priority: passed-in price (from trade) > latest trade in DB > stored price > launch
  const resolvedCurrentPrice =
    toNumber(currentPrice, 0) ||
    latestTradePrice ||
    storedPrice ||
    launchPrice;

  const [volumeResult, traderResult, p5m, p1h, p4h, p6h, p24h] = await Promise.all([
    // Volume 24h = sum of tokens traded (quantity bought + sold)
    query(
      `SELECT COALESCE(SUM(quantity::numeric), 0) AS volume_24h
       FROM purchases
       WHERE token_id = $1
         AND status = 'completed'
         AND created_at >= NOW() - INTERVAL '24 hours'`,
      [tokenId]
    ),
    query(
      `SELECT COUNT(*) AS cnt
       FROM (
         SELECT address
         FROM (
           SELECT buyer_address AS address, SUM(quantity::numeric) AS net_qty
           FROM purchases
           WHERE token_id = $1
             AND buyer_address IS NOT NULL
             AND status = 'completed'
           GROUP BY buyer_address
           UNION ALL
           SELECT seller_address AS address, -SUM(quantity::numeric) AS net_qty
           FROM purchases
           WHERE token_id = $1
             AND seller_address IS NOT NULL
             AND status = 'completed'
           GROUP BY seller_address
         ) net_moves
         GROUP BY address
         HAVING SUM(net_qty) > 0
       ) holder_wallets`,
      [tokenId]
    ),
    getPriceAtWindow(tokenId, 5, token.created_at, launchPrice),
    getPriceAtWindow(tokenId, 60, token.created_at, launchPrice),
    getPriceAtWindow(tokenId, 240, token.created_at, launchPrice),
    getPriceAtWindow(tokenId, 360, token.created_at, launchPrice),
    getPriceAtWindow(tokenId, 1440, token.created_at, launchPrice),
  ]);

  const calcChange = (pastPrice: number | null): number => {
    if (!pastPrice || pastPrice <= 0 || resolvedCurrentPrice <= 0) return 0;
    const change = ((resolvedCurrentPrice - pastPrice) / pastPrice) * 100;
    // Cap at ±99999.9999 to fit NUMERIC(10,4) column
    return round4(Math.max(-99999, Math.min(99999, change)));
  };

  // Market cap = current_price × total_supply (standard definition)
  const totalSupply = toNumber(token.total_supply, 0);
  const marketcap = resolvedCurrentPrice * totalSupply;
  const metrics = {
    current_price: resolvedCurrentPrice,
    marketcap,
    volume_24h: toNumber(volumeResult.rows[0]?.volume_24h, 0),
    price_change_5m: calcChange(p5m),
    price_change_1h: calcChange(p1h),
    price_change_4h: calcChange(p4h),
    price_change_6h: calcChange(p6h),
    price_change_24h: calcChange(p24h),
    trader_count: parseInt(String(traderResult.rows[0]?.cnt ?? '0'), 10) || 0,
    price_snapshot_value: resolvedCurrentPrice,
  };

  if (recordSnapshot && resolvedCurrentPrice > 0) {
    await maybeInsertSnapshot(tokenId, resolvedCurrentPrice);
  }

  await query(
    `UPDATE tokens
     SET current_price = $2,
         marketcap = $3,
         volume_24h = $4,
         price_change_5m = $5,
         price_change_1h = $6,
         price_change_4h = $7,
         price_change_6h = $8,
         price_change_24h = $9,
         trader_count = $10,
         price_snapshot_value = $11,
         price_snapshot_time = NOW(),
         metrics_updated_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [
      tokenId,
      metrics.current_price,
      metrics.marketcap,
      metrics.volume_24h,
      metrics.price_change_5m,
      metrics.price_change_1h,
      metrics.price_change_4h,
      metrics.price_change_6h,
      metrics.price_change_24h,
      metrics.trader_count,
      metrics.price_snapshot_value,
    ]
  );

  return metrics;
}
