'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import {
  CLOSE_REASONS,
  CLOSE_REASON_LABELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
  type CloseReason,
  type TicketPriority,
  type TicketStatus,
  type TicketType,
} from '@ticketing/shared';
import {
  badgeWarning,
  buttonGhost,
  buttonPrimary,
  card,
  input,
  inputSm,
  label as labelStack,
  labelInline,
  mutedText,
  select as selectStyle,
} from '@/lib/styles';
import { CcEditor } from '@/components/CcEditor';
import { OptionDropdown } from '@/components/OptionDropdown';
import { STATUS_CONFIG } from '@/lib/ticketStatus';
import { PRIORITY_CONFIG } from '@/lib/ticketPriority';
import { TYPE_CONFIG } from '@/lib/ticketType';

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
  const [pendingCloseStatus, setPendingCloseStatus] = useState<'resolved' | 'closed' | null>(null);
  const [resolutionMessage, setResolutionMessage] = useState('');
  const [closeReason, setCloseReason] = useState<CloseReason>('not_planned');

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

  function handleStatusChange(status: TicketStatus) {
    if (status === 'resolved' || status === 'closed') {
      setResolutionMessage('');
      setCloseReason('not_planned');
      setPendingCloseStatus(status);
      return;
    }
    update({ status });
  }

  function cancelClose() {
    setPendingCloseStatus(null);
  }

  function confirmClose() {
    if (!pendingCloseStatus) return;
    const patch: Record<string, unknown> =
      pendingCloseStatus === 'resolved'
        ? { status: pendingCloseStatus, resolutionMessage }
        : { status: pendingCloseStatus, closeReason, resolutionMessage: resolutionMessage || undefined };
    update(patch);
    setPendingCloseStatus(null);
  }

  const confirmDisabled = pendingCloseStatus === 'resolved' && resolutionMessage.trim().length === 0;

  return (
    <div className={`${card} mb-6 flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center gap-3">
        <label className={labelInline}>
          Status
          <OptionDropdown
            value={currentStatus as TicketStatus}
            options={TICKET_STATUSES}
            config={STATUS_CONFIG}
            disabled={isSaving}
            onChange={handleStatusChange}
          />
        </label>

        <label className={labelInline}>
          Priority
          <OptionDropdown
            value={currentPriority as TicketPriority}
            options={TICKET_PRIORITIES}
            config={PRIORITY_CONFIG}
            disabled={isSaving}
            onChange={(priority) => update({ priority })}
          />
        </label>

        <label className={labelInline}>
          Type
          <OptionDropdown
            value={currentType as TicketType}
            options={TICKET_TYPES}
            config={TYPE_CONFIG}
            disabled={isSaving}
            onChange={(type) => update({ type })}
          />
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

      {pendingCloseStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${card} w-full max-w-sm animate-fade-in-up`}>
            <h2 className="mb-1 text-sm font-semibold text-text">
              Mark ticket as {pendingCloseStatus}?
            </h2>
            <p className={`mb-4 ${mutedText}`}>Are you sure? This is recorded in the ticket thread.</p>

            {pendingCloseStatus === 'resolved' ? (
              <label className={`${labelStack} mb-4`}>
                Resolution message
                <textarea
                  className={input}
                  rows={3}
                  autoFocus
                  placeholder="What was done to resolve this?"
                  value={resolutionMessage}
                  onChange={(e) => setResolutionMessage(e.target.value)}
                />
              </label>
            ) : (
              <div className="mb-4 flex flex-col gap-3">
                <label className={labelStack}>
                  Reason
                  <select
                    className={selectStyle}
                    value={closeReason}
                    onChange={(e) => setCloseReason(e.target.value as CloseReason)}
                  >
                    {CLOSE_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {CLOSE_REASON_LABELS[reason]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelStack}>
                  Details (optional)
                  <textarea
                    className={input}
                    rows={2}
                    placeholder="Additional context…"
                    value={resolutionMessage}
                    onChange={(e) => setResolutionMessage(e.target.value)}
                  />
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" className={buttonGhost} onClick={cancelClose} disabled={isSaving}>
                Cancel
              </button>
              <button
                type="button"
                className={buttonPrimary}
                onClick={confirmClose}
                disabled={isSaving || confirmDisabled}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
