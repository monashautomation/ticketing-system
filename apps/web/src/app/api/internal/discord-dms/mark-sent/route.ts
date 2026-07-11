import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/api-errors';
import { requireInternalSecret } from '@/lib/internal-auth';
import { markDiscordDmsSent } from '@/server/notifications';

const markSentSchema = z.object({ ids: z.array(z.string().min(1)) });

export async function POST(request: Request) {
  try {
    requireInternalSecret(request);
    const { ids } = markSentSchema.parse(await request.json());
    await markDiscordDmsSent(ids);
    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return handleApiError(error);
  }
}
