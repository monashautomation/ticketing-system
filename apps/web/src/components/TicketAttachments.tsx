'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Loader2, Paperclip, Trash2, Upload } from 'lucide-react';
import { buttonGhost, cardTight, errorText, mutedText } from '@/lib/styles';
import { uploadAttachment } from '@/lib/uploadAttachment';

interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  uploadedBy: { name: string };
}

interface TicketAttachmentsProps {
  ticketId: string;
  attachments: Attachment[];
  currentUserId: string;
  isAdmin: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TicketAttachments({
  ticketId,
  attachments,
  currentUserId,
  isAdmin,
}: TicketAttachmentsProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setIsUploading(true);
    setError(null);
    try {
      await uploadAttachment(ticketId, file);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(attachmentId: string) {
    setDeletingId(attachmentId);
    setError(null);
    try {
      const res = await fetch(`/api/attachments/${attachmentId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to delete attachment');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete attachment');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={`${cardTight} mb-6`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-text">
          <Paperclip className="h-4 w-4 text-text-tertiary" />
          Attachments
        </h2>
        <label
          className={`${buttonGhost} cursor-pointer gap-1.5 border border-border transition-all hover:-translate-y-0.5`}
        >
          {isUploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {isUploading ? 'Uploading…' : 'Upload file'}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            disabled={isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
        </label>
      </div>

      {error && <p className={`mb-2 ${errorText}`}>{error}</p>}

      <ul className="divide-y divide-border">
        {attachments.map((attachment, index) => {
          const isDeleting = deletingId === attachment.id;
          return (
            <li
              key={attachment.id}
              className="animate-fade-in-up flex items-center justify-between py-2 text-sm"
              style={{ animationDelay: `${Math.min(index, 8) * 25}ms` }}
            >
              <a
                href={`/api/attachments/${attachment.id}`}
                className="truncate text-text transition-colors hover:text-accent"
              >
                {attachment.fileName}
              </a>
              <div className="flex items-center gap-3 text-text-secondary">
                <span>{formatBytes(attachment.sizeBytes)}</span>
                <span>{attachment.uploadedBy.name}</span>
                {(isAdmin || attachment.uploadedById === currentUserId) && (
                  <button
                    onClick={() => handleDelete(attachment.id)}
                    disabled={isDeleting}
                    aria-label={`Delete ${attachment.fileName}`}
                    className="inline-flex items-center gap-1 text-danger transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {attachments.length === 0 && <p className={`py-2 ${mutedText}`}>No attachments.</p>}
      </ul>
    </div>
  );
}
