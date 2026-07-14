import { randomBytes, createHash } from 'node:crypto';
import { prisma, Prisma } from '@ticketing/db';
import {
  CLOSE_REASON_LABELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
  type CreateInternalTicketInput,
  type CreateMessageInput,
  type CreateTicketInput,
  type SearchToken,
  type TicketPriority,
  type TicketStatus,
  type TicketType,
  type UpdateTicketInput,
} from '@ticketing/shared';
import { AppError, NotFoundError } from '@/lib/errors';
import { writeAuditLog } from '@/server/audit';
import {
  handlePendingTransition,
  notifyReply,
  notifyStatusChanged,
  notifyTicketCreated,
} from '@/server/notifications';
import { publishTicketMessage } from '@/server/ticket-events';

const TICKET_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const DISCORD_CLAIM_TTL_MS = 1000 * 60 * 30; // 30 minutes

export const RESOLVED_STATUSES: readonly TicketStatus[] = ['resolved', 'closed'];

export function isOverdue(ticket: { slaDueAt: Date | null; status: string }): boolean {
  if (!ticket.slaDueAt) return false;
  if (RESOLVED_STATUSES.includes(ticket.status as TicketStatus)) return false;
  return ticket.slaDueAt.getTime() < Date.now();
}

export interface TicketQueueFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  type?: TicketType;
  /** Array form supports multiple `assigned:`/`tag:` search tokens (OR'd together). */
  assigneeId?: string | string[];
  tagId?: string | string[];
  createdById?: string[];
  watcherId?: string[];
  overdueOnly?: boolean;
  /** Free text matched against title/description/message bodies/OCR'd attachment text. */
  search?: string;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

const ACTIVE_STATUS_GROUPS: readonly TicketStatus[] = ['open', 'escalated', 'pending', 'in_progress'];

