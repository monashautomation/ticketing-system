-- CreateTable
CREATE TABLE "ticket_share_links" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_share_links_tokenHash_key" ON "ticket_share_links"("tokenHash");

-- CreateIndex
CREATE INDEX "ticket_share_links_ticketId_idx" ON "ticket_share_links"("ticketId");

-- AddForeignKey
ALTER TABLE "ticket_share_links" ADD CONSTRAINT "ticket_share_links_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_share_links" ADD CONSTRAINT "ticket_share_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
