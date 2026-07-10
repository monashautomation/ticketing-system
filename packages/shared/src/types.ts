export const TICKET_STATUSES = [
  'open',
  'pending',
  'escalated',
  'resolved',
  'closed',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const MAINTENANCE_STATUSES = ['scheduled', 'in_progress', 'resolved'] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_SOURCES = ['manual', 'uptime_kuma'] as const;
export type MaintenanceSource = (typeof MAINTENANCE_SOURCES)[number];
