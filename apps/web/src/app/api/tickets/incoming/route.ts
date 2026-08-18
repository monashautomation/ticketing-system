import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { requireSession } from '@/lib/session';
import { listTicketsForGroupQueue } from '@/server/tickets';

/** "Incoming" tab: tickets routed to any group the caller belongs to. */
export async function GET() {
  try {
    const session = await requireSession();
    const tickets = await listTicketsForGroupQueue(session.user.id);
    return NextResponse.json({ success: true, data: tickets });
  } catch (error) {
    return handleApiError(error);
  }
}
