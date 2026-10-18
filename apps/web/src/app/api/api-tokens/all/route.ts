import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { requireAdmin } from '@/lib/session';
import { listAllApiTokens } from '@/server/apiTokens';

/** Admin: list every API token across users (no secrets/hashes). */
export async function GET() {
  try {
    await requireAdmin();
    const tokens = await listAllApiTokens();
    return NextResponse.json({ success: true, data: tokens });
  } catch (error) {
    return handleApiError(error);
  }
}
