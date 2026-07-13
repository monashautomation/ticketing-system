import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@ticketing/db';
import { resetDatabase, createTestUser } from '@/test/db';
import { env } from '@/lib/env';
import { addMessage, createTicket, createTicketFromDiscord, updateTicket } from './tickets';
import {
  countUnreadNotifications,
  listNotificationsForUser,
  listPendingDiscordDms,
  markAllNotificationsRead,
  markDiscordDmsSent,
  markNotificationRead,
  markTicketNotificationsRead,
  queuePendingEscalationDms,
} from './notifications';

const BASE_URL = 'https://tickets.test';

beforeEach(async () => {
  await resetDatabase();
});

describe('ticket-created Discord DM (via createTicketFromDiscord)', () => {
  it('queues a DM with the claim link for a first-contact placeholder user', async () => {
    const { ticket, path } = await createTicketFromDiscord(
      {
        title: 'Discord ticket',
        description: 'help',
        priority: 'normal',
        type: 'other',
        discordUserId: 'discord-created-1',
        discordUsername: 'someuser',
      },
      BASE_URL,
    );

    const dms = await prisma.discordDm.findMany({ where: { ticketId: ticket.id } });
    expect(dms).toHaveLength(1);
    expect(dms[0]?.kind).toBe('ticket_created');
    expect(dms[0]?.discordUserId).toBe('discord-created-1');
    expect(dms[0]?.message).toBe(`Your ticket has been created — view it here: ${BASE_URL}${path}`);
  });

  it('queues a DM with the direct token link for an already-linked user', async () => {
    await createTestUser({ name: 'Linked', discordId: 'discord-created-2' });

    const { ticket, path } = await createTicketFromDiscord(
      {
        title: 'Second ticket',
        description: 'again',
        priority: 'normal',
        type: 'other',
        discordUserId: 'discord-created-2',
        discordUsername: 'someuser',
      },
      BASE_URL,
    );

    const dms = await prisma.discordDm.findMany({ where: { ticketId: ticket.id } });
    expect(dms).toHaveLength(1);
    expect(dms[0]?.discordUserId).toBe('discord-created-2');
    expect(dms[0]?.message).toBe(`Your ticket has been created — view it here: ${BASE_URL}${path}`);
  });
});

describe('reply notifications (via addMessage)', () => {
  it('notifies the owner and cc watchers when someone else replies, but never the author', async () => {
    const owner = await createTestUser({ name: 'Owner' });
    const watcher = await createTestUser({ name: 'Watcher', email: 'watcher@test.local' });
    const admin = await createTestUser({ name: 'Admin', email: 'admin@test.local', role: 'admin' });
    const ticket = await createTicket(owner.id, 'user', {
      title: 'Printer jam',
      description: 'x',
      priority: 'normal',
      type: 'other',
      ccUserIds: [watcher.id],
    });

    await addMessage(ticket.id, admin.id, { body: 'looking into it', isInternalNote: false });

    const ownerNotifications = await listNotificationsForUser(owner.id);
    expect(ownerNotifications).toHaveLength(1);
    expect(ownerNotifications[0]?.message).toBe('New reply on "Printer jam"');
    expect(ownerNotifications[0]?.type).toBe('reply');

    const watcherNotifications = await listNotificationsForUser(watcher.id);
    expect(watcherNotifications).toHaveLength(1);

    const adminNotifications = await listNotificationsForUser(admin.id);
    expect(adminNotifications).toHaveLength(0);
  });

  it('does not notify anyone when the reply is an internal note', async () => {
    const owner = await createTestUser({ name: 'Owner' });
    const admin = await createTestUser({ name: 'Admin', email: 'admin2@test.local', role: 'admin' });
    const ticket = await createTicket(owner.id, 'user', {
      title: 'Internal only',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });

    await addMessage(ticket.id, admin.id, { body: 'internal note', isInternalNote: true });

    expect(await countUnreadNotifications(owner.id)).toBe(0);
  });

  it('does not notify the replier about their own reply', async () => {
    const owner = await createTestUser({ name: 'Owner' });
    const ticket = await createTicket(owner.id, 'user', {
      title: 'Self reply',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });

    await addMessage(ticket.id, owner.id, { body: 'following up', isInternalNote: false });

    expect(await countUnreadNotifications(owner.id)).toBe(0);
  });

  it('immediately queues a link-only Discord DM to the owner, never including the reply body', async () => {
    const owner = await createTestUser({ name: 'Owner', discordId: 'discord-reply-1' });
    const admin = await createTestUser({ name: 'Admin', email: 'admin-reply@test.local', role: 'admin' });
    const ticket = await createTicket(owner.id, 'user', {
      title: 'Printer jam',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });

    await addMessage(ticket.id, admin.id, { body: 'secret internal detail', isInternalNote: false });

    const dms = await prisma.discordDm.findMany({ where: { ticketId: ticket.id } });
    expect(dms).toHaveLength(1);
    expect(dms[0]?.kind).toBe('reply');
    expect(dms[0]?.discordUserId).toBe('discord-reply-1');
    expect(dms[0]?.message).toBe(`Your ticket has a new reply — view it here: ${env.publicAppUrl}/t/${ticket.id}`);
    expect(dms[0]?.message).not.toContain('secret internal detail');
  });

  it('does not queue a Discord DM for a reply when the owner has no linked Discord account', async () => {
    const owner = await createTestUser({ name: 'Owner' });
    const admin = await createTestUser({ name: 'Admin', email: 'admin-reply2@test.local', role: 'admin' });
    const ticket = await createTicket(owner.id, 'user', {
      title: 'No discord link',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });

    await addMessage(ticket.id, admin.id, { body: 'looking into it', isInternalNote: false });

    expect(await prisma.discordDm.count({ where: { ticketId: ticket.id } })).toBe(0);
  });
});

