import { env } from './env';
import { logger } from './logger';
import { sendDiscordChannelMessage } from './discord-dm-api';

interface PendingDiscordChannelMessage {
  id: string;
  channelId: string;
  message: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function internalFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${env.internalApiUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': env.internalApiSecret,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `Request to ${path} failed with status ${res.status}`);
  }
  return json.data as T;
}

function listPendingDiscordChannelMessages() {
  return internalFetch<PendingDiscordChannelMessage[]>('/api/internal/discord-channel-messages/pending', {});
}

function markDiscordChannelMessagesSent(ids: string[]) {
  return internalFetch<null>('/api/internal/discord-channel-messages/mark-sent', { ids });
}

/**
 * Polls the web app for queued outbound channel messages (new-ticket announcements,
 * unassigned-backlog alerts) and posts them via the external Discord bot HTTP API. Same
 * best-effort, never-retry-forever tradeoff as processPendingDiscordDms.
 */
export async function processPendingDiscordChannelMessages(): Promise<void> {
  const pending = await listPendingDiscordChannelMessages();
  if (pending.length === 0) return;

  const sentIds: string[] = [];
  for (const msg of pending) {
    try {
      await sendDiscordChannelMessage(msg.channelId, msg.message);
    } catch (error) {
      logger.error(`Failed to send Discord channel message ${msg.id} to channel ${msg.channelId}`, error);
    } finally {
      sentIds.push(msg.id);
    }
  }

  await markDiscordChannelMessagesSent(sentIds);
}
