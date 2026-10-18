import { NextResponse } from 'next/server';
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
  type TicketPriority,
  type TicketStatus,
  type TicketType,
} from '@ticketing/shared';
import { handleApiError } from '@/lib/api-errors';
import { requireSession } from '@/lib/session';
import { ForbiddenError } from '@/lib/errors';
import { listTicketsForAdminQueue, type TicketQueueFilters } from '@/server/tickets';

function enumParam<T extends string>(
  url: URL,
  name: string,
  allowed: readonly T[],
): T | undefined {
  const raw = url.searchParams.get(name);
  if (!raw) return undefined;
  if ((allowed as readonly string[]).includes(raw)) return raw as T;
  return undefined;
}

/**
 * Admin queue listing with query-param filters — the REST mirror of the
 * /admin page's server-side filtering, used by the maticket CLI:
 *   ?status=open&priority=high&assigneeId=…&tagId=…&overdueOnly=true&search=…
 * Non-admins get 403; the CLI falls back to /api/tickets (my tickets).
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (session.user.role !== 'admin') throw new ForbiddenError();

    const url = new URL(request.url);
    const multi = (name: string) => {
      const vals = url.searchParams.getAll(name).filter(Boolean);
      return vals.length > 0 ? vals : undefined;
    };

    const filters: TicketQueueFilters = {
      status: enumParam(url, 'status', TICKET_STATUSES),
      priority: enumParam(url, 'priority', TICKET_PRIORITIES),
      type: enumParam(url, 'type', TICKET_TYPES),
      assigneeId: multi('assigneeId'),
      tagId: multi('tagId'),
      createdById: multi('createdById'),
      watcherId: multi('watcherId'),
      overdueOnly: url.searchParams.get('overdueOnly') === 'true',
      search: url.searchParams.get('search') ?? undefined,
    };

    const tickets = await listTicketsForAdminQueue(filters);
    return NextResponse.json({ success: true, data: tickets });
  } catch (error) {
    return handleApiError(error);
  }
}
