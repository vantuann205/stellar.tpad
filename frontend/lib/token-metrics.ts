import { query } from '@/lib/db';

const RPC_URL = 'https://testnet.sapphire.oasis.io';

type Input = { tokenId: number; currentPrice?: string | number | null };

export async function calculateAndStoreTokenMetrics({ tokenId, currentPrice }: Input) {
  const tokenResult = await query('SELECT * FROM tokens WHERE id = $1', [tokenId]);
  if (tokenResult.rows.length === 0) throw new Error('Token not found');
  const token = tokenResult.rows[0];

  // ── Giá hiện tại — lấy từ chain (getCurrentPrice) ───────────────────
  const latestTradeResult = await query(
    `SELECT price_per_token FROM purchases
     WHERE token_id = $1 AND status = 'completed'
     ORDER BY created_at DESC LIMIT 1`,
    [tokenId]
  );
  const latestTradePrice = latestTradeResult.rows[0]?.price_per_token
    ? parseFloat(latestTradeResult.rows[0].price_per_token) : null;

  let price = currentPrice ? parseFloat(String(currentPrice)) : 0;
  let totalSupply = parseFloat(token.total_supply) || 0;

  // Luôn lấy getCurrentPrice() từ chain — đây là giá thật
  if (token.contract_address) {
    try {
      const [pr, sr] = await Promise.all([
        fetch(RPC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc:'2.0', method:'eth_call', params:[{ to: token.contract_address, data:'0xeb91d37e' },'latest'], id:1 }) }),
        fetch(RPC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc:'2.0', method:'eth_call', params:[{ to: token.contract_address, data:'0x18160ddd' },'latest'], id:2 }) }),
      ]);
      const pd = await pr.json(); const sd = await sr.json();
      if (pd?.result && pd.result !== '0x') price = parseInt(pd.result, 16) / 1e18;
      if (sd?.result && sd.result !== '0x') totalSupply = parseInt(sd.result, 16) / 1e18;
    } catch { /* silent */ }
  }

  // Fallback nếu chain không trả về
  if (price === 0) price = latestTradePrice ?? parseFloat(token.price_snapshot_value || '0.05');

  // ── Marketcap ─────────────────────────────────────────────────────────
  const marketcap = price * totalSupply;

  // ── Volume 24h ────────────────────────────────────────────────────────
  const volRes = await query(
    `SELECT COALESCE(SUM(COALESCE(quantity, CASE WHEN price_per_token = 0 THEN 0 ELSE total_price / price_per_token END)), 0) AS vol
     FROM purchases WHERE token_id = $1 AND status = 'completed' AND created_at >= NOW() - INTERVAL '24 hours'`,
    [tokenId]
  );
  const volume_24h = parseFloat(volRes.rows[0].vol) || 0;

  // ── Trader count (net positive holders) ───────────────────────────────
  const traderRes = await query(
    `SELECT COUNT(*) AS cnt FROM (
       SELECT address FROM (
         SELECT buyer_address AS address, SUM(quantity::numeric) AS net FROM purchases
         WHERE token_id = $1 AND buyer_address IS NOT NULL AND status = 'completed' GROUP BY buyer_address
         UNION ALL
         SELECT seller_address, -SUM(quantity::numeric) FROM purchases
         WHERE token_id = $1 AND seller_address IS NOT NULL AND status = 'completed' GROUP BY seller_address
       ) t GROUP BY address HAVING SUM(net) > 0
     ) h`,
    [tokenId]
  );
  const trader_count = parseInt(traderRes.rows[0].cnt) || 0;

  // ── Price changes: tính TRƯỚC khi insert snapshot mới ───────────────
  // Giá quá khứ = snapshot gần nhất TẠI hoặc TRƯỚC mốc đó
  // Fallback = price_snapshot_value cũ trong DB (giá trước trade này)
  const oldPrice = parseFloat(token.price_snapshot_value || '0.05');

  // Giá khởi tạo = price_snapshot_value lúc token được tạo (0.05)
  // Dùng token.created_at để xác định tuổi token
  const LAUNCH_PRICE = 0.05; // giá cố định khi token mới tạo

  const getPriceAtWindow = async (minutes: number): Promise<number | null> => {
    // Lấy snapshot gần nhất TRƯỚC mốc thời gian
    const r = await query(
      `SELECT price FROM price_snapshots
       WHERE token_id = $1
         AND recorded_at <= NOW() - ($2 * INTERVAL '1 minute')
       ORDER BY recorded_at DESC LIMIT 1`,
      [tokenId, minutes]
    );
    if (r.rows.length > 0) return parseFloat(r.rows[0].price);

    // Không có snapshot trước mốc
    // → Token còn trẻ hơn window: dùng giá launch để tính % từ đầu
    const tokenAge = await query(
      `SELECT EXTRACT(EPOCH FROM (NOW() - created_at))/60 AS age_minutes FROM tokens WHERE id = $1`,
      [tokenId]
    );
    const ageMinutes = parseFloat(tokenAge.rows[0]?.age_minutes || '9999');

    if (ageMinutes < minutes) {
      // Token chưa đủ tuổi → so với giá launch
      return LAUNCH_PRICE;
    }

    // Token đủ tuổi nhưng không có snapshot trước mốc
    // → Không có trade nào trong window đó → giá không đổi → 0%
    return null;
  };

  const calcChange = (past: number | null) =>
    past && past > 0 ? ((price - past) / past) * 100 : 0;

  let price_change_5m = 0, price_change_1h = 0, price_change_6h = 0;

  if (price > 0) {
    try {
      const [p5m, p1h, p6h] = await Promise.all([
        getPriceAtWindow(5),
        getPriceAtWindow(60),
        getPriceAtWindow(360),
      ]);
      price_change_5m = calcChange(p5m);
      price_change_1h = calcChange(p1h);
      price_change_6h = calcChange(p6h);
    } catch (e) {
      console.warn('Warning calculating price changes:', e);
    }
  }

  // ── Insert snapshot SAU khi tính change ──────────────────────────────
  await query(
    `INSERT INTO price_snapshots (token_id, price, recorded_at) VALUES ($1, $2, NOW())`,
    [tokenId, price]
  );

  // ── Update DB ─────────────────────────────────────────────────────────
  const updateResult = await query(
    `UPDATE tokens SET
       marketcap = $2,
       volume_24h = $3,
       price_change_5m = $4,
       price_change_1h = $5,
       price_change_6h = $6,
       trader_count = $7,
       price_snapshot_value = $8,
       price_snapshot_time = NOW(),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      tokenId,
      marketcap,
      volume_24h,
      parseFloat(price_change_5m.toFixed(4)),
      parseFloat(price_change_1h.toFixed(4)),
      parseFloat(price_change_6h.toFixed(4)),
      trader_count,
      price,
    ]
  );

  return updateResult.rows[0];
}
