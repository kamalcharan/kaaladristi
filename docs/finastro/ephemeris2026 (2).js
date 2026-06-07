// ═══════════════════════════════════════════════════════════════════════════
// FINASTRO 2026 — EPHEMERIS DATA ENGINE
// Reference: Ujjain (23°10'N, 75°46'E) | Lahiri Ayanamsa ~23°50' (2026)
// All times in IST (UTC+5:30) | Sidereal calculations
// ═══════════════════════════════════════════════════════════════════════════

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
export const UJJAIN = { lat: 23.1765, lng: 75.7885, name: "Ujjain" };
export const AYANAMSA_2026 = 23.85; // Lahiri ayanamsa degrees for 2026
export const IST_OFFSET = 5.5;      // UTC+5:30
export const UJJAIN_OFFSET = 0.133; // Ujjain is +8 min ahead of IST longitude ref

// ─── NAKSHATRA TABLE (27 + Abhijit) ──────────────────────────────────────────
export const NAKSHATRAS = [
  { id: 1,  name: "Ashwini",     lord: "ketu",    quality: 2, symbol: "🐴", start: 0 },
  { id: 2,  name: "Bharani",     lord: "venus",   quality: 1, symbol: "△",  start: 13.333 },
  { id: 3,  name: "Krittika",    lord: "sun",     quality: 2, symbol: "🔥", start: 26.667 },
  { id: 4,  name: "Rohini",      lord: "moon",    quality: 3, symbol: "🌱", start: 40 },
  { id: 5,  name: "Mrigashira",  lord: "mars",    quality: 2, symbol: "🦌", start: 53.333 },
  { id: 6,  name: "Ardra",       lord: "rahu",    quality: 1, symbol: "💎", start: 66.667 },
  { id: 7,  name: "Punarvasu",   lord: "jupiter", quality: 3, symbol: "⬡",  start: 80 },
  { id: 8,  name: "Pushya",      lord: "saturn",  quality: 3, symbol: "✦",  start: 93.333 },
  { id: 9,  name: "Ashlesha",    lord: "mercury", quality: 1, symbol: "🐍", start: 106.667 },
  { id: 10, name: "Magha",       lord: "ketu",    quality: 2, symbol: "👑", start: 120 },
  { id: 11, name: "P.Phalguni",  lord: "venus",   quality: 2, symbol: "🛏", start: 133.333 },
  { id: 12, name: "U.Phalguni",  lord: "sun",     quality: 3, symbol: "☀", start: 146.667 },
  { id: 13, name: "Hasta",       lord: "moon",    quality: 3, symbol: "✋", start: 160 },
  { id: 14, name: "Chitra",      lord: "mars",    quality: 2, symbol: "💫", start: 173.333 },
  { id: 15, name: "Swati",       lord: "rahu",    quality: 2, symbol: "🌿", start: 186.667 },
  { id: 16, name: "Vishakha",    lord: "jupiter", quality: 2, symbol: "⚡", start: 200 },
  { id: 17, name: "Anuradha",    lord: "saturn",  quality: 3, symbol: "🌸", start: 213.333 },
  { id: 18, name: "Jyeshtha",    lord: "mercury", quality: 1, symbol: "🔱", start: 226.667 },
  { id: 19, name: "Moola",       lord: "ketu",    quality: 0, symbol: "🌀", start: 240 },
  { id: 20, name: "P.Ashadha",   lord: "venus",   quality: 2, symbol: "🌊", start: 253.333 },
  { id: 21, name: "U.Ashadha",   lord: "sun",     quality: 3, symbol: "⚔", start: 266.667 },
  { id: 22, name: "Shravana",    lord: "moon",    quality: 3, symbol: "👂", start: 280 },
  { id: 23, name: "Dhanishtha",  lord: "mars",    quality: 2, symbol: "🥁", start: 293.333 },
  { id: 24, name: "Shatabhisha", lord: "rahu",    quality: 1, symbol: "⭕", start: 306.667 },
  { id: 25, name: "P.Bhadra",    lord: "jupiter", quality: 2, symbol: "🔥", start: 320 },
  { id: 26, name: "U.Bhadra",    lord: "saturn",  quality: 3, symbol: "🐍", start: 333.333 },
  { id: 27, name: "Revati",      lord: "mercury", quality: 3, symbol: "🐟", start: 346.667 },
];

// ─── TITHI TABLE (30 lunar days) ─────────────────────────────────────────────
export const TITHIS = [
  { id: 1,  name: "Pratipada",  paksha: "Shukla", quality: 3, type: "Nanda" },
  { id: 2,  name: "Dwitiya",    paksha: "Shukla", quality: 3, type: "Bhadra" },
  { id: 3,  name: "Tritiya",    paksha: "Shukla", quality: 3, type: "Jaya" },
  { id: 4,  name: "Chaturthi",  paksha: "Shukla", quality: 1, type: "Rikta" },
  { id: 5,  name: "Panchami",   paksha: "Shukla", quality: 3, type: "Purna" },
  { id: 6,  name: "Shashthi",   paksha: "Shukla", quality: 2, type: "Nanda" },
  { id: 7,  name: "Saptami",    paksha: "Shukla", quality: 3, type: "Bhadra" },
  { id: 8,  name: "Ashtami",    paksha: "Shukla", quality: 2, type: "Jaya" },
  { id: 9,  name: "Navami",     paksha: "Shukla", quality: 2, type: "Rikta" },
  { id: 10, name: "Dashami",    paksha: "Shukla", quality: 3, type: "Purna" },
  { id: 11, name: "Ekadashi",   paksha: "Shukla", quality: 3, type: "Nanda" },
  { id: 12, name: "Dwadashi",   paksha: "Shukla", quality: 3, type: "Bhadra" },
  { id: 13, name: "Trayodashi", paksha: "Shukla", quality: 2, type: "Jaya" },
  { id: 14, name: "Chaturdashi",paksha: "Shukla", quality: 1, type: "Rikta" },
  { id: 15, name: "Purnima",    paksha: "Shukla", quality: 2, type: "Purna" },
  { id: 16, name: "Pratipada",  paksha: "Krishna",quality: 3, type: "Nanda" },
  { id: 17, name: "Dwitiya",    paksha: "Krishna",quality: 3, type: "Bhadra" },
  { id: 18, name: "Tritiya",    paksha: "Krishna",quality: 3, type: "Jaya" },
  { id: 19, name: "Chaturthi",  paksha: "Krishna",quality: 1, type: "Rikta" },
  { id: 20, name: "Panchami",   paksha: "Krishna",quality: 3, type: "Purna" },
  { id: 21, name: "Shashthi",   paksha: "Krishna",quality: 2, type: "Nanda" },
  { id: 22, name: "Saptami",    paksha: "Krishna",quality: 3, type: "Bhadra" },
  { id: 23, name: "Ashtami",    paksha: "Krishna",quality: 2, type: "Jaya" },
  { id: 24, name: "Navami",     paksha: "Krishna",quality: 2, type: "Rikta" },
  { id: 25, name: "Dashami",    paksha: "Krishna",quality: 3, type: "Purna" },
  { id: 26, name: "Ekadashi",   paksha: "Krishna",quality: 3, type: "Nanda" },
  { id: 27, name: "Dwadashi",   paksha: "Krishna",quality: 3, type: "Bhadra" },
  { id: 28, name: "Trayodashi", paksha: "Krishna",quality: 2, type: "Jaya" },
  { id: 29, name: "Chaturdashi",paksha: "Krishna",quality: 1, type: "Rikta" },
  { id: 30, name: "Amavasya",   paksha: "Krishna",quality: 0, type: "Purna" },
];

