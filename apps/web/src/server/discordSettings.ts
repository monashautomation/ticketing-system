import { prisma } from '@ticketing/db';
import type { UpdateDiscordSettingsInput } from '@ticketing/shared';
import { writeAuditLog } from '@/server/audit';

const SETTINGS_ID = 'singleton';

export async function getDiscordSettings() {
  return prisma.discordSettings.findUnique({ where: { id: SETTINGS_ID } });
}

/** Callers must gate this behind requireAdmin(). */
export async function updateDiscordSettings(input: UpdateDiscordSettingsInput, actorId: string) {
  const settings = await prisma.discordSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      newTicketChannelId: input.newTicketChannelId,
      unassignedAlertChannelId: input.unassignedAlertChannelId,
      updatedById: actorId,
    },
    update: {
      newTicketChannelId: input.newTicketChannelId,
      unassignedAlertChannelId: input.unassignedAlertChannelId,
      updatedById: actorId,
    },
  });
  await writeAuditLog(actorId, 'discord_settings.update', 'DiscordSettings', SETTINGS_ID, { ...input });
  return settings;
}
