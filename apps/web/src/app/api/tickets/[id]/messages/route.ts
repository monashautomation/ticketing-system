import { NextResponse } from 'next/server';
import { createMessageSchema } from '@ticketing/shared';
import { handleApiError } from '@/lib/api-errors';
import { requireSession } from '@/lib/session';
import { ForbiddenError } from '@/lib/errors';
import { addMessage, canViewTicket, getTicketOr404, verifyTicketToken } from '@/server/tickets';
import { publishTicketMessage } from '@/server/ticket-events';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ticket = await getTicketOr404(id);
    const body = createMessageSchema.parse(await request.json());

    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    let authorId: string;
    if (token && (await verifyTicketToken(id, token))) {
      // Token-based reply: attribute to the ticket creator (pre-account-link Discord users).
      authorId = ticket.createdById;
      if (body.isInternalNote) throw new ForbiddenError();
    } else {
      const session = await requireSession();
      const user = { id: session.user.id, role: session.user.role as 'user' | 'admin' };
      if (!canViewTicket(ticket, user)) throw new ForbiddenError();
      if (body.isInternalNote && user.role !== 'admin') throw new ForbiddenError();
      authorId = user.id;
    }

    const message = await addMessage(id, authorId, body);
    publishTicketMessage({ ticketId: id, messageId: message.id });

    return NextResponse.json({ success: true, data: message }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
