-- km_migration_102_gandanta_rules_seed.sql
-- Target database: kaala_dristi_db
--
-- Seeds 6 Mars Gandanta rules into km_astro_rule_master.
-- Gandanta = water/fire sign junctions (Cancer/Leo, Scorpio/Sagittarius, Pisces/Aries).
-- Run in pgAdmin / DBeaver / psql — do not run automatically.
-- After running: execute generate_gandanta_windows.py to populate km_rule_transits.

INSERT INTO km_astro_rule_master
  (rule_code, rule_type, display_name, planet_1, planet_2,
   base_bias, probability_label, tags,
   is_active, catalog_visible, is_deleted, remarks)
VALUES
(
  'MAR-GAN-CAN-BEA',
  'planet_transit',
  'Mars Gandanta Cancer Exit',
  'Mars', null,
  'bearish', 'High',
  ARRAY['Gandanta', 'Transit', 'MajorTransit'],
  true, true, false,
  'Mars transiting 28°-30° Cancer (Gandanta zone). Planet loses discriminative faculty at water sign ending. Markets show exhaustion rallies or panic selloffs, smart money exits, VIX builds quietly. False breakouts common. Energy/defense/metals show erratic moves.'
),
(
  'MAR-GAN-LEO-REV',
  'planet_transit',
  'Mars Gandanta Leo Entry',
  'Mars', null,
  'turning', 'High',
  ARRAY['Gandanta', 'Transit', 'MajorTransit'],
  true, true, false,
  'Mars entering 0°-1° Leo (fire ingress after Gandanta). The miracle zone — sudden directional clarity after confusion. Strong trending day often opposite to prior exhaustion move. Classic reversal trap at exact 0° crossing: false breakout/breakdown, gaps filled same session.'
),
(
  'MAR-GAN-SCO-BEA',
  'planet_transit',
  'Mars Gandanta Scorpio Exit',
  'Mars', null,
  'bearish', 'High',
  ARRAY['Gandanta', 'Transit', 'MajorTransit'],
  true, true, false,
  'Mars transiting 28°-30° Scorpio (Gandanta zone). Jyeshtha nakshatra endings carry maximum karmic residue. Markets act without grounding — volumes spike but direction confused. Legal/conflict matters surface. For traders: reversal traps, premature entries common.'
),
(
  'MAR-GAN-SAG-REV',
  'planet_transit',
  'Mars Gandanta Sagittarius Entry',
  'Mars', null,
  'turning', 'High',
  ARRAY['Gandanta', 'Transit', 'MajorTransit'],
  true, true, false,
  'Mars entering 0°-1° Sagittarius after Scorpio Gandanta. Fire ingress brings sudden clarity. Index reversal day — looks decisive initially. Options writers burned on both sides at exact 0°. 1° into sign: whoever held conviction through chaos gets rewarded.'
),
(
  'MAR-GAN-PIS-BEA',
  'planet_transit',
  'Mars Gandanta Pisces Exit',
  'Mars', null,
  'bearish', 'High',
  ARRAY['Gandanta', 'Transit', 'MajorTransit'],
  true, true, false,
  'Mars transiting 28°-30° Pisces (Revati nakshatra endings — most sensitive Gandanta). Planet drowning before rebirth. New ventures launched now need restart. Real estate stalls, no follow-through. Impulsive decisions bypass normal risk filtering.'
),
(
  'MAR-GAN-ARI-REV',
  'planet_transit',
  'Mars Gandanta Aries Entry',
  'Mars', null,
  'turning', 'Very High',
  ARRAY['Gandanta', 'Transit', 'MajorTransit'],
  true, true, false,
  'Mars entering 0°-1° Aries — most powerful Gandanta crossing (own sign). The miracle window. Strongest reversal signal of all 6 Gandanta transitions. Mars reborn in its own fire sign after drowning in Pisces. Sudden explosive directional move, often marking a significant market turning point.'
)
ON CONFLICT (rule_code) DO NOTHING;

-- ── Verify ───────────────────────────────────────────────────────────────────

SELECT rule_code, display_name, base_bias, catalog_visible
FROM km_astro_rule_master
WHERE 'Gandanta' = ANY(tags)
ORDER BY rule_code;
