import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { requireInternalSecret } from '@/lib/internal-auth';
import { listPendingDiscordChannelMessages } from '@/server/notifications';

export async function POST(request: Request) {
  try {
    requireInternalSecret(request);
    const messages = await listPendingDiscordChannelMessages();
    return NextResponse.json({ success: true, data: messages });
  } catch (error) {
    return handleApiError(error);
  }
}
