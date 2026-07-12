import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentSession } from '@/lib/session';
import { canViewTicket, getTicketOr404, isOverdue, verifyTicketToken } from '@/server/tickets';
import { markTicketNotificationsRead } from '@/server/notifications';
import { listTags } from '@/server/tags';
import { AppHeader } from '@/components/AppHeader';
import { TicketThread } from '@/components/TicketThread';
import { AdminTicketControls } from '@/components/AdminTicketControls';
import { TicketAttachments } from '@/components/TicketAttachments';
import { TicketTitleEditor } from '@/components/TicketTitleEditor';
import { CcEditor } from '@/components/CcEditor';
import { backLink, badgeDanger, mutedText, page } from '@/lib/styles';
import { StatusPill } from '@/lib/ticketStatus';
import { PriorityPill } from '@/lib/ticketPriority';
import { TypePill } from '@/lib/ticketType';

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

  if (user) await markTicketNotificationsRead(id, user.id);

  const isAdmin = user?.role === 'admin';
  const isOwner = user?.id === ticket.createdById;
  const visibleMessages = isAdmin ? ticket.messages : ticket.messages.filter((m) => !m.isInternalNote);
  const overdue = isOverdue(ticket);

  return (
    <>
      <AppHeader />
      <main className={page}>
      <Link href="/" className={`${backLink} mb-6`}>
        ← Back to tickets
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        {isAdmin ? (
          <TicketTitleEditor
            ticketId={ticket.id}
            initialTitle={ticket.title}
            initialDescription={ticket.description}
          />
        ) : (
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text">{ticket.title}</h1>
            <p className={`mt-1 ${mutedText}`}>{ticket.description}</p>
          </div>
        )}
        <StatusPill status={ticket.status} />
      </div>

      <p className={`mb-3 ${mutedText}`}>
        Opened by {ticket.createdBy.name}
        {ticket.assignees.length > 0
          ? ` · assigned to ${ticket.assignees.map((a) => a.name).join(', ')}`
          : ' · unassigned'}
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <PriorityPill priority={ticket.priority} />
        <TypePill type={ticket.type} />
        {ticket.tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
          </span>
        ))}
      </div>

      {!isAdmin && isOwner && (
        <div className="mb-3">
          <CcEditor
            ticketId={ticket.id}
            initialWatchers={ticket.watchers.map((w) => ({ id: w.id, name: w.name }))}
          />
        </div>
      )}
      {!isAdmin && !isOwner && ticket.watchers.length > 0 && (
        <p className={`mb-3 ${mutedText}`}>CC: {ticket.watchers.map((w) => w.name).join(', ')}</p>
      )}

      {ticket.slaDueAt && (
        <p className="mb-6 text-sm">
          {overdue ? (
            <span className={badgeDanger}>overdue</span>
          ) : (
            <span className="text-text-secondary">
              SLA due {new Date(ticket.slaDueAt).toLocaleString()}
            </span>
          )}
        </p>
      )}

      {isAdmin && (
        <AdminTicketControls
          ticketId={ticket.id}
          currentStatus={ticket.status}
          currentPriority={ticket.priority}
          currentType={ticket.type}
          currentAssignees={ticket.assignees.map((a) => ({ id: a.id, name: a.name }))}
          currentSlaDueAt={ticket.slaDueAt ? ticket.slaDueAt.toISOString() : null}
          currentTagIds={ticket.tags.map((t) => t.id)}
          currentWatchers={ticket.watchers.map((w) => ({ id: w.id, name: w.name }))}
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
    </>
  );
}
