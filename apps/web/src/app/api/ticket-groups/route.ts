import { NextResponse } from 'next/server';
import { ticketGroupSchema } from '@ticketing/shared';
import { handleApiError } from '@/lib/api-errors';
import { requireAdmin, requireSession } from '@/lib/session';
import { createTicketGroup, listTicketGroups } from '@/server/ticketGroups';

/** Any signed-in user can list groups -- needed for the ticket-create picker. */
export async function GET() {
  try {
    await requireSession();
    const groups = await listTicketGroups();
    return NextResponse.json({ success: true, data: groups });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = ticketGroupSchema.parse(await request.json());
    const group = await createTicketGroup(body, session.user.id);
    return NextResponse.json({ success: true, data: group }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
