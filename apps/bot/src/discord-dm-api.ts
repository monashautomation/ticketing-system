import http from 'node:http';
import https from 'node:https';
import { env } from './env';

/**
 * Posts JSON via Node's core http/https client instead of the global `fetch`
 * (undici). undici's connect hangs indefinitely against discordbot-api's
 * ClusterIP from this pod even though DNS resolution and a raw `net.connect`
 * both succeed instantly -- a reproducible undici-specific quirk on this
 * cluster. Core http does not share undici's connection path.
 */
function postJson(url: string, body: unknown, headers: Record<string, string>): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const transport = target.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(body);

    const req = transport.request(
      target,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          text += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, text }));
      },
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// discordbot-api's Django settings force SECURE_SSL_REDIRECT based on
// X-Forwarded-Proto; calling it over plain internal HTTP without that header
// gets a 301 to a https URL the ClusterIP doesn't serve.

/**
 * Sends a DM via the external Discord bot HTTP API instead of the local
 * discord.js gateway connection. Replaces `client.users.fetch` + `user.send`.
 */
export async function sendDiscordDm(userId: string, content: string): Promise<void> {
  const { status, text } = await postJson(
    `${env.discordDmApiUrl}/api/v1/dm/`,
    { user_id: userId, content },
    { Authorization: `Bearer ${env.discordDmApiKey}`, 'X-Forwarded-Proto': 'https' },
  );

  if (status < 200 || status >= 300) {
    throw new Error(`Discord DM API request failed with status ${status}: ${text}`);
  }
}

/**
 * Posts a message to a Discord channel via the same external Discord bot HTTP API/key as
 * sendDiscordDm -- both endpoints are admin-scope on the one bearer token.
 */
export async function sendDiscordChannelMessage(channelId: string, content: string): Promise<void> {
  const { status, text } = await postJson(
    `${env.discordDmApiUrl}/api/v1/messages/`,
    { channel_id: channelId, content },
    { Authorization: `Bearer ${env.discordDmApiKey}`, 'X-Forwarded-Proto': 'https' },
  );

  if (status < 200 || status >= 300) {
    throw new Error(`Discord channel message API request failed with status ${status}: ${text}`);
  }
}
