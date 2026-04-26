-- Migration 070: Recompute magic_rs_zone for all km_equity_eod rows
-- Zones based on spread between magic_rs and magic_ma
-- Already applied directly: 2026-04-26

UPDATE km_equity_eod
SET magic_rs_zone = CASE
    WHEN magic_rs IS NULL OR magic_ma IS NULL THEN NULL
    WHEN magic_rs > magic_ma AND (magic_rs - magic_ma) > 9.0 THEN 'Strong Bull'
    WHEN magic_rs > magic_ma AND (magic_rs - magic_ma) > 6.0 THEN 'Mild Bull'
    WHEN magic_rs > magic_ma                                  THEN 'Neutral Bull'
    WHEN magic_rs < magic_ma AND (magic_ma - magic_rs) > 9.0 THEN 'Strong Bear'
    WHEN magic_rs < magic_ma AND (magic_ma - magic_rs) > 6.0 THEN 'Mild Bear'
    WHEN magic_rs < magic_ma                                  THEN 'Neutral Bear'
    ELSE 'Neutral'
END
WHERE magic_rs IS NOT NULL AND magic_ma IS NOT NULL;

-- Verify
SELECT magic_rs_zone, COUNT(*)
FROM km_equity_eod
GROUP BY magic_rs_zone
ORDER BY COUNT(*) DESC;
