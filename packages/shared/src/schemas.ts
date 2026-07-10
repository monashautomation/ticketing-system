import { z } from 'zod';
import { TICKET_PRIORITIES, TICKET_STATUSES } from './types';

export const createTicketSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(1).max(4000),
  priority: z.enum(TICKET_PRIORITIES).default('normal'),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const createInternalTicketSchema = createTicketSchema.extend({
  discordUserId: z.string().min(1),
  discordUsername: z.string().min(1),
  discordChannelId: z.string().optional(),
});
export type CreateInternalTicketInput = z.infer<typeof createInternalTicketSchema>;

export const createMessageSchema = z.object({
  body: z.string().min(1).max(4000),
  isInternalNote: z.boolean().default(false),
});
export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export const updateTicketSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assignedToId: z.string().nullable().optional(),
});
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

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
