import { useState, useRef, useEffect, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// FINASTRO 2026 — COMPLETE UNIFIED DASHBOARD
// Ujjain (23°10'N, 75°46'E) · Lahiri Ayanamsa · IST · Sidereal
// ═══════════════════════════════════════════════════════════════════════════

// ─── CORE DATA ────────────────────────────────────────────────────────────────
const PLANETS = {
  sun:     { symbol:"☉", name:"Sun",      color:"#F5C842", glow:"#F5C84250" },
  moon:    { symbol:"☽", name:"Moon",     color:"#C8D8E8", glow:"#C8D8E840" },
  mercury: { symbol:"☿", name:"Mercury",  color:"#A8C8A8", glow:"#A8C8A840" },
  venus:   { symbol:"♀", name:"Venus",    color:"#E8A0C0", glow:"#E8A0C040" },
  mars:    { symbol:"♂", name:"Mars",     color:"#E86040", glow:"#E8604050" },
  jupiter: { symbol:"♃", name:"Jupiter",  color:"#C8A050", glow:"#C8A05050" },
  saturn:  { symbol:"♄", name:"Saturn",   color:"#B0A080", glow:"#B0A08040" },
  rahu:    { symbol:"☊", name:"Rahu",     color:"#8060C0", glow:"#8060C050" },
  ketu:    { symbol:"☋", name:"Ketu",     color:"#607890", glow:"#60789040" },
  herschel:{ symbol:"♅", name:"Herschel", color:"#60C8C0", glow:"#60C8C040" },
  pluto:   { symbol:"♇", name:"Pluto",    color:"#906080", glow:"#90608040" },
};

const SIGNS = [
  {name:"Aries",      symbol:"♈",color:"#E86040",element:"Fire"},
  {name:"Taurus",     symbol:"♉",color:"#8BC34A",element:"Earth"},
  {name:"Gemini",     symbol:"♊",color:"#4FC3F7",element:"Air"},
  {name:"Cancer",     symbol:"♋",color:"#80CBC4",element:"Water"},
  {name:"Leo",        symbol:"♌",color:"#FFD54F",element:"Fire"},
  {name:"Virgo",      symbol:"♍",color:"#A5D6A7",element:"Earth"},
  {name:"Libra",      symbol:"♎",color:"#F48FB1",element:"Air"},
  {name:"Scorpio",    symbol:"♏",color:"#CE93D8",element:"Water"},
  {name:"Sagittarius",symbol:"♐",color:"#FFCC02",element:"Fire"},
  {name:"Capricorn",  symbol:"♑",color:"#90A4AE",element:"Earth"},
  {name:"Aquarius",   symbol:"♒",color:"#80DEEA",element:"Air"},
  {name:"Pisces",     symbol:"♓",color:"#B39DDB",element:"Water"},
];

const NAKSHATRAS = [
  {id:1,name:"Ashwini",lord:"ketu",quality:2},{id:2,name:"Bharani",lord:"venus",quality:1},
  {id:3,name:"Krittika",lord:"sun",quality:2},{id:4,name:"Rohini",lord:"moon",quality:3},
  {id:5,name:"Mrigashira",lord:"mars",quality:2},{id:6,name:"Ardra",lord:"rahu",quality:1},
  {id:7,name:"Punarvasu",lord:"jupiter",quality:3},{id:8,name:"Pushya",lord:"saturn",quality:3},
  {id:9,name:"Ashlesha",lord:"mercury",quality:1},{id:10,name:"Magha",lord:"ketu",quality:2},
  {id:11,name:"P.Phalguni",lord:"venus",quality:2},{id:12,name:"U.Phalguni",lord:"sun",quality:3},
  {id:13,name:"Hasta",lord:"moon",quality:3},{id:14,name:"Chitra",lord:"mars",quality:2},
  {id:15,name:"Swati",lord:"rahu",quality:2},{id:16,name:"Vishakha",lord:"jupiter",quality:2},
  {id:17,name:"Anuradha",lord:"saturn",quality:3},{id:18,name:"Jyeshtha",lord:"mercury",quality:1},
  {id:19,name:"Moola",lord:"ketu",quality:0},{id:20,name:"P.Ashadha",lord:"venus",quality:2},
  {id:21,name:"U.Ashadha",lord:"sun",quality:3},{id:22,name:"Shravana",lord:"moon",quality:3},
  {id:23,name:"Dhanishtha",lord:"mars",quality:2},{id:24,name:"Shatabhisha",lord:"rahu",quality:1},
  {id:25,name:"P.Bhadra",lord:"jupiter",quality:2},{id:26,name:"U.Bhadra",lord:"saturn",quality:3},
  {id:27,name:"Revati",lord:"mercury",quality:3},
];

const TITHIS = [
  {id:1,name:"Pratipada",paksha:"Shukla",quality:3,type:"Nanda"},
  {id:2,name:"Dwitiya",paksha:"Shukla",quality:3,type:"Bhadra"},
  {id:3,name:"Tritiya",paksha:"Shukla",quality:3,type:"Jaya"},
  {id:4,name:"Chaturthi",paksha:"Shukla",quality:1,type:"Rikta"},
  {id:5,name:"Panchami",paksha:"Shukla",quality:3,type:"Purna"},
  {id:6,name:"Shashthi",paksha:"Shukla",quality:2,type:"Nanda"},
  {id:7,name:"Saptami",paksha:"Shukla",quality:3,type:"Bhadra"},
  {id:8,name:"Ashtami",paksha:"Shukla",quality:2,type:"Jaya"},
  {id:9,name:"Navami",paksha:"Shukla",quality:2,type:"Rikta"},
  {id:10,name:"Dashami",paksha:"Shukla",quality:3,type:"Purna"},
  {id:11,name:"Ekadashi",paksha:"Shukla",quality:3,type:"Nanda"},
  {id:12,name:"Dwadashi",paksha:"Shukla",quality:3,type:"Bhadra"},
  {id:13,name:"Trayodashi",paksha:"Shukla",quality:2,type:"Jaya"},
  {id:14,name:"Chaturdashi",paksha:"Shukla",quality:1,type:"Rikta"},
  {id:15,name:"Purnima",paksha:"Shukla",quality:2,type:"Purna"},
  {id:16,name:"Pratipada",paksha:"Krishna",quality:3,type:"Nanda"},
  {id:17,name:"Dwitiya",paksha:"Krishna",quality:3,type:"Bhadra"},
  {id:18,name:"Tritiya",paksha:"Krishna",quality:3,type:"Jaya"},
  {id:19,name:"Chaturthi",paksha:"Krishna",quality:1,type:"Rikta"},
  {id:20,name:"Panchami",paksha:"Krishna",quality:3,type:"Purna"},
  {id:21,name:"Shashthi",paksha:"Krishna",quality:2,type:"Nanda"},
  {id:22,name:"Saptami",paksha:"Krishna",quality:3,type:"Bhadra"},
  {id:23,name:"Ashtami",paksha:"Krishna",quality:2,type:"Jaya"},
  {id:24,name:"Navami",paksha:"Krishna",quality:2,type:"Rikta"},
  {id:25,name:"Dashami",paksha:"Krishna",quality:3,type:"Purna"},
  {id:26,name:"Ekadashi",paksha:"Krishna",quality:3,type:"Nanda"},
  {id:27,name:"Dwadashi",paksha:"Krishna",quality:3,type:"Bhadra"},
  {id:28,name:"Trayodashi",paksha:"Krishna",quality:2,type:"Jaya"},
  {id:29,name:"Chaturdashi",paksha:"Krishna",quality:1,type:"Rikta"},
  {id:30,name:"Amavasya",paksha:"Krishna",quality:0,type:"Purna"},
];

const YOGAS = [
  {id:1,name:"Vishkambha",quality:0},{id:2,name:"Priti",quality:3},
  {id:3,name:"Ayushman",quality:3},{id:4,name:"Saubhagya",quality:3},
  {id:5,name:"Shobhana",quality:3},{id:6,name:"Atiganda",quality:0},
  {id:7,name:"Sukarman",quality:3},{id:8,name:"Dhriti",quality:3},
  {id:9,name:"Shula",quality:1},{id:10,name:"Ganda",quality:0},
  {id:11,name:"Vriddhi",quality:3},{id:12,name:"Dhruva",quality:3},
  {id:13,name:"Vyaghata",quality:0},{id:14,name:"Harshana",quality:3},
  {id:15,name:"Vajra",quality:2},{id:16,name:"Siddhi",quality:3},
  {id:17,name:"Vyatipata",quality:0},{id:18,name:"Variyana",quality:2},
  {id:19,name:"Parigha",quality:0},{id:20,name:"Shiva",quality:3},
  {id:21,name:"Siddha",quality:3},{id:22,name:"Sadhya",quality:3},
  {id:23,name:"Shubha",quality:3},{id:24,name:"Shukla",quality:3},
  {id:25,name:"Brahma",quality:3},{id:26,name:"Indra",quality:3},
  {id:27,name:"Vaidhriti",quality:0},
];

const RAHU_KALA = {
  0:{start:"17:00",end:"18:30",sMin:1020,eMin:1110},
  1:{start:"07:30",end:"09:00",sMin:450,eMin:540},
  2:{start:"15:00",end:"16:30",sMin:900,eMin:990},
  3:{start:"12:00",end:"13:30",sMin:720,eMin:810},
  4:{start:"13:30",end:"15:00",sMin:810,eMin:900},
  5:{start:"10:30",end:"12:00",sMin:630,eMin:720},
  6:{start:"09:00",end:"10:30",sMin:540,eMin:630},
};
const ABHIJIT = {start:"11:48",end:"12:36",sMin:708,eMin:756};
const SS=555,SE=930; // session start/end in minutes

const MOON_PHASES = [
  {date:"2026-01-29",time:"07:36",phase:"new"},{date:"2026-02-05",time:"14:02",phase:"waxing_quarter"},
  {date:"2026-02-12",time:"23:14",phase:"full"},{date:"2026-02-20",time:"06:48",phase:"waning_quarter"},
  {date:"2026-02-28",time:"01:46",phase:"new"},{date:"2026-03-07",time:"03:38",phase:"waxing_quarter"},
  {date:"2026-03-14",time:"07:55",phase:"full"},{date:"2026-03-21",time:"17:24",phase:"waning_quarter"},
  {date:"2026-03-29",time:"17:58",phase:"new"},{date:"2026-04-05",time:"14:56",phase:"waxing_quarter"},
  {date:"2026-04-12",time:"19:52",phase:"full",eclipse:true},{date:"2026-04-20",time:"05:36",phase:"waning_quarter"},
  {date:"2026-04-28",time:"06:32",phase:"new",eclipse:true},{date:"2026-05-05",time:"23:14",phase:"waxing_quarter"},
  {date:"2026-05-12",time:"09:28",phase:"full"},{date:"2026-05-19",time:"19:42",phase:"waning_quarter"},
  {date:"2026-05-27",time:"17:04",phase:"new"},{date:"2026-06-04",time:"05:36",phase:"waxing_quarter"},
  {date:"2026-06-11",time:"00:44",phase:"full"},{date:"2026-06-18",time:"12:16",phase:"waning_quarter"},
  {date:"2026-06-26",time:"02:48",phase:"new"},{date:"2026-07-03",time:"10:52",phase:"waxing_quarter"},
  {date:"2026-07-10",time:"18:38",phase:"full"},{date:"2026-07-18",time:"06:22",phase:"waning_quarter"},
  {date:"2026-07-25",time:"11:42",phase:"new"},{date:"2026-08-01",time:"16:24",phase:"waxing_quarter"},
  {date:"2026-08-09",time:"14:54",phase:"full",eclipse:true},{date:"2026-08-16",time:"01:28",phase:"waning_quarter"},
  {date:"2026-08-23",time:"20:46",phase:"new",eclipse:true},{date:"2026-08-31",time:"00:52",phase:"waxing_quarter"},
  {date:"2026-09-07",time:"13:12",phase:"full"},{date:"2026-09-14",time:"21:38",phase:"waning_quarter"},
  {date:"2026-09-22",time:"06:54",phase:"new"},{date:"2026-09-29",time:"12:18",phase:"waxing_quarter"},
  {date:"2026-10-07",time:"12:48",phase:"full"},{date:"2026-10-14",time:"18:42",phase:"waning_quarter"},
  {date:"2026-10-21",time:"17:14",phase:"new"},{date:"2026-10-29",time:"03:28",phase:"waxing_quarter"},
  {date:"2026-11-06",time:"13:28",phase:"full"},{date:"2026-11-13",time:"14:36",phase:"waning_quarter"},
  {date:"2026-11-20",time:"04:48",phase:"new"},{date:"2026-11-28",time:"22:14",phase:"waxing_quarter"},
  {date:"2026-12-06",time:"15:28",phase:"full"},{date:"2026-12-13",time:"08:52",phase:"waning_quarter"},
  {date:"2026-12-19",time:"18:44",phase:"new"},{date:"2026-12-28",time:"19:36",phase:"waxing_quarter"},
];

const MOON_INGRESSES = [
  {date:"2026-01-01",time:"06:00",sign:"Libra",si:6},{date:"2026-01-03",time:"14:30",sign:"Scorpio",si:7},
  {date:"2026-01-06",time:"01:15",sign:"Sagittarius",si:8},{date:"2026-01-08",time:"14:00",sign:"Capricorn",si:9},
  {date:"2026-01-11",time:"02:45",sign:"Aquarius",si:10},{date:"2026-01-13",time:"13:30",sign:"Pisces",si:11},
  {date:"2026-01-15",time:"21:15",sign:"Aries",si:0},{date:"2026-01-18",time:"02:00",sign:"Taurus",si:1},
  {date:"2026-01-20",time:"04:30",sign:"Gemini",si:2},{date:"2026-01-22",time:"05:45",sign:"Cancer",si:3},
  {date:"2026-01-24",time:"07:00",sign:"Leo",si:4},{date:"2026-01-26",time:"09:30",sign:"Virgo",si:5},
  {date:"2026-01-28",time:"14:15",sign:"Libra",si:6},{date:"2026-01-30",time:"22:00",sign:"Scorpio",si:7},
  {date:"2026-02-02",time:"08:30",sign:"Sagittarius",si:8},{date:"2026-02-04",time:"21:00",sign:"Capricorn",si:9},
  {date:"2026-02-07",time:"09:30",sign:"Aquarius",si:10},{date:"2026-02-09",time:"20:15",sign:"Pisces",si:11},
  {date:"2026-02-12",time:"04:00",sign:"Aries",si:0},{date:"2026-02-14",time:"08:45",sign:"Taurus",si:1},
  {date:"2026-02-16",time:"11:00",sign:"Gemini",si:2},{date:"2026-02-18",time:"11:45",sign:"Cancer",si:3},
  {date:"2026-02-20",time:"12:30",sign:"Leo",si:4},{date:"2026-02-22",time:"14:45",sign:"Virgo",si:5},
  {date:"2026-02-24",time:"19:30",sign:"Libra",si:6},{date:"2026-02-27",time:"03:15",sign:"Scorpio",si:7},
  {date:"2026-03-01",time:"13:45",sign:"Sagittarius",si:8},{date:"2026-03-04",time:"02:15",sign:"Capricorn",si:9},
  {date:"2026-03-06",time:"14:30",sign:"Aquarius",si:10},{date:"2026-03-09",time:"01:00",sign:"Pisces",si:11},
  {date:"2026-03-11",time:"08:45",sign:"Aries",si:0},{date:"2026-03-13",time:"13:30",sign:"Taurus",si:1},
  {date:"2026-03-15",time:"15:45",sign:"Gemini",si:2},{date:"2026-03-17",time:"16:30",sign:"Cancer",si:3},
  {date:"2026-03-19",time:"17:15",sign:"Leo",si:4},{date:"2026-03-21",time:"19:30",sign:"Virgo",si:5},
  {date:"2026-03-24",time:"00:15",sign:"Libra",si:6},{date:"2026-03-26",time:"08:00",sign:"Scorpio",si:7},
  {date:"2026-03-28",time:"18:30",sign:"Sagittarius",si:8},{date:"2026-03-31",time:"07:00",sign:"Capricorn",si:9},
  {date:"2026-04-02",time:"19:30",sign:"Aquarius",si:10},{date:"2026-04-05",time:"06:15",sign:"Pisces",si:11},
  {date:"2026-04-07",time:"14:00",sign:"Aries",si:0},{date:"2026-04-09",time:"18:45",sign:"Taurus",si:1},
  {date:"2026-04-11",time:"21:00",sign:"Gemini",si:2},{date:"2026-04-13",time:"21:30",sign:"Cancer",si:3},
  {date:"2026-04-15",time:"22:00",sign:"Leo",si:4},{date:"2026-04-18",time:"00:15",sign:"Virgo",si:5},
  {date:"2026-04-20",time:"05:00",sign:"Libra",si:6},{date:"2026-04-22",time:"13:00",sign:"Scorpio",si:7},
  {date:"2026-04-24",time:"23:30",sign:"Sagittarius",si:8},{date:"2026-04-27",time:"12:00",sign:"Capricorn",si:9},
  {date:"2026-04-30",time:"00:30",sign:"Aquarius",si:10},{date:"2026-05-02",time:"11:00",sign:"Pisces",si:11},
  {date:"2026-05-04",time:"19:00",sign:"Aries",si:0},{date:"2026-05-06",time:"23:30",sign:"Taurus",si:1},
  {date:"2026-05-09",time:"01:45",sign:"Gemini",si:2},{date:"2026-05-11",time:"02:30",sign:"Cancer",si:3},
  {date:"2026-05-13",time:"03:00",sign:"Leo",si:4},{date:"2026-05-15",time:"04:30",sign:"Virgo",si:5},
  {date:"2026-05-17",time:"08:15",sign:"Libra",si:6},{date:"2026-05-19",time:"15:30",sign:"Scorpio",si:7},
  {date:"2026-05-22",time:"02:00",sign:"Sagittarius",si:8},{date:"2026-05-24",time:"14:30",sign:"Capricorn",si:9},
  {date:"2026-05-27",time:"03:00",sign:"Aquarius",si:10},{date:"2026-05-29",time:"13:30",sign:"Pisces",si:11},
  {date:"2026-06-01",time:"21:00",sign:"Aries",si:0},{date:"2026-06-04",time:"01:30",sign:"Taurus",si:1},
  {date:"2026-06-06",time:"03:45",sign:"Gemini",si:2},{date:"2026-06-08",time:"04:30",sign:"Cancer",si:3},
  {date:"2026-06-10",time:"05:15",sign:"Leo",si:4},{date:"2026-06-12",time:"07:30",sign:"Virgo",si:5},
  {date:"2026-06-14",time:"12:15",sign:"Libra",si:6},{date:"2026-06-16",time:"20:00",sign:"Scorpio",si:7},
  {date:"2026-06-19",time:"06:30",sign:"Sagittarius",si:8},{date:"2026-06-21",time:"19:00",sign:"Capricorn",si:9},
  {date:"2026-06-24",time:"07:30",sign:"Aquarius",si:10},{date:"2026-06-26",time:"18:00",sign:"Pisces",si:11},
  {date:"2026-06-29",time:"01:30",sign:"Aries",si:0},{date:"2026-07-01",time:"06:00",sign:"Taurus",si:1},
  {date:"2026-07-03",time:"08:30",sign:"Gemini",si:2},{date:"2026-07-05",time:"09:45",sign:"Cancer",si:3},
  {date:"2026-07-07",time:"10:30",sign:"Leo",si:4},{date:"2026-07-09",time:"12:45",sign:"Virgo",si:5},
  {date:"2026-07-11",time:"17:30",sign:"Libra",si:6},{date:"2026-07-14",time:"01:15",sign:"Scorpio",si:7},
  {date:"2026-07-16",time:"11:45",sign:"Sagittarius",si:8},{date:"2026-07-19",time:"00:15",sign:"Capricorn",si:9},
  {date:"2026-07-21",time:"12:45",sign:"Aquarius",si:10},{date:"2026-07-23",time:"23:15",sign:"Pisces",si:11},
  {date:"2026-07-26",time:"07:00",sign:"Aries",si:0},{date:"2026-07-28",time:"11:30",sign:"Taurus",si:1},
  {date:"2026-07-30",time:"13:45",sign:"Gemini",si:2},{date:"2026-08-01",time:"14:30",sign:"Cancer",si:3},
  {date:"2026-08-03",time:"15:15",sign:"Leo",si:4},{date:"2026-08-05",time:"17:30",sign:"Virgo",si:5},
  {date:"2026-08-07",time:"22:15",sign:"Libra",si:6},{date:"2026-08-10",time:"06:00",sign:"Scorpio",si:7},
  {date:"2026-08-12",time:"16:30",sign:"Sagittarius",si:8},{date:"2026-08-15",time:"05:00",sign:"Capricorn",si:9},
  {date:"2026-08-17",time:"17:30",sign:"Aquarius",si:10},{date:"2026-08-20",time:"04:00",sign:"Pisces",si:11},
  {date:"2026-08-22",time:"11:30",sign:"Aries",si:0},{date:"2026-08-24",time:"16:00",sign:"Taurus",si:1},
  {date:"2026-08-26",time:"18:15",sign:"Gemini",si:2},{date:"2026-08-28",time:"19:00",sign:"Cancer",si:3},
  {date:"2026-08-30",time:"19:45",sign:"Leo",si:4},{date:"2026-09-01",time:"22:00",sign:"Virgo",si:5},
  {date:"2026-09-04",time:"02:45",sign:"Libra",si:6},{date:"2026-09-06",time:"10:30",sign:"Scorpio",si:7},
  {date:"2026-09-08",time:"21:00",sign:"Sagittarius",si:8},{date:"2026-09-11",time:"09:30",sign:"Capricorn",si:9},
  {date:"2026-09-13",time:"22:00",sign:"Aquarius",si:10},{date:"2026-09-16",time:"08:30",sign:"Pisces",si:11},
  {date:"2026-09-18",time:"16:00",sign:"Aries",si:0},{date:"2026-09-20",time:"20:30",sign:"Taurus",si:1},
  {date:"2026-09-22",time:"22:45",sign:"Gemini",si:2},{date:"2026-09-24",time:"23:30",sign:"Cancer",si:3},
  {date:"2026-09-27",time:"00:15",sign:"Leo",si:4},{date:"2026-09-29",time:"02:30",sign:"Virgo",si:5},
  {date:"2026-10-01",time:"07:15",sign:"Libra",si:6},{date:"2026-10-03",time:"15:00",sign:"Scorpio",si:7},
  {date:"2026-10-06",time:"01:30",sign:"Sagittarius",si:8},{date:"2026-10-08",time:"14:00",sign:"Capricorn",si:9},
  {date:"2026-10-11",time:"02:30",sign:"Aquarius",si:10},{date:"2026-10-13",time:"13:00",sign:"Pisces",si:11},
  {date:"2026-10-15",time:"20:30",sign:"Aries",si:0},{date:"2026-10-18",time:"01:00",sign:"Taurus",si:1},
  {date:"2026-10-20",time:"03:15",sign:"Gemini",si:2},{date:"2026-10-22",time:"04:00",sign:"Cancer",si:3},
  {date:"2026-10-24",time:"04:45",sign:"Leo",si:4},{date:"2026-10-26",time:"07:00",sign:"Virgo",si:5},
  {date:"2026-10-28",time:"11:45",sign:"Libra",si:6},{date:"2026-10-30",time:"19:30",sign:"Scorpio",si:7},
  {date:"2026-11-02",time:"06:00",sign:"Sagittarius",si:8},{date:"2026-11-04",time:"18:30",sign:"Capricorn",si:9},
  {date:"2026-11-07",time:"07:00",sign:"Aquarius",si:10},{date:"2026-11-09",time:"17:30",sign:"Pisces",si:11},
  {date:"2026-11-12",time:"01:00",sign:"Aries",si:0},{date:"2026-11-14",time:"05:30",sign:"Taurus",si:1},
  {date:"2026-11-16",time:"07:45",sign:"Gemini",si:2},{date:"2026-11-18",time:"08:30",sign:"Cancer",si:3},
  {date:"2026-11-20",time:"09:15",sign:"Leo",si:4},{date:"2026-11-22",time:"11:30",sign:"Virgo",si:5},
  {date:"2026-11-24",time:"16:15",sign:"Libra",si:6},{date:"2026-11-27",time:"00:00",sign:"Scorpio",si:7},
  {date:"2026-11-29",time:"10:30",sign:"Sagittarius",si:8},{date:"2026-12-01",time:"23:00",sign:"Capricorn",si:9},
  {date:"2026-12-04",time:"11:30",sign:"Aquarius",si:10},{date:"2026-12-06",time:"22:00",sign:"Pisces",si:11},
  {date:"2026-12-09",time:"06:00",sign:"Aries",si:0},{date:"2026-12-11",time:"11:00",sign:"Taurus",si:1},
  {date:"2026-12-13",time:"13:15",sign:"Gemini",si:2},{date:"2026-12-15",time:"13:45",sign:"Cancer",si:3},
  {date:"2026-12-17",time:"14:30",sign:"Leo",si:4},{date:"2026-12-19",time:"17:00",sign:"Virgo",si:5},
  {date:"2026-12-21",time:"22:00",sign:"Libra",si:6},{date:"2026-12-24",time:"06:00",sign:"Scorpio",si:7},
  {date:"2026-12-26",time:"16:30",sign:"Sagittarius",si:8},{date:"2026-12-29",time:"05:00",sign:"Capricorn",si:9},
  {date:"2026-12-31",time:"17:30",sign:"Aquarius",si:10},
];

const PLANETARY_EVENTS = [
  {date:"2026-01-14",planet:"mercury",grade:"A",type:"Mercury Retrograde",bias:"caution",layer:"tactical",desc:"Mercury stations retrograde. Execution risk HIGH.",sectors:["IT","Telecom"]},
  {date:"2026-02-04",planet:"mercury",grade:"A",type:"Mercury Direct",bias:"bullish",layer:"tactical",desc:"Mercury turns direct. Tactical clarity restored.",sectors:["IT","Telecom"]},
  {date:"2026-03-07",planet:"saturn",grade:"A",type:"Saturn → Aries",bias:"bearish",layer:"structural",desc:"STRUCTURAL SHIFT. Saturn debilitated in Aries begins.",sectors:["Defense","Energy","Infrastructure"]},
  {date:"2026-03-25",planet:"venus",grade:"A",type:"Venus Retrograde",bias:"bearish",layer:"trend",desc:"Venus retrograde. Banking/NBFC stress, valuation reset.",sectors:["Banking","NBFC","Luxury"]},
  {date:"2026-04-05",planet:"mars",grade:"B",type:"Mars → Cancer",bias:"bearish",layer:"trend",desc:"Mars debilitated. Energy sector weakens.",sectors:["Energy","Defense"]},
  {date:"2026-04-12",planet:"moon",grade:"A",type:"Lunar Eclipse ♌",bias:"volatile",layer:"structural",desc:"Eclipse Season 1 — major pivot zone.",sectors:["All"]},
  {date:"2026-04-28",planet:"moon",grade:"A",type:"Solar Eclipse ♈",bias:"volatile",layer:"structural",desc:"Solar eclipse closes Season 1.",sectors:["Defense","Startups"]},
  {date:"2026-05-05",planet:"venus",grade:"A",type:"Venus Direct",bias:"bullish",layer:"trend",desc:"Venus direct. Valuation expansion resumes.",sectors:["Banking","NBFC","Luxury"]},
  {date:"2026-05-14",planet:"jupiter",grade:"A",type:"Jupiter → Cancer ♋",bias:"bullish",layer:"structural",desc:"HIGHEST IMPACT. Jupiter exalted in Cancer. Broad bull bias.",sectors:["FMCG","PSU Banks","Agri"]},
  {date:"2026-05-29",planet:"mercury",grade:"B",type:"Mercury Retrograde",bias:"caution",layer:"tactical",desc:"Mercury retro season 2.",sectors:["IT","Telecom"]},
  {date:"2026-06-12",planet:"mercury",grade:"B",type:"Mercury Direct",bias:"bullish",layer:"tactical",desc:"Mercury direct. IT clarity restored.",sectors:["IT","Telecom"]},
  {date:"2026-06-19",planet:"mars",grade:"A",type:"Mars ☌ Jupiter",bias:"bullish",layer:"structural",desc:"PEAK CONVICTION. Mars meets exalted Jupiter in Cancer.",sectors:["FMCG","PSU Banks","Agri"]},
  {date:"2026-07-04",planet:"mars",grade:"B",type:"Mars → Leo",bias:"bullish",layer:"trend",desc:"Mars in Leo. Pharma, large caps get momentum.",sectors:["Pharma","Entertainment"]},
  {date:"2026-08-09",planet:"moon",grade:"A",type:"Lunar Eclipse ♒",bias:"volatile",layer:"structural",desc:"Eclipse Season 2 — second pivot.",sectors:["All"]},
  {date:"2026-08-23",planet:"moon",grade:"A",type:"Solar Eclipse ♌",bias:"volatile",layer:"structural",desc:"Solar eclipse closes Season 2.",sectors:["Pharma","Large Caps"]},
  {date:"2026-09-09",planet:"jupiter",grade:"A",type:"Jupiter Retrograde",bias:"caution",layer:"structural",desc:"Jupiter retrograde. Consolidation — accumulate.",sectors:["FMCG","PSU Banks"]},
  {date:"2026-09-25",planet:"mercury",grade:"B",type:"Mercury Retrograde",bias:"caution",layer:"tactical",desc:"Mercury retro season 3.",sectors:["IT","Telecom"]},
  {date:"2026-10-14",planet:"mercury",grade:"B",type:"Mercury Direct",bias:"bullish",layer:"tactical",desc:"Mercury direct. Q4 clarity.",sectors:["IT","Telecom"]},
  {date:"2026-10-17",planet:"saturn",grade:"A",type:"Saturn Retrograde",bias:"bearish",layer:"structural",desc:"Saturn retrograde. Structural fears resurface.",sectors:["Infrastructure","PSU"]},
  {date:"2026-11-14",planet:"rahu",grade:"A",type:"Rahu → Aquarius",bias:"bullish",layer:"structural",desc:"New 18-month obsession: AI/tech disruption.",sectors:["AI Tech","Fintech"]},
  {date:"2026-12-01",planet:"jupiter",grade:"A",type:"Jupiter Direct",bias:"bullish",layer:"structural",desc:"YEAR-END RESUMPTION. Jupiter direct — re-enter.",sectors:["FMCG","PSU Banks","Agri"]},
  {date:"2026-12-12",planet:"saturn",grade:"B",type:"Saturn Direct",bias:"neutral",layer:"structural",desc:"Saturn direct. New leadership confirmed.",sectors:["Defense","Engineering"]},
];

const PANCHANG = [
  {date:"2026-05-01",tithi:8,tC:null,nak:14,nC:null,yoga:15,yC:null,q:2,vaar:"Friday",si:11},
  {date:"2026-05-02",tithi:9,tC:"11:20",nak:14,nC:null,yoga:16,yC:"14:30",q:2,vaar:"Saturday",si:11},
  {date:"2026-05-04",tithi:11,tC:"13:40",nak:15,nC:null,yoga:18,yC:"09:50",q:2,vaar:"Monday",si:0},
  {date:"2026-05-05",tithi:12,tC:null,nak:16,nC:"12:15",yoga:19,yC:null,q:3,vaar:"Tuesday",si:0},
  {date:"2026-05-06",tithi:13,tC:"10:30",nak:16,nC:null,yoga:20,yC:"15:00",q:2,vaar:"Wednesday",si:1},
  {date:"2026-05-07",tithi:14,tC:null,nak:17,nC:"11:00",yoga:21,yC:null,q:1,vaar:"Thursday",si:1},
  {date:"2026-05-08",tithi:15,tC:"14:20",nak:17,nC:null,yoga:22,yC:"10:15",q:2,vaar:"Friday",si:2},
  {date:"2026-05-11",tithi:18,tC:null,nak:19,nC:"10:20",yoga:25,yC:null,q:1,vaar:"Monday",si:3},
  {date:"2026-05-12",tithi:19,tC:"12:10",nak:19,nC:null,yoga:26,yC:"14:45",q:3,vaar:"Tuesday",si:3},
  {date:"2026-05-13",tithi:20,tC:null,nak:20,nC:"11:30",yoga:27,yC:null,q:0,vaar:"Wednesday",si:4},
  {date:"2026-05-14",tithi:21,tC:"10:00",nak:20,nC:null,yoga:1,yC:"13:15",q:2,vaar:"Thursday",si:4},
  {date:"2026-05-15",tithi:22,tC:null,nak:21,nC:"12:45",yoga:2,yC:null,q:3,vaar:"Friday",si:5},
  {date:"2026-05-18",tithi:25,tC:"09:30",nak:22,nC:null,yoga:5,yC:"14:00",q:3,vaar:"Monday",si:6},
  {date:"2026-05-19",tithi:26,tC:null,nak:23,nC:"11:45",yoga:6,yC:null,q:0,vaar:"Tuesday",si:7},
  {date:"2026-05-20",tithi:27,tC:"13:00",nak:23,nC:null,yoga:7,yC:"09:20",q:2,vaar:"Wednesday",si:7},
  {date:"2026-05-21",tithi:28,tC:null,nak:24,nC:"12:20",yoga:8,yC:null,q:3,vaar:"Thursday",si:8},
  {date:"2026-05-22",tithi:29,tC:"10:45",nak:24,nC:null,yoga:9,yC:"14:30",q:1,vaar:"Friday",si:8},
  {date:"2026-05-25",tithi:2,tC:null,nak:26,nC:"13:15",yoga:12,yC:null,q:3,vaar:"Monday",si:9},
  {date:"2026-05-26",tithi:3,tC:"09:20",nak:26,nC:null,yoga:13,yC:"14:45",q:0,vaar:"Tuesday",si:10},
  {date:"2026-05-27",tithi:4,tC:null,nak:27,nC:"10:30",yoga:14,yC:null,q:1,vaar:"Wednesday",si:10},
  {date:"2026-05-28",tithi:5,tC:"11:45",nak:27,nC:null,yoga:15,yC:"13:00",q:3,vaar:"Thursday",si:11},
  {date:"2026-05-29",tithi:6,tC:null,nak:1,nC:"12:00",yoga:16,yC:null,q:2,vaar:"Friday",si:11},
  {date:"2026-06-01",tithi:9,tC:"13:45",nak:2,nC:null,yoga:19,yC:"14:20",q:0,vaar:"Monday",si:0},
  {date:"2026-06-02",tithi:10,tC:null,nak:3,nC:"10:00",yoga:20,yC:null,q:3,vaar:"Tuesday",si:0},
  {date:"2026-06-03",tithi:11,tC:"09:30",nak:3,nC:null,yoga:21,yC:"13:30",q:3,vaar:"Wednesday",si:1},
  {date:"2026-06-04",tithi:12,tC:null,nak:4,nC:"11:15",yoga:22,yC:null,q:3,vaar:"Thursday",si:1},
  {date:"2026-06-05",tithi:13,tC:"12:00",nak:4,nC:null,yoga:23,yC:"10:45",q:2,vaar:"Friday",si:2},
  {date:"2026-06-08",tithi:16,tC:null,nak:6,nC:"10:15",yoga:1,yC:null,q:1,vaar:"Monday",si:3},
  {date:"2026-06-09",tithi:17,tC:"13:20",nak:6,nC:null,yoga:27,yC:"09:40",q:0,vaar:"Tuesday",si:3},
  {date:"2026-06-10",tithi:18,tC:null,nak:7,nC:"11:45",yoga:1,yC:null,q:2,vaar:"Wednesday",si:4},
  {date:"2026-06-11",tithi:19,tC:"10:30",nak:7,nC:null,yoga:2,yC:"14:15",q:3,vaar:"Thursday",si:4},
  {date:"2026-06-12",tithi:20,tC:null,nak:8,nC:"12:00",yoga:3,yC:null,q:3,vaar:"Friday",si:5},
  {date:"2026-06-15",tithi:23,tC:"09:45",nak:9,nC:null,yoga:6,yC:"14:45",q:1,vaar:"Monday",si:6},
  {date:"2026-06-16",tithi:24,tC:null,nak:10,nC:"11:30",yoga:7,yC:null,q:2,vaar:"Tuesday",si:6},
  {date:"2026-06-17",tithi:25,tC:"12:45",nak:10,nC:null,yoga:8,yC:"10:00",q:3,vaar:"Wednesday",si:7},
  {date:"2026-06-18",tithi:26,tC:null,nak:11,nC:"10:15",yoga:9,yC:null,q:2,vaar:"Thursday",si:7},
  {date:"2026-06-19",tithi:27,tC:"13:30",nak:11,nC:null,yoga:10,yC:"14:30",q:3,vaar:"Friday",si:8},
  {date:"2026-06-22",tithi:30,tC:null,nak:13,nC:"11:45",yoga:13,yC:null,q:0,vaar:"Monday",si:9},
  {date:"2026-06-23",tithi:1,tC:"12:15",nak:13,nC:null,yoga:14,yC:"14:00",q:2,vaar:"Tuesday",si:10},
  {date:"2026-06-24",tithi:2,tC:null,nak:14,nC:"10:30",yoga:15,yC:null,q:3,vaar:"Wednesday",si:10},
  {date:"2026-06-25",tithi:3,tC:"11:00",nak:14,nC:null,yoga:16,yC:"13:45",q:3,vaar:"Thursday",si:11},
  {date:"2026-06-26",tithi:4,tC:null,nak:15,nC:"12:30",yoga:17,yC:null,q:0,vaar:"Friday",si:11},
  {date:"2026-06-29",tithi:7,tC:"13:00",nak:16,nC:null,yoga:20,yC:"14:30",q:3,vaar:"Monday",si:0},
  {date:"2026-06-30",tithi:8,tC:null,nak:17,nC:"10:45",yoga:21,yC:null,q:3,vaar:"Tuesday",si:0},
];

const SECTOR_HEATMAP = [
  {sector:"FMCG",signal:92,bias:"bull",driver:"♃ Jupiter exalted Cancer"},
  {sector:"PSU Banks",signal:88,bias:"bull",driver:"♃ Jupiter exaltation zone"},
  {sector:"Agri",signal:85,bias:"bull",driver:"☽ Moon + ♃ Jupiter"},
  {sector:"Pharma",signal:75,bias:"bull",driver:"☊ Rahu in Pisces"},
  {sector:"AI/Fintech",signal:80,bias:"bull",driver:"♅ Herschel + ♇ Pluto"},
  {sector:"Banking",signal:65,bias:"bull",driver:"♀ Venus post-retro"},
  {sector:"IT (Trad.)",signal:45,bias:"neutral",driver:"♅ Herschel disruption"},
  {sector:"Defense",signal:52,bias:"neutral",driver:"♄ Saturn Aries stress"},
  {sector:"Energy",signal:40,bias:"bear",driver:"♂ Mars debilitated"},
  {sector:"Infrastructure",signal:36,bias:"bear",driver:"♄ Saturn entering Aries"},
];

// ─── UTILITY FUNCTIONS ────────────────────────────────────────────────────────
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MFULL=["January","February","March","April","May","June","July","August","September","October","November","December"];
function dim(y,m){return new Date(y,m+1,0).getDate();}
function ds(y,m,d){return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}
function qC(q){return q===3?"#4CAF8A":q===2?"#C9A84C":q===1?"#E89040":"#E86060";}
function qL(q){return q===3?"FAVORABLE":q===2?"NEUTRAL":q===1?"CAUTION":"AVOID";}
function gC(g){return g==="A"?"#C9A84C":g==="B"?"#60A8C0":"#708090";}
function bC(b){return b==="bullish"?"#4CAF8A":b==="bearish"?"#E86060":b==="volatile"?"#C080E0":"#C9A84C";}
function tMin(t){if(!t)return null;const[h,m]=t.split(":").map(Number);return h*60+m;}
function mToT(m){return `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;}
function mToX(m,w){return((m-SS)/(SE-SS))*w;}

function getMoonSign(dateStr){
  const target=new Date(dateStr+"T09:15:00+05:30");
  let cur=MOON_INGRESSES[0];
  for(const i of MOON_INGRESSES){const t=new Date(i.date+"T"+i.time+":00+05:30");if(t<=target)cur=i;else break;}
  return cur;
}
function getMoonAngle(dateStr){
  const target=new Date(dateStr).getTime();
  const pa={new:0,waxing_quarter:90,full:180,waning_quarter:270};
  let prev=MOON_PHASES[0],next=MOON_PHASES[MOON_PHASES.length-1];
  for(let i=0;i<MOON_PHASES.length-1;i++){
    const a=new Date(MOON_PHASES[i].date).getTime(),b=new Date(MOON_PHASES[i+1].date).getTime();
    if(target>=a&&target<=b){prev=MOON_PHASES[i];next=MOON_PHASES[i+1];break;}
  }
  const pct=(target-new Date(prev.date).getTime())/(new Date(next.date).getTime()-new Date(prev.date).getTime());
  const a0=pa[prev.phase]||0;
  return(a0+pct*90)%360;
}
function moonIcon(a){
  if(a<15||a>345)return"🌑";if(a<80)return"🌒";if(a<100)return"🌓";
  if(a<165)return"🌔";if(a<195)return"🌕";if(a<260)return"🌖";if(a<280)return"🌗";return"🌘";
}
function getPanchang(d){return PANCHANG.find(p=>p.date===d)||null;}
function getMonthEvents(m){return PLANETARY_EVENTS.filter(e=>new Date(e.date).getMonth()===m);}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function PlanetIcon({pk,size=24}){
  const p=PLANETS[pk];if(!p)return null;
  return(
    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:size,height:size,borderRadius:"50%",
      background:`radial-gradient(circle at 35% 35%,${p.color}35,${p.color}10)`,
      border:`1px solid ${p.color}50`,fontSize:size*0.52,color:p.color,
      boxShadow:`0 0 ${size*0.35}px ${p.glow}`,flexShrink:0}}>
      {p.symbol}
    </span>
  );
}

function ScoreDial({score,max=12}){
  const pct=score/max,r=40,cx=48,cy=48,circ=2*Math.PI*r,arc=circ*0.75;
  const filled=arc*pct;
  const sc=score>=10?"#4CAF8A":score>=7?"#C9A84C":score>=4?"#E89040":"#E86060";
  const lbl=score>=10?"AGGRESSIVE":score>=7?"NORMAL":score>=4?"SELECTIVE":"PRESERVE";
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <svg width={96} height={96} style={{transform:"rotate(135deg)"}}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1A2A3A" strokeWidth={7} strokeDasharray={`${arc} ${circ}`} strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={sc} strokeWidth={7}
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          style={{filter:`drop-shadow(0 0 5px ${sc})`,transition:"stroke-dasharray 1s ease"}}/>
      </svg>
      <div style={{marginTop:-64,textAlign:"center"}}>
        <div style={{fontSize:28,fontWeight:900,color:sc,fontFamily:"Cinzel,serif",lineHeight:1,filter:`drop-shadow(0 0 6px ${sc})`}}>{score}</div>
        <div style={{fontSize:8,color:"#607080",letterSpacing:1,marginTop:2}}>/{max}</div>
      </div>
      <div style={{marginTop:16,fontSize:9,letterSpacing:2,color:sc,fontFamily:"Cinzel,serif"}}>{lbl}</div>
    </div>
  );
}

// ─── MOON WAVE ────────────────────────────────────────────────────────────────
function MoonWave({month,width,height=38}){
  const days=dim(2026,month);
  const pts=[];
  for(let d=1;d<=days;d++){
    const a=getMoonAngle(ds(2026,month,d));
    const yv=0.5-0.4*Math.cos(a*Math.PI/180);
    pts.push([((d-0.5)/days)*width, height-yv*(height-6)-3]);
  }
  const path=pts.map((p,i)=>`${i===0?"M":"L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const fill=`${path} L${width},${height} L0,${height} Z`;
  const phases=MOON_PHASES.filter(p=>new Date(p.date).getMonth()===month);
  return(
    <svg width={width} height={height} style={{display:"block"}}>
      <defs>
        <linearGradient id={`mg${month}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C8D8E8" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#C8D8E8" stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#mg${month})`}/>
      <path d={path} fill="none" stroke="#C8D8E880" strokeWidth="1.5"/>
      {phases.map((ph,i)=>{
        const d=new Date(ph.date).getDate();
        const x=((d-0.5)/days)*width;
        const a=getMoonAngle(ph.date);
        const yv=0.5-0.4*Math.cos(a*Math.PI/180);
        const y=height-yv*(height-6)-3;
        return(
          <g key={i}>
            {ph.eclipse&&<circle cx={x} cy={y} r={7} fill="none" stroke="#C080E0" strokeWidth="1.5" opacity="0.8"/>}
            <circle cx={x} cy={y} r={ph.phase==="full"||ph.phase==="new"?4:2.5}
              fill={ph.phase==="full"?"#C8D8E8":ph.phase==="new"?"#1A2A3A":"#607888"}
              stroke="#C8D8E8" strokeWidth={ph.phase==="full"||ph.phase==="new"?1.5:0.5}/>
          </g>
        );
      })}
    </svg>
  );
}

// Moon sign strip
function MoonStrip({month,width}){
  const days=dim(2026,month);
  const dayData=Array.from({length:days},(_,i)=>({d:i+1,s:getMoonSign(ds(2026,month,i+1))}));
  const groups=[];
  let cur={si:dayData[0].s.si,sign:dayData[0].s.sign,start:1,end:1};
  for(let i=1;i<dayData.length;i++){
    if(dayData[i].s.si===cur.si)cur.end=dayData[i].d;
    else{groups.push({...cur});cur={si:dayData[i].s.si,sign:dayData[i].s.sign,start:dayData[i].d,end:dayData[i].d};}
  }
  groups.push(cur);
  return(
    <div style={{position:"relative",height:16,width}}>
      {groups.map((g,i)=>{
        const sg=SIGNS[g.si];
        const x=((g.start-1)/days)*width,w=((g.end-g.start+1)/days)*width;
        return(
          <div key={i} title={`Moon in ${g.sign}`} style={{
            position:"absolute",left:x,width:w-1,height:16,
            background:`${sg.color}25`,borderLeft:`2px solid ${sg.color}70`,
            display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",
          }}>
            {w>20&&<span style={{fontSize:8,color:sg.color,fontFamily:"Cinzel,serif",whiteSpace:"nowrap"}}>
              {w>45?sg.symbol+" "+g.sign.slice(0,3):sg.symbol}
            </span>}
          </div>
        );
      })}
    </div>
  );
}

// Panchang bar
function PanchangStrip({month,width}){
  const days=dim(2026,month);
  return(
    <div style={{position:"relative",height:10,width,display:"flex"}}>
      {Array.from({length:days},(_,i)=>{
        const d=i+1,dateS=ds(2026,month,d);
        const p=getPanchang(dateS);
        const q=p?p.q:null;
        const w=(1/days)*width;
        const hasChange=p&&(p.tC||p.nC||p.yC);
        return(
          <div key={d} style={{width:w-0.5,height:10,background:q!==null?`${qC(q)}55`:"#1A2A3A",position:"relative",flexShrink:0}} title={dateS+(q!==null?` ${qL(q)}`:""+(hasChange?" ⚡":""))}>
            {hasChange&&<div style={{position:"absolute",top:2,right:1,width:3,height:3,borderRadius:"50%",background:"#C9A84C"}}/>}
          </div>
        );
      })}
    </div>
  );
}

// Swim lane
function Lane({events,month,width,onClick,active}){
  const days=dim(2026,month);
  return(
    <div style={{position:"relative",height:26}}>
      <div style={{position:"absolute",top:13,left:0,right:0,height:1,background:"#1A2A3A80"}}/>
      {events.map((ev,i)=>{
        const d=new Date(ev.date).getDate();
        const x=((d-0.5)/days)*width;
        const p=PLANETS[ev.planet];
        const isAct=active?.date===ev.date;
        const sz=ev.grade==="A"?18:ev.grade==="B"?14:10;
        return(
          <div key={i} onClick={()=>onClick(ev)} title={ev.type} style={{position:"absolute",left:x-sz/2,top:(26-sz)/2,width:sz,height:sz,cursor:"pointer",zIndex:2}}>
            {isAct&&<div style={{position:"absolute",inset:-4,borderRadius:"50%",border:`2px solid ${gC(ev.grade)}`,boxShadow:`0 0 8px ${gC(ev.grade)}`,animation:"pulse 1.5s ease-in-out infinite"}}/>}
            <div style={{width:sz,height:sz,borderRadius:"50%",background:`radial-gradient(circle at 35% 35%,${p?.color||"#aaa"}35,${p?.color||"#aaa"}10)`,border:`${ev.grade==="A"?2:1}px solid ${p?.color||"#aaa"}60`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:sz*0.52,color:p?.color,boxShadow:ev.grade==="A"?`0 0 5px ${p?.color||"#aaa"}50`:"none"}}>
              {p?.symbol}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Intraday bar
function IntradayBar({p,width}){
  if(!p)return null;
  const dow=new Date(p.date).getDay();
  const rk=RAHU_KALA[dow];
  const changes=[p.tC,p.nC,p.yC].filter(Boolean).map(tMin).filter(t=>t>SS&&t<SE).sort((a,b)=>a-b);
  return(
    <div style={{position:"relative"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        {["09:15","10:00","11:00","12:00","13:00","14:00","15:00","15:30"].map(t=>(
          <span key={t} style={{fontSize:7,color:"#405060",fontFamily:"Cinzel,serif"}}>{t}</span>
        ))}
      </div>
      <div style={{position:"relative",height:28,borderRadius:4,overflow:"hidden",background:"#0A1520"}}>
        <div style={{position:"absolute",inset:0,background:`${qC(p.q)}15`}}/>
        {rk.sMin<SE&&rk.eMin>SS&&(
          <div style={{position:"absolute",left:mToX(Math.max(rk.sMin,SS),width),width:mToX(Math.min(rk.eMin,SE),width)-mToX(Math.max(rk.sMin,SS),width),height:"100%",background:"repeating-linear-gradient(45deg,#E8606028 0,#E8606028 4px,#E8101010 4px,#E8101010 8px)",borderLeft:"2px solid #E86060",borderRight:"2px solid #E86060"}}>
            <span style={{fontSize:6,color:"#E86060",fontFamily:"Cinzel,serif",padding:"2px 3px",whiteSpace:"nowrap"}}>☊ RAHU</span>
          </div>
        )}
        <div style={{position:"absolute",left:mToX(ABHIJIT.sMin,width),width:mToX(ABHIJIT.eMin,width)-mToX(ABHIJIT.sMin,width),height:"100%",background:"#4CAF8A18",borderLeft:"2px solid #4CAF8A70",borderRight:"2px solid #4CAF8A70"}}>
          <span style={{fontSize:6,color:"#4CAF8A",fontFamily:"Cinzel,serif",padding:"2px 3px",whiteSpace:"nowrap"}}>☀ ABHIJIT</span>
        </div>
        {changes.map((t,i)=>(
          <div key={i} style={{position:"absolute",left:mToX(t,width)-1,top:0,width:2,height:"100%",background:"#C9A84C",opacity:0.85}}>
            <div style={{position:"absolute",top:-14,left:-10,fontSize:6,color:"#C9A84C",fontFamily:"Cinzel,serif",whiteSpace:"nowrap",background:"#060C14",padding:"1px 2px"}}>{mToT(t)}</div>
          </div>
        ))}
        {p.date==="2026-05-02"&&(
          <div style={{position:"absolute",left:mToX(tMin("10:15"),width)-1,top:0,width:2,height:"100%",background:"#C9A84C",boxShadow:"0 0 6px #C9A84C",animation:"pulse 1.5s ease-in-out infinite"}}>
            <div style={{position:"absolute",top:-14,left:-8,fontSize:6,color:"#C9A84C",fontFamily:"Cinzel,serif",background:"#060C14",padding:"1px 2px"}}>NOW</div>
          </div>
        )}
      </div>
      {changes.length>0&&(
        <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
          <span style={{fontSize:7,color:"#C9A84C",fontFamily:"Cinzel,serif"}}>⚡</span>
          {p.tC&&tMin(p.tC)>SS&&<span style={{fontSize:7,color:"#A0B0C0"}}>Tithi @ {p.tC}</span>}
          {p.nC&&tMin(p.nC)>SS&&<span style={{fontSize:7,color:"#A0B0C0"}}>Nakshatra @ {p.nC}</span>}
          {p.yC&&tMin(p.yC)>SS&&<span style={{fontSize:7,color:"#A0B0C0"}}>Yoga @ {p.yC}</span>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════════════════

// TAB 1: COCKPIT
function CockpitTab({selDay,setSelDay}){
  const p=getPanchang(selDay);
  const angle=getMoonAngle(selDay);
  const moonSig=getMoonSign(selDay);
  const sign=SIGNS[moonSig.si];
  const rk=RAHU_KALA[new Date(selDay).getDay()];
  const today=getPanchang("2026-05-02");

  const factors=[
    {label:"Mercury",pk:"mercury",score:3,reason:"Direct — clear information flow"},
    {label:"Mars",pk:"mars",score:2,reason:"Debilitated in Cancer — reduced momentum"},
    {label:"Eclipse",pk:"sun",score:3,reason:"No eclipse window — 5+ weeks away"},
    {label:"Lunar",pk:"moon",score:2,reason:"Waning Gibbous — distribution phase"},
    {label:"Panchang",pk:"moon",score:today?today.q>=2?1:0:0,reason:today?`${qL(today.q)} session today`:"No data"},
  ];
  const total=factors.reduce((a,f)=>a+f.score,0);

  const nextGradeA=PLANETARY_EVENTS.filter(e=>e.grade==="A"&&new Date(e.date)>new Date("2026-05-02")).sort((a,b)=>new Date(a.date)-new Date(b.date))[0];
  const daysAway=nextGradeA?Math.round((new Date(nextGradeA.date)-new Date("2026-05-02"))/86400000):null;

  const [barW,setBarW]=useState(400);
  const barRef=useRef(null);
  useEffect(()=>{if(barRef.current)setBarW(barRef.current.offsetWidth-32);},[]);

  return(
    <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:16}}>
      {/* Left column */}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {/* Score */}
        <div style={{background:"#080E16",border:"1px solid #1A2A3A",borderRadius:8,padding:"16px 12px",textAlign:"center"}}>
          <div style={{fontSize:9,color:"#607080",letterSpacing:2,marginBottom:12,fontFamily:"Cinzel,serif"}}>WEEKLY ENV SCORE</div>
          <ScoreDial score={total} max={13}/>
          <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:6}}>
            {factors.map(f=>(
              <div key={f.label} style={{display:"flex",alignItems:"center",gap:7,padding:"5px 7px",background:"#0A1520",borderRadius:4,border:"1px solid #1A2A3A"}}>
                <PlanetIcon pk={f.pk} size={20}/>
                <div style={{flex:1,textAlign:"left"}}>
                  <div style={{fontSize:9,color:"#90A8B8",fontFamily:"Cinzel,serif",letterSpacing:1}}>{f.label.toUpperCase()}</div>
                  <div style={{fontSize:8,color:"#506070",marginTop:1}}>{f.reason}</div>
                </div>
                <div style={{display:"flex",gap:2}}>
                  {[1,2,3].map(n=><div key={n} style={{width:5,height:5,borderRadius:"50%",background:n<=f.score?(f.score===3?"#4CAF8A":f.score===2?"#C9A84C":"#E86060"):"#1A2A3A"}}/>)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Next A event */}
        {nextGradeA&&(
          <div style={{background:"#080E16",border:"1px solid #C9A84C25",borderRadius:8,padding:14}}>
            <div style={{fontSize:9,color:"#607080",letterSpacing:2,marginBottom:10,fontFamily:"Cinzel,serif"}}>NEXT GRADE A</div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <PlanetIcon pk={nextGradeA.planet} size={30}/>
              <div>
                <div style={{fontSize:12,color:"#C9A84C",fontFamily:"Cinzel,serif"}}>{nextGradeA.type}</div>
                <div style={{fontSize:9,color:"#607080",marginTop:2}}>{nextGradeA.date}</div>
              </div>
            </div>
            <div style={{fontSize:10,color:"#708898",lineHeight:1.6,marginBottom:10}}>{nextGradeA.desc}</div>
            <div style={{display:"flex",alignItems:"baseline",gap:6}}>
              <span style={{fontSize:26,fontFamily:"Cinzel,serif",fontWeight:900,color:"#C9A84C"}}>{daysAway}</span>
              <span style={{fontSize:9,color:"#607080",letterSpacing:2}}>DAYS AWAY</span>
            </div>
          </div>
        )}

        {/* Today panchang quick */}
        {today&&(
          <div style={{background:"#080E16",border:`1px solid ${qC(today.q)}30`,borderRadius:8,padding:14}}>
            <div style={{fontSize:9,color:"#607080",letterSpacing:2,marginBottom:10,fontFamily:"Cinzel,serif"}}>TODAY · 02 MAY 2026</div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{fontSize:24}}>{moonIcon(getMoonAngle("2026-05-02"))}</span>
              <div>
                <div style={{fontSize:12,fontFamily:"Cinzel,serif",color:qC(today.q)}}>{qL(today.q)}</div>
                <div style={{fontSize:9,color:"#607080"}}>Moon in {SIGNS[today.si]?.name}</div>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <div style={{fontSize:9,color:"#E86060"}}>☊ Rahu Kala: {rk.start}–{rk.end}</div>
              <div style={{fontSize:9,color:"#4CAF8A"}}>☀ Abhijit: 11:48–12:36</div>
              {(today.tC||today.nC||today.yC)&&<div style={{fontSize:9,color:"#C9A84C"}}>⚡ Changeover within session</div>}
            </div>
          </div>
        )}
      </div>

      {/* Right column */}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {/* 90-day timeline */}
        <div style={{background:"#080E16",border:"1px solid #1A2A3A",borderRadius:8,padding:16}}>
          <div style={{fontSize:9,color:"#607080",letterSpacing:2,marginBottom:14,fontFamily:"Cinzel,serif"}}>90-DAY FORWARD TIMELINE</div>
          {PLANETARY_EVENTS.filter(e=>{const d=Math.round((new Date(e.date)-new Date("2026-05-02"))/86400000);return d>=0&&d<=90;}).sort((a,b)=>new Date(a.date)-new Date(b.date)).map((ev,i)=>{
            const days=Math.round((new Date(ev.date)-new Date("2026-05-02"))/86400000);
            const p=PLANETS[ev.planet];
            return(
              <div key={i} style={{display:"flex",gap:10,padding:"8px 10px",borderRadius:5,marginBottom:3,background:"#0A1520",border:"1px solid #1A2A3A"}}>
                <PlanetIcon pk={ev.planet} size={22}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span style={{fontSize:11,fontFamily:"Cinzel,serif",color:p?.color||"#aaa"}}>{ev.type}</span>
                    <span style={{fontSize:8,padding:"1px 5px",borderRadius:2,background:`${gC(ev.grade)}20`,color:gC(ev.grade),fontFamily:"Cinzel,serif"}}>GRADE {ev.grade}</span>
                    <span style={{fontSize:8,padding:"1px 5px",borderRadius:2,background:`${bC(ev.bias)}15`,color:bC(ev.bias),fontFamily:"Cinzel,serif"}}>{ev.bias.toUpperCase()}</span>
                  </div>
                  <div style={{fontSize:9,color:"#506070",marginTop:2}}>{ev.date}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:16,fontFamily:"Cinzel,serif",fontWeight:700,color:days<=14?"#E89040":days<=30?"#C9A84C":"#607080"}}>{days}</div>
                  <div style={{fontSize:7,color:"#406070"}}>DAYS</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sector heatmap */}
        <div style={{background:"#080E16",border:"1px solid #1A2A3A",borderRadius:8,padding:16}}>
          <div style={{fontSize:9,color:"#607080",letterSpacing:2,marginBottom:12,fontFamily:"Cinzel,serif"}}>SECTOR SIGNAL</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {SECTOR_HEATMAP.map(s=>{
              const bc=s.bias==="bull"?"#4CAF8A":s.bias==="bear"?"#E86060":"#C9A84C";
              return(
                <div key={s.sector} style={{padding:"7px 10px",background:"#0A1520",borderRadius:4,border:`1px solid ${bc}20`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:10,color:"#A0B8C8",fontFamily:"Cinzel,serif"}}>{s.sector}</span>
                    <span style={{fontSize:10,color:bc,fontFamily:"Cinzel,serif",fontWeight:700}}>{s.signal}</span>
                  </div>
                  <div style={{height:3,background:"#1A2A3A",borderRadius:2,overflow:"hidden",marginBottom:3}}>
                    <div style={{width:`${s.signal}%`,height:"100%",background:`linear-gradient(to right,${bc}60,${bc})`,borderRadius:2}}/>
                  </div>
                  <div style={{fontSize:7,color:"#406070"}}>{s.driver}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// TAB 2: TIMELINE
function TimelineTab(){
  const [selMonth,setSelMonth]=useState(4);
  const [activeEv,setActiveEv]=useState(null);
  const [selDay,setSelDay]=useState("2026-05-02");
  const [width,setWidth]=useState(700);
  const ref=useRef(null);
  useEffect(()=>{
    const u=()=>{if(ref.current)setWidth(ref.current.offsetWidth-40);};
    u();window.addEventListener("resize",u);return()=>window.removeEventListener("resize",u);
  },[]);

  const evs=getMonthEvents(selMonth);
  const structural=evs.filter(e=>e.layer==="structural");
  const trend=evs.filter(e=>e.layer==="trend");
  const tactical=evs.filter(e=>e.layer==="tactical");
  const sentiment=evs.filter(e=>e.layer==="sentiment");
  const panchang=getPanchang(selDay);

  return(
    <div>
      {/* Era bands */}
      <div style={{marginBottom:14,display:"flex",flexDirection:"column",gap:3}}>
        {[
          {label:"♇ Pluto in Aquarius",color:"#906080",sub:"2024–2044 · Tech democratization"},
          {label:"♅ Herschel in Gemini",color:"#60C8C0",sub:"2025–2033 · AI & communication disruption"},
          {label:"♄ Saturn in Aries (debilitated)",color:"#B0A080",sub:"Mar 2026–2028 · Structural stress"},
          {label:"♃ Jupiter in Cancer (exalted)",color:"#C8A050",sub:"May 2026–May 2027 · Bull bias"},
        ].map(e=>(
          <div key={e.label} style={{padding:"3px 10px",borderRadius:3,background:`${e.color}10`,borderLeft:`3px solid ${e.color}50`,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:9,color:e.color,fontFamily:"Cinzel,serif",letterSpacing:1}}>{e.label}</span>
            <span style={{fontSize:8,color:"#405060"}}>{e.sub}</span>
          </div>
        ))}
      </div>

      {/* Month tabs */}
      <div style={{display:"flex",gap:3,marginBottom:14,flexWrap:"wrap"}}>
        {MONTHS.map((m,i)=>{
          const hasA=getMonthEvents(i).some(e=>e.grade==="A");
          const hasB=getMonthEvents(i).some(e=>e.grade==="B");
          const isSel=selMonth===i;
          return(
            <button key={i} onClick={()=>setSelMonth(i)} style={{padding:"5px 11px",background:isSel?"#0E1E2E":"transparent",border:`1px solid ${isSel?"#C9A84C50":"#1A2A3A"}`,borderRadius:4,color:isSel?"#C9A84C":"#607080",fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1,cursor:"pointer",position:"relative",transition:"all 0.15s"}}>
              {m.toUpperCase()}
              {hasA&&<span style={{position:"absolute",top:3,right:3,width:4,height:4,borderRadius:"50%",background:"#C9A84C",boxShadow:"0 0 4px #C9A84C"}}/>}
              {!hasA&&hasB&&<span style={{position:"absolute",top:3,right:3,width:4,height:4,borderRadius:"50%",background:"#60A8C0"}}/>}
            </button>
          );
        })}
      </div>

      {/* Timeline block */}
      <div ref={ref} style={{background:"#080E16",border:"1px solid #1A2A3A",borderRadius:10,padding:"14px 20px 12px",marginBottom:14}}>
        <div style={{fontSize:12,fontFamily:"Cinzel,serif",color:"#C9A84C",letterSpacing:2,marginBottom:12}}>{MFULL[selMonth].toUpperCase()} 2026</div>

        {/* Day row */}
        <div style={{display:"flex",marginBottom:4}}>
          {Array.from({length:dim(2026,selMonth)},(_,i)=>{
            const d=i+1,dateS=ds(2026,selMonth,d);
            const pg=getPanchang(dateS);
            const q=pg?pg.q:null;
            const dow=new Date(dateS).getDay();
            const isWk=dow===0||dow===6;
            const isSel=selDay===dateS;
            const isToday=dateS==="2026-05-02";
            const cw=width/dim(2026,selMonth);
            return(
              <div key={d} onClick={()=>setSelDay(dateS)} style={{width:cw-0.5,height:22,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:7,background:isSel?"#1A3A4A":isToday?"#1A2E1A":isWk?"#0C1520":"transparent",borderRadius:2,borderBottom:q!==null?`2px solid ${qC(q)}`:undefined,color:isSel?"#C9A84C":isWk?"#405060":"#607080",fontFamily:"Cinzel,serif",flexShrink:0}}>
                {cw>12?d:(d%5===0?d:"")}
              </div>
            );
          })}
        </div>

        {/* Swim lanes */}
        {[["STRUCTURAL",structural],["TREND",trend],["TACTICAL",tactical],sentinel=sentiment.length>0?["SENTIMENT",sentiment]:null].filter(Boolean).map(([label,levs])=>(
          <div key={label} style={{marginBottom:3}}>
            <div style={{fontSize:7,color:"#506070",letterSpacing:2,fontFamily:"Cinzel,serif",marginBottom:1}}>── {label}</div>
            <Lane events={levs} month={selMonth} width={width} onClick={e=>setActiveEv(activeEv?.date===e.date?null:e)} active={activeEv}/>
          </div>
        ))}

        {/* Moon wave */}
        <div style={{marginTop:6}}>
          <div style={{fontSize:7,color:"#506070",letterSpacing:2,fontFamily:"Cinzel,serif",marginBottom:3}}>── ☽ LUNAR WAVE</div>
          <MoonWave month={selMonth} width={width} height={36}/>
        </div>
        <div style={{marginTop:3}}>
          <div style={{fontSize:7,color:"#506070",letterSpacing:2,fontFamily:"Cinzel,serif",marginBottom:2}}>── ☽ MOON SIGN (SIDEREAL)</div>
          <MoonStrip month={selMonth} width={width}/>
        </div>
        <div style={{marginTop:3}}>
          <div style={{fontSize:7,color:"#506070",letterSpacing:2,fontFamily:"Cinzel,serif",marginBottom:2}}>── PANCHANG QUALITY  ● = INTRADAY CHANGEOVER</div>
          <PanchangStrip month={selMonth} width={width}/>
        </div>

        {/* Legend */}
        <div style={{display:"flex",gap:10,marginTop:6,flexWrap:"wrap"}}>
          {[[3,"Favorable"],[2,"Neutral"],[1,"Caution"],[0,"Avoid"]].map(([q,l])=>(
            <div key={q} style={{display:"flex",alignItems:"center",gap:3}}>
              <div style={{width:8,height:8,borderRadius:2,background:`${qC(q)}50`,border:`1px solid ${qC(q)}`}}/>
              <span style={{fontSize:7,color:"#506070",fontFamily:"Cinzel,serif"}}>{l}</span>
            </div>
          ))}
          <div style={{display:"flex",alignItems:"center",gap:3}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:"#C9A84C"}}/>
            <span style={{fontSize:7,color:"#506070"}}>Changeover</span>
          </div>
        </div>
      </div>

      {/* Bottom: event detail + day panchang */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div style={{background:"#080E16",border:`1px solid ${activeEv?gC(activeEv.grade)+"30":"#1A2A3A"}`,borderRadius:8,padding:14}}>
          <div style={{fontSize:9,color:"#607080",letterSpacing:2,fontFamily:"Cinzel,serif",marginBottom:10}}>EVENT DETAIL</div>
          {activeEv?(
            <div style={{animation:"fadeIn 0.2s ease"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <PlanetIcon pk={activeEv.planet} size={32}/>
                <div>
                  <div style={{fontSize:13,fontFamily:"Cinzel,serif",color:PLANETS[activeEv.planet]?.color}}>{activeEv.type}</div>
                  <div style={{fontSize:9,color:"#506070",marginTop:2}}>{activeEv.date}</div>
                </div>
                <div style={{marginLeft:"auto",display:"flex",gap:5}}>
                  <span style={{fontSize:8,padding:"2px 6px",borderRadius:2,background:`${gC(activeEv.grade)}20`,color:gC(activeEv.grade),fontFamily:"Cinzel,serif"}}>GRADE {activeEv.grade}</span>
                  <span style={{fontSize:8,padding:"2px 6px",borderRadius:2,background:`${bC(activeEv.bias)}15`,color:bC(activeEv.bias),fontFamily:"Cinzel,serif"}}>{activeEv.bias.toUpperCase()}</span>
                </div>
              </div>
              <div style={{fontSize:11,color:"#90A8B8",lineHeight:1.7,marginBottom:8}}>{activeEv.desc}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {activeEv.sectors.map(s=><span key={s} style={{fontSize:8,padding:"2px 6px",borderRadius:2,background:"#0A1A28",border:"1px solid #1E3040",color:"#70A0C0",fontFamily:"Cinzel,serif"}}>{s}</span>)}
              </div>
            </div>
          ):(
            <div>
              <div style={{fontSize:10,color:"#304050",marginBottom:12}}>Click a planet marker on the timeline to see full analysis.</div>
              {evs.filter(e=>e.grade!=="C").map((ev,i)=>(
                <div key={i} onClick={()=>setActiveEv(ev)} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:4,marginBottom:4,background:"#0A1520",cursor:"pointer",border:"1px solid #1A2A3A"}}>
                  <PlanetIcon pk={ev.planet} size={18}/>
                  <div style={{flex:1}}><div style={{fontSize:10,color:"#A0B8C8",fontFamily:"Cinzel,serif"}}>{ev.type}</div><div style={{fontSize:8,color:"#405060"}}>{ev.date}</div></div>
                  <span style={{fontSize:7,padding:"1px 5px",borderRadius:2,background:`${bC(ev.bias)}15`,color:bC(ev.bias),fontFamily:"Cinzel,serif"}}>{ev.bias.toUpperCase()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Day panchang */}
        <div style={{background:"#080E16",border:`1px solid ${panchang?qC(panchang.q)+"30":"#1A2A3A"}`,borderRadius:8,padding:14}}>
          <div style={{fontSize:9,color:"#607080",letterSpacing:2,fontFamily:"Cinzel,serif",marginBottom:10}}>DAY PANCHANG</div>
          {panchang?(
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <span style={{fontSize:24}}>{moonIcon(getMoonAngle(selDay))}</span>
                <div>
                  <div style={{fontSize:12,fontFamily:"Cinzel,serif",color:"#C9A84C"}}>{selDay}</div>
                  <div style={{fontSize:10,color:qC(panchang.q),fontFamily:"Cinzel,serif",letterSpacing:1,marginTop:2}}>{qL(panchang.q)}</div>
                </div>
                <div style={{marginLeft:"auto",textAlign:"right"}}>
                  <div style={{fontSize:9,color:"#506070"}}>Moon in</div>
                  <div style={{fontSize:12,color:SIGNS[panchang.si]?.color,fontFamily:"Cinzel,serif"}}>{SIGNS[panchang.si]?.symbol} {SIGNS[panchang.si]?.name}</div>
                </div>
              </div>
              {/* Intraday bar */}
              <div ref={r=>{if(r){}}} style={{marginBottom:10}}>
                <IntradayBar p={panchang} width={380}/>
              </div>
              {/* Tithi/Nak/Yoga */}
              {[
                {label:"TITHI",item:TITHIS.find(t=>t.id===panchang.tithi),change:panchang.tC},
                {label:"NAKSHATRA",item:NAKSHATRAS.find(n=>n.id===panchang.nak),change:panchang.nC},
                {label:"YOGA",item:YOGAS.find(y=>y.id===panchang.yoga),change:panchang.yC},
              ].map(row=>(
                <div key={row.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid #0E1E2A"}}>
                  <div>
                    <div style={{fontSize:8,color:"#506070",fontFamily:"Cinzel,serif",letterSpacing:1}}>{row.label}</div>
                    <div style={{fontSize:11,color:"#A0B8C8"}}>{row.item?.name}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    {row.change&&tMin(row.change)>SS?(
                      <div style={{fontSize:8,color:"#C9A84C"}}>⚡ {row.change}</div>
                    ):<div style={{fontSize:8,color:"#405060"}}>No change</div>}
                    <div style={{display:"flex",gap:2,marginTop:2,justifyContent:"flex-end"}}>
                      {[1,2,3].map(n=><div key={n} style={{width:5,height:5,borderRadius:"50%",background:n<=(row.item?.quality||0)?qC(row.item?.quality||0):"#1A2A3A"}}/>)}
                    </div>
                  </div>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #0E1E2A"}}>
                <div><div style={{fontSize:8,color:"#506070",fontFamily:"Cinzel,serif"}}>☊ RAHU KALA</div><div style={{fontSize:11,color:"#E86060"}}>{RAHU_KALA[new Date(selDay).getDay()].start}–{RAHU_KALA[new Date(selDay).getDay()].end}</div></div>
                <div><div style={{fontSize:8,color:"#506070",fontFamily:"Cinzel,serif"}}>☀ ABHIJIT</div><div style={{fontSize:11,color:"#4CAF8A",textAlign:"right"}}>11:48–12:36</div></div>
              </div>
            </div>
          ):(
            <div style={{fontSize:10,color:"#304050"}}>Select a day in May–June 2026 for full Panchang detail.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// TAB 3: INTRADAY
function IntradayTab(){
  const [selDate,setSelDate]=useState("2026-05-02");
  const p=getPanchang(selDate);
  const tithi=p?TITHIS.find(t=>t.id===p.tithi):null;
  const nak=p?NAKSHATRAS.find(n=>n.id===p.nak):null;
  const yoga=p?YOGAS.find(y=>y.id===p.yoga):null;
  const sign=p?SIGNS[p.si]:null;
  const rk=RAHU_KALA[new Date(selDate).getDay()];
  const [barW,setBarW]=useState(500);
  const barRef=useRef(null);
  useEffect(()=>{if(barRef.current)setBarW(barRef.current.offsetWidth-32);},[p]);

  const availDates=PANCHANG.map(x=>x.date);
  const grouped={};
  availDates.forEach(d=>{const m=d.slice(0,7);if(!grouped[m])grouped[m]=[];grouped[m].push(d);});

  return(
    <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:16}}>
      {/* Date picker */}
      <div>
        <div style={{background:"#080E16",border:"1px solid #1A2A3A",borderRadius:8,padding:12,marginBottom:12}}>
          <div style={{fontSize:9,color:"#607080",letterSpacing:2,fontFamily:"Cinzel,serif",marginBottom:10}}>SELECT DAY</div>
          {Object.entries(grouped).map(([month,dates])=>(
            <div key={month} style={{marginBottom:10}}>
              <div style={{fontSize:8,color:"#405060",letterSpacing:2,marginBottom:5,fontFamily:"Cinzel,serif"}}>{new Date(month+"-01").toLocaleDateString("en-IN",{month:"long"}).toUpperCase()}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                {dates.map(d=>{
                  const pg=PANCHANG.find(x=>x.date===d);
                  const q=pg?pg.q:2;
                  const isSel=d===selDate;
                  const day=new Date(d).getDate();
                  const isWk=new Date(d).getDay()===0||new Date(d).getDay()===6;
                  return(
                    <button key={d} onClick={()=>setSelDate(d)} style={{width:26,height:26,borderRadius:4,background:isSel?qC(q):`${qC(q)}20`,border:`1px solid ${isSel?qC(q):qC(q)+"40"}`,color:isSel?"#060C14":qC(q),fontSize:9,cursor:"pointer",fontFamily:"Cinzel,serif",fontWeight:isSel?700:400,opacity:isWk?0.4:1}}>
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
            {[[3,"Fav"],[2,"Neut"],[1,"Caut"],[0,"Avoid"]].map(([q,l])=>(
              <div key={q} style={{display:"flex",alignItems:"center",gap:2}}>
                <div style={{width:7,height:7,borderRadius:2,background:`${qC(q)}40`,border:`1px solid ${qC(q)}`}}/>
                <span style={{fontSize:7,color:"#405060"}}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Planet positions */}
        <div style={{background:"#080E16",border:"1px solid #1A2A3A",borderRadius:8,padding:12}}>
          <div style={{fontSize:9,color:"#607080",letterSpacing:2,fontFamily:"Cinzel,serif",marginBottom:8}}>PLANETS TODAY</div>
          {[
            {pk:"jupiter",sign:"Cancer",note:"Exalted ✦",strong:true},
            {pk:"saturn",sign:"Pisces",note:"Transitioning"},
            {pk:"mars",sign:"Cancer",note:"Debilitated"},
            {pk:"mercury",sign:"Taurus",note:"Direct"},
            {pk:"venus",sign:"Aries",note:"Post-retro"},
            {pk:"rahu",sign:"Pisces",note:"Retro"},
          ].map(pos=>{
            const pl=PLANETS[pos.pk];
            return(
              <div key={pos.pk} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:"1px solid #0E1E2A"}}>
                <PlanetIcon pk={pos.pk} size={18}/>
                <div style={{flex:1}}>
                  <span style={{fontSize:9,color:"#A0B8C8",fontFamily:"Cinzel,serif"}}>{pl.name}</span>
                  <span style={{fontSize:8,color:"#506070",marginLeft:5}}>{pos.sign}</span>
                </div>
                <span style={{fontSize:7,color:pos.strong?"#4CAF8A":"#607080",fontFamily:"Cinzel,serif"}}>{pos.note}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main intraday */}
      <div>
        {p?(
          <div style={{animation:"fadeIn 0.3s ease"}}>
            {/* Session quality header */}
            <div style={{padding:"12px 14px",borderRadius:8,marginBottom:12,background:`${qC(p.q)}12`,border:`1px solid ${qC(p.q)}35`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:42,height:42,borderRadius:"50%",background:`${qC(p.q)}20`,border:`2px solid ${qC(p.q)}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:qC(p.q),boxShadow:`0 0 12px ${qC(p.q)}40`}}>
                    {p.q===3?"✦":p.q===2?"◎":p.q===1?"⚠":"✕"}
                  </div>
                  <div>
                    <div style={{fontSize:16,fontFamily:"Cinzel,serif",fontWeight:700,color:qC(p.q),letterSpacing:2}}>{qL(p.q)}</div>
                    <div style={{fontSize:9,color:"#607080",marginTop:2}}>{selDate} · {p.vaar} · 09:15–15:30 IST</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {sign&&<div style={{padding:"5px 10px",background:`${sign.color}12`,borderRadius:5,border:`1px solid ${sign.color}25`,textAlign:"center"}}>
                    <div style={{fontSize:8,color:"#506070",fontFamily:"Cinzel,serif"}}>MOON IN</div>
                    <div style={{fontSize:12,color:sign.color}}>{sign.symbol} {sign.name}</div>
                  </div>}
                  <div style={{padding:"5px 10px",background:"#E8606012",borderRadius:5,border:"1px solid #E8606025",textAlign:"center"}}>
                    <div style={{fontSize:8,color:"#506070",fontFamily:"Cinzel,serif"}}>RAHU KALA</div>
                    <div style={{fontSize:11,color:"#E86060"}}>{rk.start}–{rk.end}</div>
                  </div>
                  <div style={{padding:"5px 10px",background:"#4CAF8A12",borderRadius:5,border:"1px solid #4CAF8A25",textAlign:"center"}}>
                    <div style={{fontSize:8,color:"#506070",fontFamily:"Cinzel,serif"}}>ABHIJIT</div>
                    <div style={{fontSize:11,color:"#4CAF8A"}}>11:48–12:36</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline bar */}
            <div ref={barRef} style={{background:"#080E16",border:"1px solid #1A2A3A",borderRadius:8,padding:14,marginBottom:12}}>
              <div style={{fontSize:9,color:"#607080",letterSpacing:2,fontFamily:"Cinzel,serif",marginBottom:10}}>SESSION TIMELINE · UJJAIN REF</div>
              <IntradayBar p={p} width={barW}/>
              <div style={{display:"flex",gap:12,marginTop:10,flexWrap:"wrap"}}>
                {[{c:"#E86060",l:"Rahu Kala"},{c:"#4CAF8A",l:"Abhijit Muhurta"},{c:"#C9A84C",l:"Changeover"},{c:"#C06080",l:"Gulika Kala"}].map((it,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:3}}>
                    <div style={{width:10,height:7,background:`${it.c}30`,border:`1px solid ${it.c}70`,borderRadius:1}}/>
                    <span style={{fontSize:7,color:"#405060",fontFamily:"Cinzel,serif"}}>{it.l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* TNY cards */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
              {[
                {label:"TITHI",item:tithi,change:p.tC,extra:tithi?.paksha+" Paksha · "+tithi?.type},
                {label:"NAKSHATRA",item:nak,change:p.nC,extra:nak?`${PLANETS[nak.lord]?.symbol} ${PLANETS[nak.lord]?.name} lord`:""},
                {label:"YOGA",item:yoga,change:p.yC,extra:""},
              ].map(row=>{
                const q=row.item?.quality||0;
                const hasChange=row.change&&tMin(row.change)>SS&&tMin(row.change)<SE;
                return(
                  <div key={row.label} style={{background:`${qC(q)}10`,border:`1px solid ${qC(q)}25`,borderRadius:7,padding:12}}>
                    <div style={{fontSize:8,color:"#506070",letterSpacing:2,fontFamily:"Cinzel,serif",marginBottom:6}}>{row.label}</div>
                    <div style={{fontSize:13,fontFamily:"Cinzel,serif",color:"#C8D8E8",marginBottom:4}}>{row.item?.name}</div>
                    {row.extra&&<div style={{fontSize:9,color:"#607888",marginBottom:6}}>{row.extra}</div>}
                    <div style={{display:"flex",gap:2,marginBottom:6}}>
                      {[1,2,3].map(n=><div key={n} style={{width:7,height:7,borderRadius:"50%",background:n<=q?qC(q):"#1A2A3A",boxShadow:n<=q?`0 0 3px ${qC(q)}`:"none"}}/>)}
                    </div>
                    {hasChange?(
                      <div style={{padding:"4px 6px",borderRadius:4,background:"#C9A84C12",border:"1px solid #C9A84C35"}}>
                        <div style={{fontSize:8,color:"#C9A84C",fontFamily:"Cinzel,serif"}}>⚡ CHANGES AT {row.change}</div>
                        <div style={{fontSize:7,color:"#806030",marginTop:1}}>Reassess at this time</div>
                      </div>
                    ):(
                      <div style={{fontSize:8,color:"#405060"}}>No change in session</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Trading guidance */}
            <div style={{background:"#080E16",border:"1px solid #1A2A3A",borderRadius:8,padding:14}}>
              <div style={{fontSize:9,color:"#607080",letterSpacing:2,fontFamily:"Cinzel,serif",marginBottom:10}}>TRADING GUIDANCE</div>
              {[
                {icon:p.q===3?"✦":p.q===2?"◎":p.q===1?"⚠":"✕",color:qC(p.q),timing:"All session",text:p.q===3?"Favorable — momentum entries valid. Trust breakouts.":p.q===2?"Neutral — quality setups only. Reduce position size.":p.q===1?"Caution — exits over entries. Strongest setups only.":"AVOID — sit out entirely. No new positions."},
                {icon:"☊",color:"#E86060",timing:`${rk.start}–${rk.end}`,text:"Rahu Kala: Absolute no-entry window. Stand aside."},
                {icon:"☀",color:"#4CAF8A",timing:"11:48–12:36",text:"Abhijit Muhurta: Universally auspicious. Best window for high-conviction entries."},
                ...(p.tC&&tMin(p.tC)>SS?[{icon:"⚡",color:"#C9A84C",timing:p.tC,text:`Tithi changes at ${p.tC} — re-assess all open positions.`}]:[]),
                ...(p.nC&&tMin(p.nC)>SS?[{icon:"⚡",color:"#C9A84C",timing:p.nC,text:`Nakshatra changes at ${p.nC} — quality shift mid-session.`}]:[]),
                ...(p.yC&&tMin(p.yC)>SS?[{icon:"⚡",color:"#C9A84C",timing:p.yC,text:`Yoga changes at ${p.yC} — Tighten stops 5 min before.`}]:[]),
              ].map((g,i)=>(
                <div key={i} style={{display:"flex",gap:8,padding:"7px 9px",borderRadius:5,marginBottom:5,background:`${g.color}08`,border:`1px solid ${g.color}18`}}>
                  <span style={{fontSize:14,color:g.color,flexShrink:0,lineHeight:1.3}}>{g.icon}</span>
                  <div>
                    <div style={{fontSize:8,color:g.color,fontFamily:"Cinzel,serif",letterSpacing:1,marginBottom:2}}>{g.timing}</div>
                    <div style={{fontSize:10,color:"#90A0B0",lineHeight:1.6}}>{g.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ):(
          <div style={{background:"#080E16",border:"1px solid #1A2A3A",borderRadius:8,padding:40,textAlign:"center"}}>
            <div style={{fontSize:28,color:"#1A2A3A",marginBottom:12}}>☽</div>
            <div style={{fontSize:11,color:"#304050",fontFamily:"Cinzel,serif"}}>Select a day to view intraday Panchang</div>
          </div>
        )}
      </div>
    </div>
  );
}

// TAB 4: PLANETS
function PlanetsTab(){
  const positions=[
    {pk:"jupiter",sign:"Cancer",status:"Direct",strength:3,note:"Exalted — strongest placement. Broad bull bias."},
    {pk:"saturn",sign:"Pisces→Aries",status:"Direct",strength:2,note:"Transitioning — structural stress building."},
    {pk:"mars",sign:"Cancer",status:"Direct",strength:1,note:"Debilitated — energy sector weak, defensive rotation."},
    {pk:"mercury",sign:"Taurus",status:"Direct",strength:3,note:"Clear flow — execution valid, IT entries permitted."},
    {pk:"venus",sign:"Aries",status:"Direct",strength:2,note:"Post-retrograde recovery — valuations stabilizing."},
    {pk:"rahu",sign:"Pisces",status:"Retrograde",strength:2,note:"Pharma/oil speculative attention continues."},
    {pk:"ketu",sign:"Virgo",status:"Retrograde",strength:2,note:"Healthcare services — deep value accumulation zone."},
    {pk:"sun",sign:"Taurus",status:"Direct",strength:2,note:"Activating banking, luxury, gold themes."},
    {pk:"moon",sign:"Pisces",status:"Waning",strength:2,note:"Waning — distribution phase, caution."},
    {pk:"herschel",sign:"Taurus",status:"Direct",strength:2,note:"Final year in Taurus — fintech disruption wrap-up."},
    {pk:"pluto",sign:"Aquarius",status:"Direct",strength:3,note:"Tech democratization — 20-year structural bull."},
  ];

  const tiers=[
    {tier:"GENERATIONAL",sub:"Decade+",pks:["pluto","herschel"]},
    {tier:"STRUCTURAL",sub:"Years",pks:["saturn","rahu","ketu"]},
    {tier:"TREND",sub:"Months",pks:["jupiter","venus"]},
    {tier:"TACTICAL",sub:"Weeks",pks:["mars","sun"]},
    {tier:"SENTIMENT",sub:"Days",pks:["mercury","moon"]},
  ];

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12,marginBottom:20}}>
        {positions.map(pos=>{
          const p=PLANETS[pos.pk];
          const sc=pos.strength===3?"#4CAF8A":pos.strength===2?"#C9A84C":"#E86060";
          const sl=pos.strength===3?"Strong":pos.strength===2?"Neutral":"Weak";
          return(
            <div key={pos.pk} style={{background:"#080E16",border:`1px solid ${p.color}25`,borderRadius:8,padding:14,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-20,right:-20,width:70,height:70,borderRadius:"50%",background:p.glow,filter:"blur(18px)",pointerEvents:"none"}}/>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <PlanetIcon pk={pos.pk} size={38}/>
                <div>
                  <div style={{fontSize:13,fontFamily:"Cinzel,serif",color:p.color,letterSpacing:2}}>{p.name.toUpperCase()}</div>
                  <div style={{fontSize:10,color:"#A0B8C8",marginTop:2}}>{pos.sign}</div>
                </div>
                <div style={{marginLeft:"auto"}}>
                  <div style={{fontSize:9,padding:"2px 7px",borderRadius:3,background:pos.status==="Direct"?"#4CAF8A18":"#E8606018",color:pos.status==="Direct"?"#4CAF8A":"#E86060",fontFamily:"Cinzel,serif"}}>{pos.status}</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <div style={{fontSize:9,color:"#506070",letterSpacing:1}}>STRENGTH</div>
                <div style={{flex:1,height:2,background:"#1A2A3A",borderRadius:1}}>
                  <div style={{width:`${(pos.strength/3)*100}%`,height:"100%",background:sc,borderRadius:1}}/>
                </div>
                <div style={{fontSize:9,color:sc,fontFamily:"Cinzel,serif"}}>{sl}</div>
              </div>
              <div style={{fontSize:10,color:"#708898",lineHeight:1.6}}>{pos.note}</div>
            </div>
          );
        })}
      </div>

      {/* Hierarchy */}
      <div style={{background:"#080E16",border:"1px solid #1A2A3A",borderRadius:8,padding:16}}>
        <div style={{fontSize:9,color:"#607080",letterSpacing:2,fontFamily:"Cinzel,serif",marginBottom:14}}>PLANET HIERARCHY — TIMEFRAME LENS</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
          {tiers.map(tier=>(
            <div key={tier.tier} style={{background:"#0A1520",borderRadius:6,padding:"10px 8px",border:"1px solid #1A2A3A",textAlign:"center"}}>
              <div style={{fontSize:7,color:"#506070",letterSpacing:2,marginBottom:8,fontFamily:"Cinzel,serif"}}>{tier.tier}</div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,marginBottom:8}}>
                {tier.pks.map(pk=>(
                  <div key={pk} style={{display:"flex",alignItems:"center",gap:5}}>
                    <PlanetIcon pk={pk} size={24}/>
                    <span style={{fontSize:9,color:PLANETS[pk].color,fontFamily:"Cinzel,serif"}}>{PLANETS[pk].name}</span>
                  </div>
                ))}
              </div>
              <div style={{fontSize:8,color:"#405060",letterSpacing:1}}>{tier.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════
export default function FinastroDashboard(){
  const [tab,setTab]=useState("cockpit");
  const [selDay,setSelDay]=useState("2026-05-02");

  const css=`
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    ::-webkit-scrollbar{width:4px;height:4px;}
    ::-webkit-scrollbar-track{background:#060C14;}
    ::-webkit-scrollbar-thumb{background:#1E3A4A;border-radius:2px;}
    @keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
    @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}
    @keyframes twinkle{from{opacity:0.05;}to{opacity:0.5;}}
    .tab-btn:hover{background:#1A2E3A!important;}
  `;

  const today=getPanchang("2026-05-02");
  const todaySign=today?SIGNS[today.si]:null;

  return(
    <div style={{background:"#060C14",minHeight:"100vh",fontFamily:"'Crimson Text',Georgia,serif",color:"#C8D8E8",position:"relative",overflow:"hidden"}}>
      <style>{css}</style>

      {/* Star field */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
        {Array.from({length:100},(_,i)=>(
          <div key={i} style={{position:"absolute",left:`${(i*7.3)%100}%`,top:`${(i*11.7)%100}%`,width:(i%3)+0.5,height:(i%3)+0.5,borderRadius:"50%",background:"#fff",opacity:0.05+((i%5)*0.06),animation:`twinkle ${2+(i%5)}s ease-in-out infinite alternate`,animationDelay:`${(i%6)*0.7}s`}}/>
        ))}
      </div>

      {/* Nebula */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,background:"radial-gradient(ellipse at 15% 20%,#1A3A5A14 0%,transparent 55%),radial-gradient(ellipse at 85% 80%,#3A1A4A14 0%,transparent 55%)"}}/>

      <div style={{position:"relative",zIndex:1,maxWidth:1400,margin:"0 auto",padding:"0 16px 48px"}}>

        {/* ── HEADER ── */}
        <div style={{padding:"20px 0 14px",borderBottom:"1px solid #1A2A3A",marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{fontSize:28,filter:"drop-shadow(0 0 12px #C9A84C)"}}>✦</div>
            <div>
              <div style={{fontSize:22,fontFamily:"Cinzel,serif",fontWeight:900,color:"#C9A84C",letterSpacing:4,lineHeight:1}}>FINASTRO</div>
              <div style={{fontSize:9,color:"#506070",letterSpacing:3,marginTop:3}}>PLANETARY MARKET INTELLIGENCE · 2026</div>
            </div>
          </div>

          {/* Status bar */}
          <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:"#506070",letterSpacing:1,fontFamily:"Cinzel,serif"}}>DATE</div>
              <div style={{fontSize:12,color:"#A8C8E8",fontFamily:"Cinzel,serif"}}>02 MAY 2026</div>
            </div>
            <div style={{width:1,height:30,background:"#1A2A3A"}}/>
            {today&&<div style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:"#506070",letterSpacing:1,fontFamily:"Cinzel,serif"}}>TODAY</div>
              <div style={{fontSize:12,color:qC(today.q),fontFamily:"Cinzel,serif"}}>{moonIcon(getMoonAngle("2026-05-02"))} {qL(today.q)}</div>
            </div>}
            <div style={{width:1,height:30,background:"#1A2A3A"}}/>
            {todaySign&&<div style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:"#506070",letterSpacing:1,fontFamily:"Cinzel,serif"}}>MOON</div>
              <div style={{fontSize:12,color:todaySign.color,fontFamily:"Cinzel,serif"}}>{todaySign.symbol} {todaySign.name}</div>
            </div>}
            <div style={{width:1,height:30,background:"#1A2A3A"}}/>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:"#506070",letterSpacing:1,fontFamily:"Cinzel,serif"}}>NIFTY BACKDROP</div>
              <div style={{fontSize:12,color:"#4CAF8A",fontFamily:"Cinzel,serif"}}>♃ BULL BIAS</div>
            </div>
            <div style={{width:1,height:30,background:"#1A2A3A"}}/>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:"#506070",letterSpacing:1,fontFamily:"Cinzel,serif"}}>UJJAIN REF</div>
              <div style={{fontSize:10,color:"#607888",fontFamily:"Cinzel,serif"}}>23°10'N 75°46'E</div>
            </div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{display:"flex",gap:4,marginBottom:20}}>
          {[["cockpit","⊕ COCKPIT"],["timeline","◌ TIMELINE"],["intraday","☽ INTRADAY"],["planets","✦ PLANETS"]].map(([key,label])=>(
            <button key={key} className="tab-btn" onClick={()=>setTab(key)} style={{padding:"8px 18px",background:tab===key?"#0E1E2E":"transparent",border:`1px solid ${tab===key?"#C9A84C40":"#1A2A3A"}`,borderRadius:5,color:tab===key?"#C9A84C":"#607080",fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:2,cursor:"pointer",transition:"all 0.2s"}}>
              {label}
            </button>
          ))}
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>
            {[["A","#C9A84C"],["B","#60A8C0"],["C","#708090"]].map(([g,c])=>(
              <span key={g} style={{fontSize:8,padding:"3px 7px",borderRadius:3,background:`${c}12`,color:c,fontFamily:"Cinzel,serif",border:`1px solid ${c}35`}}>GRADE {g}</span>
            ))}
          </div>
        </div>

        {/* ── TAB CONTENT ── */}
        <div style={{animation:"fadeIn 0.35s ease"}}>
          {tab==="cockpit"&&<CockpitTab selDay={selDay} setSelDay={setSelDay}/>}
          {tab==="timeline"&&<TimelineTab/>}
          {tab==="intraday"&&<IntradayTab/>}
          {tab==="planets"&&<PlanetsTab/>}
        </div>

        {/* ── FOOTER ── */}
        <div style={{marginTop:32,paddingTop:14,borderTop:"1px solid #1A2A3A",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div style={{fontSize:8,color:"#304050",fontFamily:"Cinzel,serif",letterSpacing:2}}>FINASTRO · VIKUNA TECHNOLOGIES · HYDERABAD</div>
          <div style={{fontSize:8,color:"#304050",fontFamily:"Cinzel,serif",letterSpacing:1}}>UJJAIN 23°10'N 75°46'E · LAHIRI AYANAMSA · SIDEREAL · IST · NOT FINANCIAL ADVICE</div>
        </div>
      </div>
    </div>
  );
}
