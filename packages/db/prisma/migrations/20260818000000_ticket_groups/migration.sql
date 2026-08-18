-- AlterEnum
ALTER TYPE "TicketHistoryField" ADD VALUE 'group';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "authentikGroups" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ticket_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "authentikGroupNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "announcementChannelId" TEXT,
    "unassignedBacklogChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TicketGroupMembers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TicketGroupMembers_AB_pkey" PRIMARY KEY ("A","B")
);

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "groupId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ticket_groups_name_key" ON "ticket_groups"("name");

-- CreateIndex
CREATE INDEX "_TicketGroupMembers_B_index" ON "_TicketGroupMembers"("B");

-- CreateIndex
CREATE INDEX "tickets_groupId_idx" ON "tickets"("groupId");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ticket_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TicketGroupMembers" ADD CONSTRAINT "_TicketGroupMembers_A_fkey" FOREIGN KEY ("A") REFERENCES "ticket_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TicketGroupMembers" ADD CONSTRAINT "_TicketGroupMembers_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
