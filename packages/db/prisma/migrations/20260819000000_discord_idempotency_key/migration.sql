-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "discordIdempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tickets_discordIdempotencyKey_key" ON "tickets"("discordIdempotencyKey");
