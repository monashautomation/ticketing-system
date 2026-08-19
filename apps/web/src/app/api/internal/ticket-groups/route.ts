import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { requireInternalSecret } from '@/lib/internal-auth';
import { listTicketGroups } from '@/server/ticketGroups';

/** Backs the Discord bot's /ticket destination autocomplete -- no user session exists in a
 * Discord interaction, so this uses the shared-secret internal auth instead of requireSession(). */
export async function GET(request: Request) {
  try {
    requireInternalSecret(request);
    const groups = await listTicketGroups();
    return NextResponse.json({
      success: true,
      data: groups.map((g) => ({ id: g.id, name: g.name })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