export function groupTicketsByStatus<T extends { status: string; createdAt: Date; updatedAt: Date }>(
  tickets: T[],
): { active: Record<(typeof ACTIVE_STATUS_GROUPS)[number], T[]>; closedOrResolved: T[] } {
  const active = ACTIVE_STATUS_GROUPS.reduce(
    (acc, status) => ({
      ...acc,
      [status]: tickets
        .filter((t) => t.status === status)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    }),
    {} as Record<(typeof ACTIVE_STATUS_GROUPS)[number], T[]>,
  );

  const closedOrResolved = tickets
    .filter((t) => RESOLVED_STATUSES.includes(t.status as TicketStatus))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return { active, closedOrResolved };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Always scoped to tickets the user submitted or is cc'd on -- admins included. Admins reach
 * every ticket through listTicketsForAdminQueue (the separate admin queue page), never here.
 */
export async function listTicketsForUser(userId: string) {
  return prisma.ticket.findMany({
    where: { OR: [{ createdById: userId }, { watchers: { some: { id: userId } } }] },
    orderBy: { updatedAt: 'desc' },
    include: { createdBy: true, assignees: true, tags: true, watchers: true },
  });
}

/** Full admin queue: every ticket, with filters. Callers must gate this behind requireAdmin(). */
export async function listTicketsForAdminQueue(filters: TicketQueueFilters = {}) {
  const where: Prisma.TicketWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.type) where.type = filters.type;

  const assigneeIds = toArray(filters.assigneeId);
  if (assigneeIds.length > 0) where.assignees = { some: { id: { in: assigneeIds } } };

  const tagIds = toArray(filters.tagId);
  if (tagIds.length > 0) where.tags = { some: { id: { in: tagIds } } };

  if (filters.createdById && filters.createdById.length > 0) {
    where.createdById = { in: filters.createdById };
  }
  if (filters.watcherId && filters.watcherId.length > 0) {
    where.watchers = { some: { id: { in: filters.watcherId } } };
  }

  if (filters.overdueOnly) {
    where.slaDueAt = { lt: new Date() };
    where.status = { notIn: [...RESOLVED_STATUSES] };
  }

  // Free text is matched via the search_vector column (title/description/message bodies/OCR'd
  // attachment text, maintained by Postgres triggers -- see the tickets_search_vector migration)
  // rather than a Prisma `where` clause, since ts_rank ordering has to win over updatedAt.
  let rankedIds: string[] | null = null;
  if (filters.search) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "tickets"
      WHERE "searchVector" @@ websearch_to_tsquery('english', ${filters.search})
      ORDER BY ts_rank("searchVector", websearch_to_tsquery('english', ${filters.search})) DESC
    `;
    rankedIds = rows.map((r) => r.id);
    if (rankedIds.length === 0) return [];
    where.id = { in: rankedIds };
  }

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: rankedIds ? undefined : { updatedAt: 'desc' },
    include: { createdBy: true, assignees: true, tags: true, watchers: true },
  });

  if (!rankedIds) return tickets;

  const rank = new Map(rankedIds.map((id, index) => [id, index]));
  return [...tickets].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

/** Resolves a `submitter:`/`cced:` token value (name or email substring) to matching user ids. */
async function resolveUserIdsBySubstring(query: string): Promise<string[]> {
  const matches = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });
  return matches.map((u) => u.id);
}

/** Resolves an `assigned:` token value to matching admin user ids (assignees are always admins). */
async function resolveAssigneeIdsBySubstring(query: string): Promise<string[]> {
  const matches = await prisma.user.findMany({
    where: { role: 'admin', name: { contains: query, mode: 'insensitive' } },
    select: { id: true },
  });
  return matches.map((u) => u.id);
}

/** Resolves a `tag:` token value to matching tag ids. */
async function resolveTagIdsByName(query: string): Promise<string[]> {
  const matches = await prisma.tag.findMany({
    where: { name: { contains: query, mode: 'insensitive' } },
    select: { id: true },
  });
  return matches.map((t) => t.id);
}

/**
 * Converts parsed `key:value` search tokens (see `parseSearchQuery` in @ticketing/shared) into
 * `TicketQueueFilters`, resolving name-ish tokens (submitter/cced/assigned/tag) to real ids.
 * Multiple tokens of the same type accumulate (OR'd via the `some.id.in` clauses above);
 * `status`/`priority`/`type` tokens must exactly match a known value or are silently ignored.
 */
export async function resolveSearchTokensToFilters(
  tokens: SearchToken[],
): Promise<Partial<TicketQueueFilters>> {
  const filters: Partial<TicketQueueFilters> = {};

  for (const token of tokens) {
    switch (token.type) {
      case 'submitter': {
        const ids = await resolveUserIdsBySubstring(token.value);
        filters.createdById = [...(filters.createdById ?? []), ...ids];
        break;
      }
      case 'cced': {
        const ids = await resolveUserIdsBySubstring(token.value);
        filters.watcherId = [...(filters.watcherId ?? []), ...ids];
        break;
      }
      case 'assigned': {
        const ids = await resolveAssigneeIdsBySubstring(token.value);
        filters.assigneeId = [...toArray(filters.assigneeId), ...ids];
        break;
      }
      case 'tag': {
        const ids = await resolveTagIdsByName(token.value);
        filters.tagId = [...toArray(filters.tagId), ...ids];
        break;
      }
      case 'status':
        if ((TICKET_STATUSES as readonly string[]).includes(token.value)) {
          filters.status = token.value as TicketStatus;
        }
        break;
      case 'priority':
        if ((TICKET_PRIORITIES as readonly string[]).includes(token.value)) {
          filters.priority = token.value as TicketPriority;
        }
        break;
      case 'type':
        if ((TICKET_TYPES as readonly string[]).includes(token.value)) {
          filters.type = token.value as TicketType;
        }
        break;
    }
  }

  return filters;
}

export async function getTicketOr404(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      createdBy: true,
      assignees: true,
      tags: true,
      watchers: true,
      attachments: { orderBy: { createdAt: 'asc' }, include: { uploadedBy: true } },
      messages: { orderBy: { createdAt: 'asc' }, include: { author: true } },
    },
  });
  if (!ticket) throw new NotFoundError('Ticket not found');
  return ticket;
}

export function canViewTicket(
  ticket: { createdById: string; assignees?: { id: string }[]; watchers?: { id: string }[] },
  user: { id: string; role: 'user' | 'admin' } | null,
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return (
    ticket.createdById === user.id ||
    (ticket.assignees ?? []).some((a) => a.id === user.id) ||
    (ticket.watchers ?? []).some((w) => w.id === user.id)
  );
}

export async function verifyTicketToken(ticketId: string, token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const record = await prisma.ticketAccessToken.findUnique({ where: { tokenHash } });
  if (!record || record.ticketId !== ticketId) return false;
  if (record.expiresAt < new Date()) return false;
  return true;
}

export async function createTicket(
  userId: string,
  actorRole: 'user' | 'admin',
  input: CreateTicketInput,
) {
  const ccUserIds = input.ccUserIds ?? [];
  if (ccUserIds.includes(userId)) {
    throw new AppError('Cannot cc yourself on a ticket');
  }
  if (ccUserIds.length > 0) {
    const ccUsers = await prisma.user.findMany({ where: { id: { in: ccUserIds } } });
    if (ccUsers.length !== ccUserIds.length) throw new AppError('One or more CC users not found');
  }

  const assigneeIds = input.assigneeIds ?? [];
  if (assigneeIds.length > 0) {
    if (actorRole !== 'admin') {
      throw new AppError('Only admins can assign a ticket at creation time');
    }
    const assignees = await prisma.user.findMany({ where: { id: { in: assigneeIds } } });
    if (assignees.length !== assigneeIds.length || assignees.some((a) => a.role !== 'admin')) {
      throw new AppError('Tickets can only be assigned to admins');
    }
  }

  const ticket = await prisma.ticket.create({
    data: {
      title: input.title,
      description: input.description,
      priority: input.priority,
      type: input.type,
      createdById: userId,
      watchers: ccUserIds.length > 0 ? { connect: ccUserIds.map((id) => ({ id })) } : undefined,
      assignees:
        assigneeIds.length > 0 ? { connect: assigneeIds.map((id) => ({ id })) } : undefined,
    },
    include: { watchers: true, assignees: true },
  });

  await writeAuditLog(userId, 'ticket.create', 'Ticket', ticket.id, input as Prisma.InputJsonValue);

  return ticket;
}

/**
 * Creates a ticket from a Discord interaction. Auto-links to an existing user by discordId.
 * Unlinked Discord users get a Discord-only placeholder owner and a claim link that, once they
 * sign in with Authentik, silently attaches their discordId to their real account (see
 * claimDiscordAccount). Already-linked users get a direct token URL -- no login required.
 */
export async function createTicketFromDiscord(input: CreateInternalTicketInput, baseUrl: string) {
  const existingUser = await prisma.user.findUnique({ where: { discordId: input.discordUserId } });

  const owner =
    existingUser ??
    (await prisma.user.create({
      data: {
        email: `discord-${input.discordUserId}@placeholder.invalid`,
        name: input.discordUsername,
        discordId: input.discordUserId,
        emailVerified: false,
        isDiscordPlaceholder: true,
      },
    }));

  const ticket = await prisma.ticket.create({
    data: {
      title: input.title,
      description: input.description,
      priority: input.priority,
      type: input.type,
      createdById: owner.id,
      discordChannelId: input.discordChannelId,
    },
  });

  await writeAuditLog(null, 'ticket.create', 'Ticket', ticket.id, {
    source: 'discord',
    discordUserId: input.discordUserId,
  });

  if (owner.isDiscordPlaceholder) {
    const rawClaimToken = randomBytes(32).toString('hex');
    await prisma.discordClaim.upsert({
      where: { placeholderUserId: owner.id },
      create: {
        placeholderUserId: owner.id,
        tokenHash: hashToken(rawClaimToken),
        ticketId: ticket.id,
        expiresAt: new Date(Date.now() + DISCORD_CLAIM_TTL_MS),
      },
      update: {
        tokenHash: hashToken(rawClaimToken),
        ticketId: ticket.id,
        expiresAt: new Date(Date.now() + DISCORD_CLAIM_TTL_MS),
      },
    });

    const claimPath = `/link-discord/claim?token=${rawClaimToken}`;
    await notifyTicketCreated({ id: ticket.id, createdBy: owner }, `${baseUrl}${claimPath}`);

    return {
      ticket,
      path: claimPath,
      isNewUser: !existingUser,
    };
  }

  const rawToken = randomBytes(32).toString('hex');
  await prisma.ticketAccessToken.create({
    data: {
      ticketId: ticket.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TICKET_TOKEN_TTL_MS),
    },
  });

  const tokenPath = `/t/${ticket.id}?token=${rawToken}`;
  await notifyTicketCreated({ id: ticket.id, createdBy: owner }, `${baseUrl}${tokenPath}`);

  return {
    ticket,
    path: tokenPath,
    isNewUser: !existingUser,
  };
}

/**
 * Read-only lookup for the claim confirmation screen -- never mutates. Lets the signed-in user
 * see which Discord account they're about to link before claimDiscordAccount is ever called.
 */
export async function previewDiscordClaim(token: string) {
  const claim = await prisma.discordClaim.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { placeholderUser: true },
  });
  if (!claim || claim.expiresAt < new Date()) return null;

  const ticket = await prisma.ticket.findUnique({ where: { id: claim.ticketId } });
  return {
    discordUsername: claim.placeholderUser.name,
    ticketTitle: ticket?.title ?? 'your ticket',
  };
}

/**
 * Consumes a Discord claim token for the signed-in user: reassigns everything the placeholder
 * owned to the real account, sets discordId on the real account, and deletes the placeholder.
 * Safe to call again with the same token from the same real user (e.g. a duplicate redirect).
 *
 * Only call this from an explicit, user-confirmed POST/Server Action -- never from a page GET.
 * The claim token alone isn't proof of intent: anyone who has it (e.g. the Discord user it was
 * issued to) could get a signed-in victim to open it via a plain link and silently link their
 * own discordId onto the victim's account. The confirmation screen in the claim page is the
 * actual CSRF defense; this function just does the write once the user has agreed.
 */
export async function claimDiscordAccount(token: string, realUserId: string) {
  const tokenHash = hashToken(token);
  const claim = await prisma.discordClaim.findUnique({
    where: { tokenHash },
    include: { placeholderUser: true },
  });
  if (!claim || claim.expiresAt < new Date()) {
    throw new AppError('This link has expired. Open a new ticket from Discord to get a fresh one.');
  }

  const placeholder = claim.placeholderUser;
  if (placeholder.id === realUserId) {
    // Already claimed by this exact session (e.g. a page refresh); nothing left to do.
    await prisma.discordClaim.delete({ where: { id: claim.id } }).catch(() => {});
    return { ticketId: claim.ticketId };
  }

  const realUser = await prisma.user.findUnique({ where: { id: realUserId } });
  if (!realUser) throw new NotFoundError('User not found');

  if (realUser.discordId && realUser.discordId !== placeholder.discordId) {
    throw new AppError('Your account is already linked to a different Discord user');
  }

  // Reassign ownership and delete the placeholder before writing discordId onto realUser --
  // discordId is unique, so both rows can't hold the same value at once mid-transaction.
  await prisma.$transaction([
    prisma.ticket.updateMany({
      where: { createdById: placeholder.id },
      data: { createdById: realUserId },
    }),
    prisma.ticketMessage.updateMany({
      where: { authorId: placeholder.id },
      data: { authorId: realUserId },
    }),
    prisma.ticketAttachment.updateMany({
      where: { uploadedById: placeholder.id },
      data: { uploadedById: realUserId },
    }),
    prisma.user.delete({ where: { id: placeholder.id } }),
    prisma.user.update({
      where: { id: realUserId },
      data: { discordId: placeholder.discordId },
    }),
  ]);

  await writeAuditLog(realUserId, 'discord.claim', 'User', realUserId, {
    placeholderUserId: placeholder.id,
    discordId: placeholder.discordId,
  });

  return { ticketId: claim.ticketId };
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
  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date() },
    include: { watchers: true, assignees: true, createdBy: true },
  });

  // Internal notes are admin-only, so the ticket owner/watchers must never be notified of them.
  if (!input.isInternalNote) {
    // Deferred import: keeps env.ts's required-var validation out of the module load path for
    // pure-function unit tests that never call addMessage.
    const { env } = await import('@/lib/env');
    await notifyReply(ticket, authorId, env.publicAppUrl);
  }

  return message;
}

function buildResolutionSystemMessage(
  status: TicketStatus,
  closeReason: UpdateTicketInput['closeReason'],
  resolutionMessage: UpdateTicketInput['resolutionMessage'],
): string {
  if (status === 'closed') {
    const reasonLabel = closeReason ? CLOSE_REASON_LABELS[closeReason] : 'No reason given';
    return resolutionMessage
      ? `Ticket closed: ${reasonLabel}: ${resolutionMessage}`
      : `Ticket closed: ${reasonLabel}`;
  }
  return `Ticket resolved: ${resolutionMessage ?? 'No reason given'}`;
}

export async function updateTicket(ticketId: string, input: UpdateTicketInput, actorId: string) {
  const previous = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { status: true },
  });
  if (!previous) throw new NotFoundError('Ticket not found');

  const data: Prisma.TicketUpdateInput = {};

  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;

  if (input.status) {
    data.status = input.status;
    data.resolvedAt = RESOLVED_STATUSES.includes(input.status) ? new Date() : null;
  }
  if (input.priority) data.priority = input.priority;
  if (input.type) data.type = input.type;

  if (input.assigneeIds !== undefined) {
    if (input.assigneeIds.length > 0) {
      const assignees = await prisma.user.findMany({ where: { id: { in: input.assigneeIds } } });
      if (assignees.length !== input.assigneeIds.length || assignees.some((a) => a.role !== 'admin')) {
        throw new AppError('Tickets can only be assigned to admins');
      }
    }
    data.assignees = { set: input.assigneeIds.map((id) => ({ id })) };
  }

  if (input.slaDueAt !== undefined) {
    data.slaDueAt = input.slaDueAt ? new Date(input.slaDueAt) : null;
    // A new/pushed-out deadline invalidates any prior breach alert dedupe stamp.
    data.slaBreachNotifiedAt = null;
  }

  if (input.tagIds !== undefined) {
    data.tags = { set: input.tagIds.map((id) => ({ id })) };
  }

  if (input.watcherIds !== undefined) {
    data.watchers = { set: input.watcherIds.map((id) => ({ id })) };
  }

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data,
    include: { tags: true, assignees: true, createdBy: true, watchers: true },
  });

  await writeAuditLog(actorId, 'ticket.update', 'Ticket', ticketId, input as Prisma.InputJsonValue);

  if (input.status && input.status !== previous.status) {
    if (RESOLVED_STATUSES.includes(input.status)) {
      const systemMessage = await prisma.ticketMessage.create({
        data: {
          ticketId,
          authorId: actorId,
          isSystemMessage: true,
          body: buildResolutionSystemMessage(input.status, input.closeReason, input.resolutionMessage),
        },
      });
      publishTicketMessage({ ticketId, messageId: systemMessage.id });
    } else if (RESOLVED_STATUSES.includes(previous.status as TicketStatus)) {
      const systemMessage = await prisma.ticketMessage.create({
        data: {
          ticketId,
          authorId: actorId,
          isSystemMessage: true,
          body: 'Ticket reopened',
        },
      });
      publishTicketMessage({ ticketId, messageId: systemMessage.id });
    }
    // Deferred import: keeps env.ts's required-var validation out of the module load path for
    // pure-function unit tests (canViewTicket, isOverdue) that never call updateTicket.
    const { env } = await import('@/lib/env');
    await notifyStatusChanged(ticket, input.status, actorId, env.publicAppUrl);
    await handlePendingTransition(ticket, previous.status, env.publicAppUrl);
  }

  return ticket;
}

export interface TicketMetrics {
  totalOpen: number;
  totalPending: number;
  totalEscalated: number;
  totalInProgress: number;
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
    totalInProgress: statusCount('in_progress'),
    totalResolved: statusCount('resolved'),
    totalClosed: statusCount('closed'),
    overdueCount,
    avgResolutionMs,
    byPriority,
  };
}
