import { prisma, type Prisma } from '@ticketing/db';

export interface TicketHistoryEntryInput {
  field: Prisma.TicketHistoryCreateManyInput['field'];
  action: Prisma.TicketHistoryCreateManyInput['action'];
  fromValue?: string | null;
  toValue?: string | null;
}

/** actorId is null for system-initiated changes (e.g. attachment cleanup sweeps). */
export async function recordTicketHistory(
  ticketId: string,
  actorId: string | null,
  entries: TicketHistoryEntryInput[],
): Promise<void> {
  if (entries.length === 0) return;
  await prisma.ticketHistory.createMany({
    data: entries.map((entry) => ({
      ticketId,
      actorId,
      field: entry.field,
      action: entry.action,
      fromValue: entry.fromValue ?? null,
      toValue: entry.toValue ?? null,
    })),
  });
}
