import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  parseSearchQuery,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from '@ticketing/shared';
import { getCurrentSession } from '@/lib/session';
import { AppHeader } from '@/components/AppHeader';
import {
  groupTicketsByStatus,
  isOverdue,
  listTicketsForAdminQueue,
  resolveSearchTokensToFilters,
  type TicketQueueFilters,
} from '@/server/tickets';
import { listTags } from '@/server/tags';
import { prisma } from '@ticketing/db';
import { TicketSearchInput } from '@/components/TicketSearchInput';
import {
  badgeDanger,
  buttonPrimary,
  mutedText,
  pageHeader,
  pageTitle,
  pageWide,
  select,
  table,
  tableCell,
  tableHead,
  tableHeadCell,
  tableRowDivider,
  tableWrap,
} from '@/lib/styles';
import { STATUS_CONFIG, StatusPill } from '@/lib/ticketStatus';
import { PRIORITY_CONFIG, PriorityPill } from '@/lib/ticketPriority';

interface PageProps {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    assigneeId?: string;
    tagId?: string;
    overdueOnly?: string;
    q?: string;
  }>;
}

/** Merges a dropdown-selected single id with token-resolved ids into one array filter. */
function mergeIds(single: string | undefined, tokenIds: string[] | undefined): string[] | undefined {
  const ids = [...(single ? [single] : []), ...(tokenIds ?? [])];
  return ids.length > 0 ? ids : undefined;
}


function TicketTable({
  tickets,
}: {
  tickets: Awaited<ReturnType<typeof listTicketsForAdminQueue>>;
}) {
  return (
    <div className={tableWrap}>
      <table className={table}>
        <thead className={tableHead}>
          <tr>
            <th className={tableHeadCell}>Title</th>
            <th className={tableHeadCell}>Submitted by</th>
            <th className={tableHeadCell}>Status</th>
            <th className={tableHeadCell}>Priority</th>
            <th className={tableHeadCell}>Assignees</th>
            <th className={tableHeadCell}>Tags</th>
            <th className={tableHeadCell}>SLA due</th>
          </tr>
        </thead>
        <tbody className={tableRowDivider}>
          {tickets.map((ticket) => {
            const overdue = isOverdue(ticket);
            return (
              <tr key={ticket.id} className={overdue ? 'bg-danger-soft' : undefined}>
                <td className={tableCell}>
                  <Link href={`/t/${ticket.id}`} className="font-medium text-text hover:text-accent">
                    {ticket.title}
                  </Link>
                </td>
                <td className={`${tableCell} text-text-secondary`}>{ticket.createdBy.name}</td>
                <td className={tableCell}>
                  <StatusPill status={ticket.status} />
                </td>
                <td className={tableCell}>
                  <PriorityPill priority={ticket.priority} />
                </td>
                <td className={`${tableCell} text-text-secondary`}>
                  {ticket.assignees.length > 0 ? ticket.assignees.map((a) => a.name).join(', ') : '—'}
                </td>
                <td className={tableCell}>
                  <div className="flex flex-wrap gap-1">
                    {ticket.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className={tableCell}>
                  {overdue ? (
                    <span className={badgeDanger}>overdue</span>
                  ) : (
                    <span className="text-text-secondary">
                      {ticket.slaDueAt ? new Date(ticket.slaDueAt).toLocaleString() : '—'}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
          {tickets.length === 0 && (
            <tr>
              <td colSpan={7} className={`px-4 py-6 text-center ${mutedText}`}>
                No tickets match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminQueuePage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== 'admin') redirect('/');

  const filters = await searchParams;
  const { tokens, freeText } = parseSearchQuery(filters.q ?? '');
  const [tokenFilters, tags, admins] = await Promise.all([
    resolveSearchTokensToFilters(tokens),
    listTags(),
    prisma.user.findMany({ where: { role: 'admin' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  const queueFilters: TicketQueueFilters = {
    status: tokenFilters.status ?? (filters.status as TicketStatus | undefined),
    priority: tokenFilters.priority ?? (filters.priority as TicketPriority | undefined),
    type: tokenFilters.type,
    assigneeId: mergeIds(filters.assigneeId, tokenFilters.assigneeId as string[] | undefined),
    tagId: mergeIds(filters.tagId, tokenFilters.tagId as string[] | undefined),
    createdById: tokenFilters.createdById,
    watcherId: tokenFilters.watcherId,
    overdueOnly: filters.overdueOnly === 'true',
    search: freeText || undefined,
  };

  const tickets = await listTicketsForAdminQueue(queueFilters);

  const { active, closedOrResolved } = groupTicketsByStatus(tickets);

  return (
    <>
      <AppHeader />
      <main className={pageWide}>
        <div className={pageHeader}>
          <h1 className={pageTitle}>Admin Ticket Queue</h1>
        </div>

        <form className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-panel p-3 text-sm">
          <TicketSearchInput defaultValue={filters.q ?? ''} tags={tags} admins={admins} />
          <select name="status" defaultValue={filters.status ?? ''} className={select}>
            <option value="">Any status</option>
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_CONFIG[s].label}
              </option>
            ))}
          </select>
          <select name="priority" defaultValue={filters.priority ?? ''} className={select}>
            <option value="">Any priority</option>
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_CONFIG[p].label}
              </option>
            ))}
          </select>
          <select name="assigneeId" defaultValue={filters.assigneeId ?? ''} className={select}>
            <option value="">Any assignee</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select name="tagId" defaultValue={filters.tagId ?? ''} className={select}>
            <option value="">Any tag</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-text-secondary">
            <input type="checkbox" name="overdueOnly" value="true" defaultChecked={filters.overdueOnly === 'true'} />
            Overdue only
          </label>
          <button type="submit" className={`${buttonPrimary} ml-auto`}>
            Filter
          </button>
        </form>

        <div className="flex flex-col gap-8">
          {(['open', 'escalated', 'pending', 'in_progress'] as const).map((status) => (
            <section key={status}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-secondary">
                {STATUS_CONFIG[status].label} ({active[status].length})
              </h2>
              <TicketTable tickets={active[status]} />
            </section>
          ))}

          <details className="group">
            <summary className="mb-2 cursor-pointer list-none text-sm font-semibold uppercase tracking-wide text-text-secondary">
              <span className="inline-block transition-transform group-open:rotate-90">▸</span>{' '}
              Resolved &amp; Closed ({closedOrResolved.length})
            </summary>
            <TicketTable tickets={closedOrResolved} />
          </details>
        </div>
      </main>
    </>
  );
}
