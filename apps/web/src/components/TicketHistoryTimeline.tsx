import {
  History,
  Paperclip,
  FileMinus,
  Tag,
  Tags,
  UserPlus,
  UserMinus,
  Clock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { statusConfig } from '@/lib/ticketStatus';
import { priorityConfig } from '@/lib/ticketPriority';
import { formatMessageTimestamp } from '@/lib/formatMessageTimestamp';
import { mutedText } from '@/lib/styles';

interface HistoryEntry {
  id: string;
  field: string;
  action: string;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string | Date;
  actor: { name: string } | null;
}

interface TicketHistoryTimelineProps {
  entries: HistoryEntry[];
}

function iconFor(entry: HistoryEntry): LucideIcon {
  switch (entry.field) {
    case 'status':
      return statusConfig(entry.toValue ?? '').icon;
    case 'priority':
      return priorityConfig(entry.toValue ?? '').icon;
    case 'sla':
      return Clock;
    case 'tag':
      return entry.action === 'added' ? Tag : Tags;
    case 'watcher':
      return entry.action === 'added' ? UserPlus : UserMinus;
    case 'attachment':
      return entry.action === 'added' ? Paperclip : FileMinus;
    default:
      return History;
  }
}

function describeEntry(entry: HistoryEntry): string {
  const actor = entry.actor?.name ?? 'System';
  switch (entry.field) {
    case 'status':
      return `${actor} changed status from ${statusConfig(entry.fromValue ?? '').label} to ${statusConfig(entry.toValue ?? '').label}`;
    case 'priority':
      return `${actor} changed priority from ${priorityConfig(entry.fromValue ?? '').label} to ${priorityConfig(entry.toValue ?? '').label}`;
    case 'sla':
      return entry.toValue
        ? `${actor} set SLA due ${new Date(entry.toValue).toLocaleString()}`
        : `${actor} cleared the SLA deadline`;
    case 'tag':
      return entry.action === 'added'
        ? `${actor} added tag "${entry.toValue}"`
        : `${actor} removed tag "${entry.fromValue}"`;
    case 'watcher':
      return entry.action === 'added'
        ? `${actor} added ${entry.toValue} to CC`
        : `${actor} removed ${entry.fromValue} from CC`;
    case 'attachment':
      return entry.action === 'added'
        ? `${actor} attached ${entry.toValue}`
        : `${actor} deleted ${entry.fromValue}`;
    default:
      return `${actor} updated ${entry.field}`;
  }
}

export function TicketHistoryTimeline({ entries }: TicketHistoryTimelineProps) {
  if (entries.length === 0) return null;

  return (
    <details className="mb-6 rounded-lg border border-border bg-panel">
      <summary className="flex cursor-pointer items-center gap-2 p-3 text-sm font-medium text-text-secondary">
        <History className="h-4 w-4" />
        History ({entries.length})
      </summary>
      <ul className="flex flex-col gap-2 border-t border-border p-3">
        {entries.map((entry) => {
          const Icon = iconFor(entry);
          return (
            <li key={entry.id} className="flex items-start gap-2 text-sm">
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
              <span className="flex-1 text-text-secondary">{describeEntry(entry)}</span>
              <span className={`shrink-0 text-xs ${mutedText}`}>
                {formatMessageTimestamp(entry.createdAt)}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
