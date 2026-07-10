import { NextResponse } from 'next/server';
import { updateTicketSchema } from '@ticketing/shared';
import { handleApiError } from '@/lib/api-errors';
import { requireAdmin, requireSession, ForbiddenError } from '@/lib/session';
import { canViewTicket, getTicketOr404, updateTicket, verifyTicketToken } from '@/server/tickets';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ticket = await getTicketOr404(id);

    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (token) {
      const isValidToken = await verifyTicketToken(id, token);
      if (isValidToken) return NextResponse.json({ success: true, data: ticket });
    }

    const session = await requireSession();
    if (!canViewTicket(ticket, { id: session.user.id, role: session.user.role as 'user' | 'admin' })) {
      throw new ForbiddenError();
    }

    const visibleMessages =
      session.user.role === 'admin'
        ? ticket.messages
        : ticket.messages.filter((m) => !m.isInternalNote);

    return NextResponse.json({ success: true, data: { ...ticket, messages: visibleMessages } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await requireAdmin();
    const body = updateTicketSchema.parse(await request.json());
    const ticket = await updateTicket(id, body, session.user.id);
    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    return handleApiError(error);
  }
}
