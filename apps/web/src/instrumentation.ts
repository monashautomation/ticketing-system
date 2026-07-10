const CLEANUP_INTERVAL_MS = 1000 * 60 * 60 * 24;

/**
 * Runs once per server process on boot (Next.js instrumentation hook). Single-process
 * assumption -- same tradeoff already accepted by the SSE pub/sub in ticket-events.ts.
 * If this ever scales to multiple web replicas, move this to an external cron hitting
 * /api/internal/cleanup-attachments instead.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { cleanupExpiredAttachments } = await import('@/server/attachments');
  const { logger } = await import('@/lib/logger');

  async function runCleanup(): Promise<void> {
    try {
      await cleanupExpiredAttachments();
    } catch (error) {
      logger.error('Attachment cleanup failed', error);
    }
  }

  void runCleanup();
  setInterval(() => void runCleanup(), CLEANUP_INTERVAL_MS);
}
