import { NextResponse } from 'next/server';
import { createApiTokenSchema } from '@ticketing/shared';
import { handleApiError } from '@/lib/api-errors';
import { requireSession, requireWritableSession } from '@/lib/session';
import { createApiToken, listMyApiTokens } from '@/server/apiTokens';

/** List the caller's own API tokens (never the secret or hash). */
export async function GET() {
  try {
    const session = await requireSession();
    const tokens = await listMyApiTokens(session.user.id);
    return NextResponse.json({ success: true, data: tokens });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Create an API token. The plaintext `token` is returned exactly once in the
 * response — it is not recoverable afterwards. Admins may mint for another
 * user via ownerId; tokens created through an existing API token are always
 * read-only, and non-admins always get read-only tokens.
 */
export async function POST(request: Request) {
  try {
    const session = await requireWritableSession();
    const body = createApiTokenSchema.parse(await request.json());

    let ownerId = session.user.id;
    if (body.ownerId && body.ownerId !== session.user.id) {
      if (session.user.role !== 'admin') {
        return NextResponse.json(
          { success: false, error: { message: 'Only admins can create tokens for other users' } },
          { status: 403 },
        );
      }
      ownerId = body.ownerId;
    }

    const token = await createApiToken(
      ownerId,
      session.user.id,
      { name: body.name, readOnly: body.readOnly, expiresInDays: body.expiresInDays },
      session.viaApiToken,
    );

    return NextResponse.json({ success: true, data: token }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
