// Minimal server-side logger. Swap for pino/winston when log aggregation is wired up.
export const logger = {
  error(message: string, error: unknown): void {
    console.error(message, error);
  },
};
