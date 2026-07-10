import { prisma } from '@ticketing/db';
import type { UptimeKumaWebhookInput } from '@ticketing/shared';

export async function listPublicMaintenanceEvents() {
  return prisma.maintenanceEvent.findMany({
    orderBy: { startAt: 'desc' },
    take: 50,
  });
}

export async function createManualMaintenanceEvent(input: {
  title: string;
  body: string;
  startAt: Date;
  endAt?: Date;
}) {
  return prisma.maintenanceEvent.create({
    data: {
      title: input.title,
      body: input.body,
      startAt: input.startAt,
      endAt: input.endAt,
      source: 'manual',
      status: 'scheduled',
    },
  });
}

/**
 * Handles an Uptime Kuma webhook notification. Kuma sends heartbeat.status
 * 0 = down, 1 = up. We open a maintenance event on down, resolve it on the
 * matching monitor's next up.
 */
export async function handleUptimeKumaWebhook(payload: UptimeKumaWebhookInput) {
  const kumaMonitorId = String(payload.monitor.id);
  const isDown = payload.heartbeat.status === 0;

  if (isDown) {
    const openEvent = await prisma.maintenanceEvent.findFirst({
      where: { kumaMonitorId, status: { in: ['scheduled', 'in_progress'] } },
    });
    if (openEvent) return openEvent;

    return prisma.maintenanceEvent.create({
      data: {
        title: `${payload.monitor.name} is down`,
        body: payload.heartbeat.msg ?? 'Monitor reported a failed check.',
        status: 'in_progress',
        startAt: new Date(),
        source: 'uptime_kuma',
        kumaMonitorId,
      },
    });
  }

  const openEvent = await prisma.maintenanceEvent.findFirst({
    where: { kumaMonitorId, status: { in: ['scheduled', 'in_progress'] } },
    orderBy: { startAt: 'desc' },
  });
  if (!openEvent) return null;

  return prisma.maintenanceEvent.update({
    where: { id: openEvent.id },
    data: { status: 'resolved', endAt: new Date() },
  });
}
