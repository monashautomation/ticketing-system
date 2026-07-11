'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES } from '@ticketing/shared';
import { badgeWarning, card, input, inputSm, labelInline, mutedText, select } from '@/lib/styles';
import { CcEditor } from '@/components/CcEditor';

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
  currentType: string;
  currentAssignees: AdminOption[];
  currentSlaDueAt: string | null;
  currentTagIds: string[];
  currentWatchers: AdminOption[];
  tags: TagOption[];
}

const ASSIGNEE_SEARCH_DEBOUNCE_MS = 250;

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
  currentType,
  currentAssignees,
  currentSlaDueAt,
  currentTagIds,
  currentWatchers,
  tags,
}: AdminTicketControlsProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(currentTagIds);
  const [selectedAssignees, setSelectedAssignees] = useState<AdminOption[]>(currentAssignees);
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const [assigneeResults, setAssigneeResults] = useState<AdminOption[]>([]);

  useEffect(() => {
    const query = assigneeQuery.trim();
    if (!query) {
      setAssigneeResults([]);
      return;
    }
    const handle = setTimeout(() => {
      fetch(`/api/users/admins?q=${encodeURIComponent(query)}`)
        .then((res) => (res.ok ? res.json() : { data: [] }))
        .then((body) => setAssigneeResults(body.data ?? []))
        .catch(() => setAssigneeResults([]));
    }, ASSIGNEE_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [assigneeQuery]);

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

  function addAssignee(admin: AdminOption) {
    if (selectedAssignees.some((a) => a.id === admin.id)) return;
    const next = [...selectedAssignees, admin];
    setSelectedAssignees(next);
    setAssigneeQuery('');
    setAssigneeResults([]);
    update({ assigneeIds: next.map((a) => a.id) });
  }

  function removeAssignee(adminId: string) {
    const next = selectedAssignees.filter((a) => a.id !== adminId);
    setSelectedAssignees(next);
    update({ assigneeIds: next.map((a) => a.id) });
  }

  return (
    <div className={`${card} mb-6 flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center gap-3">
        <label className={labelInline}>
          Status
          <select
            className={select}
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

        <label className={labelInline}>
          Priority
          <select
            className={select}
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

        <label className={labelInline}>
          Type
          <select
            className={select}
            defaultValue={currentType}
            disabled={isSaving}
            onChange={(e) => update({ type: e.target.value })}
          >
            {TICKET_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className={labelInline}>
          SLA due
          <input
            type="datetime-local"
            className={inputSm}
            defaultValue={toDatetimeLocal(currentSlaDueAt)}
            disabled={isSaving}
            onChange={(e) =>
              update({ slaDueAt: e.target.value ? new Date(e.target.value).toISOString() : null })
            }
          />
        </label>

        <button
          className={`${badgeWarning} ml-auto inline-flex cursor-pointer items-center gap-1.5 border-none px-3 py-1.5 transition-all hover:-translate-y-0.5 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0`}
          disabled={isSaving}
          onClick={() => update({ status: 'escalated', priority: 'urgent' })}
        >
          <TriangleAlert className="h-3.5 w-3.5" />
          Escalate
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className={mutedText}>Assignees (admins only):</span>
        <div className="flex flex-wrap items-center gap-2">
          {selectedAssignees.map((admin) => (
            <span
              key={admin.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent px-3 py-1 text-xs font-medium text-white"
            >
              {admin.name}
              <button
                type="button"
                disabled={isSaving}
                onClick={() => removeAssignee(admin.id)}
                className="text-white/80 hover:text-white"
                aria-label={`Remove ${admin.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="relative max-w-xs">
          <input
            className={input}
            placeholder="Search admins by name…"
            value={assigneeQuery}
            disabled={isSaving}
            onChange={(e) => setAssigneeQuery(e.target.value)}
          />
          {assigneeResults.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full animate-fade-in-up rounded-md border border-border bg-panel shadow-lg">
              {assigneeResults.map((admin) => (
                <li key={admin.id}>
                  <button
                    type="button"
                    onClick={() => addAssignee(admin)}
                    className="block w-full px-3 py-2 text-left text-sm text-text hover:bg-elevated"
                  >
                    {admin.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={mutedText}>Tags:</span>
        {tags.map((tag) => {
          const selected = selectedTagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              disabled={isSaving}
              onClick={() => toggleTag(tag.id)}
              className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
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
        {tags.length === 0 && <span className="text-sm text-text-tertiary">No tags configured.</span>}
      </div>

      <CcEditor ticketId={ticketId} initialWatchers={currentWatchers} />
    </div>
  );
}