describe('status-change notifications (via updateTicket)', () => {
  it('notifies the owner when status changes to a user-facing status', async () => {
    const owner = await createTestUser({ name: 'Owner' });
    const admin = await createTestUser({ name: 'Admin', email: 'admin3@test.local', role: 'admin' });
    const ticket = await createTicket(owner.id, 'user', {
      title: 'Leaky faucet',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });

    await updateTicket(ticket.id, { status: 'resolved' }, admin.id);

    const notifications = await listNotificationsForUser(owner.id);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.message).toBe('Your ticket "Leaky faucet" has been resolved');
    expect(notifications[0]?.type).toBe('status_changed');
  });

  it('does not create a notification when the status is set to the same value it already had', async () => {
    const owner = await createTestUser({ name: 'Owner' });
    const admin = await createTestUser({ name: 'Admin', email: 'admin4@test.local', role: 'admin' });
    const ticket = await createTicket(owner.id, 'user', {
      title: 'Already open',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });

    await updateTicket(ticket.id, { status: 'open' }, admin.id);

    expect(await countUnreadNotifications(owner.id)).toBe(0);
  });

  it('queues a "closed" Discord DM when the ticket is closed', async () => {
    const owner = await createTestUser({ name: 'Owner', discordId: 'discord-closed-1' });
    const admin = await createTestUser({ name: 'Admin', email: 'admin-closed@test.local', role: 'admin' });
    const ticket = await createTicket(owner.id, 'user', {
      title: 'Closed ticket',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });

    await updateTicket(ticket.id, { status: 'closed', closeReason: 'other' }, admin.id);

    const dms = await prisma.discordDm.findMany({ where: { ticketId: ticket.id, kind: 'closed' } });
    expect(dms).toHaveLength(1);
    expect(dms[0]?.message).toBe(
      `Your ticket has been closed. View it here: ${env.publicAppUrl}/t/${ticket.id}`,
    );
  });

  it('queues a "resolved" Discord DM when the ticket is resolved', async () => {
    const owner = await createTestUser({ name: 'Owner', discordId: 'discord-resolved-1' });
    const admin = await createTestUser({ name: 'Admin', email: 'admin-resolved@test.local', role: 'admin' });
    const ticket = await createTicket(owner.id, 'user', {
      title: 'Resolved ticket',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });

    await updateTicket(ticket.id, { status: 'resolved' }, admin.id);

    const dms = await prisma.discordDm.findMany({ where: { ticketId: ticket.id, kind: 'resolved' } });
    expect(dms).toHaveLength(1);
    expect(dms[0]?.message).toBe(
      `Your ticket has been resolved. View it here: ${env.publicAppUrl}/t/${ticket.id}`,
    );
  });

  it('queues a generic "updated" Discord DM for other status transitions', async () => {
    const owner = await createTestUser({ name: 'Owner', discordId: 'discord-updated-1' });
    const admin = await createTestUser({ name: 'Admin', email: 'admin-updated@test.local', role: 'admin' });
    const ticket = await createTicket(owner.id, 'user', {
      title: 'In progress ticket',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });

    await updateTicket(ticket.id, { status: 'in_progress' }, admin.id);

    const dms = await prisma.discordDm.findMany({ where: { ticketId: ticket.id, kind: 'status_updated' } });
    expect(dms).toHaveLength(1);
    expect(dms[0]?.message).toBe(
      `Your ticket has been updated. View it here: ${env.publicAppUrl}/t/${ticket.id}`,
    );
  });

  it('does not queue a Discord DM when the owner has no linked Discord account', async () => {
    const owner = await createTestUser({ name: 'Owner' });
    const admin = await createTestUser({ name: 'Admin', email: 'admin-nolink@test.local', role: 'admin' });
    const ticket = await createTicket(owner.id, 'user', {
      title: 'No discord link',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });

    await updateTicket(ticket.id, { status: 'resolved' }, admin.id);

    expect(await prisma.discordDm.count({ where: { ticketId: ticket.id } })).toBe(0);
  });
});

