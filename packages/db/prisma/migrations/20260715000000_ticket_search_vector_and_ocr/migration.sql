-- AlterTable: OCR fields on ticket_attachments
ALTER TABLE "ticket_attachments" ADD COLUMN "ocrText" TEXT,
ADD COLUMN "ocrProcessedAt" TIMESTAMP(3);

CREATE INDEX "ticket_attachments_ocrProcessedAt_idx" ON "ticket_attachments"("ocrProcessedAt");

-- AlterTable: tsvector column on tickets (Prisma `Unsupported` type -- app never writes it
-- directly, only reads it via $queryRaw; all writes happen through the triggers below).
ALTER TABLE "tickets" ADD COLUMN "searchVector" tsvector;

CREATE INDEX "tickets_searchVector_idx" ON "tickets" USING GIN ("searchVector");

-- Recomputes one ticket's searchVector from its own title/description plus the aggregated
-- text of its messages and OCR'd attachments. Called by triggers on all three tables so the
-- vector stays in sync regardless of which table changed.
CREATE OR REPLACE FUNCTION refresh_ticket_search_vector(p_ticket_id TEXT) RETURNS void AS $$
BEGIN
  UPDATE "tickets" t
  SET "searchVector" =
    setweight(to_tsvector('english', coalesce(t.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(t.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(
      (SELECT string_agg(m.body, ' ') FROM "ticket_messages" m WHERE m."ticketId" = t.id), ''
    )), 'C') ||
    setweight(to_tsvector('english', coalesce(
      (SELECT string_agg(a."ocrText", ' ') FROM "ticket_attachments" a
       WHERE a."ticketId" = t.id AND a."ocrText" IS NOT NULL), ''
    )), 'D')
  WHERE t.id = p_ticket_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_tickets_search_vector() RETURNS trigger AS $$
BEGIN
  PERFORM refresh_ticket_search_vector(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tickets_search_vector_update
AFTER INSERT OR UPDATE OF title, description ON "tickets"
FOR EACH ROW EXECUTE FUNCTION trg_tickets_search_vector();

CREATE OR REPLACE FUNCTION trg_ticket_messages_search_vector() RETURNS trigger AS $$
BEGIN
  PERFORM refresh_ticket_search_vector(COALESCE(NEW."ticketId", OLD."ticketId"));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ticket_messages_search_vector_update
AFTER INSERT OR UPDATE OR DELETE ON "ticket_messages"
FOR EACH ROW EXECUTE FUNCTION trg_ticket_messages_search_vector();

CREATE OR REPLACE FUNCTION trg_ticket_attachments_search_vector() RETURNS trigger AS $$
BEGIN
  PERFORM refresh_ticket_search_vector(COALESCE(NEW."ticketId", OLD."ticketId"));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ticket_attachments_search_vector_update
AFTER INSERT OR UPDATE OR DELETE ON "ticket_attachments"
FOR EACH ROW EXECUTE FUNCTION trg_ticket_attachments_search_vector();

-- Backfill existing rows (the triggers above only fire on future writes).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM "tickets" LOOP
    PERFORM refresh_ticket_search_vector(r.id);
  END LOOP;
END $$;
