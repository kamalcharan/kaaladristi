-- =============================================================================
-- km_migration_118_quant_mappings.sql
-- Target DB: kaala_dristi_db
--
-- 1. Add genuinely new sectors (ON CONFLICT (name) DO NOTHING)
-- 2. Create km_sector_zodiac + populate via name->id lookups
-- 3. Add outer-planet zodiac co-rulers to km_zodiac_lords
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. NEW SECTORS
-- -----------------------------------------------------------------------------
INSERT INTO km_sectors (name) VALUES
  ('Nickel'),
  ('Iron Ore'),
  ('Equities'),
  ('Pulses'),
  ('Currency'),
  ('Drugs'),
  ('Shoes'),
  ('Barley'),
  ('Mining'),
  ('Farming'),
  ('Pearls & Gems'),
  ('Wax Industry'),
  ('Aerial Navigation'),
  ('Aerated Water'),
  ('Government Papers'),
  ('Film Industry'),
  ('High Speed Automobiles'),
  ('Railroads & Railway'),
  ('Wireless & Telegraph'),
  ('Surgical Goods'),
  ('Aeroplanes'),
  ('Aluminum & Lession'),
  ('Raw Tea'),
  ('Raw Cotton'),
  ('Medicine & Drugs'),
  ('Premium Silk'),
  ('Coal Company Shares'),
  ('Steel Goods'),
  ('Iron Shares'),
  ('Photos'),
  ('Wooden Furniture'),
  ('Paints'),
  ('Diamonds')
ON CONFLICT (name) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 2. SECTOR ZODIAC
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS km_sector_zodiac (
  id        SERIAL PRIMARY KEY,
  sector_id INTEGER NOT NULL REFERENCES km_sectors(id),
  zodiac_id INTEGER NOT NULL REFERENCES km_zodiac_signs(id),
  UNIQUE (sector_id, zodiac_id)
);

INSERT INTO km_sector_zodiac (sector_id, zodiac_id)
SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Gold'                     AND z.name = 'Aries'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Wheat & Grains'        AND z.name = 'Aries'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Nickel'                AND z.name = 'Aries'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Copper'                AND z.name = 'Aries'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Iron Ore'              AND z.name = 'Aries'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Iron & Steel'          AND z.name = 'Aries'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Machinery'             AND z.name = 'Aries'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Cotton & Jute'         AND z.name = 'Taurus'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Metals'                AND z.name = 'Taurus'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Rice'                  AND z.name = 'Taurus'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Equities'              AND z.name = 'Taurus'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Sugar'                 AND z.name = 'Taurus'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Railways'              AND z.name = 'Gemini'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Silver'                AND z.name = 'Cancer'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Gold'                  AND z.name = 'Leo'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Leather'               AND z.name = 'Leo'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Currency'              AND z.name = 'Leo'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Vegetables'            AND z.name = 'Virgo'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Pulses'                AND z.name = 'Virgo'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Silk & Cotton'         AND z.name = 'Libra'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Chemicals'             AND z.name = 'Scorpio'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Sugar'                 AND z.name = 'Scorpio'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Iron & Steel'          AND z.name = 'Scorpio'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Leather'               AND z.name = 'Scorpio'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Salt'                  AND z.name = 'Sagittarius'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Share Trading'         AND z.name = 'Sagittarius'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Rubber'                AND z.name = 'Sagittarius'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Defence'               AND z.name = 'Sagittarius'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Navigation & Shipping' AND z.name = 'Sagittarius'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Gold'                  AND z.name = 'Capricorn'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Copper'                AND z.name = 'Capricorn'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Coal'                  AND z.name = 'Capricorn'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Glass'                 AND z.name = 'Capricorn'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Zinc'                  AND z.name = 'Capricorn'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Tin'                   AND z.name = 'Capricorn'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Electrical Goods'      AND z.name = 'Aquarius'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Photos'                AND z.name = 'Aquarius'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Paints'                AND z.name = 'Aquarius'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Wooden Furniture'      AND z.name = 'Aquarius'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Premium Silk'          AND z.name = 'Aquarius'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Coal Company Shares'   AND z.name = 'Aquarius'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Oil & Gas'             AND z.name = 'Aquarius'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Steel Goods'           AND z.name = 'Aquarius'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Iron Shares'           AND z.name = 'Aquarius'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Fishery'               AND z.name = 'Pisces'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Wax Industry'          AND z.name = 'Pisces'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Perfumes'              AND z.name = 'Pisces'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Pearls & Gems'         AND z.name = 'Pisces'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Pharma'                AND z.name = 'Pisces'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Drugs'                 AND z.name = 'Pisces'
UNION ALL SELECT s.id, z.id FROM km_sectors s, km_zodiac_signs z WHERE s.name = 'Diamonds'              AND z.name = 'Pisces'
ON CONFLICT (sector_id, zodiac_id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 3. OUTER-PLANET ZODIAC CO-RULERS
-- -----------------------------------------------------------------------------
INSERT INTO km_zodiac_lords (zodiac_id, planet_id)
SELECT z.id, p.id
FROM km_zodiac_signs z, km_planets p
WHERE (z.name, p.name) IN (
  ('Scorpio',  'Pluto'),    -- modern co-ruler (classical: Mars)
  ('Aquarius', 'Hershel'),  -- modern co-ruler (classical: Saturn)
  ('Pisces',   'Neptune')   -- modern co-ruler (classical: Jupiter)
)
ON CONFLICT (zodiac_id, planet_id) DO NOTHING;
