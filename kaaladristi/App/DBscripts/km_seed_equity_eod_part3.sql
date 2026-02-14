-- Auto-generated: equity EOD part 3 (380 rows)
-- Uses subquery to resolve equity_id from symbol

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 63.8, 64.49, 63.5, 64.0, 64.11, -0.11, -0.17, 2149181, 13.75, 89.5, 59.4, -5.41, -13.23
FROM km_equity_symbols WHERE symbol = 'RBA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 313.45, 317.2, 310.0, 312.55, 317.0, -4.45, -1.4, 3835217, 120.45, 332.0, 149.21, 2.24, 89.94
FROM km_equity_symbols WHERE symbol = 'RBLBANK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 367.1, 379.0, 367.1, 379.0, 379.55, -0.55, -0.14, 3600, 0.13, 524.8, 249.85, -7.38, -0.2
FROM km_equity_symbols WHERE symbol = 'RBMINFRA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 91.0, 91.0, 89.5, 90.0, 92.0, -2.0, -2.17, 3200, 0.03, 143.0, 81.0, -1.42, -21.81
FROM km_equity_symbols WHERE symbol = 'RBS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 22.0, 22.0, 22.0, 22.0, 22.2, -0.2, -0.9, 3000, 0.01, 30.85, 16.5, 15.79, -3.3
FROM km_equity_symbols WHERE symbol = 'RCDL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 132.6, 133.09, 129.8, 130.43, 134.42, -3.99, -2.97, 1184112, 15.46, 166.5, 110.8, -5.13, -7.71
FROM km_equity_symbols WHERE symbol = 'RCF'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 110.0, 110.0, NULL, NULL, NULL, NULL, 175.0, 55.2, 0.41, -5.86
FROM km_equity_symbols WHERE symbol = 'READYMIX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 348.1, 348.5, 339.8, 346.0, 350.7, -4.7, -1.34, 8552636, 294.6, 450.0, 330.95, -5.7, -15.54
FROM km_equity_symbols WHERE symbol = 'RECLTD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 265.2, 265.8, 260.0, 262.5, 265.25, -2.75, -1.04, 760948, 19.98, 334.8, 176.94, -3.86, 7.34
FROM km_equity_symbols WHERE symbol = 'REDINGTON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 239.0, 240.0, 230.1, 231.5, 243.15, -11.65, -4.79, 572018, 13.31, 534.0, 209.69, -4.2, -43.1
FROM km_equity_symbols WHERE symbol = 'REFEX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 46.2, 46.2, 46.2, 46.2, 48.2, -2.0, -4.15, 1000, NULL, 83.9, 39.0, -1.91, -49.29
FROM km_equity_symbols WHERE symbol = 'REFRACTORY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 59.3, 60.6, 58.12, 59.5, 60.23, -0.73, -1.21, 441241, 2.61, 145.7, 57.27, -12.28, NULL
FROM km_equity_symbols WHERE symbol = 'REGAAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 362.05, 364.95, 356.0, 358.5, 366.6, -8.1, -2.21, 71038, 2.55, 526.0, 354.2, -9.39, -27.11
FROM km_equity_symbols WHERE symbol = 'RELAXO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1445.5, 1450.7, 1416.3, 1418.6, 1448.9, -30.3, -2.09, 10755693, 1531.32, 1611.8, 1114.85, -2.35, 16.65
FROM km_equity_symbols WHERE symbol = 'RELIANCE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 251.7, 251.7, 240.6, 243.5, 252.43, -8.93, -3.54, 1387778, 34.13, 295.0, 202.52, 0.06, 2.03
FROM km_equity_symbols WHERE symbol = 'RELIGARE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 108.99, 109.25, 104.11, 104.11, 109.58, -5.47, -4.99, 1567460, 16.56, 423.4, 104.11, -29.9, -60.96
FROM km_equity_symbols WHERE symbol = 'RELINFRA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 690.0, 690.0, 671.0, 671.0, 700.0, -29.0, -4.14, 3400, 0.23, 1145.0, 611.05, -4.04, -66.16
FROM km_equity_symbols WHERE symbol = 'REMUS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 24.75, 24.75, 24.07, 24.45, 24.75, -0.3, -1.21, 2249499, 5.47, 35.85, 22.85, -2.47, -23.31
FROM km_equity_symbols WHERE symbol = 'RENUKA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 172.0, 178.2, 161.4, 178.0, 169.75, 8.25, 4.86, 18000, 0.3, 178.2, 57.0, 22.76, 165.67
FROM km_equity_symbols WHERE symbol = 'REXPIPES'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 51.75, 51.75, 51.6, 51.6, 54.3, -2.7, -4.97, 3000, 0.02, 113.3, 41.6, -0.77, -40.93
FROM km_equity_symbols WHERE symbol = 'REXPRO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 452.4, 453.9, 432.35, 435.0, 457.1, -22.1, -4.83, 112914, 4.98, 547.9, 376.45, -2.82, 1.56
FROM km_equity_symbols WHERE symbol = 'RHIM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 67.85, 67.95, 63.5, 63.6, 65.15, -1.55, -2.38, 16000, 0.1, 102.05, 50.0, 9.75, -5.07
FROM km_equity_symbols WHERE symbol = 'RICHA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 36.25, 36.7, 35.15, 36.05, 36.1, -0.05, -0.14, 16600, 0.06, 53.9, 25.55, -0.7, 20.4
FROM km_equity_symbols WHERE symbol = 'RILINFRA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 221.01, 221.85, 217.94, 218.98, 222.65, -3.67, -1.65, 402532, 8.84, 316.0, 192.4, -3.38, 2.42
FROM km_equity_symbols WHERE symbol = 'RITES'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 19.55, 19.55, NULL, NULL, NULL, NULL, 37.4, 19.1, -10.73, -43.17
FROM km_equity_symbols WHERE symbol = 'RITEZONE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 571.0, 578.7, 562.05, 565.0, 578.4, -13.4, -2.32, 413846, 23.71, 862.6, 474.3, 13.74, -14.79
FROM km_equity_symbols WHERE symbol = 'RKFORGE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 109.2, 110.98, 102.9, 105.85, 109.2, -3.35, -3.07, 93973, 1.0, 248.04, 97.5, -2.01, -52.15
FROM km_equity_symbols WHERE symbol = 'RKSWAMY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 315.0, 315.0, 302.0, 306.7, 309.35, -2.65, -0.86, 10200, 0.32, 404.0, 205.0, 1.56, -3.58
FROM km_equity_symbols WHERE symbol = 'RNFI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 145.6, 146.9, 143.55, 146.9, 146.8, 0.1, 0.07, 19200, 0.28, 158.0, 69.0, 1.38, NULL
FROM km_equity_symbols WHERE symbol = 'RNPL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 208.0, 208.0, 208.0, 208.0, 208.0, NULL, NULL, 250, 0.01, 460.0, 139.61, 5.05, -59.39
FROM km_equity_symbols WHERE symbol = 'ROCKINGDCE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 564.7, 564.7, 547.0, 549.75, 568.05, -15.3, -2.71, 244445, 13.47, 1158.0, 547.0, -15.38, -49.98
FROM km_equity_symbols WHERE symbol = 'ROUTE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 34.0, 34.15, 34.0, 34.15, 35.0, -0.85, -2.43, 3200, 0.01, 69.95, 28.65, -8.93, -50.04
FROM km_equity_symbols WHERE symbol = 'ROXHITECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 159.0, 159.0, NULL, NULL, NULL, NULL, 187.8, 114.25, -7.02, NULL
FROM km_equity_symbols WHERE symbol = 'ROYALARC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 27.41, 27.42, 26.7, 26.81, 27.61, -0.8, -2.9, 24365146, 65.76, 76.49, 25.92, -19.87, -32.23
FROM km_equity_symbols WHERE symbol = 'RPOWER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1420.0, 1425.6, 1393.5, 1409.6, 1428.2, -18.6, -1.3, 67487, 9.49, 1562.6, 853.55, -6.18, 23.84
FROM km_equity_symbols WHERE symbol = 'RRKABEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 65.0, 65.0, NULL, NULL, NULL, NULL, 75.0, 54.0, 0.78, NULL
FROM km_equity_symbols WHERE symbol = 'RTL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 36.95, 37.05, 34.82, 34.98, 36.95, -1.97, -5.33, 2421855, 8.56, 69.7, 31.98, -9.26, -28.05
FROM km_equity_symbols WHERE symbol = 'RTNINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 8.93, 8.94, 8.7, 8.81, 8.92, -0.11, -1.23, 8157573, 7.16, 16.92, 7.88, -1.12, -13.96
FROM km_equity_symbols WHERE symbol = 'RTNPOWER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 766.35, 792.6, 762.0, 785.0, 772.25, 12.75, 1.65, 226247, 17.71, 822.0, 570.75, 15.94, NULL
FROM km_equity_symbols WHERE symbol = 'RUBICON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 102.0, 102.0, 100.0, 100.0, 102.0, -2.0, -1.96, 1500, 0.02, 199.85, 96.05, -4.76, -47.64
FROM km_equity_symbols WHERE symbol = 'RULKA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 309.95, 311.45, 306.0, 309.1, 313.7, -4.6, -1.47, 8168629, 251.85, 447.8, 301.2, -6.39, -18.51
FROM km_equity_symbols WHERE symbol = 'RVNL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 188.0, 194.5, 188.0, 194.5, 188.5, 6.0, 3.18, 3000, 0.06, 217.7, 118.0, 13.44, 15.09
FROM km_equity_symbols WHERE symbol = 'SAAKSHI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 411.95, 422.35, 401.0, 416.5, 413.45, 3.05, 0.74, 124102, 5.16, 567.0, 345.0, 4.2, NULL
FROM km_equity_symbols WHERE symbol = 'SAATVIKGL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 5.15, 5.15, NULL, NULL, NULL, NULL, 9.9, 3.8, 14.44, -44.02
FROM km_equity_symbols WHERE symbol = 'SABAR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 344.0, 355.9, 344.0, 355.9, 345.0, 10.9, 3.16, 8400, 0.3, 430.65, 140.5, -10.35, NULL
FROM km_equity_symbols WHERE symbol = 'SACHEEROME'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 105.95, 105.95, 101.4, 101.4, 106.0, -4.6, -4.34, 2400, 0.03, 132.0, 76.95, -5.85, -15.5
FROM km_equity_symbols WHERE symbol = 'SADHAV'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1838.8, 1843.4, 1762.0, 1765.1, 1838.7, -73.6, -4.0, 52025, 9.33, 2507.1, 1670.15, -16.89, -12.23
FROM km_equity_symbols WHERE symbol = 'SAFARI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 255.0, 255.0, 244.15, 247.5, 251.3, -3.8, -1.51, 68000, 1.69, 319.0, 151.0, 1.14, NULL
FROM km_equity_symbols WHERE symbol = 'SAFEENTP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 47.31, 48.29, 47.11, 47.31, 48.48, -1.17, -2.41, 18233471, 86.83, 57.89, 37.6, -6.82, -5.15
FROM km_equity_symbols WHERE symbol = 'SAGILITY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 149.95, 149.95, 143.7, 145.1, 152.25, -7.15, -4.7, 9600, 0.14, 323.55, 138.15, -6.36, -70.86
FROM km_equity_symbols WHERE symbol = 'SAHAJSOLAR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 983.85, 1035.0, 975.05, 997.85, 985.25, 12.6, 1.28, 75375, 7.52, 1730.0, 685.0, 33.91, -32.37
FROM km_equity_symbols WHERE symbol = 'SAHANA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 270.0, 271.5, 266.2, 266.3, 275.5, -9.2, -3.34, 12400, 0.33, 437.5, 227.5, -3.48, -37.71
FROM km_equity_symbols WHERE symbol = 'SAHASRA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 11.4, 11.4, 10.75, 11.4, 11.4, NULL, NULL, 44000, 0.05, 32.75, 9.25, -5.11, -83.36
FROM km_equity_symbols WHERE symbol = 'SAIFL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 157.8, 161.3, 155.0, 159.0, 160.35, -1.35, -0.84, 19899685, 315.59, 163.0, 99.15, 7.61, 45.43
FROM km_equity_symbols WHERE symbol = 'SAIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 935.0, 935.0, 886.5, 917.0, 930.0, -13.0, -1.4, 397583, 36.13, 983.35, 636.1, 1.35, 34.88
FROM km_equity_symbols WHERE symbol = 'SAILIFE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 47.0, 47.0, 43.0, 43.0, 44.5, -1.5, -3.37, 36000, 0.16, 84.0, 43.0, -18.41, -48.47
FROM km_equity_symbols WHERE symbol = 'SAJHOTELS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 46.2, 46.2, NULL, NULL, NULL, NULL, 51.3, 28.8, 2.67, NULL
FROM km_equity_symbols WHERE symbol = 'SAMAY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 7.5, 7.86, 7.3, 7.5, 7.59, -0.09, -1.19, 27061, 0.02, 11.53, 5.0, -11.56, 11.77
FROM km_equity_symbols WHERE symbol = 'SAMBHAAV'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 97.47, 100.5, 96.1, 99.21, 98.5, 0.71, 0.72, 1156213, 11.49, 149.4, 81.42, 10.82, NULL
FROM km_equity_symbols WHERE symbol = 'SAMBHV'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 166.0, 167.2, 164.0, 165.8, 166.76, -0.96, -0.58, 405158, 6.71, 254.5, 121.1, -11.29, 3.96
FROM km_equity_symbols WHERE symbol = 'SAMHI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 146.5, 146.5, 143.25, 144.7, 146.78, -2.08, -1.42, 3675295, 53.23, 192.95, 97.61, 1.91, 15.46
FROM km_equity_symbols WHERE symbol = 'SAMMAANCAP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 204.65, 211.42, 204.65, 207.0, 208.76, -1.76, -0.84, 1235472, 25.72, 273.0, 112.4, -9.18, 75.38
FROM km_equity_symbols WHERE symbol = 'SANDUMA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 45.1, 45.1, NULL, NULL, NULL, NULL, 77.0, 42.55, -2.38, -35.57
FROM km_equity_symbols WHERE symbol = 'SANGANI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 4000.0, 4051.0, 3985.3, 4012.0, 4009.8, 2.2, 0.05, 11238, 4.52, 6717.0, 3976.0, -1.61, -25.36
FROM km_equity_symbols WHERE symbol = 'SANOFI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 4221.7, 4389.0, 4171.8, 4290.0, 4221.5, 68.5, 1.62, 23192, 9.95, 5894.5, 3990.0, 1.36, -8.86
FROM km_equity_symbols WHERE symbol = 'SANOFICONR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2210.1, 2270.0, 2190.1, 2226.1, 2229.4, -3.3, -0.15, 442609, 99.42, 2270.0, 972.2, 22.14, 86.64
FROM km_equity_symbols WHERE symbol = 'SANSERA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 217.25, 223.5, 214.22, 216.1, 220.19, -4.09, -1.86, 321014, 7.02, 368.0, 179.4, -4.65, -27.12
FROM km_equity_symbols WHERE symbol = 'SAPPHIRE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 496.4, 506.65, 490.3, 501.5, 499.05, 2.45, 0.49, 243196, 12.11, 639.75, 396.6, 3.89, 8.73
FROM km_equity_symbols WHERE symbol = 'SARDAEN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 351.9, 353.65, 341.25, 341.25, 354.65, -13.4, -3.78, 152592, 5.27, 603.0, 317.1, -3.04, -34.19
FROM km_equity_symbols WHERE symbol = 'SAREGAMA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 36.05, 36.05, NULL, NULL, NULL, NULL, 60.0, 32.5, 0.14, -33.24
FROM km_equity_symbols WHERE symbol = 'SAROJA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 228.0, 228.0, 216.2, 221.4, 227.5, -6.1, -2.68, 82500, 1.84, 302.95, 162.0, -7.51, -15.78
FROM km_equity_symbols WHERE symbol = 'SARTELE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 48.6, 51.0, 47.0, 51.0, 48.6, 2.4, 4.94, 20000, 0.1, 75.9, 31.8, 1.19, -27.71
FROM km_equity_symbols WHERE symbol = 'SATECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 58.6, 58.6, 58.6, 58.6, 55.85, 2.75, 4.92, 1500, 0.01, 174.0, 36.1, 12.91, -63.83
FROM km_equity_symbols WHERE symbol = 'SATIPOLY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 144.5, 145.65, 144.0, 145.5, 147.9, -2.4, -1.62, 20800, 0.3, 237.85, 124.0, 3.93, -28.61
FROM km_equity_symbols WHERE symbol = 'SATKARTAR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 52.6, 52.6, 51.0, 51.5, 52.95, -1.45, -2.74, 9600, 0.05, 118.9, 47.2, -7.21, NULL
FROM km_equity_symbols WHERE symbol = 'SATTVAENGG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 149.0, 149.0, NULL, NULL, NULL, NULL, 191.0, 121.0, -2.93, NULL
FROM km_equity_symbols WHERE symbol = 'SAVY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 307.0, 310.0, 306.05, 306.1, 305.8, 0.3, 0.1, 17400, 0.54, 326.1, 208.0, -3.18, NULL
FROM km_equity_symbols WHERE symbol = 'SAWALIYA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 96.01, 99.0, 95.33, 96.96, 98.09, -1.13, -1.15, 999527, 9.64, 123.0, 79.66, -4.89, 14.18
FROM km_equity_symbols WHERE symbol = 'SBFC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 772.8, 772.8, 755.55, 760.8, 772.8, -12.0, -1.55, 515475, 39.23, 1027.25, 725.15, -11.31, -11.52
FROM km_equity_symbols WHERE symbol = 'SBICARD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2039.0, 2043.9, 2005.2, 2039.0, 2022.1, 16.9, 0.84, 1240712, 251.87, 2109.6, 1379.85, -2.08, 38.66
FROM km_equity_symbols WHERE symbol = 'SBILIFE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1189.0, 1201.0, 1184.5, 1196.3, 1192.4, 3.9, 0.33, 18141390, 2167.3, 1203.7, 680.0, 16.32, 64.41
FROM km_equity_symbols WHERE symbol = 'SBIN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3806.0, 3806.6, 3700.5, 3790.0, 3806.0, -16.0, -0.42, 60376, 22.72, 4392.0, 2823.0, 0.01, 25.45
FROM km_equity_symbols WHERE symbol = 'SCHAEFFLER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 798.0, 832.0, 782.0, 811.5, 788.95, 22.55, 2.86, 1741823, 141.22, 1052.0, 540.0, 29.01, 22.12
FROM km_equity_symbols WHERE symbol = 'SCHNEIDER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 272.98, 275.2, 263.0, 263.9, 273.62, -9.72, -3.55, 8470625, 228.66, 280.5, 138.26, 24.51, 61.74
FROM km_equity_symbols WHERE symbol = 'SCI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 126.5, 131.5, 126.5, 127.6, 127.5, 0.1, 0.08, 40000, 0.51, 159.5, 68.05, -6.86, 20.38
FROM km_equity_symbols WHERE symbol = 'SCML'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 140.96, 140.96, 135.2, 135.25, 141.09, -5.84, -4.14, 43509, 0.6, 230.85, 113.53, -12.15, NULL
FROM km_equity_symbols WHERE symbol = 'SCODATUBES'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 88.0, 88.0, NULL, NULL, NULL, NULL, 147.0, 73.0, 7.98, -36.23
FROM km_equity_symbols WHERE symbol = 'SDREAMS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 207.9, 207.9, 187.6, 187.6, 208.0, -20.4, -9.81, 2200, 0.04, 410.0, 181.1, -12.73, -49.78
FROM km_equity_symbols WHERE symbol = 'SEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 69.0, 69.0, 69.0, 69.0, 69.0, NULL, NULL, 1600, 0.01, 139.65, 66.65, -5.09, NULL
FROM km_equity_symbols WHERE symbol = 'SELLOWRAP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 375.0, 375.0, 345.5, 348.0, 373.5, -25.5, -6.83, 5995741, 216.81, 458.2, 227.4, 3.37, -22.15
FROM km_equity_symbols WHERE symbol = 'SENCO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 57.6, 57.6, NULL, NULL, NULL, NULL, 70.0, 39.2, 25.22, -11.66
FROM km_equity_symbols WHERE symbol = 'SERVICE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 133.0, 134.19, 129.51, 129.7, 133.2, -3.5, -2.63, 185070, 2.43, 203.95, 110.17, -6.28, -14.38
FROM km_equity_symbols WHERE symbol = 'SETL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 586.5, 596.4, 580.0, 580.05, 591.2, -11.15, -1.89, 61262, 3.6, 816.6, 497.95, 1.83, -26.29
FROM km_equity_symbols WHERE symbol = 'SFL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 28.5, 28.5, 26.4, 26.55, 28.7, -2.15, -7.49, 9600, 0.03, 44.25, 26.0, -5.52, -35.4
FROM km_equity_symbols WHERE symbol = 'SFML'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 124.0, 127.75, 121.86, 124.35, 124.28, 0.07, 0.06, 8281576, 104.08, 127.75, 98.55, NULL, NULL
FROM km_equity_symbols WHERE symbol = 'SHADOWFAX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2100.0, 2107.0, 1931.0, 2006.0, 2163.8, -157.8, -7.29, 608463, 121.71, 2799.9, 1308.65, -7.6, 27.75
FROM km_equity_symbols WHERE symbol = 'SHAILY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 650.0, 664.25, 636.95, 641.8, 655.45, -13.65, -2.08, 944093, 61.33, 1049.0, 548.45, -10.97, -27.68
FROM km_equity_symbols WHERE symbol = 'SHAKTIPUMP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 217.0, 223.61, 213.8, 217.0, 217.93, -0.93, -0.43, 1053076, 23.09, 274.1, 184.1, 3.24, NULL
FROM km_equity_symbols WHERE symbol = 'SHANTIGOLD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1230.0, 1297.0, 1204.0, 1240.1, 1252.6, -12.5, -1.0, 638702, 80.21, 1297.0, 452.25, 52.91, 114.75
FROM km_equity_symbols WHERE symbol = 'SHARDACROP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 949.7, 959.0, 929.75, 931.3, 952.2, -20.9, -2.19, 33337, 3.15, 1248.0, 625.0, 7.12, 11.55
FROM km_equity_symbols WHERE symbol = 'SHARDAMOTR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 150.0, 156.47, 148.53, 148.58, 151.57, -2.99, -1.97, 1507112, 22.85, 220.4, 127.5, -0.58, -29.04
FROM km_equity_symbols WHERE symbol = 'SHAREINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 67.0, 71.8, 67.0, 71.8, 71.8, NULL, NULL, 4000, 0.03, 95.55, 62.0, 3.5, NULL
FROM km_equity_symbols WHERE symbol = 'SHEEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 225.25, 228.95, 225.25, 228.95, 218.05, 10.9, 5.0, 8000, 0.18, 228.95, 71.5, 5.31, 208.56
FROM km_equity_symbols WHERE symbol = 'SHEETAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 110.01, 110.2, 105.0, 108.27, 110.72, -2.45, -2.21, 9515, 0.1, 161.0, 88.8, 5.6, -18.22
FROM km_equity_symbols WHERE symbol = 'SHEMAROO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 121.5, 121.5, 117.0, 120.95, 124.0, -3.05, -2.46, 34000, 0.4, 172.9, 111.5, -6.6, -27.1
FROM km_equity_symbols WHERE symbol = 'SHERA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 116.0, 118.0, 113.5, 113.5, 116.15, -2.65, -2.28, 23000, 0.27, 123.65, 95.5, -3.5, NULL
FROM km_equity_symbols WHERE symbol = 'SHETHJI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 73.5, 73.5, NULL, NULL, NULL, NULL, 95.0, 41.2, 38.29, -15.32
FROM km_equity_symbols WHERE symbol = 'SHIGAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 320.8, 336.25, 316.0, 326.05, 323.15, 2.9, 0.9, 463824, 15.25, 500.0, 259.5, 10.56, -4.1
FROM km_equity_symbols WHERE symbol = 'SHILPAMED'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 138.5, 138.5, 130.0, 132.3, 138.05, -5.75, -4.17, 35000, 0.46, 148.5, 109.0, 5.08, NULL
FROM km_equity_symbols WHERE symbol = 'SHIVASHRIT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 49.0, 49.0, NULL, NULL, NULL, NULL, 84.0, 43.0, -11.55, NULL
FROM km_equity_symbols WHERE symbol = 'SHKSIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 26090.0, 26255.0, 25750.0, 26100.0, 26340.0, -240.0, -0.91, 27809, 72.43, 32490.0, 25360.0, -3.89, -7.53
FROM km_equity_symbols WHERE symbol = 'SHREECEM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 404.3, 408.85, 392.6, 398.45, 400.0, -1.55, -0.39, 1991605, 79.84, 408.85, 222.0, 8.66, NULL
FROM km_equity_symbols WHERE symbol = 'SHREEJISPG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 450.0, 450.0, 440.0, 440.0, 449.5, -9.5, -2.11, 900, 0.04, 750.0, 396.0, NULL, -38.46
FROM km_equity_symbols WHERE symbol = 'SHREEKARNI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 81.0, 81.0, 81.0, 81.0, 81.0, NULL, NULL, 2000, 0.02, 145.35, 69.2, -4.71, -24.37
FROM km_equity_symbols WHERE symbol = 'SHREEOSFM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 265.0, 265.0, 262.0, 262.0, 266.2, -4.2, -1.58, 2400, 0.06, 283.0, 126.5, 9.65, NULL
FROM km_equity_symbols WHERE symbol = 'SHRIAHIMSA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 239.5, 241.25, 234.31, 235.62, 240.04, -4.42, -1.84, 1150176, 27.38, 250.7, 177.51, 5.39, NULL
FROM km_equity_symbols WHERE symbol = 'SHRINGARMS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3145.0, 3145.0, 3062.0, 3063.0, 3156.0, -93.0, -2.95, 42512, 13.14, 3407.2, 1662.55, 0.56, 52.91
FROM km_equity_symbols WHERE symbol = 'SHRIPISTON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1081.8, 1086.0, 1060.0, 1063.9, 1082.8, -18.9, -1.75, 4555743, 486.95, 1087.1, 525.1, 8.67, 93.91
FROM km_equity_symbols WHERE symbol = 'SHRIRAMFIN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 64.55, 64.55, NULL, NULL, NULL, NULL, 95.5, 51.35, 14.65, -7.19
FROM km_equity_symbols WHERE symbol = 'SHRITECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 31.0, 31.0, 31.0, 31.0, 31.0, NULL, NULL, 2000, 0.01, 40.0, 13.35, -3.58, 5.44
FROM km_equity_symbols WHERE symbol = 'SHUBHLAXMI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 346.05, 346.05, 340.0, 340.0, 346.05, -6.05, -1.75, 1200, 0.04, 494.95, 268.7, -4.49, 3.08
FROM km_equity_symbols WHERE symbol = 'SHUBHSHREE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 894.0, 896.0, 875.5, 876.0, 896.15, -20.15, -2.25, 132098, 11.67, 1001.0, 673.5, 7.76, 18.41
FROM km_equity_symbols WHERE symbol = 'SHYAMMETL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 30.65, 30.65, 29.95, 30.0, 30.05, -0.05, -0.17, 19200, 0.06, 86.4, 27.15, 0.84, NULL
FROM km_equity_symbols WHERE symbol = 'SIDDHICOTS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 196.7, 196.7, 196.7, 196.7, 196.7, NULL, NULL, 1000, 0.02, 243.0, 154.05, -1.16, 19.21
FROM km_equity_symbols WHERE symbol = 'SIDDHIKA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3131.0, 3184.5, 3083.1, 3113.0, 3148.5, -35.5, -1.13, 411114, 128.66, 5520.0, 2450.0, 5.61, -39.02
FROM km_equity_symbols WHERE symbol = 'SIEMENS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 981.9, 1052.6, 981.9, 1041.0, 982.9, 58.1, 5.91, 1715847, 177.08, 1309.5, 775.2, 9.86, -14.85
FROM km_equity_symbols WHERE symbol = 'SIGNATURE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 81.45, 81.45, 81.45, 81.45, 85.7, -4.25, -4.96, 1000, 0.01, 135.6, 60.0, -6.91, -14.26
FROM km_equity_symbols WHERE symbol = 'SIGNORIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 247.99, 247.99, 237.36, 240.1, 246.91, -6.81, -2.76, 38114, 0.92, 314.9, 180.37, 20.91, -15.08
FROM km_equity_symbols WHERE symbol = 'SIGNPOST'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 119.95, 119.95, 114.55, 115.0, 120.55, -5.55, -4.6, 24000, 0.28, 126.0, 50.65, 16.84, 83.32
FROM km_equity_symbols WHERE symbol = 'SILKFLEX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 140.0, 140.0, 140.0, 140.0, 140.0, NULL, NULL, 800, 0.01, 171.0, 103.0, 0.72, NULL
FROM km_equity_symbols WHERE symbol = 'SILKY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 20.01, 20.01, 19.05, 19.45, 19.92, -0.47, -2.36, 13481, 0.03, 28.45, 13.45, -4.84, -5.12
FROM km_equity_symbols WHERE symbol = 'SILLYMONKS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 351.2, 355.0, 342.55, 345.2, 358.4, -13.2, -3.68, 25500, 0.89, 585.0, 300.0, 7.01, -37.42
FROM km_equity_symbols WHERE symbol = 'SJLOGISTIC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 78.0, 78.08, 76.1, 76.8, 78.98, -2.18, -2.76, 6444203, 49.49, 107.5, 68.13, -3.3, -17.04
FROM km_equity_symbols WHERE symbol = 'SJVN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 375.2, 378.8, 371.6, 373.1, 381.15, -8.05, -2.11, 178409, 6.69, 588.0, 327.1, -6.41, -14.77
FROM km_equity_symbols WHERE symbol = 'SKIPPER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 156.5, 162.0, 156.5, 162.0, 160.95, 1.05, 0.65, 8000, 0.13, 263.0, 150.0, -5.57, -27.89
FROM km_equity_symbols WHERE symbol = 'SKP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 368.0, 381.0, 361.25, 368.8, 368.2, 0.6, 0.16, 4118048, 153.99, 400.95, 246.05, 11.74, -2.06
FROM km_equity_symbols WHERE symbol = 'SKYGOLD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 170.4, 185.6, 170.3, 185.0, 179.25, 5.75, 3.21, 12800, 0.22, 371.45, 170.3, -21.01, -33.19
FROM km_equity_symbols WHERE symbol = 'SLONE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 59.25, 60.3, 59.25, 60.3, 61.8, -1.5, -2.43, 3600, 0.02, 157.95, 55.5, -13.24, NULL
FROM km_equity_symbols WHERE symbol = 'SMARTEN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 461.8, 468.0, 448.0, 453.5, 462.35, -8.85, -1.91, 42662, 1.95, 619.0, 392.7, -4.59, NULL
FROM km_equity_symbols WHERE symbol = 'SMARTWORKS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 8.05, 8.05, NULL, NULL, NULL, NULL, 21.7, 5.6, -5.29, -40.37
FROM km_equity_symbols WHERE symbol = 'SMVD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 49.0, 49.0, 49.0, 49.0, 47.05, 1.95, 4.14, 2000, 0.01, 122.0, 39.35, 2.4, NULL
FROM km_equity_symbols WHERE symbol = 'SNEHAA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1530.8, 1535.0, 1497.2, 1505.7, 1530.8, -25.1, -1.64, 81768, 12.4, 1732.5, 1075.3, -1.77, 30.57
FROM km_equity_symbols WHERE symbol = 'SOBHA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 13250.0, 13300.0, 12935.0, 12965.0, 13391.0, -426.0, -3.18, 90669, 118.86, 17820.0, 8482.5, 2.12, 47.21
FROM km_equity_symbols WHERE symbol = 'SOLARINDS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 213.9, 217.88, 201.56, 204.0, 214.81, -10.81, -5.03, 754816, 15.75, 388.5, 201.56, -26.07, NULL
FROM km_equity_symbols WHERE symbol = 'SOLARWORLD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 526.05, 531.85, 520.1, 527.6, 532.8, -5.2, -0.98, 1082968, 57.03, 559.5, 380.0, 15.44, 2.16
FROM km_equity_symbols WHERE symbol = 'SONACOMS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 40.0, 40.5, 39.0, 40.5, 39.0, 1.5, 3.85, 3000, 0.01, 108.9, 36.2, 1.38, -60.26
FROM km_equity_symbols WHERE symbol = 'SONAMAC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 279.0, 286.8, 275.0, 280.2, 288.65, -7.2, -2.51, 1956919, 54.78, 464.2, 275.0, -20.3, -34.89
FROM km_equity_symbols WHERE symbol = 'SONATSOFTW'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 71.0, 71.0, 70.15, 70.95, 73.75, -2.8, -3.8, 4500, 0.03, 145.0, 68.6, -4.25, -40.5
FROM km_equity_symbols WHERE symbol = 'SONUINFRA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 125.0, 125.0, NULL, NULL, NULL, NULL, 152.35, 88.05, 23.4, 19.33
FROM km_equity_symbols WHERE symbol = 'SOTAC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 39.89, 41.18, 39.7, 41.1, 40.15, 0.95, 2.37, 13758973, 56.03, 46.84, 22.3, 1.56, 64.86
FROM km_equity_symbols WHERE symbol = 'SOUTHBANK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 133.7, 133.99, 131.2, 132.0, 135.2, -3.2, -2.37, 400396, 5.3, 204.4, 109.3, -2.83, -8.61
FROM km_equity_symbols WHERE symbol = 'SPARC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 92.0, 92.0, 88.05, 92.0, 92.9, -0.9, -0.97, 49200, 0.45, 193.75, 71.0, -4.03, -50.59
FROM km_equity_symbols WHERE symbol = 'SPCL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 80.15, 80.15, 78.3, 78.3, 87.0, -8.7, -10.0, 13600, 0.11, 172.8, 69.3, 5.17, -50.43
FROM km_equity_symbols WHERE symbol = 'SPECTSTM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 16.5, 16.5, NULL, NULL, NULL, NULL, 27.3, 13.25, 3.45, -38.43
FROM km_equity_symbols WHERE symbol = 'SPPPOLY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 118.7, 118.7, 118.7, 118.7, 124.9, -6.2, -4.96, 800, 0.01, 199.4, 104.55, -17.17, -13.23
FROM km_equity_symbols WHERE symbol = 'SPRL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 122.25, 122.25, NULL, NULL, NULL, NULL, 173.55, 105.55, -1.41, NULL
FROM km_equity_symbols WHERE symbol = 'SPUNWEB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2815.0, 2841.0, 2765.6, 2833.0, 2841.5, -8.5, -0.3, 196550, 55.46, 3325.0, 2570.2, -6.8, -0.3
FROM km_equity_symbols WHERE symbol = 'SRF'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 45.5, 51.0, 45.5, 51.0, 51.0, NULL, NULL, 19000, 0.09, 82.9, 39.0, 5.94, -35.39
FROM km_equity_symbols WHERE symbol = 'SRIVASAVI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 371.05, 393.5, 356.2, 372.95, 381.65, -8.7, -2.28, 64400, 2.39, 580.0, 345.05, -6.43, -17.34
FROM km_equity_symbols WHERE symbol = 'SSEGL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 117.0, 148.65, 110.15, 140.4, 123.9, 16.5, 13.32, 304500, 4.13, 216.0, 86.0, 16.2, -15.03
FROM km_equity_symbols WHERE symbol = 'SSFL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 170.99, 172.7, 165.16, 165.16, 173.85, -8.69, -5.0, 496218, 8.36, 359.15, 50.85, -5.3, 112.92
FROM km_equity_symbols WHERE symbol = 'STALLION'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 867.0, 871.05, 846.7, 859.6, 865.75, -6.15, -0.71, 180227, 15.47, 1025.0, 513.05, -7.22, 26.47
FROM km_equity_symbols WHERE symbol = 'STAR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 217.1, 217.91, 214.75, 216.0, 218.94, -2.94, -1.34, 214480, 4.64, 308.95, 197.09, 0.78, 5.94
FROM km_equity_symbols WHERE symbol = 'STARCEMENT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 477.7, 482.0, 466.15, 470.0, 480.6, -10.6, -2.21, 234045, 11.07, 534.0, 327.3, 4.63, 18.34
FROM km_equity_symbols WHERE symbol = 'STARHEALTH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 151.0, 159.0, 147.2, 154.0, 154.53, -0.53, -0.34, 11968272, 183.9, 163.4, 58.86, 65.75, 49.95
FROM km_equity_symbols WHERE symbol = 'STLTECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 513.5, 515.2, 491.0, 491.05, 520.25, -29.2, -5.61, 27228, 1.37, 600.0, 475.0, -7.86, NULL
FROM km_equity_symbols WHERE symbol = 'STUDDS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 10.4, 10.55, 10.25, 10.55, 10.45, 0.1, 0.96, 34000, 0.04, 43.2, 10.15, -14.92, NULL
FROM km_equity_symbols WHERE symbol = 'STUDIOLSD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 263.1, 265.89, 255.32, 262.0, 265.9, -3.9, -1.47, 89016, 2.31, 437.45, 231.05, -5.11, NULL
FROM km_equity_symbols WHERE symbol = 'STYL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1979.2, 1979.2, 1945.6, 1955.1, 1982.2, -27.1, -1.37, 18407, 3.61, 3498.0, 1839.1, 1.43, -22.59
FROM km_equity_symbols WHERE symbol = 'STYRENIX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 128.65, 137.0, 128.65, 137.0, 134.7, 2.3, 1.71, 21600, 0.29, 200.0, 104.0, 8.25, NULL
FROM km_equity_symbols WHERE symbol = 'SUBAHOTELS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 815.0, 816.0, 798.0, 798.0, 821.7, -23.7, -2.88, 46565, 3.76, 1213.7, 518.0, -3.86, 33.42
FROM km_equity_symbols WHERE symbol = 'SUBROS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 878.0, 939.9, 841.35, 925.0, 938.65, -13.65, -1.45, 357480, 32.24, 1603.0, 796.15, 1.25, -2.56
FROM km_equity_symbols WHERE symbol = 'SUDARSCHEM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 664.95, 674.5, 653.1, 670.5, 672.2, -1.7, -0.25, 47925, 3.19, 795.0, 524.05, 7.9, NULL
FROM km_equity_symbols WHERE symbol = 'SUDEEPPHRM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 413.8, 413.8, 404.0, 406.5, 413.8, -7.3, -1.76, 289091, 11.77, 665.0, 396.2, -8.01, -15.96
FROM km_equity_symbols WHERE symbol = 'SUMICHEM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 5470.0, 5478.5, 5260.5, 5290.0, 5483.5, -193.5, -3.53, 59912, 31.81, 5555.0, 4200.0, 2.44, 17.6
FROM km_equity_symbols WHERE symbol = 'SUNDARMFIN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 940.1, 940.1, 916.2, 925.75, 940.15, -14.4, -1.53, 34128, 3.15, 1080.0, 831.15, -0.27, -5.7
FROM km_equity_symbols WHERE symbol = 'SUNDRMFAST'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 251.0, 252.59, 243.1, 245.75, 253.86, -8.11, -3.19, 103661, 2.55, 322.0, 196.37, -4.36, 7.46
FROM km_equity_symbols WHERE symbol = 'SUNFLAG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 355.0, 365.95, 346.0, 354.55, 362.35, -7.8, -2.15, 9000, 0.32, 415.5, 91.0, -9.48, 190.67
FROM km_equity_symbols WHERE symbol = 'SUNLITE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1714.9, 1719.0, 1694.6, 1699.1, 1714.9, -15.8, -0.92, 1148165, 195.73, 1851.2, 1548.0, -1.71, -2.71
FROM km_equity_symbols WHERE symbol = 'SUNPHARMA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 36.8, 36.8, NULL, NULL, NULL, NULL, 64.0, 29.55, 12.88, -42.5
FROM km_equity_symbols WHERE symbol = 'SUNREST'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 40.3, 41.6, 40.3, 41.6, 40.05, 1.55, 3.87, 19200, 0.08, 110.0, 32.2, 4.15, NULL
FROM km_equity_symbols WHERE symbol = 'SUNTECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 401.85, 403.85, 394.2, 397.25, 408.25, -11.0, -2.69, 69572, 2.78, 478.75, 347.0, -5.53, -9.98
FROM km_equity_symbols WHERE symbol = 'SUNTECK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 592.6, 598.9, 572.65, 572.65, 601.9, -29.25, -4.86, 184928, 10.78, 691.4, 480.2, 2.81, -4.22
FROM km_equity_symbols WHERE symbol = 'SUNTV'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3827.9, 3831.7, 3745.3, 3760.0, 3844.2, -84.2, -2.19, 82044, 31.06, 4739.0, 3095.0, 8.52, -3.04
FROM km_equity_symbols WHERE symbol = 'SUPREMEIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 148.95, 149.5, 144.0, 144.5, 149.9, -5.4, -3.6, 64000, 0.94, 240.05, 100.0, -15.87, 7.36
FROM km_equity_symbols WHERE symbol = 'SUPREMEPWR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 677.35, 701.0, 677.35, 680.9, 688.7, -7.8, -1.13, 114398, 7.87, 842.0, 556.15, -7.81, -1.37
FROM km_equity_symbols WHERE symbol = 'SUPRIYA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 56.1, 56.1, 56.0, 56.0, 56.0, NULL, NULL, 800, NULL, 165.0, 47.5, 2.0, -64.81
FROM km_equity_symbols WHERE symbol = 'SURANI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 226.85, 231.36, 220.66, 227.98, 227.4, 0.58, 0.26, 378663, 8.56, 359.0, 212.55, -14.15, -5.42
FROM km_equity_symbols WHERE symbol = 'SURYAROSNI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 46.6, 46.74, 45.55, 45.7, 46.81, -1.11, -2.37, 52618195, 242.1, 74.3, 44.88, -6.14, -14.34
FROM km_equity_symbols WHERE symbol = 'SUZLON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 413.9, 415.5, 407.25, 408.0, 416.95, -8.95, -2.15, 346560, 14.21, 526.7, 362.2, -3.13, -15.45
FROM km_equity_symbols WHERE symbol = 'SWANCORP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 275.25, 280.0, 274.0, 277.9, 278.3, -0.4, -0.14, 11000, 0.3, 287.45, 138.5, 16.32, 56.96
FROM km_equity_symbols WHERE symbol = 'SWARAJ'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 19.1, 19.95, 19.1, 19.95, 20.0, -0.05, -0.25, 4800, 0.01, 51.2, 18.45, -17.26, -56.17
FROM km_equity_symbols WHERE symbol = 'SWASTIK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 337.0, 341.65, 329.35, 335.3, 337.35, -2.05, -0.61, 10114145, 339.35, 474.0, 297.0, -4.3, -8.26
FROM km_equity_symbols WHERE symbol = 'SWIGGY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 198.8, 201.32, 194.43, 195.8, 199.66, -3.86, -1.93, 1031853, 20.32, 348.9, 176.6, -3.37, -28.84
FROM km_equity_symbols WHERE symbol = 'SWSOLAR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 50.4, 50.4, NULL, NULL, NULL, NULL, 95.0, 45.0, -11.58, -31.89
FROM km_equity_symbols WHERE symbol = 'SYLVANPLY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 931.0, 931.0, 870.0, 877.0, 934.35, -57.35, -6.14, 218541, 19.4, 1347.9, 815.0, -3.11, -21.79
FROM km_equity_symbols WHERE symbol = 'SYMPHONY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 443.55, 443.55, 426.5, 435.0, 446.35, -11.35, -2.54, 1227781, 52.98, 760.0, 426.5, -30.96, -38.06
FROM km_equity_symbols WHERE symbol = 'SYNGENE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 63.9, 63.9, NULL, NULL, NULL, NULL, 117.95, 45.9, 16.18, -45.36
FROM km_equity_symbols WHERE symbol = 'SYNOPTICS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 865.0, 882.9, 852.15, 870.0, 874.2, -4.2, -0.48, 860010, 74.59, 909.9, 370.0, 23.37, 86.4
FROM km_equity_symbols WHERE symbol = 'SYRMA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 266.0, 266.0, 256.5, 260.5, 270.0, -9.5, -3.52, 45600, 1.18, 411.0, 192.25, -13.41, 16.19
FROM km_equity_symbols WHERE symbol = 'SYSTANGO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 592.1, 608.85, 580.0, 594.0, 605.7, -11.7, -1.93, 71000, 4.17, 899.65, 409.5, -19.07, -51.14
FROM km_equity_symbols WHERE symbol = 'TAC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 693.15, 693.15, 693.15, 693.15, 679.6, 13.55, 1.99, 4500, 0.31, 817.6, 152.55, NULL, NULL
FROM km_equity_symbols WHERE symbol = 'TANKUP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 471.7, 474.95, 464.1, 465.0, 480.6, -15.6, -3.25, 258944, 12.15, 766.0, 409.35, -6.64, -12.48
FROM km_equity_symbols WHERE symbol = 'TANLA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 61.15, 61.15, 61.15, 61.15, 61.15, NULL, NULL, 750, NULL, 104.8, 58.25, -1.37, -37.89
FROM km_equity_symbols WHERE symbol = 'TAPIFRUIT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 161.5, 162.67, 151.0, 152.4, 161.53, -9.13, -5.65, 715703, 11.11, 206.1, 103.22, -12.9, 16.03
FROM km_equity_symbols WHERE symbol = 'TARC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 277.0, 277.44, 270.1, 270.5, 280.71, -10.21, -3.64, 2179375, 59.59, 594.0, 224.05, -0.29, -36.2
FROM km_equity_symbols WHERE symbol = 'TARIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 355.9, 357.0, 350.1, 352.5, 356.9, -4.4, -1.23, 1402451, 49.62, 367.3, 315.1, 1.1, NULL
FROM km_equity_symbols WHERE symbol = 'TATACAP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 698.5, 700.0, 687.85, 696.35, 698.7, -2.35, -0.34, 253439, 17.56, 1026.65, 687.85, -8.71, -19.8
FROM km_equity_symbols WHERE symbol = 'TATACHEM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1680.0, 1691.6, 1641.3, 1655.0, 1705.3, -50.3, -2.95, 141869, 23.68, 2004.0, 1291.0, -4.81, 8.65
FROM km_equity_symbols WHERE symbol = 'TATACOMM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1148.9, 1154.0, 1125.4, 1130.3, 1149.3, -19.0, -1.65, 525887, 59.82, 1220.9, 930.1, -4.97, 10.51
FROM km_equity_symbols WHERE symbol = 'TATACONSUM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 4850.0, 4891.5, 4755.0, 4814.5, 4976.0, -161.5, -3.25, 441804, 212.81, 6735.0, 4700.0, -16.89, -21.52
FROM km_equity_symbols WHERE symbol = 'TATAELXSI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 644.85, 644.85, 625.0, 632.1, 647.75, -15.65, -2.42, 298676, 18.85, 1184.7, 514.52, -5.53, 18.42
FROM km_equity_symbols WHERE symbol = 'TATAINVEST'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 377.0, 377.8, 370.65, 374.35, 380.55, -6.2, -1.63, 4441440, 165.99, 416.8, 326.35, 1.6, 7.62
FROM km_equity_symbols WHERE symbol = 'TATAPOWER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 206.59, 206.85, 202.56, 202.98, 208.11, -5.13, -2.47, 25870923, 529.19, 211.1, 125.3, 11.18, 48.98
FROM km_equity_symbols WHERE symbol = 'TATASTEEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 603.5, 607.05, 575.3, 594.05, 614.75, -20.7, -3.37, 2899790, 171.39, 797.0, 575.3, -10.03, -19.49
FROM km_equity_symbols WHERE symbol = 'TATATECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 229.0, 231.95, 228.0, 231.95, 227.2, 4.75, 2.09, 11200, 0.26, 425.0, 193.9, -5.02, NULL
FROM km_equity_symbols WHERE symbol = 'TAURIAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 69.25, 73.95, 69.25, 73.95, 71.4, 2.55, 3.57, 12000, 0.09, 159.0, 66.3, -11.96, -49.33
FROM km_equity_symbols WHERE symbol = 'TBI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1472.0, 1548.0, 1390.3, 1483.0, 1472.0, 11.0, 0.75, 191886, 28.2, 1764.8, 996.0, -3.48, -7.64
FROM km_equity_symbols WHERE symbol = 'TBOTEK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 93.0, 93.5, 91.05, 93.0, 93.0, NULL, NULL, 46400, 0.43, 137.0, 77.15, 4.2, -19.31
FROM km_equity_symbols WHERE symbol = 'TCL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2585.0, 2713.0, 2585.0, 2695.0, 2750.1, -55.1, -2.0, 11168735, 2959.06, 4021.75, 2585.0, -17.53, -31.08
FROM km_equity_symbols WHERE symbol = 'TCS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 829.1, 851.8, 826.5, 833.15, 846.5, -13.35, -1.58, 412980, 34.68, 888.8, 293.0, 21.22, 141.53
FROM km_equity_symbols WHERE symbol = 'TDPOWERSYS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1392.6, 1392.6, 1350.0, 1353.0, 1392.6, -39.6, -2.84, 16885, 2.31, 2198.2, 1350.0, -8.84, -35.8
FROM km_equity_symbols WHERE symbol = 'TEAMLEASE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 509.0, 509.0, 483.0, 485.0, 510.35, -25.35, -4.97, 90000, 4.42, 843.6, 366.7, -19.92, NULL
FROM km_equity_symbols WHERE symbol = 'TECHD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 232.95, 232.95, 218.0, 220.1, 223.35, -3.25, -1.46, 28000, 0.63, 325.7, 115.6, 15.36, 22.9
FROM km_equity_symbols WHERE symbol = 'TECHERA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 184.15, 184.8, 179.1, 179.1, 188.5, -9.4, -4.99, 56000, 1.01, 1115.0, 179.1, -38.27, -83.33
FROM km_equity_symbols WHERE symbol = 'TECHLABS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1482.6, 1548.0, 1464.4, 1534.0, 1536.6, -2.6, -0.17, 7058376, 1069.54, 1854.0, 1209.4, -5.0, -8.43
FROM km_equity_symbols WHERE symbol = 'TECHM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1070.0, 1070.0, 1027.65, 1046.85, 1081.65, -34.8, -3.22, 197387, 20.61, 1654.0, 785.15, 5.85, 8.11
FROM km_equity_symbols WHERE symbol = 'TECHNOE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1681.0, 1711.1, 1625.0, 1655.0, 1768.8, -113.8, -6.43, 239896, 39.88, 2125.0, 1200.05, -11.88, 17.09
FROM km_equity_symbols WHERE symbol = 'TEGA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 297.0, 297.0, NULL, NULL, NULL, NULL, 363.6, 141.05, 2.4, NULL
FROM km_equity_symbols WHERE symbol = 'TEJASCARGO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 331.9, 331.9, 323.5, 328.7, 333.05, -4.35, -1.31, 790610, 25.88, 914.4, 294.0, -12.46, -60.29
FROM km_equity_symbols WHERE symbol = 'TEJASNET'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 575.0, 576.45, 551.3, 555.0, 576.15, -21.15, -3.67, 400493, 22.72, 589.8, 438.05, 3.79, NULL
FROM km_equity_symbols WHERE symbol = 'TENNIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 115.2, 115.83, 113.0, 113.62, 116.46, -2.84, -2.44, 1170309, 13.32, 189.0, 113.0, -8.79, -23.54
FROM km_equity_symbols WHERE symbol = 'TEXRAIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 48.0, 48.2, 44.85, 47.25, 47.2, 0.05, 0.11, 25600, 0.12, 400.0, 38.5, -42.57, -88.04
FROM km_equity_symbols WHERE symbol = 'TGL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3622.0, 3642.8, 3531.9, 3575.0, 3651.6, -76.6, -2.1, 33895, 12.15, 4149.0, 1523.1, -4.58, 95.77
FROM km_equity_symbols WHERE symbol = 'THANGAMAYL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 440.2, 452.0, 436.1, 445.05, 447.3, -2.25, -0.5, 231036, 10.27, 474.4, 382.5, 1.24, NULL
FROM km_equity_symbols WHERE symbol = 'THELEELA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2829.5, 2895.0, 2749.8, 2880.0, 2831.6, 48.4, 1.71, 302282, 84.97, 4091.8, 2742.7, -2.84, -9.36
FROM km_equity_symbols WHERE symbol = 'THERMAX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 18.55, 18.55, 18.55, 18.55, 18.55, NULL, NULL, 3000, 0.01, 43.5, 18.55, -31.3, -62.6
FROM km_equity_symbols WHERE symbol = 'THESL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 112.85, 114.01, 110.66, 113.0, 112.88, 0.12, 0.11, 467832, 5.26, 188.29, 109.15, -18.39, -16.24
FROM km_equity_symbols WHERE symbol = 'THOMASCOOK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 401.05, 406.8, 394.3, 400.4, 401.9, -1.5, -0.37, 220651, 8.87, 536.67, 219.33, -14.56, 64.62
FROM km_equity_symbols WHERE symbol = 'THYROCARE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 448.0, 452.0, 440.5, 451.2, 450.15, 1.05, 0.23, 261780, 11.72, 549.7, 199.53, 5.13, 74.44
FROM km_equity_symbols WHERE symbol = 'TI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2490.0, 2517.9, 2452.4, 2472.5, 2511.4, -38.9, -1.55, 315365, 78.61, 3419.9, 2164.9, 3.57, -8.87
FROM km_equity_symbols WHERE symbol = 'TIINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 47.45, 47.45, NULL, NULL, NULL, NULL, 69.65, 38.4, 4.29, -19.44
FROM km_equity_symbols WHERE symbol = 'TIMESCAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 198.95, 207.4, 198.0, 200.23, 197.89, 2.34, 1.18, 4041145, 81.53, 249.15, 153.3, 11.06, 5.34
FROM km_equity_symbols WHERE symbol = 'TIMETECHNO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3081.0, 3120.0, 3044.8, 3120.0, 3120.8, -0.8, -0.03, 12452, 3.84, 3575.0, 2202.0, 2.63, 17.3
FROM km_equity_symbols WHERE symbol = 'TIMKEN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 386.5, 386.5, 378.0, 386.0, 384.5, 1.5, 0.39, 416, 0.02, 666.0, 330.8, -5.11, -26.52
FROM km_equity_symbols WHERE symbol = 'TIPSFILMS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 564.0, 581.45, 553.3, 577.1, 565.65, 11.45, 2.02, 185844, 10.67, 718.0, 483.0, 13.47, -15.01
FROM km_equity_symbols WHERE symbol = 'TIPSMUSIC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 580.15, 580.15, 580.15, 580.15, 581.0, -0.85, -0.15, 125, 0.01, 995.0, 452.95, -14.56, -40.07
FROM km_equity_symbols WHERE symbol = 'TIRUPATI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 777.0, 777.05, 761.0, 764.0, 777.6, -13.6, -1.75, 304091, 23.37, 974.35, 654.55, -3.54, -10.13
FROM km_equity_symbols WHERE symbol = 'TITAGARH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 4267.3, 4271.8, 4164.8, 4175.0, 4275.8, -100.8, -2.36, 524758, 221.23, 4378.4, 2925.0, -1.51, 29.2
FROM km_equity_symbols WHERE symbol = 'TITAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 379.0, 387.5, 374.4, 378.0, 383.45, -5.45, -1.42, 15565868, 593.03, 744.0, 335.6, 8.08, -44.72
FROM km_equity_symbols WHERE symbol = 'TMPV'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 4077.2, 4130.0, 4057.3, 4069.8, 4077.2, -7.4, -0.18, 518965, 212.56, 4130.0, 2886.45, 3.29, 32.38
FROM km_equity_symbols WHERE symbol = 'TORNTPHARM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1451.0, 1468.3, 1428.0, 1462.2, 1453.7, 8.5, 0.58, 621000, 90.5, 1640.0, 1188.0, 8.59, 16.45
FROM km_equity_symbols WHERE symbol = 'TORNTPOWER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 555.0, 567.85, 543.3, 554.0, 545.4, 8.6, 1.58, 1040196, 57.87, 855.8, 394.55, 14.17, -1.41
FROM km_equity_symbols WHERE symbol = 'TRANSRAILL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 144.25, 151.0, 143.65, 143.65, 146.8, -3.15, -2.15, 40000, 0.58, 169.0, 85.0, 1.65, 44.7
FROM km_equity_symbols WHERE symbol = 'TRANSTEEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 21.9, 21.9, NULL, NULL, NULL, NULL, 25.5, 12.7, -14.12, 7.88
FROM km_equity_symbols WHERE symbol = 'TRANSWIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1244.8, 1249.0, 1152.6, 1160.0, 1214.7, -54.7, -4.5, 144562, 17.49, 1445.0, 1008.5, 0.73, NULL
FROM km_equity_symbols WHERE symbol = 'TRAVELFOOD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 4247.1, 4299.0, 4195.1, 4249.0, 4285.6, -36.6, -0.85, 665095, 282.92, 6261.0, 3645.0, 8.34, -19.17
FROM km_equity_symbols WHERE symbol = 'TRENT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 26.5, 27.48, 26.06, 26.75, 26.72, 0.03, 0.11, 11730520, 31.33, 34.62, 23.11, 5.4, -6.17
FROM km_equity_symbols WHERE symbol = 'TRIDENT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 13.3, 13.35, 13.3, 13.35, 14.3, -0.95, -6.64, 12000, 0.02, 31.85, 12.75, 2.69, -57.62
FROM km_equity_symbols WHERE symbol = 'TRIDHYA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 483.5, 496.8, 478.5, 490.9, 488.9, 2.0, 0.41, 1826116, 89.55, 675.2, 454.1, -4.36, -13.31
FROM km_equity_symbols WHERE symbol = 'TRITURBINE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 384.1, 390.2, 380.3, 385.15, 386.35, -1.2, -0.31, 215319, 8.31, 468.1, 313.1, 12.31, 5.71
FROM km_equity_symbols WHERE symbol = 'TRIVENI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 75.05, 75.15, 71.8, 71.8, 75.05, -3.25, -4.33, 4200, 0.03, 208.0, 51.3, -0.49, -62.21
FROM km_equity_symbols WHERE symbol = 'TROM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 434.55, 435.2, 413.0, 419.95, 434.85, -14.9, -3.43, 160442, 6.83, 549.0, 310.2, 13.45, NULL
FROM km_equity_symbols WHERE symbol = 'TRUALT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 40.5, 42.0, 38.0, 38.6, 41.35, -2.75, -6.65, 58800, 0.23, 103.0, 38.0, -15.26, -58.89
FROM km_equity_symbols WHERE symbol = 'TRUST'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 34.8, 34.8, 34.75, 34.75, 34.2, 0.55, 1.61, 4000, 0.01, 79.3, 34.0, -26.61, NULL
FROM km_equity_symbols WHERE symbol = 'TSC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 444.35, 445.55, 428.85, 442.0, 443.65, -1.65, -0.37, 31671, 1.39, 701.5, 240.0, 3.73, 67.61
FROM km_equity_symbols WHERE symbol = 'TSFINV'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 44.48, 44.48, 43.3, 43.5, 44.7, -1.2, -2.68, 865854, 3.79, 81.12, 41.07, -6.85, -36.64
FROM km_equity_symbols WHERE symbol = 'TTML'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 29.0, 29.25, 28.75, 28.8, 29.05, -0.25, -0.86, 34000, 0.1, 49.8, 27.05, -9.72, -27.0
FROM km_equity_symbols WHERE symbol = 'TUNWAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3861.6, 3894.0, 3832.2, 3870.0, 3881.2, -11.2, -0.29, 260604, 100.75, 3909.0, 2192.75, 3.05, 56.34
FROM km_equity_symbols WHERE symbol = 'TVSMOTOR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 124.99, 137.0, 123.63, 131.02, 125.58, 5.44, 4.33, 20820788, 275.35, 156.25, 92.16, 20.12, -6.28
FROM km_equity_symbols WHERE symbol = 'TVSSCS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 125.03, 131.44, 123.76, 125.09, 127.03, -1.94, -1.53, 80264, 1.02, 184.8, 117.69, -9.26, -25.35
FROM km_equity_symbols WHERE symbol = 'TVTODAY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 6.1, 6.33, 6.1, 6.25, 6.1, 0.15, 2.46, 8319, 0.01, 12.4, 3.65, -5.3, 62.34
FROM km_equity_symbols WHERE symbol = 'TVVISION'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1615.7, 1649.0, 1569.3, 1625.0, 1621.2, 3.8, 0.23, 121184, 19.62, 2294.9, 1401.1, 5.95, -19.96
FROM km_equity_symbols WHERE symbol = 'UBL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 69.45, 70.0, 67.8, 69.9, 60.0, 9.9, 16.5, 10000, 0.07, 70.0, 38.0, 30.65, 16.4
FROM km_equity_symbols WHERE symbol = 'UCL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 28.55, 28.55, 28.06, 28.13, 28.7, -0.57, -1.99, 5766767, 16.28, 40.75, 26.81, -2.77, -30.02
FROM km_equity_symbols WHERE symbol = 'UCOBANK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 74.0, 74.37, 72.13, 74.0, 74.51, -0.51, -0.68, 62623, 0.46, 92.97, 59.95, -7.34, -9.32
FROM km_equity_symbols WHERE symbol = 'UFO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 51.6, 53.0, 50.0, 50.0, 51.4, -1.4, -2.72, 26000, 0.13, 98.0, 46.0, -9.91, -20.76
FROM km_equity_symbols WHERE symbol = 'UHTL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 62.0, 62.47, 60.85, 61.1, 62.7, -1.6, -2.55, 6911643, 42.67, 68.0, 30.9, 5.86, 79.97
FROM km_equity_symbols WHERE symbol = 'UJJIVANSFB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 13012.0, 13025.0, 12873.0, 12977.0, 13029.0, -52.0, -0.4, 178236, 230.73, 13110.0, 10047.85, 7.75, 12.39
FROM km_equity_symbols WHERE symbol = 'ULTRACEMCO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 18.95, 18.95, 18.1, 18.1, 18.55, -0.45, -2.43, 12000, 0.02, 32.0, 18.1, -5.48, -43.44
FROM km_equity_symbols WHERE symbol = 'UMA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 290.0, 295.0, 288.0, 291.0, 288.2, 2.8, 0.97, 26000, 0.76, 390.6, 120.0, 2.23, 113.07
FROM km_equity_symbols WHERE symbol = 'UNIHEALTH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 31.0, 31.0, 30.1, 30.1, 32.5, -2.4, -7.38, 4800, 0.01, 75.0, 29.0, -13.01, -58.22
FROM km_equity_symbols WHERE symbol = 'UNILEX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 926.3, 972.0, 926.3, 935.0, 1023.4, -88.4, -8.64, 197412, 18.66, 1397.0, 807.05, 4.6, -21.95
FROM km_equity_symbols WHERE symbol = 'UNIMECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 180.0, 180.76, 178.1, 178.76, 181.0, -2.24, -1.24, 8733451, 156.56, 183.34, 106.63, 7.56, 58.17
FROM km_equity_symbols WHERE symbol = 'UNIONBANK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1414.0, 1423.0, 1398.1, 1400.2, 1417.4, -17.2, -1.21, 383577, 54.06, 1645.0, 1271.1, 6.12, 0.24
FROM km_equity_symbols WHERE symbol = 'UNITDSPR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1245.8, 1249.0, 1220.3, 1243.2, 1247.9, -4.7, -0.38, 1278975, 158.17, 1382.0, 767.6, 3.53, 31.3
FROM km_equity_symbols WHERE symbol = 'UNOMINDA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 740.15, 742.95, 720.95, 723.35, 744.9, -21.55, -2.89, 1332082, 97.36, 812.2, 588.85, -6.48, 14.86
FROM km_equity_symbols WHERE symbol = 'UPL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 147.0, 147.7, 144.1, 146.0, 147.9, -1.9, -1.28, 5600, 0.08, 258.8, 134.3, 0.45, -37.99
FROM km_equity_symbols WHERE symbol = 'URBAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 121.0, 122.89, 120.82, 121.2, 121.08, 0.12, 0.1, 2561165, 31.15, 201.18, 116.58, -10.56, NULL
FROM km_equity_symbols WHERE symbol = 'URBANCO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 132.25, 132.25, NULL, NULL, NULL, NULL, 220.08, 91.49, -4.1, -33.88
FROM km_equity_symbols WHERE symbol = 'USASEEDS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 30.95, 30.95, 29.0, 29.0, 30.0, -1.0, -3.33, 8000, 0.02, 53.83, 24.33, -17.14, -69.87
FROM km_equity_symbols WHERE symbol = 'USHAFIN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 422.15, 422.15, 407.0, 409.8, 423.75, -13.95, -3.29, 203823, 8.44, 497.1, 278.55, -5.05, 35.7
FROM km_equity_symbols WHERE symbol = 'USHAMART'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1062.5, 1079.8, 1052.6, 1071.0, 1078.15, -7.15, -0.66, 37725, 4.03, 1494.8, 905.0, -0.8, 8.06
FROM km_equity_symbols WHERE symbol = 'UTIAMC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 210.4, 214.25, 207.5, 210.24, 210.69, -0.45, -0.21, 186843, 3.94, 230.99, 192.0, -3.26, NULL
FROM km_equity_symbols WHERE symbol = 'UTLSOLAR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 224.0, 225.35, 218.0, 218.0, 225.05, -7.05, -3.13, 29400, 0.65, 281.0, 145.05, -5.51, 3.22
FROM km_equity_symbols WHERE symbol = 'UTSSAV'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 98.15, 98.15, NULL, NULL, NULL, NULL, 182.5, 98.15, -9.37, -41.05
FROM km_equity_symbols WHERE symbol = 'UWCSL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2074.2, 2078.0, 2011.5, 2030.0, 2078.4, -48.4, -2.33, 54489, 11.18, 2564.1, 1390.2, -4.77, 18.36
FROM km_equity_symbols WHERE symbol = 'V2RETAIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 253.0, 257.9, 251.16, 255.39, 256.87, -1.48, -0.58, 517323, 13.18, 293.25, 195.0, 15.2, -6.02
FROM km_equity_symbols WHERE symbol = 'VAIBHAVGBL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 572.0, 572.0, 555.0, 558.6, 574.0, -15.4, -2.68, 228319, 12.88, 694.7, 374.1, -0.85, 9.97
FROM km_equity_symbols WHERE symbol = 'VARROC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 5.0, 5.0, NULL, NULL, NULL, NULL, 6.0, 3.5, NULL, -13.04
FROM km_equity_symbols WHERE symbol = 'VASA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 452.5, 453.75, 445.6, 448.45, 455.7, -7.25, -1.59, 3080721, 138.55, 568.5, 419.55, -10.52, -12.65
FROM km_equity_symbols WHERE symbol = 'VBL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 172.0, 174.15, 172.0, 174.15, 175.0, -0.85, -0.49, 3000, 0.05, 260.0, 100.25, -3.95, 24.1
FROM km_equity_symbols WHERE symbol = 'VDEAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 685.0, 685.0, 662.55, 673.9, 702.75, -28.85, -4.11, 15868021, 1069.27, 769.8, 363.0, 5.76, 58.73
FROM km_equity_symbols WHERE symbol = 'VEDL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 115.0, 118.8, 115.0, 118.8, 113.5, 5.3, 4.67, 2000, 0.02, 318.0, 79.8, -14.22, -55.53
FROM km_equity_symbols WHERE symbol = 'VEEKAYEM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 60.9, 60.9, NULL, NULL, NULL, NULL, 94.5, 39.75, 5.0, -5.43
FROM km_equity_symbols WHERE symbol = 'VELS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 768.0, 768.0, 740.1, 750.5, 767.05, -16.55, -2.16, 73127, 5.5, 840.0, 523.4, -1.31, 6.56
FROM km_equity_symbols WHERE symbol = 'VENTIVE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 62.0, 62.0, 62.0, 62.0, 59.9, 2.1, 3.51, 9600, 0.06, 89.0, 44.0, 13.76, -27.57
FROM km_equity_symbols WHERE symbol = 'VERITAAS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 91.0, 91.0, NULL, NULL, NULL, NULL, 149.8, 73.4, -17.27, 9.97
FROM km_equity_symbols WHERE symbol = 'VERTEXPLUS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 510.0, 510.1, 500.4, 507.25, 510.3, -3.05, -0.6, 17927, 0.91, 646.0, 356.13, 14.08, 24.78
FROM km_equity_symbols WHERE symbol = 'VESUVIUS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 142.0, 146.0, 141.25, 142.4, 145.15, -2.75, -1.89, 36000, 0.52, 208.0, 122.0, 4.37, NULL
FROM km_equity_symbols WHERE symbol = 'VGINFOTECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 332.6, 335.55, 323.0, 323.5, 333.85, -10.35, -3.1, 114481, 3.74, 409.75, 298.0, 3.34, -5.73
FROM km_equity_symbols WHERE symbol = 'VGUARD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 64.2, 64.2, NULL, NULL, NULL, NULL, 99.55, 49.3, -2.95, 0.94
FROM km_equity_symbols WHERE symbol = 'VIAZ'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 47.2, 47.78, 46.01, 46.8, 47.35, -0.55, -1.16, 1125614, 5.29, 58.45, 42.51, -2.26, NULL
FROM km_equity_symbols WHERE symbol = 'VIDYAWIRES'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 251.0, 253.8, 250.0, 253.8, 256.0, -2.2, -0.86, 6400, 0.16, 307.9, 111.95, 6.33, 65.64
FROM km_equity_symbols WHERE symbol = 'VIESL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 56.1, 58.9, 56.0, 56.5, 59.65, -3.15, -5.28, 24000, 0.14, 98.0, 56.0, -23.65, NULL
FROM km_equity_symbols WHERE symbol = 'VIGOR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1000.0, 1004.75, 977.0, 987.0, 994.55, -7.55, -0.76, 165417, 16.39, 1180.0, 740.0, -1.21, 3.5
FROM km_equity_symbols WHERE symbol = 'VIJAYA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 57.4, 61.9, 57.05, 61.9, 60.05, 1.85, 3.08, 52000, 0.3, 67.5, 35.0, 47.38, NULL
FROM km_equity_symbols WHERE symbol = 'VIJAYPD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 231.0, 236.0, 229.41, 230.5, 234.8, -4.3, -1.83, 671303, 15.56, 407.95, 188.25, 0.51, NULL
FROM km_equity_symbols WHERE symbol = 'VIKRAMSOLR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 86.01, 87.35, 85.5, 86.4, 86.85, -0.45, -0.52, 1806725, 15.6, 118.4, 84.2, -9.4, NULL
FROM km_equity_symbols WHERE symbol = 'VIKRAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 342.0, 347.0, 330.0, 342.95, 349.55, -6.6, -1.89, 22500, 0.76, 673.7, 291.0, -8.19, -5.22
FROM km_equity_symbols WHERE symbol = 'VILAS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 33.95, 33.95, 33.95, 33.95, 32.35, 1.6, 4.95, 4000, 0.01, 38.4, 16.5, 23.01, 68.07
FROM km_equity_symbols WHERE symbol = 'VILINBIO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1522.5, 1530.0, 1477.3, 1498.0, 1530.4, -32.4, -2.12, 14397, 2.17, 2040.0, 1412.5, -5.14, -8.94
FROM km_equity_symbols WHERE symbol = 'VINATIORGA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 315.0, 333.0, 315.0, 325.1, 324.55, 0.55, 0.17, 31750, 1.05, 475.0, 297.0, -3.74, -13.87
FROM km_equity_symbols WHERE symbol = 'VINSYS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1038.6, 1038.6, 1017.2, 1017.5, 1038.6, -21.1, -2.03, 1300, 0.13, 1440.0, 575.8, -11.39, 52.54
FROM km_equity_symbols WHERE symbol = 'VINYAS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 374.7, 392.0, 371.5, 391.0, 380.4, 10.6, 2.79, 224580, 8.65, 492.3, 248.35, 4.31, 11.55
FROM km_equity_symbols WHERE symbol = 'VIPIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 130.0, 130.8, 128.0, 130.8, 128.8, 2.0, 1.55, 3000, 0.04, 145.0, 34.0, -3.83, 240.53
FROM km_equity_symbols WHERE symbol = 'VISAMAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 177.0, 177.0, 173.5, 173.5, 177.0, -3.5, -1.98, 1000, 0.02, 279.95, 145.0, 0.87, -30.6
FROM km_equity_symbols WHERE symbol = 'VISHNUINFR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 41.5, 41.25, 0.25, 0.61, NULL, NULL, 70.0, 36.1, -5.82, -39.34
FROM km_equity_symbols WHERE symbol = 'VISHWAS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 52.95, 53.05, 52.95, 53.05, 53.35, -0.3, -0.56, 4800, 0.03, 77.0, 48.1, -4.24, -31.1
FROM km_equity_symbols WHERE symbol = 'VITAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 800.0, 813.15, 750.0, 813.15, 820.4, -7.25, -0.88, 33400, 2.61, 1162.5, 373.75, 15.65, -6.22
FROM km_equity_symbols WHERE symbol = 'VIVIANA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 77.6, 76.0, 1.6, 2.11, NULL, NULL, 81.7, 62.0, 2.7, 16.03
FROM km_equity_symbols WHERE symbol = 'VIVO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 222.0, 222.0, 215.1, 215.99, 222.85, -6.86, -3.08, 380396, 8.27, 257.85, 117.35, 13.65, 36.95
FROM km_equity_symbols WHERE symbol = 'VIYASH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 28.95, 28.95, 26.45, 27.9, 28.4, -0.5, -1.76, 7500, 0.02, 63.45, 22.15, 0.72, -39.94
FROM km_equity_symbols WHERE symbol = 'VLINFRA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 599.1, 617.8, 594.0, 617.8, 599.05, 18.75, 3.13, 22500, 1.36, 805.0, 200.3, -8.19, 89.88
FROM km_equity_symbols WHERE symbol = 'VMARCIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 629.0, 629.0, 607.05, 615.4, 634.6, -19.2, -3.03, 235340, 14.41, 945.0, 550.5, -0.38, -24.03
FROM km_equity_symbols WHERE symbol = 'VMART'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 123.0, 123.2, 121.01, 121.5, 123.87, -2.37, -1.91, 4166950, 50.79, 157.6, 95.99, -5.2, 13.6
FROM km_equity_symbols WHERE symbol = 'VMM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 51.3, 52.2, 50.31, 50.95, 51.45, -0.5, -0.97, 213844, 1.1, 105.0, 44.65, 5.66, NULL
FROM km_equity_symbols WHERE symbol = 'VMSTMT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 240.0, 240.0, NULL, NULL, NULL, NULL, 255.0, 77.4, 9.36, NULL
FROM km_equity_symbols WHERE symbol = 'VOLERCAR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 8108.0, 8135.0, 7921.0, 7949.0, 8164.5, -215.5, -2.64, 24998, 20.1, 10088.0, 6051.0, 11.01, 15.11
FROM km_equity_symbols WHERE symbol = 'VOLTAMP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1534.0, 1534.0, 1510.2, 1521.3, 1535.8, -14.5, -0.94, 534253, 81.36, 1546.8, 1182.7, 4.15, 21.85
FROM km_equity_symbols WHERE symbol = 'VOLTAS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 142.5, 142.5, 142.5, 142.5, 150.0, -7.5, -5.0, 400, 0.01, 274.5, 138.0, -16.57, -46.25
FROM km_equity_symbols WHERE symbol = 'VR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 22.0, 22.0, NULL, NULL, NULL, NULL, 37.55, 16.05, 3.04, -40.54
FROM km_equity_symbols WHERE symbol = 'VSCL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 236.0, 240.99, 234.44, 237.0, 239.37, -2.37, -0.99, 134683, 3.21, 334.65, 214.27, -2.29, -22.04
FROM km_equity_symbols WHERE symbol = 'VSTIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 482.0, 525.0, 475.0, 505.0, 483.75, 21.25, 4.39, 4174502, 212.4, 539.9, 361.1, 21.53, 15.31
FROM km_equity_symbols WHERE symbol = 'VTL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3131.0, 3153.7, 3080.0, 3088.0, 3171.2, -83.2, -2.62, 640524, 199.18, 3865.0, 1863.0, 18.77, 40.74
FROM km_equity_symbols WHERE symbol = 'WAAREEENER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 900.0, 900.0, 883.8, 892.4, 907.35, -14.95, -1.65, 188339, 16.74, 1358.0, 841.15, -11.32, NULL
FROM km_equity_symbols WHERE symbol = 'WAAREERTL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1310.0, 1323.4, 1265.3, 1280.0, 1334.5, -54.5, -4.08, 466405, 59.9, 1680.0, 1033.0, 7.9, -13.97
FROM km_equity_symbols WHERE symbol = 'WABAG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 214.4, 218.1, 207.29, 214.0, 214.95, -0.95, -0.44, 888724, 18.87, 224.0, 164.06, 21.45, NULL
FROM km_equity_symbols WHERE symbol = 'WAKEFIT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 45.5, 45.5, NULL, NULL, NULL, NULL, 53.3, 37.7, -4.91, 1.11
FROM km_equity_symbols WHERE symbol = 'WALPAR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 69.5, 69.5, 65.25, 65.8, 70.27, -4.47, -6.36, 5489798, 36.51, 158.99, 64.41, -23.01, -47.78
FROM km_equity_symbols WHERE symbol = 'WEBELSOLAR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 830.0, 830.0, 801.0, 801.0, 831.15, -30.15, -3.63, 248115, 20.02, 994.0, 664.3, 8.14, 0.98
FROM km_equity_symbols WHERE symbol = 'WELCORP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 501.1, 503.15, 493.9, 495.0, 505.15, -10.15, -2.01, 60890, 3.02, 580.0, 400.05, 9.24, -6.43
FROM km_equity_symbols WHERE symbol = 'WELENT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 140.01, 145.25, 139.05, 141.1, 142.6, -1.5, -1.05, 3584965, 51.03, 154.57, 104.8, 16.26, 15.67
FROM km_equity_symbols WHERE symbol = 'WELSPUNLIV'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 539.0, 539.0, 519.05, 521.6, 539.7, -18.1, -3.35, 99933, 5.26, 819.2, 464.3, 2.12, -29.93
FROM km_equity_symbols WHERE symbol = 'WESTLIFE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 571.0, 571.25, 559.05, 560.6, 575.1, -14.5, -2.52, 63705, 3.6, 664.0, 555.6, -6.36, NULL
FROM km_equity_symbols WHERE symbol = 'WEWORK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 888.0, 906.25, 867.8, 894.0, 888.35, 5.65, 0.64, 564057, 50.56, 1473.8, 756.85, 10.42, -12.58
FROM km_equity_symbols WHERE symbol = 'WHIRLPOOL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 50.0, 50.0, NULL, NULL, NULL, NULL, 94.8, 49.0, -15.25, NULL
FROM km_equity_symbols WHERE symbol = 'WHITEFORCE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 54.05, 54.5, 54.0, 54.5, 60.0, -5.5, -9.17, 1500, 0.01, 293.55, 54.0, -23.88, -81.43
FROM km_equity_symbols WHERE symbol = 'WINNY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 136.0, 141.0, 135.0, 137.0, 143.05, -6.05, -4.23, 12400, 0.17, 272.0, 124.8, -2.9, -38.54
FROM km_equity_symbols WHERE symbol = 'WINSOL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 210.65, 216.48, 209.01, 214.38, 219.08, -4.7, -2.15, 23721186, 505.14, 316.5, 209.01, -18.86, -30.52
FROM km_equity_symbols WHERE symbol = 'WIPRO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1370.0, 1435.0, 1363.0, 1391.4, 1382.9, 8.5, 0.61, 465807, 65.24, 1868.8, 1110.05, 0.27, -3.14
FROM km_equity_symbols WHERE symbol = 'WOCKPHARMA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 128.55, 128.55, 128.5, 128.5, 128.5, NULL, NULL, 4000, 0.05, 209.95, 97.0, -1.42, 2.92
FROM km_equity_symbols WHERE symbol = 'WOL3D'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 181.5, 183.9, 172.0, 175.0, 180.95, -5.95, -3.29, 24400, 0.43, 358.0, 141.5, -30.69, -47.29
FROM km_equity_symbols WHERE symbol = 'WOMANCART'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 120.5, 120.5, 119.0, 119.0, 121.95, -2.95, -2.42, 2500, 0.03, 204.0, 113.0, -8.46, -33.89
FROM km_equity_symbols WHERE symbol = 'WTICAB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 116.3, 116.3, 114.0, 114.0, 116.3, -2.3, -1.98, 1600, 0.02, 153.5, 72.6, -4.24, 41.0
FROM km_equity_symbols WHERE symbol = 'YASHOPTICS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 688.8, 690.0, 676.05, 684.5, 694.2, -9.7, -1.4, 278769, 19.04, 843.7, 345.6, 6.99, 65.18
FROM km_equity_symbols WHERE symbol = 'YATHARTH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 11.85, 11.85, NULL, NULL, NULL, NULL, 17.0, 10.05, 2.16, -31.3
FROM km_equity_symbols WHERE symbol = 'YCCL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 21.03, 21.07, 20.71, 20.84, 21.1, -0.26, -1.23, 59208817, 123.39, 24.3, 16.02, -8.56, 14.69
FROM km_equity_symbols WHERE symbol = 'YESBANK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 35.15, 35.15, 35.15, 35.15, 37.0, -1.85, -5.0, 1600, 0.01, 53.95, 24.65, 25.99, -34.85
FROM km_equity_symbols WHERE symbol = 'YUDIZ'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 304.0, 304.0, 283.15, 284.45, 304.2, -19.75, -6.49, 3059047, 89.51, 469.8, 265.8, -7.06, -22.15
FROM km_equity_symbols WHERE symbol = 'ZAGGLE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 75.0, 75.0, 75.0, 75.0, 77.0, -2.0, -2.6, 600, NULL, 165.8, 71.0, -9.15, -50.0
FROM km_equity_symbols WHERE symbol = 'ZEAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 93.0, 99.1, 92.35, 95.99, 93.72, 2.27, 2.42, 31429607, 302.89, 151.7, 78.4, 7.7, -3.95
FROM km_equity_symbols WHERE symbol = 'ZEEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 9.9, 10.35, 9.55, 10.01, 9.4, 0.61, 6.49, 11175771, 11.22, 16.46, 7.1, 15.32, -28.86
FROM km_equity_symbols WHERE symbol = 'ZEEMEDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 46.0, 47.75, 46.0, 46.25, 47.0, -0.75, -1.6, 10400, 0.05, 107.0, 45.0, -9.13, -51.49
FROM km_equity_symbols WHERE symbol = 'ZENITHDRUG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 571.35, 607.45, 558.3, 587.0, 576.85, 10.15, 1.76, 2310507, 135.81, 901.5, 535.85, -17.72, -32.1
FROM km_equity_symbols WHERE symbol = 'ZENSARTECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1340.0, 1340.0, 1302.9, 1305.0, 1347.0, -42.0, -3.12, 392007, 51.62, 2268.0, 945.35, 5.55, -10.05
FROM km_equity_symbols WHERE symbol = 'ZENTEC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 15800.0, 16146.0, 15672.0, 15800.0, 15816.0, -16.0, -0.1, 19294, 30.83, 16146.0, 9900.0, 11.8, 45.57
FROM km_equity_symbols WHERE symbol = 'ZFCVINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 570.0, 570.0, 530.0, 533.5, 582.25, -48.75, -8.37, 48300, 2.62, 701.0, 460.0, -17.08, -9.26
FROM km_equity_symbols WHERE symbol = 'ZTECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 920.95, 923.4, 897.3, 906.5, 920.95, -14.45, -1.57, 474515, 43.01, 1059.05, 795.0, 0.64, -3.86
FROM km_equity_symbols WHERE symbol = 'ZYDUSLIFE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 406.55, 410.0, 396.8, 405.1, 406.55, -1.45, -0.36, 88266, 3.57, 530.9, 298.64, -8.26, 19.24
FROM km_equity_symbols WHERE symbol = 'ZYDUSWELL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

