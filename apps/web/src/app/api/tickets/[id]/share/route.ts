import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { requireSession } from '@/lib/session';
import { ForbiddenError } from '@/lib/errors';
import { canShareTicket, createTicketShareLink, getTicketOr404 } from '@/server/tickets';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const user = { id: session.user.id, role: session.user.role as 'user' | 'admin' };

    const ticket = await getTicketOr404(id);
    if (!canShareTicket(ticket, user)) throw new ForbiddenError();

    const { path } = await createTicketShareLink(id, user.id);
    return NextResponse.json({ success: true, data: { path } });
  } catch (error) {
    return handleApiError(error);
  }
}
