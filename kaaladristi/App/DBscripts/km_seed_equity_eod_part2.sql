-- Auto-generated: equity EOD part 2 (500 rows)
-- Uses subquery to resolve equity_id from symbol

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 78.75, 78.75, 77.25, 77.34, 78.15, -0.81, -1.04, 11552, 0.09, 133.4, 76.2, -12.96, -32.52
FROM km_equity_symbols WHERE symbol = 'GTPL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 425.0, 426.05, 416.2, 426.0, 425.35, 0.65, 0.15, 195691, 8.28, 508.7, 360.25, 4.25, 5.75
FROM km_equity_symbols WHERE symbol = 'GUJGASLTD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1138.0, 1141.9, 1108.7, 1122.0, 1158.1, -15.1, -1.33, 37121, 4.17, 1331.9, 911.0, -1.0, -1.6
FROM km_equity_symbols WHERE symbol = 'GULFOILLUB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 29.5, 30.9, 29.5, 30.9, 30.0, 0.9, 3.0, 3200, 0.01, 60.0, 27.0, 6.0, NULL
FROM km_equity_symbols WHERE symbol = 'GURUNANAK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3610.1, 3630.3, 3531.5, 3565.7, 3622.5, -56.8, -1.57, 376799, 134.94, 3819.0, 1254.0, 30.54, 129.75
FROM km_equity_symbols WHERE symbol = 'GVT&D'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 4189.0, 4263.5, 4155.8, 4206.0, 4158.9, 47.1, 1.13, 3532180, 1489.71, 5165.0, 3046.05, -5.53, 14.91
FROM km_equity_symbols WHERE symbol = 'HAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 369.0, 377.2, 365.0, 371.1, 380.7, -9.6, -2.52, 654461, 24.29, 735.0, 365.0, -13.59, -46.68
FROM km_equity_symbols WHERE symbol = 'HAPPSTMNDS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 11.4, 11.5, 11.04, 11.29, 11.45, -0.16, -1.4, 1571440, 1.77, 17.98, 9.91, -5.68, -21.27
FROM km_equity_symbols WHERE symbol = 'HATHWAY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1391.1, 1419.0, 1378.4, 1402.3, 1400.5, 1.8, 0.13, 774193, 108.41, 1673.8, 1250.1, -2.05, -7.9
FROM km_equity_symbols WHERE symbol = 'HAVELLS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 772.0, 774.45, 760.0, 762.5, 776.95, -12.45, -1.61, 760201, 58.24, 1122.0, 405.0, -9.88, 54.79
FROM km_equity_symbols WHERE symbol = 'HBLENGINE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 20.1, 20.4, 19.66, 19.7, 20.1, -0.4, -1.99, 34564371, 69.13, 31.42, 16.92, 0.25, -17.47
FROM km_equity_symbols WHERE symbol = 'HCC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 595.05, 603.5, 580.1, 582.0, 595.05, -13.05, -2.19, 72424, 4.23, 804.65, 472.55, -12.85, 13.98
FROM km_equity_symbols WHERE symbol = 'HCG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1423.0, 1476.8, 1396.0, 1458.0, 1476.1, -18.1, -1.23, 7214938, 1038.48, 1780.1, 1302.75, -12.43, -14.39
FROM km_equity_symbols WHERE symbol = 'HCLTECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 714.0, 717.5, 704.45, 710.0, 715.0, -5.0, -0.7, 1059434, 75.21, 891.9, 687.3, -7.55, NULL
FROM km_equity_symbols WHERE symbol = 'HDBFS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2817.0, 2832.4, 2797.4, 2825.0, 2835.7, -10.7, -0.38, 1046968, 294.71, 2967.25, 1781.53, 13.65, 50.43
FROM km_equity_symbols WHERE symbol = 'HDFCAMC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 913.0, 928.2, 901.0, 903.9, 920.6, -16.7, -1.81, 50188359, 4578.43, 1020.5, 830.55, -3.57, 6.49
FROM km_equity_symbols WHERE symbol = 'HDFCBANK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 702.0, 707.55, 695.05, 696.85, 702.7, -5.85, -0.83, 2076033, 145.21, 820.75, 600.35, -6.9, 10.68
FROM km_equity_symbols WHERE symbol = 'HDFCLIFE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 528.9, 545.0, 524.0, 525.0, 532.0, -7.0, -1.32, 1699621, 90.9, 672.0, 331.25, -4.67, 53.15
FROM km_equity_symbols WHERE symbol = 'HEG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 136.0, 136.41, 134.16, 134.6, 137.99, -3.39, -2.46, 328059, 4.43, 190.69, 111.03, -1.44, -2.28
FROM km_equity_symbols WHERE symbol = 'HEMIPROP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 362.0, 362.75, 354.05, 356.55, 364.8, -8.25, -2.26, 253197, 9.04, 540.0, 339.7, -19.7, -10.02
FROM km_equity_symbols WHERE symbol = 'HERITGFOOD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 5702.0, 5724.5, 5560.0, 5562.0, 5733.0, -171.0, -2.98, 394003, 221.74, 6388.5, 3344.0, -3.01, 40.58
FROM km_equity_symbols WHERE symbol = 'HEROMOTOCO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 530.0, 589.7, 521.55, 563.9, 542.95, 20.95, 3.86, 4782118, 270.24, 900.0, 521.55, -23.24, NULL
FROM km_equity_symbols WHERE symbol = 'HEXT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 71.05, 71.05, 69.2, 69.45, 71.62, -2.17, -3.03, 12930607, 90.32, 94.1, 59.82, 10.8, -23.88
FROM km_equity_symbols WHERE symbol = 'HFCL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 670.0, 692.95, 650.2, 660.05, 672.25, -12.2, -1.81, 220188, 14.8, 1275.0, 545.5, -5.59, -42.59
FROM km_equity_symbols WHERE symbol = 'HGINFRA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 138.85, 138.85, 136.0, 136.0, 138.85, -2.85, -2.05, 20000, 0.27, 265.7, 125.0, -4.16, -55.2
FROM km_equity_symbols WHERE symbol = 'HIGREEN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 210.0, 219.84, 205.8, 214.6, 215.05, -0.45, -0.21, 6188929, 132.34, 456.75, 177.35, 0.83, -38.54
FROM km_equity_symbols WHERE symbol = 'HIKAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 56.49, 56.5, 55.06, 55.31, 56.87, -1.56, -2.74, 145106, 0.81, 131.4, 49.49, 0.05, NULL
FROM km_equity_symbols WHERE symbol = 'HILINFRA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 923.55, 932.65, 901.0, 905.75, 964.4, -58.65, -6.08, 10170485, 928.56, 1029.8, 546.45, -3.26, 50.33
FROM km_equity_symbols WHERE symbol = 'HINDALCO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 606.0, 613.0, 585.0, 591.5, 624.7, -32.2, -5.16, 16167639, 970.87, 760.05, 183.82, 9.65, 161.85
FROM km_equity_symbols WHERE symbol = 'HINDCOPPER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 452.35, 455.25, 448.75, 451.0, 452.35, -1.35, -0.3, 1912866, 86.29, 508.45, 287.55, 0.48, 40.87
FROM km_equity_symbols WHERE symbol = 'HINDPETRO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2400.0, 2400.0, 2300.3, 2305.0, 2409.7, -104.7, -4.34, 2791519, 651.59, 2750.0, 2136.0, -3.54, -0.71
FROM km_equity_symbols WHERE symbol = 'HINDUNILVR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 599.95, 608.0, 591.0, 593.1, 623.7, -30.6, -4.91, 9424678, 562.18, 733.0, 378.15, -5.83, 44.03
FROM km_equity_symbols WHERE symbol = 'HINDZINC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 365.0, 365.0, 365.0, 365.0, 367.0, -2.0, -0.54, 1500, 0.05, 380.0, 112.0, 17.36, 197.72
FROM km_equity_symbols WHERE symbol = 'HOACFOODS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 101.9, 101.9, 101.9, 101.9, 101.9, NULL, NULL, 750, 0.01, 176.95, 86.15, -2.81, -48.23
FROM km_equity_symbols WHERE symbol = 'HOLMARC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1182.7, 1198.9, 1168.0, 1180.0, 1187.5, -7.5, -0.63, 137740, 16.27, 1519.0, 878.4, 8.09, 21.7
FROM km_equity_symbols WHERE symbol = 'HOMEFIRST'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 153.0, 156.0, 153.0, 156.0, 149.45, 6.55, 4.38, 1200, 0.02, 508.0, 148.05, -3.7, -69.29
FROM km_equity_symbols WHERE symbol = 'HOMESFY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 311.0, 319.0, 296.1, 298.8, 299.25, -0.45, -0.15, 21608840, 667.26, 334.2, 197.51, 3.0, 29.47
FROM km_equity_symbols WHERE symbol = 'HONASA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 31750.0, 31905.0, 31230.0, 31400.0, 31865.0, -465.0, -1.46, 3289, 10.32, 41450.0, 30590.0, -5.62, -10.99
FROM km_equity_symbols WHERE symbol = 'HONAUT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 245.05, 245.05, 245.0, 245.0, 256.9, -11.9, -4.63, 1800, 0.04, 327.4, 101.05, -14.93, NULL
FROM km_equity_symbols WHERE symbol = 'HPTL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 27.5, 27.5, NULL, NULL, NULL, NULL, 74.1, 25.3, -13.52, -60.43
FROM km_equity_symbols WHERE symbol = 'HRHNEXT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 450.0, 457.45, 447.0, 450.5, 452.25, -1.75, -0.39, 586000, 26.45, 534.45, 365.35, -4.95, 2.58
FROM km_equity_symbols WHERE symbol = 'HSCL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 201.5, 201.5, 193.78, 195.4, 201.93, -6.53, -3.23, 10052817, 197.0, 253.73, 158.85, -9.13, 1.47
FROM km_equity_symbols WHERE symbol = 'HUDCO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 848.0, 848.0, NULL, NULL, NULL, NULL, 1029.3, 544.5, 6.67, 34.6
FROM km_equity_symbols WHERE symbol = 'HVAX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2163.1, 2186.0, 2136.4, 2180.0, 2177.5, 2.5, 0.11, 282874, 61.4, 2890.0, 1541.7, -5.48, 21.16
FROM km_equity_symbols WHERE symbol = 'HYUNDAI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 48.0, 48.0, 48.0, 48.0, 48.0, NULL, NULL, 2000, 0.01, 74.0, 44.8, -4.95, -10.7
FROM km_equity_symbols WHERE symbol = 'IBLFL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3060.2, 3079.9, 2974.8, 3010.0, 3108.5, -98.5, -3.17, 568474, 170.93, 3150.6, 2530.0, 12.66, NULL
FROM km_equity_symbols WHERE symbol = 'ICICIAMC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1425.3, 1434.4, 1410.7, 1415.5, 1430.0, -14.5, -1.01, 12228083, 1733.58, 1500.0, 1200.1, -1.5, 13.34
FROM km_equity_symbols WHERE symbol = 'ICICIBANK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1885.7, 1927.9, 1885.7, 1903.2, 1919.8, -16.6, -0.86, 581964, 111.42, 2068.7, 1613.7, 0.94, 7.11
FROM km_equity_symbols WHERE symbol = 'ICICIGI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 635.0, 646.8, 629.85, 638.75, 638.1, 0.65, 0.1, 711887, 45.61, 706.8, 525.8, -6.27, 8.11
FROM km_equity_symbols WHERE symbol = 'ICICIPRULI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 304.5, 314.4, 294.58, 302.58, 304.21, -1.63, -0.54, 1101699, 33.62, 355.5, 213.55, 20.69, -11.87
FROM km_equity_symbols WHERE symbol = 'ICIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 109.0, 112.75, 107.77, 110.8, 110.11, 0.69, 0.63, 20065290, 221.76, 118.38, 66.5, 6.91, 49.29
FROM km_equity_symbols WHERE symbol = 'IDBI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 11.44, 11.51, 11.26, 11.28, 11.55, -0.27, -2.34, 351653687, 399.83, 12.8, 6.12, 4.44, 30.56
FROM km_equity_symbols WHERE symbol = 'IDEA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 236.5, 236.5, 200.05, 202.0, 220.0, -18.0, -8.18, 3500, 0.07, 237.65, 119.2, 1.33, 51.05
FROM km_equity_symbols WHERE symbol = 'IDEALTECHO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 20.0, 20.0, 20.0, 20.0, 20.0, NULL, NULL, 2000, NULL, 56.0, 17.05, 0.76, -56.9
FROM km_equity_symbols WHERE symbol = 'IDENTICAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 81.78, 82.35, 80.01, 81.42, 82.15, -0.73, -0.89, 14207864, 115.3, 87.0, 52.46, -1.86, 32.41
FROM km_equity_symbols WHERE symbol = 'IDFCFIRSTB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 89.9, 89.9, 86.4, 88.4, 88.2, 0.2, 0.23, 24000, 0.21, 173.57, 71.1, 10.48, -49.01
FROM km_equity_symbols WHERE symbol = 'IEML'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 125.01, 125.29, 119.38, 123.56, 125.91, -2.35, -1.87, 19551693, 239.51, 215.4, 119.0, -12.56, -27.15
FROM km_equity_symbols WHERE symbol = 'IEX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1191.0, 1219.8, 1183.0, 1187.9, 1211.6, -23.7, -1.96, 30427, 3.65, 2019.8, 1058.5, -16.42, -4.32
FROM km_equity_symbols WHERE symbol = 'IFBIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 61.2, 63.55, 59.81, 62.71, 61.9, 0.81, 1.31, 42807925, 265.62, 74.5, 36.2, 8.74, 31.11
FROM km_equity_symbols WHERE symbol = 'IFCI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 69.7, 71.49, 68.7, 70.37, 70.74, -0.37, -0.52, 51158, 0.36, 122.0, 64.5, -4.98, NULL
FROM km_equity_symbols WHERE symbol = 'IGCL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 324.5, 327.65, 320.35, 325.15, 329.35, -4.2, -1.28, 580314, 18.85, 478.0, 282.0, 3.9, -31.0
FROM km_equity_symbols WHERE symbol = 'IGIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 170.4, 170.5, 163.0, 166.79, 169.61, -2.82, -1.66, 5668937, 93.99, 229.0, 163.0, -7.92, -12.68
FROM km_equity_symbols WHERE symbol = 'IGL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 515.0, 519.95, 499.45, 507.0, 523.0, -16.0, -3.06, 2280434, 115.75, 675.0, 279.8, -20.48, 52.94
FROM km_equity_symbols WHERE symbol = 'IIFL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 324.0, 327.2, 314.25, 325.1, 324.15, 0.95, 0.29, 462811, 14.85, 411.3, 180.0, -12.16, 40.64
FROM km_equity_symbols WHERE symbol = 'IIFLCAPS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1588.0, 1665.0, 1588.0, 1665.0, 1659.4, 5.6, 0.34, 130076, 21.31, 1929.0, 1236.8, -1.89, -3.61
FROM km_equity_symbols WHERE symbol = 'IKS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 48.05, 48.5, 47.51, 48.45, 48.5, -0.05, -0.1, 377984, 1.81, 76.3, 43.9, -5.56, -32.53
FROM km_equity_symbols WHERE symbol = 'IMAGICAA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1441.1, 1468.0, 1421.1, 1435.0, 1459.4, -24.4, -1.67, 111334, 16.09, 1510.6, 549.8, 17.57, 116.64
FROM km_equity_symbols WHERE symbol = 'IMFA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 468.0, 486.6, 460.5, 474.3, 470.75, 3.55, 0.75, 1350088, 64.73, 632.9, 455.6, -7.16, -21.16
FROM km_equity_symbols WHERE symbol = 'INDGN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 707.0, 707.0, 683.4, 697.4, 712.0, -14.6, -2.05, 3861052, 268.89, 858.0, 627.2, 2.84, -5.34
FROM km_equity_symbols WHERE symbol = 'INDHOTEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 449.95, 450.2, 438.15, 441.0, 448.25, -7.25, -1.62, 138428, 6.12, 485.8, 238.85, -5.59, 56.52
FROM km_equity_symbols WHERE symbol = 'INDIACEM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 950.1, 975.3, 941.95, 952.35, 952.8, -0.45, -0.05, 134294, 12.86, 1222.0, 503.53, -1.11, 57.76
FROM km_equity_symbols WHERE symbol = 'INDIAGLYCO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2176.0, 2210.0, 2150.0, 2200.0, 2200.2, -0.2, -0.01, 89004, 19.51, 2799.0, 1900.1, 2.01, 0.03
FROM km_equity_symbols WHERE symbol = 'INDIAMART'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 875.0, 881.9, 864.15, 872.7, 880.7, -8.0, -0.91, 877486, 76.73, 923.0, 478.0, 6.72, 67.86
FROM km_equity_symbols WHERE symbol = 'INDIANB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 735.9, 755.95, 730.0, 730.0, 742.15, -12.15, -1.64, 141216, 10.5, 1011.75, 640.8, -6.84, 8.2
FROM km_equity_symbols WHERE symbol = 'INDIASHLTR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 15.05, 15.1, 15.05, 15.1, 14.4, 0.7, 4.86, 6000, 0.01, 24.5, 12.65, 3.78, -16.11
FROM km_equity_symbols WHERE symbol = 'INDIFRA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 4966.0, 4988.0, 4900.6, 4928.1, 4982.8, -54.7, -1.1, 232702, 114.84, 6232.5, 4157.85, 3.54, 12.9
FROM km_equity_symbols WHERE symbol = 'INDIGO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 999.7, 1003.0, 961.1, 971.5, 997.4, -25.9, -2.6, 86792, 8.45, 1345.9, 910.0, -20.57, -12.08
FROM km_equity_symbols WHERE symbol = 'INDIGOPNTS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 182.41, 186.1, 180.0, 181.25, 182.41, -1.16, -0.64, 26860, 0.49, 243.8, 163.51, -10.94, NULL
FROM km_equity_symbols WHERE symbol = 'INDIQUBE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 145.1, 145.1, 140.0, 140.1, 145.56, -5.46, -3.75, 272449, 3.84, 271.69, 136.8, -25.28, -30.16
FROM km_equity_symbols WHERE symbol = 'INDOFARM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 922.0, 929.95, 903.35, 926.25, 922.7, 3.55, 0.38, 2860622, 262.92, 1063.95, 606.0, 1.72, -11.55
FROM km_equity_symbols WHERE symbol = 'INDUSINDBK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 469.5, 472.0, 464.15, 466.5, 474.0, -7.5, -1.58, 4313315, 201.8, 475.0, 312.55, 9.02, 33.76
FROM km_equity_symbols WHERE symbol = 'INDUSTOWER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 219.95, 219.95, 219.95, 219.95, 219.95, NULL, NULL, 1000, 0.02, 337.0, 210.0, -0.9, -13.39
FROM km_equity_symbols WHERE symbol = 'INFINIUM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 222.0, 231.2, 220.0, 231.2, 227.85, 3.35, 1.47, 20400, 0.46, 261.95, 120.0, 16.96, NULL
FROM km_equity_symbols WHERE symbol = 'INFLUX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 350.0, 353.0, 350.0, 353.0, 353.35, -0.35, -0.1, 2000, 0.07, 575.0, 325.5, -5.92, -11.46
FROM km_equity_symbols WHERE symbol = 'INFOLLION'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1293.9, 1377.3, 1281.5, 1369.0, 1386.0, -17.0, -1.23, 45785709, 6116.33, 1894.6, 1281.5, -14.38, -25.73
FROM km_equity_symbols WHERE symbol = 'INFY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3660.0, 3849.9, 3606.4, 3733.0, 3539.7, 193.3, 5.46, 187183, 69.48, 4477.8, 3055.0, 16.65, 17.64
FROM km_equity_symbols WHERE symbol = 'INGERRAND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 199.0, 199.0, 165.05, 175.0, 179.0, -4.0, -2.23, 19200, 0.35, 344.5, 143.2, -21.46, -46.76
FROM km_equity_symbols WHERE symbol = 'INM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 85.0, 87.0, 80.0, 80.0, 81.0, -1.0, -1.23, 19200, 0.16, 216.0, 68.95, -3.64, -50.46
FROM km_equity_symbols WHERE symbol = 'INNOMET'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 691.0, 691.0, 669.8, 685.9, 691.7, -5.8, -0.84, 24129, 1.64, 1020.7, 624.0, -0.31, -18.15
FROM km_equity_symbols WHERE symbol = 'INNOVACAP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 176.1, 176.98, 169.4, 173.1, 176.1, -3.0, -1.7, 473106, 8.12, 279.0, 104.0, -7.47, 30.0
FROM km_equity_symbols WHERE symbol = 'INOXGREEN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1142.1, 1194.0, 1141.6, 1170.0, 1147.1, 22.9, 2.0, 256811, 29.96, 1288.0, 885.1, 4.64, 25.35
FROM km_equity_symbols WHERE symbol = 'INOXINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 109.0, 109.1, 105.4, 106.1, 109.32, -3.22, -2.95, 7857815, 83.81, 199.01, 101.26, -7.87, -39.18
FROM km_equity_symbols WHERE symbol = 'INOXWIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 10.0, 11.65, 10.0, 11.65, 11.0, 0.65, 5.91, 4000, NULL, 28.25, 9.5, 7.87, -53.77
FROM km_equity_symbols WHERE symbol = 'INSPIRE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 127.5, 127.5, 127.5, 127.5, 127.5, NULL, NULL, 1200, 0.02, 145.1, 81.7, -1.92, NULL
FROM km_equity_symbols WHERE symbol = 'INTEGRITY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 695.75, 700.0, 672.0, 676.9, 711.2, -34.3, -4.82, 667444, 45.7, 1255.0, 577.4, -27.29, -7.8
FROM km_equity_symbols WHERE symbol = 'INTELLECT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 35.2, 35.2, 34.64, 34.99, 35.2, -0.21, -0.6, 3921224, 13.66, 48.67, 33.5, -1.07, -27.39
FROM km_equity_symbols WHERE symbol = 'IOB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 177.28, 177.9, 176.04, 176.72, 178.11, -1.39, -0.78, 9835632, 173.97, 182.25, 110.72, 12.27, 47.17
FROM km_equity_symbols WHERE symbol = 'IOC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 381.3, 389.65, 374.35, 389.0, 386.5, 2.5, 0.65, 162739, 6.24, 580.75, 322.1, 11.19, -26.78
FROM km_equity_symbols WHERE symbol = 'IONEXCHANG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1458.0, 1503.9, 1428.8, 1474.0, 1472.9, 1.1, 0.07, 408095, 60.46, 1595.0, 1168.2, -2.24, -1.13
FROM km_equity_symbols WHERE symbol = 'IPCALAB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 61.8, 61.8, 58.05, 58.6, 61.9, -3.3, -5.33, 10800, 0.06, 78.25, 42.4, -2.82, -10.26
FROM km_equity_symbols WHERE symbol = 'IPHL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 273.0, 273.0, NULL, NULL, NULL, NULL, 385.0, 240.05, 1.11, -15.73
FROM km_equity_symbols WHERE symbol = 'IPSL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 44.28, 44.45, 43.75, 43.95, 44.46, -0.51, -1.15, 7597646, 33.48, 54.28, 38.57, 7.43, -11.16
FROM km_equity_symbols WHERE symbol = 'IRB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 153.97, 154.1, 151.27, 152.9, 154.47, -1.57, -1.02, 1429611, 21.8, 225.52, 134.24, -5.76, -8.63
FROM km_equity_symbols WHERE symbol = 'IRCON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 625.0, 632.75, 612.0, 614.95, 622.05, -7.1, -1.14, 3930956, 245.44, 820.25, 596.0, -2.42, -17.61
FROM km_equity_symbols WHERE symbol = 'IRCTC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 124.55, 124.58, 121.65, 123.73, 125.22, -1.49, -1.19, 10190497, 125.17, 187.7, 121.65, -11.62, -30.12
FROM km_equity_symbols WHERE symbol = 'IREDA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 112.8, 112.85, 111.05, 111.4, 113.53, -2.13, -1.88, 13084758, 145.99, 148.95, 108.04, -8.18, -11.99
FROM km_equity_symbols WHERE symbol = 'IRFC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 875.0, 896.0, 861.6, 868.0, 886.95, -18.95, -2.14, 91398, 8.04, 1281.3, 683.95, 9.17, -13.0
FROM km_equity_symbols WHERE symbol = 'ISGEC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 0.75, 0.75, 0.7, 0.7, 0.75, -0.05, -6.67, 96000, 0.01, 1.7, 0.65, -6.67, -57.58
FROM km_equity_symbols WHERE symbol = 'ISHAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 26.0, 26.5, 26.0, 26.5, 26.0, 0.5, 1.92, 4000, 0.01, 41.0, 24.05, -2.75, -28.38
FROM km_equity_symbols WHERE symbol = 'ITALIANE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 316.0, 318.4, 313.25, 313.6, 317.45, -3.85, -1.21, 8730618, 275.33, 444.2, 302.0, -6.3, -23.46
FROM km_equity_symbols WHERE symbol = 'ITC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 184.0, 184.0, 179.04, 179.9, 184.68, -4.78, -2.59, 2674430, 48.26, 261.62, 158.35, -6.52, 5.91
FROM km_equity_symbols WHERE symbol = 'ITCHOTELS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 291.95, 291.95, 285.8, 288.0, 293.6, -5.6, -1.91, 243309, 7.02, 372.85, 234.04, -5.57, 1.28
FROM km_equity_symbols WHERE symbol = 'ITI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 68.45, 68.5, -0.05, -0.07, NULL, NULL, 152.4, 28.8, -27.09, 142.48
FROM km_equity_symbols WHERE symbol = 'ITTL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 241.5, 245.8, 236.0, 239.5, 247.1, -7.6, -3.08, 134577, 3.24, 340.0, 213.98, -3.66, NULL
FROM km_equity_symbols WHERE symbol = 'IVALUE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 251.5, 251.5, 247.0, 247.0, 260.0, -13.0, -5.0, 28800, 0.71, 269.65, 70.05, 22.89, NULL
FROM km_equity_symbols WHERE symbol = 'IWARE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 209.99, 209.99, 192.25, 195.0, 211.92, -16.92, -7.98, 3159946, 62.73, 339.15, 117.0, -13.58, 34.82
FROM km_equity_symbols WHERE symbol = 'IXIGO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 102.66, 103.03, 101.21, 101.74, 103.53, -1.79, -1.73, 1537122, 15.67, 117.25, 87.3, 1.29, 4.78
FROM km_equity_symbols WHERE symbol = 'J&KBANK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 70.0, 70.62, 67.62, 68.9, 73.44, -4.54, -6.18, 2641685, 18.35, 158.0, 59.9, 4.82, -53.34
FROM km_equity_symbols WHERE symbol = 'JAIBALAJI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 210.0, 212.1, 210.0, 210.0, 220.7, -10.7, -4.85, 27000, 0.57, 322.85, 191.9, -11.34, -12.45
FROM km_equity_symbols WHERE symbol = 'JAINAM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 129.05, 129.05, NULL, NULL, NULL, NULL, 153.1, 60.6, 4.92, NULL
FROM km_equity_symbols WHERE symbol = 'JAINIK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 394.0, 394.0, 378.0, 379.8, 396.7, -16.9, -4.26, 1140426, 44.08, 461.0, 247.57, -8.23, NULL
FROM km_equity_symbols WHERE symbol = 'JAINREC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 60.5, 60.5, NULL, NULL, NULL, NULL, 60.7, 21.23, NULL, -5.02
FROM km_equity_symbols WHERE symbol = 'JAKHARIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3.6, 3.6, 3.6, 3.6, 3.5, 0.1, 2.86, 3000, NULL, 14.6, 2.5, -10.0, -68.14
FROM km_equity_symbols WHERE symbol = 'JALAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 134.95, 147.9, 129.52, 136.0, 136.98, -0.98, -0.72, 27116562, 378.79, 147.9, 68.57, 1.86, 62.66
FROM km_equity_symbols WHERE symbol = 'JAMNAAUTO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 478.8, 485.9, 465.4, 470.2, 477.4, -7.2, -1.51, 88019, 4.16, 890.0, 386.0, 11.38, NULL
FROM km_equity_symbols WHERE symbol = 'JARO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 91.95, 98.6, 88.25, 89.2, 91.95, -2.75, -2.99, 51000, 0.47, 300.0, 78.0, -10.95, -66.89
FROM km_equity_symbols WHERE symbol = 'JAYBEE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 144.0, 144.0, 144.0, 144.0, 147.0, -3.0, -2.04, 3000, 0.04, 183.0, 106.35, -7.4, NULL
FROM km_equity_symbols WHERE symbol = 'JAYESH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1890.0, 1926.0, 1884.3, 1889.8, 1910.1, -20.3, -1.06, 383166, 73.03, 1939.0, 1385.75, 1.12, 12.24
FROM km_equity_symbols WHERE symbol = 'JBCHEPHARM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 593.05, 593.05, 578.0, 578.95, 596.5, -17.55, -2.94, 206986, 12.05, 790.0, 489.8, -4.73, -8.15
FROM km_equity_symbols WHERE symbol = 'JBMA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 37.2, 37.2, 35.1, 35.1, 36.6, -1.5, -4.1, 88000, 0.32, 74.5, 31.0, -30.07, -11.63
FROM km_equity_symbols WHERE symbol = 'JEYYAM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 12.0, 12.0, NULL, NULL, NULL, NULL, 22.35, 10.0, 9.09, -46.19
FROM km_equity_symbols WHERE symbol = 'JFLLIFE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 190.0, 191.57, 186.4, 189.55, 191.89, -2.34, -1.22, 1568632, 29.59, 286.4, 153.0, 17.35, -22.79
FROM km_equity_symbols WHERE symbol = 'JINDALSAW'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1193.4, 1193.4, 1167.3, 1183.6, 1203.4, -19.8, -1.65, 1302484, 153.91, 1207.0, 770.0, 17.1, 40.82
FROM km_equity_symbols WHERE symbol = 'JINDALSTEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 27.2, 27.36, 26.42, 26.75, 27.47, -0.72, -2.62, 211521, 0.57, 82.7, 23.25, -1.69, -64.99
FROM km_equity_symbols WHERE symbol = 'JINDWORLD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 265.0, 267.25, 262.85, 263.85, 267.55, -3.7, -1.38, 12222314, 323.3, 338.6, 198.65, -7.29, 15.69
FROM km_equity_symbols WHERE symbol = 'JIOFIN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 36.0, 38.69, 35.29, 37.31, 36.28, 1.03, 2.84, 5955739, 22.32, 66.65, 33.4, -3.14, -42.01
FROM km_equity_symbols WHERE symbol = 'JISLJALEQS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 6.3, 6.35, 5.7, 5.7, 5.5, 0.2, 3.64, 36000, 0.02, 11.8, 4.8, 8.57, -42.71
FROM km_equity_symbols WHERE symbol = 'JIWANRAM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 5779.0, 5787.5, 5580.0, 5596.0, 5812.0, -216.0, -3.72, 39240, 22.15, 7565.5, 4218.9, -3.23, 16.68
FROM km_equity_symbols WHERE symbol = 'JKCEMENT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 560.85, 564.8, 551.05, 557.0, 560.85, -3.85, -0.69, 120401, 6.71, 765.6, 529.0, 0.72, -21.73
FROM km_equity_symbols WHERE symbol = 'JKIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 715.0, 715.8, 701.55, 709.55, 716.05, -6.5, -0.91, 105015, 7.43, 1021.2, 660.5, -6.77, -6.16
FROM km_equity_symbols WHERE symbol = 'JKLAKSHMI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 343.0, 344.95, 336.5, 337.3, 345.75, -8.45, -2.44, 190931, 6.47, 444.8, 275.75, -3.9, 4.04
FROM km_equity_symbols WHERE symbol = 'JKPAPER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 582.0, 598.0, 575.5, 586.3, 582.75, 3.55, 0.61, 2096508, 123.36, 611.9, 243.0, 16.28, 99.76
FROM km_equity_symbols WHERE symbol = 'JKTYRE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 139.5, 139.79, 135.7, 135.72, 141.1, -5.38, -3.81, 2598697, 35.76, 199.8, 80.2, 0.29, 32.76
FROM km_equity_symbols WHERE symbol = 'JMFINANCIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 15.32, 15.32, 14.82, 14.92, 15.33, -0.41, -2.67, 26034826, 39.16, 27.7, 12.36, -10.39, 6.27
FROM km_equity_symbols WHERE symbol = 'JPPOWER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 388.9, 402.0, 385.0, 385.25, 395.9, -10.65, -2.69, 403525, 15.87, 552.5, 338.9, -4.49, -4.26
FROM km_equity_symbols WHERE symbol = 'JSFB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 797.05, 798.0, 760.25, 766.8, 799.6, -32.8, -4.1, 413859, 32.0, 884.0, 496.6, -2.24, 25.96
FROM km_equity_symbols WHERE symbol = 'JSL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 119.0, 120.32, 117.13, 119.0, 119.65, -0.65, -0.54, 1343607, 15.96, 162.15, 106.65, -2.73, NULL
FROM km_equity_symbols WHERE symbol = 'JSWCEMENT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 479.0, 479.0, 468.85, 471.4, 479.5, -8.1, -1.69, 1171877, 55.54, 579.0, 418.75, -4.6, 0.8
FROM km_equity_symbols WHERE symbol = 'JSWENERGY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 261.0, 261.0, 257.05, 257.75, 263.15, -5.4, -2.05, 757515, 19.6, 349.0, 218.2, -2.5, 7.15
FROM km_equity_symbols WHERE symbol = 'JSWINFRA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1240.0, 1247.8, 1225.2, 1229.1, 1247.9, -18.8, -1.51, 1726700, 213.14, 1261.9, 905.2, 4.33, 26.74
FROM km_equity_symbols WHERE symbol = 'JSWSTEEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 540.75, 543.65, 525.25, 533.05, 540.75, -7.7, -1.42, 1514289, 80.95, 727.95, 481.1, 0.96, -19.49
FROM km_equity_symbols WHERE symbol = 'JUBLFOOD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 659.95, 659.95, 635.55, 636.95, 661.8, -24.85, -3.75, 102014, 6.6, 851.8, 535.2, -6.92, -3.44
FROM km_equity_symbols WHERE symbol = 'JUBLINGREA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 935.95, 936.55, 910.0, 910.5, 943.25, -32.75, -3.47, 88066, 8.12, 1248.0, 802.0, -12.5, -5.2
FROM km_equity_symbols WHERE symbol = 'JUBLPHARMA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 666.0, 670.0, 640.0, 642.6, 671.9, -29.3, -4.36, 186707, 12.07, 1048.9, 632.15, -12.35, -21.51
FROM km_equity_symbols WHERE symbol = 'JUSTDIAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 297.55, 299.2, 292.0, 293.0, 299.7, -6.7, -2.24, 918061, 27.07, 457.0, 247.15, -0.41, -10.1
FROM km_equity_symbols WHERE symbol = 'JWL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 247.0, 247.0, 242.13, 244.25, 248.32, -4.07, -1.64, 265474, 6.49, 399.9, 238.71, -6.2, -32.74
FROM km_equity_symbols WHERE symbol = 'JYOTHYLAB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 840.0, 846.8, 821.9, 828.0, 852.3, -24.3, -2.85, 302591, 25.13, 1330.0, 750.0, -11.54, -22.27
FROM km_equity_symbols WHERE symbol = 'JYOTICNC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 48.9, 51.0, 48.9, 49.5, 47.6, 1.9, 3.99, 12000, 0.06, 77.75, 35.45, 7.97, NULL
FROM km_equity_symbols WHERE symbol = 'JYOTIGLOBL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 63.45, 63.45, 60.25, 60.25, 63.45, -3.2, -5.04, 9600, 0.06, 128.0, 52.5, -16.67, -60.45
FROM km_equity_symbols WHERE symbol = 'K2INFRA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 955.0, 955.0, 935.35, 937.45, 955.4, -17.95, -1.88, 65100, 6.14, 1321.9, 758.7, -5.74, 0.83
FROM km_equity_symbols WHERE symbol = 'KAJARIACER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 16.65, 16.65, 16.0, 16.0, 17.2, -1.2, -6.98, 50000, 0.08, 55.0, 15.95, -24.29, -58.79
FROM km_equity_symbols WHERE symbol = 'KALANA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 343.95, 371.0, 342.6, 350.0, 350.5, -0.5, -0.14, 79377, 2.82, 457.4, 319.1, -2.43, NULL
FROM km_equity_symbols WHERE symbol = 'KALPATARU'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 429.9, 429.9, 415.1, 417.9, 432.5, -14.6, -3.38, 6604401, 277.37, 617.7, 347.5, -15.65, -20.62
FROM km_equity_symbols WHERE symbol = 'KALYANKJIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 158.75, 158.75, 142.0, 145.0, 150.4, -5.4, -3.59, 6000, 0.09, 160.0, 51.35, 2.8, 166.3
FROM km_equity_symbols WHERE symbol = 'KANDARP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 200.1, 201.51, 196.7, 201.0, 202.42, -1.42, -0.7, 553280, 10.99, 271.18, 196.7, -13.46, -14.36
FROM km_equity_symbols WHERE symbol = 'KANSAINER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 139.3, 139.3, 132.15, 132.15, 132.7, -0.55, -0.41, 42000, 0.57, 224.95, 70.3, 9.9, -64.74
FROM km_equity_symbols WHERE symbol = 'KARNIKA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 315.0, 320.95, 313.1, 315.5, 318.85, -3.35, -1.05, 1923872, 60.85, 327.9, 154.63, 19.15, 68.14
FROM km_equity_symbols WHERE symbol = 'KARURVYSYA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 98.25, 101.45, 98.25, 100.55, 100.55, NULL, NULL, 6000, 0.06, 129.0, 85.5, -1.37, -16.91
FROM km_equity_symbols WHERE symbol = 'KATARIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 4049.7, 4049.7, 3892.0, 3943.2, 4086.6, -143.4, -3.51, 1889857, 746.57, 7705.0, 3294.9, 6.73, -4.71
FROM km_equity_symbols WHERE symbol = 'KAYNES'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 56.1, 56.1, NULL, NULL, NULL, NULL, 156.9, 54.5, -13.56, NULL
FROM km_equity_symbols WHERE symbol = 'KAYTEX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 137.0, 138.0, 132.05, 135.0, 138.75, -3.75, -2.7, 12500, 0.17, 388.05, 108.0, 0.87, -45.27
FROM km_equity_symbols WHERE symbol = 'KCEIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 21.45, 22.35, 20.6, 21.65, 21.6, 0.05, 0.23, 42500, 0.09, 52.35, 15.8, -9.68, -58.67
FROM km_equity_symbols WHERE symbol = 'KCK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 144.25, 150.6, 140.2, 140.2, 147.55, -7.35, -4.98, 45450, 0.65, 488.0, 135.2, -18.4, -74.31
FROM km_equity_symbols WHERE symbol = 'KDL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 611.15, 613.75, 600.0, 602.25, 612.35, -10.1, -1.65, 453299, 27.36, 947.0, 600.0, -12.2, -22.42
FROM km_equity_symbols WHERE symbol = 'KEC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 4589.1, 4618.9, 4510.0, 4568.0, 4591.3, -23.3, -0.51, 184007, 84.08, 4646.0, 2424.0, 5.97, 34.2
FROM km_equity_symbols WHERE symbol = 'KEI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 86.0, 94.0, 84.0, 89.0, 97.0, -8.0, -8.25, 22800, 0.2, 148.0, 81.0, -9.2, -33.81
FROM km_equity_symbols WHERE symbol = 'KEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 42.0, 42.0, 40.1, 40.1, 41.4, -1.3, -3.14, 10800, 0.04, 85.0, 35.25, -5.87, -47.75
FROM km_equity_symbols WHERE symbol = 'KEN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 980.0, 983.6, 955.6, 965.5, 985.0, -19.5, -1.98, 803219, 77.71, 1388.5, 784.15, -8.47, -3.47
FROM km_equity_symbols WHERE symbol = 'KFINTECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 69.1, 69.1, 68.0, 69.0, 68.45, 0.55, 0.8, 9300, 0.06, 98.8, 54.5, -7.26, -21.83
FROM km_equity_symbols WHERE symbol = 'KHFM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 685.0, 709.55, 670.15, 680.0, 697.8, -17.8, -2.55, 585237, 40.77, 798.4, 474.05, 9.18, 14.94
FROM km_equity_symbols WHERE symbol = 'KIMS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1610.8, 1615.5, 1576.2, 1605.5, 1618.9, -13.4, -0.83, 33026, 5.28, 2475.0, 1422.35, -0.98, -8.65
FROM km_equity_symbols WHERE symbol = 'KIRLOSBROS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1340.0, 1394.4, 1330.2, 1371.0, 1337.0, 34.0, 2.54, 1586476, 219.09, 1434.9, 544.4, 19.14, 91.53
FROM km_equity_symbols WHERE symbol = 'KIRLOSENG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1150.1, 1156.5, 1132.0, 1140.1, 1157.0, -16.9, -1.46, 66630, 7.61, 1550.0, 953.0, 8.47, 10.7
FROM km_equity_symbols WHERE symbol = 'KIRLPNU'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 202.5, 206.8, 193.27, 196.29, 199.5, -3.21, -1.61, 4474562, 89.83, 324.42, 138.2, 26.45, -5.08
FROM km_equity_symbols WHERE symbol = 'KITEX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 90.0, 91.75, 84.95, 91.35, 89.05, 2.3, 2.58, 74000, 0.64, 190.0, 84.0, -5.25, -51.56
FROM km_equity_symbols WHERE symbol = 'KKJEWELS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 693.0, 693.0, NULL, NULL, NULL, NULL, 693.0, 440.45, 13.61, -0.99
FROM km_equity_symbols WHERE symbol = 'KKVAPOW'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 43.05, 43.05, 43.05, 43.05, 43.05, NULL, NULL, 1600, 0.01, 98.0, 40.6, -9.18, -53.83
FROM km_equity_symbols WHERE symbol = 'KLL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 145.7, 145.7, 140.54, 141.0, 146.48, -5.48, -3.74, 888148, 12.59, 269.45, 130.28, -0.63, -45.87
FROM km_equity_symbols WHERE symbol = 'KNRCON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 764.15, 806.4, 760.0, 806.4, 768.0, 38.4, 5.0, 3900, 0.31, 1250.0, 556.05, -5.31, -32.89
FROM km_equity_symbols WHERE symbol = 'KODYTECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 42.15, 42.15, 42.15, 42.15, 42.1, 0.05, 0.12, 1000, NULL, 99.0, 38.5, -10.03, -55.7
FROM km_equity_symbols WHERE symbol = 'KONSTELEC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 75.9, 77.0, 72.0, 77.0, 76.9, 0.1, 0.13, 9600, 0.07, 93.5, 53.25, 15.96, -13.97
FROM km_equity_symbols WHERE symbol = 'KONTOR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 128.6, 132.0, 121.6, 132.0, 128.0, 4.0, 3.13, 2000, 0.03, 304.9, 110.2, -10.2, -54.6
FROM km_equity_symbols WHERE symbol = 'KORE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 426.0, 428.9, 419.55, 421.9, 426.25, -4.35, -1.02, 23233320, 979.82, 460.38, 378.78, -1.08, 6.93
FROM km_equity_symbols WHERE symbol = 'KOTAKBANK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 234.8, 244.5, 231.15, 236.15, 226.1, 10.05, 4.44, 13800, 0.33, 700.0, 191.2, 10.42, -64.53
FROM km_equity_symbols WHERE symbol = 'KOTYARK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 398.55, 407.0, 398.55, 403.0, 412.05, -9.05, -2.2, 589253, 23.79, 563.0, 336.0, -10.05, -5.74
FROM km_equity_symbols WHERE symbol = 'KPIGREEN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1101.9, 1108.9, 1078.1, 1096.2, 1101.9, -5.7, -0.52, 66660, 7.28, 1335.6, 786.3, -2.79, 11.6
FROM km_equity_symbols WHERE symbol = 'KPIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 870.0, 873.6, 812.9, 860.3, 891.5, -31.2, -3.5, 6026791, 509.38, 1434.5, 812.9, -26.7, -35.82
FROM km_equity_symbols WHERE symbol = 'KPITTECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 897.0, 988.7, 869.05, 926.0, 897.8, 30.7, 3.43, 3875768, 367.65, 1389.0, 755.5, 8.39, 5.8
FROM km_equity_symbols WHERE symbol = 'KPRMILL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 371.0, 373.7, 362.5, 363.4, 371.55, -8.15, -2.19, 586708, 21.56, 495.0, 241.25, 0.35, 29.03
FROM km_equity_symbols WHERE symbol = 'KRBL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 181.0, 181.0, 175.55, 176.5, 176.65, -0.15, -0.08, 11500, 0.2, 300.0, 150.0, -10.66, -19.34
FROM km_equity_symbols WHERE symbol = 'KRISHCA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 725.0, 737.0, 712.2, 713.5, 734.1, -20.6, -2.81, 226238, 16.35, 1010.0, 589.8, 0.27, -19.63
FROM km_equity_symbols WHERE symbol = 'KRN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 716.0, 719.65, 707.65, 707.65, 720.85, -13.2, -1.83, 32687, 2.33, 912.0, 582.25, -3.58, 16.01
FROM km_equity_symbols WHERE symbol = 'KSB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 900.4, 900.4, 865.15, 872.85, 902.85, -30.0, -3.32, 109258, 9.57, 1602.0, 797.0, -2.71, -5.87
FROM km_equity_symbols WHERE symbol = 'KSCL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 365.05, 365.05, 356.45, 359.5, 365.1, -5.6, -1.53, 81268, 2.93, 403.7, 330.0, 8.32, NULL
FROM km_equity_symbols WHERE symbol = 'KSHINTL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 758.15, 762.3, 734.45, 744.8, 758.15, -13.35, -1.76, 30724, 2.3, 988.8, 660.2, 6.88, -6.43
FROM km_equity_symbols WHERE symbol = 'KSL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 200.9, 205.4, 198.55, 202.1, 201.23, 0.87, 0.43, 3065170, 61.98, 220.4, 162.2, 8.42, 12.65
FROM km_equity_symbols WHERE symbol = 'KTKBANK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 110.2, 110.2, NULL, NULL, NULL, NULL, 225.9, 102.25, -8.09, -50.06
FROM km_equity_symbols WHERE symbol = 'LAKSHYA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1430.0, 1430.0, 1389.1, 1406.2, 1435.3, -29.1, -2.03, 137684, 19.32, 1770.0, 1146.78, -1.04, 7.2
FROM km_equity_symbols WHERE symbol = 'LALPATHLAB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 29.2, 29.2, 24.95, 26.9, 29.2, -2.3, -7.88, 42000, 0.11, 57.25, 24.5, -17.24, -49.52
FROM km_equity_symbols WHERE symbol = 'LAMOSAIC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 382.0, 395.9, 379.3, 387.0, 390.85, -3.85, -0.99, 791423, 30.87, 517.5, 341.2, -11.94, -6.96
FROM km_equity_symbols WHERE symbol = 'LATENTVIEW'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1008.5, 1021.35, 1001.8, 1010.0, 1018.6, -8.6, -0.84, 1053338, 106.64, 1141.0, 512.35, -4.56, 68.05
FROM km_equity_symbols WHERE symbol = 'LAURUSLABS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 204.0, 205.02, 191.01, 193.0, 203.47, -10.47, -5.15, 219126, 4.28, 509.95, 180.3, -20.89, -54.04
FROM km_equity_symbols WHERE symbol = 'LAXMIDENTL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 108.64, 108.99, 102.4, 102.4, 108.64, -6.24, -5.74, 288495, 3.0, 180.9, 85.87, -5.12, NULL
FROM km_equity_symbols WHERE symbol = 'LAXMIINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 130.5, 130.51, 126.22, 127.57, 131.23, -3.66, -2.79, 3582998, 45.77, 180.68, 117.51, -15.8, -4.96
FROM km_equity_symbols WHERE symbol = 'LEMONTREE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 530.95, 533.0, 490.05, 496.8, 513.0, -16.2, -3.16, 12168797, 629.01, 533.0, 356.1, 11.15, NULL
FROM km_equity_symbols WHERE symbol = 'LENSKART'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1468.0, 1531.9, 1461.3, 1507.1, 1469.0, 38.1, 2.59, 1200452, 181.27, 1749.0, 1325.5, 7.73, NULL
FROM km_equity_symbols WHERE symbol = 'LGEINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 515.0, 515.35, 506.7, 507.0, 517.1, -10.1, -1.95, 967179, 49.3, 646.5, 483.7, -2.7, -8.03
FROM km_equity_symbols WHERE symbol = 'LICHSGFIN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 872.4, 877.0, 856.2, 861.8, 880.95, -19.15, -2.17, 875027, 75.95, 980.0, 715.3, 3.61, 9.81
FROM km_equity_symbols WHERE symbol = 'LICI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 6419.0, 6967.0, 6394.0, 6880.0, 6440.5, 439.5, 6.82, 404286, 275.96, 7870.0, 5242.4, 13.1, 20.85
FROM km_equity_symbols WHERE symbol = 'LINDEINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 58.5, 59.0, 57.0, 57.0, 58.5, -1.5, -2.56, 5000, 0.03, 125.75, 56.0, -10.66, -29.67
FROM km_equity_symbols WHERE symbol = 'LLOYDS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 52.98, 54.3, 51.83, 54.0, 53.54, 0.46, 0.86, 2489231, 13.12, 84.27, 41.13, 5.72, -13.74
FROM km_equity_symbols WHERE symbol = 'LLOYDSENGG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 56.75, 56.75, 54.82, 54.86, 57.21, -2.35, -4.11, 2055207, 11.45, 88.44, 34.2, -8.31, 19.11
FROM km_equity_symbols WHERE symbol = 'LLOYDSENT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1220.1, 1220.1, 1181.1, 1193.0, 1225.6, -32.6, -2.66, 316311, 37.72, 1612.0, 942.15, -3.46, 0.07
FROM km_equity_symbols WHERE symbol = 'LLOYDSME'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 15416.0, 15429.0, 14937.0, 15010.0, 15416.0, -406.0, -2.63, 2436, 3.72, 18250.0, 13450.05, 6.57, 0.92
FROM km_equity_symbols WHERE symbol = 'LMW'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1071.25, 1079.05, 1045.9, 1070.35, 1084.85, -14.5, -1.34, 1795630, 191.47, 1531.0, 863.8, -0.38, -8.77
FROM km_equity_symbols WHERE symbol = 'LODHA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 150.9, 150.9, 143.55, 144.0, 151.57, -7.57, -4.99, 1824842, 26.75, 218.49, 137.6, -5.16, NULL
FROM km_equity_symbols WHERE symbol = 'LOTUSDEV'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 61.5, 64.25, 61.5, 64.25, 61.9, 2.35, 3.8, 7500, 0.05, 99.5, 48.6, -6.88, -7.15
FROM km_equity_symbols WHERE symbol = 'LRRPL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 4174.1, 4199.0, 4134.1, 4172.0, 4185.9, -13.9, -0.33, 2234376, 932.89, 4199.0, 2965.3, 7.32, 27.83
FROM km_equity_symbols WHERE symbol = 'LT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 291.0, 291.2, 283.7, 284.85, 292.05, -7.2, -2.47, 4322331, 123.52, 329.45, 131.05, -1.32, 102.99
FROM km_equity_symbols WHERE symbol = 'LTF'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 427.0, 441.95, 423.0, 430.5, 428.85, 1.65, 0.38, 1145234, 49.75, 518.55, 288.25, 15.08, 9.4
FROM km_equity_symbols WHERE symbol = 'LTFOODS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 5004.0, 5178.5, 4988.0, 5124.5, 5211.5, -87.0, -1.67, 687029, 349.33, 6429.5, 3802.0, -16.0, -8.51
FROM km_equity_symbols WHERE symbol = 'LTIM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3640.0, 3678.1, 3490.0, 3504.3, 3704.1, -199.8, -5.39, 256090, 90.56, 5322.0, 3490.0, -18.84, -30.24
FROM km_equity_symbols WHERE symbol = 'LTTS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1760.0, 1760.0, 1603.0, 1620.0, 1784.2, -164.2, -9.2, 722582, 119.97, 1823.9, 449.0, 8.09, 191.73
FROM km_equity_symbols WHERE symbol = 'LUMAXTECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2210.0, 2219.2, 2160.0, 2194.0, 2211.1, -17.1, -0.77, 1126141, 246.92, 2244.5, 1795.2, 0.69, 6.75
FROM km_equity_symbols WHERE symbol = 'LUPIN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 971.6, 988.0, 960.5, 971.05, 986.1, -15.05, -1.53, 29616, 2.89, 1645.8, 873.0, -0.49, -34.29
FROM km_equity_symbols WHERE symbol = 'LUXIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 152.5, 152.5, 146.06, 146.11, 151.87, -5.76, -3.79, 271745, 4.01, 241.0, 133.61, -3.49, -28.44
FROM km_equity_symbols WHERE symbol = 'LXCHEM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3530.0, 3596.5, 3520.3, 3533.0, 3593.1, -60.1, -1.67, 1632115, 580.38, 3839.9, 2425.0, -3.51, 18.64
FROM km_equity_symbols WHERE symbol = 'M&M'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 377.2, 377.2, 361.55, 363.0, 379.05, -16.05, -4.23, 1023886, 37.7, 412.2, 231.02, 0.06, 32.3
FROM km_equity_symbols WHERE symbol = 'M&MFIN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 229.0, 229.0, 221.0, 221.0, 212.25, 8.75, 4.12, 38400, 0.87, 246.95, 150.6, 6.76, 32.34
FROM km_equity_symbols WHERE symbol = 'MACOBSTECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 208.0, 219.0, 208.0, 216.0, 222.0, -6.0, -2.7, 1600, 0.03, 335.0, 81.1, -13.6, 83.05
FROM km_equity_symbols WHERE symbol = 'MADHAVBAUG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 138.0, 138.25, 135.0, 135.0, 136.4, -1.4, -1.03, 4000, 0.05, 190.0, 108.6, 16.93, -19.64
FROM km_equity_symbols WHERE symbol = 'MADHUSUDAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 140.0, 140.0, 140.0, 140.0, 138.0, 2.0, 1.45, 107000, 1.5, 166.1, 92.6, 10.24, 40.7
FROM km_equity_symbols WHERE symbol = 'MAGSON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 65.4, 66.0, 64.79, 65.25, 65.59, -0.34, -0.52, 8944798, 58.63, 67.74, 42.0, 0.31, 32.78
FROM km_equity_symbols WHERE symbol = 'MAHABANK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 165.8, 170.0, 165.0, 165.0, 167.1, -2.1, -1.26, 7500, 0.12, 185.0, 95.2, 5.68, 58.32
FROM km_equity_symbols WHERE symbol = 'MAHICKRA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 366.0, 372.95, 360.35, 366.1, 370.3, -4.2, -1.13, 106764, 3.93, 427.05, 255.69, -0.41, 11.28
FROM km_equity_symbols WHERE symbol = 'MAHLIFE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 13537.0, 13537.0, 13300.0, 13535.0, 13538.0, -3.0, -0.02, 1310, 1.76, 18538.0, 8822.0, -1.93, 45.32
FROM km_equity_symbols WHERE symbol = 'MAHSCOOTER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 547.0, 547.0, 532.8, 534.5, 547.1, -12.6, -2.3, 64856, 3.48, 773.8, 500.7, 2.56, -13.43
FROM km_equity_symbols WHERE symbol = 'MAHSEAMLES'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 220.0, 223.0, 201.0, 212.0, 200.0, 12.0, 6.0, 6000, 0.13, 329.0, 186.0, -2.71, -31.36
FROM km_equity_symbols WHERE symbol = 'MAITREYA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 28.05, 28.05, NULL, NULL, NULL, NULL, 36.0, 25.5, -4.92, -12.34
FROM km_equity_symbols WHERE symbol = 'MAKS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 47.5, 51.0, 47.5, 51.0, 49.95, 1.05, 2.1, 9600, 0.05, 80.2, 26.25, 1.29, 57.89
FROM km_equity_symbols WHERE symbol = 'MAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 306.7, 306.7, 296.6, 302.15, 308.65, -6.5, -2.11, 4916102, 148.05, 321.6, 168.83, -1.92, 55.7
FROM km_equity_symbols WHERE symbol = 'MANAPPURAM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 36.2, 36.2, 36.2, 36.2, 34.5, 1.7, 4.93, 8000, 0.03, 36.2, 10.5, 21.07, 113.57
FROM km_equity_symbols WHERE symbol = 'MANAV'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 21.5, 21.5, 19.55, 19.55, 20.5, -0.95, -4.63, 4000, 0.01, 31.9, 17.8, -12.92, -23.78
FROM km_equity_symbols WHERE symbol = 'MANDEEP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 112.25, 113.32, 109.8, 111.3, 113.32, -2.02, -1.78, 336507, 3.74, 190.83, 99.0, -6.16, -37.78
FROM km_equity_symbols WHERE symbol = 'MANINFRA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2076.1, 2085.3, 2050.1, 2060.3, 2079.0, -18.7, -0.9, 208497, 43.08, 2716.5, 2033.0, -6.94, -17.63
FROM km_equity_symbols WHERE symbol = 'MANKIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1419.2, 1438.8, 1404.9, 1415.0, 1431.7, -16.7, -1.17, 75928, 10.79, 1760.0, 740.5, 6.97, 28.65
FROM km_equity_symbols WHERE symbol = 'MANORAMA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 479.05, 479.1, 452.0, 453.1, 479.5, -26.4, -5.51, 280224, 12.9, 921.15, 452.0, -16.24, -49.29
FROM km_equity_symbols WHERE symbol = 'MANYAVAR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1280.0, 1280.0, 1220.1, 1223.7, 1285.4, -61.7, -4.8, 98667, 12.26, 2166.7, 1220.1, -21.7, -26.16
FROM km_equity_symbols WHERE symbol = 'MAPMYINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 29.55, 29.55, 29.1, 29.1, 30.5, -1.4, -4.59, 3000, 0.01, 54.5, 26.75, -18.72, -40.2
FROM km_equity_symbols WHERE symbol = 'MARCO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 769.0, 771.85, 757.85, 760.4, 770.65, -10.25, -1.33, 966405, 73.78, 780.0, 577.85, 0.58, 19.84
FROM km_equity_symbols WHERE symbol = 'MARICO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 19.65, 19.65, 19.65, 19.65, 19.65, NULL, NULL, 8000, 0.02, 28.2, 13.3, -1.26, -13.63
FROM km_equity_symbols WHERE symbol = 'MARINETRAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 185.0, 186.8, 180.95, 181.5, 187.87, -6.37, -3.39, 451836, 8.25, 270.7, 156.0, 4.58, -27.18
FROM km_equity_symbols WHERE symbol = 'MARKSANS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 15309.0, 15434.0, 15190.0, 15211.0, 15326.0, -115.0, -0.75, 208645, 319.38, 17370.0, 11059.45, -7.4, 20.04
FROM km_equity_symbols WHERE symbol = 'MARUTI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 178.6, 178.6, 176.45, 176.65, 174.55, 2.1, 1.2, 2000, 0.04, 220.0, 73.5, -4.25, 70.68
FROM km_equity_symbols WHERE symbol = 'MASON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1745.0, 1769.9, 1676.2, 1754.0, 1790.3, -36.3, -2.03, 169140, 29.13, 2818.0, 1676.2, -13.8, -32.68
FROM km_equity_symbols WHERE symbol = 'MASTEK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 310.0, 310.0, NULL, NULL, NULL, NULL, 436.0, 258.4, NULL, 9.06
FROM km_equity_symbols WHERE symbol = 'MASTER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 410.1, 415.1, 405.05, 406.0, 412.05, -6.05, -1.47, 90863, 3.73, 564.3, 341.1, -3.94, -14.3
FROM km_equity_symbols WHERE symbol = 'MAXESTATES'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1062.0, 1067.95, 1044.15, 1049.0, 1062.9, -13.9, -1.31, 2745794, 289.38, 1314.3, 933.8, 2.02, 4.73
FROM km_equity_symbols WHERE symbol = 'MAXHEALTH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 38.2, 38.2, 36.15, 36.25, 37.85, -1.6, -4.23, 7000, 0.03, 76.75, 36.0, -6.33, -48.94
FROM km_equity_symbols WHERE symbol = 'MAXPOSURE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 292.0, 307.9, 292.0, 307.9, 293.25, 14.65, 5.0, 51200, 1.56, 509.0, 145.05, -31.03, NULL
FROM km_equity_symbols WHERE symbol = 'MAXVOLT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 51.0, 51.0, NULL, NULL, NULL, NULL, 85.0, 46.0, -11.99, NULL
FROM km_equity_symbols WHERE symbol = 'MAYASHEEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2400.0, 2405.0, 2340.0, 2344.0, 2414.9, -63.4, -2.63, 848843, 200.93, 3775.0, 1918.05, -5.54, 5.99
FROM km_equity_symbols WHERE symbol = 'MAZDOCK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 332.0, 345.9, 332.0, 337.1, 333.15, 3.95, 1.19, 112378, 3.81, 535.9, 291.0, -3.37, NULL
FROM km_equity_symbols WHERE symbol = 'MBEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 46.85, 47.0, 44.6, 46.45, 46.85, -0.4, -0.85, 44000, 0.2, 161.0, 44.6, -24.63, -69.9
FROM km_equity_symbols WHERE symbol = 'MCON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2380.0, 2404.4, 2321.2, 2338.8, 2441.9, -103.1, -4.22, 3459271, 812.2, 2705.0, 881.63, 2.0, 108.42
FROM km_equity_symbols WHERE symbol = 'MCX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 55.0, 55.0, NULL, NULL, NULL, NULL, 105.5, 47.0, -15.32, -45.0
FROM km_equity_symbols WHERE symbol = 'MDL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1138.7, 1147.0, 1121.1, 1140.1, 1148.6, -8.5, -0.74, 72969, 8.27, 1456.5, 1010.0, -2.41, 1.04
FROM km_equity_symbols WHERE symbol = 'MEDANTA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 27.45, 27.45, NULL, NULL, NULL, NULL, 49.7, 19.6, 12.96, -30.51
FROM km_equity_symbols WHERE symbol = 'MEDIORG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 23.7, 23.7, NULL, NULL, NULL, NULL, 53.0, 21.0, -12.06, NULL
FROM km_equity_symbols WHERE symbol = 'MEDISTEP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 848.05, 865.65, 838.85, 851.1, 854.7, -3.6, -0.42, 100764, 8.61, 1045.3, 678.05, 0.92, 14.26
FROM km_equity_symbols WHERE symbol = 'MEDPLUS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 152.0, 155.1, 149.02, 153.25, 153.04, 0.21, 0.14, 3070181, 46.72, 254.4, 144.76, -6.99, NULL
FROM km_equity_symbols WHERE symbol = 'MEESHO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 120.25, 120.25, 120.25, 120.25, 119.25, 1.0, 0.84, 3000, 0.04, 127.55, 43.5, 13.44, 131.47
FROM km_equity_symbols WHERE symbol = 'MEGAFLEX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 221.0, 224.05, 221.0, 223.0, 224.5, -1.5, -0.67, 4000, 0.09, 380.0, 192.55, 10.28, -25.7
FROM km_equity_symbols WHERE symbol = 'MEGATHERM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 271.1, 271.1, 262.75, 264.0, 271.1, -7.1, -2.62, 51999, 1.38, 573.7, 244.15, -26.08, NULL
FROM km_equity_symbols WHERE symbol = 'MEIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1977.6, 1980.6, 1934.1, 1941.0, 1987.4, -46.4, -2.33, 40082, 7.81, 2263.0, 1315.0, 1.79, 13.65
FROM km_equity_symbols WHERE symbol = 'METROPOLIS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1821.3, 1848.5, 1817.3, 1835.0, 1813.5, 21.5, 1.19, 1588459, 291.28, 1848.5, 950.0, 11.48, 69.93
FROM km_equity_symbols WHERE symbol = 'MFSL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1148.0, 1152.9, 1100.0, 1107.0, 1153.2, -34.2, -3.0, 172440, 19.16, 1586.9, 1018.6, 4.04, -14.72
FROM km_equity_symbols WHERE symbol = 'MGL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 80.2, 84.5, 80.05, 80.2, 86.5, -6.3, -7.28, 8400, 0.07, 120.0, 73.55, -14.15, NULL
FROM km_equity_symbols WHERE symbol = 'MGSL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 39.5, 41.4, 39.5, 41.4, 40.15, 1.25, 3.11, 30000, 0.12, 66.0, 35.15, 1.51, -35.57
FROM km_equity_symbols WHERE symbol = 'MHHL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 18.6, 18.6, 18.6, 18.6, 19.6, -1.0, -5.1, 1600, NULL, 31.95, 17.55, -5.34, -35.86
FROM km_equity_symbols WHERE symbol = 'MICROPRO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 368.8, 368.8, 355.05, 361.0, 369.05, -8.05, -2.18, 360085, 12.96, 469.0, 226.93, 5.74, 26.62
FROM km_equity_symbols WHERE symbol = 'MIDHANI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1411.0, 1440.0, 1362.9, 1372.0, 1474.5, -102.5, -6.95, 94003, 13.12, 1859.9, 1048.5, -11.5, NULL
FROM km_equity_symbols WHERE symbol = 'MIDWESTLTD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 16.45, 16.6, 16.45, 16.5, 17.1, -0.6, -3.51, 8000, 0.01, 35.8, 15.7, -6.52, -52.72
FROM km_equity_symbols WHERE symbol = 'MIEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 49.85, 49.85, NULL, NULL, NULL, NULL, 53.5, 24.85, 29.99, 34.55
FROM km_equity_symbols WHERE symbol = 'MILTON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 582.5, 604.9, 582.0, 595.6, 592.1, 4.1, 0.69, 467092, 27.94, 619.95, 445.05, 3.58, 12.44
FROM km_equity_symbols WHERE symbol = 'MINDACORP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 39.0, 39.0, 39.0, 39.0, 40.5, -1.5, -3.7, 8000, 0.03, 84.45, 37.8, -17.37, NULL
FROM km_equity_symbols WHERE symbol = 'MMEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 65.21, 65.21, 63.52, 64.0, 65.57, -1.57, -2.39, 1299376, 8.36, 88.19, 44.5, 0.71, 3.8
FROM km_equity_symbols WHERE symbol = 'MMTC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 306.0, 309.9, 305.65, 306.8, 312.25, -5.45, -1.75, 555486, 17.09, 405.6, 274.05, -9.83, 0.99
FROM km_equity_symbols WHERE symbol = 'MOIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 468.0, 474.95, 462.3, 462.3, 469.85, -7.55, -1.61, 5500, 0.26, 607.4, 219.45, -0.9, NULL
FROM km_equity_symbols WHERE symbol = 'MONOLITH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 11.9, 11.9, NULL, NULL, NULL, NULL, 28.9, 9.45, -9.51, -52.87
FROM km_equity_symbols WHERE symbol = 'MONOPHARMA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 19.35, 19.4, 18.5, 18.5, 19.25, -0.75, -3.9, 136000, 0.26, 30.1, 18.5, -17.74, -94.1
FROM km_equity_symbols WHERE symbol = 'MOS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 132.58, 133.49, 130.72, 130.99, 132.74, -1.75, -1.32, 19324007, 255.48, 135.83, 71.5, 13.97, 51.36
FROM km_equity_symbols WHERE symbol = 'MOTHERSON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 803.25, 803.25, 782.0, 784.7, 803.35, -18.65, -2.32, 459584, 36.19, 1097.1, 513.0, -6.28, 21.41
FROM km_equity_symbols WHERE symbol = 'MOTILALOFS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 97.0, 103.5, 97.0, 103.5, 98.85, 4.65, 4.7, 12800, 0.13, 103.5, 25.5, 29.21, 219.44
FROM km_equity_symbols WHERE symbol = 'MOXSH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 62.0, 62.0, NULL, NULL, NULL, NULL, 153.9, 55.0, -24.39, NULL
FROM km_equity_symbols WHERE symbol = 'MPEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2387.6, 2501.2, 2355.2, 2452.5, 2464.0, -11.5, -0.47, 1725163, 422.18, 3037.2, 2044.55, -14.66, -5.74
FROM km_equity_symbols WHERE symbol = 'MPHASIS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 47.55, 47.55, NULL, NULL, NULL, NULL, 56.8, 25.2, NULL, 43.66
FROM km_equity_symbols WHERE symbol = 'MPTODAY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 150750.0, 151500.0, 148505.0, 150000.0, 151210.0, -1210.0, -0.8, 7131, 107.13, 163600.0, 102124.05, 1.55, 36.65
FROM km_equity_symbols WHERE symbol = 'MRF'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 51.85, 51.85, 51.0, 51.05, 51.85, -0.8, -1.54, 8000, 0.04, 82.0, 49.15, -19.56, NULL
FROM km_equity_symbols WHERE symbol = 'MRIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 189.99, 190.0, 184.05, 185.5, 191.12, -5.62, -2.94, 5232925, 97.59, 197.0, 98.92, 27.77, 60.58
FROM km_equity_symbols WHERE symbol = 'MRPL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 485.0, 489.9, 474.0, 476.5, 486.8, -10.3, -2.12, 120824, 5.79, 611.8, 411.1, 0.19, -20.61
FROM km_equity_symbols WHERE symbol = 'MSTCLTD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 42.9, 43.27, 42.0, 42.75, 43.27, -0.52, -1.2, 5057227, 21.74, 53.59, 30.72, -6.5, 24.82
FROM km_equity_symbols WHERE symbol = 'MSUMI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3535.0, 3640.8, 3530.0, 3580.0, 3560.6, 19.4, 0.54, 356484, 127.74, 3748.7, 1155.6, 35.89, 152.81
FROM km_equity_symbols WHERE symbol = 'MTARTECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 64.0, 65.33, 58.66, 60.5, 64.57, -4.07, -6.3, 6264, 0.04, 92.1, 54.45, -6.27, -23.1
FROM km_equity_symbols WHERE symbol = 'MUKTAARTS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 88.5, 88.5, 81.0, 81.0, 88.45, -7.45, -8.42, 25200, 0.21, 143.0, 71.2, -15.13, NULL
FROM km_equity_symbols WHERE symbol = 'MUNISH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3870.0, 3870.0, 3552.7, 3587.0, 4066.9, -479.9, -11.8, 6498829, 2357.05, 4149.5, 1965.0, -8.64, 54.76
FROM km_equity_symbols WHERE symbol = 'MUTHOOTFIN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 558.05, 577.0, 558.0, 577.0, 583.0, -6.0, -1.03, 10800, 0.61, 819.0, 32.05, -15.85, 1505.8
FROM km_equity_symbols WHERE symbol = 'MVKAGRO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 75.0, 79.85, 75.0, 79.85, 78.0, 1.85, 2.37, 4800, 0.04, 119.1, 51.6, -11.28, 25.75
FROM km_equity_symbols WHERE symbol = 'MYMUDRA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 955.0, 955.0, 899.95, 916.1, 965.45, -49.35, -5.11, 1020844, 94.65, 1009.0, 498.05, 2.71, 66.23
FROM km_equity_symbols WHERE symbol = 'NAM-INDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 58.1, 62.0, 58.0, 62.0, 60.0, 2.0, 3.33, 7200, 0.04, 119.95, 55.75, -1.98, -35.82
FROM km_equity_symbols WHERE symbol = 'NAMAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 180.2, 185.1, 179.0, 180.0, 182.0, -2.0, -1.1, 11200, 0.2, 229.9, 127.0, -2.03, 7.02
FROM km_equity_symbols WHERE symbol = 'NAMOEWASTE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 830.0, 834.25, 819.0, 822.0, 839.85, -17.85, -2.13, 451730, 37.3, 1245.0, 726.8, -5.71, -15.7
FROM km_equity_symbols WHERE symbol = 'NATCOPHARM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 360.0, 361.25, 348.35, 349.65, 369.7, -20.05, -5.42, 10586115, 373.61, 431.5, 137.75, -2.17, 82.62
FROM km_equity_symbols WHERE symbol = 'NATIONALUM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1138.8, 1179.9, 1104.2, 1135.0, 1149.3, -14.3, -1.24, 3638049, 410.81, 1566.39, 1104.2, -14.82, -25.73
FROM km_equity_symbols WHERE symbol = 'NAUKRI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 562.95, 562.95, 550.35, 554.85, 567.0, -12.15, -2.14, 141744, 7.87, 735.0, 356.05, -1.25, 48.43
FROM km_equity_symbols WHERE symbol = 'NAVA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 6580.5, 6580.5, 6286.0, 6292.0, 6587.0, -295.0, -4.48, 141665, 90.73, 6965.0, 3566.0, 5.08, 53.15
FROM km_equity_symbols WHERE symbol = 'NAVINFLUOR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 277.0, 281.3, 273.4, 279.3, 277.8, 1.5, 0.54, 2952569, 82.28, 363.25, 221.35, 5.74, 20.62
FROM km_equity_symbols WHERE symbol = 'NAZARA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 100.0, 100.12, 97.7, 98.19, 100.5, -2.31, -2.3, 9520535, 93.87, 130.7, 70.8, -6.76, 14.51
FROM km_equity_symbols WHERE symbol = 'NBCC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 153.5, 154.12, 151.2, 151.4, 154.85, -3.45, -2.23, 2306843, 35.18, 242.15, 138.57, 1.02, -23.46
FROM km_equity_symbols WHERE symbol = 'NCC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 85.7, 85.96, 83.3, 84.0, 85.52, -1.52, -1.78, 131595, 1.11, 141.23, 77.11, -9.94, -21.05
FROM km_equity_symbols WHERE symbol = 'NDTV'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 14.75, 14.75, NULL, NULL, NULL, NULL, 38.5, 10.95, 15.69, -59.86
FROM km_equity_symbols WHERE symbol = 'NEELAM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1284.5, 1316.3, 1258.0, 1273.2, 1301.2, -28.0, -2.15, 22337, 2.88, 1999.4, 966.7, -2.23, -34.38
FROM km_equity_symbols WHERE symbol = 'NEOGEN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 112.0, 112.0, 102.0, 107.5, 112.35, -4.85, -4.32, 18800, 0.2, 183.0, 94.5, -9.84, -21.39
FROM km_equity_symbols WHERE symbol = 'NEPHROCARE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 575.25, 588.25, 566.65, 575.1, 575.25, -0.15, -0.03, 117242, 6.78, 603.8, 446.0, 19.81, NULL
FROM km_equity_symbols WHERE symbol = 'NEPHROPLUS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 225.0, 233.8, 217.25, 225.0, 226.0, -1.0, -0.44, 18000, 0.41, 246.9, 126.3, 6.64, NULL
FROM km_equity_symbols WHERE symbol = 'NEPTUNE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1197.3, 1202.0, 1180.0, 1184.0, 1214.8, -30.8, -2.54, 29114, 3.47, 1638.9, 842.6, 1.8, 24.14
FROM km_equity_symbols WHERE symbol = 'NESCO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1305.0, 1310.4, 1278.0, 1278.0, 1305.5, -27.5, -2.11, 522586, 67.31, 1340.4, 1055.0, -3.09, 17.38
FROM km_equity_symbols WHERE symbol = 'NESTLEIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3159.7, 3159.7, 3075.1, 3089.9, 3201.9, -112.0, -3.5, 564539, 176.2, 4479.0, 1251.55, -5.59, 105.81
FROM km_equity_symbols WHERE symbol = 'NETWEB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 37.49, 37.68, 36.5, 37.06, 37.76, -0.7, -1.85, 2496100, 9.25, 65.29, 35.0, -8.85, -24.72
FROM km_equity_symbols WHERE symbol = 'NETWORK18'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 12997.0, 13296.0, 12823.0, 13044.0, 12960.0, 84.0, 0.65, 39031, 50.88, 19747.0, 10190.7, -8.95, 2.17
FROM km_equity_symbols WHERE symbol = 'NEULANDLAB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 495.25, 499.1, 475.8, 480.95, 507.75, -26.8, -5.28, 1554969, 75.14, 1377.15, 475.8, -38.27, -50.93
FROM km_equity_symbols WHERE symbol = 'NEWGEN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 18.9, 19.15, 18.8, 19.15, 19.75, -0.6, -3.04, 10500, 0.02, 75.05, 15.15, 0.26, -73.03
FROM km_equity_symbols WHERE symbol = 'NEWJAISA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 5.6, 6.09, 5.6, 5.99, 5.99, NULL, NULL, 2846, NULL, 8.48, 5.0, 0.84, -10.6
FROM km_equity_symbols WHERE symbol = 'NEXTMEDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 79.01, 79.4, 77.77, 78.2, 79.63, -1.43, -1.8, 613008, 4.8, 112.2, 71.0, -5.92, -13.2
FROM km_equity_symbols WHERE symbol = 'NFL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1856.6, 1872.0, 1813.6, 1818.2, 1864.9, -46.7, -2.5, 250560, 46.08, 2370.2, 1300.95, -3.68, 36.81
FROM km_equity_symbols WHERE symbol = 'NH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 76.05, 76.12, 75.2, 75.38, 76.5, -1.12, -1.46, 10066742, 76.07, 92.34, 71.0, -7.42, 0.11
FROM km_equity_symbols WHERE symbol = 'NHPC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 152.3, 153.74, 149.93, 150.35, 154.59, -4.24, -2.74, 442466, 6.7, 214.74, 135.6, 0.36, -7.28
FROM km_equity_symbols WHERE symbol = 'NIACL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 17.0, 17.0, 17.0, 17.0, 17.0, NULL, NULL, 3000, 0.01, 24.9, 15.0, -5.03, -25.27
FROM km_equity_symbols WHERE symbol = 'NIDAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 117.0, 118.8, 115.5, 115.5, 117.0, -1.5, -1.28, 96000, 1.13, 156.0, 77.15, -14.3, NULL
FROM km_equity_symbols WHERE symbol = 'NIKITA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 62.9, 62.9, 62.9, 62.9, 66.2, -3.3, -4.98, 5100, 0.03, 290.35, 46.75, 15.63, -77.26
FROM km_equity_symbols WHERE symbol = 'NIRMAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 76.15, 76.84, 75.3, 75.95, 77.04, -1.09, -1.41, 459545, 3.49, 95.21, 68.54, -2.68, -5.04
FROM km_equity_symbols WHERE symbol = 'NIVABUPA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 256.0, 262.0, 249.15, 258.5, 259.65, -1.15, -0.44, 1711761, 43.62, 292.2, 186.03, 1.23, 28.69
FROM km_equity_symbols WHERE symbol = 'NLCINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 81.5, 81.9, 79.16, 79.43, 84.74, -2.81, -3.42, 31361483, 252.24, 86.72, 59.53, -3.28, 25.72
FROM km_equity_symbols WHERE symbol = 'NMDC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 27.0, 27.0, NULL, NULL, NULL, NULL, 45.9, 23.35, -6.9, -35.25
FROM km_equity_symbols WHERE symbol = 'NMSTEEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 56.9, 56.9, 55.0, 55.0, 54.5, 0.5, 0.92, 12000, 0.07, 72.9, 37.05, 1.01, NULL
FROM km_equity_symbols WHERE symbol = 'NRVANDANA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 40.95, 40.95, 40.0, 40.31, 41.3, -0.99, -2.4, 4142610, 16.72, 49.65, 32.13, -3.63, 6.02
FROM km_equity_symbols WHERE symbol = 'NSLNISP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 367.55, 368.0, 362.4, 364.0, 368.25, -4.25, -1.15, 7111972, 259.01, 372.0, 292.8, 7.72, 18.68
FROM km_equity_symbols WHERE symbol = 'NTPC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 88.75, 89.28, 87.42, 89.04, 89.08, -0.04, -0.04, 2357251, 20.88, 117.64, 84.05, -2.86, -17.69
FROM km_equity_symbols WHERE symbol = 'NTPCGREEN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1297.4, 1319.4, 1280.7, 1296.0, 1310.5, -14.5, -1.11, 298028, 38.77, 1701.7, 947.09, -8.74, 17.77
FROM km_equity_symbols WHERE symbol = 'NUVAMA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 346.6, 347.45, 336.05, 337.65, 346.6, -8.95, -2.58, 135775, 4.63, 477.5, 287.05, -4.32, 2.68
FROM km_equity_symbols WHERE symbol = 'NUVOCO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 279.39, 280.25, 269.88, 271.0, 280.14, -9.14, -3.26, 8182107, 223.76, 285.6, 154.9, 6.44, 59.03
FROM km_equity_symbols WHERE symbol = 'NYKAA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1539.0, 1556.6, 1515.3, 1545.0, 1566.6, -21.6, -1.38, 494872, 76.18, 2005.0, 1425.5, -6.76, -5.14
FROM km_equity_symbols WHERE symbol = 'OBEROIRLTY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 303.0, 307.25, 295.0, 301.5, 309.1, -7.6, -2.46, 36400, 1.1, 360.0, 144.9, -0.8, 82.95
FROM km_equity_symbols WHERE symbol = 'OBSCP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 6648.0, 6711.0, 6400.0, 6630.0, 6764.0, -134.0, -1.98, 437097, 287.32, 9950.0, 6400.0, -13.85, -26.36
FROM km_equity_symbols WHERE symbol = 'OFSS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 471.0, 471.0, 452.3, 454.9, 474.85, -19.95, -4.2, 5341810, 244.3, 524.0, 325.0, 1.56, 10.17
FROM km_equity_symbols WHERE symbol = 'OIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 30.9, 31.43, 30.41, 30.92, 30.97, -0.05, -0.16, 32322179, 99.94, 71.25, 30.41, -20.7, -51.9
FROM km_equity_symbols WHERE symbol = 'OLAELEC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1011.0, 1030.8, 1009.5, 1024.0, 1031.5, -7.5, -0.73, 210446, 21.45, 1714.2, 965.1, -9.36, -16.68
FROM km_equity_symbols WHERE symbol = 'OLECTRA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 295.3, 295.3, 280.5, 283.0, 287.05, -4.05, -1.41, 52000, 1.48, 355.0, 98.15, -11.82, 159.52
FROM km_equity_symbols WHERE symbol = 'OLIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 72.45, 72.45, 63.0, 65.7, 67.8, -2.1, -3.1, 33600, 0.22, 140.0, 47.0, -10.7, -40.47
FROM km_equity_symbols WHERE symbol = 'OMFURN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 140.0, 140.0, 139.95, 139.95, 144.05, -4.1, -2.85, 11700, 0.16, 261.3, 100.0, 33.22, -54.85
FROM km_equity_symbols WHERE symbol = 'ONDOOR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1209.9, 1237.9, 1175.1, 1185.0, 1211.3, -26.3, -2.17, 411034, 49.33, 2248.0, 1057.0, -33.38, -17.83
FROM km_equity_symbols WHERE symbol = 'ONESOURCE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 270.0, 271.35, 266.0, 267.5, 276.35, -8.85, -3.2, 20748628, 556.23, 280.3, 205.0, 9.73, 13.85
FROM km_equity_symbols WHERE symbol = 'ONGC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 52.6, 53.03, 51.48, 51.75, 53.26, -1.51, -2.84, 195483, 1.01, 75.09, 41.07, -9.05, -6.1
FROM km_equity_symbols WHERE symbol = 'ONMOBILE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 35.5, 35.5, 35.5, 35.5, 35.5, NULL, NULL, 2000, 0.01, 65.65, 28.1, -5.59, -44.14
FROM km_equity_symbols WHERE symbol = 'ONYX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 422.65, 423.35, 408.55, 411.0, 425.65, -14.65, -3.44, 101365, 4.21, 713.0, 366.0, -12.01, -27.16
FROM km_equity_symbols WHERE symbol = 'OPTIEMUS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 79.5, 79.5, 78.0, 78.0, 79.5, -1.5, -1.89, 3200, 0.03, 107.55, 67.95, -6.31, NULL
FROM km_equity_symbols WHERE symbol = 'OPTIVALUE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 678.9, 687.25, 652.2, 670.0, 672.2, -2.2, -0.33, 47080, 3.12, 1273.05, 603.8, -9.26, -36.01
FROM km_equity_symbols WHERE symbol = 'ORCHPHARMA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1950.0, 2069.95, 1890.1, 2044.0, 1963.85, 80.15, 4.08, 57825, 11.47, 3064.0, 1000.0, 8.69, 33.81
FROM km_equity_symbols WHERE symbol = 'ORIANA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 162.0, 162.64, 158.8, 160.0, 163.58, -3.58, -2.19, 231424, 3.71, 362.4, 150.65, -3.12, -52.35
FROM km_equity_symbols WHERE symbol = 'ORIENTCEM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 552.25, 554.05, 544.2, 545.45, 556.8, -11.35, -2.04, 62979, 3.44, 760.0, 544.2, -10.79, NULL
FROM km_equity_symbols WHERE symbol = 'ORKLAINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 515.0, 515.0, 500.0, 509.4, 505.9, 3.5, 0.69, 3800, 0.19, 835.0, 186.25, 3.77, 63.48
FROM km_equity_symbols WHERE symbol = 'OSELDEVICE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 348.5, 348.5, 329.5, 334.9, 350.85, -15.95, -4.55, 1783443, 59.65, 888.4, 329.5, -26.57, NULL
FROM km_equity_symbols WHERE symbol = 'OSWALPUMPS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 223.3, 223.3, 217.1, 217.2, 223.3, -6.1, -2.73, 9900, 0.22, 794.0, 200.1, -4.22, -71.07
FROM km_equity_symbols WHERE symbol = 'OWAIS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 185.35, 185.71, 179.05, 180.33, 184.8, -4.47, -2.42, 279972, 5.08, 231.95, 160.21, 1.69, NULL
FROM km_equity_symbols WHERE symbol = 'PACEDIGITK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 33545.0, 34065.0, 33300.0, 33370.0, 33850.0, -480.0, -1.42, 15457, 52.0, 50590.0, 31740.0, -3.68, -19.94
FROM km_equity_symbols WHERE symbol = 'PAGEIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 122.75, 125.37, 121.41, 122.61, 123.38, -0.77, -0.62, 4048964, 49.93, 234.39, 83.25, -17.53, 25.34
FROM km_equity_symbols WHERE symbol = 'PARADEEP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 43.15, 43.2, 43.15, 43.15, 46.95, -3.8, -8.09, 3600, 0.02, 80.4, 34.1, 10.64, -44.39
FROM km_equity_symbols WHERE symbol = 'PARAGON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 79.9, 79.85, 0.05, 0.06, NULL, NULL, 108.95, 63.6, 6.18, -9.88
FROM km_equity_symbols WHERE symbol = 'PARAMATRIX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 47.85, 47.85, NULL, NULL, NULL, NULL, 79.95, 36.35, -4.2, -40.15
FROM km_equity_symbols WHERE symbol = 'PARAMOUNT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 9.4, 10.25, 9.4, 10.25, 9.8, 0.45, 4.59, 32000, 0.03, 10.9, 5.75, NULL, NULL
FROM km_equity_symbols WHERE symbol = 'PARAMPARA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 651.4, 653.65, 638.0, 639.5, 651.75, -12.25, -1.88, 222121, 14.26, 972.5, 404.7, -5.73, 32.89
FROM km_equity_symbols WHERE symbol = 'PARAS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 692.05, 700.0, 660.05, 693.05, 690.0, 3.05, 0.44, 2500, 0.17, 720.0, 311.65, 16.67, 96.42
FROM km_equity_symbols WHERE symbol = 'PARIN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 174.0, 177.8, 169.91, 175.9, 172.23, 3.67, 2.13, 2231981, 39.02, 179.6, 138.1, 16.78, NULL
FROM km_equity_symbols WHERE symbol = 'PARKHOSPS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 129.89, 130.53, 126.0, 126.5, 129.4, -2.9, -2.24, 164389, 2.1, 174.66, 116.85, -0.25, -24.03
FROM km_equity_symbols WHERE symbol = 'PARKHOTELS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 243.5, 243.5, 236.0, 236.0, 239.0, -3.0, -1.26, 2000, 0.05, 306.4, 169.0, 20.36, NULL
FROM km_equity_symbols WHERE symbol = 'PARTH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 80.0, 82.0, 80.0, 82.0, 82.6, -0.6, -0.73, 4000, 0.03, 115.95, 63.05, -8.89, -28.66
FROM km_equity_symbols WHERE symbol = 'PARTYCRUS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 520.0, 523.95, 511.8, 514.6, 523.15, -8.55, -1.63, 3557112, 184.11, 670.33, 480.0, -5.38, -15.21
FROM km_equity_symbols WHERE symbol = 'PATANJALI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 29.74, 30.4, 29.24, 30.39, 30.05, 0.34, 1.13, 6390386, 19.18, 46.73, 26.2, 14.38, -33.78
FROM km_equity_symbols WHERE symbol = 'PATELENG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 198.2, 198.2, 192.1, 192.5, 200.18, -7.68, -3.84, 119431, 2.33, 305.0, 169.91, 6.62, NULL
FROM km_equity_symbols WHERE symbol = 'PATELRMART'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 149.15, 153.0, 149.15, 150.05, 152.9, -2.85, -1.86, 4800, 0.07, 268.9, 134.0, -13.44, NULL
FROM km_equity_symbols WHERE symbol = 'PATILAUTOM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 106.4, 106.4, NULL, NULL, NULL, NULL, 160.0, 60.1, -5.67, 10.83
FROM km_equity_symbols WHERE symbol = 'PATTECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1140.0, 1140.4, 1099.3, 1122.9, 1148.7, -25.8, -2.25, 6319748, 706.46, 1381.8, 651.5, -12.38, 48.65
FROM km_equity_symbols WHERE symbol = 'PAYTM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 314.85, 315.0, 300.0, 301.5, 314.85, -13.35, -4.24, 1546460, 47.01, 444.15, 254.5, 7.35, -21.74
FROM km_equity_symbols WHERE symbol = 'PCBL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 218.6, 218.6, 215.05, 215.05, 230.0, -14.95, -6.5, 5600, 0.12, 267.5, 150.0, -0.85, 19.47
FROM km_equity_symbols WHERE symbol = 'PCCL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 10.11, 10.11, 9.93, 10.01, 10.14, -0.13, -1.28, 31945489, 31.95, 19.65, 8.67, -2.72, -26.23
FROM km_equity_symbols WHERE symbol = 'PCJEWELLER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 335.0, 340.05, -5.05, -1.49, NULL, NULL, 461.0, 280.05, -2.28, -4.18
FROM km_equity_symbols WHERE symbol = 'PELATRO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 69.0, 69.0, NULL, NULL, NULL, NULL, 99.5, 50.55, -8.61, 4.55
FROM km_equity_symbols WHERE symbol = 'PENTAGON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 5210.0, 5540.0, 5210.0, 5473.0, 5452.0, 21.0, 0.39, 1806431, 978.62, 6599.0, 4148.95, -13.91, -3.36
FROM km_equity_symbols WHERE symbol = 'PERSISTENT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 291.85, 294.65, 286.05, 289.85, 297.15, -7.3, -2.46, 2767142, 80.36, 326.5, 263.5, 0.83, -2.42
FROM km_equity_symbols WHERE symbol = 'PETRONET'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 407.45, 408.0, 399.4, 400.0, 410.55, -10.55, -2.57, 7060981, 283.8, 444.1, 329.9, 8.24, 4.03
FROM km_equity_symbols WHERE symbol = 'PFC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 5110.8, 5110.8, 4987.8, 5037.5, 5121.4, -83.9, -1.64, 21465, 10.82, 5993.0, 3701.0, 3.71, 20.83
FROM km_equity_symbols WHERE symbol = 'PFIZER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 259.5, 277.6, 256.43, 261.5, 261.91, -0.41, -0.16, 5908232, 157.7, 292.0, 85.0, 7.86, 143.21
FROM km_equity_symbols WHERE symbol = 'PFOCUS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 615.0, 622.45, 601.9, 614.0, 623.65, -9.65, -1.55, 1419692, 86.94, 1008.0, 465.0, 3.77, -24.28
FROM km_equity_symbols WHERE symbol = 'PGEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 11651.0, 11870.0, 11470.0, 11655.0, 11683.0, -28.0, -0.24, 4467, 5.18, 14543.0, 11470.0, -5.88, -16.27
FROM km_equity_symbols WHERE symbol = 'PGHH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1595.0, 1665.9, 1554.0, 1593.0, 1589.9, 3.1, 0.19, 165366, 26.54, 1993.3, 875.0, 6.17, 11.56
FROM km_equity_symbols WHERE symbol = 'PGIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 232.0, 238.9, 226.2, 235.0, 235.0, NULL, NULL, 20400, 0.47, 327.95, 165.0, 7.44, 24.77
FROM km_equity_symbols WHERE symbol = 'PHANTOMFX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1769.7, 1772.5, 1725.5, 1730.6, 1779.0, -48.4, -2.72, 287042, 50.07, 1993.0, 1402.5, -8.66, 8.15
FROM km_equity_symbols WHERE symbol = 'PHOENIXLTD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 19.05, 20.45, 19.05, 20.45, 20.9, -0.45, -2.15, 10000, 0.02, 29.1, 16.75, -9.59, -19.68
FROM km_equity_symbols WHERE symbol = 'PHOGLOBAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1486.1, 1489.6, 1472.1, 1477.0, 1497.4, -20.4, -1.36, 474002, 70.24, 1574.95, 1311.1, -1.46, 4.82
FROM km_equity_symbols WHERE symbol = 'PIDILITIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3035.0, 3243.5, 3035.0, 3167.8, 3222.3, -54.5, -1.69, 1327261, 419.95, 4330.0, 2951.1, -3.04, -1.82
FROM km_equity_symbols WHERE symbol = 'PIIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 203.33, 204.4, 199.16, 201.25, 203.33, -2.08, -1.02, 1117930, 22.46, 284.0, 192.81, -6.47, NULL
FROM km_equity_symbols WHERE symbol = 'PINELABS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 12.5, 12.5, NULL, NULL, NULL, NULL, 27.75, 12.2, -13.79, -47.92
FROM km_equity_symbols WHERE symbol = 'PLADAINFO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 120.1, 120.36, 118.3, 118.55, 120.96, -2.41, -1.99, 14737408, 175.29, 135.15, 85.46, -4.79, 25.26
FROM km_equity_symbols WHERE symbol = 'PNB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 848.0, 848.0, 827.7, 836.0, 852.85, -16.85, -1.98, 1057628, 88.59, 1141.9, 746.7, -13.82, 3.7
FROM km_equity_symbols WHERE symbol = 'PNBHOUSING'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 25.31, 26.97, 25.3, 25.48, 25.6, -0.12, -0.47, 4170, 0.01, 40.64, 21.76, 1.88, -27.39
FROM km_equity_symbols WHERE symbol = 'PNC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 217.36, 218.0, 214.18, 214.84, 220.16, -5.32, -2.42, 233484, 5.03, 331.8, 205.45, -9.12, -22.15
FROM km_equity_symbols WHERE symbol = 'PNCINFRA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 571.5, 575.0, 551.3, 569.0, 571.5, -2.5, -0.44, 120715, 6.85, 701.4, 473.8, -5.08, -8.34
FROM km_equity_symbols WHERE symbol = 'PNGJL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1534.9, 1556.5, 1519.4, 1525.0, 1553.6, -28.6, -1.84, 1364875, 209.56, 1978.0, 1311.35, -6.92, -6.66
FROM km_equity_symbols WHERE symbol = 'POLICYBZR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 7760.5, 7764.0, 7565.0, 7577.0, 7768.0, -191.0, -2.46, 160046, 122.28, 7948.0, 4555.0, 0.29, 36.5
FROM km_equity_symbols WHERE symbol = 'POLYCAB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1316.5, 1316.6, 1260.6, 1296.0, 1316.5, -20.5, -1.56, 237678, 30.43, 2937.6, 1260.6, -24.37, -41.68
FROM km_equity_symbols WHERE symbol = 'POLYMED'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 869.7, 872.7, 835.0, 841.0, 869.7, -28.7, -3.3, 50838, 4.3, 1398.0, 774.0, 3.08, -27.47
FROM km_equity_symbols WHERE symbol = 'POLYPLEX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 217.0, 217.0, 207.1, 213.0, 218.0, -5.0, -2.29, 10500, 0.22, 356.75, 14.25, -9.29, 740.76
FROM km_equity_symbols WHERE symbol = 'POLYSIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 471.95, 472.8, 460.0, 462.0, 472.65, -10.65, -2.25, 769227, 35.98, 570.4, 267.2, 0.18, 54.67
FROM km_equity_symbols WHERE symbol = 'POONAWALLA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 185.25, 186.9, 181.4, 186.9, 190.95, -4.05, -2.12, 4200, 0.08, 420.0, 163.2, 1.66, -44.21
FROM km_equity_symbols WHERE symbol = 'POSITRON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 292.0, 294.3, 286.85, 287.4, 293.9, -6.5, -2.21, 10914157, 315.76, 322.0, 247.3, 11.05, 10.9
FROM km_equity_symbols WHERE symbol = 'POWERGRID'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 22500.0, 22679.0, 22225.0, 22450.0, 22702.0, -252.0, -1.11, 72497, 162.74, 23140.0, 10300.0, 31.24, 90.98
FROM km_equity_symbols WHERE symbol = 'POWERINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2125.0, 2125.0, 2075.0, 2099.0, 2141.2, -42.2, -1.97, 61142, 12.84, 3415.0, 1700.0, -9.19, 6.75
FROM km_equity_symbols WHERE symbol = 'POWERMECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 162.5, 167.88, 159.0, 166.05, 163.31, 2.74, 1.68, 4647771, 76.57, 240.95, 148.31, -1.37, -17.21
FROM km_equity_symbols WHERE symbol = 'PPLPHARMA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 9.05, 9.05, 9.0, 9.0, 9.25, -0.25, -2.7, 9000, 0.01, 34.0, 8.8, -0.55, -72.73
FROM km_equity_symbols WHERE symbol = 'PPSL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 318.0, 318.85, 305.0, 306.45, 330.5, -24.05, -7.28, 2645952, 82.4, 588.45, 273.0, -0.45, -45.46
FROM km_equity_symbols WHERE symbol = 'PRAJIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 349.0, 351.25, 346.15, 346.5, 350.55, -4.05, -1.16, 56000, 1.95, 367.0, 101.05, -1.56, 134.76
FROM km_equity_symbols WHERE symbol = 'PRAMARA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 57.0, 57.0, 50.1, 50.1, 61.15, -11.05, -18.07, 43200, 0.23, 92.9, 48.0, -18.16, -35.08
FROM km_equity_symbols WHERE symbol = 'PRANIK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 134.0, 134.0, 130.0, 134.0, 138.65, -4.65, -3.35, 2400, 0.03, 216.8, 126.5, -4.96, -19.33
FROM km_equity_symbols WHERE symbol = 'PRATHAM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 11.0, 11.6, 10.75, 11.6, 11.15, 0.45, 4.04, 208000, 0.23, 36.9, 8.4, 1.31, -68.48
FROM km_equity_symbols WHERE symbol = 'PRECISION'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 770.0, 770.0, 747.5, 755.05, 771.45, -16.4, -2.13, 1150500, 87.21, 1163.9, 660.0, 0.83, -24.51
FROM km_equity_symbols WHERE symbol = 'PREMIERENE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 36.1, 36.1, 36.0, 36.0, 36.3, -0.3, -0.83, 9000, 0.03, 44.25, 26.05, -5.26, -4.76
FROM km_equity_symbols WHERE symbol = 'PREMIUM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 57.6, 61.95, 55.4, 56.8, 58.7, -1.9, -3.24, 42400, 0.25, 121.19, 36.25, 5.26, -39.12
FROM km_equity_symbols WHERE symbol = 'PRESSTONIC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1545.0, 1549.9, 1482.1, 1508.2, 1572.7, -64.5, -4.1, 2017539, 304.8, 1814.0, 1048.05, -0.63, 21.84
FROM km_equity_symbols WHERE symbol = 'PRESTIGE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 622.0, 637.4, 613.5, 632.5, 620.35, 12.15, 1.96, 600598, 37.77, 694.2, 367.85, 1.16, 27.87
FROM km_equity_symbols WHERE symbol = 'PRICOLLTD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 84.95, 85.55, 83.05, 85.55, 85.6, -0.05, -0.06, 14400, 0.12, 123.65, 70.7, 8.63, NULL
FROM km_equity_symbols WHERE symbol = 'PRIMECAB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 269.25, 269.99, 265.05, 265.75, 271.75, -6.0, -2.21, 109452, 2.92, 387.7, 229.05, 10.02, -7.4
FROM km_equity_symbols WHERE symbol = 'PRINCEPIPE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 63.9, 65.75, 63.9, 65.75, 62.55, 3.2, 5.12, 4000, 0.03, 95.25, 56.05, -10.56, -62.54
FROM km_equity_symbols WHERE symbol = 'PRITIKA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2790.0, 2790.0, 2710.0, 2719.9, 2799.6, -79.7, -2.85, 111262, 30.59, 3440.5, 1368.15, 0.6, 67.55
FROM km_equity_symbols WHERE symbol = 'PRIVISCL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 301.25, 301.25, 290.0, 300.0, 301.25, -1.25, -0.41, 10000, 0.3, 362.0, 105.1, 0.27, 32.35
FROM km_equity_symbols WHERE symbol = 'PRIZOR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 60.5, 61.9, 60.5, 61.9, 61.5, 0.4, 0.65, 6000, 0.04, 114.0, 52.55, -12.01, -43.65
FROM km_equity_symbols WHERE symbol = 'PRLIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 58.25, 63.0, 58.25, 63.0, 60.75, 2.25, 3.7, 83200, 0.51, 136.9, 56.9, -16.0, NULL
FROM km_equity_symbols WHERE symbol = 'PROFX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 73.5, 73.5, NULL, NULL, NULL, NULL, 269.9, 60.8, 14.75, -72.57
FROM km_equity_symbols WHERE symbol = 'PROLIFE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 193.5, 200.5, 171.1, 200.5, 193.5, 7.0, 3.62, 7200, 0.14, 294.0, 145.0, 21.33, -27.2
FROM km_equity_symbols WHERE symbol = 'PROPEQUITY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 171.1, 174.4, 169.1, 173.0, 174.42, -1.42, -0.81, 264705, 4.54, 253.49, 108.0, 8.85, NULL
FROM km_equity_symbols WHERE symbol = 'PROSTARM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 1205.0, 1205.0, NULL, NULL, NULL, NULL, 1511.0, 815.1, -5.12, -19.18
FROM km_equity_symbols WHERE symbol = 'PROV'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 121.1, 121.49, 118.0, 120.56, 120.95, -0.39, -0.32, 367379, 4.39, 176.0, 105.3, -6.47, -1.7
FROM km_equity_symbols WHERE symbol = 'PRSMJOHNSN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2650.1, 2654.1, 2613.7, 2625.1, 2664.8, -39.7, -1.49, 5502, 1.45, 3098.0, 1570.0, 8.1, 22.72
FROM km_equity_symbols WHERE symbol = 'PRUDENT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 27.28, 27.28, 26.85, 26.87, 27.42, -0.55, -2.01, 1010530, 2.73, 50.5, 25.22, -1.58, -39.9
FROM km_equity_symbols WHERE symbol = 'PSB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 32.3, 34.95, 32.3, 34.95, 33.4, 1.55, 4.64, 12000, 0.04, 65.0, 25.1, 27.32, -46.23
FROM km_equity_symbols WHERE symbol = 'PSFL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 280.0, 280.0, NULL, NULL, NULL, NULL, 318.1, 122.85, -6.35, NULL
FROM km_equity_symbols WHERE symbol = 'PSRAJ'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 182.7, 185.97, 181.74, 184.3, 185.38, -1.08, -0.58, 1060806, 19.51, 207.0, 128.8, 16.25, 33.6
FROM km_equity_symbols WHERE symbol = 'PTC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 18660.0, 18660.0, 18111.0, 18230.0, 18677.0, -447.0, -2.39, 20174, 36.97, 19387.0, 9756.3, 1.06, 31.58
FROM km_equity_symbols WHERE symbol = 'PTCIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 28.2, 28.2, 28.2, 28.2, 29.5, -1.3, -4.41, 2000, 0.01, 62.9, 23.0, -7.54, -48.07
FROM km_equity_symbols WHERE symbol = 'PULZ'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 332.05, 346.0, 318.5, 340.0, 334.25, 5.75, 1.72, 9750, 0.33, 587.95, 119.55, -4.56, 142.77
FROM km_equity_symbols WHERE symbol = 'PURPLEUTED'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 265.0, 283.0, 252.2, 253.2, 255.26, -2.06, -0.81, 9953178, 272.35, 338.95, 208.7, 9.96, 2.61
FROM km_equity_symbols WHERE symbol = 'PURVA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 63.0, 63.0, 62.0, 62.0, 64.0, -2.0, -3.13, 1600, 0.01, 148.0, 62.0, -18.83, -54.04
FROM km_equity_symbols WHERE symbol = 'PURVFLEXI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 90.0, 90.2, 90.0, 90.1, 89.0, 1.1, 1.24, 4000, 0.04, 148.75, 85.65, -14.87, NULL
FROM km_equity_symbols WHERE symbol = 'PUSHPA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1070.05, 1074.8, 1047.1, 1048.3, 1081.5, -33.2, -3.07, 262874, 27.85, 1249.7, 830.0, 0.54, -1.15
FROM km_equity_symbols WHERE symbol = 'PVRINOX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 100.69, 111.49, 95.43, 106.9, 100.36, 6.54, 6.52, 85349296, 906.75, 161.99, 95.43, -16.74, NULL
FROM km_equity_symbols WHERE symbol = 'PWL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 58.4, 58.4, NULL, NULL, NULL, NULL, 85.75, 52.5, -4.26, -29.21
FROM km_equity_symbols WHERE symbol = 'QFIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 88.3, 88.3, 88.3, 88.3, 87.15, 1.15, 1.32, 1000, 0.01, 112.87, 71.63, 1.49, -14.19
FROM km_equity_symbols WHERE symbol = 'QMSMEDI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 802.9, 818.6, 785.0, 804.7, 800.6, 4.1, 0.51, 836232, 67.13, 1082.0, 267.8, 20.71, NULL
FROM km_equity_symbols WHERE symbol = 'QPOWER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 293.6, 295.0, 287.0, 292.0, 293.6, -1.6, -0.54, 248378, 7.23, 618.85, 248.55, -4.17, -48.85
FROM km_equity_symbols WHERE symbol = 'QUADFUTURE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2.5, 2.5, 2.5, 2.5, 2.4, 0.1, 4.17, 36000, 0.01, 4.65, 2.1, 6.38, -35.9
FROM km_equity_symbols WHERE symbol = 'QUADPRO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 205.95, 207.11, 200.41, 206.08, 206.42, -0.34, -0.16, 182116, 3.71, 708.85, 191.0, -3.18, -66.27
FROM km_equity_symbols WHERE symbol = 'QUESS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 135.0, 135.5, 125.0, 128.5, 134.35, -5.85, -4.35, 282000, 3.64, 155.0, 75.15, 23.89, -18.14
FROM km_equity_symbols WHERE symbol = 'QUESTLAB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 33.15, 33.15, 33.1, 33.1, 34.0, -0.9, -2.65, 1000, NULL, 72.0, 27.15, -17.04, -49.47
FROM km_equity_symbols WHERE symbol = 'QUICKTOUCH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 25.55, 25.55, 25.55, 25.55, 26.45, -0.9, -3.4, 1600, NULL, 37.0, 22.2, -15.54, -24.85
FROM km_equity_symbols WHERE symbol = 'QVCEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3.05, 3.25, 3.05, 3.12, 3.12, NULL, NULL, 14282, NULL, 5.37, 2.81, -8.5, -27.44
FROM km_equity_symbols WHERE symbol = 'RADAAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2831.0, 2831.0, 2767.8, 2791.4, 2831.2, -39.8, -1.41, 201146, 56.1, 3591.9, 1845.5, -4.66, 31.35
FROM km_equity_symbols WHERE symbol = 'RADICO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 6.24, 6.26, 6.12, 6.18, 6.22, -0.04, -0.64, 39060, 0.02, 11.5, 5.78, -3.59, -42.99
FROM km_equity_symbols WHERE symbol = 'RADIOCITY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 53.0, 53.0, NULL, NULL, NULL, NULL, 97.3, 50.0, -8.62, -45.53
FROM km_equity_symbols WHERE symbol = 'RADIOWALLA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 332.0, 332.9, 329.35, 332.0, 336.25, -4.25, -1.26, 446042, 14.76, 478.95, 265.5, -2.4, 2.72
FROM km_equity_symbols WHERE symbol = 'RAILTEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 155.15, 156.67, 151.21, 151.5, 156.77, -5.27, -3.36, 2475454, 38.14, 176.0, 99.9, 7.78, 14.51
FROM km_equity_symbols WHERE symbol = 'RAIN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1217.0, 1217.0, 1176.4, 1182.0, 1215.7, -33.7, -2.77, 92573, 11.1, 1645.7, 1090.0, -5.94, -9.89
FROM km_equity_symbols WHERE symbol = 'RAINBOW'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 82.0, 82.0, 80.0, 80.0, 77.3, 2.7, 3.49, 3000, 0.02, 101.9, 70.05, 0.88, -11.31
FROM km_equity_symbols WHERE symbol = 'RAJINDLTD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 243.6, 248.0, 230.0, 230.0, 233.85, -3.85, -1.65, 8500, 0.2, 299.0, 173.15, -6.7, -11.98
FROM km_equity_symbols WHERE symbol = 'RAJPUTANA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 40.5, 40.9, 39.26, 40.34, 40.9, -0.56, -1.37, 936, NULL, 90.1, 36.7, -0.35, -51.45
FROM km_equity_symbols WHERE symbol = 'RAJTV'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 267.0, 268.0, 261.6, 264.6, 267.5, -2.9, -1.08, 337733, 8.94, 385.9, 196.0, 6.07, 18.29
FROM km_equity_symbols WHERE symbol = 'RALLIS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1135.2, 1148.7, 1128.7, 1145.0, 1145.0, NULL, NULL, 91192, 10.4, 1214.5, 788.2, 5.54, 32.86
FROM km_equity_symbols WHERE symbol = 'RAMCOCEM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 178.0, 178.0, 175.0, 175.0, 177.1, -2.1, -1.19, 3000, 0.05, 229.0, 171.0, -2.62, NULL
FROM km_equity_symbols WHERE symbol = 'RAPIDFLEET'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 280.0, 284.9, 280.0, 284.9, 290.0, -5.1, -1.76, 2400, 0.07, 384.9, 215.2, 13.96, -5.0
FROM km_equity_symbols WHERE symbol = 'RAPPID'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 565.75, 583.9, 480.5, 545.0, 571.1, -26.1, -4.57, 4456682, 235.1, 741.6, 412.85, -17.64, -14.12
FROM km_equity_symbols WHERE symbol = 'RATEGAIN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2255.0, 2299.9, 2100.0, 2257.0, 2324.4, -67.4, -2.9, 324552, 71.81, 3050.0, 1936.5, 3.18, -11.11
FROM km_equity_symbols WHERE symbol = 'RATNAMANI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 987.0, 987.0, 947.5, 956.0, 988.4, -32.4, -3.28, 92722, 8.88, 1411.9, 865.3, -1.67, -20.15
FROM km_equity_symbols WHERE symbol = 'RAYMONDLSL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

