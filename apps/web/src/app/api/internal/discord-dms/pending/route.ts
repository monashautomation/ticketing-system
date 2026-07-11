import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { requireInternalSecret } from '@/lib/internal-auth';
import { listPendingDiscordDms } from '@/server/notifications';

export async function POST(request: Request) {
  try {
    requireInternalSecret(request);
    const dms = await listPendingDiscordDms();
    return NextResponse.json({ success: true, data: dms });
  } catch (error) {
    return handleApiError(error);
  }
}
