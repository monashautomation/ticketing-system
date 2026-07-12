import { ArrowDown, ArrowUp, Minus, Siren, type LucideIcon } from 'lucide-react';
import type { TicketPriority } from '@ticketing/shared';
import { badgeAccent, badgeDanger, badgeNeutral, badgeWarning } from '@/lib/styles';

interface PriorityConfig {
  label: string;
  icon: LucideIcon;
  badgeClass: string;
}

export const PRIORITY_CONFIG: Record<TicketPriority, PriorityConfig> = {
  low: { label: 'Low', icon: ArrowDown, badgeClass: badgeNeutral },
  normal: { label: 'Normal', icon: Minus, badgeClass: badgeAccent },
  high: { label: 'High', icon: ArrowUp, badgeClass: badgeWarning },
  urgent: { label: 'Urgent', icon: Siren, badgeClass: badgeDanger },
};

export function priorityConfig(priority: string): PriorityConfig {
  return PRIORITY_CONFIG[priority as TicketPriority] ?? { label: priority, icon: Minus, badgeClass: badgeNeutral };
}

export function PriorityPill({ priority }: { priority: string }) {
  const { label, icon: Icon, badgeClass } = priorityConfig(priority);
  return (
    <span className={`${badgeClass} gap-1`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
