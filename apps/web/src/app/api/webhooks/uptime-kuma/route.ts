import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { uptimeKumaWebhookSchema } from '@ticketing/shared';
import { handleApiError } from '@/lib/api-errors';
import { UnauthorizedError } from '@/lib/errors';
import { env } from '@/lib/env';
import { handleUptimeKumaWebhook } from '@/server/maintenance';

// Uptime Kuma's built-in Webhook notification provider only lets you set a
// target URL (no custom headers in most versions), so the shared secret is
// passed as a query param on that configured URL instead of a header.
function requireWebhookSecret(request: Request): void {
  const url = new URL(request.url);
  const provided = url.searchParams.get('secret') ?? '';
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