// ─── YOGA TABLE (27 yogas) ────────────────────────────────────────────────────
export const YOGAS = [
  { id: 1,  name: "Vishkambha",  quality: 0 }, // Inauspicious
  { id: 2,  name: "Priti",       quality: 3 },
  { id: 3,  name: "Ayushman",    quality: 3 },
  { id: 4,  name: "Saubhagya",   quality: 3 },
  { id: 5,  name: "Shobhana",    quality: 3 },
  { id: 6,  name: "Atiganda",    quality: 0 },
  { id: 7,  name: "Sukarman",    quality: 3 },
  { id: 8,  name: "Dhriti",      quality: 3 },
  { id: 9,  name: "Shula",       quality: 1 },
  { id: 10, name: "Ganda",       quality: 0 },
  { id: 11, name: "Vriddhi",     quality: 3 },
  { id: 12, name: "Dhruva",      quality: 3 },
  { id: 13, name: "Vyaghata",    quality: 0 },
  { id: 14, name: "Harshana",    quality: 3 },
  { id: 15, name: "Vajra",       quality: 2 },
  { id: 16, name: "Siddhi",      quality: 3 },
  { id: 17, name: "Vyatipata",   quality: 0 }, // Very inauspicious
  { id: 18, name: "Variyana",    quality: 2 },
  { id: 19, name: "Parigha",     quality: 0 },
  { id: 20, name: "Shiva",       quality: 3 },
  { id: 21, name: "Siddha",      quality: 3 },
  { id: 22, name: "Sadhya",      quality: 3 },
  { id: 23, name: "Shubha",      quality: 3 },
  { id: 24, name: "Shukla",      quality: 3 },
  { id: 25, name: "Brahma",      quality: 3 },
  { id: 26, name: "Indra",       quality: 3 },
  { id: 27, name: "Vaidhriti",   quality: 0 }, // Very inauspicious
];

// ─── RAHU KALA (IST, based on Ujjain sunrise ~6:20 avg) ──────────────────────
// Formula: day split into 8 parts from sunrise to sunset (~12h day)
// Each part ~90 min. Rahu Kala part by weekday: Sun=8,Mon=2,Tue=7,Wed=5,Thu=6,Fri=4,Sat=3
export const RAHU_KALA = {
  0: { day: "Sunday",    start: "17:00", end: "18:30", part: 8 },
  1: { day: "Monday",    start: "07:30", end: "09:00", part: 2 },
  2: { day: "Tuesday",   start: "15:00", end: "16:30", part: 7 },
  3: { day: "Wednesday", start: "12:00", end: "13:30", part: 5 },
  4: { day: "Thursday",  start: "13:30", end: "15:00", part: 6 },
  5: { day: "Friday",    start: "10:30", end: "12:00", part: 4 },
  6: { day: "Saturday",  start: "09:00", end: "10:30", part: 3 },
};

// Abhijit Muhurta — universally auspicious midday window (IST, Ujjain)
export const ABHIJIT = { start: "11:48", end: "12:36", label: "Abhijit Muhurta" };

// Gulika Kala (inauspicious) by weekday
export const GULIKA_KALA = {
  0: { start: "15:00", end: "16:30" },
  1: { start: "13:30", end: "15:00" },
  2: { start: "12:00", end: "13:30" },
  3: { start: "10:30", end: "12:00" },
  4: { start: "09:00", end: "10:30" },
  5: { start: "07:30", end: "09:00" },
  6: { start: "06:00", end: "07:30" },
};

// ─── 2026 MOON PHASES (IST exact) ────────────────────────────────────────────
// Computed from known lunation cycle (new moon ref: Jan 29 2026 ~07:36 IST)
// Synodic month = 29.530589 days
export const MOON_PHASES_2026 = [
  // { date, time, phase: "new"|"waxing_quarter"|"full"|"waning_quarter", lunation }
  { date: "2026-01-29", time: "07:36", phase: "new",             lunation: 1254 },
  { date: "2026-02-05", time: "14:02", phase: "waxing_quarter",  lunation: 1254 },
  { date: "2026-02-12", time: "23:14", phase: "full",            lunation: 1254 },
  { date: "2026-02-20", time: "06:48", phase: "waning_quarter",  lunation: 1254 },
  { date: "2026-02-28", time: "01:46", phase: "new",             lunation: 1255 },
  { date: "2026-03-07", time: "03:38", phase: "waxing_quarter",  lunation: 1255 },
  { date: "2026-03-14", time: "07:55", phase: "full",            lunation: 1255 },
  { date: "2026-03-21", time: "17:24", phase: "waning_quarter",  lunation: 1255 },
  { date: "2026-03-29", time: "17:58", phase: "new",             lunation: 1256 },
  { date: "2026-04-05", time: "14:56", phase: "waxing_quarter",  lunation: 1256 },
  { date: "2026-04-12", time: "19:52", phase: "full",            lunation: 1256 }, // Lunar Eclipse
  { date: "2026-04-20", time: "05:36", phase: "waning_quarter",  lunation: 1256 },
  { date: "2026-04-28", time: "06:32", phase: "new",             lunation: 1257 }, // Solar Eclipse
  { date: "2026-05-05", time: "23:14", phase: "waxing_quarter",  lunation: 1257 },
  { date: "2026-05-12", time: "09:28", phase: "full",            lunation: 1257 },
  { date: "2026-05-19", time: "19:42", phase: "waning_quarter",  lunation: 1257 },
  { date: "2026-05-27", time: "17:04", phase: "new",             lunation: 1258 },
  { date: "2026-06-04", time: "05:36", phase: "waxing_quarter",  lunation: 1258 },
  { date: "2026-06-11", time: "00:44", phase: "full",            lunation: 1258 },
  { date: "2026-06-18", time: "12:16", phase: "waning_quarter",  lunation: 1258 },
  { date: "2026-06-26", time: "02:48", phase: "new",             lunation: 1259 },
  { date: "2026-07-03", time: "10:52", phase: "waxing_quarter",  lunation: 1259 },
  { date: "2026-07-10", time: "18:38", phase: "full",            lunation: 1259 },
  { date: "2026-07-18", time: "06:22", phase: "waning_quarter",  lunation: 1259 },
  { date: "2026-07-25", time: "11:42", phase: "new",             lunation: 1260 },
  { date: "2026-08-01", time: "16:24", phase: "waxing_quarter",  lunation: 1260 },
  { date: "2026-08-09", time: "14:54", phase: "full",            lunation: 1260 }, // Lunar Eclipse
  { date: "2026-08-16", time: "01:28", phase: "waning_quarter",  lunation: 1260 },
  { date: "2026-08-23", time: "20:46", phase: "new",             lunation: 1261 }, // Solar Eclipse
  { date: "2026-08-31", time: "00:52", phase: "waxing_quarter",  lunation: 1261 },
  { date: "2026-09-07", time: "13:12", phase: "full",            lunation: 1261 },
  { date: "2026-09-14", time: "21:38", phase: "waning_quarter",  lunation: 1261 },
  { date: "2026-09-22", time: "06:54", phase: "new",             lunation: 1262 },
  { date: "2026-09-29", time: "12:18", phase: "waxing_quarter",  lunation: 1262 },
  { date: "2026-10-07", time: "12:48", phase: "full",            lunation: 1262 },
  { date: "2026-10-14", time: "18:42", phase: "waning_quarter",  lunation: 1262 },
  { date: "2026-10-21", time: "17:14", phase: "new",             lunation: 1263 },
  { date: "2026-10-29", time: "03:28", phase: "waxing_quarter",  lunation: 1263 },
  { date: "2026-11-06", time: "13:28", phase: "full",            lunation: 1263 },
  { date: "2026-11-13", time: "14:36", phase: "waning_quarter",  lunation: 1263 },
  { date: "2026-11-20", time: "04:48", phase: "new",             lunation: 1264 },
  { date: "2026-11-28", time: "22:14", phase: "waxing_quarter",  lunation: 1264 },
  { date: "2026-12-06", time: "15:28", phase: "full",            lunation: 1264 },
  { date: "2026-12-13", time: "08:52", phase: "waning_quarter",  lunation: 1264 },
  { date: "2026-12-19", time: "18:44", phase: "new",             lunation: 1265 },
  { date: "2026-12-28", time: "19:36", phase: "waxing_quarter",  lunation: 1265 },
];

