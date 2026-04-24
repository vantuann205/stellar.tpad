/**
 * Next.js Instrumentation — chạy khi server start (Node.js runtime only)
 * Background job: recalculate price_change metrics mỗi 5 phút
 * Đảm bảo 5m/1h/6h tự reset về 0 khi không có trade trong window đó
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { calculateAndStoreTokenMetrics } = await import('@/lib/token-metrics');
    const { query } = await import('@/lib/db');

    const recalcAll = async () => {
      try {
        // Chỉ recalc tokens có giao dịch trong 7 ngày qua
        const result = await query(
          `SELECT DISTINCT token_id FROM price_snapshots
           WHERE recorded_at >= NOW() - INTERVAL '7 days'`,
          []
        );
        for (const row of result.rows) {
          try {
            await calculateAndStoreTokenMetrics({ tokenId: row.token_id });
          } catch { /* silent per token */ }
        }
      } catch { /* silent */ }
    };

    // Chạy mỗi 5 phút
    setInterval(recalcAll, 5 * 60 * 1000);

    // Lần đầu chạy sau 5 phút (không chạy ngay để tránh ghi đè metrics vừa được tính)
    setTimeout(recalcAll, 5 * 60 * 1000);
  }
}
