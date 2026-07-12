import { Bug, HelpCircle, Lightbulb, MoreHorizontal, Sparkles, TrendingUp, type LucideIcon } from 'lucide-react';
import type { TicketType } from '@ticketing/shared';
import { badgeAccent, badgeDanger, badgeNeutral, badgeSuccess, badgeWarning } from '@/lib/styles';

interface TypeConfig {
  label: string;
  icon: LucideIcon;
  badgeClass: string;
}

export const TYPE_CONFIG: Record<TicketType, TypeConfig> = {
  bug: { label: 'Bug', icon: Bug, badgeClass: badgeDanger },
  suggestion: { label: 'Suggestion', icon: Lightbulb, badgeClass: badgeWarning },
  improvement: { label: 'Improvement', icon: TrendingUp, badgeClass: badgeAccent },
  feature: { label: 'Feature', icon: Sparkles, badgeClass: badgeSuccess },
  question: { label: 'Question', icon: HelpCircle, badgeClass: badgeAccent },
  other: { label: 'Other', icon: MoreHorizontal, badgeClass: badgeNeutral },
};

export function typeConfig(type: string): TypeConfig {
  return TYPE_CONFIG[type as TicketType] ?? { label: type, icon: MoreHorizontal, badgeClass: badgeNeutral };
}

export function TypePill({ type }: { type: string }) {
  const { label, icon: Icon, badgeClass } = typeConfig(type);
  return (
    <span className={`${badgeClass} gap-1`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