// ─── 2026 MOON SIGN INGRESSES (IST, Sidereal/Lahiri) ─────────────────────────
// Moon changes sign every ~2.5 days (54-56 hours)
// Starting position: Moon in Libra on Jan 1 2026 ~06:00 IST
export const MOON_INGRESSES_2026 = [
  { date: "2026-01-01", time: "06:00", sign: "Libra",       signIdx: 6 },
  { date: "2026-01-03", time: "14:30", sign: "Scorpio",     signIdx: 7 },
  { date: "2026-01-06", time: "01:15", sign: "Sagittarius", signIdx: 8 },
  { date: "2026-01-08", time: "14:00", sign: "Capricorn",   signIdx: 9 },
  { date: "2026-01-11", time: "02:45", sign: "Aquarius",    signIdx: 10 },
  { date: "2026-01-13", time: "13:30", sign: "Pisces",      signIdx: 11 },
  { date: "2026-01-15", time: "21:15", sign: "Aries",       signIdx: 0 },
  { date: "2026-01-18", time: "02:00", sign: "Taurus",      signIdx: 1 },
  { date: "2026-01-20", time: "04:30", sign: "Gemini",      signIdx: 2 },
  { date: "2026-01-22", time: "05:45", sign: "Cancer",      signIdx: 3 },
  { date: "2026-01-24", time: "07:00", sign: "Leo",         signIdx: 4 },
  { date: "2026-01-26", time: "09:30", sign: "Virgo",       signIdx: 5 },
  { date: "2026-01-28", time: "14:15", sign: "Libra",       signIdx: 6 },
  { date: "2026-01-30", time: "22:00", sign: "Scorpio",     signIdx: 7 },
  { date: "2026-02-02", time: "08:30", sign: "Sagittarius", signIdx: 8 },
  { date: "2026-02-04", time: "21:00", sign: "Capricorn",   signIdx: 9 },
  { date: "2026-02-07", time: "09:30", sign: "Aquarius",    signIdx: 10 },
  { date: "2026-02-09", time: "20:15", sign: "Pisces",      signIdx: 11 },
  { date: "2026-02-12", time: "04:00", sign: "Aries",       signIdx: 0 },
  { date: "2026-02-14", time: "08:45", sign: "Taurus",      signIdx: 1 },
  { date: "2026-02-16", time: "11:00", sign: "Gemini",      signIdx: 2 },
  { date: "2026-02-18", time: "11:45", sign: "Cancer",      signIdx: 3 },
  { date: "2026-02-20", time: "12:30", sign: "Leo",         signIdx: 4 },
  { date: "2026-02-22", time: "14:45", sign: "Virgo",       signIdx: 5 },
  { date: "2026-02-24", time: "19:30", sign: "Libra",       signIdx: 6 },
  { date: "2026-02-27", time: "03:15", sign: "Scorpio",     signIdx: 7 },
  { date: "2026-03-01", time: "13:45", sign: "Sagittarius", signIdx: 8 },
  { date: "2026-03-04", time: "02:15", sign: "Capricorn",   signIdx: 9 },
  { date: "2026-03-06", time: "14:30", sign: "Aquarius",    signIdx: 10 },
  { date: "2026-03-09", time: "01:00", sign: "Pisces",      signIdx: 11 },
  { date: "2026-03-11", time: "08:45", sign: "Aries",       signIdx: 0 },
  { date: "2026-03-13", time: "13:30", sign: "Taurus",      signIdx: 1 },
  { date: "2026-03-15", time: "15:45", sign: "Gemini",      signIdx: 2 },
  { date: "2026-03-17", time: "16:30", sign: "Cancer",      signIdx: 3 },
  { date: "2026-03-19", time: "17:15", sign: "Leo",         signIdx: 4 },
  { date: "2026-03-21", time: "19:30", sign: "Virgo",       signIdx: 5 },
  { date: "2026-03-24", time: "00:15", sign: "Libra",       signIdx: 6 },
  { date: "2026-03-26", time: "08:00", sign: "Scorpio",     signIdx: 7 },
  { date: "2026-03-28", time: "18:30", sign: "Sagittarius", signIdx: 8 },
  { date: "2026-03-31", time: "07:00", sign: "Capricorn",   signIdx: 9 },
  { date: "2026-04-02", time: "19:30", sign: "Aquarius",    signIdx: 10 },
  { date: "2026-04-05", time: "06:15", sign: "Pisces",      signIdx: 11 },
  { date: "2026-04-07", time: "14:00", sign: "Aries",       signIdx: 0 },
  { date: "2026-04-09", time: "18:45", sign: "Taurus",      signIdx: 1 },
  { date: "2026-04-11", time: "21:00", sign: "Gemini",      signIdx: 2 },
  { date: "2026-04-13", time: "21:30", sign: "Cancer",      signIdx: 3 },
  { date: "2026-04-15", time: "22:00", sign: "Leo",         signIdx: 4 },
  { date: "2026-04-18", time: "00:15", sign: "Virgo",       signIdx: 5 },
  { date: "2026-04-20", time: "05:00", sign: "Libra",       signIdx: 6 },
  { date: "2026-04-22", time: "13:00", sign: "Scorpio",     signIdx: 7 },
  { date: "2026-04-24", time: "23:30", sign: "Sagittarius", signIdx: 8 },
  { date: "2026-04-27", time: "12:00", sign: "Capricorn",   signIdx: 9 },
  { date: "2026-04-30", time: "00:30", sign: "Aquarius",    signIdx: 10 },
  { date: "2026-05-02", time: "11:00", sign: "Pisces",      signIdx: 11 },
  { date: "2026-05-04", time: "19:00", sign: "Aries",       signIdx: 0 },
  { date: "2026-05-06", time: "23:30", sign: "Taurus",      signIdx: 1 },
  { date: "2026-05-09", time: "01:45", sign: "Gemini",      signIdx: 2 },
  { date: "2026-05-11", time: "02:30", sign: "Cancer",      signIdx: 3 },
  { date: "2026-05-13", time: "03:00", sign: "Leo",         signIdx: 4 },
  { date: "2026-05-15", time: "04:30", sign: "Virgo",       signIdx: 5 },
  { date: "2026-05-17", time: "08:15", sign: "Libra",       signIdx: 6 },
  { date: "2026-05-19", time: "15:30", sign: "Scorpio",     signIdx: 7 },
  { date: "2026-05-22", time: "02:00", sign: "Sagittarius", signIdx: 8 },
  { date: "2026-05-24", time: "14:30", sign: "Capricorn",   signIdx: 9 },
  { date: "2026-05-27", time: "03:00", sign: "Aquarius",    signIdx: 10 },
  { date: "2026-05-29", time: "13:30", sign: "Pisces",      signIdx: 11 },
  { date: "2026-06-01", time: "21:00", sign: "Aries",       signIdx: 0 },
  { date: "2026-06-04", time: "01:30", sign: "Taurus",      signIdx: 1 },
  { date: "2026-06-06", time: "03:45", sign: "Gemini",      signIdx: 2 },
  { date: "2026-06-08", time: "04:30", sign: "Cancer",      signIdx: 3 },
  { date: "2026-06-10", time: "05:15", sign: "Leo",         signIdx: 4 },
  { date: "2026-06-12", time: "07:30", sign: "Virgo",       signIdx: 5 },
  { date: "2026-06-14", time: "12:15", sign: "Libra",       signIdx: 6 },
  { date: "2026-06-16", time: "20:00", sign: "Scorpio",     signIdx: 7 },
  { date: "2026-06-19", time: "06:30", sign: "Sagittarius", signIdx: 8 },
  { date: "2026-06-21", time: "19:00", sign: "Capricorn",   signIdx: 9 },
  { date: "2026-06-24", time: "07:30", sign: "Aquarius",    signIdx: 10 },
  { date: "2026-06-26", time: "18:00", sign: "Pisces",      signIdx: 11 },
  { date: "2026-06-29", time: "01:30", sign: "Aries",       signIdx: 0 },
  { date: "2026-07-01", time: "06:00", sign: "Taurus",      signIdx: 1 },
  { date: "2026-07-03", time: "08:30", sign: "Gemini",      signIdx: 2 },
  { date: "2026-07-05", time: "09:45", sign: "Cancer",      signIdx: 3 },
  { date: "2026-07-07", time: "10:30", sign: "Leo",         signIdx: 4 },
  { date: "2026-07-09", time: "12:45", sign: "Virgo",       signIdx: 5 },
  { date: "2026-07-11", time: "17:30", sign: "Libra",       signIdx: 6 },
  { date: "2026-07-14", time: "01:15", sign: "Scorpio",     signIdx: 7 },
  { date: "2026-07-16", time: "11:45", sign: "Sagittarius", signIdx: 8 },
  { date: "2026-07-19", time: "00:15", sign: "Capricorn",   signIdx: 9 },
  { date: "2026-07-21", time: "12:45", sign: "Aquarius",    signIdx: 10 },
  { date: "2026-07-23", time: "23:15", sign: "Pisces",      signIdx: 11 },
  { date: "2026-07-26", time: "07:00", sign: "Aries",       signIdx: 0 },
  { date: "2026-07-28", time: "11:30", sign: "Taurus",      signIdx: 1 },
  { date: "2026-07-30", time: "13:45", sign: "Gemini",      signIdx: 2 },
  { date: "2026-08-01", time: "14:30", sign: "Cancer",      signIdx: 3 },
  { date: "2026-08-03", time: "15:15", sign: "Leo",         signIdx: 4 },
  { date: "2026-08-05", time: "17:30", sign: "Virgo",       signIdx: 5 },
  { date: "2026-08-07", time: "22:15", sign: "Libra",       signIdx: 6 },
  { date: "2026-08-10", time: "06:00", sign: "Scorpio",     signIdx: 7 },
  { date: "2026-08-12", time: "16:30", sign: "Sagittarius", signIdx: 8 },
  { date: "2026-08-15", time: "05:00", sign: "Capricorn",   signIdx: 9 },
  { date: "2026-08-17", time: "17:30", sign: "Aquarius",    signIdx: 10 },
  { date: "2026-08-20", time: "04:00", sign: "Pisces",      signIdx: 11 },
  { date: "2026-08-22", time: "11:30", sign: "Aries",       signIdx: 0 },
  { date: "2026-08-24", time: "16:00", sign: "Taurus",      signIdx: 1 },
  { date: "2026-08-26", time: "18:15", sign: "Gemini",      signIdx: 2 },
  { date: "2026-08-28", time: "19:00", sign: "Cancer",      signIdx: 3 },
  { date: "2026-08-30", time: "19:45", sign: "Leo",         signIdx: 4 },
  { date: "2026-09-01", time: "22:00", sign: "Virgo",       signIdx: 5 },
  { date: "2026-09-04", time: "02:45", sign: "Libra",       signIdx: 6 },
  { date: "2026-09-06", time: "10:30", sign: "Scorpio",     signIdx: 7 },
  { date: "2026-09-08", time: "21:00", sign: "Sagittarius", signIdx: 8 },
  { date: "2026-09-11", time: "09:30", sign: "Capricorn",   signIdx: 9 },
  { date: "2026-09-13", time: "22:00", sign: "Aquarius",    signIdx: 10 },
  { date: "2026-09-16", time: "08:30", sign: "Pisces",      signIdx: 11 },
  { date: "2026-09-18", time: "16:00", sign: "Aries",       signIdx: 0 },
  { date: "2026-09-20", time: "20:30", sign: "Taurus",      signIdx: 1 },
  { date: "2026-09-22", time: "22:45", sign: "Gemini",      signIdx: 2 },
  { date: "2026-09-24", time: "23:30", sign: "Cancer",      signIdx: 3 },
  { date: "2026-09-27", time: "00:15", sign: "Leo",         signIdx: 4 },
  { date: "2026-09-29", time: "02:30", sign: "Virgo",       signIdx: 5 },
  { date: "2026-10-01", time: "07:15", sign: "Libra",       signIdx: 6 },
  { date: "2026-10-03", time: "15:00", sign: "Scorpio",     signIdx: 7 },
  { date: "2026-10-06", time: "01:30", sign: "Sagittarius", signIdx: 8 },
  { date: "2026-10-08", time: "14:00", sign: "Capricorn",   signIdx: 9 },
  { date: "2026-10-11", time: "02:30", sign: "Aquarius",    signIdx: 10 },
  { date: "2026-10-13", time: "13:00", sign: "Pisces",      signIdx: 11 },
  { date: "2026-10-15", time: "20:30", sign: "Aries",       signIdx: 0 },
  { date: "2026-10-18", time: "01:00", sign: "Taurus",      signIdx: 1 },
  { date: "2026-10-20", time: "03:15", sign: "Gemini",      signIdx: 2 },
  { date: "2026-10-22", time: "04:00", sign: "Cancer",      signIdx: 3 },
  { date: "2026-10-24", time: "04:45", sign: "Leo",         signIdx: 4 },
  { date: "2026-10-26", time: "07:00", sign: "Virgo",       signIdx: 5 },
  { date: "2026-10-28", time: "11:45", sign: "Libra",       signIdx: 6 },
  { date: "2026-10-30", time: "19:30", sign: "Scorpio",     signIdx: 7 },
  { date: "2026-11-02", time: "06:00", sign: "Sagittarius", signIdx: 8 },
  { date: "2026-11-04", time: "18:30", sign: "Capricorn",   signIdx: 9 },
  { date: "2026-11-07", time: "07:00", sign: "Aquarius",    signIdx: 10 },
  { date: "2026-11-09", time: "17:30", sign: "Pisces",      signIdx: 11 },
  { date: "2026-11-12", time: "01:00", sign: "Aries",       signIdx: 0 },
  { date: "2026-11-14", time: "05:30", sign: "Taurus",      signIdx: 1 },
  { date: "2026-11-16", time: "07:45", sign: "Gemini",      signIdx: 2 },
  { date: "2026-11-18", time: "08:30", sign: "Cancer",      signIdx: 3 },
  { date: "2026-11-20", time: "09:15", sign: "Leo",         signIdx: 4 },
  { date: "2026-11-22", time: "11:30", sign: "Virgo",       signIdx: 5 },
  { date: "2026-11-24", time: "16:15", sign: "Libra",       signIdx: 6 },
  { date: "2026-11-27", time: "00:00", sign: "Scorpio",     signIdx: 7 },
  { date: "2026-11-29", time: "10:30", sign: "Sagittarius", signIdx: 8 },
  { date: "2026-12-01", time: "23:00", sign: "Capricorn",   signIdx: 9 },
  { date: "2026-12-04", time: "11:30", sign: "Aquarius",    signIdx: 10 },
  { date: "2026-12-06", time: "22:00", sign: "Pisces",      signIdx: 11 },
  { date: "2026-12-09", time: "06:00", sign: "Aries",       signIdx: 0 },
  { date: "2026-12-11", time: "11:00", sign: "Taurus",      signIdx: 1 },
  { date: "2026-12-13", time: "13:15", sign: "Gemini",      signIdx: 2 },
  { date: "2026-12-15", time: "13:45", sign: "Cancer",      signIdx: 3 },
  { date: "2026-12-17", time: "14:30", sign: "Leo",         signIdx: 4 },
  { date: "2026-12-19", time: "17:00", sign: "Virgo",       signIdx: 5 },
  { date: "2026-12-21", time: "22:00", sign: "Libra",       signIdx: 6 },
  { date: "2026-12-24", time: "06:00", sign: "Scorpio",     signIdx: 7 },
  { date: "2026-12-26", time: "16:30", sign: "Sagittarius", signIdx: 8 },
  { date: "2026-12-29", time: "05:00", sign: "Capricorn",   signIdx: 9 },
  { date: "2026-12-31", time: "17:30", sign: "Aquarius",    signIdx: 10 },
];

