import { NextResponse } from 'next/server';
import { prisma } from '@ticketing/db';
import { handleApiError } from '@/lib/api-errors';
import { requireSession } from '@/lib/session';

const MAX_RESULTS = 8;

/**
 * Admin roster for the assignee picker (role === 'admin', which is synced from
 * Authentik group membership against ADMIN_GROUPS -- see authentikSync.ts).
 * With ?q=<name substring>, filters to matching admins, capped at MAX_RESULTS.
 */
export async function GET(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim() ?? '';

    const admins = await prisma.user.findMany({
      where: {
        role: 'admin',
        ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      ...(q ? { take: MAX_RESULTS } : {}),
    });
    return NextResponse.json({ success: true, data: admins });
  } catch (error) {
    return handleApiError(error);
  }
}
