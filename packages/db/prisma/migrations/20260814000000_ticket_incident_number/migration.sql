-- Per-year counter backing the human-readable "INC-YYYY-NNNNNN" incident number.
-- A counter table (rather than a bare SEQUENCE) lets the sequence reset each calendar year.
CREATE TABLE "ticket_incident_counters" (
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ticket_incident_counters_pkey" PRIMARY KEY ("year")
);

-- Add nullable first so existing rows aren't rejected, backfill, then lock down.
ALTER TABLE "tickets" ADD COLUMN "incidentNumber" TEXT;

WITH numbered AS (
  SELECT
    "id",
    EXTRACT(YEAR FROM "createdAt")::int AS "yr",
    ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM "createdAt") ORDER BY "createdAt", "id") AS "rn"
  FROM "tickets"
)
UPDATE "tickets" t
SET "incidentNumber" = 'INC-' || numbered."yr" || '-' || LPAD(numbered."rn"::text, 6, '0')
FROM numbered
WHERE t."id" = numbered."id";

INSERT INTO "ticket_incident_counters" ("year", "lastValue")
SELECT EXTRACT(YEAR FROM "createdAt")::int, COUNT(*)
FROM "tickets"
GROUP BY EXTRACT(YEAR FROM "createdAt")::int
ON CONFLICT ("year") DO UPDATE SET "lastValue" = EXCLUDED."lastValue";

ALTER TABLE "tickets" ALTER COLUMN "incidentNumber" SET NOT NULL;

CREATE UNIQUE INDEX "tickets_incidentNumber_key" ON "tickets"("incidentNumber");