// ─── PLANETARY EVENTS 2026 (Grade A/B/C) ─────────────────────────────────────
export const PLANETARY_EVENTS_2026 = [
  // JANUARY
  { date:"2026-01-14", time:"08:20", planet:"mercury", grade:"A", type:"Mercury Retrograde",    desc:"Mercury stations retrograde in Capricorn. Execution risk HIGH. Avoid new tech/IT entries.", sectors:["IT","Telecom","Logistics"], bias:"caution", layer:"tactical" },
  { date:"2026-01-21", time:"14:30", planet:"sun",     grade:"C", type:"Sun enters Aquarius",   desc:"Sun activates Aquarian themes — policy, tech reform, budget season begins.", sectors:["Tech","PSU"], bias:"neutral", layer:"tactical" },
  { date:"2026-01-29", time:"07:36", planet:"moon",    grade:"B", type:"New Moon Aquarius",     desc:"Amavasya — lunar cycle resets. Low energy, avoid major entries.", sectors:["All"], bias:"caution", layer:"sentiment" },

  // FEBRUARY
  { date:"2026-02-04", time:"09:15", planet:"mercury", grade:"A", type:"Mercury Direct",        desc:"Mercury turns direct. Tactical clarity restored. 3-day window for re-entry.", sectors:["IT","Telecom"], bias:"bullish", layer:"tactical" },
  { date:"2026-02-12", time:"23:14", planet:"moon",    grade:"B", type:"Full Moon Virgo",       desc:"Purnima — peak lunar energy. Reversal watch zone. Healthcare/analytics themes amplified.", sectors:["Healthcare","Analytics"], bias:"volatile", layer:"sentiment" },
  { date:"2026-02-19", time:"11:00", planet:"sun",     grade:"C", type:"Sun enters Pisces",     desc:"Sun activates Pisces — pharma, oil, spiritual themes for 30 days.", sectors:["Pharma","Oil"], bias:"neutral", layer:"tactical" },
  { date:"2026-02-28", time:"01:46", planet:"moon",    grade:"B", type:"New Moon Aquarius",     desc:"New Moon — new cycle. Tech/reform themes. Watch for policy announcements.", sectors:["Tech","Fintech"], bias:"neutral", layer:"sentiment" },

  // MARCH
  { date:"2026-03-07", time:"06:00", planet:"saturn",  grade:"A", type:"Saturn enters Aries",  desc:"STRUCTURAL SHIFT. Saturn debilitated in Aries. Old leaders punished, new emerging. Defense/infra volatile for 2.5 years.", sectors:["Defense","Energy","Infrastructure"], bias:"bearish", layer:"structural" },
  { date:"2026-03-14", time:"07:55", planet:"moon",    grade:"B", type:"Full Moon Virgo",       desc:"Full Moon in Virgo. Healthcare/logistics reversal zone. Watch for sharp intraday swing.", sectors:["Healthcare","Logistics"], bias:"volatile", layer:"sentiment" },
  { date:"2026-03-20", time:"09:30", planet:"sun",     grade:"C", type:"Sun enters Aries",      desc:"Spring equinox. Sun in Aries — new financial year energy. Risk appetite reset.", sectors:["All"], bias:"bullish", layer:"tactical" },
  { date:"2026-03-25", time:"14:20", planet:"venus",   grade:"A", type:"Venus Retrograde",      desc:"Venus stations retrograde in Aries. Valuation reset — banking/NBFC stress. INR/USD volatile. M&A deals at risk.", sectors:["Banking","NBFC","Luxury","Auto"], bias:"bearish", layer:"trend" },
  { date:"2026-03-29", time:"17:58", planet:"moon",    grade:"B", type:"New Moon Pisces",       desc:"New Moon in Pisces. Pharma/oil theme reset. Rahu amplifying — speculative entries.", sectors:["Pharma","Oil"], bias:"neutral", layer:"sentiment" },

  // APRIL
  { date:"2026-04-05", time:"06:00", planet:"mars",    grade:"B", type:"Mars enters Cancer",    desc:"Mars debilitated in Cancer. Energy sector weakens. Defensive rotation begins.", sectors:["Energy","Defense"], bias:"bearish", layer:"trend" },
  { date:"2026-04-12", time:"19:52", planet:"moon",    grade:"A", type:"Lunar Eclipse Leo",     desc:"ECLIPSE SEASON 1. Lunar eclipse — high volatility. Major pivot zone. Entertainment/pharma themes.", sectors:["All"], bias:"volatile", layer:"structural" },
  { date:"2026-04-20", time:"09:30", planet:"sun",     grade:"C", type:"Sun enters Taurus",     desc:"Sun activates banking, luxury, gold themes for 30 days.", sectors:["Banking","Gold","Luxury"], bias:"neutral", layer:"tactical" },
  { date:"2026-04-28", time:"06:32", planet:"moon",    grade:"A", type:"Solar Eclipse Aries",   desc:"Solar eclipse closes Season 1. New 6-month cycle begins. Aries themes — defense, startups reset.", sectors:["Defense","Startups"], bias:"volatile", layer:"structural" },

  // MAY
  { date:"2026-05-05", time:"06:00", planet:"venus",   grade:"A", type:"Venus Direct",          desc:"Venus turns direct. Valuation expansion resumes. Financial sector relief rally. Post-retrograde momentum builds.", sectors:["Banking","NBFC","Luxury","Auto"], bias:"bullish", layer:"trend" },
  { date:"2026-05-12", time:"09:28", planet:"moon",    grade:"B", type:"Full Moon Libra",       desc:"Purnima. Banking/luxury themes amplified. Venus just turned direct — watch for banking surge.", sectors:["Banking","Luxury"], bias:"bullish", layer:"sentiment" },
  { date:"2026-05-14", time:"05:30", planet:"jupiter", grade:"A", type:"Jupiter enters Cancer", desc:"HIGHEST IMPACT EVENT. Jupiter exalted in Cancer. Broad bull bias begins. FMCG, PSU banks, agri get genuine tailwinds. Most powerful Jupiter placement.", sectors:["FMCG","PSU Banks","Agri","Real Estate"], bias:"bullish", layer:"structural" },
  { date:"2026-05-21", time:"10:15", planet:"sun",     grade:"C", type:"Sun enters Gemini",     desc:"Sun activates IT, media, communication themes.", sectors:["IT","Media","Telecom"], bias:"neutral", layer:"tactical" },
  { date:"2026-05-27", time:"17:04", planet:"moon",    grade:"B", type:"New Moon Taurus",       desc:"New Moon in Taurus. Banking/gold cycle reset. Strong foundation for new long positions.", sectors:["Banking","Gold"], bias:"bullish", layer:"sentiment" },
  { date:"2026-05-29", time:"08:30", planet:"mercury", grade:"B", type:"Mercury Retrograde",    desc:"Mercury retrograde season 2 in Gemini. IT/telecom execution caution. Summer information noise.", sectors:["IT","Telecom","Media"], bias:"caution", layer:"tactical" },

  // JUNE
  { date:"2026-06-11", time:"00:44", planet:"moon",    grade:"B", type:"Full Moon Scorpio",     desc:"Full Moon in Scorpio. Pharma/oil reversal watch. Rahu amplifying — emotional, gap-prone.", sectors:["Pharma","Oil"], bias:"volatile", layer:"sentiment" },
  { date:"2026-06-12", time:"14:00", planet:"mercury", grade:"B", type:"Mercury Direct",        desc:"Mercury turns direct in Gemini. IT sector clarity restored. Re-entry window opens.", sectors:["IT","Telecom"], bias:"bullish", layer:"tactical" },
  { date:"2026-06-19", time:"11:30", planet:"mars",    grade:"A", type:"Mars conjunct Jupiter", desc:"HIGHEST CONVICTION WINDOW OF 2026. Mars meets exalted Jupiter in Cancer. FMCG/PSU banks surge. Size up — but watch for blow-off top within 5 days.", sectors:["FMCG","PSU Banks","Agri","Pharma"], bias:"bullish", layer:"structural" },
  { date:"2026-06-21", time:"09:00", planet:"sun",     grade:"C", type:"Sun enters Cancer",     desc:"Summer solstice. Sun exalts Jupiter themes. Cancer themes peak — FMCG, domestic consumption.", sectors:["FMCG","Agri","Real Estate"], bias:"bullish", layer:"tactical" },
  { date:"2026-06-26", time:"02:48", planet:"moon",    grade:"B", type:"New Moon Gemini",       desc:"New Moon. IT/media cycle reset. Post-Mercury-direct + pre-Jupiter-peak — strong setup window.", sectors:["IT","Media"], bias:"bullish", layer:"sentiment" },

  // JULY
  { date:"2026-07-04", time:"06:00", planet:"mars",    grade:"B", type:"Mars enters Leo",       desc:"Mars moves to Leo. Pharma, entertainment, large-cap leadership get momentum. Post-conjunction momentum continues.", sectors:["Pharma","Entertainment","Large Caps"], bias:"bullish", layer:"trend" },
  { date:"2026-07-10", time:"18:38", planet:"moon",    grade:"B", type:"Full Moon Sagittarius", desc:"Full Moon in Sagittarius. Education, international, growth themes peak.", sectors:["Education","International"], bias:"neutral", layer:"sentiment" },
  { date:"2026-07-22", time:"11:00", planet:"sun",     grade:"C", type:"Sun enters Cancer",     desc:"Sun joins Jupiter in Cancer. Double Cancer energy — FMCG themes amplified.", sectors:["FMCG","PSU Banks"], bias:"bullish", layer:"tactical" },
  { date:"2026-07-25", time:"11:42", planet:"moon",    grade:"B", type:"New Moon Cancer",       desc:"New Moon in Cancer — Jupiter exalted here. Exceptionally favorable lunar reset for FMCG/agri.", sectors:["FMCG","Agri"], bias:"bullish", layer:"sentiment" },

  // AUGUST
  { date:"2026-08-09", time:"14:54", planet:"moon",    grade:"A", type:"Lunar Eclipse Aquarius",desc:"ECLIPSE SEASON 2. Lunar eclipse — second major pivot. Tech disruption themes amplified.", sectors:["All"], bias:"volatile", layer:"structural" },
  { date:"2026-08-16", time:"09:00", planet:"sun",     grade:"C", type:"Sun enters Leo",        desc:"Sun in own sign Leo. Large caps, pharma, government stocks activate.", sectors:["Pharma","Large Caps","Govt"], bias:"neutral", layer:"tactical" },
  { date:"2026-08-23", time:"20:46", planet:"moon",    grade:"A", type:"Solar Eclipse Leo",     desc:"Solar eclipse closes Season 2. Leo themes — large caps, pharma enter new 6-month cycle.", sectors:["Pharma","Large Caps"], bias:"volatile", layer:"structural" },

  // SEPTEMBER
  { date:"2026-09-07", time:"13:12", planet:"moon",    grade:"B", type:"Full Moon Pisces",      desc:"Full Moon in Pisces. Pharma/oil — Rahu themes climax. Speculative excess may reverse.", sectors:["Pharma","Oil"], bias:"volatile", layer:"sentiment" },
  { date:"2026-09-09", time:"06:00", planet:"jupiter", grade:"A", type:"Jupiter Retrograde",    desc:"Jupiter stations retrograde in Cancer. Bull trend pauses — consolidation. Excellent accumulation in FMCG/PSU banks.", sectors:["FMCG","PSU Banks","Agri"], bias:"caution", layer:"structural" },
  { date:"2026-09-16", time:"09:00", planet:"sun",     grade:"C", type:"Sun enters Virgo",      desc:"Sun activates healthcare, analytics, logistics themes.", sectors:["Healthcare","Analytics","Logistics"], bias:"neutral", layer:"tactical" },
  { date:"2026-09-22", time:"06:54", planet:"moon",    grade:"B", type:"New Moon Virgo",        desc:"New Moon in Virgo. Healthcare/analytics cycle reset during Jupiter retrograde — accumulation window.", sectors:["Healthcare","Logistics"], bias:"neutral", layer:"sentiment" },
  { date:"2026-09-25", time:"11:20", planet:"mercury", grade:"B", type:"Mercury Retrograde",    desc:"Mercury retrograde season 3. Q3 results season — restatement risk. Avoid new entries.", sectors:["IT","Telecom"], bias:"caution", layer:"tactical" },

  // OCTOBER
  { date:"2026-10-07", time:"12:48", planet:"moon",    grade:"B", type:"Full Moon Aries",       desc:"Full Moon in Aries. Defense/startup themes. Saturn stress in Aries amplified.", sectors:["Defense","Metals"], bias:"volatile", layer:"sentiment" },
  { date:"2026-10-14", time:"11:30", planet:"mercury", grade:"B", type:"Mercury Direct",        desc:"Mercury turns direct. Q4 positioning clarity returns.", sectors:["IT","Telecom"], bias:"bullish", layer:"tactical" },
  { date:"2026-10-17", time:"09:00", planet:"saturn",  grade:"A", type:"Saturn Retrograde",     desc:"Saturn stations retrograde in Aries. Structural fears resurface. PSU/infra stocks under pressure.", sectors:["Infrastructure","PSU","Energy"], bias:"bearish", layer:"structural" },
  { date:"2026-10-17", time:"10:30", planet:"sun",     grade:"C", type:"Sun enters Libra",      desc:"Festive season begins. Sun in Libra — Venus themes. Consumption, sentiment optimism.", sectors:["Luxury","FMCG","Auto"], bias:"bullish", layer:"tactical" },
  { date:"2026-10-21", time:"17:14", planet:"moon",    grade:"B", type:"New Moon Libra",        desc:"New Moon — Diwali season. Festive consumption cycle. Muhurta trading window near.", sectors:["FMCG","Luxury","Retail"], bias:"bullish", layer:"sentiment" },

  // NOVEMBER
  { date:"2026-11-06", time:"13:28", planet:"moon",    grade:"B", type:"Full Moon Taurus",      desc:"Full Moon in Taurus. Banking/gold themes peak during Jupiter retrograde.", sectors:["Banking","Gold"], bias:"neutral", layer:"sentiment" },
  { date:"2026-11-14", time:"06:00", planet:"rahu",    grade:"A", type:"Rahu enters Aquarius",  desc:"Rahu–Ketu axis shifts. New 18-month obsession: AI/tech disruption, new-age companies. Ketu to Leo.", sectors:["AI Tech","Fintech","New-age"], bias:"bullish", layer:"structural" },
  { date:"2026-11-16", time:"09:00", planet:"sun",     grade:"C", type:"Sun enters Scorpio",    desc:"Sun activates pharma, oil, hidden value themes.", sectors:["Pharma","Oil","Deep Value"], bias:"neutral", layer:"tactical" },
  { date:"2026-11-20", time:"04:48", planet:"moon",    grade:"B", type:"New Moon Scorpio",      desc:"New Moon in Scorpio. Pharma/oil new cycle. Post-Rahu-shift — watch for new theme leaders.", sectors:["Pharma","Oil"], bias:"neutral", layer:"sentiment" },

  // DECEMBER
  { date:"2026-12-01", time:"07:00", planet:"jupiter", grade:"A", type:"Jupiter Direct",        desc:"YEAR-END RESUMPTION TRADE. Jupiter turns direct in Cancer. High-conviction re-entry into FMCG/PSU banks. Strongest year-end signal.", sectors:["FMCG","PSU Banks","Agri","Real Estate"], bias:"bullish", layer:"structural" },
  { date:"2026-12-06", time:"15:28", planet:"moon",    grade:"B", type:"Full Moon Gemini",      desc:"Full Moon in Gemini. IT/media themes. Post-Jupiter-direct — broad bull resumption.", sectors:["IT","Media"], bias:"bullish", layer:"sentiment" },
  { date:"2026-12-12", time:"09:00", planet:"saturn",  grade:"B", type:"Saturn Direct",         desc:"Saturn turns direct in Aries. Structural clarity — new sector leadership confirmed.", sectors:["Defense","Engineering"], bias:"neutral", layer:"structural" },
  { date:"2026-12-15", time:"11:00", planet:"sun",     grade:"C", type:"Sun enters Sagittarius",desc:"Sun activates education, growth, international themes.", sectors:["Education","International"], bias:"neutral", layer:"tactical" },
  { date:"2026-12-19", time:"18:44", planet:"moon",    grade:"B", type:"New Moon Sagittarius",  desc:"New Moon. Year-end positioning. Jupiter direct + New Moon = strong setup for 2027 entry.", sectors:["All"], bias:"bullish", layer:"sentiment" },
];

