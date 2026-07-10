'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TICKET_PRIORITIES, TICKET_STATUSES } from '@ticketing/shared';

interface AdminOption {
  id: string;
  name: string;
}

interface TagOption {
  id: string;
  name: string;
  color: string;
}

interface AdminTicketControlsProps {
  ticketId: string;
  currentStatus: string;
  currentPriority: string;
  currentAssigneeId: string | null;
  currentSlaDueAt: string | null;
  currentTagIds: string[];
  admins: AdminOption[];
  tags: TagOption[];
}

const UNASSIGNED = '__unassigned__';

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function AdminTicketControls({
  ticketId,
  currentStatus,
  currentPriority,
  currentAssigneeId,
  currentSlaDueAt,
  currentTagIds,
  admins,
  tags,
}: AdminTicketControlsProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(currentTagIds);

  async function update(patch: Record<string, unknown>) {
    setIsSaving(true);
    await fetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setIsSaving(false);
    router.refresh();
  }

  function toggleTag(tagId: string) {
    const next = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];
    setSelectedTagIds(next);
    update({ tagIds: next });
  }

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-neutral-200 p-3">
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm">
        Status
        <select
          className="rounded-md border border-neutral-300 px-2 py-1"
          defaultValue={currentStatus}
          disabled={isSaving}
          onChange={(e) => update({ status: e.target.value })}
        >
          {TICKET_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        Priority
        <select
          className="rounded-md border border-neutral-300 px-2 py-1"
          defaultValue={currentPriority}
          disabled={isSaving}
          onChange={(e) => update({ priority: e.target.value })}
        >
          {TICKET_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        Assignee
        <select
          className="rounded-md border border-neutral-300 px-2 py-1"
          defaultValue={currentAssigneeId ?? UNASSIGNED}
          disabled={isSaving}
          onChange={(e) =>
            update({ assignedToId: e.target.value === UNASSIGNED ? null : e.target.value })
          }
        >
          <option value={UNASSIGNED}>Unassigned</option>
          {admins.map((admin) => (
            <option key={admin.id} value={admin.id}>
              {admin.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        SLA due
        <input
          type="datetime-local"
          className="rounded-md border border-neutral-300 px-2 py-1"
          defaultValue={toDatetimeLocal(currentSlaDueAt)}
          disabled={isSaving}
          onChange={(e) =>
            update({ slaDueAt: e.target.value ? new Date(e.target.value).toISOString() : null })
          }
        />
      </label>

      <button
        className="ml-auto rounded-md bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900"
        disabled={isSaving}
        onClick={() => update({ status: 'escalated', priority: 'urgent' })}
      >
        Escalate
      </button>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-neutral-500">Tags:</span>
      {tags.map((tag) => {
        const selected = selectedTagIds.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            disabled={isSaving}
            onClick={() => toggleTag(tag.id)}
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{
              backgroundColor: selected ? tag.color : 'transparent',
              color: selected ? '#fff' : tag.color,
              border: `1px solid ${tag.color}`,
            }}
          >
            {tag.name}
          </button>
        );
      })}
      {tags.length === 0 && <span className="text-sm text-neutral-400">No tags configured.</span>}
    </div>
    </div>
  );
}
