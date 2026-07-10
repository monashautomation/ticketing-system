function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  discordToken: required('DISCORD_TOKEN'),
  discordClientId: required('DISCORD_CLIENT_ID'),
  discordDevGuildId: process.env.DISCORD_DEV_GUILD_ID || undefined,
  internalApiUrl: required('INTERNAL_API_URL'),
  internalApiSecret: required('INTERNAL_API_SECRET'),
};
