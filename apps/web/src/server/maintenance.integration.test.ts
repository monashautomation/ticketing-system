import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@ticketing/db';
import { resetDatabase } from '@/test/db';
import {
  createManualMaintenanceEvent,
  handleUptimeKumaWebhook,
  listPublicMaintenanceEvents,
} from './maintenance';

beforeEach(async () => {
  await resetDatabase();
});

describe('handleUptimeKumaWebhook', () => {
  it('opens a new in_progress event on a down heartbeat', async () => {
    const event = await handleUptimeKumaWebhook({
      monitor: { id: 1, name: 'API' },
      heartbeat: { status: 0, msg: 'connection refused' },
    });

    expect(event?.status).toBe('in_progress');
    expect(event?.source).toBe('uptime_kuma');
    expect(event?.kumaMonitorId).toBe('1');
  });

  it('does not open a second event while one is already open for the same monitor', async () => {
    await handleUptimeKumaWebhook({ monitor: { id: 2, name: 'DB' }, heartbeat: { status: 0 } });
    await handleUptimeKumaWebhook({ monitor: { id: 2, name: 'DB' }, heartbeat: { status: 0 } });

    const events = await prisma.maintenanceEvent.findMany({ where: { kumaMonitorId: '2' } });
    expect(events).toHaveLength(1);
  });

  it('resolves the open event on the matching up heartbeat', async () => {
    await handleUptimeKumaWebhook({ monitor: { id: 3, name: 'Web' }, heartbeat: { status: 0 } });
    const resolved = await handleUptimeKumaWebhook({
      monitor: { id: 3, name: 'Web' },
      heartbeat: { status: 1 },
    });

    expect(resolved?.status).toBe('resolved');
    expect(resolved?.endAt).not.toBeNull();
  });

  it('returns null for an up heartbeat when there was nothing open', async () => {
    const result = await handleUptimeKumaWebhook({
      monitor: { id: 4, name: 'Idle' },
      heartbeat: { status: 1 },
    });
    expect(result).toBeNull();
  });

  it('opens a fresh event for the same monitor after a prior incident resolved', async () => {
    await handleUptimeKumaWebhook({ monitor: { id: 5, name: 'Flaky' }, heartbeat: { status: 0 } });
    await handleUptimeKumaWebhook({ monitor: { id: 5, name: 'Flaky' }, heartbeat: { status: 1 } });
    await handleUptimeKumaWebhook({ monitor: { id: 5, name: 'Flaky' }, heartbeat: { status: 0 } });

    const events = await prisma.maintenanceEvent.findMany({ where: { kumaMonitorId: '5' } });
    expect(events).toHaveLength(2);
    expect(events.filter((e) => e.status === 'in_progress')).toHaveLength(1);
  });
});

describe('createManualMaintenanceEvent + listPublicMaintenanceEvents', () => {
  it('lists manual events alongside kuma-sourced ones, newest first', async () => {
    await createManualMaintenanceEvent({
      title: 'Planned upgrade',
      body: 'Upgrading DB',
      startAt: new Date('2026-01-01T00:00:00Z'),
    });
    await handleUptimeKumaWebhook({ monitor: { id: 9, name: 'Cache' }, heartbeat: { status: 0 } });

    const events = await listPublicMaintenanceEvents();
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.source).sort()).toEqual(['manual', 'uptime_kuma']);
  });
});
