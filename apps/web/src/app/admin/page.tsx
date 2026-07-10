import Link from 'next/link';
import { redirect } from 'next/navigation';
import { TICKET_PRIORITIES, TICKET_STATUSES } from '@ticketing/shared';
import { getCurrentSession } from '@/lib/session';
import { isOverdue, listTicketsForAdminQueue } from '@/server/tickets';
import { listTags } from '@/server/tags';
import { prisma } from '@ticketing/db';

interface PageProps {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    assignedToId?: string;
    tagId?: string;
    overdueOnly?: string;
    search?: string;
  }>;
}

export default async function AdminQueuePage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== 'admin') redirect('/');

  const filters = await searchParams;
  const [tickets, tags, admins] = await Promise.all([
    listTicketsForAdminQueue({
      status: filters.status as (typeof TICKET_STATUSES)[number] | undefined,
      priority: filters.priority as (typeof TICKET_PRIORITIES)[number] | undefined,
      assignedToId: filters.assignedToId || undefined,
      tagId: filters.tagId || undefined,
      overdueOnly: filters.overdueOnly === 'true',
      search: filters.search || undefined,
    }),
    listTags(),
    prisma.user.findMany({ where: { role: 'admin' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin Ticket Queue</h1>
        <nav className="flex gap-4 text-sm text-neutral-500">
          <Link href="/" className="hover:underline">
            My view
          </Link>
          <Link href="/admin/metrics" className="hover:underline">
            Metrics
          </Link>
          <Link href="/admin/tags" className="hover:underline">
            Tags
          </Link>
        </nav>
      </div>

      <form className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 p-3 text-sm">
        <input
          type="text"
          name="search"
          defaultValue={filters.search}
          placeholder="Search title…"
          className="rounded-md border border-neutral-300 px-2 py-1"
        />
        <select name="status" defaultValue={filters.status ?? ''} className="rounded-md border border-neutral-300 px-2 py-1">
          <option value="">Any status</option>
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="priority" defaultValue={filters.priority ?? ''} className="rounded-md border border-neutral-300 px-2 py-1">
          <option value="">Any priority</option>
          {TICKET_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select name="assignedToId" defaultValue={filters.assignedToId ?? ''} className="rounded-md border border-neutral-300 px-2 py-1">
          <option value="">Any assignee</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select name="tagId" defaultValue={filters.tagId ?? ''} className="rounded-md border border-neutral-300 px-2 py-1">
          <option value="">Any tag</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="overdueOnly" value="true" defaultChecked={filters.overdueOnly === 'true'} />
          Overdue only
        </label>
        <button type="submit" className="ml-auto rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-white">
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Submitted by</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Priority</th>
              <th className="px-4 py-2">Assignee</th>
              <th className="px-4 py-2">Tags</th>
              <th className="px-4 py-2">SLA due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {tickets.map((ticket) => {
              const overdue = isOverdue(ticket);
              return (
                <tr key={ticket.id} className={overdue ? 'bg-red-50' : undefined}>
                  <td className="px-4 py-2">
                    <Link href={`/t/${ticket.id}`} className="font-medium hover:underline">
                      {ticket.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{ticket.createdBy.name}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium uppercase">
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{ticket.priority}</td>
                  <td className="px-4 py-2 text-neutral-600">{ticket.assignedTo?.name ?? '—'}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {ticket.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={`px-4 py-2 ${overdue ? 'font-semibold text-red-700' : 'text-neutral-600'}`}>
                    {ticket.slaDueAt ? new Date(ticket.slaDueAt).toLocaleString() : '—'}
                    {overdue ? ' (overdue)' : ''}
                  </td>
                </tr>
              );
            })}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-neutral-500">
                  No tickets match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
