-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('bug', 'suggestion', 'improvement', 'feature', 'question', 'other');

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "type" "TicketType" NOT NULL DEFAULT 'other';

-- CreateTable
CREATE TABLE "_TicketWatchers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TicketWatchers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TicketWatchers_B_index" ON "_TicketWatchers"("B");

-- AddForeignKey
ALTER TABLE "_TicketWatchers" ADD CONSTRAINT "_TicketWatchers_A_fkey" FOREIGN KEY ("A") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TicketWatchers" ADD CONSTRAINT "_TicketWatchers_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
