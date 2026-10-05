-- Read-only audit. No recalculation or migration is performed.
-- Stored coverage for the instruments discussed in the ChartView review.
SELECT 'SOLARA' AS instrument, min(trade_date) AS first_price,
       min(trade_date) FILTER (WHERE sma_150 IS NOT NULL) AS first_sma150,
       max(trade_date) FILTER (WHERE sma_150 IS NOT NULL) AS last_sma150,
       count(*) FILTER (WHERE trade_date < DATE '2026-05-01') AS earlier_prices,
       count(*) FILTER (WHERE trade_date < DATE '2026-05-01' AND sma_150 IS NOT NULL) AS earlier_sma150
FROM km_equity_eod WHERE equity_id = (SELECT id FROM km_equity_symbols WHERE symbol = 'SOLARA' LIMIT 1)
UNION ALL
SELECT 'NIFTY 50', min(trade_date),
       min(trade_date) FILTER (WHERE sma_150 IS NOT NULL),
       max(trade_date) FILTER (WHERE sma_150 IS NOT NULL),
       count(*) FILTER (WHERE trade_date < DATE '2026-05-01'),
       count(*) FILTER (WHERE trade_date < DATE '2026-05-01' AND sma_150 IS NOT NULL)
FROM km_index_eod WHERE index_id = (SELECT id FROM km_index_symbols WHERE name = 'NIFTY 50' LIMIT 1);

SELECT trade_date, close, sma_150 FROM km_equity_eod
WHERE equity_id = (SELECT id FROM km_equity_symbols WHERE symbol = 'SOLARA' LIMIT 1)
AND trade_date BETWEEN DATE '2026-04-01' AND DATE '2026-06-01'
ORDER BY trade_date;
