import { prisma, Prisma } from '@ticketing/db';

/** actorId is null for system-initiated actions (e.g. the Discord bot creating a ticket). */
export async function writeAuditLog(
  actorId: string | null,
  action: string,
  targetType: string,
  targetId: string,
  meta?: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.auditLog.create({
    data: { actorId, action, targetType, targetId, meta },
  });
}
