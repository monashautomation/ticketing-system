import { prisma } from '@ticketing/db';
import type { TicketStatus } from '@ticketing/shared';

const PENDING_ESCALATION_MS = 1000 * 60 * 60 * 24; // 24 hours
const ACTIVE_STATUS_REMINDER_MS = 1000 * 60 * 60 * 24; // 24 hours
const UNASSIGNED_ALERT_HOUR = 9; // local server time

/// Statuses that drive the 24h "still sitting, assigned to you" reminder.
const ACTIVE_REMINDER_STATUSES: readonly TicketStatus[] = ['open', 'in_progress', 'escalated'];
/// Statuses counted in the unassigned-backlog channel alert (broader than the reminder set --
/// includes pending, since an unassigned pending ticket is still backlog nobody owns).
const UNASSIGNED_BACKLOG_STATUSES: readonly TicketStatus[] = ['open', 'pending', 'escalated', 'in_progress'];

// Kept in sync with tickets.ts's RESOLVED_STATUSES -- not imported directly to avoid a
// tickets.ts <-> notifications.ts circular import (tickets.ts already imports this module).
const RESOLVED_STATUSES: readonly TicketStatus[] = ['resolved', 'closed'];

export async function listNotificationsForUser(userId: string, limit = 30) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { ticket: { select: { id: true, title: true, incidentNumber: true } } },
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
  incidentNumber: string;
  title: string;
  createdBy: RecipientUser;
  watchers: RecipientUser[];
  assignees: RecipientUser[];
}

/** Everyone with a stake in the ticket (owner + watchers), deduped by id. */
function ticketRecipients(ticket: TicketForNotify): RecipientUser[] {
  const byId = new Map<string, RecipientUser>();
  byId.set(ticket.createdBy.id, ticket.createdBy);
  for (const watcher of ticket.watchers) byId.set(watcher.id, watcher);
  return [...byId.values()];
}

/**
 * Assignees excluding the actor and anyone already covered by `ticketRecipients` (owner/
 * watchers) -- assignees get their own "assigned to you" wording, so someone who's both a
 * watcher and an assignee should only get the watcher-flavored DM, not both.
 */
function assigneeOnlyRecipients(ticket: TicketForNotify, actorId: string): RecipientUser[] {
  const alreadyCovered = new Set(ticketRecipients(ticket).map((r) => r.id));
  return ticket.assignees.filter((a) => a.id !== actorId && !alreadyCovered.has(a.id));
}

function ticketLink(baseUrl: string, ticketId: string): string {
  return `${baseUrl}/t/${ticketId}`;
}

/**
 * Discord-markdown header used to open every ticket-specific notification, DM or channel post,
 * so incident number + title are always visible and the message doesn't read as plain, blend-in
 * text in a busy channel.
 */
function ticketHeader(incidentNumber: string, title: string): string {
  return `**${incidentNumber}**: ${title}`;
}

/** Queues a Discord DM for every recipient that has a linked Discord account. */
async function queueDiscordDms(
  ticketId: string,
  recipients: RecipientUser[],
  kind:
    | 'ticket_created'
    | 'reply'
    | 'status_updated'
    | 'closed'
    | 'resolved'
    | 'pending_notice'
    | 'pending_escalation'
    | 'assignee_updated'
    | 'assignee_idle_reminder',
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
  ticket: { id: string; incidentNumber: string; title: string; createdBy: RecipientUser },
  link: string,
): Promise<void> {
  await queueDiscordDms(
    ticket.id,
    [ticket.createdBy],
    'ticket_created',
    `${ticketHeader(ticket.incidentNumber, ticket.title)}\nYour ticket has been created. View it here: ${link}`,
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
      message: `New reply on ${ticket.incidentNumber} "${ticket.title}"`,
    })),
  });

  // Never include the reply body in the DM -- header (incident number + title) + link only.
  const header = ticketHeader(ticket.incidentNumber, ticket.title);
  await queueDiscordDms(
    ticket.id,
    recipients,
    'reply',
    `${header}\nYour ticket has a new reply. View it here: ${ticketLink(baseUrl, ticket.id)}`,
  );

  await queueDiscordDms(
    ticket.id,
    assigneeOnlyRecipients(ticket, authorId),
    'assignee_updated',
    `${header}\nA ticket assigned to you has a new reply. View it here: ${ticketLink(baseUrl, ticket.id)}`,
  );
}

