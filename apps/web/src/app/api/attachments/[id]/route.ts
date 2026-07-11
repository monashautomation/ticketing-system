import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { ForbiddenError } from '@/lib/errors';
import { requireSession } from '@/lib/session';
import { deleteAttachment, getAttachmentDownloadUrl } from '@/server/attachments';
import { canViewTicket, getTicketOr404 } from '@/server/tickets';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const user = { id: session.user.id, role: session.user.role as 'user' | 'admin' };

    const { attachment, url } = await getAttachmentDownloadUrl(id);
    const ticket = await getTicketOr404(attachment.ticketId);
    if (!canViewTicket(ticket, user)) throw new ForbiddenError();

    return NextResponse.redirect(url);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const user = { id: session.user.id, role: session.user.role as 'user' | 'admin' };
    await deleteAttachment(id, user);
    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return handleApiError(error);
  }
}
