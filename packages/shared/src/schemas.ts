import { z } from 'zod';
import { CLOSE_REASONS, TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES } from './types';

export const createTicketSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(1).max(4000),
  priority: z.enum(TICKET_PRIORITIES).default('normal'),
  type: z.enum(TICKET_TYPES).default('other'),
  ccUserIds: z.array(z.string().min(1)).optional(),
  assigneeIds: z.array(z.string().min(1)).optional(),
  /** Null/omitted = "unsure" -- routed to admins only, same as pre-groups behavior. */
  groupId: z.string().min(1).nullable().optional(),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const createInternalTicketSchema = createTicketSchema.extend({
  discordUserId: z.string().min(1),
  discordUsername: z.string().min(1),
  discordChannelId: z.string().optional(),
  /** Client-generated key (e.g. uuid per Discord interaction) -- lets the bot safely retry
   * a failed/timed-out create without producing a duplicate ticket. */
  idempotencyKey: z.string().min(1).max(100).optional(),
});
export type CreateInternalTicketInput = z.infer<typeof createInternalTicketSchema>;

export const createMessageSchema = z.object({
  body: z.string().min(1).max(4000),
  isInternalNote: z.boolean().default(false),
});
export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export const updateTicketSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(1).max(4000).optional(),
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  type: z.enum(TICKET_TYPES).optional(),
  assigneeIds: z.array(z.string()).optional(),
  slaDueAt: z.string().datetime().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  watcherIds: z.array(z.string()).optional(),
  resolutionMessage: z.string().min(1).max(2000).optional(),
  closeReason: z.enum(CLOSE_REASONS).optional(),
  groupId: z.string().min(1).nullable().optional(),
});

/** Ticket creators (non-admin) may only edit the CC list on their own ticket. */
export const updateWatchersSchema = z
  .object({
    watcherIds: z.array(z.string().min(1)),
  })
  .strict();
export type UpdateWatchersInput = z.infer<typeof updateWatchersSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

/** Discord snowflake IDs are numeric strings; empty string from a cleared form field means "unset". */
const optionalChannelId = z
  .string()
  .regex(/^\d+$/)
  .nullable()
  .or(z.literal('').transform(() => null));

export const updateDiscordSettingsSchema = z.object({
  newTicketChannelId: optionalChannelId,
  unassignedAlertChannelId: optionalChannelId,
});
export type UpdateDiscordSettingsInput = z.infer<typeof updateDiscordSettingsSchema>;

export const ticketGroupSchema = z.object({
  name: z.string().min(1).max(80),
  authentikGroupNames: z.array(z.string().min(1)).min(1, 'Link at least one Authentik group'),
  announcementChannelId: optionalChannelId,
  unassignedBacklogChannelId: optionalChannelId,
});
export type TicketGroupInput = z.infer<typeof ticketGroupSchema>;

export const createTagSchema = z.object({
  name: z.string().min(1).max(40),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#6b7280'),
});
export type CreateTagInput = z.infer<typeof createTagSchema>;

export const requestUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(127),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024), // 25MB cap
});
export type RequestUploadInput = z.infer<typeof requestUploadSchema>;

export const linkDiscordSchema = z.object({
  code: z.string().length(8),
});
export type LinkDiscordInput = z.infer<typeof linkDiscordSchema>;

export const uptimeKumaWebhookSchema = z.object({
  monitor: z.object({
    id: z.union([z.string(), z.number()]),
    name: z.string(),
  }),
  heartbeat: z.object({
    status: z.number(), // 0 = down, 1 = up
    msg: z.string().optional(),
    time: z.string().optional(),
  }),
});
export type UptimeKumaWebhookInput = z.infer<typeof uptimeKumaWebhookSchema>;
