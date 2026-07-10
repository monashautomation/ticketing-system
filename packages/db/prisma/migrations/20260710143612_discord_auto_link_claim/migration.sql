/*
  Warnings:

  - You are about to drop the `discord_link_codes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "discord_link_codes" DROP CONSTRAINT "discord_link_codes_userId_fkey";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isDiscordPlaceholder" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "discord_link_codes";

-- CreateTable
CREATE TABLE "discord_claims" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "placeholderUserId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discord_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "discord_claims_tokenHash_key" ON "discord_claims"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "discord_claims_placeholderUserId_key" ON "discord_claims"("placeholderUserId");

-- AddForeignKey
ALTER TABLE "discord_claims" ADD CONSTRAINT "discord_claims_placeholderUserId_fkey" FOREIGN KEY ("placeholderUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
