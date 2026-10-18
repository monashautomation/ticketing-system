import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { requireSession, requireWritableSession } from '@/lib/session';
import { markAllNotificationsRead } from '@/server/notifications';

export async function POST() {
  try {
    const session = await requireWritableSession();
    await markAllNotificationsRead(session.user.id);
    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return handleApiError(error);
  }
}
