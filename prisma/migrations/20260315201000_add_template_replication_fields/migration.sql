-- Add template-replication metadata to areas and sections.
ALTER TABLE "areas"
  ADD COLUMN IF NOT EXISTS "is_template" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "source_template_id" TEXT,
  ADD COLUMN IF NOT EXISTS "source_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "is_customized" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "sections"
  ADD COLUMN IF NOT EXISTS "is_template" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "source_template_id" TEXT,
  ADD COLUMN IF NOT EXISTS "source_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "is_customized" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "areas_source_template_id_idx"
  ON "areas"("source_template_id");

CREATE INDEX IF NOT EXISTS "sections_source_template_id_idx"
  ON "sections"("source_template_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'areas_source_template_id_fkey'
  ) THEN
    ALTER TABLE "areas"
      ADD CONSTRAINT "areas_source_template_id_fkey"
      FOREIGN KEY ("source_template_id")
      REFERENCES "areas"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sections_source_template_id_fkey'
  ) THEN
    ALTER TABLE "sections"
      ADD CONSTRAINT "sections_source_template_id_fkey"
      FOREIGN KEY ("source_template_id")
      REFERENCES "sections"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
