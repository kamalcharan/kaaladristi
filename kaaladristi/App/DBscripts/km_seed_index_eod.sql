-- Auto-generated: index EOD data (14-Feb-2026)
-- Uses subquery to resolve index_id from name

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 25571.15, 25630.35, 25444.3, 25471.1, 25807.2, -336.1, -1.3, 453523192, 40136.9, 26373.2, 21743.65, -1.02, 10.59
FROM km_index_symbols WHERE name = 'NIFTY 50'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 60504.4, 60621.9, 60073.55, 60186.65, 60739.75, -553.1, -0.91, 236603159, 11647.96, 61764.85, 47702.9, 1.02, 21.93
FROM km_index_symbols WHERE name = 'NIFTY BANK'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 28261.75, 28335.85, 28085.5, 28126.35, 28385.2, -258.85, -0.91, 181198945, 18259.82, 28413.85, 22842.6, 1.96, 20.86
FROM km_index_symbols WHERE name = 'NIFTY FINANCIAL SERVICES'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 13750.5, 13763.2, 13580.6, 13628.35, 13893.5, -265.15, -1.91, 223774205, 11929.89, 14118.4, 6054.2, -0.15, 19.97
FROM km_index_symbols WHERE name = 'NIFTY MIDCAP SELECT'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 69374.65, 69381.8, 68485.5, 68826.75, 69916.1, -1089.35, -1.56, 217757583, 10822.62, 70833.65, 56192.45, 0.44, 12.93
FROM km_index_symbols WHERE name = 'NIFTY NEXT 50'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 26212.25, 26252.8, 26063.75, 26092.4, 26448.05, -355.65, -1.34, 671280775, 50959.52, 26975.15, 22177.35, -0.78, 11.01
FROM km_index_symbols WHERE name = 'NIFTY 100'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 14298.95, 14313.25, 14205.75, 14221.9, 14425.5, -203.6, -1.41, 1507331486, 74335.31, 14700.95, 11941.45, -0.68, 11.98
FROM km_index_symbols WHERE name = 'NIFTY 200'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 23448.7, 23464.05, 23285.0, 23313.15, 23651.55, -338.4, -1.43, 2227481447, 94710.06, 24144.2, 19519.85, -0.71, 11.52
FROM km_index_symbols WHERE name = 'NIFTY 500'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1584.4, 1586.4, 1574.8, 1577.85, 1600.6, -22.75, -1.42, 968142317, 67621.24, 1641.4, 1346.5, -1.15, NULL
FROM km_index_symbols WHERE name = 'NIFTY INDIA FPI 150'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 16629.75, 16632.65, 16482.95, 16518.0, 16769.6, -251.6, -1.5, 1579199891, 77287.75, 17095.2, 8318.55, -0.47, 13.73
FROM km_index_symbols WHERE name = 'NIFTY LARGEMIDCAP 250'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 22057.2, 22075.55, 21771.25, 21907.4, 22232.9, -325.5, -1.46, 383555877, 8426.71, 26476.9, 8567.2, 0.58, 2.03
FROM km_index_symbols WHERE name = 'NIFTY MICROCAP 250'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 59978.45, 59981.0, 59194.25, 59438.0, 60470.85, -1032.85, -1.71, 836050711, 23375.79, 61548.85, 46865.7, -0.27, 16.82
FROM km_index_symbols WHERE name = 'NIFTY MIDCAP 100'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 22079.55, 22080.4, 21778.0, 21884.35, 22252.4, -368.05, -1.65, 907919116, 26328.22, 22650.05, 17269.5, -0.16, 16.43
FROM km_index_symbols WHERE name = 'NIFTY MIDCAP 150'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 17095.9, 17104.35, 16880.45, 16960.45, 17251.5, -291.05, -1.69, 317479573, 16442.34, 17572.45, 13269.65, -0.43, 18.96
FROM km_index_symbols WHERE name = 'NIFTY MIDCAP 50'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 13154.65, 13162.05, 13062.35, 13078.15, 13268.15, -190.0, -1.43, 2611037324, 103136.77, 13842.6, 7145.35, -0.67, 11.17
FROM km_index_symbols WHERE name = 'NIFTY TOTAL MARKET'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 17723.45, 17724.4, 17544.75, 17594.35, 17868.95, -274.6, -1.54, 2227481447, 94710.06, 18330.05, 14479.0, -0.76, 11.42
FROM km_index_symbols WHERE name = 'NIFTY500 LARGEMIDSMALL EQUAL-CAP WEIGHTED'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 16162.85, 16164.55, 16024.55, 16056.1, 16298.75, -242.65, -1.49, 2227481447, 94710.06, 17112.15, 8254.5, -0.76, 11.34
FROM km_index_symbols WHERE name = 'NIFTY500 MULTICAP 50:25:25'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 28305.55, 28503.15, 28161.25, 28234.3, 28504.05, -269.75, -0.95, 73940245, 4678.24, 29179.1, 19316.65, 1.14, 26.36
FROM km_index_symbols WHERE name = 'NIFTY AUTO'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 28472.7, 28559.3, 28253.8, 28425.15, 28783.9, -358.75, -1.25, 9165957, 1480.0, 31895.45, 25227.25, -1.18, NULL
FROM km_index_symbols WHERE name = 'NIFTY CHEMICALS'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 37928.25, 37931.3, 37533.65, 37618.3, 38110.1, -491.8, -1.29, 16712698, 1878.87, 44426.55, 21967.45, 1.2, 3.5
FROM km_index_symbols WHERE name = 'NIFTY CONSUMER DURABLES'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 30807.25, 30881.1, 30560.0, 30601.25, 30967.6, -366.35, -1.18, 181198945, 18259.82, NULL, NULL, 0.82, 22.8
FROM km_index_symbols WHERE name = 'NIFTY FINANCIAL SERVICES 25/50'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 32069.1, 32094.65, 31753.15, 31916.55, 32288.25, -371.7, -1.15, 134115359, 11829.88, 32654.2, 23850.75, 1.02, 27.2
FROM km_index_symbols WHERE name = 'NIFTY FINANCIAL SERVICES EX-BANK'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 51690.05, 51690.05, 50811.85, 50902.15, 51885.75, -983.6, -1.9, 24399614, 1964.84, 58485.05, 49336.5, -3.19, -4.53
FROM km_index_symbols WHERE name = 'NIFTY FMCG'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 14473.9, 14495.6, 14343.2, 14384.05, 14507.05, -123.0, -0.85, 26133620, 3140.5, 15144.95, 7249.7, -1.42, 5.34
FROM km_index_symbols WHERE name = 'NIFTY HEALTHCARE INDEX'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 31487.4, 32932.75, 31422.6, 32681.5, 33160.2, -478.7, -1.44, 112452271, 15473.03, 40905.4, 30918.95, -14.53, -20.9
FROM km_index_symbols WHERE name = 'NIFTY IT'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1461.75, 1486.45, 1446.65, 1462.8, 1474.05, -11.25, -0.76, 45229715, 610.48, 1786.15, 1313.85, 3.46, -5.3
FROM km_index_symbols WHERE name = 'NIFTY MEDIA'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 12073.9, 12086.5, 11841.25, 11872.8, 12279.2, -406.4, -3.31, 145221042, 5863.39, 12509.75, 7690.2, 4.56, 42.42
FROM km_index_symbols WHERE name = 'NIFTY METAL'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 21065.95, 21065.95, 20733.65, 20839.3, 21252.8, -413.5, -1.95, 185198833, 8863.1, 21300.0, 13363.1, 1.09, 42.03
FROM km_index_symbols WHERE name = 'NIFTY MIDSMALL FINANCIAL SERVICES'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 42613.85, 42740.85, 42161.8, 42224.95, 42841.5, -616.55, -1.44, 27093203, 2338.91, 46103.35, 31279.6, -3.2, 8.17
FROM km_index_symbols WHERE name = 'NIFTY MIDSMALL HEALTHCARE'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 9081.85, 9242.1, 8964.6, 9127.35, 9309.8, -182.45, -1.96, 417642451, 6206.6, 11536.7, 7836.0, -10.48, -6.57
FROM km_index_symbols WHERE name = 'NIFTY MIDSMALL IT & TELECOM'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 12120.75, 12132.8, 11958.15, 11976.45, 12205.55, -229.1, -1.88, 71028180, 3103.28, 13607.2, 6645.9, 2.78, 19.8
FROM km_index_symbols WHERE name = 'NIFTY OIL & GAS'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 22325.9, 22408.5, 22134.0, 22194.9, 22386.3, -191.4, -0.85, 21636092, 2567.11, 23492.55, 19121.1, -1.63, 3.58
FROM km_index_symbols WHERE name = 'NIFTY PHARMA'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 28905.45, 29008.45, 28630.7, 28691.8, 28987.05, -295.25, -1.02, 181019735, 8782.14, 29748.45, 23783.15, 0.43, 16.31
FROM km_index_symbols WHERE name = 'NIFTY PRIVATE BANK'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 9180.45, 9198.5, 9122.55, 9166.5, 9229.45, -62.95, -0.68, 94833595, 3195.74, 9294.6, 5530.35, 5.06, 52.83
FROM km_index_symbols WHERE name = 'NIFTY PSU BANK'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 831.3, 831.3, 811.2, 823.6, 842.35, -18.75, -2.23, 15607730, 1609.59, 1049.7, 742.2, -4.0, -2.67
FROM km_index_symbols WHERE name = 'NIFTY REALTY'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 18378.95, 18407.85, 18203.35, 18256.8, 18440.15, -183.35, -0.99, 37522052, 4091.92, 19594.1, 16294.6, -1.82, NULL
FROM km_index_symbols WHERE name = 'NIFTY500 HEALTHCARE'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 50976.55, 50979.8, 50184.1, 50272.85, 51351.65, -1078.8, -2.1, 208849870, 17421.57, NULL, NULL, 1.87, 8.69
FROM km_index_symbols WHERE name = 'NIFTY ALPHA 50'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 27306.7, 27345.55, 27145.9, 27181.3, 27355.9, -174.6, -0.64, 162198114, 18425.41, NULL, NULL, 0.54, 6.8
FROM km_index_symbols WHERE name = 'NIFTY ALPHA LOW-VOLATILITY 30'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 22624.7, 22641.15, 22459.4, 22485.55, 22745.55, -260.0, -1.14, 91216041, 12379.13, NULL, NULL, -1.17, 6.97
FROM km_index_symbols WHERE name = 'NIFTY ALPHA QUALITY LOW-VOLATILITY 30'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 20775.2, 20844.1, 20665.05, 20688.6, 20968.15, -279.55, -1.33, 243201441, 25444.98, NULL, NULL, -2.47, 8.13
FROM km_index_symbols WHERE name = 'NIFTY ALPHA QUALITY VALUE LOW-VOLATILITY 30'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 6243.8, 6289.3, 6211.0, 6257.1, 6359.8, -102.7, -1.61, 440407956, 24636.31, 6584.65, 5288.6, -1.12, 7.29
FROM km_index_symbols WHERE name = 'NIFTY DIVIDEND OPPORTUNITIES 50'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 11521.55, 11697.1, 11504.65, 11604.7, 11788.9, -184.2, -1.56, 92237488, 13623.46, 12852.45, 9722.65, -7.52, 1.51
FROM km_index_symbols WHERE name = 'NIFTY GROWTH SECTORS 15'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3884.6, 3884.65, 3812.3, 3830.5, 3920.6, -90.1, -2.3, 717603198, 16155.28, NULL, NULL, -1.49, 19.03
FROM km_index_symbols WHERE name = 'NIFTY HIGH BETA 50'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 25259.25, 25288.85, 25119.6, 25152.85, 25427.55, -274.7, -1.08, 265065098, 31243.2, NULL, NULL, -1.64, 7.66
FROM km_index_symbols WHERE name = 'NIFTY LOW VOLATILITY 50'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 23450.05, 23461.85, 23134.6, 23249.3, 23702.85, -453.55, -1.91, 101046182, 11300.02, NULL, NULL, -1.93, 7.83
FROM km_index_symbols WHERE name = 'NIFTY MIDCAP150 QUALITY 50'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 16946.85, 17020.45, 16866.8, 16883.6, 17123.35, -239.75, -1.4, 186498958, 22489.51, NULL, NULL, -3.91, 3.25
FROM km_index_symbols WHERE name = 'NIFTY QUALITY LOW-VOLATILITY 30'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 24552.8, 24576.55, 24259.55, 24384.65, 24743.5, -358.85, -1.45, 199620317, 5309.15, NULL, NULL, -2.06, -0.02
FROM km_index_symbols WHERE name = 'NIFTY SMALLCAP250 QUALITY 50'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 9365.55, 9416.65, 9354.85, 9380.35, 9491.75, -111.4, -1.17, 173757985, 20688.75, NULL, NULL, -3.29, 3.01
FROM km_index_symbols WHERE name = 'NIFTY TOP 10 EQUAL WEIGHT'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 10646.9, 10694.05, 10638.7, 10654.4, 10761.35, -106.95, -0.99, 218145641, 26602.59, NULL, NULL, -1.42, 10.42
FROM km_index_symbols WHERE name = 'NIFTY TOP 15 EQUAL WEIGHT'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 9435.5, 9471.9, 9398.65, 9414.0, 9533.3, -119.3, -1.25, 290183205, 30020.86, NULL, NULL, -1.6, 8.42
FROM km_index_symbols WHERE name = 'NIFTY TOP 20 EQUAL WEIGHT'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 42237.6, 42262.4, 41775.6, 41839.35, 42690.1, -850.75, -1.99, 149174116, 16146.25, NULL, NULL, 1.09, NULL
FROM km_index_symbols WHERE name = 'NIFTY TOTAL MARKET MOMENTUM QUALITY 50'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 18308.15, 18320.15, 18152.75, 18185.45, 18391.75, -206.3, -1.12, 228097639, 16535.75, NULL, NULL, 1.44, 10.39
FROM km_index_symbols WHERE name = 'NIFTY100 ALPHA 30'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 33933.55, 33941.65, 33606.7, 33705.55, 34204.8, -499.25, -1.46, 671280775, 50959.52, NULL, NULL, 0.21, 14.04
FROM km_index_symbols WHERE name = 'NIFTY100 EQUAL WEIGHT'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 13908.8, 13909.2, 13732.9, 13798.25, 14010.15, -211.9, -1.51, 2227481447, 94710.06, NULL, NULL, -0.86, 10.02
FROM km_index_symbols WHERE name = 'NIFTY500 EQUAL WEIGHT'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 41253.75, 41294.0, 40786.05, 40851.0, 41691.85, -840.85, -2.02, 123440152, 14942.14, NULL, NULL, -0.22, 7.41
FROM km_index_symbols WHERE name = 'NIFTY500 MULTICAP MOMENTUM QUALITY 50'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 4853.35, 4871.15, 4776.2, 4788.3, 4912.65, -124.35, -2.53, 34243677, 3319.4, 4964.25, 2885.1, 2.49, 43.67
FROM km_index_symbols WHERE name = 'NIFTY CAPITAL MARKETS'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 9920.75, 9924.2, 9780.85, 9795.95, 10019.9, -223.95, -2.24, 218104155, 9037.13, 10069.3, 7502.95, 3.33, 24.89
FROM km_index_symbols WHERE name = 'NIFTY COMMODITIES'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 14799.75, 14840.55, 14706.6, 14759.5, 14974.25, -214.75, -1.43, 555716763, 17349.99, 15284.3, 12226.8, 0.1, 11.49
FROM km_index_symbols WHERE name = 'NIFTY CONGLOMERATE 50'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 15418.25, 15418.3, 15213.4, 15288.05, 15499.8, -211.75, -1.37, 29932641, 3731.91, 16859.35, 13680.9, -1.38, 3.67
FROM km_index_symbols WHERE name = 'NIFTY CORE HOUSING'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 6903.3, 6911.55, 6795.2, 6806.45, 6959.3, -152.85, -2.2, 94561124, 2658.53, 7002.0, 5300.65, 4.76, 22.84
FROM km_index_symbols WHERE name = 'NIFTY CPSE'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 36154.0, 36168.55, 35678.1, 35709.9, 36452.65, -742.75, -2.04, 309013062, 7621.13, 36938.9, 29313.2, 3.76, 14.14
FROM km_index_symbols WHERE name = 'NIFTY ENERGY'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3072.8, 3075.75, 3037.75, 3058.2, 3094.5, -36.3, -1.17, 138090335, 8150.11, NULL, NULL, -1.03, 11.05
FROM km_index_symbols WHERE name = 'NIFTY EV & NEW AGE AUTOMOTIVE'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 12043.3, 12047.8, 11913.4, 11927.95, 12104.65, -176.7, -1.46, 386664519, 18806.08, 12121.75, 9839.7, 1.95, 16.23
FROM km_index_symbols WHERE name = 'NIFTY HOUSING'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 11918.55, 11932.7, 11759.7, 11781.65, 11976.5, -194.85, -1.63, 135172416, 9693.41, 12716.2, 10090.65, -2.17, 9.24
FROM km_index_symbols WHERE name = 'NIFTY INDIA CONSUMPTION'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 15028.05, 15148.7, 14926.4, 15018.4, 15295.75, -277.35, -1.81, 63599815, 5374.29, 18764.95, 13221.9, -1.75, 0.26
FROM km_index_symbols WHERE name = 'NIFTY INDIA CORPORATE GROUP INDEX - TATA GROUP 25% CAP'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 8071.35, 8104.9, 7962.8, 7991.75, 8064.45, -72.7, -0.9, 27291218, 3873.28, 9195.15, 5025.35, 2.17, 41.63
FROM km_index_symbols WHERE name = 'NIFTY INDIA DEFENCE'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 8396.9, 8509.55, 8312.55, 8446.3, 8596.75, -150.45, -1.75, 563313614, 21575.33, 10152.15, 4924.4, -9.53, -4.64
FROM km_index_symbols WHERE name = 'NIFTY INDIA DIGITAL'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 11491.55, 11491.95, 11352.25, 11368.35, 11541.6, -173.25, -1.5, 882980858, 17463.96, 11820.05, 9210.4, 3.08, NULL
FROM km_index_symbols WHERE name = 'NIFTY INDIA INFRASTRUCTURE & LOGISTICS'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1313.2, 1317.75, 1282.95, 1290.45, 1319.6, -29.15, -2.21, 127751166, 4230.38, 1501.9, 1056.45, -5.52, NULL
FROM km_index_symbols WHERE name = 'NIFTY INDIA INTERNET'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 15673.9, 15695.95, 15542.85, 15570.85, 15781.8, -210.95, -1.34, 291689498, 19665.9, NULL, NULL, 2.09, 20.82
FROM km_index_symbols WHERE name = 'NIFTY INDIA MANUFACTURING'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 11634.95, 11650.25, 11508.5, 11548.6, 11711.0, -162.4, -1.39, 605786630, 13887.67, NULL, NULL, -0.45, 9.01
FROM km_index_symbols WHERE name = 'NIFTY INDIA NEW AGE CONSUMPTION'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3296.0, 3297.05, 3257.95, 3264.35, 3315.0, -50.65, -1.53, 125242428, 3406.98, 4005.5, 3099.4, -2.68, -4.87
FROM km_index_symbols WHERE name = 'NIFTY INDIA RAILWAYS PSU'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 38100.1, 38157.0, 37693.25, 37770.2, 38603.7, -833.5, -2.16, 546967902, 12991.18, NULL, NULL, -1.34, 12.58
FROM km_index_symbols WHERE name = 'NIFTY INDIA SELECT 5 CORPORATE GROUPS (MAATR)'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 8106.75, 8106.75, 7960.65, 8013.15, 8142.1, -128.95, -1.58, 28991395, 1013.48, 9497.2, 7446.9, -0.86, -1.78
FROM km_index_symbols WHERE name = 'NIFTY INDIA TOURISM'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 9631.45, 9646.4, 9528.0, 9542.5, 9663.3, -120.8, -1.25, 213908222, 10265.67, 9792.6, 7589.95, 3.42, 19.05
FROM km_index_symbols WHERE name = 'NIFTY INFRASTRUCTURE'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1989.8, 1994.05, 1964.55, 1979.5, 1997.75, -18.25, -0.91, 248596122, 5088.77, 2289.75, 1617.15, -0.41, 4.35
FROM km_index_symbols WHERE name = 'NIFTY IPO'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 15743.65, 15774.4, 15563.85, 15667.2, 15929.5, -262.3, -1.65, 158691684, 6928.83, 16755.8, 11541.7, -0.96, 21.88
FROM km_index_symbols WHERE name = 'NIFTY MIDCAP LIQUID 15'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 18499.25, 18501.75, 18241.7, 18295.15, 18594.95, -299.8, -1.61, 407703676, 4648.47, 20923.3, 16870.2, -1.38, 3.12
FROM km_index_symbols WHERE name = 'NIFTY MIDSMALL INDIA CONSUMPTION'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 31211.4, 31211.4, 30751.8, 30800.1, 31422.35, -622.25, -1.98, 59224471, 5024.78, 31603.15, 23981.05, 1.33, 17.67
FROM km_index_symbols WHERE name = 'NIFTY MNC'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 23340.75, 23411.1, 23093.6, 23140.85, 23438.2, -297.35, -1.27, 180612860, 9273.93, NULL, NULL, 1.89, 25.72
FROM km_index_symbols WHERE name = 'NIFTY MOBILITY'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 15534.7, 15540.6, 15269.0, 15299.25, 15585.6, -286.35, -1.84, 112476229, 7349.78, 16983.45, 13980.9, -2.39, 3.13
FROM km_index_symbols WHERE name = 'NIFTY NON-CYCLICAL CONSUMER'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 10286.4, 10289.65, 10159.1, 10174.8, 10348.5, -173.7, -1.68, 203493610, 6617.73, 10456.15, 7956.45, 3.42, 19.64
FROM km_index_symbols WHERE name = 'NIFTY PSE'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 16190.05, 16198.6, 16071.55, 16093.55, 16265.55, -172.0, -1.06, 638313412, 20437.46, 16378.35, 12891.5, 1.0, 17.72
FROM km_index_symbols WHERE name = 'NIFTY RURAL'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 33028.95, 33165.0, 32998.7, 33037.0, 33409.4, -372.4, -1.11, 345064097, 31487.59, 34549.75, 29070.85, -1.5, 8.34
FROM km_index_symbols WHERE name = 'NIFTY SERVICES SECTOR'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 7996.6, 8052.1, 7942.95, 7999.55, 8130.55, -131.0, -1.61, 83035008, 11972.39, 8663.6, 7121.55, -5.06, -0.04
FROM km_index_symbols WHERE name = 'NIFTY SHARIAH 25'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 26.8, 37.85, 26.8, 37.8, 31.55, 6.25, 19.81, 19200, 0.07, 46.9, 20.4, 20.96, -5.5
FROM km_index_symbols WHERE name = 'SHANTHALA'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 25950.2, 26030.55, 25668.3, 25724.75, 26085.75, -361.0, -1.38, 151412666, 7770.46, 26459.7, 18482.85, 0.64, 23.64
FROM km_index_symbols WHERE name = 'NIFTY TRANSPORTATION & LOGISTICS'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2033.95, 2041.9, 2003.65, 2020.3, 2037.35, -17.05, -0.84, 62164620, 633.96, 2789.8, 1839.0, -0.98, NULL
FROM km_index_symbols WHERE name = 'NIFTY WAVES'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 5142.95, 5154.0, 5112.0, 5130.0, 5198.6, -68.6, -1.32, 580213455, 44008.97, NULL, NULL, -1.62, 12.4
FROM km_index_symbols WHERE name = 'NIFTY100 ENHANCED ESG'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 7732.5, 7752.25, 7662.25, 7674.9, 7752.25, -77.35, -1.0, 199725517, 12793.7, 7774.6, 5985.3, 3.58, 22.34
FROM km_index_symbols WHERE name = 'NIFTY100 LIQUID 15'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 4461.8, 4536.95, 4440.15, 4507.65, 4589.65, -82.0, -1.79, 129041548, 15470.38, 5145.6, 4235.9, -6.73, -5.24
FROM km_index_symbols WHERE name = 'NIFTY50 SHARIAH'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 15896.95, 15906.45, 15731.2, 15758.95, 16002.3, -243.35, -1.52, 268017013, 17340.77, 16323.15, 12294.45, 0.61, 15.27
FROM km_index_symbols WHERE name = 'NIFTY500 MULTICAP INDIA MANUFACTURING 50:30:20'
ON CONFLICT (index_id, trade_date) DO NOTHING;

INSERT INTO km_index_eod (index_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 14311.5, 14320.3, 14148.55, 14172.3, 14374.55, -202.25, -1.41, 704542263, 14248.3, 15154.1, 11537.35, 1.89, 14.55
FROM km_index_symbols WHERE name = 'NIFTY500 MULTICAP INFRASTRUCTURE 50:30:20'
ON CONFLICT (index_id, trade_date) DO NOTHING;