describe('pending-status Discord DM (via updateTicket)', () => {
  it('queues an immediate DM and stamps pendingSince when a linked user’s ticket enters pending', async () => {
    const owner = await createTestUser({ name: 'Owner', discordId: 'discord-owner-1' });
    const admin = await createTestUser({ name: 'Admin', email: 'admin5@test.local', role: 'admin' });
    const ticket = await createTicket(owner.id, 'user', {
      title: 'VPN down',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });

    await updateTicket(ticket.id, { status: 'pending' }, admin.id);

    const updated = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(updated.pendingSince).not.toBeNull();

    const dms = await prisma.discordDm.findMany({ where: { ticketId: ticket.id } });
    expect(dms).toHaveLength(1);
    expect(dms[0]?.kind).toBe('pending_notice');
    expect(dms[0]?.discordUserId).toBe('discord-owner-1');
    expect(dms[0]?.message).toBe(
      `Your ticket is awaiting additional information from you — please reply here: ${env.publicAppUrl}/t/${ticket.id}`,
    );
  });

  it('does not queue a DM when the ticket owner has no linked Discord account', async () => {
    const owner = await createTestUser({ name: 'Owner' });
    const admin = await createTestUser({ name: 'Admin', email: 'admin6@test.local', role: 'admin' });
    const ticket = await createTicket(owner.id, 'user', {
      title: 'No discord link',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });

    await updateTicket(ticket.id, { status: 'pending' }, admin.id);

    expect(await prisma.discordDm.count({ where: { ticketId: ticket.id } })).toBe(0);
    const updated = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(updated.pendingSince).not.toBeNull();
  });

  it('clears pendingSince and pendingEscalationSentAt when the ticket leaves pending', async () => {
    const owner = await createTestUser({ name: 'Owner', discordId: 'discord-owner-2' });
    const admin = await createTestUser({ name: 'Admin', email: 'admin7@test.local', role: 'admin' });
    const ticket = await createTicket(owner.id, 'user', {
      title: 'Back and forth',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });

    await updateTicket(ticket.id, { status: 'pending' }, admin.id);
    await prisma.ticket.update({ where: { id: ticket.id }, data: { pendingEscalationSentAt: new Date() } });

    await updateTicket(ticket.id, { status: 'in_progress' }, admin.id);

    const updated = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(updated.pendingSince).toBeNull();
    expect(updated.pendingEscalationSentAt).toBeNull();
  });
});

describe('queuePendingEscalationDms', () => {
  async function makePendingTicket(hoursAgo: number, discordId: string | null) {
    const owner = await createTestUser({
      name: `Owner ${hoursAgo}h`,
      email: `owner-${hoursAgo}h-${Math.random().toString(36).slice(2)}@test.local`,
      discordId: discordId ?? undefined,
    });
    const ticket = await createTicket(owner.id, 'user', {
      title: `Pending ${hoursAgo}h`,
      description: 'x',
      priority: 'normal',
      type: 'other',
    });
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'pending',
        pendingSince: new Date(Date.now() - hoursAgo * 60 * 60 * 1000),
      },
    });
    return ticket;
  }

  it('queues an escalation DM for tickets pending 24+ hours with a linked owner, and stamps pendingEscalationSentAt', async () => {
    const ticket = await makePendingTicket(25, 'discord-escalate-1');

    const queuedCount = await queuePendingEscalationDms(BASE_URL);
    expect(queuedCount).toBe(1);

    const dms = await prisma.discordDm.findMany({ where: { ticketId: ticket.id } });
    expect(dms).toHaveLength(1);
    expect(dms[0]?.kind).toBe('pending_escalation');
    expect(dms[0]?.message).toContain('may be closed');

    const updated = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(updated.pendingEscalationSentAt).not.toBeNull();
  });

  it('does not queue a second escalation DM once one has already been sent', async () => {
    await makePendingTicket(25, 'discord-escalate-2');

    const firstRun = await queuePendingEscalationDms(BASE_URL);
    expect(firstRun).toBe(1);

    const secondRun = await queuePendingEscalationDms(BASE_URL);
    expect(secondRun).toBe(0);
  });

  it('does not queue a DM for a ticket pending less than 24 hours', async () => {
    await makePendingTicket(1, 'discord-escalate-3');

    const queuedCount = await queuePendingEscalationDms(BASE_URL);
    expect(queuedCount).toBe(0);
  });

  it('skips tickets whose owner has no linked Discord account', async () => {
    await makePendingTicket(25, null);

    const queuedCount = await queuePendingEscalationDms(BASE_URL);
    expect(queuedCount).toBe(0);
  });
});

