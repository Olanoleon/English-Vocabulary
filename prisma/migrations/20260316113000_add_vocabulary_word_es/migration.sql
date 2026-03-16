-- Add explicit Spanish translation field for vocabulary words.
ALTER TABLE "vocabulary"
  ADD COLUMN IF NOT EXISTS "word_es" TEXT;
