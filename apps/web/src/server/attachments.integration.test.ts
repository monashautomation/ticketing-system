import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@ticketing/db';
import { resetDatabase, createTestUser } from '@/test/db';
import { cleanupExpiredAttachments, requestAttachmentUpload } from './attachments';
import { createTicket, updateTicket } from './tickets';

beforeEach(async () => {
  await resetDatabase();
});

const THIRTY_ONE_DAYS_AGO = new Date(Date.now() - 1000 * 60 * 60 * 24 * 31);
const TEN_DAYS_AGO = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);

describe('cleanupExpiredAttachments', () => {
  it('deletes attachments on tickets resolved more than 30 days ago, leaves recent ones', async () => {
    const owner = await createTestUser();

    const oldTicket = await createTicket(owner.id, 'user', {
      title: 'Old resolved ticket',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });
    await updateTicket(oldTicket.id, { status: 'resolved' }, owner.id);
    await prisma.ticket.update({ where: { id: oldTicket.id }, data: { resolvedAt: THIRTY_ONE_DAYS_AGO } });
    await requestAttachmentUpload(oldTicket.id, owner.id, {
      fileName: 'old.txt',
      mimeType: 'text/plain',
      sizeBytes: 10,
    });

    const recentTicket = await createTicket(owner.id, 'user', {
      title: 'Recently resolved ticket',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });
    await updateTicket(recentTicket.id, { status: 'resolved' }, owner.id);
    await prisma.ticket.update({ where: { id: recentTicket.id }, data: { resolvedAt: TEN_DAYS_AGO } });
    await requestAttachmentUpload(recentTicket.id, owner.id, {
      fileName: 'recent.txt',
      mimeType: 'text/plain',
      sizeBytes: 10,
    });

    const openTicket = await createTicket(owner.id, 'user', {
      title: 'Still open',
      description: 'x',
      priority: 'normal',
      type: 'other',
    });
    await requestAttachmentUpload(openTicket.id, owner.id, {
      fileName: 'open.txt',
      mimeType: 'text/plain',
      sizeBytes: 10,
    });

    const result = await cleanupExpiredAttachments();
    expect(result.deleted).toBe(1);

    const remaining = await prisma.ticketAttachment.findMany({ orderBy: { fileName: 'asc' } });
    expect(remaining.map((a) => a.fileName)).toEqual(['open.txt', 'recent.txt']);
  });

  it('is a no-op when there are no expired attachments', async () => {
    const result = await cleanupExpiredAttachments();
    expect(result.deleted).toBe(0);
  });
});
