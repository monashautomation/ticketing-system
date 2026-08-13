import { env } from './env';
import { logger } from './logger';

/**
 * Sends a DM via the external Discord bot HTTP API instead of the local
 * discord.js gateway connection. Replaces `client.users.fetch` + `user.send`.
 */
export async function sendDiscordDm(userId: string, content: string): Promise<void> {
  const res = await fetch(`${env.discordDmApiUrl}/api/v1/dm/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.discordDmApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId, content }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Discord DM API request failed with status ${res.status}: ${body}`);
  }
}

/**
 * Posts a message to a Discord channel via the same external Discord bot HTTP API/key as
 * sendDiscordDm -- both endpoints are admin-scope on the one bearer token.
 */
export async function sendDiscordChannelMessage(channelId: string, content: string): Promise<void> {
  const res = await fetch(`${env.discordDmApiUrl}/api/v1/messages/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.discordDmApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel_id: channelId, content }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Discord channel message API request failed with status ${res.status}: ${body}`);
  }
}
