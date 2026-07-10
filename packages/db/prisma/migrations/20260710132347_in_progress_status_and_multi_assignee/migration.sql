/*
  Warnings:

  - You are about to drop the column `assignedToId` on the `tickets` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'in_progress';

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_assignedToId_fkey";

-- DropIndex
DROP INDEX "tickets_assignedToId_idx";

-- AlterTable
ALTER TABLE "tickets" DROP COLUMN "assignedToId";

-- CreateTable
CREATE TABLE "_TicketAssignees" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TicketAssignees_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TicketAssignees_B_index" ON "_TicketAssignees"("B");

-- AddForeignKey
ALTER TABLE "_TicketAssignees" ADD CONSTRAINT "_TicketAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TicketAssignees" ADD CONSTRAINT "_TicketAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
