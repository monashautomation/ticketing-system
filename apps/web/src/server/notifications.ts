import { prisma } from '@ticketing/db';
import type { TicketStatus } from '@ticketing/shared';

const PENDING_ESCALATION_MS = 1000 * 60 * 60 * 24; // 24 hours

export async function listNotificationsForUser(userId: string, limit = 30) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { ticket: { select: { id: true, title: true } } },
  });
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id, userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

/** Called when a user views a ticket directly (not via the notification tray). */
export async function markTicketNotificationsRead(ticketId: string, userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { ticketId, userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

interface RecipientUser {
  id: string;
  discordId: string | null;
}

interface TicketForNotify {
  id: string;
  title: string;
  createdBy: RecipientUser;
  watchers: RecipientUser[];
}

/** Everyone with a stake in the ticket (owner + watchers), deduped by id. */
function ticketRecipients(ticket: TicketForNotify): RecipientUser[] {
  const byId = new Map<string, RecipientUser>();
  byId.set(ticket.createdBy.id, ticket.createdBy);
  for (const watcher of ticket.watchers) byId.set(watcher.id, watcher);
  return [...byId.values()];
}

function ticketLink(baseUrl: string, ticketId: string): string {
  return `${baseUrl}/t/${ticketId}`;
}

/** Queues a Discord DM for every recipient that has a linked Discord account. */
async function queueDiscordDms(
  ticketId: string,
  recipients: RecipientUser[],
  kind: 'ticket_created' | 'reply' | 'status_updated' | 'closed' | 'resolved' | 'pending_notice' | 'pending_escalation',
  message: string,
): Promise<void> {
  const withDiscord = recipients.filter((r): r is RecipientUser & { discordId: string } => r.discordId !== null);
  if (withDiscord.length === 0) return;

  await prisma.discordDm.createMany({
    data: withDiscord.map((r) => ({
      discordUserId: r.discordId,
      ticketId,
      kind,
      message,
    })),
  });
}

/**
 * Queues the "your ticket has been created" DM. Called from the ticket-created API flow.
 * `link` is caller-supplied rather than derived from `ticket.id` because a first-contact
 * placeholder user only has a claim link, not a direct `/t/{id}` link, to view the ticket.
 */
export async function notifyTicketCreated(
  ticket: { id: string; createdBy: RecipientUser },
  link: string,
): Promise<void> {
  await queueDiscordDms(
    ticket.id,
    [ticket.createdBy],
    'ticket_created',
    `Your ticket has been created — view it here: ${link}`,
  );
}

/** Notifies everyone with a stake in the ticket (owner + watchers) except the actor who caused the event. */
export async function notifyReply(
  ticket: TicketForNotify,
  authorId: string,
  baseUrl: string,
): Promise<void> {
  const recipients = ticketRecipients(ticket).filter((r) => r.id !== authorId);
  if (recipients.length === 0) return;

  await prisma.notification.createMany({
    data: recipients.map((r) => ({
      userId: r.id,
      ticketId: ticket.id,
      type: 'reply' as const,
      message: `New reply on "${ticket.title}"`,
    })),
  });

  // Never include the reply body or ticket details in the DM -- link only.
  await queueDiscordDms(
    ticket.id,
    recipients,
    'reply',
    `Your ticket has a new reply — view it here: ${ticketLink(baseUrl, ticket.id)}`,
  );
}

const STATUS_LABELS: Partial<Record<TicketStatus, string>> = {
  pending: 'is awaiting your response',
  resolved: 'has been resolved',
  closed: 'has been closed',
  in_progress: 'is now in progress',
  escalated: 'has been escalated',
};

/**
 * `pending` gets its own DM from handlePendingTransition (with the "please reply" wording), so
 * it's skipped here to avoid double-sending. `closed`/`resolved` get tailored wording; every
 * other status gets a generic "has been updated" DM.
 */
function statusDmMessage(status: TicketStatus, baseUrl: string, ticketId: string): string | null {
  const link = ticketLink(baseUrl, ticketId);
  if (status === 'pending') return null;
  if (status === 'closed') return `Your ticket has been closed. View it here: ${link}`;
  if (status === 'resolved') return `Your ticket has been resolved. View it here: ${link}`;
  return `Your ticket has been updated. View it here: ${link}`;
}

export async function notifyStatusChanged(
  ticket: TicketForNotify,
  newStatus: TicketStatus,
  actorId: string,
  baseUrl: string,
): Promise<void> {
  const label = STATUS_LABELS[newStatus];
  const recipients = ticketRecipients(ticket).filter((r) => r.id !== actorId);
  if (recipients.length === 0) return;

  if (label) {
    await prisma.notification.createMany({
      data: recipients.map((r) => ({
        userId: r.id,
        ticketId: ticket.id,
        type: 'status_changed' as const,
        message: `Your ticket "${ticket.title}" ${label}`,
      })),
    });
  }

  const dmMessage = statusDmMessage(newStatus, baseUrl, ticket.id);
  if (!dmMessage) return;

  const kind = newStatus === 'closed' ? 'closed' : newStatus === 'resolved' ? 'resolved' : 'status_updated';
  await queueDiscordDms(ticket.id, recipients, kind, dmMessage);
}

/**
 * Queues the immediate "your ticket is awaiting your response" DM when a ticket transitions
 * into `pending`, and clears the escalation clock when it transitions out. Call this from
 * updateTicket right after the status write, passing the ticket's state *before* the update.
 */
export async function handlePendingTransition(
  ticket: { id: string; status: TicketStatus; createdBy: RecipientUser },
  previousStatus: TicketStatus,
  baseUrl: string,
): Promise<void> {
  const enteringPending = ticket.status === 'pending' && previousStatus !== 'pending';
  const leavingPending = ticket.status !== 'pending' && previousStatus === 'pending';

  if (leavingPending) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { pendingSince: null, pendingEscalationSentAt: null },
    });
    return;
  }

  if (!enteringPending) return;

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { pendingSince: new Date(), pendingEscalationSentAt: null },
  });

  await queueDiscordDms(
    ticket.id,
    [ticket.createdBy],
    'pending_notice',
    `Your ticket is awaiting additional information from you — please reply here: ${ticketLink(baseUrl, ticket.id)}`,
  );
}

