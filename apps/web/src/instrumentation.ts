const CLEANUP_INTERVAL_MS = 1000 * 60 * 60 * 24;
const PENDING_ESCALATION_CHECK_INTERVAL_MS = 1000 * 60 * 60; // hourly
const SLA_BREACH_CHECK_INTERVAL_MS = 1000 * 60 * 60; // hourly
const OCR_SWEEP_INTERVAL_MS = 1000 * 60 * 5; // every 5 minutes -- feeds search freshness

/**
 * Runs once per server process on boot (Next.js instrumentation hook). Single-process
 * assumption -- same tradeoff already accepted by the SSE pub/sub in ticket-events.ts.
 * If this ever scales to multiple web replicas, move these to an external cron hitting
 * dedicated /api/internal/* endpoints instead.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { cleanupExpiredAttachments } = await import('@/server/attachments');
  const { queuePendingEscalationDms, queueSlaBreachAlerts } = await import('@/server/notifications');
  const { processPendingAttachmentOcr } = await import('@/server/ocr');
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

  async function runSlaBreachCheck(): Promise<void> {
    try {
      await queueSlaBreachAlerts(env.publicAppUrl);
    } catch (error) {
      logger.error('SLA breach alert sweep failed', error);
    }
  }

  async function runOcrSweep(): Promise<void> {
    try {
      await processPendingAttachmentOcr();
    } catch (error) {
      logger.error('Attachment OCR sweep failed', error);
    }
  }

  void runCleanup();
  void runPendingEscalationCheck();
  void runSlaBreachCheck();
  void runOcrSweep();
  setInterval(() => void runCleanup(), CLEANUP_INTERVAL_MS);
  setInterval(() => void runPendingEscalationCheck(), PENDING_ESCALATION_CHECK_INTERVAL_MS);
  setInterval(() => void runSlaBreachCheck(), SLA_BREACH_CHECK_INTERVAL_MS);
  setInterval(() => void runOcrSweep(), OCR_SWEEP_INTERVAL_MS);
}
