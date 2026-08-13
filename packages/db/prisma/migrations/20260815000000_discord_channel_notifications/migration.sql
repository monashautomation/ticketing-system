-- AlterEnum
ALTER TYPE "DiscordDmKind" ADD VALUE 'assignee_updated';
ALTER TYPE "DiscordDmKind" ADD VALUE 'assignee_idle_reminder';

-- CreateEnum
CREATE TYPE "DiscordChannelMessageKind" AS ENUM ('ticket_created', 'unassigned_backlog');

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "activeSince" TIMESTAMP(3),
ADD COLUMN     "activeReminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "discord_channel_messages" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "kind" "DiscordChannelMessageKind" NOT NULL,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discord_channel_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discord_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "newTicketChannelId" TEXT,
    "unassignedAlertChannelId" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discord_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discord_channel_messages_sentAt_idx" ON "discord_channel_messages"("sentAt");

-- CreateIndex
CREATE INDEX "discord_channel_messages_kind_createdAt_idx" ON "discord_channel_messages"("kind", "createdAt");
