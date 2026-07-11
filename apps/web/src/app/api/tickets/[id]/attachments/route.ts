import { NextResponse } from 'next/server';
import { requestUploadSchema } from '@ticketing/shared';
import { handleApiError } from '@/lib/api-errors';
import { ForbiddenError } from '@/lib/errors';
import { requireSession } from '@/lib/session';
import { requestAttachmentUpload } from '@/server/attachments';
import { canViewTicket, getTicketOr404 } from '@/server/tickets';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const user = { id: session.user.id, role: session.user.role as 'user' | 'admin' };

    const ticket = await getTicketOr404(id);
    if (!canViewTicket(ticket, user)) throw new ForbiddenError();

    const body = requestUploadSchema.parse(await request.json());
    const { attachment, uploadUrl } = await requestAttachmentUpload(id, user.id, body);

    return NextResponse.json({ success: true, data: { attachment, uploadUrl } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
