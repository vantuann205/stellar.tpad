/**
 * Next.js Instrumentation Hook — runs once on server startup.
 *
 * Responsibilities:
 * 1. Keep Neon DB alive by pinging every 4 minutes (Neon sleeps after 5 min idle)
 * 2. Record price snapshots every minute for accurate 5m/1h/6h price change tracking
 */

export async function register() {
  // Only run in Node.js runtime (not Edge), and only in production or when explicitly enabled
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Lazy import to avoid issues during build
  const { startBackgroundJobs } = await import('@/lib/background-jobs');
  startBackgroundJobs();
}
