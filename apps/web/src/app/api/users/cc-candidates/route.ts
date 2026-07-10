import { NextResponse } from 'next/server';
import { prisma } from '@ticketing/db';
import { handleApiError } from '@/lib/api-errors';
import { requireSession } from '@/lib/session';

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 5;

/**
 * Session-gated user list for the ticket-creation CC picker.
 * Without ?q=, returns {id, name} for everyone. With ?q=<name substring>,
 * returns up to MAX_RESULTS name matches -- avoids dumping the whole directory.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim() ?? '';

    if (q.length >= MIN_QUERY_LENGTH) {
      const matches = await prisma.user.findMany({
        where: {
          id: { not: session.user.id },
          name: { contains: q, mode: 'insensitive' },
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: MAX_RESULTS,
      });
      return NextResponse.json({ success: true, data: matches });
    }

    const users = await prisma.user.findMany({
      where: { id: { not: session.user.id } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    return handleApiError(error);
  }
}
