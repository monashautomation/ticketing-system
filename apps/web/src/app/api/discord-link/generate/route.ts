import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { requireSession } from '@/lib/session';
import { createLinkCode } from '@/server/discord-link';

export async function POST() {
  try {
    const session = await requireSession();
    const linkCode = await createLinkCode(session.user.id);
    return NextResponse.json({
      success: true,
      data: { code: linkCode.code, expiresAt: linkCode.expiresAt },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
