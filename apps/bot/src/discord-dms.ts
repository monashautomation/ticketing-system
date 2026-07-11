import { Client } from 'discord.js';
import { env } from './env';

interface PendingDiscordDm {
  id: string;
  discordUserId: string;
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

function listPendingDiscordDms() {
  return internalFetch<PendingDiscordDm[]>('/api/internal/discord-dms/pending', {});
}

function markDiscordDmsSent(ids: string[]) {
  return internalFetch<null>('/api/internal/discord-dms/mark-sent', { ids });
}

/**
 * Polls the web app for queued outbound DMs and sends them. Marks every attempted DM as sent
 * regardless of delivery outcome (e.g. the recipient has DMs closed) -- same "best effort, never
 * retry forever" tradeoff as the ephemeral-reply DM in commands/ticket.ts.
 */
export async function processPendingDiscordDms(client: Client): Promise<void> {
  const pending = await listPendingDiscordDms();
  if (pending.length === 0) return;

  const sentIds: string[] = [];
  for (const dm of pending) {
    try {
      const user = await client.users.fetch(dm.discordUserId);
      await user.send(dm.message);
    } catch (error) {
      console.error(`Failed to send Discord DM ${dm.id} to ${dm.discordUserId}`, error);
    } finally {
      sentIds.push(dm.id);
    }
  }

  await markDiscordDmsSent(sentIds);
}