/**
 * Notifies everyone with a stake in the ticket (owner + watchers + assignees) except the actor
 * who uploaded the file. No file name or ticket details in the DM -- link only, same rule as
 * notifyReply. Previously nothing fired on attachment upload at all.
 */
export async function notifyAttachmentAdded(
  ticket: TicketForNotify,
  uploaderId: string,
  baseUrl: string,
): Promise<void> {
  const recipients = ticketRecipients(ticket).filter((r) => r.id !== uploaderId);
  const header = ticketHeader(ticket.incidentNumber, ticket.title);
  if (recipients.length > 0) {
    await prisma.notification.createMany({
      data: recipients.map((r) => ({
        userId: r.id,
        ticketId: ticket.id,
        type: 'reply' as const,
        message: `New attachment on ${ticket.incidentNumber} "${ticket.title}"`,
      })),
    });

    await queueDiscordDms(
      ticket.id,
      recipients,
      'reply',
      `${header}\nYour ticket has a new attachment. View it here: ${ticketLink(baseUrl, ticket.id)}`,
    );
  }

  await queueDiscordDms(
    ticket.id,
    assigneeOnlyRecipients(ticket, uploaderId),
    'assignee_updated',
    `${header}\nA ticket assigned to you has a new attachment. View it here: ${ticketLink(baseUrl, ticket.id)}`,
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
/// Shown on closed/resolved DMs so the recipient knows how to get help again without digging
/// through the (now-closed) ticket thread.
function newTicketFooter(baseUrl: string): string {
  return ` Need further help? Open a new ticket: ${baseUrl}`;
}

function statusDmMessage(status: TicketStatus, baseUrl: string, ticketId: string, header: string): string | null {
  const link = ticketLink(baseUrl, ticketId);
  if (status === 'pending') return null;
  if (status === 'closed') return `${header}\nYour ticket has been closed. View it here: ${link}${newTicketFooter(baseUrl)}`;
  if (status === 'resolved') return `${header}\nYour ticket has been resolved. View it here: ${link}${newTicketFooter(baseUrl)}`;
  return `${header}\nYour ticket has been updated. View it here: ${link}`;
}

function assigneeStatusDmMessage(status: TicketStatus, baseUrl: string, ticketId: string, header: string): string | null {
  const link = ticketLink(baseUrl, ticketId);
  if (status === 'pending') return null;
  return `${header}\nA ticket assigned to you has been updated. View it here: ${link}`;
}

export async function notifyStatusChanged(
  ticket: TicketForNotify,
  newStatus: TicketStatus,
  actorId: string,
  baseUrl: string,
): Promise<void> {
  const label = STATUS_LABELS[newStatus];
  const recipients = ticketRecipients(ticket).filter((r) => r.id !== actorId);
  const header = ticketHeader(ticket.incidentNumber, ticket.title);

  if (recipients.length > 0 && label) {
    await prisma.notification.createMany({
      data: recipients.map((r) => ({
        userId: r.id,
        ticketId: ticket.id,
        type: 'status_changed' as const,
        message: `Your ticket ${ticket.incidentNumber} "${ticket.title}" ${label}`,
      })),
    });
  }

  const kind = newStatus === 'closed' ? 'closed' : newStatus === 'resolved' ? 'resolved' : 'status_updated';

  const dmMessage = statusDmMessage(newStatus, baseUrl, ticket.id, header);
  if (dmMessage && recipients.length > 0) {
    await queueDiscordDms(ticket.id, recipients, kind, dmMessage);
  }

  const assigneeMessage = assigneeStatusDmMessage(newStatus, baseUrl, ticket.id, header);
  if (assigneeMessage) {
    await queueDiscordDms(ticket.id, assigneeOnlyRecipients(ticket, actorId), 'assignee_updated', assigneeMessage);
  }
}

/**
 * Queues the immediate "your ticket is awaiting your response" DM when a ticket transitions
 * into `pending`, and clears the escalation clock when it transitions out. Call this from
 * updateTicket right after the status write, passing the ticket's state *before* the update.
 */
export async function handlePendingTransition(
  ticket: { id: string; incidentNumber: string; title: string; status: TicketStatus; createdBy: RecipientUser },
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
    `${ticketHeader(ticket.incidentNumber, ticket.title)}\nYour ticket is awaiting additional information from you. Please reply here: ${ticketLink(baseUrl, ticket.id)}`,
  );
}

/**
 * Resets or clears the "sitting in open/in_progress/escalated" clock that drives the 24h
 * assignee idle reminder. Per product decision, the clock restarts on *every* transition into
 * or within that status set (e.g. open -> escalated restarts it), not just on first entry --
 * distinct from handlePendingTransition, which only fires once per pending period.
 * Call from updateTicket right after the status write, passing the ticket's *new* status.
 */
export async function handleActiveStatusTransition(ticketId: string, newStatus: TicketStatus): Promise<void> {
  if (ACTIVE_REMINDER_STATUSES.includes(newStatus)) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { activeSince: new Date(), activeReminderSentAt: null },
    });
    return;
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { activeSince: null, activeReminderSentAt: null },
  });
}

