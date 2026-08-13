import { prisma } from '@ticketing/db';
import type { RequestUploadInput } from '@ticketing/shared';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import { buildAttachmentKey, deleteObject, getDownloadUrl, getUploadUrl } from '@/lib/storage';
import { writeAuditLog } from '@/server/audit';
import { notifyAttachmentAdded } from '@/server/notifications';

const ATTACHMENT_RETENTION_MS = 1000 * 60 * 60 * 24 * 30;

export async function requestAttachmentUpload(
  ticketId: string,
  uploadedById: string,
  input: RequestUploadInput,
) {
  const storageKey = buildAttachmentKey(ticketId, input.fileName);
  const uploadUrl = await getUploadUrl(storageKey, input.mimeType);

  const attachment = await prisma.ticketAttachment.create({
    data: {
      ticketId,
      uploadedById,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storageKey,
    },
  });

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { watchers: true, assignees: true, createdBy: true },
  });
  if (ticket) {
    // Deferred import: keeps env.ts's required-var validation out of the module load path for
    // tests that never call requestAttachmentUpload (same tradeoff as tickets.ts's addMessage).
    const { env } = await import('@/lib/env');
    await notifyAttachmentAdded(ticket, uploadedById, env.publicAppUrl);
  }

  return { attachment, uploadUrl };
}

export async function getAttachmentDownloadUrl(attachmentId: string) {
  const attachment = await prisma.ticketAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) throw new NotFoundError('Attachment not found');
  const url = await getDownloadUrl(attachment.storageKey, attachment.fileName);
  return { attachment, url };
}

export async function deleteAttachment(
  attachmentId: string,
  actor: { id: string; role: 'user' | 'admin' },
) {
  const attachment = await prisma.ticketAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) throw new NotFoundError('Attachment not found');
  if (actor.role !== 'admin' && attachment.uploadedById !== actor.id) {
    throw new ForbiddenError();
  }
  await deleteObject(attachment.storageKey);
  await prisma.ticketAttachment.delete({ where: { id: attachmentId } });

  await writeAuditLog(actor.id, 'attachment.delete', 'TicketAttachment', attachmentId, {
    ticketId: attachment.ticketId,
    fileName: attachment.fileName,
  });
}

/** Deletes attachments on tickets that have been resolved/closed for 30+ days. */
export async function cleanupExpiredAttachments(): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - ATTACHMENT_RETENTION_MS);
  const expired = await prisma.ticketAttachment.findMany({
    where: { ticket: { resolvedAt: { lt: cutoff } } },
  });

  for (const attachment of expired) {
    await deleteObject(attachment.storageKey);
  }
  if (expired.length > 0) {
    await prisma.ticketAttachment.deleteMany({ where: { id: { in: expired.map((a) => a.id) } } });
  }

  return { deleted: expired.length };
}
