import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { requireSession } from '@/lib/session';
import { countUnreadNotifications, listNotificationsForUser } from '@/server/notifications';

export async function GET() {
  try {
    const session = await requireSession();
    const [notifications, unreadCount] = await Promise.all([
      listNotificationsForUser(session.user.id),
      countUnreadNotifications(session.user.id),
    ]);
    return NextResponse.json({ success: true, data: { notifications, unreadCount } });
  } catch (error) {
    return handleApiError(error);
  }
}
