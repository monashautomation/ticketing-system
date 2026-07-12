function timestamp(): string {
  return new Date().toISOString();
}

// Minimal structured console logger -- swap for pino/winston when log aggregation is wired up.
export const logger = {
  info(message: string, meta?: Record<string, unknown>): void {
    console.log(`[${timestamp()}] INFO  ${message}`, meta ?? '');
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`[${timestamp()}] WARN  ${message}`, meta ?? '');
  },
  error(message: string, error: unknown): void {
    console.error(`[${timestamp()}] ERROR ${message}`, error);
  },
};
