import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@ticketing/db';
import { resetDatabase, createTestUser } from '@/test/db';
import {
  addMessage,
  createTicket,
  createTicketFromDiscord,
  listTicketsForUser,
  updateTicket,
  verifyTicketToken,
} from './tickets';

beforeEach(async () => {
  await resetDatabase();
});

describe('createTicket + listTicketsForUser', () => {
  it('only returns a user their own tickets, but returns everything for admins', async () => {
    const owner = await createTestUser({ name: 'Owner' });
    const otherUser = await createTestUser({ name: 'Other', email: 'other@test.local' });
    const admin = await createTestUser({ name: 'Admin', email: 'admin@test.local', role: 'admin' });

    await createTicket(owner.id, { title: 'Printer jam', description: 'x', priority: 'normal' });
    await createTicket(otherUser.id, { title: 'VPN down', description: 'y', priority: 'high' });

    const ownerView = await listTicketsForUser(owner.id, 'user');
    expect(ownerView).toHaveLength(1);
    expect(ownerView[0]?.title).toBe('Printer jam');

    const adminView = await listTicketsForUser(admin.id, 'admin');
    expect(adminView).toHaveLength(2);
  });
});

describe('createTicketFromDiscord', () => {
  it('creates a new placeholder user on first contact and issues a working access token', async () => {
    const { ticket, accessToken, isNewUser } = await createTicketFromDiscord({
      title: 'Discord ticket',
      description: 'help',
      priority: 'normal',
      discordUserId: 'discord-123',
      discordUsername: 'someuser',
    });

    expect(isNewUser).toBe(true);
    expect(await verifyTicketToken(ticket.id, accessToken)).toBe(true);

    const owner = await prisma.user.findUnique({ where: { id: ticket.createdById } });
    expect(owner?.discordId).toBe('discord-123');
  });

  it('reuses the existing user when discordId is already linked', async () => {
    const existing = await createTestUser({ name: 'Linked', discordId: 'discord-456' });

    const { ticket, isNewUser } = await createTicketFromDiscord({
      title: 'Second ticket',
      description: 'again',
      priority: 'normal',
      discordUserId: 'discord-456',
      discordUsername: 'someuser',
    });

    expect(isNewUser).toBe(false);
    expect(ticket.createdById).toBe(existing.id);
  });

  it('rejects a token from a different ticket', async () => {
    const first = await createTicketFromDiscord({
      title: 'Ticket A',
      description: 'a',
      priority: 'normal',
      discordUserId: 'discord-a',
      discordUsername: 'a',
    });
    const second = await createTicketFromDiscord({
      title: 'Ticket B',
      description: 'b',
      priority: 'normal',
      discordUserId: 'discord-b',
      discordUsername: 'b',
    });

    expect(await verifyTicketToken(second.ticket.id, first.accessToken)).toBe(false);
  });

  it('rejects an expired token', async () => {
    const { ticket, accessToken } = await createTicketFromDiscord({
      title: 'Expiring ticket',
      description: 'x',
      priority: 'normal',
      discordUserId: 'discord-expiring',
      discordUsername: 'x',
    });

    await prisma.ticketAccessToken.updateMany({
      where: { ticketId: ticket.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await verifyTicketToken(ticket.id, accessToken)).toBe(false);
  });
});

describe('addMessage', () => {
  it('bumps the ticket updatedAt timestamp', async () => {
    const owner = await createTestUser();
    const ticket = await createTicket(owner.id, {
      title: 'Bump test',
      description: 'x',
      priority: 'normal',
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    await addMessage(ticket.id, owner.id, { body: 'reply', isInternalNote: false });

    const updated = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(updated.updatedAt.getTime()).toBeGreaterThan(ticket.updatedAt.getTime());
  });
});

describe('updateTicket', () => {
  it('updates status, priority, and assignee, and records an audit log entry', async () => {
    const owner = await createTestUser();
    const admin = await createTestUser({ name: 'Admin', email: 'admin2@test.local', role: 'admin' });
    const ticket = await createTicket(owner.id, {
      title: 'Assign me',
      description: 'x',
      priority: 'normal',
    });

    const updated = await updateTicket(
      ticket.id,
      { status: 'escalated', priority: 'urgent', assignedToId: admin.id },
      admin.id,
    );

    expect(updated.status).toBe('escalated');
    expect(updated.priority).toBe('urgent');
    expect(updated.assignedToId).toBe(admin.id);

    const auditEntries = await prisma.auditLog.findMany({ where: { targetId: ticket.id } });
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]?.action).toBe('ticket.update');
  });

  it('unassigns when assignedToId is explicitly null', async () => {
    const owner = await createTestUser();
    const admin = await createTestUser({ name: 'Admin', email: 'admin3@test.local', role: 'admin' });
    const ticket = await createTicket(owner.id, {
      title: 'Unassign me',
      description: 'x',
      priority: 'normal',
    });
    await updateTicket(ticket.id, { assignedToId: admin.id }, admin.id);

    const unassigned = await updateTicket(ticket.id, { assignedToId: null }, admin.id);
    expect(unassigned.assignedToId).toBeNull();
  });
});
