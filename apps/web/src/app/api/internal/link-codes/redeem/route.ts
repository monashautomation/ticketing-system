import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/api-errors';
import { requireInternalSecret } from '@/lib/internal-auth';
import { redeemLinkCode } from '@/server/discord-link';

const redeemSchema = z.object({
  code: z.string().length(8),
  discordUserId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    requireInternalSecret(request);
    const { code, discordUserId } = redeemSchema.parse(await request.json());
    const user = await redeemLinkCode(code.toUpperCase(), discordUserId);
    return NextResponse.json({ success: true, data: { userId: user.id, name: user.name } });
  } catch (error) {
    return handleApiError(error);
  }
}
