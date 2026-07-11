import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { requireSession } from '@/lib/session';
import { markAllNotificationsRead } from '@/server/notifications';

export async function POST() {
  try {
    const session = await requireSession();
    await markAllNotificationsRead(session.user.id);
    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return handleApiError(error);
  }
}