/**
 * Background sweep: tickets sitting in open/in_progress/escalated for 24h+ get a single
 * reminder DM to their assignees (not the creator -- this is an "action needed from you" nudge,
 * mirrors queueSlaBreachAlerts' targeting). Unassigned tickets are skipped -- nobody to DM;
 * they're covered by queueUnassignedBacklogAlert's channel post instead.
 */
export async function queueActiveStatusReminders(baseUrl: string): Promise<number> {
  const cutoff = new Date(Date.now() - ACTIVE_STATUS_REMINDER_MS);
  const tickets = await prisma.ticket.findMany({
    where: {
      status: { in: [...ACTIVE_REMINDER_STATUSES] },
      activeSince: { lt: cutoff },
      activeReminderSentAt: null,
    },
    include: { assignees: { select: { id: true, discordId: true } } },
  });

  const withAssignees = tickets.filter((t) => t.assignees.length > 0);
  if (withAssignees.length === 0) return 0;

  for (const ticket of withAssignees) {
    const withDiscord = ticket.assignees.filter(
      (a): a is RecipientUser & { discordId: string } => a.discordId !== null,
    );
    await prisma.$transaction([
      ...(withDiscord.length > 0
        ? [
            prisma.discordDm.createMany({
              data: withDiscord.map((a) => ({
                discordUserId: a.discordId,
                ticketId: ticket.id,
                kind: 'assignee_idle_reminder' as const,
                message: `${ticketHeader(ticket.incidentNumber, ticket.title)}\nA ticket assigned to you has been sitting for over 24 hours without an update. View it here: ${ticketLink(baseUrl, ticket.id)}`,
              })),
            }),
          ]
        : []),
      prisma.ticket.update({
        where: { id: ticket.id },
        data: { activeReminderSentAt: new Date() },
      }),
    ]);
  }

  return withAssignees.length;
}

/**
 * Posts a new-ticket message to the admin-configured channel, if one is set. Incident number +
 * title + link to the specific ticket -- no description/priority/reporter, per the
 * no-ticket-details-outside-app rule.
 */
export async function notifyNewTicketChannel(
  ticket: { id: string; incidentNumber: string; title: string },
  baseUrl: string,
): Promise<void> {
  const settings = await prisma.discordSettings.findUnique({ where: { id: 'singleton' } });
  const channelId = settings?.newTicketChannelId;
  if (!channelId) return;

  await prisma.discordChannelMessage.create({
    data: {
      channelId,
      kind: 'ticket_created',
      message: `New ticket opened\n${ticketHeader(ticket.incidentNumber, ticket.title)}\n${ticketLink(baseUrl, ticket.id)}`,
    },
  });
}

