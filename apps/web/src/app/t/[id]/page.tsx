import { notFound } from 'next/navigation';
import { prisma } from '@ticketing/db';
import { getCurrentSession } from '@/lib/session';
import { canViewTicket, getTicketOr404, isOverdue, verifyTicketToken } from '@/server/tickets';
import { listTags } from '@/server/tags';
import { TicketThread } from '@/components/TicketThread';
import { AdminTicketControls } from '@/components/AdminTicketControls';
import { TicketAttachments } from '@/components/TicketAttachments';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function TicketPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { token } = await searchParams;

  const ticket = await getTicketOr404(id).catch(() => null);
  if (!ticket) notFound();

  const session = await getCurrentSession();
  const user = session
    ? { id: session.user.id, role: session.user.role as 'user' | 'admin' }
    : null;

  const hasTokenAccess = token ? await verifyTicketToken(id, token) : false;
  if (!hasTokenAccess && !canViewTicket(ticket, user)) notFound();

  const isAdmin = user?.role === 'admin';
  const visibleMessages = isAdmin ? ticket.messages : ticket.messages.filter((m) => !m.isInternalNote);
  const overdue = isOverdue(ticket);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{ticket.title}</h1>
          <p className="mt-1 text-sm text-neutral-500">{ticket.description}</p>
        </div>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium uppercase tracking-wide">
          {ticket.status}
        </span>
      </div>

      <p className="mb-2 text-sm text-neutral-500">
        Opened by {ticket.createdBy.name}
        {ticket.assignedTo ? ` · assigned to ${ticket.assignedTo.name}` : ' · unassigned'}
      </p>

      {ticket.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
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
      )}

      {ticket.slaDueAt && (
        <p className={`mb-6 text-sm ${overdue ? 'font-semibold text-red-700' : 'text-neutral-500'}`}>
          SLA due {new Date(ticket.slaDueAt).toLocaleString()}
          {overdue ? ' — overdue' : ''}
        </p>
      )}

      {isAdmin && (
        <AdminTicketControls
          ticketId={ticket.id}
          currentStatus={ticket.status}
          currentPriority={ticket.priority}
          currentAssigneeId={ticket.assignedToId}
          currentSlaDueAt={ticket.slaDueAt ? ticket.slaDueAt.toISOString() : null}
          currentTagIds={ticket.tags.map((t) => t.id)}
          admins={await prisma.user.findMany({
            where: { role: 'admin' },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          })}
          tags={await listTags()}
        />
      )}

      {user && (
        <TicketAttachments
          ticketId={ticket.id}
          attachments={ticket.attachments}
          currentUserId={user.id}
          isAdmin={isAdmin}
        />
      )}

      <TicketThread
        ticketId={ticket.id}
        token={token}
        initialMessages={visibleMessages}
        canAddInternalNote={isAdmin}
      />
    </main>
  );
}