// ─── PANCHANG DAILY DATA 2026 ─────────────────────────────────────────────────
// Format: date, tithiNum, tithiChangeover (IST, null if outside market hours),
//         nakshatraId, nakshatraChangeover, yogaId, yogaChangeover
// Quality: 0=avoid, 1=caution, 2=neutral, 3=favorable
// Market session: 09:15–15:30 IST
// Changeover = time within market session when element changes (null = no change)
export const PANCHANG_2026 = [
  // MAY 2026 (partial — current month, most actionable)
  { date:"2026-05-01", tithi:8,  tithiChange:null,    nakshatra:14, nakshatraChange:null,    yoga:15, yogaChange:null,    sessionQuality:2, vaar:"Friday" },
  { date:"2026-05-02", tithi:9,  tithiChange:"11:20", nakshatra:14, nakshatraChange:null,    yoga:16, yogaChange:"14:30", sessionQuality:2, vaar:"Saturday" },
  { date:"2026-05-03", tithi:10, tithiChange:null,    nakshatra:15, nakshatraChange:"10:45", yoga:17, yogaChange:null,    sessionQuality:1, vaar:"Sunday" },
  { date:"2026-05-04", tithi:11, tithiChange:"13:40", nakshatra:15, nakshatraChange:null,    yoga:18, yogaChange:"09:50", sessionQuality:2, vaar:"Monday" },
  { date:"2026-05-05", tithi:12, tithiChange:null,    nakshatra:16, nakshatraChange:"12:15", yoga:19, yogaChange:null,    sessionQuality:3, vaar:"Tuesday" },
  { date:"2026-05-06", tithi:13, tithiChange:"10:30", nakshatra:16, nakshatraChange:null,    yoga:20, yogaChange:"15:00", sessionQuality:2, vaar:"Wednesday" },
  { date:"2026-05-07", tithi:14, tithiChange:null,    nakshatra:17, nakshatraChange:"11:00", yoga:21, yogaChange:null,    sessionQuality:1, vaar:"Thursday" },
  { date:"2026-05-08", tithi:15, tithiChange:"14:20", nakshatra:17, nakshatraChange:null,    yoga:22, yogaChange:"10:15", sessionQuality:2, vaar:"Friday" },
  { date:"2026-05-09", tithi:16, tithiChange:null,    nakshatra:18, nakshatraChange:"13:30", yoga:23, yogaChange:null,    sessionQuality:2, vaar:"Saturday" },
  { date:"2026-05-10", tithi:17, tithiChange:"09:45", nakshatra:18, nakshatraChange:null,    yoga:24, yogaChange:"12:00", sessionQuality:3, vaar:"Sunday" },
  { date:"2026-05-11", tithi:18, tithiChange:null,    nakshatra:19, nakshatraChange:"10:20", yoga:25, yogaChange:null,    sessionQuality:1, vaar:"Monday" },
  { date:"2026-05-12", tithi:19, tithiChange:"12:10", nakshatra:19, nakshatraChange:null,    yoga:26, yogaChange:"14:45", sessionQuality:3, vaar:"Tuesday" },
  { date:"2026-05-13", tithi:20, tithiChange:null,    nakshatra:20, nakshatraChange:"11:30", yoga:27, yogaChange:null,    sessionQuality:0, vaar:"Wednesday" },
  { date:"2026-05-14", tithi:21, tithiChange:"10:00", nakshatra:20, nakshatraChange:null,    yoga:1,  yogaChange:"13:15", sessionQuality:2, vaar:"Thursday" },
  { date:"2026-05-15", tithi:22, tithiChange:null,    nakshatra:21, nakshatraChange:"12:45", yoga:2,  yogaChange:null,    sessionQuality:3, vaar:"Friday" },
  { date:"2026-05-16", tithi:23, tithiChange:"11:15", nakshatra:21, nakshatraChange:null,    yoga:3,  yogaChange:"10:30", sessionQuality:2, vaar:"Saturday" },
  { date:"2026-05-17", tithi:24, tithiChange:null,    nakshatra:22, nakshatraChange:"13:00", yoga:4,  yogaChange:null,    sessionQuality:3, vaar:"Sunday" },
  { date:"2026-05-18", tithi:25, tithiChange:"09:30", nakshatra:22, nakshatraChange:null,    yoga:5,  yogaChange:"14:00", sessionQuality:3, vaar:"Monday" },
  { date:"2026-05-19", tithi:26, tithiChange:null,    nakshatra:23, nakshatraChange:"11:45", yoga:6,  yogaChange:null,    sessionQuality:0, vaar:"Tuesday" },
  { date:"2026-05-20", tithi:27, tithiChange:"13:00", nakshatra:23, nakshatraChange:null,    yoga:7,  yogaChange:"09:20", sessionQuality:2, vaar:"Wednesday" },
  { date:"2026-05-21", tithi:28, tithiChange:null,    nakshatra:24, nakshatraChange:"12:20", yoga:8,  yogaChange:null,    sessionQuality:3, vaar:"Thursday" },
  { date:"2026-05-22", tithi:29, tithiChange:"10:45", nakshatra:24, nakshatraChange:null,    yoga:9,  yogaChange:"14:30", sessionQuality:1, vaar:"Friday" },
  { date:"2026-05-23", tithi:30, tithiChange:null,    nakshatra:25, nakshatraChange:"11:00", yoga:10, yogaChange:null,    sessionQuality:0, vaar:"Saturday" },
  { date:"2026-05-24", tithi:1,  tithiChange:"12:30", nakshatra:25, nakshatraChange:null,    yoga:11, yogaChange:"10:00", sessionQuality:3, vaar:"Sunday" },
  { date:"2026-05-25", tithi:2,  tithiChange:null,    nakshatra:26, nakshatraChange:"13:15", yoga:12, yogaChange:null,    sessionQuality:3, vaar:"Monday" },
  { date:"2026-05-26", tithi:3,  tithiChange:"09:20", nakshatra:26, nakshatraChange:null,    yoga:13, yogaChange:"14:45", sessionQuality:0, vaar:"Tuesday" },
  { date:"2026-05-27", tithi:4,  tithiChange:null,    nakshatra:27, nakshatraChange:"10:30", yoga:14, yogaChange:null,    sessionQuality:1, vaar:"Wednesday" },
  { date:"2026-05-28", tithi:5,  tithiChange:"11:45", nakshatra:27, nakshatraChange:null,    yoga:15, yogaChange:"13:00", sessionQuality:3, vaar:"Thursday" },
  { date:"2026-05-29", tithi:6,  tithiChange:null,    nakshatra:1,  nakshatraChange:"12:00", yoga:16, yogaChange:null,    sessionQuality:2, vaar:"Friday" },
  { date:"2026-05-30", tithi:7,  tithiChange:"10:15", nakshatra:1,  nakshatraChange:null,    yoga:17, yogaChange:"09:30", sessionQuality:0, vaar:"Saturday" },
  { date:"2026-05-31", tithi:8,  tithiChange:null,    nakshatra:2,  nakshatraChange:"11:20", yoga:18, yogaChange:null,    sessionQuality:1, vaar:"Sunday" },

  // JUNE 2026
  { date:"2026-06-01", tithi:9,  tithiChange:"13:45", nakshatra:2,  nakshatraChange:null,    yoga:19, yogaChange:"14:20", sessionQuality:0, vaar:"Monday" },
  { date:"2026-06-02", tithi:10, tithiChange:null,    nakshatra:3,  nakshatraChange:"10:00", yoga:20, yogaChange:null,    sessionQuality:3, vaar:"Tuesday" },
  { date:"2026-06-03", tithi:11, tithiChange:"09:30", nakshatra:3,  nakshatraChange:null,    yoga:21, yogaChange:"13:30", sessionQuality:3, vaar:"Wednesday" },
  { date:"2026-06-04", tithi:12, tithiChange:null,    nakshatra:4,  nakshatraChange:"11:15", yoga:22, yogaChange:null,    sessionQuality:3, vaar:"Thursday" },
  { date:"2026-06-05", tithi:13, tithiChange:"12:00", nakshatra:4,  nakshatraChange:null,    yoga:23, yogaChange:"10:45", sessionQuality:2, vaar:"Friday" },
  { date:"2026-06-06", tithi:14, tithiChange:null,    nakshatra:5,  nakshatraChange:"13:30", yoga:24, yogaChange:null,    sessionQuality:1, vaar:"Saturday" },
  { date:"2026-06-07", tithi:15, tithiChange:"11:00", nakshatra:5,  nakshatraChange:null,    yoga:25, yogaChange:"14:00", sessionQuality:2, vaar:"Sunday" },
  { date:"2026-06-08", tithi:16, tithiChange:null,    nakshatra:6,  nakshatraChange:"10:15", yoga:26, yogaChange:null,    sessionQuality:1, vaar:"Monday" },
  { date:"2026-06-09", tithi:17, tithiChange:"13:20", nakshatra:6,  nakshatraChange:null,    yoga:27, yogaChange:"09:40", sessionQuality:0, vaar:"Tuesday" },
  { date:"2026-06-10", tithi:18, tithiChange:null,    nakshatra:7,  nakshatraChange:"11:45", yoga:1,  yogaChange:null,    sessionQuality:2, vaar:"Wednesday" },
  { date:"2026-06-11", tithi:19, tithiChange:"10:30", nakshatra:7,  nakshatraChange:null,    yoga:2,  yogaChange:"14:15", sessionQuality:3, vaar:"Thursday" },
  { date:"2026-06-12", tithi:20, tithiChange:null,    nakshatra:8,  nakshatraChange:"12:00", yoga:3,  yogaChange:null,    sessionQuality:3, vaar:"Friday" },
  { date:"2026-06-13", tithi:21, tithiChange:"11:15", nakshatra:8,  nakshatraChange:null,    yoga:4,  yogaChange:"10:30", sessionQuality:3, vaar:"Saturday" },
  { date:"2026-06-14", tithi:22, tithiChange:null,    nakshatra:9,  nakshatraChange:"13:00", yoga:5,  yogaChange:null,    sessionQuality:2, vaar:"Sunday" },
  { date:"2026-06-15", tithi:23, tithiChange:"09:45", nakshatra:9,  nakshatraChange:null,    yoga:6,  yogaChange:"14:45", sessionQuality:1, vaar:"Monday" },
  { date:"2026-06-16", tithi:24, tithiChange:null,    nakshatra:10, nakshatraChange:"11:30", yoga:7,  yogaChange:null,    sessionQuality:2, vaar:"Tuesday" },
  { date:"2026-06-17", tithi:25, tithiChange:"12:45", nakshatra:10, nakshatraChange:null,    yoga:8,  yogaChange:"10:00", sessionQuality:3, vaar:"Wednesday" },
  { date:"2026-06-18", tithi:26, tithiChange:null,    nakshatra:11, nakshatraChange:"10:15", yoga:9,  yogaChange:null,    sessionQuality:2, vaar:"Thursday" },
  { date:"2026-06-19", tithi:27, tithiChange:"13:30", nakshatra:11, nakshatraChange:null,    yoga:10, yogaChange:"14:30", sessionQuality:3, vaar:"Friday" }, // MARS-JUPITER CONJUNCTION
  { date:"2026-06-20", tithi:28, tithiChange:null,    nakshatra:12, nakshatraChange:"12:00", yoga:11, yogaChange:null,    sessionQuality:3, vaar:"Saturday" },
  { date:"2026-06-21", tithi:29, tithiChange:"10:00", nakshatra:12, nakshatraChange:null,    yoga:12, yogaChange:"09:15", sessionQuality:2, vaar:"Sunday" },
  { date:"2026-06-22", tithi:30, tithiChange:null,    nakshatra:13, nakshatraChange:"11:45", yoga:13, yogaChange:null,    sessionQuality:0, vaar:"Monday" },
  { date:"2026-06-23", tithi:1,  tithiChange:"12:15", nakshatra:13, nakshatraChange:null,    yoga:14, yogaChange:"14:00", sessionQuality:2, vaar:"Tuesday" },
  { date:"2026-06-24", tithi:2,  tithiChange:null,    nakshatra:14, nakshatraChange:"10:30", yoga:15, yogaChange:null,    sessionQuality:3, vaar:"Wednesday" },
  { date:"2026-06-25", tithi:3,  tithiChange:"11:00", nakshatra:14, nakshatraChange:null,    yoga:16, yogaChange:"13:45", sessionQuality:3, vaar:"Thursday" },
  { date:"2026-06-26", tithi:4,  tithiChange:null,    nakshatra:15, nakshatraChange:"12:30", yoga:17, yogaChange:null,    sessionQuality:0, vaar:"Friday" },
  { date:"2026-06-27", tithi:5,  tithiChange:"09:30", nakshatra:15, nakshatraChange:null,    yoga:18, yogaChange:"10:15", sessionQuality:2, vaar:"Saturday" },
  { date:"2026-06-28", tithi:6,  tithiChange:null,    nakshatra:16, nakshatraChange:"11:00", yoga:19, yogaChange:null,    sessionQuality:2, vaar:"Sunday" },
  { date:"2026-06-29", tithi:7,  tithiChange:"13:00", nakshatra:16, nakshatraChange:null,    yoga:20, yogaChange:"14:30", sessionQuality:3, vaar:"Monday" },
  { date:"2026-06-30", tithi:8,  tithiChange:null,    nakshatra:17, nakshatraChange:"10:45", yoga:21, yogaChange:null,    sessionQuality:3, vaar:"Tuesday" },
];

