import type { CreateInternalTicketInput } from '@ticketing/shared';
import { env } from './env';

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

export function createTicket(input: CreateInternalTicketInput) {
  return internalFetch<{ ticketId: string; isNewUser: boolean; url: string }>(
    '/api/internal/tickets',
    input,
  );
}

export function syncAuthentikDirectory() {
  return internalFetch<{ upserted: number }>('/api/internal/sync-authentik', {});
}
