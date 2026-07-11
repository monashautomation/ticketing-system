import { prisma } from '@ticketing/db';

const UNREAD_REPLY_DM_DELAY_MS = 1000 * 60 * 30; // 30 minutes
const PENDING_ESCALATION_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

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

function ticketRecipientIds(ticket: {
  createdById: string;
  watchers: { id: string }[];
  assignees: { id: string }[];
}): string[] {
  const ids = new Set([ticket.createdById, ...ticket.watchers.map((w) => w.id)]);
  return [...ids];
}

/** Notifies everyone with a stake in the ticket (owner + watchers) except the actor who caused the event. */
export async function notifyReply(
  ticket: { id: string; title: string; createdById: string; watchers: { id: string }[]; assignees: { id: string }[] },
  authorId: string,
): Promise<void> {
  const recipientIds = ticketRecipientIds(ticket).filter((id) => id !== authorId);
  if (recipientIds.length === 0) return;

  await prisma.notification.createMany({
    data: recipientIds.map((userId) => ({
      userId,
      ticketId: ticket.id,
      type: 'reply' as const,
      message: `New reply on "${ticket.title}"`,
    })),
  });
}

const STATUS_MESSAGES: Partial<Record<string, string>> = {
  pending: 'is awaiting your response',
  resolved: 'has been resolved',
  closed: 'has been closed',
  in_progress: 'is now in progress',
  escalated: 'has been escalated',
};

export async function notifyStatusChanged(
  ticket: { id: string; title: string; createdById: string; watchers: { id: string }[]; assignees: { id: string }[] },
  newStatus: string,
  actorId: string,
): Promise<void> {
  const label = STATUS_MESSAGES[newStatus];
  if (!label) return;

  const recipientIds = ticketRecipientIds(ticket).filter((id) => id !== actorId);
  if (recipientIds.length === 0) return;

  await prisma.notification.createMany({
    data: recipientIds.map((userId) => ({
      userId,
      ticketId: ticket.id,
      type: 'status_changed' as const,
      message: `Your ticket "${ticket.title}" ${label}`,
    })),
  });
}

function ticketLink(baseUrl: string, ticketId: string): string {
  return `${baseUrl}/t/${ticketId}`;
}

/**
 * Queues the immediate "your ticket is awaiting your response" DM when a ticket transitions
 * into `pending`, and clears the escalation clock when it transitions out. Call this from
 * updateTicket right after the status write, passing the ticket's state *before* the update.
 */
export async function handlePendingTransition(
  ticket: { id: string; title: string; status: string; createdBy: { discordId: string | null } },
  previousStatus: string,
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

  if (!ticket.createdBy.discordId) return;

  await prisma.discordDm.create({
    data: {
      discordUserId: ticket.createdBy.discordId,
      ticketId: ticket.id,
      kind: 'pending_notice',
      message: `Your ticket "${ticket.title}" is awaiting a response from you: ${ticketLink(baseUrl, ticket.id)}`,
    },
  });
}

/** Background sweep: tickets stuck in `pending` for 3+ days get a single escalation-warning DM. */
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
        message: `Your ticket "${t.title}" is still awaiting your response. Sys & Infra may close it if there's no response within a reasonable time: ${ticketLink(baseUrl, t.id)}`,
      })),
    }),
    prisma.ticket.updateMany({
      where: { id: { in: withDiscord.map((t) => t.id) } },
      data: { pendingEscalationSentAt: new Date() },
    }),
  ]);

  return withDiscord.length;
}

/** Background sweep: reply notifications left unread for 30+ minutes get a reminder DM. */
export async function queueUnreadReplyDms(baseUrl: string): Promise<number> {
  const cutoff = new Date(Date.now() - UNREAD_REPLY_DM_DELAY_MS);
  const notifications = await prisma.notification.findMany({
    where: {
      type: 'reply',
      isRead: false,
      discordReminderSentAt: null,
      createdAt: { lt: cutoff },
    },
    include: {
      ticket: { select: { id: true, title: true } },
      user: { select: { discordId: true } },
    },
  });

  const withDiscord = notifications.filter((n) => n.user.discordId);
  if (withDiscord.length === 0) return 0;

  await prisma.$transaction([
    prisma.discordDm.createMany({
      data: withDiscord.map((n) => ({
        discordUserId: n.user.discordId as string,
        ticketId: n.ticket.id,
        kind: 'reply_reminder' as const,
        message: `You have a reply to ticket "${n.ticket.title}": ${ticketLink(baseUrl, n.ticket.id)}`,
      })),
    }),
    ...withDiscord.map((n) =>
      prisma.notification.update({
        where: { id: n.id },
        data: { discordReminderSentAt: new Date() },
      }),
    ),
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
