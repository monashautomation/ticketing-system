import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { requireAdmin } from '@/lib/session';
import { fetchAuthentikGroupNames } from '@/lib/authentikSync';

/** Backs the TicketGroup settings picker with real Authentik group names. */
export async function GET() {
  try {
    await requireAdmin();
    const names = await fetchAuthentikGroupNames();
    return NextResponse.json({ success: true, data: names });
  } catch (error) {
    return handleApiError(error);
  }
}
