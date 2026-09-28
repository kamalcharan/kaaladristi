-- ============================================================================
-- Migration 231 — km_filing_reads.read_source admits 'ocr'
-- ============================================================================
-- Target: kaala_dristi_db. Holds no data; one CHECK constraint.
--
-- The filing reader (migration 229) recorded where a verdict's text came from
-- as 'text' (the PDF's own text layer) or 'pdf' (the document sent to the
-- model as page images). Since 2026-09-28 a scanned document is read by
-- Tesseract first — owner: "python libraries should convert into metadata
-- and send it to qwen, image models will be expensive" — and that is a third
-- provenance. It is NOT 'text': OCR misreads digits in tables, and a verdict
-- that rests on an OCR'd amount deserves to say so wherever it is rendered.
--
-- The local (Qwen) backend reads text only, so on that backend every scanned
-- document is either 'ocr' or unreadable; 'pdf' remains the Anthropic
-- backend's fallback when no OCR is installed.
--
-- Rollback: re-add the constraint with the two original values (no row
-- carries 'ocr' before this migration; rows written after it would need
-- updating first).
-- ============================================================================

BEGIN;

DO $$
DECLARE c TEXT;
BEGIN
    SELECT conname INTO c
      FROM pg_constraint
     WHERE conrelid = 'public.km_filing_reads'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%read_source%';
    IF c IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.km_filing_reads DROP CONSTRAINT %I', c);
    END IF;
END $$;

ALTER TABLE public.km_filing_reads
    ADD CONSTRAINT km_filing_reads_read_source_check
    CHECK (read_source IN ('text', 'pdf', 'ocr') OR read_source IS NULL);

COMMENT ON COLUMN public.km_filing_reads.read_source IS
  'Where the text the verdict rests on came from: text = the PDF''s own text '
  'layer (pypdf); ocr = Tesseract over the rendered pages (a scan); pdf = the '
  'document sent to the model as page images (Anthropic backend, no OCR '
  'installed). A verdict on OCR text can misread a figure in a table.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verify:
--   SELECT read_source, count(*) FROM km_filing_reads GROUP BY 1;
