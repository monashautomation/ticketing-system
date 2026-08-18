import { NextResponse } from 'next/server';
import { ticketGroupSchema } from '@ticketing/shared';
import { handleApiError } from '@/lib/api-errors';
import { requireAdmin } from '@/lib/session';
import { deleteTicketGroup, updateTicketGroup } from '@/server/ticketGroups';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = ticketGroupSchema.parse(await request.json());
    const group = await updateTicketGroup(id, body, session.user.id);
    return NextResponse.json({ success: true, data: group });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await deleteTicketGroup(id, session.user.id);
    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return handleApiError(error);
  }
}