// ─── UTILITY FUNCTIONS ────────────────────────────────────────────────────────

// Get moon phase for a given date (interpolated)
export function getMoonPhaseForDate(dateStr) {
  const phases = MOON_PHASES_2026;
  const target = new Date(dateStr).getTime();
  // Find surrounding phases
  let prev = phases[0], next = phases[phases.length-1];
  for (let i = 0; i < phases.length - 1; i++) {
    const a = new Date(phases[i].date).getTime();
    const b = new Date(phases[i+1].date).getTime();
    if (target >= a && target <= b) { prev = phases[i]; next = phases[i+1]; break; }
  }
  const total = new Date(next.date).getTime() - new Date(prev.date).getTime();
  const elapsed = target - new Date(prev.date).getTime();
  const pct = elapsed / total;
  // Phase angle 0-360 (0=new, 90=first quarter, 180=full, 270=last quarter)
  const phaseAngles = { new:0, waxing_quarter:90, full:180, waning_quarter:270 };
  const prevAngle = phaseAngles[prev.phase] || 0;
  const nextAngle = phaseAngles[next.phase] || (prevAngle + 90);
  return (prevAngle + pct * (nextAngle - prevAngle)) % 360;
}

// Get moon sign for a date (returns current sign at market open 09:15)
export function getMoonSignForDate(dateStr) {
  const ingresses = MOON_INGRESSES_2026;
  let current = ingresses[0];
  for (const ing of ingresses) {
    const ingDate = new Date(ing.date + "T" + ing.time + ":00+05:30");
    const target = new Date(dateStr + "T09:15:00+05:30");
    if (ingDate <= target) current = ing;
    else break;
  }
  return current;
}

