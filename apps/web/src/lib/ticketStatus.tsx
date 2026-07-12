import { CheckCircle2, CircleDot, Clock, RefreshCw, TriangleAlert, XCircle, type LucideIcon } from 'lucide-react';
import type { TicketStatus } from '@ticketing/shared';
import { badgeAccent, badgeDanger, badgeNeutral, badgeSuccess, badgeWarning } from '@/lib/styles';

interface StatusConfig {
  label: string;
  icon: LucideIcon;
  badgeClass: string;
}

export const STATUS_CONFIG: Record<TicketStatus, StatusConfig> = {
  open: { label: 'Open', icon: CircleDot, badgeClass: badgeAccent },
  pending: { label: 'Pending Response', icon: Clock, badgeClass: badgeWarning },
  escalated: { label: 'Escalating', icon: TriangleAlert, badgeClass: badgeDanger },
  in_progress: { label: 'In Progress', icon: RefreshCw, badgeClass: badgeAccent },
  resolved: { label: 'Resolved', icon: CheckCircle2, badgeClass: badgeSuccess },
  closed: { label: 'Closed', icon: XCircle, badgeClass: badgeNeutral },
};

export function statusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status as TicketStatus] ?? { label: status, icon: CircleDot, badgeClass: badgeNeutral };
}

export function StatusPill({ status }: { status: string }) {
  const { label, icon: Icon, badgeClass } = statusConfig(status);
  return (
    <span className={`${badgeClass} gap-1`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
