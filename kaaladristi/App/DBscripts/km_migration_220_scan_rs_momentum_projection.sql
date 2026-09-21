-- Repair the four stock-level momentum fields for ALL scanner presets.
-- Preserve the installed scanner definition (including later local changes).
-- Populate shadow views before the short atomic swap; never DROP CASCADE.
-- Run as the database migration owner. Any failed assertion rolls back all DDL.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10min';
SET LOCAL search_path = public, pg_catalog;

DO $migration$
DECLARE
  original text;
  projection text;
  exclusion text;
  item record;
  grant_item record;
  col_item record;
  fields text[] := ARRAY['magic_rs_chg_5d','magic_rs_chg_22d','magic_rs_chg_66d','magic_rs_align'];
BEGIN
  IF NOT pg_try_advisory_xact_lock(220, 219) THEN
    RAISE EXCEPTION 'Another momentum projection migration is running';
  END IF;
  original := rtrim(pg_get_viewdef('public.km_scan_results'::regclass, true), E';\n ');
  IF position('momentum_source.magic_rs_chg_5d' IN original) > 0 THEN
    RAISE NOTICE 'Migration 220 already installed';
    RETURN;
  END IF;
  IF to_regclass('public.km_scan_results_m220_new') IS NOT NULL
     OR to_regclass('public.km_scan_exclusion_counts_m220_new') IS NOT NULL THEN
    RAISE EXCEPTION 'Migration shadow name already exists; inspect before proceeding';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE oid IN
      ('public.km_scan_results'::regclass,'public.km_scan_exclusion_counts'::regclass)
      AND (reloptions IS NOT NULL OR reltablespace <> 0)) THEN
    RAISE EXCEPTION 'Custom storage settings require explicit preservation';
  END IF;

  CREATE TEMP TABLE m220_metadata ON COMMIT DROP AS
    SELECT c.relname, pg_get_userbyid(c.relowner) AS owner_name,
      coalesce(c.relacl, acldefault('r',c.relowner)) AS acl,
      obj_description(c.oid,'pg_class') AS comment_text
    FROM pg_class c WHERE c.oid IN
      ('public.km_scan_results'::regclass,'public.km_scan_exclusion_counts'::regclass);
  CREATE TEMP TABLE m220_indexes ON COMMIT DROP AS
    SELECT indexdef FROM pg_indexes WHERE schemaname='public'
      AND tablename IN ('km_scan_results','km_scan_exclusion_counts');
  CREATE TEMP TABLE m220_comments ON COMMIT DROP AS
    SELECT c.relname,a.attname,col_description(c.oid,a.attnum) AS comment_text
    FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
    WHERE c.oid IN ('public.km_scan_results'::regclass,'public.km_scan_exclusion_counts'::regclass)
      AND a.attnum>0 AND NOT a.attisdropped;
  -- Compare freshly evaluated old and new definitions in the SAME snapshot.
  -- Comparing against the cached view would confuse ordinary refresh changes
  -- with changes introduced by this projection repair.
  EXECUTE 'CREATE TEMP TABLE m220_before ON COMMIT DROP AS ' || original;

  SELECT string_agg(format('%s.%I AS %I',
    CASE WHEN attname=ANY(fields) THEN 'momentum_source' ELSE 'scan_row' END,
    attname,attname), ', ' ORDER BY attnum) INTO projection
  FROM pg_attribute WHERE attrelid='public.km_scan_results'::regclass
    AND attnum>0 AND NOT attisdropped;
  EXECUTE format('CREATE MATERIALIZED VIEW public.km_scan_results_m220_new AS
    SELECT %s FROM (%s) scan_row
    LEFT JOIN public.km_equity_eod momentum_source
      ON momentum_source.equity_id=scan_row.equity_id
     AND momentum_source.trade_date=scan_row.trade_date', projection,original);

  -- Compare ALL other fields, not just membership or counts. EXCEPT ALL also
  -- catches duplicate rows introduced by an unexpected non-unique source.
  IF EXISTS (
    (SELECT to_jsonb(b)-fields FROM m220_before b
     EXCEPT ALL SELECT to_jsonb(n)-fields FROM public.km_scan_results_m220_new n)
    UNION ALL
    (SELECT to_jsonb(n)-fields FROM public.km_scan_results_m220_new n
     EXCEPT ALL SELECT to_jsonb(b)-fields FROM m220_before b)
  ) THEN
    RAISE EXCEPTION 'Non-momentum scanner logic changed in the same snapshot';
  END IF;
  IF EXISTS (SELECT 1 FROM public.km_scan_results_m220_new s
    LEFT JOIN public.km_equity_eod e USING (equity_id,trade_date)
    WHERE ROW(s.magic_rs_chg_5d,s.magic_rs_chg_22d,s.magic_rs_chg_66d,s.magic_rs_align)
      IS DISTINCT FROM ROW(e.magic_rs_chg_5d,e.magic_rs_chg_22d,e.magic_rs_chg_66d,e.magic_rs_align)) THEN
    RAISE EXCEPTION 'Momentum fields do not match their dated source';
  END IF;

  exclusion := rtrim(pg_get_viewdef('public.km_scan_exclusion_counts'::regclass,true), E';\n ');
  EXECUTE 'CREATE TEMP TABLE m220_exclusions_before ON COMMIT DROP AS '
    || regexp_replace(exclusion, '\mkm_scan_results\M', 'm220_before', 'g');
  exclusion := regexp_replace(exclusion, '\mkm_scan_results\M', 'km_scan_results_m220_new', 'g');
  EXECUTE 'CREATE MATERIALIZED VIEW public.km_scan_exclusion_counts_m220_new AS ' || exclusion;
  IF EXISTS (
    (SELECT * FROM m220_exclusions_before EXCEPT ALL SELECT * FROM public.km_scan_exclusion_counts_m220_new)
    UNION ALL
    (SELECT * FROM public.km_scan_exclusion_counts_m220_new EXCEPT ALL SELECT * FROM m220_exclusions_before)
  ) THEN RAISE EXCEPTION 'Scanner exclusion counts changed'; END IF;

  -- Short swap: unknown dependents cause RESTRICT to abort, not cascade.
  DROP MATERIALIZED VIEW public.km_scan_exclusion_counts RESTRICT;
  DROP MATERIALIZED VIEW public.km_scan_results RESTRICT;
  ALTER MATERIALIZED VIEW public.km_scan_results_m220_new RENAME TO km_scan_results;
  ALTER MATERIALIZED VIEW public.km_scan_exclusion_counts_m220_new RENAME TO km_scan_exclusion_counts;
  FOR item IN SELECT indexdef FROM m220_indexes LOOP EXECUTE item.indexdef; END LOOP;
  FOR item IN SELECT * FROM m220_metadata LOOP
    EXECUTE format('ALTER MATERIALIZED VIEW public.%I OWNER TO %I',item.relname,item.owner_name);
    EXECUTE format('COMMENT ON MATERIALIZED VIEW public.%I IS %L',item.relname,item.comment_text);
    EXECUTE format('SET LOCAL ROLE %I',item.owner_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',item.relname);
    FOR grant_item IN SELECT * FROM aclexplode(item.acl) LOOP
      EXECUTE format('GRANT %s ON public.%I TO %s%s',grant_item.privilege_type,item.relname,
        CASE WHEN grant_item.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(grant_item.grantee)) END,
        CASE WHEN grant_item.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
    END LOOP;
    RESET ROLE;
  END LOOP;
  FOR col_item IN SELECT * FROM m220_comments WHERE comment_text IS NOT NULL LOOP
    EXECUTE format('COMMENT ON COLUMN public.%I.%I IS %L',col_item.relname,col_item.attname,col_item.comment_text);
  END LOOP;
  RAISE NOTICE 'Migration 220 validated: only four momentum fields changed; scanner data and exclusions preserved';
END
$migration$;
NOTIFY pgrst, 'reload schema';
COMMIT;
