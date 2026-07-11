import { NextResponse } from 'next/server';
import { createTicketSchema } from '@ticketing/shared';
import { handleApiError } from '@/lib/api-errors';
import { requireSession } from '@/lib/session';
import { createTicket, listTicketsForUser } from '@/server/tickets';

export async function GET() {
  try {
    const session = await requireSession();
    const tickets = await listTicketsForUser(session.user.id);
    return NextResponse.json({ success: true, data: tickets });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = createTicketSchema.parse(await request.json());
    const ticket = await createTicket(session.user.id, session.user.role as 'user' | 'admin', body);
    return NextResponse.json({ success: true, data: ticket }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
