const CLEANUP_INTERVAL_MS = 1000 * 60 * 60 * 24;
const PENDING_ESCALATION_CHECK_INTERVAL_MS = 1000 * 60 * 60; // hourly

/**
 * Runs once per server process on boot (Next.js instrumentation hook). Single-process
 * assumption -- same tradeoff already accepted by the SSE pub/sub in ticket-events.ts.
 * If this ever scales to multiple web replicas, move these to an external cron hitting
 * dedicated /api/internal/* endpoints instead.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { cleanupExpiredAttachments } = await import('@/server/attachments');
  const { queuePendingEscalationDms } = await import('@/server/notifications');
  const { env } = await import('@/lib/env');
  const { logger } = await import('@/lib/logger');

  async function runCleanup(): Promise<void> {
    try {
      await cleanupExpiredAttachments();
    } catch (error) {
      logger.error('Attachment cleanup failed', error);
    }
  }

  async function runPendingEscalationCheck(): Promise<void> {
    try {
      await queuePendingEscalationDms(env.publicAppUrl);
    } catch (error) {
      logger.error('Pending-ticket escalation DM sweep failed', error);
    }
  }

  void runCleanup();
  void runPendingEscalationCheck();
  setInterval(() => void runCleanup(), CLEANUP_INTERVAL_MS);
  setInterval(() => void runPendingEscalationCheck(), PENDING_ESCALATION_CHECK_INTERVAL_MS);
}
