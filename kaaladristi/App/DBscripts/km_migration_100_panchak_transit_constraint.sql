-- Migration 100: Unique constraint on km_rule_transits (rule_id, start_date)
-- Target DB: kaala_dristi_db
-- DO NOT RUN via Python — apply manually in pgAdmin / DBeaver / psql

-- Check for existing duplicates that would block the constraint
SELECT rule_id, start_date, COUNT(*)
FROM km_rule_transits
GROUP BY rule_id, start_date
HAVING COUNT(*) > 1;

-- If the above returns rows, deduplicate first:
-- DELETE FROM km_rule_transits a USING km_rule_transits b
-- WHERE a.id > b.id AND a.rule_id = b.rule_id AND a.start_date = b.start_date;

-- Add the unique constraint (idempotent via DO $$ block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'km_rule_transits'::regclass
      AND conname = 'uq_rule_transits_rule_start'
  ) THEN
    ALTER TABLE km_rule_transits
    ADD CONSTRAINT uq_rule_transits_rule_start
    UNIQUE (rule_id, start_date);
  END IF;
END $$;

-- Verify
SELECT conname, contype FROM pg_constraint
WHERE conrelid = 'km_rule_transits'::regclass AND conname = 'uq_rule_transits_rule_start';
