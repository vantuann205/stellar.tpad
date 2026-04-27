/**
 * Background jobs for Railway deployment.
 *
 * Job 1 — Neon DB keepalive (every 4 min)
 *   Neon serverless sleeps after 5 min of inactivity.
 *   A lightweight ping prevents cold starts for users.
 *
 * Job 2 — Price snapshot recorder (every 60 sec)
 *   Records current_price into price_snapshots for every active token.
 *   This powers accurate 5m / 1h / 6h / 24h price change calculations.
 *   Without this, price_change windows show 0% until a trade happens.
 */

import { query } from './db';

let started = false;

export function startBackgroundJobs() {
  if (started) return;
  started = true;

  console.log('[bg] Starting background jobs...');

  // ── Job 1: Neon keepalive every 4 minutes ─────────────────────────────────
  setInterval(async () => {
    try {
      await query('SELECT 1');
      // silent — just keeping connection warm
    } catch (err) {
      console.warn('[bg] Neon keepalive failed:', err);
    }
  }, 4 * 60 * 1000); // 4 minutes

  // ── Job 2: Price snapshot every 60 seconds ────────────────────────────────
  // Stagger start by 10s to avoid hitting DB immediately on boot
  setTimeout(() => {
    recordPriceSnapshots(); // run once immediately after stagger
    setInterval(recordPriceSnapshots, 60 * 1000); // then every 60s
  }, 10_000);

  console.log('[bg] Background jobs started: keepalive=4min, snapshots=60s');
}

async function recordPriceSnapshots() {
  try {
    // Get all tokens that have been traded (have a current_price > 0)
    const tokens = await query(
      `SELECT id, current_price
       FROM tokens
       WHERE current_price > 0
         AND current_price IS NOT NULL
       ORDER BY metrics_updated_at DESC NULLS LAST
       LIMIT 100`
    ) as any;

    if (!tokens?.rows || tokens.rows.length === 0) return;

    // Insert snapshot for each token — skip if price hasn't changed in last 30s
    // to avoid flooding the table with identical values
    for (const token of tokens?.rows || []) {
      const price = parseFloat(token.current_price);
      if (!price || price <= 0) continue;

      try {
        // Check last snapshot — skip if same price within 30s
        const last = await query(
          `SELECT price, recorded_at
           FROM price_snapshots
           WHERE token_id = $1
           ORDER BY recorded_at DESC
           LIMIT 1`,
          [token.id]
        ) as any;

        if (last?.rows && last.rows.length > 0) {
          const lastPrice = parseFloat(last?.rows?.[0]?.price);
          const lastTime = new Date(last?.rows?.[0]?.recorded_at).getTime();
          const ageMs = Date.now() - lastTime;

          // Skip if same price and recorded less than 30s ago
          if (lastPrice === price && ageMs < 30_000) continue;
        }

        await query(
          `INSERT INTO price_snapshots (token_id, price, recorded_at)
           VALUES ($1, $2, NOW())`,
          [token.id, price]
        );
      } catch {
        // Per-token errors are non-fatal
      }
    }
  } catch (err) {
    console.warn('[bg] Price snapshot job failed:', err);
  }
}
