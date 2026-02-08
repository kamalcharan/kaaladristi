-- ============================================================================
-- KĀLA-DRISHTI MASTER DATA SEED
-- Run this AFTER km_master_tables.sql
-- ============================================================================

-- ============================================================================
-- 1. PLANETS (12 celestial bodies)
-- ============================================================================
INSERT INTO km_planets (id, name, vedic_name, category) VALUES
(1, 'Mars', NULL, 'classical'),
(2, 'Venus', NULL, 'classical'),
(3, 'Mercury', NULL, 'classical'),
(4, 'Saturn', NULL, 'classical'),
(5, 'Jupiter', NULL, 'classical'),
(6, 'Sun', NULL, 'classical'),
(7, 'Rahu', NULL, 'node'),
(8, 'Ketu', NULL, 'node'),
(9, 'Moon', NULL, 'classical'),
(10, 'Hershel', NULL, 'outer'),
(11, 'Neptune', NULL, 'outer'),
(12, 'Pluto', NULL, 'outer')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. NAKSHATRAS (27 lunar mansions, each 13°20')
-- ============================================================================
INSERT INTO km_nakshatras (id, name, start_deg, end_deg) VALUES
(1, 'Ashvini', 0.0, 13.3333),
(2, 'Bharani', 13.3333, 26.6667),
(3, 'Krithika', 26.6667, 40.0),
(4, 'Rohini', 40.0, 53.3333),
(5, 'Mrigasira', 53.3333, 66.6667),
(6, 'Arudra', 66.6667, 80.0),
(7, 'Punarvasu', 80.0, 93.3333),
(8, 'Pushya', 93.3333, 106.6667),
(9, 'Ashlesha', 106.6667, 120.0),
(10, 'Magha', 120.0, 133.3333),
(11, 'Purva Phalguni', 133.3333, 146.6667),
(12, 'Uttara Phalguni', 146.6667, 160.0),
(13, 'Hastha', 160.0, 173.3333),
(14, 'Chitra', 173.3333, 186.6667),
(15, 'Swathi', 186.6667, 200.0),
(16, 'Vishakha', 200.0, 213.3333),
(17, 'Anuradha', 213.3333, 226.6667),
(18, 'Jyestha', 226.6667, 240.0),
(19, 'Moola', 240.0, 253.3333),
(20, 'Purva Ashada', 253.3333, 266.6667),
(21, 'Uttara Ashada', 266.6667, 280.0),
(22, 'Shravana', 280.0, 293.3333),
(23, 'Dhanistha', 293.3333, 306.6667),
(24, 'Shatabhisha', 306.6667, 320.0),
(25, 'Purva Bhadra', 320.0, 333.3333),
(26, 'Uttara Bhadra', 333.3333, 346.6667),
(27, 'Revathi', 346.6667, 360.0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. NAKSHATRA LORDS (Vimshottari Dasha cycle: Ketu-Venus-Sun-Moon-Mars-Rahu-Jupiter-Saturn-Mercury x3)
-- ============================================================================
INSERT INTO km_nakshatra_lords (nakshatra_id, planet_id) VALUES
(1, 8),   -- Ashvini -> Ketu
(2, 2),   -- Bharani -> Venus
(3, 6),   -- Krithika -> Sun
(4, 9),   -- Rohini -> Moon
(5, 1),   -- Mrigasira -> Mars
(6, 7),   -- Arudra -> Rahu
(7, 5),   -- Punarvasu -> Jupiter
(8, 4),   -- Pushya -> Saturn
(9, 3),   -- Ashlesha -> Mercury
(10, 8),  -- Magha -> Ketu
(11, 2),  -- Purva Phalguni -> Venus
(12, 6),  -- Uttara Phalguni -> Sun
(13, 9),  -- Hastha -> Moon
(14, 1),  -- Chitra -> Mars
(15, 7),  -- Swathi -> Rahu
(16, 5),  -- Vishakha -> Jupiter
(17, 4),  -- Anuradha -> Saturn
(18, 3),  -- Jyestha -> Mercury
(19, 8),  -- Moola -> Ketu
(20, 2),  -- Purva Ashada -> Venus
(21, 6),  -- Uttara Ashada -> Sun
(22, 9),  -- Shravana -> Moon
(23, 1),  -- Dhanistha -> Mars
(24, 7),  -- Shatabhisha -> Rahu
(25, 5),  -- Purva Bhadra -> Jupiter
(26, 4),  -- Uttara Bhadra -> Saturn
(27, 3)   -- Revathi -> Mercury
ON CONFLICT (nakshatra_id, planet_id) DO NOTHING;

-- ============================================================================
-- 4. ZODIAC SIGNS (12 rashis)
-- ============================================================================
INSERT INTO km_zodiac_signs (id, name, element, start_deg, end_deg) VALUES
(1, 'Aries', 'Fire', 0.0, 30.0),
(2, 'Taurus', 'Earth', 30.0, 60.0),
(3, 'Gemini', 'Air', 60.0, 90.0),
(4, 'Cancer', 'Water', 90.0, 120.0),
(5, 'Leo', 'Fire', 120.0, 150.0),
(6, 'Virgo', 'Earth', 150.0, 180.0),
(7, 'Libra', 'Air', 180.0, 210.0),
(8, 'Scorpio', 'Water', 210.0, 240.0),
(9, 'Sagittarius', 'Fire', 240.0, 270.0),
(10, 'Capricorn', 'Earth', 270.0, 300.0),
(11, 'Aquarius', 'Air', 300.0, 330.0),
(12, 'Pisces', 'Water', 330.0, 360.0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. ZODIAC LORDS
-- ============================================================================
INSERT INTO km_zodiac_lords (zodiac_id, planet_id) VALUES
(1, 1),   -- Aries -> Mars
(2, 2),   -- Taurus -> Venus
(3, 3),   -- Gemini -> Mercury
(4, 9),   -- Cancer -> Moon
(5, 6),   -- Leo -> Sun
(6, 3),   -- Virgo -> Mercury
(7, 2),   -- Libra -> Venus
(8, 1),   -- Scorpio -> Mars
(9, 5),   -- Sagittarius -> Jupiter
(10, 4),  -- Capricorn -> Saturn
(11, 4),  -- Aquarius -> Saturn
(12, 5)   -- Pisces -> Jupiter
ON CONFLICT (zodiac_id, planet_id) DO NOTHING;

-- ============================================================================
-- 6. DAYS OF WEEK
-- ============================================================================
INSERT INTO km_days_of_week (id, name) VALUES
(1, 'Monday'),
(2, 'Tuesday'),
(3, 'Wednesday'),
(4, 'Thursday'),
(5, 'Friday'),
(6, 'Saturday'),
(7, 'Sunday')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. DAY LORDS (primary + secondary rulers)
-- ============================================================================
INSERT INTO km_day_lords (day_id, planet_id, is_primary) VALUES
(1, 9, TRUE),   -- Monday -> Moon
(2, 1, TRUE),   -- Tuesday -> Mars
(3, 3, TRUE),   -- Wednesday -> Mercury
(4, 5, TRUE),   -- Thursday -> Jupiter
(5, 2, TRUE),   -- Friday -> Venus
(6, 4, TRUE),   -- Saturday -> Saturn
(7, 6, TRUE),   -- Sunday -> Sun
(3, 7, FALSE),  -- Wednesday -> Rahu (secondary)
(4, 8, FALSE)   -- Thursday -> Ketu (secondary)
ON CONFLICT (day_id, planet_id) DO NOTHING;

-- ============================================================================
-- 8. SECTORS (126 unique market sectors/commodities/industries)
-- ============================================================================
INSERT INTO km_sectors (id, name) VALUES
(1, 'Iron & Steel'),
(2, 'Healthcare'),
(3, 'Pharma'),
(4, 'Metals'),
(5, 'Engineering'),
(6, 'Machinery'),
(7, 'Defence'),
(8, 'Railways'),
(9, 'Gold'),
(10, 'Rice'),
(11, 'Grams'),
(12, 'Fire Related Industry'),
(13, 'Bricks'),
(14, 'Tea / Coffee'),
(15, 'Cotton & Jute'),
(16, 'Fancy Texiles'),
(17, 'Premium Rice & Wheat'),
(18, 'lesion Silk'),
(19, 'Confectionary'),
(20, 'Precious Pearls & Gems'),
(21, 'Mirror & Glass Industries'),
(22, 'Floriculture'),
(23, 'Copper Trade'),
(24, 'Media & Entertainment'),
(25, 'Undergarments'),
(26, 'Perfumes & Scents'),
(27, 'Fruits & Spices'),
(28, 'Sentiments'),
(29, 'Wheet & Grains'),
(30, 'Silk & Cotton'),
(31, 'Textiles'),
(32, 'Sugar'),
(33, 'Telecommunication'),
(34, 'Aviation'),
(35, 'Banking & Finance'),
(36, 'FMCG'),
(37, 'Information Technology'),
(38, 'Turmeric'),
(39, 'Tin'),
(40, 'Rubber'),
(41, 'Foodprocessing'),
(42, 'Zinc'),
(43, 'Jute'),
(44, 'Silver'),
(45, 'Tobacco'),
(46, 'Share Trading'),
(47, 'Legal'),
(48, 'Cloth Mills'),
(49, 'Luxury high-end products'),
(50, 'Coal'),
(51, 'Lead'),
(52, 'Copper'),
(53, 'Cement & Cement Products'),
(54, 'Real Estate'),
(55, 'Metalurgical Products'),
(56, 'Marbles & Granites'),
(57, 'Vegetables'),
(58, 'Public Sector Enterprises (PSE)'),
(59, 'Public Sector Banks'),
(60, 'Precisous Stones'),
(61, 'Gilt'),
(62, 'Edged Securities'),
(63, 'Honey'),
(64, 'Aromatic Herbs'),
(65, 'Milk & Milk Products'),
(66, 'Petrolium'),
(67, 'Liquids'),
(68, 'Hotels'),
(69, 'Liqour'),
(70, 'Fishery'),
(71, 'Navigation & Shipping'),
(72, 'Glass'),
(73, 'Fancy Industry - Media'),
(74, 'Electrical Goods'),
(75, 'Crude Oil'),
(76, 'Oil & Gas'),
(77, 'Leather'),
(78, 'Power'),
(79, 'Infrastructure'),
(80, 'Automobiles'),
(81, 'Aeroplanes'),
(82, 'Surgical Goods'),
(83, 'Wireless & Telegraph'),
(84, 'Aerial Navigation'),
(85, 'High Speed Automobiles'),
(86, 'Railroads'),
(87, 'Government Papers'),
(88, 'Film Industry'),
(89, 'Aerated Water'),
(90, 'Aluminum'),
(91, 'Raw Tea'),
(92, 'Raw Cotton'),
(93, 'Medicine & Drugs'),
(94, 'Diamonds'),
(95, 'Consumer Durables'),
(96, 'Cement'),
(97, 'PSU'),
(98, 'CPSE'),
(99, 'Financial Services'),
(100, 'Private Banks'),
(101, 'Commodities'),
(102, 'Growth Sectors'),
(103, 'India Consumption'),
(104, 'India Digital'),
(105, 'India Manufacturing'),
(106, 'Services Sector'),
(107, 'ESG'),
(108, 'Energy'),
(109, 'Auto'),
(110, 'Realty'),
(111, 'MNC'),
(112, 'Digital'),
(113, 'Luxury'),
(114, 'Gems & Jewellery'),
(115, 'Chemicals'),
(116, 'Paints'),
(117, 'Paper'),
(118, 'Shipping'),
(119, 'Tyres'),
(120, 'Fertilizers'),
(121, 'Plastics'),
(122, 'Packaging'),
(123, 'Brewery'),
(124, 'Edible Oil'),
(125, 'Ceramic'),
(126, 'Agri')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9. SECTOR LORDS (planet-to-sector mapping from sectorlord.csv)
-- ============================================================================
INSERT INTO km_sector_lords (sector_id, planet_id) VALUES
-- Mars (1) rules:
(1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1), (7, 1), (8, 1),
(9, 1), (10, 1), (11, 1), (12, 1), (13, 1), (14, 1),
-- Venus (2) rules:
(15, 2), (16, 2), (17, 2), (18, 2), (19, 2), (20, 2), (21, 2),
(22, 2), (23, 2), (24, 2), (25, 2), (26, 2), (27, 2),
-- Mercury (3) rules:
(28, 3), (29, 3), (30, 3), (31, 3), (32, 3), (33, 3), (34, 3),
(35, 3), (36, 3), (37, 3),
-- Saturn (4) rules:
(50, 4), (51, 4), (52, 4), (53, 4), (54, 4), (55, 4), (56, 4), (57, 4),
-- Jupiter (5) rules:
(38, 5), (39, 5), (40, 5), (41, 5), (42, 5), (43, 5), (44, 5),
(45, 5), (46, 5), (35, 5), (47, 5), (48, 5), (49, 5),
-- Sun (6) rules:
(58, 6), (59, 6), (60, 6), (61, 6), (62, 6), (10, 6), (63, 6),
(64, 6), (9, 6),
-- Rahu (7) rules:
(73, 7), (24, 7), (33, 7), (37, 7), (74, 7), (75, 7), (3, 7),
-- Ketu (8) rules:
(50, 8), (37, 8), (76, 8), (77, 8), (78, 8), (79, 8), (80, 8), (52, 8),
-- Moon (9) rules:
(44, 9), (65, 9), (66, 9), (67, 9), (68, 9), (69, 9), (70, 9),
(71, 9), (72, 9),
-- Hershel/Uranus (10) rules:
(74, 10), (81, 10), (82, 10), (83, 10), (71, 10), (84, 10),
(85, 10), (86, 10), (58, 10), (87, 10), (88, 10), (89, 10), (90, 10),
-- Neptune (11) rules:
(91, 11), (92, 11), (93, 11), (82, 11), (76, 11), (70, 11), (45, 11),
-- Pluto (12) rules:
(39, 12), (52, 12), (42, 12), (40, 12), (77, 12)
ON CONFLICT (sector_id, planet_id) DO NOTHING;

-- ============================================================================
-- 10. INDEX MASTER
-- ============================================================================
INSERT INTO km_index_master (symbol, name, yahoo_ticker) VALUES
('NIFTY', 'NIFTY 50', '^NSEI'),
('BANKNIFTY', 'NIFTY Bank', '^NSEBANK'),
('NIFTYIT', 'NIFTY IT', '^CNXIT'),
('NIFTYFMCG', 'NIFTY FMCG', NULL),
('NIFTYPHARMA', 'NIFTY Pharma', NULL),
('NIFTYMETAL', 'NIFTY Metal', NULL),
('NIFTYREALTY', 'NIFTY Realty', NULL),
('NIFTYAUTO', 'NIFTY Auto', NULL),
('NIFTYENERGY', 'NIFTY Energy', NULL),
('NIFTYPSU', 'NIFTY PSU Bank', NULL),
('NIFTYINFRA', 'NIFTY Infrastructure', NULL),
('NIFTYMEDIA', 'NIFTY Media', NULL),
('NIFTYFINSERV', 'NIFTY Financial Services', NULL)
ON CONFLICT (symbol) DO NOTHING;

-- ============================================================================
-- 11. INDEX COMPOSITION (sample - NIFTY 50 constituents as of Jan 8 2024)
-- ============================================================================
-- NIFTY 50
INSERT INTO km_index_composition (index_id, stock_symbol, snapshot_date)
SELECT id, unnest(ARRAY[
    'ADANIENT','ADANIPORTS','APOLLOHOSP','ASIANPAINT','AXISBANK',
    'BAJAJ-AUTO','BAJAJFINSV','BAJFINANCE','BEL','BHARTIARTL',
    'BPCL','BRITANNIA','CIPLA','COALINDIA','DIVISLAB',
    'DRREDDY','EICHERMOT','ETERNAL','GRASIM','HCLTECH',
    'HDFC','HDFCBANK','HDFCLIFE','HEROMOTOCO','HINDALCO',
    'HINDUNILVR','ICICIBANK','INDUSINDBK','INFY','ITC',
    'JSWSTEEL','KOTAKBANK','LT','LTIM','M&M',
    'MARUTI','NESTLEIND','NTPC','ONGC','POWERGRID',
    'RELIANCE','SBILIFE','SBIN','SHRIRAMFIN','SUNPHARMA',
    'TATACONSUM','TATAMOTORS','TATASTEEL','TCS','TECHM',
    'TITAN','TRENT','ULTRACEMCO','WIPRO'
]), '2024-01-08'
FROM km_index_master WHERE symbol = 'NIFTY'
ON CONFLICT DO NOTHING;

-- BANKNIFTY
INSERT INTO km_index_composition (index_id, stock_symbol, snapshot_date)
SELECT id, unnest(ARRAY[
    'AUBANK','AXISBANK','BANDHANBNK','BANKBARODA','CANBK',
    'FEDERALBNK','HDFCBANK','ICICIBANK','IDFCFIRSTB','INDUSINDBK',
    'KOTAKBANK','PNB','SBIN'
]), '2024-01-08'
FROM km_index_master WHERE symbol = 'BANKNIFTY'
ON CONFLICT DO NOTHING;

-- NIFTY IT
INSERT INTO km_index_composition (index_id, stock_symbol, snapshot_date)
SELECT id, unnest(ARRAY[
    'COFORGE','HCLTECH','INFY','LTIM','LTTS',
    'MPHASIS','PERSISTENT','TATAELXSI','TCS','TECHM','WIPRO'
]), '2024-01-08'
FROM km_index_master WHERE symbol = 'NIFTYIT'
ON CONFLICT DO NOTHING;

-- NIFTY FMCG
INSERT INTO km_index_composition (index_id, stock_symbol, snapshot_date)
SELECT id, unnest(ARRAY[
    'BRITANNIA','COLPAL','DABUR','GODREJCP','HINDUNILVR',
    'ITC','MARICO','NESTLEIND','TATACONSUM','UBL','VBL'
]), '2024-01-08'
FROM km_index_master WHERE symbol = 'NIFTYFMCG'
ON CONFLICT DO NOTHING;
