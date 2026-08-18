import { NextResponse } from 'next/server';
import { prisma } from '@ticketing/db';
import { handleApiError } from '@/lib/api-errors';
import { requireSession } from '@/lib/session';

const MAX_RESULTS = 8;

/**
 * Assignee-picker roster: all admins (role === 'admin', synced from Authentik group
 * membership against ADMIN_GROUPS -- see authentikSync.ts) plus, when `?groupId=` is given,
 * members of that TicketGroup -- matches the valid-assignee set enforced in tickets.ts's
 * createTicket/updateTicket. With ?q=<name substring>, filters to matching users, capped at
 * MAX_RESULTS.
 */
export async function GET(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim() ?? '';
    const groupId = url.searchParams.get('groupId')?.trim() || undefined;

    const admins = await prisma.user.findMany({
      where: {
        role: 'admin',
        ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      ...(q ? { take: MAX_RESULTS } : {}),
    });

    let assignable = admins;
    if (groupId) {
      const groupMembers = await prisma.user.findMany({
        where: {
          ticketGroups: { some: { id: groupId } },
          ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        ...(q ? { take: MAX_RESULTS } : {}),
      });
      const byId = new Map(admins.map((u) => [u.id, u]));
      for (const member of groupMembers) byId.set(member.id, member);
      assignable = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    }

    return NextResponse.json({ success: true, data: assignable });
  } catch (error) {
    return handleApiError(error);
  }
}
