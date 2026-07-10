import { prisma } from '@ticketing/db';
import type { RequestUploadInput } from '@ticketing/shared';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import { buildAttachmentKey, deleteObject, getDownloadUrl, getUploadUrl } from '@/lib/storage';

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
}
