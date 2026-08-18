import { prisma } from '@ticketing/db';
import type { TicketGroupInput } from '@ticketing/shared';
import { AppError } from '@/lib/errors';
import { writeAuditLog } from '@/server/audit';

export async function listTicketGroups() {
  return prisma.ticketGroup.findMany({ orderBy: { name: 'asc' } });
}

/** Groups the given user belongs to, via their live Authentik-derived membership. */
export async function listTicketGroupsForUser(userId: string) {
  return prisma.ticketGroup.findMany({
    where: { members: { some: { id: userId } } },
    orderBy: { name: 'asc' },
  });
}

async function assertUniqueName(name: string, excludeId?: string): Promise<void> {
  const existing = await prisma.ticketGroup.findUnique({ where: { name } });
  if (existing && existing.id !== excludeId) throw new AppError('A group with that name already exists');
}

/** Callers must gate this behind requireAdmin(). */
export async function createTicketGroup(input: TicketGroupInput, actorId: string) {
  await assertUniqueName(input.name);
  const group = await prisma.ticketGroup.create({
    data: {
      name: input.name,
      authentikGroupNames: input.authentikGroupNames,
      announcementChannelId: input.announcementChannelId,
      unassignedBacklogChannelId: input.unassignedBacklogChannelId,
    },
  });
  await syncMembersForGroup(group.id, input.authentikGroupNames);
  await writeAuditLog(actorId, 'ticket_group.create', 'TicketGroup', group.id, { ...input });
  return group;
}

/** Callers must gate this behind requireAdmin(). */
export async function updateTicketGroup(groupId: string, input: TicketGroupInput, actorId: string) {
  await assertUniqueName(input.name, groupId);
  const group = await prisma.ticketGroup.update({
    where: { id: groupId },
    data: {
      name: input.name,
      authentikGroupNames: input.authentikGroupNames,
      announcementChannelId: input.announcementChannelId,
      unassignedBacklogChannelId: input.unassignedBacklogChannelId,
    },
  });
  await syncMembersForGroup(group.id, input.authentikGroupNames);
  await writeAuditLog(actorId, 'ticket_group.update', 'TicketGroup', group.id, { ...input });
  return group;
}

/** Callers must gate this behind requireAdmin(). Blocked if any ticket still references the group. */
export async function deleteTicketGroup(groupId: string, actorId: string) {
  const ticketCount = await prisma.ticket.count({ where: { groupId } });
  if (ticketCount > 0) {
    throw new AppError(`Cannot delete: ${ticketCount} ticket(s) are still assigned to this group. Reassign them first.`);
  }
  const group = await prisma.ticketGroup.delete({ where: { id: groupId } });
  await writeAuditLog(actorId, 'ticket_group.delete', 'TicketGroup', groupId, { name: group.name });
}

/** Recomputes one group's members from the current User.authentikGroups snapshot (immediate feedback on save, ahead of the next sync cycle). */
async function syncMembersForGroup(groupId: string, authentikGroupNames: string[]): Promise<void> {
  const users = await prisma.user.findMany({
    where: { isDiscordPlaceholder: false, authentikGroups: { hasSome: authentikGroupNames } },
    select: { id: true },
  });
  await prisma.ticketGroup.update({
    where: { id: groupId },
    data: { members: { set: users.map((u) => ({ id: u.id })) } },
  });
}
