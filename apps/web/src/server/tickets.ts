import { randomBytes, createHash } from 'node:crypto';
import { prisma, Prisma } from '@ticketing/db';
import type {
  CreateInternalTicketInput,
  CreateMessageInput,
  CreateTicketInput,
  UpdateTicketInput,
} from '@ticketing/shared';

const TICKET_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function listTicketsForUser(userId: string, role: 'user' | 'admin') {
  return prisma.ticket.findMany({
    where: role === 'admin' ? {} : { createdById: userId },
    orderBy: { updatedAt: 'desc' },
    include: { createdBy: true, assignedTo: true },
  });
}

export async function getTicketOr404(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      createdBy: true,
      assignedTo: true,
      messages: { orderBy: { createdAt: 'asc' }, include: { author: true } },
    },
  });
  if (!ticket) throw new Error('Ticket not found');
  return ticket;
}

export function canViewTicket(
  ticket: { createdById: string; assignedToId: string | null },
  user: { id: string; role: 'user' | 'admin' } | null,
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return ticket.createdById === user.id || ticket.assignedToId === user.id;
}

export async function verifyTicketToken(ticketId: string, token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const record = await prisma.ticketAccessToken.findUnique({ where: { tokenHash } });
  if (!record || record.ticketId !== ticketId) return false;
  if (record.expiresAt < new Date()) return false;
  return true;
}

export async function createTicket(userId: string, input: CreateTicketInput) {
  return prisma.ticket.create({
    data: {
      title: input.title,
      description: input.description,
      priority: input.priority,
      createdById: userId,
    },
  });
}

/** Creates a ticket from a Discord interaction. Auto-links to an existing user by discordId. */
export async function createTicketFromDiscord(input: CreateInternalTicketInput) {
  const existingUser = await prisma.user.findUnique({ where: { discordId: input.discordUserId } });

  const owner =
    existingUser ??
    (await prisma.user.create({
      data: {
        email: `discord-${input.discordUserId}@placeholder.invalid`,
        name: input.discordUsername,
        discordId: input.discordUserId,
        emailVerified: false,
      },
    }));

  const ticket = await prisma.ticket.create({
    data: {
      title: input.title,
      description: input.description,
      priority: input.priority,
      createdById: owner.id,
      discordChannelId: input.discordChannelId,
    },
  });

  const rawToken = randomBytes(32).toString('hex');
  await prisma.ticketAccessToken.create({
    data: {
      ticketId: ticket.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TICKET_TOKEN_TTL_MS),
    },
  });

  return { ticket, accessToken: rawToken, isNewUser: !existingUser };
}

export async function addMessage(ticketId: string, authorId: string, input: CreateMessageInput) {
  const message = await prisma.ticketMessage.create({
    data: {
      ticketId,
      authorId,
      body: input.body,
      isInternalNote: input.isInternalNote,
    },
    include: { author: true },
  });
  await prisma.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });
  return message;
}

export async function updateTicket(ticketId: string, input: UpdateTicketInput, actorId: string) {
  const data: Prisma.TicketUpdateInput = {};
  if (input.status) data.status = input.status;
  if (input.priority) data.priority = input.priority;
  if (input.assignedToId !== undefined) {
    data.assignedTo = input.assignedToId
      ? { connect: { id: input.assignedToId } }
      : { disconnect: true };
  }

  const ticket = await prisma.ticket.update({ where: { id: ticketId }, data });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: 'ticket.update',
      targetType: 'Ticket',
      targetId: ticketId,
      meta: input as Prisma.InputJsonValue,
    },
  });

  return ticket;
}
