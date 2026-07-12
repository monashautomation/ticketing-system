import { logger } from './logger';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    logger.error(`Missing required env var: ${name} -- bot cannot start`, { name });
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  discordToken: required('DISCORD_TOKEN'),
  discordClientId: required('DISCORD_CLIENT_ID'),
  discordDevGuildId: process.env.DISCORD_DEV_GUILD_ID || undefined,
  internalApiUrl: required('INTERNAL_API_URL'),
  internalApiSecret: required('INTERNAL_API_SECRET'),
  debugLogging: process.env.LOG_LEVEL === 'debug',
};

logger.info('Environment loaded', {
  discordClientId: env.discordClientId,
  discordDevGuildId: env.discordDevGuildId ?? '(none -- registering commands globally)',
  internalApiUrl: env.internalApiUrl,
  discordTokenLength: env.discordToken.length,
});
