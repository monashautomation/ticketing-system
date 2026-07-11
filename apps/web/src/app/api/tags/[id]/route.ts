import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { requireAdmin } from '@/lib/session';
import { deleteTag } from '@/server/tags';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;
    await deleteTag(id);
    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return handleApiError(error);
  }
}
