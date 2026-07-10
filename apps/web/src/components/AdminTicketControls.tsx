'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TICKET_PRIORITIES, TICKET_STATUSES } from '@ticketing/shared';

interface AdminOption {
  id: string;
  name: string;
}

interface AdminTicketControlsProps {
  ticketId: string;
  currentStatus: string;
  currentPriority: string;
  currentAssigneeId: string | null;
  admins: AdminOption[];
}

const UNASSIGNED = '__unassigned__';

export function AdminTicketControls({
  ticketId,
  currentStatus,
  currentPriority,
  currentAssigneeId,
  admins,
}: AdminTicketControlsProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

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

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 p-3">
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

      <button
        className="ml-auto rounded-md bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900"
        disabled={isSaving}
        onClick={() => update({ status: 'escalated', priority: 'urgent' })}
      >
        Escalate
      </button>
    </div>
  );
}
