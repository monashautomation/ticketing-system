'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

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
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setIsUploading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to prepare upload');
      }
      const { data } = await res.json();
      const putRes = await fetch(data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) throw new Error('Upload to storage failed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(attachmentId: string) {
    await fetch(`/api/attachments/${attachmentId}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="mb-6 rounded-lg border border-neutral-200 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Attachments</h2>
        <label className="cursor-pointer rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-medium hover:bg-neutral-200">
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

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <ul className="divide-y divide-neutral-100">
        {attachments.map((attachment) => (
          <li key={attachment.id} className="flex items-center justify-between py-2 text-sm">
            <a
              href={`/api/attachments/${attachment.id}`}
              className="truncate hover:underline"
            >
              {attachment.fileName}
            </a>
            <div className="flex items-center gap-3 text-neutral-500">
              <span>{formatBytes(attachment.sizeBytes)}</span>
              <span>{attachment.uploadedBy.name}</span>
              {(isAdmin || attachment.uploadedById === currentUserId) && (
                <button
                  onClick={() => handleDelete(attachment.id)}
                  className="text-red-600 hover:underline"
                >
                  Delete
                </button>
              )}
            </div>
          </li>
        ))}
        {attachments.length === 0 && <p className="py-2 text-sm text-neutral-500">No attachments.</p>}
      </ul>
    </div>
  );
}
