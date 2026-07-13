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
  internalApiUrl: required('INTERNAL_API_URL'),
  internalApiSecret: required('INTERNAL_API_SECRET'),
  discordDmApiUrl: process.env.DISCORD_DM_API_URL || 'https://discordbot.monashautomation.com',
  discordDmApiKey: required('DISCORD_DM_API_KEY'),
};

logger.info('Environment loaded', {
  internalApiUrl: env.internalApiUrl,
  discordDmApiUrl: env.discordDmApiUrl,
});
