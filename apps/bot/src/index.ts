import { logger } from './logger';
import { syncAuthentikDirectory } from './api-client';
import { processPendingDiscordDms } from './discord-dms';

const AUTHENTIK_SYNC_INTERVAL_MS = 1000 * 60 * 15;
const DISCORD_DM_POLL_INTERVAL_MS = 1000 * 30;

// Loud by design: a silent crash here just looks like "the bot isn't loading" with
// no clue why. Node would print these to stderr by default, but log this explicitly
// so it's unambiguous in aggregated logs which event killed the process.
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception -- bot process will exit', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection -- bot process will exit', reason);
  process.exit(1);
});

logger.info('Bot process starting', { nodeVersion: process.version, pid: process.pid });

logger.info('Starting Authentik directory sync loop', { intervalMs: AUTHENTIK_SYNC_INTERVAL_MS });
syncAuthentikDirectory().catch((error) => logger.error('Authentik directory sync failed', error));
setInterval(() => {
  syncAuthentikDirectory().catch((error) => logger.error('Authentik directory sync failed', error));
}, AUTHENTIK_SYNC_INTERVAL_MS);

logger.info('Starting Discord DM poll loop', { intervalMs: DISCORD_DM_POLL_INTERVAL_MS });
setInterval(() => {
  processPendingDiscordDms().catch((error) => logger.error('Discord DM poll failed', error));
}, DISCORD_DM_POLL_INTERVAL_MS);
