-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'sla_breach';

-- AlterEnum
ALTER TYPE "DiscordDmKind" ADD VALUE 'sla_breach';

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "slaBreachNotifiedAt" TIMESTAMP(3);
