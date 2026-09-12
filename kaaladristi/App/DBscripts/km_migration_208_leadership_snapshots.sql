-- Apply after 207. Reads never perform the expensive basket calculations.
BEGIN;
CREATE TABLE IF NOT EXISTS km_leadership_generation (
  id integer PRIMARY KEY CHECK(id=1), generation bigint NOT NULL DEFAULT 0
);
INSERT INTO km_leadership_generation(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS km_sector_leadership_snapshots (
  trade_date date NOT NULL, category text NOT NULL, months integer NOT NULL CHECK(months IN (3,6,12)),
  version integer NOT NULL, generation bigint NOT NULL, payload jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(trade_date,category,months)
);
CREATE OR REPLACE FUNCTION km_invalidate_leadership_generation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE km_leadership_generation SET generation=generation+1 WHERE id=1;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS km_leadership_membership_changed ON km_index_constituents;
CREATE TRIGGER km_leadership_membership_changed
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON km_index_constituents
FOR EACH STATEMENT EXECUTE FUNCTION km_invalidate_leadership_generation();
DROP TRIGGER IF EXISTS km_leadership_catalog_changed ON km_index_symbols;
CREATE TRIGGER km_leadership_catalog_changed
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON km_index_symbols
FOR EACH STATEMENT EXECUTE FUNCTION km_invalidate_leadership_generation();
COMMIT;
