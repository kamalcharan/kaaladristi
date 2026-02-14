-- Auto-generated: equity EOD part 1 (500 rows)
-- Uses subquery to resolve equity_id from symbol

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1136.3, 1146.2, 1115.6, 1126.7, 1144.4, -17.7, -1.55, 471438, 53.15, 1273.8, 790.5, -0.89, 18.21
FROM km_equity_symbols WHERE symbol = '360ONE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 36995.0, 36995.0, 34705.0, 35050.0, 37515.0, -2465.0, -6.57, 9115, 32.58, 38030.0, 25718.15, 0.16, 28.88
FROM km_equity_symbols WHERE symbol = '3MINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 471.0, 473.5, 464.4, 466.0, 471.0, -5.0, -1.06, 276678, 12.93, 547.8, 361.6, -3.59, 18.64
FROM km_equity_symbols WHERE symbol = 'AADHARHFC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 47.2, 51.95, 46.25, 48.0, 50.0, -2.0, -4.0, 59200, 0.28, 105.0, 46.25, -20.0, NULL
FROM km_equity_symbols WHERE symbol = 'AAKAAR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 108.05, 108.05, 108.05, 108.05, 112.0, -3.95, -3.53, 1200, 0.01, 182.0, 97.5, -11.43, NULL
FROM km_equity_symbols WHERE symbol = 'AARADHYA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 371.0, 374.45, 367.1, 371.1, 375.15, -4.05, -1.08, 87618, 3.25, 564.05, 312.0, -5.73, -3.08
FROM km_equity_symbols WHERE symbol = 'AARTIDRUGS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 459.2, 460.0, 443.1, 449.0, 465.6, -16.6, -3.57, 739623, 33.42, 495.0, 338.05, 23.69, 3.83
FROM km_equity_symbols WHERE symbol = 'AARTIIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 710.0, 715.65, 699.3, 710.0, 710.85, -0.85, -0.12, 171579, 12.15, 971.0, 574.45, -7.15, -3.56
FROM km_equity_symbols WHERE symbol = 'AARTIPHARM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 20.5, 20.5, NULL, NULL, NULL, NULL, 25.5, 14.5, -6.82, 6.22
FROM km_equity_symbols WHERE symbol = 'AATMAJ'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1300.5, 1303.6, 1264.1, 1281.0, 1308.5, -27.5, -2.1, 399683, 51.57, 2234.0, 1264.1, -11.47, -24.55
FROM km_equity_symbols WHERE symbol = 'AAVAS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 5788.5, 5855.0, 5726.5, 5768.0, 5788.5, -20.5, -0.35, 152957, 88.66, 6260.0, 4637.5, 16.15, 5.98
FROM km_equity_symbols WHERE symbol = 'ABB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 26680.0, 26685.0, 26300.0, 26500.0, 26660.0, -160.0, -0.6, 6553, 17.34, 37000.0, 26300.0, -5.66, -6.56
FROM km_equity_symbols WHERE symbol = 'ABBOTINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 344.0, 344.0, 334.5, 335.5, 344.65, -9.15, -2.65, 5436281, 183.52, 369.3, 149.01, -4.38, 110.68
FROM km_equity_symbols WHERE symbol = 'ABCAPITAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 530.0, 539.55, 523.15, 530.6, 538.4, -7.8, -1.45, 429481, 22.8, 696.8, 279.0, 9.82, 52.34
FROM km_equity_symbols WHERE symbol = 'ABDL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 70.0, 75.1, 68.32, 73.3, 70.04, 3.26, 4.65, 19443779, 142.52, 295.7, 59.8, -0.03, -71.69
FROM km_equity_symbols WHERE symbol = 'ABFRL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 32.0, 32.45, 30.55, 32.45, 32.0, 0.45, 1.41, 14400, 0.05, 55.25, 26.45, -4.14, -17.01
FROM km_equity_symbols WHERE symbol = 'ABHAPOWER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 114.0, 115.3, 111.5, 112.67, 114.15, -1.48, -1.3, 1012794, 11.48, 175.0, 100.86, -4.83, NULL
FROM km_equity_symbols WHERE symbol = 'ABLBL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1409.6, 1413.1, 1374.1, 1388.0, 1415.2, -27.2, -1.92, 77682, 10.81, 2537.9, 1186.0, -10.56, -33.9
FROM km_equity_symbols WHERE symbol = 'ABREL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 868.65, 878.8, 850.2, 870.5, 871.4, -0.9, -0.1, 342522, 29.75, 908.0, 556.45, 6.02, 32.19
FROM km_equity_symbols WHERE symbol = 'ABSLAMC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 183.0, 186.5, 181.05, 183.0, 183.1, -0.1, -0.05, 60500, 1.11, 259.0, 92.1, -8.36, 30.34
FROM km_equity_symbols WHERE symbol = 'ABSMARINE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1667.9, 1675.0, 1632.0, 1639.6, 1671.3, -31.7, -1.9, 129132, 21.21, 2119.9, 1593.0, -3.97, -14.34
FROM km_equity_symbols WHERE symbol = 'ACC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 325.0, 325.0, 320.0, 322.6, 326.8, -4.2, -1.29, 22500, 0.72, 378.0, 169.81, -7.21, 30.3
FROM km_equity_symbols WHERE symbol = 'ACCENTMIC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 27.0, 27.0, NULL, NULL, NULL, NULL, 31.65, 17.5, -7.06, 11.34
FROM km_equity_symbols WHERE symbol = 'ACCORD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 68.5, 68.5, 68.5, 68.5, 68.2, 0.3, 0.44, 4800, 0.03, 102.5, 53.8, -1.23, NULL
FROM km_equity_symbols WHERE symbol = 'ACCPL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 895.0, 902.0, 876.05, 896.0, 904.7, -8.7, -0.96, 173931, 15.49, 1389.0, 775.45, 1.08, -26.9
FROM km_equity_symbols WHERE symbol = 'ACE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 575.0, 579.8, 566.0, 569.3, 581.5, -12.2, -2.1, 66084, 3.79, 727.6, 408.35, 11.42, 26.02
FROM km_equity_symbols WHERE symbol = 'ACI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 222.0, 225.87, 218.49, 224.5, 223.96, 0.54, 0.24, 366314, 8.16, 324.3, 171.99, -0.04, 21.22
FROM km_equity_symbols WHERE symbol = 'ACMESOLAR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 170.0, 170.0, NULL, NULL, NULL, NULL, 190.0, 147.05, -1.73, NULL
FROM km_equity_symbols WHERE symbol = 'ACTIVEINFR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2090.0, 2104.8, 2010.0, 2024.0, 2093.4, -69.4, -3.32, 309000, 63.34, 2553.65, 1040.5, 20.24, -11.95
FROM km_equity_symbols WHERE symbol = 'ACUTAAS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1017.0, 1017.0, 979.0, 983.0, 1022.8, -39.8, -3.89, 1657616, 163.93, 1067.7, 639.45, 5.42, 32.12
FROM km_equity_symbols WHERE symbol = 'ADANIENSOL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2210.0, 2210.0, 2124.2, 2127.0, 2211.8, -84.8, -3.83, 1489548, 320.7, 2616.5, 1848.0, -1.46, -2.4
FROM km_equity_symbols WHERE symbol = 'ADANIENT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 988.9, 989.9, 943.75, 949.55, 997.65, -48.1, -4.82, 2943844, 281.69, 1177.55, 758.0, 1.37, 3.92
FROM km_equity_symbols WHERE symbol = 'ADANIGREEN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1543.0, 1543.0, 1507.0, 1508.0, 1543.7, -35.7, -2.31, 1838361, 279.43, 1583.9, 1036.5, 5.56, 35.67
FROM km_equity_symbols WHERE symbol = 'ADANIPORTS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 149.2, 149.3, 139.1, 140.4, 149.79, -9.39, -6.27, 38679559, 548.05, 182.7, 92.4, -2.08, 40.92
FROM km_equity_symbols WHERE symbol = 'ADANIPOWER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 111.0, 111.0, 106.5, 106.5, 111.0, -4.5, -4.05, 1500, 0.02, 239.95, 90.0, -9.75, NULL
FROM km_equity_symbols WHERE symbol = 'ADDICTIVE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 138.5, 140.05, 135.3, 138.4, 138.12, 0.28, 0.2, 568320, 7.87, 154.0, 102.0, 11.68, NULL
FROM km_equity_symbols WHERE symbol = 'ADVANCE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 303.6, 305.0, 297.1, 301.0, 306.1, -5.1, -1.67, 68158, 2.05, 366.25, 257.9, 3.72, -2.57
FROM km_equity_symbols WHERE symbol = 'ADVENZYMES'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 705.7, 710.7, 690.0, 704.1, 711.55, -7.45, -1.05, 150056, 10.53, 946.5, 639.1, -2.78, -4.43
FROM km_equity_symbols WHERE symbol = 'AEGISLOG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 212.0, 217.14, 204.5, 213.2, 213.01, 0.19, 0.09, 674274, 14.22, 302.0, 198.0, -7.46, NULL
FROM km_equity_symbols WHERE symbol = 'AEGISVOPAK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 143.1, 145.6, 138.94, 142.21, 143.62, -1.41, -0.98, 657670, 9.34, 165.4, 131.14, 0.44, NULL
FROM km_equity_symbols WHERE symbol = 'AEQUS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 98.75, 98.75, 98.15, 98.15, 98.5, -0.35, -0.36, 4000, 0.04, 165.0, 89.05, 2.24, -31.12
FROM km_equity_symbols WHERE symbol = 'AERON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 84.9, 85.5, 84.9, 85.0, 84.85, 0.15, 0.18, 4000, 0.03, 155.6, 63.0, -12.37, 27.15
FROM km_equity_symbols WHERE symbol = 'AESTHETIK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 960.2, 978.5, 948.0, 965.0, 966.4, -1.4, -0.14, 91324, 8.8, 1083.6, 725.0, -2.47, 20.47
FROM km_equity_symbols WHERE symbol = 'AETHER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 332.8, 334.95, 328.8, 332.3, 337.6, -5.3, -1.57, 116290, 3.86, 498.7, 319.0, -7.94, -24.24
FROM km_equity_symbols WHERE symbol = 'AFCONS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1605.7, 1610.0, 1553.0, 1559.8, 1623.5, -63.7, -3.92, 368172, 57.89, 2185.9, 1246.0, -10.03, 0.22
FROM km_equity_symbols WHERE symbol = 'AFFLE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 453.0, 461.95, 447.7, 455.0, 459.25, -4.25, -0.93, 53932, 2.44, 568.0, 327.0, -9.02, 1.34
FROM km_equity_symbols WHERE symbol = 'AGARWALEYE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 32.0, 32.0, 32.0, 32.0, 32.0, NULL, NULL, 1500, NULL, 71.25, 31.0, -17.84, -34.69
FROM km_equity_symbols WHERE symbol = 'AGARWALFT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 100.0, 100.0, 96.0, 98.0, 101.3, -3.3, -3.26, 50400, 0.49, 174.05, 81.0, -14.96, -13.21
FROM km_equity_symbols WHERE symbol = 'AGARWALTUF'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 633.0, 634.5, 607.05, 610.7, 638.6, -27.9, -4.37, 136848, 8.42, 1009.0, 585.25, -10.74, -12.76
FROM km_equity_symbols WHERE symbol = 'AGI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 19.5, 19.5, 19.3, 19.3, 20.25, -0.95, -4.69, 10000, 0.02, 43.35, 17.9, -10.21, -31.14
FROM km_equity_symbols WHERE symbol = 'AGNI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 80.8, 80.8, NULL, NULL, NULL, NULL, 80.8, 37.3, 22.15, 61.6
FROM km_equity_symbols WHERE symbol = 'AGUL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 122.0, 122.85, 120.34, 121.01, 122.44, -1.43, -1.17, 84764, 1.03, 172.75, 90.78, -11.6, NULL
FROM km_equity_symbols WHERE symbol = 'AHCL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 900.0, 913.3, 885.0, 907.5, 909.9, -2.4, -0.26, 203833, 18.34, 1125.0, 620.0, 1.02, 31.62
FROM km_equity_symbols WHERE symbol = 'AHLUCONT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3939.0, 3965.2, 3828.6, 3859.0, 3951.1, -92.1, -2.33, 68253, 26.55, 4206.1, 3001.1, -1.18, 9.6
FROM km_equity_symbols WHERE symbol = 'AIAENG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 490.0, 500.7, 485.0, 487.0, 495.7, -8.7, -1.76, 270977, 13.27, 683.0, 265.1, -27.08, 43.49
FROM km_equity_symbols WHERE symbol = 'AIIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 28.0, 28.75, 28.0, 28.75, 27.4, 1.35, 4.93, 3000, 0.01, 90.9, 23.75, -1.88, -52.16
FROM km_equity_symbols WHERE symbol = 'AILIMITED'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 849.95, 859.95, 822.75, 830.0, 861.6, -31.6, -3.67, 16600, 1.38, 1040.0, 358.0, 2.3, 77.57
FROM km_equity_symbols WHERE symbol = 'AIMTRON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 69.1, 70.5, 69.1, 70.5, 72.7, -2.2, -3.03, 2400, 0.02, 153.0, 69.1, -15.32, -39.87
FROM km_equity_symbols WHERE symbol = 'AISL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2885.0, 2942.5, 2851.1, 2927.9, 2890.0, 37.9, 1.31, 171375, 50.0, 3020.8, 2327.3, 7.23, 17.32
FROM km_equity_symbols WHERE symbol = 'AJANTPHARM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 480.0, 487.25, 467.9, 477.85, 498.8, -20.95, -4.2, 322477, 15.47, 756.2, 467.9, -16.92, NULL
FROM km_equity_symbols WHERE symbol = 'AJAXENGG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 80.0, 83.0, 77.55, 79.0, 76.6, 2.4, 3.13, 65000, 0.52, 133.75, 63.0, 21.06, -30.44
FROM km_equity_symbols WHERE symbol = 'AKANKSHA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 214.7, 222.4, 214.65, 215.0, 225.0, -10.0, -4.44, 7200, 0.16, 299.3, 62.0, -12.54, 192.71
FROM km_equity_symbols WHERE symbol = 'AKIKO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 456.5, 463.45, 448.25, 458.9, 464.0, -5.1, -1.1, 70716, 3.21, 622.95, 405.0, 3.39, -16.62
FROM km_equity_symbols WHERE symbol = 'AKUMS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3000.0, 3019.8, 2889.3, 2950.0, 3000.3, -50.3, -1.68, 28914, 8.49, 3915.5, 2658.7, -4.92, -10.13
FROM km_equity_symbols WHERE symbol = 'AKZOINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 85.65, 84.8, 0.85, 1.0, NULL, NULL, 208.5, 73.25, -0.93, NULL
FROM km_equity_symbols WHERE symbol = 'ALCODIS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 920.0, 935.0, 910.2, 918.1, 922.65, -4.55, -0.49, 53913, 4.99, 1225.1, 819.0, 4.72, -10.52
FROM km_equity_symbols WHERE symbol = 'ALIVUS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 5850.0, 5850.0, 5331.5, 5400.0, 5870.5, -470.5, -8.01, 605115, 331.45, 5933.5, 4491.65, -7.9, 14.42
FROM km_equity_symbols WHERE symbol = 'ALKEM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1520.0, 1533.4, 1510.3, 1524.0, 1537.8, -13.8, -0.9, 24539, 3.73, 2438.8, 1506.7, -5.39, -11.54
FROM km_equity_symbols WHERE symbol = 'ALKYLAMINE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 9.5, 9.58, 9.21, 9.3, 9.59, -0.29, -3.02, 5069335, 4.74, 38.34, 8.97, -16.14, -74.24
FROM km_equity_symbols WHERE symbol = 'ALLCARGO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 182.85, 182.85, 173.6, 178.8, 183.35, -4.55, -2.48, 31200, 0.56, 475.5, 170.0, -14.57, -58.46
FROM km_equity_symbols WHERE symbol = 'ALLETEC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 261.1, 264.4, 253.25, 258.55, 263.71, -5.16, -1.96, 26528, 0.69, 334.9, 218.0, 8.2, NULL
FROM km_equity_symbols WHERE symbol = 'ALLTIME'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 15.54, 15.62, 14.96, 15.07, 15.6, -0.53, -3.4, 6518121, 9.95, 23.5, 14.0, -5.04, -11.14
FROM km_equity_symbols WHERE symbol = 'ALOKINDS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 841.0, 883.0, 840.0, 876.6, 870.95, 5.65, 0.65, 32600, 2.79, 1449.7, 495.0, 8.6, 27.66
FROM km_equity_symbols WHERE symbol = 'ALPEXSOLAR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 60.4, 60.4, 60.4, 60.4, 63.8, -3.4, -5.33, 1500, 0.01, 95.8, 48.0, -8.48, -6.14
FROM km_equity_symbols WHERE symbol = 'ALUWIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 385.0, 385.95, 367.4, 372.0, 386.3, -14.3, -3.7, 605877, 22.81, 434.95, 318.0, NULL, NULL
FROM km_equity_symbols WHERE symbol = 'AMAGI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 130.45, 130.2, 0.25, 0.19, NULL, NULL, 143.65, 94.9, 30.53, 12.97
FROM km_equity_symbols WHERE symbol = 'AMBANIORGO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 7750.0, 7820.5, 7660.0, 7715.0, 7784.5, -69.5, -0.89, 351861, 271.86, 8626.0, 5235.0, 25.54, 25.58
FROM km_equity_symbols WHERE symbol = 'AMBER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 31.0, 31.0, 29.05, 29.5, 32.5, -3.0, -9.23, 46000, 0.14, 56.55, 25.9, -19.73, -46.36
FROM km_equity_symbols WHERE symbol = 'AMBEY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 526.85, 530.5, 517.25, 518.75, 532.85, -14.1, -2.65, 1297366, 67.64, 624.95, 455.0, -3.52, 3.23
FROM km_equity_symbols WHERE symbol = 'AMBUJACEM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 308.7, 322.55, 308.7, 322.0, 307.2, 14.8, 4.82, 36000, 1.13, 385.0, 161.7, -8.38, NULL
FROM km_equity_symbols WHERE symbol = 'AMCL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 86.0, 86.5, -0.5, -0.58, NULL, NULL, 127.25, 86.0, -7.98, -13.5
FROM km_equity_symbols WHERE symbol = 'AMEYA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 72.9, 72.9, NULL, NULL, NULL, NULL, 98.5, 54.0, -0.95, -14.24
FROM km_equity_symbols WHERE symbol = 'AMIABLE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2986.7, 3007.8, 2928.1, 2980.0, 2986.7, -6.7, -0.22, 113747, 33.84, 3321.4, 1594.0, -5.46, 64.51
FROM km_equity_symbols WHERE symbol = 'ANANDRATHI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 544.0, 544.2, 529.7, 533.0, 548.85, -15.85, -2.89, 2090615, 112.06, 743.65, 376.15, -5.92, -10.81
FROM km_equity_symbols WHERE symbol = 'ANANTRAJ'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2709.0, 2733.4, 2669.8, 2685.0, 2752.0, -67.0, -2.43, 603593, 162.85, 3285.0, 1941.0, 10.07, 16.1
FROM km_equity_symbols WHERE symbol = 'ANGELONE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 390.0, 400.0, 390.0, 396.0, 395.0, 1.0, 0.25, 4400, 0.17, 497.0, 239.0, 4.21, 33.83
FROM km_equity_symbols WHERE symbol = 'ANLON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 190.25, 193.0, 185.0, 185.0, 192.15, -7.15, -3.72, 53500, 1.01, 340.0, 180.0, -4.37, -42.8
FROM km_equity_symbols WHERE symbol = 'ANNAPURNA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 850.0, 857.95, 821.25, 821.25, 842.85, -21.6, -2.56, 4000, 0.34, 1037.45, 261.75, -19.26, NULL
FROM km_equity_symbols WHERE symbol = 'ANONDITA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 691.0, 699.9, 684.35, 688.0, 703.4, -15.4, -2.19, 128807, 8.89, 873.5, 579.15, 9.27, NULL
FROM km_equity_symbols WHERE symbol = 'ANTHEM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2030.0, 2032.4, 1966.6, 1980.0, 2046.4, -66.4, -3.24, 19935, 3.96, 3633.05, 1700.0, -3.72, -29.59
FROM km_equity_symbols WHERE symbol = 'ANUP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1368.2, 1368.2, 1331.1, 1335.7, 1368.2, -32.5, -2.38, 183391, 24.65, 1407.0, 601.0, -0.15, 99.84
FROM km_equity_symbols WHERE symbol = 'ANURAS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 20.5, 21.0, 20.5, 21.0, 20.6, 0.4, 1.94, 10000, 0.02, 29.05, 19.45, 4.74, -1.87
FROM km_equity_symbols WHERE symbol = 'ANYA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 9400.0, 9550.0, 9325.5, 9420.0, 9525.5, -105.5, -1.11, 50466, 47.74, 9905.0, 4308.05, 23.11, 39.63
FROM km_equity_symbols WHERE symbol = 'APARINDS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 135.0, 135.0, 133.0, 135.0, 135.0, NULL, NULL, 3200, 0.04, 165.6, 73.0, 9.49, 1.96
FROM km_equity_symbols WHERE symbol = 'APEXECO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2272.4, 2272.8, 2237.8, 2249.7, 2272.9, -23.2, -1.02, 374996, 84.4, 2301.4, 1272.7, 18.08, 63.71
FROM km_equity_symbols WHERE symbol = 'APLAPOLLO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 791.0, 791.75, 765.0, 769.5, 789.9, -20.4, -2.58, 36351, 2.81, 1107.9, 725.2, -3.94, -6.81
FROM km_equity_symbols WHERE symbol = 'APLLTD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 7518.0, 7598.0, 7485.0, 7525.0, 7539.0, -14.0, -0.19, 431623, 326.3, 8099.5, 6001.0, 2.92, 18.09
FROM km_equity_symbols WHERE symbol = 'APOLLOHOSP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 498.75, 500.5, 488.0, 490.0, 498.75, -8.75, -1.75, 846798, 41.74, 540.5, 370.9, -5.86, 16.47
FROM km_equity_symbols WHERE symbol = 'APOLLOTYRE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 223.0, 226.35, 223.0, 223.25, 228.65, -5.4, -2.36, 5500, 0.12, 360.0, 86.5, -14.48, 84.5
FROM km_equity_symbols WHERE symbol = 'APRAMEYA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 363.85, 372.9, 357.0, 357.65, 373.15, -15.5, -4.15, 15250, 0.55, 654.0, 293.0, 8.01, -27.06
FROM km_equity_symbols WHERE symbol = 'APS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 251.1, 251.45, 245.55, 249.0, 252.05, -3.05, -1.21, 1391579, 34.71, 364.0, 245.55, -9.19, -19.0
FROM km_equity_symbols WHERE symbol = 'APTUS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1914.9, 1949.9, 1852.0, 1887.0, 1914.9, -27.9, -1.46, 9673, 1.83, 2247.0, 435.1, -3.47, 254.37
FROM km_equity_symbols WHERE symbol = 'AQYLON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 70.0, 73.9, 70.0, 72.65, 68.0, 4.65, 6.84, 8000, 0.06, 92.95, 63.0, 3.05, -1.82
FROM km_equity_symbols WHERE symbol = 'ARABIAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 51.7, 52.0, 49.0, 49.5, 51.4, -1.9, -3.7, 22000, 0.11, 145.0, 46.6, -23.85, NULL
FROM km_equity_symbols WHERE symbol = 'ARCIIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 860.05, 860.05, 835.1, 843.0, 861.45, -18.45, -2.14, 377640, 31.81, 1109.0, 810.1, -4.41, -14.26
FROM km_equity_symbols WHERE symbol = 'ARE&M'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 140.0, 140.0, 135.0, 135.0, 140.0, -5.0, -3.57, 17000, 0.23, 161.0, 70.8, -5.74, 31.81
FROM km_equity_symbols WHERE symbol = 'ARHAM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 440.0, 450.0, 440.0, 450.0, 450.0, NULL, NULL, 800, 0.04, 540.0, 200.0, -4.26, 104.55
FROM km_equity_symbols WHERE symbol = 'ARIHANTACA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 100.1, 102.8, 97.0, 101.2, 102.08, -0.88, -0.86, 1391192, 13.84, 208.5, 82.18, -10.28, NULL
FROM km_equity_symbols WHERE symbol = 'ARIS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 90.75, 90.75, 90.75, 90.75, 90.75, NULL, NULL, 800, 0.01, 148.0, 84.55, -21.73, -22.3
FROM km_equity_symbols WHERE symbol = 'ARISTO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 568.0, 568.05, 552.0, 553.05, 572.8, -19.75, -3.45, 229815, 12.85, 794.85, 431.0, -12.77, NULL
FROM km_equity_symbols WHERE symbol = 'ARSSBL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 20.3, 20.5, 20.1, 20.5, 20.45, 0.05, 0.24, 24000, 0.05, 46.5, 16.95, 7.67, NULL
FROM km_equity_symbols WHERE symbol = 'ARUNAYA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 360.0, 395.65, 354.6, 382.95, 366.15, 16.8, 4.59, 2178374, 83.11, 404.0, 274.8, 26.95, 15.45
FROM km_equity_symbols WHERE symbol = 'ARVIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 480.5, 492.3, 474.0, 483.15, 483.85, -0.7, -0.14, 163512, 7.93, 579.0, 320.2, 2.79, 14.67
FROM km_equity_symbols WHERE symbol = 'ARVINDFASN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 31.0, 31.0, 29.75, 29.75, 31.3, -1.55, -4.95, 42000, 0.13, 87.4, 28.95, -21.4, -52.02
FROM km_equity_symbols WHERE symbol = 'ARVINDPORT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 962.0, 964.5, 950.0, 958.9, 972.9, -14.0, -1.44, 28494, 2.73, 1074.0, 576.8, -0.02, 49.5
FROM km_equity_symbols WHERE symbol = 'ASAHIINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 171.0, 171.0, 171.0, 171.0, 180.0, -9.0, -5.0, 5000, 0.09, 180.0, 76.55, 19.16, 48.44
FROM km_equity_symbols WHERE symbol = 'ASCOM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 64.6, 65.0, 64.6, 65.0, 64.65, 0.35, 0.54, 3000, 0.02, 92.6, 60.0, -6.88, -28.3
FROM km_equity_symbols WHERE symbol = 'ASHALOG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 155.9, 155.9, 150.44, 151.58, 158.2, -6.62, -4.18, 946940, 14.42, 235.9, 139.52, 0.56, -31.61
FROM km_equity_symbols WHERE symbol = 'ASHOKA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 210.12, 212.87, 203.8, 204.7, 211.02, -6.32, -2.99, 26832686, 554.71, 215.42, 95.93, 10.23, 88.59
FROM km_equity_symbols WHERE symbol = 'ASHOKLEY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2408.9, 2411.8, 2360.1, 2368.2, 2410.5, -42.3, -1.75, 675635, 160.83, 2985.7, 2124.75, -17.95, 5.89
FROM km_equity_symbols WHERE symbol = 'ASIANPAINT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 434.0, 437.0, 422.5, 426.0, 440.65, -14.65, -3.32, 185461, 7.94, 578.5, 333.3, -8.52, 0.48
FROM km_equity_symbols WHERE symbol = 'ASKAUTOLTD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 116.1, 116.1, NULL, NULL, NULL, NULL, 118.6, 29.0, NULL, 83.78
FROM km_equity_symbols WHERE symbol = 'ASLIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 16.25, 16.25, NULL, NULL, NULL, NULL, 40.0, 14.4, -0.31, -46.1
FROM km_equity_symbols WHERE symbol = 'ASPIRE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 602.15, 607.25, 591.55, 600.1, 602.85, -2.75, -0.46, 578731, 34.69, 732.2, 387.1, -1.01, 39.33
FROM km_equity_symbols WHERE symbol = 'ASTERDM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1589.0, 1604.6, 1559.5, 1601.0, 1591.6, 9.4, 0.59, 585825, 93.01, 1615.5, 1232.3, 11.3, 16.8
FROM km_equity_symbols WHERE symbol = 'ASTRAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 895.4, 943.9, 885.5, 896.9, 907.5, -10.6, -1.17, 413112, 37.89, 1195.9, 584.2, -9.05, 36.56
FROM km_equity_symbols WHERE symbol = 'ASTRAMICRO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 8829.5, 9000.0, 8641.0, 8865.0, 8824.0, 41.0, 0.46, 9284, 8.16, 10691.0, 6620.1, 7.76, 19.88
FROM km_equity_symbols WHERE symbol = 'ASTRAZEN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 32.0, 32.0, 30.65, 30.65, 31.8, -1.15, -3.62, 3600, 0.01, 115.35, 27.0, -9.85, NULL
FROM km_equity_symbols WHERE symbol = 'ATCENERGY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 533.0, 533.5, 518.05, 520.2, 535.95, -15.75, -2.94, 473476, 24.7, 798.0, 507.05, -6.35, -12.89
FROM km_equity_symbols WHERE symbol = 'ATGL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 715.25, 717.05, 691.25, 709.0, 725.75, -16.75, -2.31, 1945549, 136.36, 790.0, 288.15, 8.52, NULL
FROM km_equity_symbols WHERE symbol = 'ATHERENERG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 886.0, 889.25, 864.35, 865.0, 897.15, -32.15, -3.58, 60733, 5.32, 1097.85, 707.6, 5.55, NULL
FROM km_equity_symbols WHERE symbol = 'ATLANTAELE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 139.0, 140.25, 135.9, 140.25, 137.95, 2.3, 1.67, 18000, 0.25, 269.25, 109.0, -5.03, -45.07
FROM km_equity_symbols WHERE symbol = 'ATMASTCO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 6600.5, 6666.0, 6492.0, 6550.0, 6628.5, -78.5, -1.18, 14694, 9.71, 7788.0, 4752.0, 6.72, 17.16
FROM km_equity_symbols WHERE symbol = 'ATUL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 998.1, 1004.6, 984.65, 993.5, 1000.6, -7.1, -0.71, 1802819, 179.57, 1029.95, 478.35, 2.22, 79.64
FROM km_equity_symbols WHERE symbol = 'AUBANK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 962.0, 962.0, 922.95, 931.0, 966.8, -35.8, -3.7, 138698, 12.93, 1665.9, 881.7, -9.62, -33.47
FROM km_equity_symbols WHERE symbol = 'AURIONPRO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 32.3, 32.3, 32.3, 32.3, 34.0, -1.7, -5.0, 1600, 0.01, 63.5, 28.0, -9.14, -48.28
FROM km_equity_symbols WHERE symbol = 'AUROIMPEX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1149.1, 1157.4, 1126.8, 1157.0, 1157.9, -0.9, -0.08, 1682470, 192.66, 1278.6, 1010.0, -0.92, -1.94
FROM km_equity_symbols WHERE symbol = 'AUROPHARMA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 23.5, 23.5, 23.5, 23.5, 23.5, NULL, NULL, 2000, NULL, 48.3, 21.35, -2.89, -46.35
FROM km_equity_symbols WHERE symbol = 'AUSL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1060.0, 1082.65, 1045.0, 1045.5, 1078.75, -33.25, -3.08, 140937, 15.0, 1318.0, 603.0, 17.43, 56.13
FROM km_equity_symbols WHERE symbol = 'AVALON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1403.95, 1489.0, 1330.05, 1406.0, 1414.75, -8.75, -0.62, 10797866, 1535.47, 1489.0, 601.55, 72.87, 101.02
FROM km_equity_symbols WHERE symbol = 'AVANTIFEED'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 116.5, 116.5, 113.0, 113.0, 116.25, -3.25, -2.8, 7000, 0.08, 123.5, 93.8, -6.61, 9.44
FROM km_equity_symbols WHERE symbol = 'AVIANSH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 123.0, 123.0, 116.5, 118.0, 119.35, -1.35, -1.13, 16000, 0.19, 218.0, 83.0, 8.86, -55.35
FROM km_equity_symbols WHERE symbol = 'AVPINFRA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 359.9, 359.95, 320.7, 323.8, 359.65, -35.85, -9.97, 976405, 32.4, 718.95, 320.7, -29.72, -51.41
FROM km_equity_symbols WHERE symbol = 'AWFIS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 205.0, 205.45, 200.2, 201.19, 206.3, -5.11, -2.48, 1524928, 30.78, 291.2, 200.2, -8.46, -17.61
FROM km_equity_symbols WHERE symbol = 'AWL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1341.3, 1346.5, 1316.1, 1330.8, 1340.0, -9.2, -0.69, 4624549, 615.54, 1418.3, 978.05, 5.45, 32.0
FROM km_equity_symbols WHERE symbol = 'AXISBANK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1608.0, 1608.6, 1560.5, 1586.0, 1610.8, -24.8, -1.54, 117179, 18.57, 1899.0, 1159.45, 1.41, 11.48
FROM km_equity_symbols WHERE symbol = 'AZAD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 25.0, 25.25, 25.0, 25.25, 26.0, -0.75, -2.88, 3200, 0.01, 54.95, 24.3, -18.02, -50.73
FROM km_equity_symbols WHERE symbol = 'BABAFP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 112.0, 112.0, 110.1, 110.1, 114.55, -4.45, -3.88, 11200, 0.12, 139.0, 95.75, -6.22, NULL
FROM km_equity_symbols WHERE symbol = 'BAGDIGITAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 5.95, 5.95, 5.65, 5.76, 5.83, -0.07, -1.2, 51871, 0.03, 8.0, 5.2, -5.73, -25.19
FROM km_equity_symbols WHERE symbol = 'BAGFILMS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 595.95, 608.9, 595.0, 606.0, 595.0, 11.0, 1.85, 25125, 1.51, 649.9, 390.65, 2.78, 22.82
FROM km_equity_symbols WHERE symbol = 'BAHETI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 9800.5, 9900.5, 9720.0, 9748.0, 9840.0, -92.0, -0.93, 120688, 118.33, 9941.0, 7089.35, 2.03, 12.16
FROM km_equity_symbols WHERE symbol = 'BAJAJ-AUTO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 384.4, 384.4, 375.0, 376.65, 384.4, -7.75, -2.02, 268050, 10.13, 749.0, 375.0, -13.64, -46.03
FROM km_equity_symbols WHERE symbol = 'BAJAJELEC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2035.0, 2035.0, 2012.7, 2027.0, 2037.1, -10.1, -0.5, 756233, 153.02, 2195.0, 1727.25, 0.79, 9.61
FROM km_equity_symbols WHERE symbol = 'BAJAJFINSV'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 89.8, 89.84, 88.9, 89.39, 90.39, -1.0, -1.11, 3884937, 34.7, 136.96, 87.11, -5.14, -20.51
FROM km_equity_symbols WHERE symbol = 'BAJAJHFL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 11040.0, 11040.0, 10821.0, 10888.0, 11040.0, -152.0, -1.38, 32683, 35.57, 14763.0, 10400.0, 1.48, -10.33
FROM km_equity_symbols WHERE symbol = 'BAJAJHLDNG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 995.0, 1032.0, 992.8, 1030.0, 999.1, 30.9, 3.09, 21613987, 2195.18, 1102.5, 802.5, 8.54, 22.49
FROM km_equity_symbols WHERE symbol = 'BAJFINANCE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 139.0, 139.0, 135.0, 135.0, 138.75, -3.75, -2.7, 8000, 0.11, 184.7, 72.6, -2.7, NULL
FROM km_equity_symbols WHERE symbol = 'BALAJIPHOS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 92.94, 92.94, 89.0, 89.35, 93.02, -3.67, -3.95, 373333, 3.41, 141.32, 49.02, -15.63, 33.72
FROM km_equity_symbols WHERE symbol = 'BALAJITELE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1093.9, 1093.9, 1064.0, 1078.0, 1105.2, -27.2, -2.46, 78542, 8.47, 1945.0, 1060.1, -12.06, -28.9
FROM km_equity_symbols WHERE symbol = 'BALAMINES'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 23.5, 23.5, 23.5, 23.5, 23.5, NULL, NULL, 2400, 0.01, 43.0, 23.1, -5.62, -39.2
FROM km_equity_symbols WHERE symbol = 'BALCO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2641.3, 2641.3, 2571.1, 2600.2, 2641.3, -41.1, -1.56, 200893, 52.36, 2817.5, 2152.05, 8.53, -1.18
FROM km_equity_symbols WHERE symbol = 'BALKRISIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 459.0, 470.45, 454.5, 465.45, 460.45, 5.0, 1.09, 433218, 20.11, 627.8, 393.55, 9.41, 6.49
FROM km_equity_symbols WHERE symbol = 'BALRAMCHIN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 503.0, 509.4, 486.75, 501.0, 503.0, -2.0, -0.4, 1051131, 52.56, 784.0, 341.05, 7.8, -15.19
FROM km_equity_symbols WHERE symbol = 'BALUFORGE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 687.15, 687.65, 656.7, 657.3, 690.9, -33.6, -4.86, 418431, 28.09, 879.8, 297.5, 1.3, 85.57
FROM km_equity_symbols WHERE symbol = 'BANCOINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 168.1, 170.03, 164.5, 164.85, 169.54, -4.69, -2.77, 4430723, 73.85, 192.48, 128.16, 14.98, 17.51
FROM km_equity_symbols WHERE symbol = 'BANDHANBNK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 287.3, 288.0, 284.6, 287.1, 289.85, -2.75, -0.95, 6295039, 180.34, 313.35, 190.7, -4.89, 36.2
FROM km_equity_symbols WHERE symbol = 'BANKBARODA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 164.1, 164.45, 161.26, 161.69, 165.28, -3.59, -2.17, 8120034, 131.84, 170.5, 92.66, 9.58, 59.93
FROM km_equity_symbols WHERE symbol = 'BANKINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 63.1, 63.1, 63.1, 63.1, 63.15, -0.05, -0.08, 4000, 0.03, 82.4, 41.15, -11.75, 19.28
FROM km_equity_symbols WHERE symbol = 'BARFLEX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3705.0, 3785.0, 3633.7, 3646.0, 3769.1, -123.1, -3.27, 51319, 18.99, 5424.0, 3524.9, 0.8, -14.15
FROM km_equity_symbols WHERE symbol = 'BASF'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 275.0, 287.5, 273.05, 281.0, 280.3, 0.7, 0.25, 18600, 0.52, 509.8, 223.15, 0.11, 14.18
FROM km_equity_symbols WHERE symbol = 'BASILIC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 867.9, 880.7, 840.2, 846.0, 883.85, -37.85, -4.28, 154948, 13.35, 1378.95, 838.95, -6.82, -36.57
FROM km_equity_symbols WHERE symbol = 'BATAINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 33.25, 33.25, 31.1, 31.1, 32.8, -1.7, -5.18, 3200, 0.01, 75.7, 27.35, -24.42, -52.88
FROM km_equity_symbols WHERE symbol = 'BAWEJA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 4808.7, 4808.7, 4715.8, 4795.0, 4832.9, -37.9, -0.78, 21617, 10.32, 6511.0, 4217.45, 8.29, 9.75
FROM km_equity_symbols WHERE symbol = 'BAYERCROP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2500.1, 2546.1, 2483.4, 2519.5, 2515.7, 3.8, 0.15, 15961, 4.01, 3475.0, 2350.0, -9.67, -17.5
FROM km_equity_symbols WHERE symbol = 'BBL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1805.0, 1812.2, 1772.5, 1795.0, 1813.0, -18.0, -0.99, 24420, 4.37, 2155.0, 1607.05, -1.19, -7.85
FROM km_equity_symbols WHERE symbol = 'BBTC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1267.6, 1267.9, 1240.0, 1240.6, 1271.6, -31.0, -2.44, 1058754, 132.35, 2096.6, 907.0, -18.52, 6.33
FROM km_equity_symbols WHERE symbol = 'BDL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 88.0, 88.0, 85.0, 85.4, 89.3, -3.9, -4.37, 15000, 0.13, 102.5, 50.0, -0.52, -4.73
FROM km_equity_symbols WHERE symbol = 'BEACON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 210.8, 215.3, 208.7, 212.55, 212.64, -0.09, -0.04, 389463, 8.27, 330.8, 208.67, -8.08, -24.52
FROM km_equity_symbols WHERE symbol = 'BECTORFOOD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 443.9, 446.2, 432.8, 435.0, 443.9, -8.9, -2.0, 14086068, 621.07, 461.65, 240.25, 5.15, 66.32
FROM km_equity_symbols WHERE symbol = 'BEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 186.0, 191.39, 184.55, 186.01, 188.27, -2.26, -1.2, 5220884, 97.95, 193.74, 89.15, 5.85, NULL
FROM km_equity_symbols WHERE symbol = 'BELRISE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1731.1, 1748.9, 1700.6, 1731.0, 1740.4, -6.9, -0.4, 171064, 29.6, 2437.4, 1175.0, -2.2, 17.78
FROM km_equity_symbols WHERE symbol = 'BEML'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 460.0, 464.2, 452.5, 460.5, 460.75, -0.25, -0.05, 309257, 14.21, 605.0, 448.75, -11.57, -5.1
FROM km_equity_symbols WHERE symbol = 'BERGEPAINT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 101.0, 104.75, 99.0, 104.5, 102.0, 2.5, 2.45, 18500, 0.19, 239.8, 90.0, -4.78, -39.1
FROM km_equity_symbols WHERE symbol = 'BEWLTD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 74.9, 74.9, 74.9, 74.9, 71.2, 3.7, 5.2, 4800, 0.04, 128.85, 60.0, 7.0, NULL
FROM km_equity_symbols WHERE symbol = 'BHADORA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 35.49, 35.74, 35.1, 35.35, 36.03, -0.68, -1.89, 11926406, 42.28, 45.09, 35.09, NULL, NULL
FROM km_equity_symbols WHERE symbol = 'BHARATCOAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1756.9, 1784.2, 1725.9, 1735.1, 1726.7, 8.4, 0.49, 4313855, 758.01, 1784.2, 919.1, 18.82, 61.22
FROM km_equity_symbols WHERE symbol = 'BHARATFORG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2013.9, 2024.2, 1992.0, 1993.0, 2014.5, -21.5, -1.07, 4808543, 966.46, 2174.5, 1559.5, -1.67, 16.24
FROM km_equity_symbols WHERE symbol = 'BHARTIARTL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1680.2, 1683.0, 1661.1, 1661.1, 1681.9, -20.8, -1.24, 46525, 7.77, 2052.9, 1234.0, -1.13, 21.63
FROM km_equity_symbols WHERE symbol = 'BHARTIHEXA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 257.0, 262.2, 254.7, 255.3, 260.6, -5.3, -2.03, 27784730, 716.46, 305.9, 176.0, -3.86, 26.5
FROM km_equity_symbols WHERE symbol = 'BHEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 651.0, 654.35, 636.85, 638.0, 654.3, -16.3, -2.49, 109313, 7.02, 818.7, 558.8, -9.05, 6.81
FROM km_equity_symbols WHERE symbol = 'BIKAJI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 19.7, 20.2, 19.7, 20.2, 19.25, 0.95, 4.94, 24000, 0.05, 24.45, 13.65, -1.46, -7.76
FROM km_equity_symbols WHERE symbol = 'BIKEWO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 374.0, 381.9, 368.3, 378.1, 375.05, 3.05, 0.81, 5387172, 203.48, 424.95, 291.0, 0.21, 5.23
FROM km_equity_symbols WHERE symbol = 'BIOCON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 118.0, 118.0, NULL, NULL, NULL, NULL, 154.0, 82.3, -1.87, 31.48
FROM km_equity_symbols WHERE symbol = 'BIRDYS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1074.9, 1074.9, 1040.7, 1045.5, 1075.0, -29.5, -2.74, 26895, 2.84, 1535.3, 910.25, -0.82, 1.8
FROM km_equity_symbols WHERE symbol = 'BIRLACORPN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 635.0, 640.4, 623.05, 629.95, 636.0, -6.05, -0.95, 478144, 30.29, 748.0, 373.2, -4.23, 34.05
FROM km_equity_symbols WHERE symbol = 'BLACKBUCK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 279.5, 279.5, 267.7, 269.05, 280.45, -9.4, -3.38, 1252022, 34.07, 428.6, 245.95, -9.52, -31.91
FROM km_equity_symbols WHERE symbol = 'BLS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 5746.5, 5821.0, 5715.0, 5815.0, 5833.5, -18.5, -0.32, 11484, 6.63, 7225.0, 5190.5, 7.58, -4.07
FROM km_equity_symbols WHERE symbol = 'BLUEDART'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 441.35, 443.35, 397.3, 397.3, 441.4, -44.1, -9.99, 1493591, 61.52, 1027.8, 392.0, -20.44, -47.81
FROM km_equity_symbols WHERE symbol = 'BLUEJET'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 156.5, 158.0, 153.0, 153.0, 153.0, NULL, NULL, 9200, 0.14, 317.0, 88.0, 24.29, -43.05
FROM km_equity_symbols WHERE symbol = 'BLUEPEBBLE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1960.0, 2015.0, 1952.3, 1991.0, 1974.0, 17.0, 0.86, 618695, 123.37, 2269.8, 1521.0, 11.03, -0.19
FROM km_equity_symbols WHERE symbol = 'BLUESTARCO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 445.9, 452.55, 431.2, 435.6, 450.7, -15.1, -3.35, 759512, 33.96, 793.0, 411.85, -8.44, NULL
FROM km_equity_symbols WHERE symbol = 'BLUESTONE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 150.0, 150.0, 138.95, 149.85, 149.95, -0.1, -0.07, 24000, 0.35, 187.2, 125.4, 5.49, NULL
FROM km_equity_symbols WHERE symbol = 'BLUEWATER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 38.8, 39.15, 38.6, 39.15, 38.3, 0.85, 2.22, 3200, 0.01, 63.2, 35.35, -2.75, -30.31
FROM km_equity_symbols WHERE symbol = 'BMETRICS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 57.25, 58.33, 56.6, 58.2, 57.57, 0.63, 1.09, 107765, 0.62, 78.0, 50.02, 14.7, NULL
FROM km_equity_symbols WHERE symbol = 'BMWVENTLTD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 502.1, 504.0, 494.0, 496.9, 505.8, -8.9, -1.76, 132229, 6.57, 721.0, 441.45, 0.73, -1.31
FROM km_equity_symbols WHERE symbol = 'BORORENEW'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1358.8, 1414.8, 1352.1, 1414.0, 1381.9, 32.1, 2.32, 7314, 1.02, 1893.0, 1270.0, -1.37, -16.27
FROM km_equity_symbols WHERE symbol = 'BOSCH-HCIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 36415.0, 36420.0, 35600.0, 35700.0, 36495.0, -795.0, -2.18, 13848, 49.73, 41945.0, 25921.6, -5.82, 30.53
FROM km_equity_symbols WHERE symbol = 'BOSCHLTD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 39.9, 39.9, 39.9, 39.9, 38.1, 1.8, 4.72, 2000, 0.01, 56.3, 35.75, -4.43, -15.47
FROM km_equity_symbols WHERE symbol = 'BOSS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 377.45, 378.4, 372.95, 374.3, 377.7, -3.4, -0.9, 2696607, 101.14, 391.65, 234.01, 5.41, 46.35
FROM km_equity_symbols WHERE symbol = 'BPCL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 82.9, 82.25, 0.65, 0.79, NULL, NULL, 111.0, 69.0, -0.9, 1.73
FROM km_equity_symbols WHERE symbol = 'BRACEPORT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 787.1, 792.55, 757.0, 762.75, 796.55, -33.8, -4.24, 233611, 17.99, 1332.0, 717.75, -10.89, -25.67
FROM km_equity_symbols WHERE symbol = 'BRIGADE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 62.25, 62.25, 60.99, 61.2, 62.29, -1.09, -1.75, 111659, 0.69, 91.77, 58.02, -8.18, NULL
FROM km_equity_symbols WHERE symbol = 'BRIGHOTEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 6080.0, 6098.5, 5968.0, 5971.0, 6102.0, -131.0, -2.15, 159821, 96.04, 6336.0, 4506.0, 0.9, 22.14
FROM km_equity_symbols WHERE symbol = 'BRITANNIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3100.0, 3127.0, 3017.9, 3023.9, 3143.2, -119.3, -3.8, 3885000, 1184.59, 3227.0, 1227.33, 6.78, 72.61
FROM km_equity_symbols WHERE symbol = 'BSE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 412.65, 416.3, 374.0, 398.75, 433.85, -35.1, -8.09, 11659525, 462.14, 516.7, 331.0, -6.2, -21.17
FROM km_equity_symbols WHERE symbol = 'BSOFT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 7.8, 8.5, 7.57, 8.08, 7.54, 0.54, 7.16, 594372, 0.48, 10.5, 7.11, 1.76, -10.52
FROM km_equity_symbols WHERE symbol = 'BTML'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 50.85, 55.65, 50.85, 55.6, 53.45, 2.15, 4.02, 7200, 0.04, 94.6, 50.55, -11.54, -20.8
FROM km_equity_symbols WHERE symbol = 'BULKCORP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 381.6, 384.35, 374.0, 381.15, 387.9, -6.75, -1.74, 27150, 1.03, 888.0, 250.15, -14.44, -39.18
FROM km_equity_symbols WHERE symbol = 'C2C'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 49.2, 49.2, NULL, NULL, NULL, NULL, 99.9, 35.6, 6.61, -43.02
FROM km_equity_symbols WHERE symbol = 'CADSYS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 271.0, 275.45, 271.0, 271.45, 276.15, -4.7, -1.7, 198732, 5.42, 304.4, 210.0, 7.21, -6.65
FROM km_equity_symbols WHERE symbol = 'CAMPUS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 726.0, 728.8, 715.0, 720.1, 730.4, -10.3, -1.41, 487002, 35.12, 875.0, 606.21, 1.28, 5.58
FROM km_equity_symbols WHERE symbol = 'CAMS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 28.0, 28.0, 27.15, 27.35, 28.65, -1.3, -4.54, 48000, 0.13, 36.9, 23.5, -3.19, -9.44
FROM km_equity_symbols WHERE symbol = 'CANARYS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 143.8, 143.8, 141.42, 141.65, 144.81, -3.16, -2.18, 14139257, 201.06, 160.79, 78.6, -6.1, 59.66
FROM km_equity_symbols WHERE symbol = 'CANBK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 884.8, 891.0, 859.45, 891.0, 888.4, 2.6, 0.29, 240309, 20.97, 971.5, 558.5, -0.34, 45.73
FROM km_equity_symbols WHERE symbol = 'CANFINHOME'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 147.25, 153.72, 146.19, 151.5, 147.09, 4.41, 3.0, 1626233, 24.54, 157.8, 106.0, 6.97, NULL
FROM km_equity_symbols WHERE symbol = 'CANHLIFE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 552.0, 556.45, 511.95, 513.9, 562.15, -48.25, -8.58, 219802, 11.69, 798.95, 511.95, -23.33, NULL
FROM km_equity_symbols WHERE symbol = 'CAPILLARY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1729.8, 1737.7, 1708.2, 1725.0, 1736.8, -11.8, -0.68, 38711, 6.67, 2395.0, 1599.0, -4.81, -14.48
FROM km_equity_symbols WHERE symbol = 'CAPLIPOINT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 830.0, 842.45, 820.35, 824.7, 835.75, -11.05, -1.32, 166861, 13.89, 1128.05, 748.5, 1.76, -19.76
FROM km_equity_symbols WHERE symbol = 'CARBORUNIV'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2120.0, 2120.9, 1920.1, 1929.5, 2128.6, -199.1, -9.35, 1079293, 213.28, 3290.5, 1362.5, -31.1, 25.7
FROM km_equity_symbols WHERE symbol = 'CARTRADE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 186.01, 186.99, 185.0, 185.29, 186.71, -1.42, -0.76, 1622832, 30.13, 251.95, 180.66, -1.16, -10.41
FROM km_equity_symbols WHERE symbol = 'CASTROLIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 4.5, 4.5, NULL, NULL, NULL, NULL, 8.0, 3.05, NULL, NULL
FROM km_equity_symbols WHERE symbol = 'CBAZAAR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 18.38, 19.4, 17.85, 18.8, 18.59, 0.21, 1.13, 25003866, 46.73, 23.64, 14.75, 22.24, -7.53
FROM km_equity_symbols WHERE symbol = 'CCAVENUE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 988.0, 1017.8, 970.6, 992.0, 994.15, -2.15, -0.22, 119824, 11.94, 1074.4, 525.0, 2.57, 66.44
FROM km_equity_symbols WHERE symbol = 'CCL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1350.0, 1359.0, 1321.1, 1335.6, 1370.2, -34.6, -2.53, 1663043, 222.32, 1828.9, 1047.45, -5.94, 8.85
FROM km_equity_symbols WHERE symbol = 'CDSL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3987.0, 4044.2, 3917.6, 3957.7, 3988.0, -30.3, -0.76, 217124, 86.96, 4438.0, 2343.05, 2.74, 50.09
FROM km_equity_symbols WHERE symbol = 'CEATLTD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 40.0, 42.3, 34.7, 37.45, 38.55, -1.1, -2.85, 37000, 0.14, 136.3, 34.7, -28.56, NULL
FROM km_equity_symbols WHERE symbol = 'CEDAAR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 299.0, 299.0, 288.5, 288.5, 299.3, -10.8, -3.61, 160031, 4.68, 307.9, 222.61, 4.53, 2.14
FROM km_equity_symbols WHERE symbol = 'CEIGALL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 27.15, 27.45, 26.75, 26.95, 27.4, -0.45, -1.64, 249000, 0.67, 68.8, 25.75, -0.74, -52.76
FROM km_equity_symbols WHERE symbol = 'CELLECOR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 507.5, 513.3, 502.05, 507.45, 507.65, -0.2, -0.04, 39287, 2.0, 673.8, 490.0, 0.75, -17.76
FROM km_equity_symbols WHERE symbol = 'CELLO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 15.4, 15.7, 15.4, 15.7, 15.75, -0.05, -0.32, 3600, 0.01, 22.9, 15.05, -4.85, -29.44
FROM km_equity_symbols WHERE symbol = 'CELLPOINT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 613.0, 620.25, 601.0, 601.75, 619.95, -18.2, -2.94, 274547, 16.72, 944.0, 476.6, -12.17, 14.58
FROM km_equity_symbols WHERE symbol = 'CEMPRO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 37.23, 37.23, 36.76, 36.9, 37.43, -0.53, -1.42, 4146211, 15.32, 49.42, 32.75, -2.15, -24.2
FROM km_equity_symbols WHERE symbol = 'CENTRALBK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 775.0, 780.0, 761.9, 780.0, 777.5, 2.5, 0.32, 28129, 2.17, 859.0, 650.0, 1.9, 0.83
FROM km_equity_symbols WHERE symbol = 'CENTURYPLY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 5170.0, 5182.9, 5097.0, 5102.0, 5191.5, -89.5, -1.72, 7443, 3.83, 7275.0, 4796.5, 0.54, -17.61
FROM km_equity_symbols WHERE symbol = 'CERA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 152.8, 154.06, 149.52, 150.34, 154.06, -3.72, -2.41, 1903977, 28.72, 185.26, 119.0, -6.1, 19.39
FROM km_equity_symbols WHERE symbol = 'CESC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 178.51, 178.51, 174.49, 177.35, 179.3, -1.95, -1.09, 399020, 7.03, 231.35, 150.51, -1.61, 6.88
FROM km_equity_symbols WHERE symbol = 'CGCL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 680.0, 684.5, 671.4, 680.0, 685.1, -5.1, -0.74, 1143123, 77.62, 797.55, 517.7, 16.92, 17.34
FROM km_equity_symbols WHERE symbol = 'CGPOWER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 160.0, 161.6, 160.0, 160.0, 159.55, 0.45, 0.28, 25600, 0.41, 259.0, 134.4, -8.57, -8.31
FROM km_equity_symbols WHERE symbol = 'CGRAPHICS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 877.0, 877.0, 851.3, 860.0, 877.1, -17.1, -1.95, 65289, 5.6, 1082.0, 634.05, -1.66, 27.46
FROM km_equity_symbols WHERE symbol = 'CHALET'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 457.0, 457.75, 449.2, 457.15, 460.0, -2.85, -0.62, 643526, 29.19, 742.2, 410.2, 3.18, -14.59
FROM km_equity_symbols WHERE symbol = 'CHAMBLFERT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 45.0, 45.0, NULL, NULL, NULL, NULL, 66.35, 36.1, -6.25, -29.25
FROM km_equity_symbols WHERE symbol = 'CHAMUNDA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 300.0, 300.0, 283.0, 283.85, 295.75, -11.9, -4.02, 64000, 1.87, 358.0, 140.0, -3.67, NULL
FROM km_equity_symbols WHERE symbol = 'CHANDAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 108.0, 111.1, 108.0, 109.0, 106.4, 2.6, 2.44, 10000, 0.11, 169.8, 82.1, -6.12, -33.92
FROM km_equity_symbols WHERE symbol = 'CHAVDA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 896.9, 897.0, 864.75, 876.6, 897.6, -21.0, -2.34, 717225, 63.22, 1103.0, 433.1, 6.65, 74.71
FROM km_equity_symbols WHERE symbol = 'CHENNPETRO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 48.6, 48.6, 48.6, 48.6, 48.7, -0.1, -0.21, 1600, 0.01, 129.0, 36.0, -7.25, -48.76
FROM km_equity_symbols WHERE symbol = 'CHETANA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 766.0, 771.0, 751.05, 752.0, 766.65, -14.65, -1.91, 213399, 16.13, 860.5, 438.45, -7.29, 50.73
FROM km_equity_symbols WHERE symbol = 'CHOICEIN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1727.3, 1731.0, 1703.0, 1706.7, 1731.8, -25.1, -1.45, 1544271, 264.01, 1831.5, 1302.0, 0.33, 22.71
FROM km_equity_symbols WHERE symbol = 'CHOLAFIN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1754.0, 1754.8, 1702.2, 1721.0, 1758.9, -37.9, -2.15, 134512, 23.11, 2231.6, 1357.35, -5.46, 13.81
FROM km_equity_symbols WHERE symbol = 'CHOLAHLDNG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 450.0, 463.95, 444.7, 456.0, 449.8, 6.2, 1.38, 309188, 14.13, 487.0, 356.75, 12.12, 6.83
FROM km_equity_symbols WHERE symbol = 'CIEINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1355.0, 1368.0, 1310.2, 1338.6, 1390.3, -51.7, -3.72, 160450, 21.39, 1929.5, 1033.25, -20.51, -5.28
FROM km_equity_symbols WHERE symbol = 'CIGNITITEC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 88.0, 88.0, 85.0, 85.65, 87.25, -1.6, -1.83, 5213, 0.04, 104.99, 73.64, 2.7, -8.47
FROM km_equity_symbols WHERE symbol = 'CINELINE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 16.14, 16.14, 15.22, 15.55, 15.67, -0.12, -0.77, 8285, 0.01, 24.88, 13.21, -7.99, 0.32
FROM km_equity_symbols WHERE symbol = 'CINEVISTA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1328.0, 1336.1, 1315.8, 1331.7, 1330.0, 1.7, 0.13, 1236946, 164.25, 1673.0, 1281.7, -8.05, -9.54
FROM km_equity_symbols WHERE symbol = 'CIPLA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 50.65, 50.65, 46.75, 49.35, 52.1, -2.75, -5.28, 72000, 0.35, 113.9, 46.75, -24.6, NULL
FROM km_equity_symbols WHERE symbol = 'CLASSICEIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 770.0, 770.0, 744.5, 755.25, 773.05, -17.8, -2.3, 403792, 30.41, 1600.0, 744.5, -11.7, -42.79
FROM km_equity_symbols WHERE symbol = 'CLEAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 47.0, 47.0, 47.0, 47.0, 47.0, NULL, NULL, 2000, 0.01, 62.8, 42.25, -6.0, -2.08
FROM km_equity_symbols WHERE symbol = 'CLSL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 113.85, 113.85, NULL, NULL, NULL, NULL, 183.9, 98.1, -2.27, -16.29
FROM km_equity_symbols WHERE symbol = 'CMNL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 68.4, 68.4, 68.4, 68.4, 68.5, -0.1, -0.15, 800, 0.01, 96.75, 64.0, -8.62, -17.79
FROM km_equity_symbols WHERE symbol = 'CMRSL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 310.0, 328.85, 302.45, 319.9, 314.7, 5.2, 1.65, 1337779, 42.49, 541.15, 302.45, -4.32, -26.72
FROM km_equity_symbols WHERE symbol = 'CMSINFO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 412.3, 417.6, 408.1, 409.3, 419.15, -9.85, -2.35, 8190851, 336.5, 461.55, 349.25, -4.57, 13.18
FROM km_equity_symbols WHERE symbol = 'COALINDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1500.4, 1500.4, 1462.7, 1474.0, 1500.4, -26.4, -1.76, 424397, 62.61, 2545.0, 1180.2, -4.74, 13.41
FROM km_equity_symbols WHERE symbol = 'COCHINSHIP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1359.4, 1392.5, 1334.0, 1358.9, 1421.5, -62.6, -4.4, 12847607, 1747.03, 1994.0, 1194.01, -20.46, -13.73
FROM km_equity_symbols WHERE symbol = 'COFORGE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 320.5, 341.0, 311.15, 311.95, 350.75, -38.8, -11.06, 4218793, 136.73, 1328.0, 311.15, -30.36, -72.15
FROM km_equity_symbols WHERE symbol = 'COHANCE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2128.0, 2130.0, 2100.5, 2115.4, 2138.9, -23.5, -1.1, 374088, 79.29, 2747.4, 2029.4, 0.41, -14.54
FROM km_equity_symbols WHERE symbol = 'COLPAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 201.5, 201.5, 191.85, 191.85, 201.9, -10.05, -4.98, 4000, 0.08, 274.05, 174.25, -4.03, 39.73
FROM km_equity_symbols WHERE symbol = 'COMMITTED'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 503.0, 503.9, 497.0, 497.5, 506.85, -9.35, -1.84, 588653, 29.44, 652.04, 472.75, -3.86, -10.46
FROM km_equity_symbols WHERE symbol = 'CONCOR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1222.4, 1226.6, 1175.0, 1183.5, 1228.9, -45.4, -3.69, 108568, 12.91, 2184.9, 1100.0, -12.47, -43.96
FROM km_equity_symbols WHERE symbol = 'CONCORDBIO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 255.0, 258.6, 249.0, 258.6, 259.35, -0.75, -0.29, 10400, 0.26, 293.0, 177.0, -0.98, NULL
FROM km_equity_symbols WHERE symbol = 'CONNPLEX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 18.2, 18.2, NULL, NULL, NULL, NULL, 34.85, 18.2, -13.33, -44.0
FROM km_equity_symbols WHERE symbol = 'CONTI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 27.95, 28.5, 27.35, 28.5, 27.15, 1.35, 4.97, 177500, 0.5, 99.5, 24.65, -57.56, -96.33
FROM km_equity_symbols WHERE symbol = 'COOLCAPS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2255.0, 2300.0, 2241.0, 2288.0, 2270.2, 17.8, 0.78, 323878, 73.61, 2718.9, 1596.0, -2.7, 23.59
FROM km_equity_symbols WHERE symbol = 'COROMANDEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1624.0, 1624.0, 1580.0, 1585.0, 1614.1, -29.1, -1.8, 30627, 4.91, 1660.8, 1336.6, 10.61, NULL
FROM km_equity_symbols WHERE symbol = 'CORONA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1557.0, 1649.0, 1515.0, 1570.0, 1546.2, 23.8, 1.54, 1119694, 178.98, 1745.1, 1015.0, 10.59, NULL
FROM km_equity_symbols WHERE symbol = 'CPPLUS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1276.0, 1276.0, 1276.0, 1276.0, 1276.0, NULL, NULL, 1200, 0.15, 1349.25, 412.0, 15.58, 163.47
FROM km_equity_symbols WHERE symbol = 'CPS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 7950.0, 7950.0, 7661.5, 7730.0, 7973.5, -243.5, -3.05, 58670, 45.47, 8220.0, 3700.0, 0.57, 92.62
FROM km_equity_symbols WHERE symbol = 'CRAFTSMAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 257.55, 261.65, 254.05, 254.85, 260.05, -5.2, -2.0, 528583, 13.68, 353.4, 244.0, -9.29, NULL
FROM km_equity_symbols WHERE symbol = 'CRAMC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 37.85, 37.85, 37.85, 37.85, 39.65, -1.8, -4.54, 1000, NULL, 85.45, 32.6, -5.38, -55.47
FROM km_equity_symbols WHERE symbol = 'CRAYONS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 6.98, 6.98, 6.56, 6.8, 6.77, 0.03, 0.44, 16312, 0.01, 12.19, 5.27, -2.44, -10.41
FROM km_equity_symbols WHERE symbol = 'CREATIVEYE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1267.5, 1272.8, 1245.0, 1270.0, 1267.8, 2.2, 0.17, 113560, 14.33, 1496.7, 847.8, -1.45, 21.46
FROM km_equity_symbols WHERE symbol = 'CREDITACC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 4605.0, 4649.0, 4355.1, 4428.9, 4665.2, -236.3, -5.07, 133926, 59.47, 6139.0, 3973.6, -8.03, -13.1
FROM km_equity_symbols WHERE symbol = 'CRISIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 239.05, 239.05, 230.0, 230.55, 240.35, -9.8, -4.08, 187750, 4.37, 387.95, 217.3, -10.95, NULL
FROM km_equity_symbols WHERE symbol = 'CRIZAC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 264.0, 269.85, 255.9, 266.8, 264.4, 2.4, 0.91, 4504154, 119.63, 367.5, 217.4, 5.54, -22.05
FROM km_equity_symbols WHERE symbol = 'CROMPTON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 391.2, 401.7, 387.5, 389.95, 403.85, -13.9, -3.44, 837126, 33.07, 574.4, 272.75, -24.83, 30.97
FROM km_equity_symbols WHERE symbol = 'CSBBANK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 286.4, 288.0, 281.75, 282.6, 286.4, -3.8, -1.33, 538191, 15.3, 324.1, 142.91, 1.95, 70.29
FROM km_equity_symbols WHERE symbol = 'CUB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 120.1, 120.1, 120.1, 120.1, 122.2, -2.1, -1.72, 1000, 0.01, 166.5, 114.5, -2.99, NULL
FROM km_equity_symbols WHERE symbol = 'CUDML'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 4425.0, 4491.9, 4395.2, 4412.0, 4429.3, -17.3, -0.39, 512643, 228.06, 4615.0, 2580.0, 10.92, 57.5
FROM km_equity_symbols WHERE symbol = 'CUMMINSIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 104.0, 104.0, 104.0, 104.0, 105.05, -1.05, -1.0, 1000, 0.01, 147.9, 98.0, -15.72, NULL
FROM km_equity_symbols WHERE symbol = 'CURIS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 125.05, 125.05, 125.0, 125.0, 125.05, -0.05, -0.04, 4800, 0.06, 163.0, 120.0, -4.43, NULL
FROM km_equity_symbols WHERE symbol = 'CURRENT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 15.21, 15.79, 15.06, 15.14, 15.51, -0.37, -2.39, 4651, 0.01, 22.81, 11.0, -4.72, -23.73
FROM km_equity_symbols WHERE symbol = 'CYBERMEDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 990.0, 1029.7, 982.5, 999.0, 1017.0, -18.0, -1.77, 370990, 37.35, 1537.05, 982.5, -14.98, -31.06
FROM km_equity_symbols WHERE symbol = 'CYIENT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 364.4, 366.8, 358.7, 363.1, 364.45, -1.35, -0.37, 111824, 4.05, 540.0, 344.55, -9.19, -15.7
FROM km_equity_symbols WHERE symbol = 'CYIENTDLM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 517.25, 518.95, 510.1, 511.3, 519.55, -8.25, -1.59, 1746636, 89.9, 577.0, 433.3, -2.06, -1.64
FROM km_equity_symbols WHERE symbol = 'DABUR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2160.0, 2163.3, 2120.4, 2144.5, 2171.2, -26.7, -1.23, 77376, 16.6, 2496.3, 1601.0, 1.85, 19.24
FROM km_equity_symbols WHERE symbol = 'DALBHARAT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 698.0, 704.95, 678.15, 682.0, 694.75, -12.75, -1.84, 26550, 1.83, 1189.0, 582.0, 5.91, -13.77
FROM km_equity_symbols WHERE symbol = 'DANISH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 745.0, 750.0, 725.55, 730.35, 758.3, -27.95, -3.69, 69373, 5.09, 1120.0, 522.0, -0.73, 11.93
FROM km_equity_symbols WHERE symbol = 'DATAMATICS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2760.0, 2789.0, 2725.0, 2754.9, 2783.3, -28.4, -1.02, 256905, 70.83, 3268.8, 1351.15, 6.31, 63.66
FROM km_equity_symbols WHERE symbol = 'DATAPATTNS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 236.31, 237.88, 233.9, 236.0, 238.47, -2.47, -1.04, 85529, 2.01, 291.85, 189.05, -3.52, 14.12
FROM km_equity_symbols WHERE symbol = 'DBCORP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 450.0, 450.0, 428.45, 430.5, 453.4, -22.9, -5.05, 360425, 15.72, 585.0, 376.0, -8.56, 5.77
FROM km_equity_symbols WHERE symbol = 'DBL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 129.4, 129.4, 124.1, 124.4, 131.57, -7.17, -5.45, 1879085, 23.62, 252.67, 95.5, 13.57, -10.66
FROM km_equity_symbols WHERE symbol = 'DBREALTY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 207.0, 208.7, 200.4, 201.31, 208.68, -7.37, -3.53, 182479, 3.71, 321.95, 178.0, -23.55, -11.83
FROM km_equity_symbols WHERE symbol = 'DCAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 189.99, 191.28, 185.0, 189.73, 190.31, -0.58, -0.3, 1670609, 31.59, 203.7, 101.41, 2.87, 67.65
FROM km_equity_symbols WHERE symbol = 'DCBBANK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 44.45, 45.8, 44.0, 45.8, 43.6, 2.2, 5.05, 30000, 0.13, 66.0, 40.0, -7.85, NULL
FROM km_equity_symbols WHERE symbol = 'DCCL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 59.65, 60.25, -0.6, -1.0, NULL, NULL, 84.75, 53.9, -5.86, -26.75
FROM km_equity_symbols WHERE symbol = 'DCG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1132.6, 1132.6, 1106.0, 1108.0, 1132.6, -24.6, -2.17, 19317, 2.16, 1502.3, 902.6, -6.04, 4.28
FROM km_equity_symbols WHERE symbol = 'DCMSHRIRAM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 23.75, 24.15, 23.75, 24.0, 24.15, -0.15, -0.62, 3600, 0.01, 64.5, 20.15, 5.26, -61.04
FROM km_equity_symbols WHERE symbol = 'DECCANTRAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 41.1, 41.1, 41.1, 41.1, 43.0, -1.9, -4.42, 4000, 0.02, 72.9, 38.35, -12.09, -43.62
FROM km_equity_symbols WHERE symbol = 'DEEM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1040.2, 1049.8, 1023.4, 1028.0, 1044.5, -16.5, -1.58, 175387, 18.16, 1778.6, 888.9, -16.05, -3.75
FROM km_equity_symbols WHERE symbol = 'DEEPAKFERT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1628.0, 1662.9, 1580.0, 1634.0, 1657.3, -23.3, -1.41, 156667, 25.75, 2257.85, 1514.0, 4.0, -27.0
FROM km_equity_symbols WHERE symbol = 'DEEPAKNTR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 112.0, 112.0, 107.55, 107.55, 114.3, -6.75, -5.91, 5400, 0.06, 198.0, 102.0, -15.58, -42.68
FROM km_equity_symbols WHERE symbol = 'DELAPLEX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 424.2, 426.9, 414.0, 420.0, 429.55, -9.55, -2.22, 3032569, 127.23, 490.0, 236.53, 5.83, 49.04
FROM km_equity_symbols WHERE symbol = 'DELHIVERY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 41.9, 42.5, 39.5, 39.5, 41.75, -2.25, -5.39, 32000, 0.13, 94.6, 37.1, -10.53, -54.36
FROM km_equity_symbols WHERE symbol = 'DELTIC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 28.97, 28.97, 28.28, 28.28, 29.04, -0.76, -2.62, 277807, 0.79, 42.6, 26.9, -7.43, -20.47
FROM km_equity_symbols WHERE symbol = 'DEN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 155.05, 155.5, 147.5, 148.55, 159.95, -11.4, -7.13, 27600, 0.42, 374.8, 132.0, -10.99, -50.99
FROM km_equity_symbols WHERE symbol = 'DENEERS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 285.0, 285.0, 271.1, 273.35, 303.4, -30.05, -9.9, 553262, 15.34, 479.6, 248.4, -11.51, -10.68
FROM km_equity_symbols WHERE symbol = 'DENTA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 495.25, 502.0, 495.25, 500.0, 504.1, -4.1, -0.81, 9000, 0.45, 704.0, 436.15, -16.67, -17.04
FROM km_equity_symbols WHERE symbol = 'DENTALKART'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 124.0, 124.0, NULL, NULL, NULL, NULL, 143.0, 67.8, 3.77, 9.64
FROM km_equity_symbols WHERE symbol = 'DESTINY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 133.23, 133.42, 130.3, 131.25, 133.89, -2.64, -1.97, 1173135, 15.5, 191.0, 109.62, -2.72, -18.28
FROM km_equity_symbols WHERE symbol = 'DEVYANI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 28.0, 28.98, 26.25, 26.25, 28.41, -2.16, -7.6, 13171, 0.04, 59.28, 23.52, -18.88, -49.73
FROM km_equity_symbols WHERE symbol = 'DGCONTENT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 28.5, 28.5, NULL, NULL, NULL, NULL, 66.0, 23.9, -11.21, -51.74
FROM km_equity_symbols WHERE symbol = 'DHANLAXMI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1124.0, 1133.4, 1105.0, 1129.0, 1128.0, 1.0, 0.09, 19621, 2.2, 1975.0, 1017.8, 5.4, -20.54
FROM km_equity_symbols WHERE symbol = 'DHANUKA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 73.5, 73.5, 73.5, 73.5, 74.95, -1.45, -1.93, 6000, 0.04, 82.6, 18.1, NULL, NULL
FROM km_equity_symbols WHERE symbol = 'DHARIWAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 54.6, 54.6, 54.6, 54.6, 57.45, -2.85, -4.96, 800, NULL, 125.2, 36.9, -23.42, -13.81
FROM km_equity_symbols WHERE symbol = 'DHTL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 132.1, 133.8, 126.91, 131.05, 133.69, -2.64, -1.97, 1006175, 13.17, 183.5, 81.5, -0.37, 38.08
FROM km_equity_symbols WHERE symbol = 'DIACABS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 75.8, 77.0, 73.05, 75.9, 75.8, 0.1, 0.13, 12000, 0.09, 115.95, 57.1, 10.89, -65.99
FROM km_equity_symbols WHERE symbol = 'DIGIKORE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 18.95, 18.95, 18.95, 18.95, 19.9, -0.95, -4.77, 6000, 0.01, 34.0, 18.95, NULL, NULL
FROM km_equity_symbols WHERE symbol = 'DIRL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3.31, 3.34, 3.26, 3.28, 3.33, -0.05, -1.5, 3584614, 1.18, 8.05, 2.82, -14.14, -57.57
FROM km_equity_symbols WHERE symbol = 'DISHTV'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 250.0, 258.3, 250.0, 258.0, 250.0, 8.0, 3.2, 54400, 1.39, 258.3, 43.0, 10.59, NULL
FROM km_equity_symbols WHERE symbol = 'DIVINEHIRA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 6141.0, 6200.0, 6054.0, 6177.0, 6185.0, -8.0, -0.13, 299364, 183.81, 7071.5, 4955.0, -4.03, 2.77
FROM km_equity_symbols WHERE symbol = 'DIVISLAB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 25.2, 25.2, 23.25, 23.25, 24.0, -0.75, -3.13, 8000, 0.02, 62.4, 20.2, -4.71, -61.06
FROM km_equity_symbols WHERE symbol = 'DIVYADHAN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 11500.0, 11548.0, 11250.0, 11398.0, 11626.0, -228.0, -1.96, 446533, 508.93, 18471.0, 9835.0, 1.42, -22.52
FROM km_equity_symbols WHERE symbol = 'DIXON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 76.9, 76.9, NULL, NULL, NULL, NULL, 89.6, 56.5, -0.45, 18.31
FROM km_equity_symbols WHERE symbol = 'DKEGL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 641.6, 641.6, 623.55, 626.95, 651.8, -24.85, -3.81, 4838136, 304.39, 886.8, 586.65, -3.9, -7.89
FROM km_equity_symbols WHERE symbol = 'DLF'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3944.3, 3949.5, 3887.0, 3890.0, 3963.0, -73.0, -1.84, 219061, 85.69, 4949.5, 3340.0, 1.65, 5.23
FROM km_equity_symbols WHERE symbol = 'DMART'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3.61, 3.82, 3.45, 3.55, 3.67, -0.12, -3.27, 115478, 0.04, 6.91, 3.07, -4.57, -44.7
FROM km_equity_symbols WHERE symbol = 'DNAMEDIA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1231.0, 1231.0, 1200.0, 1200.0, 1222.7, -22.7, -1.86, 15779, 1.91, 1525.0, 965.5, -1.61, 19.06
FROM km_equity_symbols WHERE symbol = 'DODLA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 35.6, 35.6, NULL, NULL, NULL, NULL, 44.25, 29.91, -6.32, -0.42
FROM km_equity_symbols WHERE symbol = 'DOLLEX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2403.9, 2404.0, 2340.0, 2367.9, 2413.7, -45.8, -1.9, 97056, 22.94, 3064.6, 2250.0, -3.45, -6.57
FROM km_equity_symbols WHERE symbol = 'DOMS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 298.0, 298.0, 291.9, 298.0, 297.85, 0.15, 0.05, 12500, 0.37, 330.6, 92.05, NULL, NULL
FROM km_equity_symbols WHERE symbol = 'DPEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 49.15, 52.5, 48.05, 49.5, 50.15, -0.65, -1.3, 42000, 0.21, 147.5, 47.0, -10.92, -61.79
FROM km_equity_symbols WHERE symbol = 'DRONE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1274.0, 1279.3, 1263.6, 1269.7, 1274.9, -5.2, -0.41, 838946, 106.59, 1379.7, 1020.0, 6.58, 3.77
FROM km_equity_symbols WHERE symbol = 'DRREDDY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 118.4, 118.4, 118.4, 118.4, 128.0, -9.6, -7.5, 1200, 0.01, 178.0, 105.0, -10.3, -2.15
FROM km_equity_symbols WHERE symbol = 'DTL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 140.65, 140.95, 140.0, 140.0, 140.95, -0.95, -0.67, 3200, 0.04, 209.5, 93.5, -4.53, 16.76
FROM km_equity_symbols WHERE symbol = 'DUCOL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 32.5, 32.5, 32.5, 32.5, 32.05, 0.45, 1.4, 17500, 0.06, 61.9, 26.5, 15.25, -39.2
FROM km_equity_symbols WHERE symbol = 'DUGLOBAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 47.8, 49.5, 47.5, 48.5, 47.8, 0.7, 1.46, 72000, 0.35, 53.21, 28.03, 23.57, -1.62
FROM km_equity_symbols WHERE symbol = 'DURLAX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 9600.0, 9719.5, 9404.5, 9574.5, 9703.0, -123.5, -1.27, 14971, 14.26, 10039.5, 5444.15, 5.65, 44.61
FROM km_equity_symbols WHERE symbol = 'DYNAMATECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 114.05, 134.65, 112.85, 134.65, 122.45, 12.2, 9.96, 39500, 0.46, 260.0, 85.4, -12.41, -51.82
FROM km_equity_symbols WHERE symbol = 'DYNAMIC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 6.77, 6.77, 6.51, 6.64, 6.78, -0.14, -2.06, 8518557, 5.62, 14.02, 6.12, -6.35, -45.75
FROM km_equity_symbols WHERE symbol = 'EASEMYTRIP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 330.25, 340.8, 318.1, 335.0, 329.35, 5.65, 1.72, 134483, 4.45, 401.7, 239.0, 17.54, NULL
FROM km_equity_symbols WHERE symbol = 'EBGNG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3602.7, 3829.9, 3554.4, 3630.3, 3728.6, -98.3, -2.64, 240196, 88.73, 4995.0, 2168.0, -20.98, 17.88
FROM km_equity_symbols WHERE symbol = 'ECLERX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 128.0, 131.0, 128.0, 131.0, 133.0, -2.0, -1.5, 3000, 0.04, 143.9, 115.0, -0.76, NULL
FROM km_equity_symbols WHERE symbol = 'ECOLINE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 124.5, 124.93, 121.2, 122.0, 125.41, -3.41, -2.72, 5899922, 72.73, 129.0, 73.5, 16.8, 18.47
FROM km_equity_symbols WHERE symbol = 'EDELWEISS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 162.8, 163.95, 159.1, 159.1, 163.0, -3.9, -2.39, 11000, 0.18, 267.9, 138.0, -3.9, NULL
FROM km_equity_symbols WHERE symbol = 'EEPL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 260.0, 264.9, 260.0, 264.9, 266.35, -1.45, -0.54, 800, 0.02, 348.0, 127.5, -15.9, 34.47
FROM km_equity_symbols WHERE symbol = 'EFACTOR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 216.7, 219.5, 212.0, 212.0, 216.7, -4.7, -2.17, 5600, 0.12, 270.0, 147.55, 0.5, 5.32
FROM km_equity_symbols WHERE symbol = 'EFFWA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 30.1, 30.45, 29.9, 29.95, 31.5, -1.55, -4.92, 26400, 0.08, 54.5, 29.0, -8.97, -36.41
FROM km_equity_symbols WHERE symbol = 'EFORCE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 7900.0, 8119.0, 7886.5, 8067.0, 7943.0, 124.0, 1.56, 967939, 778.06, 8119.0, 4646.0, 8.95, 67.35
FROM km_equity_symbols WHERE symbol = 'EICHERMOT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 905.8, 942.15, 900.4, 908.0, 909.45, -1.45, -0.16, 501715, 46.0, 1246.8, 639.0, -3.66, 16.42
FROM km_equity_symbols WHERE symbol = 'EIDPARRY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 169.52, 169.79, 165.0, 167.17, 169.52, -2.35, -1.39, 729175, 12.16, 306.4, 163.21, -11.7, -31.49
FROM km_equity_symbols WHERE symbol = 'EIEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 332.15, 332.95, 327.8, 330.9, 333.8, -2.9, -0.87, 172342, 5.69, 434.8, 304.5, -4.45, -1.28
FROM km_equity_symbols WHERE symbol = 'EIHOTEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 444.7, 444.7, 431.3, 432.0, 444.7, -12.7, -2.86, 191768, 8.34, 716.25, 361.5, 7.84, -10.82
FROM km_equity_symbols WHERE symbol = 'ELECON'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 75.0, 75.1, 72.93, 73.44, 75.61, -2.17, -2.87, 958172, 7.04, 138.75, 66.1, 4.44, -30.28
FROM km_equity_symbols WHERE symbol = 'ELECTCAST'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 513.05, 523.65, 499.4, 507.85, 512.25, -4.4, -0.86, 2365077, 121.11, 608.4, 401.0, 15.37, -3.51
FROM km_equity_symbols WHERE symbol = 'ELGIEQUIP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 80.0, 85.45, 80.0, 84.85, 81.0, 3.85, 4.75, 19000, 0.16, 163.5, 74.15, 1.01, NULL
FROM km_equity_symbols WHERE symbol = 'ELGNZ'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 245.75, 246.75, 237.5, 240.15, 249.7, -9.55, -3.82, 143311, 3.46, 637.7, 237.5, -14.55, NULL
FROM km_equity_symbols WHERE symbol = 'ELLEN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 490.0, 496.7, 487.25, 488.8, 495.35, -6.55, -1.32, 410629, 20.21, 653.35, 470.0, -4.26, -9.42
FROM km_equity_symbols WHERE symbol = 'EMAMILTD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 87.3, 91.0, 85.15, 85.15, 91.5, -6.35, -6.94, 18000, 0.16, 136.4, 75.5, -5.46, NULL
FROM km_equity_symbols WHERE symbol = 'EMAPARTNER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 63.0, 65.4, 62.3, 64.3, 63.01, 1.29, 2.05, 1361556, 8.72, 143.9, 55.69, -10.64, -53.33
FROM km_equity_symbols WHERE symbol = 'EMBDL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1468.0, 1495.0, 1442.8, 1485.0, 1458.1, 26.9, 1.84, 208084, 30.71, 1585.6, 889.0, -4.23, 39.51
FROM km_equity_symbols WHERE symbol = 'EMCURE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 104.35, 104.35, 102.0, 102.5, 104.45, -1.95, -1.87, 411550, 4.22, 168.5, 84.9, 3.9, -21.18
FROM km_equity_symbols WHERE symbol = 'EMIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 100.05, 101.0, 99.25, 99.25, 102.35, -3.1, -3.03, 2100, 0.02, 480.0, 88.0, -8.19, -76.97
FROM km_equity_symbols WHERE symbol = 'EMKAYTOOLS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 145.0, 145.0, 142.6, 142.65, 145.0, -2.35, -1.62, 1750, 0.03, 281.15, 139.45, -19.41, -46.73
FROM km_equity_symbols WHERE symbol = 'EMMIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 208.99, 217.5, 204.19, 209.0, 207.26, 1.74, 0.84, 4352593, 92.18, 248.4, 171.51, -1.45, NULL
FROM km_equity_symbols WHERE symbol = 'EMMVEE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 496.0, 496.0, 480.15, 485.1, 499.65, -14.55, -2.91, 194638, 9.43, 894.1, 480.15, -13.47, -31.17
FROM km_equity_symbols WHERE symbol = 'EMUDHRA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2547.6, 2549.0, 2470.2, 2480.0, 2557.6, -77.6, -3.03, 80313, 20.17, 3079.9, 1675.0, -4.17, 29.57
FROM km_equity_symbols WHERE symbol = 'ENDURANCE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 198.0, 200.0, 198.0, 200.0, 205.95, -5.95, -2.89, 1800, 0.04, 284.0, 164.0, -9.91, -13.04
FROM km_equity_symbols WHERE symbol = 'ENFUSE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 199.1, 210.0, 197.15, 199.32, 180.9, 18.42, 10.18, 134019973, 2747.95, 255.45, 142.2, 2.81, 20.79
FROM km_equity_symbols WHERE symbol = 'ENGINERSIN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 109.94, 109.94, 106.01, 108.0, 110.18, -2.18, -1.98, 49929, 0.54, 174.58, 106.01, -8.48, -28.86
FROM km_equity_symbols WHERE symbol = 'ENIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2725.0, 2849.9, 2682.6, 2745.6, 2731.3, 14.3, 0.52, 1006399, 278.07, 3625.0, 2115.0, 14.19, NULL
FROM km_equity_symbols WHERE symbol = 'ENRIN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 12.0, 12.2, 10.4, 11.5, 12.8, -1.3, -10.16, 280000, 0.31, 31.3, 10.4, -27.1, -93.54
FROM km_equity_symbols WHERE symbol = 'ENSER'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1159.0, 1216.0, 1119.1, 1141.0, 1156.6, -15.6, -1.35, 248294, 28.8, 1510.8, 944.0, -6.76, -10.37
FROM km_equity_symbols WHERE symbol = 'ENTERO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 97.55, 100.0, 97.55, 100.0, 103.0, -3.0, -2.91, 2000, 0.02, 173.0, 82.0, -10.79, -4.4
FROM km_equity_symbols WHERE symbol = 'ENVIRO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 190.56, 190.88, 182.37, 188.99, 191.2, -2.21, -1.16, 351549, 6.56, 344.0, 174.9, -24.3, NULL
FROM km_equity_symbols WHERE symbol = 'EPACKPEB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1001.0, 1004.0, 972.0, 975.0, 1002.3, -27.3, -2.72, 68807, 6.83, 2114.0, 904.6, -16.06, -47.61
FROM km_equity_symbols WHERE symbol = 'EPIGRAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 219.25, 221.65, 216.51, 217.89, 220.65, -2.76, -1.25, 331090, 7.24, 261.37, 175.28, 5.78, -12.04
FROM km_equity_symbols WHERE symbol = 'EPL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 68.05, 69.25, 66.6, 67.7, 68.88, -1.18, -1.71, 3034579, 20.62, 73.4, 50.0, -0.46, 6.4
FROM km_equity_symbols WHERE symbol = 'EQUITASBNK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1511.0, 1511.0, 1389.9, 1407.1, 1510.4, -103.3, -6.84, 238365, 34.5, 1910.0, 1097.2, -4.74, 11.22
FROM km_equity_symbols WHERE symbol = 'ERIS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 109.9, 112.45, 105.35, 109.5, 113.25, -3.75, -3.31, 14400, 0.16, 280.0, 100.1, -5.72, -71.34
FROM km_equity_symbols WHERE symbol = 'ESCONET'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3630.0, 3692.6, 3577.9, 3580.1, 3635.8, -55.7, -1.53, 173264, 63.22, 4180.0, 2776.4, -3.83, 18.45
FROM km_equity_symbols WHERE symbol = 'ESCORTS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 136.95, 138.5, 134.95, 137.9, 135.95, 1.95, 1.43, 20160, 0.28, 585.0, 132.35, -11.86, -68.08
FROM km_equity_symbols WHERE symbol = 'ESFL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 83.55, 83.55, 78.0, 78.0, 85.25, -7.25, -8.5, 14400, 0.12, 128.0, 52.0, 5.63, -36.02
FROM km_equity_symbols WHERE symbol = 'ESPRIT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 298.0, 300.0, 283.8, 285.2, 298.0, -12.8, -4.3, 47583835, 1369.8, 368.45, 194.8, -3.17, 30.9
FROM km_equity_symbols WHERE symbol = 'ETERNAL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2489.8, 2543.6, 2459.0, 2480.0, 2524.7, -44.7, -1.77, 13190, 3.28, 3245.9, 1923.08, -8.51, 13.34
FROM km_equity_symbols WHERE symbol = 'ETHOSLTD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 835.05, 870.0, 835.0, 870.0, 830.0, 40.0, 4.82, 750, 0.06, 1235.0, 721.1, 3.24, NULL
FROM km_equity_symbols WHERE symbol = 'ETL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 108.0, 110.95, 108.0, 108.0, 107.0, 1.0, 0.93, 15600, 0.17, 153.0, 90.0, 7.62, -16.86
FROM km_equity_symbols WHERE symbol = 'ETML'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 533.0, 533.0, 515.0, 517.05, 532.15, -15.1, -2.84, 137324, 7.12, 668.3, 461.5, -9.26, 1.53
FROM km_equity_symbols WHERE symbol = 'EUREKAFORB'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 234.99, 239.0, 224.16, 233.15, 231.99, 1.16, 0.5, 393887, 9.07, 390.0, 205.1, -16.15, NULL
FROM km_equity_symbols WHERE symbol = 'EUROPRATIK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 79.0, 79.0, 74.35, 74.35, 77.5, -3.15, -4.06, 19200, 0.15, 79.0, 36.9, 90.64, 18.96
FROM km_equity_symbols WHERE symbol = 'EXCELLENT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 92.5, 92.98, 85.94, 87.0, 93.05, -6.05, -6.5, 2081406, 18.77, 142.59, 68.0, 5.52, NULL
FROM km_equity_symbols WHERE symbol = 'EXCELSOFT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 337.7, 340.35, 332.15, 334.9, 338.05, -3.15, -0.93, 1628679, 54.83, 431.0, 308.45, -3.21, -8.73
FROM km_equity_symbols WHERE symbol = 'EXIDEIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 165.5, 167.4, 161.3, 161.5, 164.76, -3.26, -1.98, 167099, 2.75, 262.8, 137.29, -14.58, NULL
FROM km_equity_symbols WHERE symbol = 'FABTECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 800.0, 800.1, 775.15, 778.0, 801.15, -23.15, -2.89, 64600, 5.06, 1112.0, 565.0, -10.37, -3.47
FROM km_equity_symbols WHERE symbol = 'FACT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 15.1, 15.5, 14.9, 14.9, 15.1, -0.2, -1.32, 4800, 0.01, 39.2, 14.25, -0.67, -61.84
FROM km_equity_symbols WHERE symbol = 'FALCONTECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 388.3, 388.3, 374.85, 377.65, 388.3, -10.65, -2.74, 65374, 2.48, 527.8, 357.55, -3.55, -7.92
FROM km_equity_symbols WHERE symbol = 'FDC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 287.05, 290.55, 285.1, 287.7, 287.1, 0.6, 0.21, 6202181, 178.86, 298.25, 172.66, 15.4, 58.25
FROM km_equity_symbols WHERE symbol = 'FEDERALBNK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 197.0, 202.0, 195.0, 202.0, 200.9, 1.1, 0.55, 35500, 0.71, 220.0, 108.0, 10.79, 19.64
FROM km_equity_symbols WHERE symbol = 'FELIX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 133.0, 133.0, 132.0, 132.0, 137.0, -5.0, -3.65, 4000, 0.05, 234.0, 109.0, -3.37, -14.84
FROM km_equity_symbols WHERE symbol = 'FIDEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2399.0, 2399.0, 2291.1, 2302.0, 2399.2, -97.2, -4.05, 76440, 17.8, 2555.3, 1255.1, 2.05, 65.94
FROM km_equity_symbols WHERE symbol = 'FIEMIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 113.0, 113.5, 113.0, 113.0, 116.2, -3.2, -2.75, 4000, 0.05, 164.85, 103.05, -11.37, NULL
FROM km_equity_symbols WHERE symbol = 'FINBUD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 819.0, 823.75, 800.0, 815.0, 819.1, -4.1, -0.5, 222791, 18.08, 1059.95, 700.8, 6.98, -18.38
FROM km_equity_symbols WHERE symbol = 'FINCABLES'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 4500.0, 4524.0, 4355.5, 4400.0, 4596.6, -196.6, -4.28, 20938, 9.28, 5494.0, 3407.0, 4.52, 10.3
FROM km_equity_symbols WHERE symbol = 'FINEORG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 190.0, 192.35, 186.1, 188.0, 191.34, -3.34, -1.75, 985263, 18.64, 238.0, 153.92, 8.04, -6.3
FROM km_equity_symbols WHERE symbol = 'FINPIPE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 263.8, 270.95, 261.0, 270.05, 267.8, 2.25, 0.84, 1019948, 27.06, 438.7, 254.5, 0.35, -34.15
FROM km_equity_symbols WHERE symbol = 'FIRSTCRY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 440.2, 445.5, 432.05, 439.9, 440.3, -0.4, -0.09, 874806, 38.45, 850.0, 420.55, -15.11, -39.06
FROM km_equity_symbols WHERE symbol = 'FIVESTAR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 3347.1, 3418.9, 3247.0, 3399.0, 3386.2, 12.8, 0.38, 102500, 34.28, 4083.55, 2916.6, -1.61, -9.9
FROM km_equity_symbols WHERE symbol = 'FLUOROCHEM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 530.0, 538.5, 514.85, 514.85, 541.9, -27.05, -4.99, 62800, 3.26, 790.0, 375.05, 17.24, NULL
FROM km_equity_symbols WHERE symbol = 'FLYSBS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 1830.0, 1830.0, NULL, NULL, NULL, NULL, 2004.0, 1226.0, 3.1, 16.75
FROM km_equity_symbols WHERE symbol = 'FOCE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 80.3, 80.3, NULL, NULL, NULL, NULL, 124.4, 68.85, -10.78, -23.74
FROM km_equity_symbols WHERE symbol = 'FONEBOX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 107.0, 114.9, 99.0, 106.0, 99.6, 6.4, 6.43, 60800, 0.65, 140.0, 65.05, -11.22, 14.71
FROM km_equity_symbols WHERE symbol = 'FORCAS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 23720.0, 24129.0, 23004.0, 23798.0, 23840.0, -42.0, -0.18, 119515, 281.86, 25050.0, 6251.0, 18.43, 251.59
FROM km_equity_symbols WHERE symbol = 'FORCEMOT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 86.0, 86.0, NULL, NULL, NULL, NULL, 175.5, 60.0, -21.28, -7.77
FROM km_equity_symbols WHERE symbol = 'FORGEAUTO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 928.15, 930.9, 914.3, 919.0, 928.55, -9.55, -1.03, 1221319, 112.37, 1104.3, 587.1, 1.21, 50.21
FROM km_equity_symbols WHERE symbol = 'FORTIS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 200.4, 210.0, 197.0, 207.5, 193.1, 14.4, 7.46, 292800, 5.95, 221.95, 117.2, 26.19, 6.19
FROM km_equity_symbols WHERE symbol = 'FRESHARA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 142.0, 142.0, 133.0, 133.0, 139.45, -6.45, -4.63, 14800, 0.2, 364.95, 133.0, -8.25, -60.54
FROM km_equity_symbols WHERE symbol = 'FROG'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 265.0, 266.8, 252.45, 254.0, 273.8, -19.8, -7.23, 3168445, 82.49, 403.8, 252.45, -21.13, -29.78
FROM km_equity_symbols WHERE symbol = 'FSL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1006.15, 1013.6, 985.0, 987.05, 1012.5, -25.45, -2.51, 117631, 11.75, 1388.0, 438.0, 3.62, 97.88
FROM km_equity_symbols WHERE symbol = 'GABRIEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 136.8, 139.9, 134.78, 138.7, 138.32, 0.38, 0.27, 609254, 8.35, 143.8, 98.72, 0.46, 22.33
FROM km_equity_symbols WHERE symbol = 'GAEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 162.4, 163.33, 161.12, 161.99, 163.72, -1.73, -1.06, 8523271, 137.86, 202.79, 150.52, -1.98, -0.21
FROM km_equity_symbols WHERE symbol = 'GAIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 9.5, 9.8, 9.5, 9.75, 9.55, 0.2, 2.09, 18000, 0.02, 16.85, 9.0, -13.72, -35.0
FROM km_equity_symbols WHERE symbol = 'GAJANAND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 570.0, 575.6, 550.25, 552.5, 576.85, -24.35, -4.22, 151111, 8.58, 802.25, 295.0, -0.98, 75.4
FROM km_equity_symbols WHERE symbol = 'GALLANTT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 841.5, 841.5, 796.05, 800.0, 837.55, -37.55, -4.48, 92512, 7.55, 1742.3, 653.55, 2.99, -48.63
FROM km_equity_symbols WHERE symbol = 'GANECOS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 191.0, 192.0, 186.71, 189.9, 191.55, -1.65, -0.86, 102924, 1.96, 309.95, 186.71, -9.28, NULL
FROM km_equity_symbols WHERE symbol = 'GANESHCP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 706.0, 712.0, 697.4, 700.3, 713.35, -13.05, -1.83, 28432, 1.99, 1403.0, 685.6, -8.67, -48.87
FROM km_equity_symbols WHERE symbol = 'GANESHHOU'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 98.9, 102.5, 98.6, 98.6, 103.75, -5.15, -4.96, 129600, 1.28, 279.8, 83.4, -5.33, -30.83
FROM km_equity_symbols WHERE symbol = 'GANESHIN'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 18.4, 18.9, 18.3, 18.9, 18.95, -0.05, -0.26, 33000, 0.06, 59.0, 18.2, -6.44, NULL
FROM km_equity_symbols WHERE symbol = 'GANGABATH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 709.0, 728.9, 696.05, 712.0, 719.05, -7.05, -0.98, 127496, 9.11, 985.55, 588.15, 10.48, -3.23
FROM km_equity_symbols WHERE symbol = 'GARFIBRES'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 59.94, 59.94, 58.48, 58.76, 60.57, -1.81, -2.99, 876386, 5.17, 76.5, 55.28, 4.41, -18.38
FROM km_equity_symbols WHERE symbol = 'GATEWAY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 124.15, 130.15, 124.15, 127.0, 124.1, 2.9, 2.34, 16200, 0.2, 255.0, 101.9, -12.53, NULL
FROM km_equity_symbols WHERE symbol = 'GCHOTELS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 196.2, 196.2, 192.5, 194.08, 197.67, -3.59, -1.82, 81100, 1.58, 349.6, 133.0, 29.02, NULL
FROM km_equity_symbols WHERE symbol = 'GEMAROMA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1331.0, 1331.0, 1295.0, 1300.0, 1340.3, -40.3, -3.01, 209977, 27.38, 1368.9, 797.5, 17.51, 42.55
FROM km_equity_symbols WHERE symbol = 'GESHIP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 321.0, 332.0, 306.15, 310.0, 323.85, -13.85, -4.28, 29700, 0.94, 555.0, 221.05, 7.92, -25.63
FROM km_equity_symbols WHERE symbol = 'GGBL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 505.0, 511.4, 492.95, 503.85, 509.45, -5.6, -1.1, 154749, 7.74, 670.0, 492.95, -8.22, -22.52
FROM km_equity_symbols WHERE symbol = 'GHCL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 44.5, 45.95, 44.0, 45.95, 44.2, 1.75, 3.96, 300000, 1.36, 51.5, 20.58, 5.28, -61.01
FROM km_equity_symbols WHERE symbol = 'GICL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 387.05, 394.8, 383.2, 389.0, 392.85, -3.85, -0.98, 694021, 27.04, 453.8, 351.0, 6.12, 0.61
FROM km_equity_symbols WHERE symbol = 'GICRE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 8668.0, 8671.0, 8510.0, 8515.0, 8673.0, -158.0, -1.82, 12507, 10.74, 11500.0, 7411.65, 5.2, 7.03
FROM km_equity_symbols WHERE symbol = 'GILLETTE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', NULL, NULL, NULL, 153.0, 153.0, NULL, NULL, NULL, NULL, 409.0, 96.8, -19.66, -45.36
FROM km_equity_symbols WHERE symbol = 'GIRIRAJ'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 116.8, 116.8, 110.98, 111.39, 116.82, -5.43, -4.65, 1012585, 11.33, 239.6, 96.01, -21.2, NULL
FROM km_equity_symbols WHERE symbol = 'GKENERGY'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 112.91, 113.3, 110.02, 110.5, 114.15, -3.65, -3.2, 410308, 4.59, 123.0, 98.36, 5.43, NULL
FROM km_equity_symbols WHERE symbol = 'GKSL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1811.0, 1811.1, 1770.1, 1780.0, 1816.0, -36.0, -1.98, 108641, 19.38, 2131.0, 1277.8, 3.54, 20.58
FROM km_equity_symbols WHERE symbol = 'GLAND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2645.0, 2668.5, 2584.8, 2590.0, 2668.5, -78.5, -2.94, 61048, 16.02, 3515.7, 1968.0, 9.32, 29.58
FROM km_equity_symbols WHERE symbol = 'GLAXO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2034.0, 2047.9, 1992.0, 1997.0, 2034.5, -37.5, -1.84, 865050, 174.91, 2284.8, 1275.5, -0.56, 41.51
FROM km_equity_symbols WHERE symbol = 'GLENMARK'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 108.0, 110.0, 108.0, 110.0, 110.3, -0.3, -0.27, 3000, 0.03, 159.7, 105.25, -5.98, 1.48
FROM km_equity_symbols WHERE symbol = 'GLOBALPET'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 53.8, 54.51, 52.15, 52.9, 53.39, -0.49, -0.92, 183553, 0.98, 95.0, 47.0, 3.77, NULL
FROM km_equity_symbols WHERE symbol = 'GLOBECIVIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 53.0, 53.47, 52.0, 52.2, 53.55, -1.35, -2.52, 108292, 0.57, 93.0, 48.67, -5.25, NULL
FROM km_equity_symbols WHERE symbol = 'GLOTTIS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 587.15, 587.15, 564.0, 568.35, 591.45, -23.1, -3.91, 2178121, 125.44, 651.0, 226.59, -0.35, 104.44
FROM km_equity_symbols WHERE symbol = 'GMDCLTD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 17.85, 18.9, 17.85, 18.9, 18.75, 0.15, 0.8, 18000, 0.03, 54.0, 17.5, -7.8, NULL
FROM km_equity_symbols WHERE symbol = 'GML'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 982.0, 1015.5, 965.05, 998.35, 985.3, 13.05, 1.32, 78108, 7.79, 1418.0, 943.55, -2.57, -13.72
FROM km_equity_symbols WHERE symbol = 'GMMPFAUDLR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 95.6, 96.0, 93.53, 94.08, 96.33, -2.25, -2.34, 7836032, 73.85, 110.36, 67.75, -5.23, 29.57
FROM km_equity_symbols WHERE symbol = 'GMRAIRPORT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 103.05, 104.98, 101.1, 102.48, 103.87, -1.39, -1.34, 789409, 8.15, 141.01, 89.36, -3.46, -4.83
FROM km_equity_symbols WHERE symbol = 'GMRP&UI'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 467.5, 472.85, 463.1, 466.25, 469.9, -3.65, -0.78, 127900, 5.96, 577.0, 442.45, -1.72, -18.44
FROM km_equity_symbols WHERE symbol = 'GNFC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2100.0, 2113.6, 2075.0, 2085.0, 2124.7, -39.7, -1.87, 146574, 30.67, 3947.0, 1611.85, -5.89, 25.11
FROM km_equity_symbols WHERE symbol = 'GODFRYPHLP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 317.0, 325.15, 312.65, 325.0, 320.05, 4.95, 1.55, 768160, 24.52, 381.4, 264.6, -4.12, 9.35
FROM km_equity_symbols WHERE symbol = 'GODIGIT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 632.0, 656.7, 621.95, 652.0, 633.0, 19.0, 3.0, 1653084, 106.92, 876.35, 506.1, 16.44, -11.55
FROM km_equity_symbols WHERE symbol = 'GODREJAGRO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1196.0, 1202.2, 1191.0, 1192.0, 1204.3, -12.3, -1.02, 827685, 99.13, 1309.0, 979.5, -3.82, 13.22
FROM km_equity_symbols WHERE symbol = 'GODREJCP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1007.15, 1007.2, 956.35, 971.0, 1011.2, -40.2, -3.98, 84987, 8.3, 1390.0, 766.0, -2.98, 17.71
FROM km_equity_symbols WHERE symbol = 'GODREJIND'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1787.8, 1817.1, 1727.1, 1804.0, 1821.7, -17.7, -0.97, 2052670, 363.16, 2506.5, 1475.0, -3.98, -10.94
FROM km_equity_symbols WHERE symbol = 'GODREJPROP'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 781.6, 859.15, 760.0, 845.2, 781.05, 64.15, 8.21, 4388280, 362.9, 1060.0, 531.0, 41.35, -14.15
FROM km_equity_symbols WHERE symbol = 'GOKEX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 5.5, 5.5, 5.5, 5.5, 5.25, 0.25, 4.76, 11250, 0.01, 13.5, 4.5, -12.0, -46.6
FROM km_equity_symbols WHERE symbol = 'GOLDSTAR'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 134.0, 134.0, 131.55, 132.0, 137.0, -5.0, -3.65, 2400, 0.03, 204.0, 120.05, -17.14, -26.3
FROM km_equity_symbols WHERE symbol = 'GOYALSALT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 355.0, 362.0, 355.0, 357.0, 362.0, -5.0, -1.38, 6200, 0.22, 616.5, 230.0, -7.99, 43.95
FROM km_equity_symbols WHERE symbol = 'GPECO'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 262.1, 264.82, 257.05, 258.8, 265.4, -6.6, -2.49, 1366289, 35.49, 290.0, 145.75, -0.15, 49.4
FROM km_equity_symbols WHERE symbol = 'GPIL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 175.13, 179.8, 175.01, 176.9, 176.02, 0.88, 0.5, 1008457, 17.92, 200.09, 122.5, -3.71, 31.27
FROM km_equity_symbols WHERE symbol = 'GPPL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 564.0, 571.0, 555.2, 559.7, 569.9, -10.2, -1.79, 366379, 20.66, 627.0, 422.0, -5.26, 3.22
FROM km_equity_symbols WHERE symbol = 'GRANULES'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 49.5, 49.5, 47.6, 47.6, 50.1, -2.5, -4.99, 21600, 0.1, 58.2, 30.4, -3.15, 1.28
FROM km_equity_symbols WHERE symbol = 'GRAPHISAD'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 669.0, 678.45, 636.2, 642.4, 670.15, -27.75, -4.14, 1128138, 74.43, 685.0, 365.75, 7.19, 46.13
FROM km_equity_symbols WHERE symbol = 'GRAPHITE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2929.3, 2934.0, 2877.4, 2877.4, 2925.5, -48.1, -1.64, 419620, 122.07, 2979.0, 2301.65, 3.72, 15.55
FROM km_equity_symbols WHERE symbol = 'GRASIM'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 1670.0, 1676.2, 1639.0, 1645.0, 1672.3, -27.3, -1.63, 100145, 16.62, 2170.0, 1379.65, 1.21, -6.99
FROM km_equity_symbols WHERE symbol = 'GRAVITA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 400.0, 400.0, 385.0, 385.0, 405.0, -20.0, -4.94, 1750, 0.07, 525.25, 306.65, 7.96, -14.96
FROM km_equity_symbols WHERE symbol = 'GRCL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 168.63, 168.71, 162.0, 162.4, 168.63, -6.23, -3.69, 1031800, 16.96, 289.0, 155.1, -5.54, -42.1
FROM km_equity_symbols WHERE symbol = 'GREAVESCOT'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 46.95, 50.0, 46.05, 46.05, 45.3, 0.75, 1.66, 20000, 0.1, 74.05, 42.3, -12.78, -34.03
FROM km_equity_symbols WHERE symbol = 'GREENCHEF'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 134.75, 134.75, 130.05, 131.2, 134.1, -2.9, -2.16, 4000, 0.05, 185.9, 111.0, -17.4, NULL
FROM km_equity_symbols WHERE symbol = 'GREENLEAF'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 222.8, 222.8, 217.19, 218.0, 223.48, -5.48, -2.45, 72829, 1.6, 348.5, 202.81, 0.74, -36.28
FROM km_equity_symbols WHERE symbol = 'GREENPANEL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 204.0, 216.0, 204.0, 216.0, 206.0, 10.0, 4.85, 3000, 0.06, 263.4, 180.5, 9.39, 2.84
FROM km_equity_symbols WHERE symbol = 'GRETEX'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 977.0, 987.4, 954.35, 975.0, 978.5, -3.5, -0.36, 24312, 2.36, 1444.4, 896.05, 3.74, -8.92
FROM km_equity_symbols WHERE symbol = 'GRINFRA'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 180.1, 184.0, 170.5, 172.0, 179.66, -7.66, -4.26, 62551183, 1093.52, 193.8, 112.0, 5.72, NULL
FROM km_equity_symbols WHERE symbol = 'GROWW'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 2480.0, 2488.0, 2424.1, 2427.0, 2496.2, -69.2, -2.77, 440467, 107.85, 3538.4, 1184.9, -0.91, 72.08
FROM km_equity_symbols WHERE symbol = 'GRSE'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 4154.1, 4372.5, 4104.2, 4225.0, 4171.4, 53.6, 1.28, 82235, 35.03, 4782.9, 2317.35, 40.49, 4.4
FROM km_equity_symbols WHERE symbol = 'GRWRHITECH'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 176.01, 176.25, 173.1, 173.98, 177.51, -3.53, -1.99, 462826, 8.09, 220.59, 158.3, 0.33, -12.34
FROM km_equity_symbols WHERE symbol = 'GSFC'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 212.0, 212.0, 206.0, 207.0, 212.0, -5.0, -2.36, 11000, 0.23, 255.15, 108.53, -0.36, 60.44
FROM km_equity_symbols WHERE symbol = 'GSMFOILS'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 308.0, 311.6, 305.35, 310.0, 310.3, -0.3, -0.1, 163099, 5.04, 360.6, 261.45, 3.94, 5.42
FROM km_equity_symbols WHERE symbol = 'GSPL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

INSERT INTO km_equity_eod (equity_id, trade_date, open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng)
SELECT id, '2026-02-14', 23.2, 23.2, 23.15, 23.2, 22.8, 0.4, 1.75, 24000, 0.06, 27.8, 5.95, NULL, NULL
FROM km_equity_symbols WHERE symbol = 'GSTL'
ON CONFLICT (equity_id, trade_date) DO NOTHING;

