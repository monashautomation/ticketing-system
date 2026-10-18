import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { requireSession } from '@/lib/session';

/** The caller's own identity — used by `maticket whoami`. */
export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json({
      success: true,
      data: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        viaApiToken: session.viaApiToken,
        tokenReadOnly: session.tokenReadOnly,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
