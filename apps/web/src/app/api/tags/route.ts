import { NextResponse } from 'next/server';
import { createTagSchema } from '@ticketing/shared';
import { handleApiError } from '@/lib/api-errors';
import { requireAdmin, requireSession } from '@/lib/session';
import { createTag, listTags } from '@/server/tags';

export async function GET() {
  try {
    await requireSession();
    const tags = await listTags();
    return NextResponse.json({ success: true, data: tags });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = createTagSchema.parse(await request.json());
    const tag = await createTag(body, session.user.id);
    return NextResponse.json({ success: true, data: tag }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
