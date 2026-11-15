-- Sprichwort as an entry type next to Redewendung.
ALTER TYPE "PartOfSpeech" ADD VALUE IF NOT EXISTS 'SPRICHWORT' BEFORE 'SONSTIGES';

-- Inner punctuation no longer distinguishes two spellings of the same saying.
-- Recompute "normalized"; on a collision the entry keeps its old value (nothing is deleted).
DO $$
DECLARE r RECORD; n TEXT;
BEGIN
  FOR r IN SELECT id, normalized FROM "word" WHERE normalized ~ '[,;:–—…]|\s[-‐‑]+\s' LOOP
    n := btrim(regexp_replace(regexp_replace(regexp_replace(r.normalized, '\s[-‐‑]+\s', ' ', 'g'), '[,;:–—…]+', ' ', 'g'), '\s+', ' ', 'g'));
    n := regexp_replace(n, '[.!?]+$', '');
    IF n <> r.normalized AND n <> '' THEN
      IF EXISTS (SELECT 1 FROM "word" WHERE normalized = n AND id <> r.id) THEN
        RAISE WARNING 'normalized collision, kept old value: %', r.normalized;
      ELSE
        UPDATE "word" SET normalized = n WHERE id = r.id;
      END IF;
    END IF;
  END LOOP;
END $$;
