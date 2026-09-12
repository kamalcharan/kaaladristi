-- Apply before deploying the leadership backend. No existing data is deleted.
CREATE TABLE IF NOT EXISTS public.km_custom_index_revisions (
 index_id integer PRIMARY KEY REFERENCES public.km_index_symbols(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 0,
 computed_revision bigint NOT NULL DEFAULT 0,
 changed_at timestamptz NOT NULL DEFAULT now(),
 computed_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.km_custom_index_membership_log (
 id bigserial PRIMARY KEY, index_id integer NOT NULL, equity_id integer NOT NULL,
 action text NOT NULL, changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.km_leadership_observations (
 snapshot text PRIMARY KEY, recorded_at timestamptz NOT NULL DEFAULT now(), payload jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS public.km_custom_index_history_archive (
 id bigserial PRIMARY KEY, index_id integer NOT NULL, revision bigint NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(), bars jsonb NOT NULL
);
INSERT INTO public.km_custom_index_revisions(index_id)
 SELECT id FROM public.km_index_symbols WHERE category='custom' ON CONFLICT DO NOTHING;
-- Preserve the initial membership before subsequent additions/removals.
INSERT INTO public.km_custom_index_membership_log(index_id,equity_id,action)
 SELECT c.index_id,c.equity_id,'baseline' FROM public.km_index_constituents c
 JOIN public.km_index_symbols s ON s.id=c.index_id AND s.category='custom'
 WHERE NOT EXISTS (SELECT 1 FROM public.km_custom_index_membership_log l WHERE l.index_id=c.index_id);
CREATE OR REPLACE FUNCTION public.record_custom_membership_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE idx integer; eq integer;
BEGIN
 IF TG_OP='UPDATE' AND NEW.index_id=OLD.index_id AND NEW.equity_id=OLD.equity_id THEN RETURN NEW; END IF;
 IF TG_OP IN ('DELETE','UPDATE') THEN
  idx:=OLD.index_id; eq:=OLD.equity_id;
  IF EXISTS(SELECT 1 FROM km_index_symbols WHERE id=idx AND category='custom') THEN
   INSERT INTO km_custom_index_revisions(index_id,revision) VALUES(idx,1)
    ON CONFLICT(index_id) DO UPDATE SET revision=km_custom_index_revisions.revision+1,changed_at=now();
   INSERT INTO km_custom_index_membership_log(index_id,equity_id,action) VALUES(idx,eq,'removed');
  END IF;
 END IF;
 IF TG_OP IN ('INSERT','UPDATE') THEN
  idx:=NEW.index_id; eq:=NEW.equity_id;
  IF EXISTS(SELECT 1 FROM km_index_symbols WHERE id=idx AND category='custom') THEN
   INSERT INTO km_custom_index_revisions(index_id,revision) VALUES(idx,1)
    ON CONFLICT(index_id) DO UPDATE SET revision=km_custom_index_revisions.revision+1,changed_at=now();
   INSERT INTO km_custom_index_membership_log(index_id,equity_id,action) VALUES(idx,eq,'added');
  END IF;
 END IF;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS custom_membership_change ON public.km_index_constituents;
CREATE TRIGGER custom_membership_change AFTER INSERT OR UPDATE OR DELETE ON public.km_index_constituents
 FOR EACH ROW EXECUTE FUNCTION public.record_custom_membership_change();

-- Same score formula as migration 116, scoped to one index for full rebuilds.
CREATE OR REPLACE FUNCTION compute_custom_index_scores_scoped(
  p_index_id INT, p_from_date DATE DEFAULT NULL
)
RETURNS TABLE(out_index_id INT, rows_updated INT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH

  -- Step 1: Sum constituent rolling amounts per (index, date).
  -- Date filter applied here — rolling metrics already stored in
  -- km_equity_eod; no window look-back needed in this function.
  constituent_agg AS (
    SELECT
      c.index_id,
      e.trade_date,
      SUM(e.avg_amt_5d)  AS idx_amt_5d,
      SUM(e.avg_amt_22d) AS idx_amt_22d,
      SUM(e.avg_amt_66d) AS idx_amt_66d
    FROM km_index_constituents c
    JOIN km_equity_eod e ON e.equity_id = c.equity_id
    WHERE c.index_id=p_index_id AND (p_from_date IS NULL OR e.trade_date >= p_from_date)
    GROUP BY c.index_id, e.trade_date
  ),

  -- Step 2: Join real index returns from km_index_eod and derive scores.
  with_scores AS (
    SELECT
      ca.index_id,
      ca.trade_date,
      ca.idx_amt_5d,
      ca.idx_amt_22d,
      ca.idx_amt_66d,
      -- Real index N-session returns (already stored by daily pipeline)
      ie.ret_5d  AS idx_ret_5d,
      ie.ret_22d AS idx_ret_22d,
      -- Index-level surge terms
      (ca.idx_amt_5d  - ca.idx_amt_22d) / NULLIF(ca.idx_amt_22d, 0) * 100
        AS pct_amt_chg_5,
      (ca.idx_amt_22d - ca.idx_amt_66d) / NULLIF(ca.idx_amt_66d, 0) * 100
        AS pct_amt_chg_22
    FROM constituent_agg ca
    JOIN km_index_eod ie
      ON  ie.index_id   = ca.index_id
      AND ie.trade_date = ca.trade_date
  ),

  updated AS (
    UPDATE km_index_eod idx
    SET
      avg_amt_5d  = ws.idx_amt_5d,
      avg_amt_22d = ws.idx_amt_22d,
      avg_amt_66d = ws.idx_amt_66d,
      score_5d = CASE
        WHEN ws.idx_ret_5d IS NULL OR ws.idx_ret_5d <= 0 THEN 0
        ELSE ROUND(ws.idx_ret_5d + GREATEST(0, ws.pct_amt_chg_5), 2)
      END,
      score_22d = CASE
        WHEN ws.idx_ret_22d IS NULL OR ws.idx_ret_22d <= 0 THEN 0
        ELSE ROUND(ws.idx_ret_22d + GREATEST(0, ws.pct_amt_chg_22), 2)
      END
    FROM with_scores ws
    WHERE idx.index_id   = ws.index_id
      AND idx.trade_date = ws.trade_date
    RETURNING idx.index_id
  )

  SELECT
    u.index_id::INT AS out_index_id,
    COUNT(*)::INT   AS rows_updated
  FROM updated u
  GROUP BY u.index_id
  ORDER BY u.index_id;

END;
$$;
