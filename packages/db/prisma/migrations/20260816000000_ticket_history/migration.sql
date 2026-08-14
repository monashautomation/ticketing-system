-- CreateEnum
CREATE TYPE "TicketHistoryField" AS ENUM ('status', 'priority', 'sla', 'tag', 'watcher', 'attachment');

-- CreateEnum
CREATE TYPE "TicketHistoryAction" AS ENUM ('changed', 'added', 'removed');

-- CreateTable
CREATE TABLE "ticket_history" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "actorId" TEXT,
    "field" "TicketHistoryField" NOT NULL,
    "action" "TicketHistoryAction" NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_history_ticketId_createdAt_idx" ON "ticket_history"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
