-- AlterEnum
ALTER TYPE "DiscordDmKind" ADD VALUE IF NOT EXISTS 'ticket_created';
ALTER TYPE "DiscordDmKind" ADD VALUE IF NOT EXISTS 'reply';
ALTER TYPE "DiscordDmKind" ADD VALUE IF NOT EXISTS 'status_updated';
ALTER TYPE "DiscordDmKind" ADD VALUE IF NOT EXISTS 'closed';
ALTER TYPE "DiscordDmKind" ADD VALUE IF NOT EXISTS 'resolved';

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "discordReminderSentAt";
