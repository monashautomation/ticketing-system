import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { uptimeKumaWebhookSchema } from '@ticketing/shared';
import { handleApiError } from '@/lib/api-errors';
import { UnauthorizedError } from '@/lib/errors';
import { env } from '@/lib/env';
import { handleUptimeKumaWebhook } from '@/server/maintenance';

function requireWebhookSecret(request: Request): void {
  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  const expected = env.uptimeKumaWebhookSecret;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const isValid = a.length === b.length && timingSafeEqual(a, b);
  if (!isValid) throw new UnauthorizedError();
}

export async function POST(request: Request) {
  try {
    requireWebhookSecret(request);
    const payload = uptimeKumaWebhookSchema.parse(await request.json());
    const event = await handleUptimeKumaWebhook(payload);
    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    return handleApiError(error);
  }
}
