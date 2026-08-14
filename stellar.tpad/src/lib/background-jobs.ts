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
    await query(`
      WITH active_tokens AS (
        SELECT id, current_price
        FROM tokens
        WHERE current_price > 0
        ORDER BY metrics_updated_at DESC NULLS LAST
        LIMIT 100
      )
      INSERT INTO price_snapshots (token_id, price, recorded_at)
      SELECT token.id, token.current_price, NOW()
      FROM active_tokens token
      LEFT JOIN LATERAL (
        SELECT price
        FROM price_snapshots
        WHERE token_id = token.id
        ORDER BY recorded_at DESC
        LIMIT 1
      ) latest ON TRUE
      WHERE latest.price IS DISTINCT FROM token.current_price
    `);
  } catch (err) {
    console.warn('[bg] Price snapshot job failed:', err);
  }
}
