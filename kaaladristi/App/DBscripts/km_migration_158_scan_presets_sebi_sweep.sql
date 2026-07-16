-- km_migration_158_scan_presets_sebi_sweep.sql
-- Target database: kaala_dristi_db
--
-- SEBI sweep (per App/mnt/skills/user/sebi-sweep/SKILL.md) over kd_scan_presets
-- visible text: name / description / tooltip. Phrase-level replacements from the
-- skill's table — bullish→positive, bearish→negative, Accumulation→Rising Flow,
-- Distribution→Falling Flow. Preset ids are internal identifiers and unchanged.
-- Zone references use the on-screen ZONE_LABELS vocabulary (Leading etc.), the
-- same words the results table shows.
--
-- Presets touched (active only): power_buy, power_sell, smart_money,
-- quiet_accumulation, distribution_warning.

UPDATE kd_scan_presets SET
  description = 'Stocks where several independent positive conditions line up at once, inside industries that money is currently favouring.',
  tooltip     = 'Universe: industries leading or rotating in. Match: a Rising-Flow Signature, OR price above its 150-day average + a Leading/Improving Relative Strength zone + fresh-longs / short-covering flow + volume above 1.5× normal. Top 25 by Relative Strength.',
  updated_at  = NOW()
WHERE id = 'power_buy';

UPDATE kd_scan_presets SET
  description = 'Stocks where several independent weakening conditions coincide, inside industries currently losing participation.',
  tooltip     = 'Universe: industries lagging or rotating out. Match: a Falling-Flow Signal, OR price below its 150-day average + a Weakening/Lagging Relative Strength zone + fresh-shorts / long-liquidation flow + volume above 1.5× normal. Bottom 25 by Relative Strength.',
  updated_at  = NOW()
WHERE id = 'power_sell';

UPDATE kd_scan_presets SET
  description = 'Stocks moving into strong hands — high delivery (shares actually taken home, not day-traded) inside industries where inflow is broad.',
  tooltip     = 'Universe: industries with over 60% of members in rising flow. Match: delivery above 60% of traded quantity + positive RSS momentum. Top 25 by delivery %.',
  updated_at  = NOW()
WHERE id = 'smart_money';

UPDATE kd_scan_presets SET
  name        = 'Quiet Rising Flow',
  description = 'Under-the-radar industries where inflow is rising before the price story is obvious — and the stocks inside them showing a rising-flow footprint.',
  tooltip     = 'Universe: industries outside the top quartile whose rising-flow breadth is increasing over 5 sessions. Match: Rising-Flow Signature + Smart Money reading rising vs 5 sessions ago. Top 25 by industry flow change.',
  updated_at  = NOW()
WHERE id = 'quiet_accumulation';

UPDATE kd_scan_presets SET
  name        = 'Falling Flow Warnings',
  description = 'Recently strong stocks showing early signs that large holders may be handing off — strength fading alongside falling-flow footprints. A risk-review list.',
  tooltip     = 'Match: Relative Strength zone was Leading 10 sessions ago and has slipped since + a Falling-Flow Signal or downward volume divergence. Ranked by size of the strength slip × industry rank drop.',
  updated_at  = NOW()
WHERE id = 'distribution_warning';