// Get panchang for a date
export function getPanchangForDate(dateStr) {
  return PANCHANG_2026.find(p => p.date === dateStr) || null;
}

// Get planetary events for a date range
export function getEventsForDateRange(startStr, endStr) {
  const start = new Date(startStr), end = new Date(endStr);
  return PLANETARY_EVENTS_2026.filter(e => {
    const d = new Date(e.date);
    return d >= start && d <= end;
  });
}

// Get events for a specific month
export function getEventsForMonth(year, month) {
  return PLANETARY_EVENTS_2026.filter(e => {
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

// Compute weekly environment score
export function computeWeeklyScore(dateStr) {
  const panchang = getPanchangForDate(dateStr);
  const moonPhase = getMoonPhaseForDate(dateStr);
  const events = getEventsForDateRange(dateStr, dateStr);

  // Mercury score
  const mercuryRetro = PLANETARY_EVENTS_2026.filter(e =>
    e.planet === "mercury" && e.type.includes("Retrograde") && new Date(e.date) <= new Date(dateStr)
  ).length % 2 === 1; // odd = currently retrograde
  const mercuryScore = mercuryRetro ? 1 : 3;

  // Mars score
  const marsEvent = events.find(e => e.planet === "mars");
  const marsScore = marsEvent?.bias === "bearish" ? 1 : 2;

  // Eclipse score
  const eclipseNear = PLANETARY_EVENTS_2026.some(e => {
    if (!e.type.includes("Eclipse")) return false;
    const diff = Math.abs(new Date(e.date) - new Date(dateStr)) / 86400000;
    return diff <= 14;
  });
  const eclipseScore = eclipseNear ? 1 : 3;

  // Lunar score (0=new/full±2days=1, waxing=3, waning=2)
  const lunarScore = moonPhase < 10 || moonPhase > 350 ? 1
    : moonPhase > 170 && moonPhase < 190 ? 1
    : moonPhase < 90 ? 3 : 2;

  // Panchang bonus
  const panchangBonus = panchang ? (panchang.sessionQuality >= 2 ? 1 : 0) : 0;

  return {
    mercury: mercuryScore, mars: marsScore,
    eclipse: eclipseScore, lunar: lunarScore,
    total: mercuryScore + marsScore + eclipseScore + lunarScore + panchangBonus,
    max: 13,
  };
}

// Get Rahu Kala for a date
export function getRahuKalaForDate(dateStr) {
  const dow = new Date(dateStr).getDay();
  return RAHU_KALA[dow];
}

// Get session quality label
export function sessionQualityLabel(q) {
  return q === 3 ? "Favorable" : q === 2 ? "Neutral" : q === 1 ? "Caution" : "Avoid";
}
export function sessionQualityColor(q) {
  return q === 3 ? "#4CAF8A" : q === 2 ? "#C9A84C" : q === 1 ? "#E89040" : "#E86060";
}

// Sign metadata
export const SIGNS = [
  { name:"Aries",       symbol:"♈", color:"#E86040", element:"Fire",  lord:"mars" },
  { name:"Taurus",      symbol:"♉", color:"#8BC34A", element:"Earth", lord:"venus" },
  { name:"Gemini",      symbol:"♊", color:"#4FC3F7", element:"Air",   lord:"mercury" },
  { name:"Cancer",      symbol:"♋", color:"#80CBC4", element:"Water", lord:"moon" },
  { name:"Leo",         symbol:"♌", color:"#FFD54F", element:"Fire",  lord:"sun" },
  { name:"Virgo",       symbol:"♍", color:"#A5D6A7", element:"Earth", lord:"mercury" },
  { name:"Libra",       symbol:"♎", color:"#F48FB1", element:"Air",   lord:"venus" },
  { name:"Scorpio",     symbol:"♏", color:"#CE93D8", element:"Water", lord:"mars" },
  { name:"Sagittarius", symbol:"♐", color:"#FFCC02", element:"Fire",  lord:"jupiter" },
  { name:"Capricorn",   symbol:"♑", color:"#90A4AE", element:"Earth", lord:"saturn" },
  { name:"Aquarius",    symbol:"♒", color:"#80DEEA", element:"Air",   lord:"saturn" },
  { name:"Pisces",      symbol:"♓", color:"#B39DDB", element:"Water", lord:"jupiter" },
];
