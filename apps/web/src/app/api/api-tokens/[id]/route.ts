import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { requireSession } from '@/lib/session';
import { revokeApiToken } from '@/server/apiTokens';

/** Revoke a token. Owners may revoke their own; admins may revoke any. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const token = await revokeApiToken(id, session.user.id, session.user.role === 'admin');
    return NextResponse.json({ success: true, data: token });
  } catch (error) {
    return handleApiError(error);
  }
}