/**
 * Daily (9am server time) sweep: if there's an admin-configured channel and at least one
 * unassigned open/pending/escalated/in_progress ticket, posts a count + link to /admin (not to
 * any specific ticket). Deduped to once per calendar day via the most recent
 * `unassigned_backlog` DiscordChannelMessage row.
 */
export async function queueUnassignedBacklogAlert(baseUrl: string): Promise<void> {
  const now = new Date();
  if (now.getHours() !== UNASSIGNED_ALERT_HOUR) return;

  const settings = await prisma.discordSettings.findUnique({ where: { id: 'singleton' } });
  const channelId = settings?.unassignedAlertChannelId;
  if (!channelId) return;

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const alreadySentToday = await prisma.discordChannelMessage.findFirst({
    where: { kind: 'unassigned_backlog', createdAt: { gte: startOfDay } },
  });
  if (alreadySentToday) return;

  const count = await prisma.ticket.count({
    where: { status: { in: [...UNASSIGNED_BACKLOG_STATUSES] }, assignees: { none: {} } },
  });
  if (count === 0) return;

  await prisma.discordChannelMessage.create({
    data: {
      channelId,
      kind: 'unassigned_backlog',
      message: `${count} open ticket${count === 1 ? '' : 's'} have no assignee. View the ticketing system: ${baseUrl}/admin`,
    },
  });
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
        message: `${ticketHeader(t.incidentNumber, t.title)}\nYour ticket is still awaiting a response and may be closed if we don't hear back soon. Please reply here: ${ticketLink(baseUrl, t.id)}`,
      })),
    }),
    prisma.ticket.updateMany({
      where: { id: { in: withDiscord.map((t) => t.id) } },
      data: { pendingEscalationSentAt: new Date() },
    }),
  ]);

  return withDiscord.length;
}

/**
 * Background sweep: tickets overdue on their SLA (open/active, slaDueAt in the past) that
 * haven't already had a breach alert sent get one now, targeted at their assignees (not the
 * ticket owner -- this is an ops alert about response time, not a customer-facing update).
 * Unassigned overdue tickets are stamped but silently skipped -- there's no one to alert.
 */
export async function queueSlaBreachAlerts(baseUrl: string): Promise<number> {
  const tickets = await prisma.ticket.findMany({
    where: {
      slaDueAt: { lt: new Date() },
      status: { notIn: [...RESOLVED_STATUSES] },
      slaBreachNotifiedAt: null,
    },
    include: { assignees: { select: { id: true, discordId: true } } },
  });

  if (tickets.length === 0) return 0;

  for (const ticket of tickets) {
    const link = ticketLink(baseUrl, ticket.id);
    const message = `${ticketHeader(ticket.incidentNumber, ticket.title)}\nSLA breached. View it here: ${link}`;
    const withDiscord = ticket.assignees.filter(
      (a): a is RecipientUser & { discordId: string } => a.discordId !== null,
    );

    await prisma.$transaction([
      ...(ticket.assignees.length > 0
        ? [
            prisma.notification.createMany({
              data: ticket.assignees.map((a) => ({
                userId: a.id,
                ticketId: ticket.id,
                type: 'sla_breach' as const,
                message: `SLA breached on ${ticket.incidentNumber} "${ticket.title}"`,
              })),
            }),
          ]
        : []),
      ...(withDiscord.length > 0
        ? [
            prisma.discordDm.createMany({
              data: withDiscord.map((a) => ({
                discordUserId: a.discordId,
                ticketId: ticket.id,
                kind: 'sla_breach' as const,
                message,
              })),
            }),
          ]
        : []),
      prisma.ticket.update({
        where: { id: ticket.id },
        data: { slaBreachNotifiedAt: new Date() },
      }),
    ]);
  }

  return tickets.length;
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

export async function listPendingDiscordChannelMessages(limit = 25) {
  return prisma.discordChannelMessage.findMany({
    where: { sentAt: null },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
}

export async function markDiscordChannelMessagesSent(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.discordChannelMessage.updateMany({
    where: { id: { in: ids } },
    data: { sentAt: new Date() },
  });
}
