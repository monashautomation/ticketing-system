import { createWorker } from 'tesseract.js';
import { prisma } from '@ticketing/db';
import { getObjectBuffer } from '@/lib/storage';
import { logger } from '@/lib/logger';

/** Mime types Tesseract handles well. Everything else (PDFs, non-images, etc.) is skipped. */
const OCR_ELIGIBLE_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const;

// Gives the direct-to-S3 client upload time to land before the sweep tries to fetch bytes for
// a freshly-created attachment row.
const OCR_MIN_AGE_MS = 1000 * 60 * 2;

// Bounds how many images one sweep run OCRs -- each recognize() call takes real wall-clock
// time, and this runs on the same process serving requests (see instrumentation.ts).
const OCR_BATCH_SIZE = 20;

export function isOcrEligibleMimeType(mimeType: string): boolean {
  return (OCR_ELIGIBLE_MIMES as readonly string[]).includes(mimeType);
}

/** Returns null for ineligible mime types or when no text was found. */
export async function extractImageText(buffer: Buffer, mimeType: string): Promise<string | null> {
  if (!isOcrEligibleMimeType(mimeType)) return null;

  const worker = await createWorker('eng');
  try {
    const {
      data: { text },
    } = await worker.recognize(buffer);
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : null;
  } finally {
    await worker.terminate();
  }
}

/**
 * Background sweep: OCRs image attachments that haven't been processed yet. Writing ocrText
 * fires the ticket_attachments search_vector trigger (see the migration), so there's no
 * separate reindex step here.
 */
export async function processPendingAttachmentOcr(): Promise<{ processed: number }> {
  const cutoff = new Date(Date.now() - OCR_MIN_AGE_MS);
  const attachments = await prisma.ticketAttachment.findMany({
    where: {
      ocrProcessedAt: null,
      mimeType: { in: [...OCR_ELIGIBLE_MIMES] },
      createdAt: { lt: cutoff },
    },
    take: OCR_BATCH_SIZE,
  });

  for (const attachment of attachments) {
    try {
      const buffer = await getObjectBuffer(attachment.storageKey);
      const text = await extractImageText(buffer, attachment.mimeType);
      await prisma.ticketAttachment.update({
        where: { id: attachment.id },
        data: { ocrText: text, ocrProcessedAt: new Date() },
      });
    } catch (error) {
      logger.error(`OCR failed for attachment ${attachment.id}`, error);
      // Stamp anyway -- a permanently missing/corrupt object shouldn't be retried forever.
      await prisma.ticketAttachment.update({
        where: { id: attachment.id },
        data: { ocrProcessedAt: new Date() },
      });
    }
  }

  return { processed: attachments.length };
}
