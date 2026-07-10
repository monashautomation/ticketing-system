-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'pending', 'escalated', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('scheduled', 'in_progress', 'resolved');

-- CreateEnum
CREATE TYPE "MaintenanceSource" AS ENUM ('manual', 'uptime_kuma');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "discordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "priority" "TicketPriority" NOT NULL DEFAULT 'normal',
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "discordChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternalNote" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_access_tokens" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discord_link_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discord_link_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'scheduled',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "source" "MaintenanceSource" NOT NULL DEFAULT 'manual',
    "kumaMonitorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_discordId_key" ON "users"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_providerId_accountId_key" ON "accounts"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_createdById_idx" ON "tickets"("createdById");

-- CreateIndex
CREATE INDEX "tickets_assignedToId_idx" ON "tickets"("assignedToId");

-- CreateIndex
CREATE INDEX "ticket_messages_ticketId_idx" ON "ticket_messages"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_access_tokens_tokenHash_key" ON "ticket_access_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "ticket_access_tokens_ticketId_idx" ON "ticket_access_tokens"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "discord_link_codes_code_key" ON "discord_link_codes"("code");

-- CreateIndex
CREATE INDEX "discord_link_codes_userId_idx" ON "discord_link_codes"("userId");

-- CreateIndex
CREATE INDEX "maintenance_events_status_idx" ON "maintenance_events"("status");

-- CreateIndex
CREATE INDEX "maintenance_events_kumaMonitorId_idx" ON "maintenance_events"("kumaMonitorId");

-- CreateIndex
CREATE INDEX "audit_log_targetType_targetId_idx" ON "audit_log"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_access_tokens" ADD CONSTRAINT "ticket_access_tokens_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discord_link_codes" ADD CONSTRAINT "discord_link_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

