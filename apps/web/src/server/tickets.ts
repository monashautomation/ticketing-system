import { randomBytes, createHash } from 'node:crypto';
import { prisma, Prisma } from '@ticketing/db';
import type {
  CreateInternalTicketInput,
  CreateMessageInput,
  CreateTicketInput,
  TicketPriority,
  TicketStatus,
  UpdateTicketInput,
} from '@ticketing/shared';
import { AppError, NotFoundError } from '@/lib/errors';

const TICKET_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

const RESOLVED_STATUSES: readonly TicketStatus[] = ['resolved', 'closed'];

export function isOverdue(ticket: { slaDueAt: Date | null; status: string }): boolean {
  if (!ticket.slaDueAt) return false;
  if (RESOLVED_STATUSES.includes(ticket.status as TicketStatus)) return false;
  return ticket.slaDueAt.getTime() < Date.now();
}

export interface TicketQueueFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedToId?: string;
  tagId?: string;
  overdueOnly?: boolean;
  search?: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function listTicketsForUser(userId: string, role: 'user' | 'admin') {
  return prisma.ticket.findMany({
    where: role === 'admin' ? {} : { createdById: userId },
    orderBy: { updatedAt: 'desc' },
    include: { createdBy: true, assignedTo: true, tags: true },
  });
}

/** Full admin queue: every ticket, with filters. Callers must gate this behind requireAdmin(). */
export async function listTicketsForAdminQueue(filters: TicketQueueFilters = {}) {
  const where: Prisma.TicketWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.assignedToId) where.assignedToId = filters.assignedToId;
  if (filters.tagId) where.tags = { some: { id: filters.tagId } };
  if (filters.search) {
    where.title = { contains: filters.search, mode: 'insensitive' };
  }
  if (filters.overdueOnly) {
    where.slaDueAt = { lt: new Date() };
    where.status = { notIn: [...RESOLVED_STATUSES] };
  }

  return prisma.ticket.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: { createdBy: true, assignedTo: true, tags: true },
  });
}

export async function getTicketOr404(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      createdBy: true,
      assignedTo: true,
      tags: true,
      attachments: { orderBy: { createdAt: 'asc' }, include: { uploadedBy: true } },
      messages: { orderBy: { createdAt: 'asc' }, include: { author: true } },
    },
  });
  if (!ticket) throw new NotFoundError('Ticket not found');
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

  if (input.status) {
    data.status = input.status;
    data.resolvedAt = RESOLVED_STATUSES.includes(input.status) ? new Date() : null;
  }
  if (input.priority) data.priority = input.priority;

  if (input.assignedToId !== undefined) {
    if (input.assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: input.assignedToId } });
      if (!assignee || assignee.role !== 'admin') {
        throw new AppError('Tickets can only be assigned to admins');
      }
      data.assignedTo = { connect: { id: input.assignedToId } };
    } else {
      data.assignedTo = { disconnect: true };
    }
  }

  if (input.slaDueAt !== undefined) {
    data.slaDueAt = input.slaDueAt ? new Date(input.slaDueAt) : null;
  }

  if (input.tagIds !== undefined) {
    data.tags = { set: input.tagIds.map((id) => ({ id })) };
  }

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data,
    include: { tags: true, assignedTo: true, createdBy: true },
  });

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

export interface TicketMetrics {
  totalOpen: number;
  totalPending: number;
  totalEscalated: number;
  totalResolved: number;
  totalClosed: number;
  overdueCount: number;
  avgResolutionMs: number | null;
  byPriority: Record<TicketPriority, number>;
}

/** Callers must gate this behind requireAdmin(). */
export async function getTicketMetrics(): Promise<TicketMetrics> {
  const [statusGroups, priorityGroups, overdueCount, resolvedTickets] = await Promise.all([
    prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ['priority'], _count: { _all: true } }),
    prisma.ticket.count({
      where: { slaDueAt: { lt: new Date() }, status: { notIn: [...RESOLVED_STATUSES] } },
    }),
    prisma.ticket.findMany({
      where: { resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
    }),
  ]);

  const statusCount = (status: TicketStatus) =>
    statusGroups.find((g) => g.status === status)?._count._all ?? 0;

  const byPriority = priorityGroups.reduce(
    (acc, g) => ({ ...acc, [g.priority]: g._count._all }),
    { low: 0, normal: 0, high: 0, urgent: 0 } as Record<TicketPriority, number>,
  );

  const resolutionDurations = resolvedTickets
    .filter((t): t is { createdAt: Date; resolvedAt: Date } => t.resolvedAt !== null)
    .map((t) => t.resolvedAt.getTime() - t.createdAt.getTime());
  const avgResolutionMs =
    resolutionDurations.length > 0
      ? resolutionDurations.reduce((a, b) => a + b, 0) / resolutionDurations.length
      : null;

  return {
    totalOpen: statusCount('open'),
    totalPending: statusCount('pending'),
    totalEscalated: statusCount('escalated'),
    totalResolved: statusCount('resolved'),
    totalClosed: statusCount('closed'),
    overdueCount,
    avgResolutionMs,
    byPriority,
  };
}