describe('Discord DM queue plumbing', () => {
  it('lists only unsent DMs oldest-first, and mark-sent removes them from the pending list', async () => {
    const owner = await createTestUser({ name: 'Owner', discordId: 'discord-queue-1' });
    const ticket = await createTicket(owner.id, 'user', {
      title: 'Queue test',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });

    const first = await prisma.discordDm.create({
      data: { discordUserId: 'discord-queue-1', ticketId: ticket.id, kind: 'pending_notice', message: 'first' },
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await prisma.discordDm.create({
      data: { discordUserId: 'discord-queue-1', ticketId: ticket.id, kind: 'reply', message: 'second' },
    });

    const pending = await listPendingDiscordDms();
    expect(pending.map((dm) => dm.id)).toEqual([first.id, second.id]);

    await markDiscordDmsSent([first.id]);

    const stillPending = await listPendingDiscordDms();
    expect(stillPending.map((dm) => dm.id)).toEqual([second.id]);

    const sentDm = await prisma.discordDm.findUniqueOrThrow({ where: { id: first.id } });
    expect(sentDm.sentAt).not.toBeNull();
  });
});

describe('notification tray read state', () => {
  it('marks a single notification read without affecting others', async () => {
    const owner = await createTestUser({ name: 'Owner' });
    const ticket = await createTicket(owner.id, 'user', {
      title: 'Read state',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });
    const notifA = await prisma.notification.create({
      data: { userId: owner.id, ticketId: ticket.id, type: 'reply', message: 'a' },
    });
    const notifB = await prisma.notification.create({
      data: { userId: owner.id, ticketId: ticket.id, type: 'reply', message: 'b' },
    });

    await markNotificationRead(notifA.id, owner.id);

    expect(await countUnreadNotifications(owner.id)).toBe(1);
    const updatedA = await prisma.notification.findUniqueOrThrow({ where: { id: notifA.id } });
    expect(updatedA.isRead).toBe(true);
    expect(updatedA.readAt).not.toBeNull();
    const updatedB = await prisma.notification.findUniqueOrThrow({ where: { id: notifB.id } });
    expect(updatedB.isRead).toBe(false);
  });

  it('does not let a user mark another user’s notification read', async () => {
    const owner = await createTestUser({ name: 'Owner' });
    const intruder = await createTestUser({ name: 'Intruder', email: 'intruder@test.local' });
    const ticket = await createTicket(owner.id, 'user', {
      title: 'Not yours',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });
    const notif = await prisma.notification.create({
      data: { userId: owner.id, ticketId: ticket.id, type: 'reply', message: 'a' },
    });

    await markNotificationRead(notif.id, intruder.id);

    const unchanged = await prisma.notification.findUniqueOrThrow({ where: { id: notif.id } });
    expect(unchanged.isRead).toBe(false);
  });

  it('marks all of a user’s notifications read at once', async () => {
    const owner = await createTestUser({ name: 'Owner' });
    const ticket = await createTicket(owner.id, 'user', {
      title: 'Mark all',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });
    await prisma.notification.create({ data: { userId: owner.id, ticketId: ticket.id, type: 'reply', message: 'a' } });
    await prisma.notification.create({ data: { userId: owner.id, ticketId: ticket.id, type: 'reply', message: 'b' } });

    await markAllNotificationsRead(owner.id);

    expect(await countUnreadNotifications(owner.id)).toBe(0);
  });

  it('marks a ticket’s notifications read for that user only when the ticket is opened directly', async () => {
    const owner = await createTestUser({ name: 'Owner' });
    const watcher = await createTestUser({ name: 'Watcher', email: 'watcher2@test.local' });
    const ticketA = await createTicket(owner.id, 'user', {
      title: 'Ticket A',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });
    const ticketB = await createTicket(owner.id, 'user', {
      title: 'Ticket B',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });
    await prisma.notification.create({ data: { userId: owner.id, ticketId: ticketA.id, type: 'reply', message: 'a' } });
    await prisma.notification.create({ data: { userId: owner.id, ticketId: ticketB.id, type: 'reply', message: 'b' } });
    await prisma.notification.create({ data: { userId: watcher.id, ticketId: ticketA.id, type: 'reply', message: 'c' } });

    await markTicketNotificationsRead(ticketA.id, owner.id);

    expect(await countUnreadNotifications(owner.id)).toBe(1); // ticket B still unread
    expect(await countUnreadNotifications(watcher.id)).toBe(1); // watcher's own notification untouched
  });
});
