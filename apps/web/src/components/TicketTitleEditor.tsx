'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { buttonGhost, buttonPrimary, input, mutedText, pageTitle } from '@/lib/styles';

interface TicketTitleEditorProps {
  ticketId: string;
  initialTitle: string;
  initialDescription: string;
}

export function TicketTitleEditor({
  ticketId,
  initialTitle,
  initialDescription,
}: TicketTitleEditorProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);

  function cancel() {
    setTitle(initialTitle);
    setDescription(initialDescription);
    setIsEditing(false);
  }

  async function save() {
    setIsSaving(true);
    await fetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    });
    setIsSaving(false);
    setIsEditing(false);
    router.refresh();
  }

  if (isEditing) {
    return (
      <div className="flex w-full animate-fade-in-up flex-col gap-2">
        <input
          className={`${input} text-base font-semibold`}
          value={title}
          disabled={isSaving}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <textarea
          className={`${input} resize-y`}
          rows={3}
          value={description}
          disabled={isSaving}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={buttonPrimary}
            disabled={isSaving || title.trim().length < 3 || description.trim().length === 0}
            onClick={save}
          >
            <Check className="mr-1.5 h-4 w-4" />
            Save
          </button>
          <button type="button" className={buttonGhost} disabled={isSaving} onClick={cancel}>
            <X className="mr-1.5 h-4 w-4" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-2">
      <div>
        <h1 className={pageTitle}>{title}</h1>
        <p className={`mt-1 ${mutedText}`}>{description}</p>
      </div>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        aria-label="Edit ticket title and description"
        className="mt-0.5 rounded-md p-1 text-text-tertiary opacity-0 transition-all hover:bg-elevated hover:text-text group-hover:opacity-100"
      >
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );
}
