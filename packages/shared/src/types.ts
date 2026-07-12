export const TICKET_STATUSES = [
  'open',
  'pending',
  'escalated',
  'in_progress',
  'resolved',
  'closed',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const CLOSE_REASONS = [
  'not_planned',
  'duplicate',
  'wont_fix',
  'other',
] as const;
export type CloseReason = (typeof CLOSE_REASONS)[number];

export const CLOSE_REASON_LABELS: Record<CloseReason, string> = {
  not_planned: 'Not planned',
  duplicate: 'Duplicate',
  wont_fix: "Won't fix",
  other: 'Other',
};

export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_TYPES = [
  'bug',
  'suggestion',
  'improvement',
  'feature',
  'question',
  'other',
] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const MAINTENANCE_STATUSES = ['scheduled', 'in_progress', 'resolved'] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_SOURCES = ['manual', 'uptime_kuma'] as const;
export type MaintenanceSource = (typeof MAINTENANCE_SOURCES)[number];