/** Background sweep: tickets stuck in `pending` for 24+ hours get a single follow-up DM. */
export async function queuePendingEscalationDms(baseUrl: string): Promise<number> {
  const cutoff = new Date(Date.now() - PENDING_ESCALATION_MS);
  const tickets = await prisma.ticket.findMany({
    where: {
      status: 'pending',
      pendingSince: { lt: cutoff },
      pendingEscalationSentAt: null,
    },
    include: { createdBy: { select: { discordId: true } } },
  });

  const withDiscord = tickets.filter((t) => t.createdBy.discordId);
  if (withDiscord.length === 0) return 0;

  await prisma.$transaction([
    prisma.discordDm.createMany({
      data: withDiscord.map((t) => ({
        discordUserId: t.createdBy.discordId as string,
        ticketId: t.id,
        kind: 'pending_escalation' as const,
        message: `Your ticket is still awaiting a response and may be closed if we don't hear back soon — please reply here: ${ticketLink(baseUrl, t.id)}`,
      })),
    }),
    prisma.ticket.updateMany({
      where: { id: { in: withDiscord.map((t) => t.id) } },
      data: { pendingEscalationSentAt: new Date() },
    }),
  ]);

  return withDiscord.length;
}

export async function listPendingDiscordDms(limit = 25) {
  return prisma.discordDm.findMany({
    where: { sentAt: null },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
}

export async function markDiscordDmsSent(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.discordDm.updateMany({
    where: { id: { in: ids } },
    data: { sentAt: new Date() },
  });
}
