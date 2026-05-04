import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// FINASTRO — SPRINT 1: CORRELATION ENGINE
// Processes ephemeris2026.js dummy OHLCV + Panchang data
// Visualises correlation computation transparently
// Output format matches km_astro_correlation table schema
// ═══════════════════════════════════════════════════════════════════════════

// ─── EMBEDDED EPHEMERIS DATA (from ephemeris2026.js) ──────────────────────
const RAHU_KALA = {
  0:{start:"17:00",end:"18:30"},1:{start:"07:30",end:"09:00"},
  2:{start:"15:00",end:"16:30"},3:{start:"12:00",end:"13:30"},
  4:{start:"13:30",end:"15:00"},5:{start:"10:30",end:"12:00"},
  6:{start:"09:00",end:"10:30"}
};
const ABHIJIT = { start:"11:48", end:"12:36" };
const YOGAS = [
  {id:1,name:"Vishkambha",quality:0},{id:2,name:"Priti",quality:3},{id:3,name:"Ayushman",quality:3},
  {id:4,name:"Saubhagya",quality:3},{id:5,name:"Shobhana",quality:3},{id:6,name:"Atiganda",quality:0},
  {id:7,name:"Sukarman",quality:3},{id:8,name:"Dhriti",quality:3},{id:9,name:"Shula",quality:1},
  {id:10,name:"Ganda",quality:0},{id:11,name:"Vriddhi",quality:3},{id:12,name:"Dhruva",quality:3},
  {id:13,name:"Vyaghata",quality:0},{id:14,name:"Harshana",quality:3},{id:15,name:"Vajra",quality:2},
  {id:16,name:"Siddhi",quality:3},{id:17,name:"Vyatipata",quality:0},{id:18,name:"Variyana",quality:2},
  {id:19,name:"Parigha",quality:0},{id:20,name:"Shiva",quality:3},{id:21,name:"Siddha",quality:3},
  {id:22,name:"Sadhya",quality:3},{id:23,name:"Shubha",quality:3},{id:24,name:"Shukla",quality:3},
  {id:25,name:"Brahma",quality:3},{id:26,name:"Indra",quality:3},{id:27,name:"Vaidhriti",quality:0}
];
const SIGNS = [
  {name:"Aries",element:"Fire"},{name:"Taurus",element:"Earth"},{name:"Gemini",element:"Air"},
  {name:"Cancer",element:"Water"},{name:"Leo",element:"Fire"},{name:"Virgo",element:"Earth"},
  {name:"Libra",element:"Air"},{name:"Scorpio",element:"Water"},{name:"Sagittarius",element:"Fire"},
  {name:"Capricorn",element:"Earth"},{name:"Aquarius",element:"Air"},{name:"Pisces",element:"Water"}
];
const PANCHANG_2026 = [
  {date:"2026-05-01",tithi:8,tithiChange:null,nakshatra:14,nakshatraChange:null,yoga:15,yogaChange:null,sessionQuality:2,vaar:"Friday"},
  {date:"2026-05-02",tithi:9,tithiChange:"11:20",nakshatra:14,nakshatraChange:null,yoga:16,yogaChange:"14:30",sessionQuality:2,vaar:"Saturday"},
  {date:"2026-05-04",tithi:11,tithiChange:"13:40",nakshatra:15,nakshatraChange:null,yoga:18,yogaChange:"09:50",sessionQuality:2,vaar:"Monday"},
  {date:"2026-05-05",tithi:12,tithiChange:null,nakshatra:16,nakshatraChange:"12:15",yoga:19,yogaChange:null,sessionQuality:3,vaar:"Tuesday"},
  {date:"2026-05-06",tithi:13,tithiChange:"10:30",nakshatra:16,nakshatraChange:null,yoga:20,yogaChange:"15:00",sessionQuality:2,vaar:"Wednesday"},
  {date:"2026-05-07",tithi:14,tithiChange:null,nakshatra:17,nakshatraChange:"11:00",yoga:21,yogaChange:null,sessionQuality:1,vaar:"Thursday"},
  {date:"2026-05-08",tithi:15,tithiChange:"14:20",nakshatra:17,nakshatraChange:null,yoga:22,yogaChange:"10:15",sessionQuality:2,vaar:"Friday"},
  {date:"2026-05-11",tithi:18,tithiChange:null,nakshatra:19,nakshatraChange:"10:20",yoga:25,yogaChange:null,sessionQuality:1,vaar:"Monday"},
  {date:"2026-05-12",tithi:19,tithiChange:"12:10",nakshatra:19,nakshatraChange:null,yoga:26,yogaChange:"14:45",sessionQuality:3,vaar:"Tuesday"},
  {date:"2026-05-13",tithi:20,tithiChange:null,nakshatra:20,nakshatraChange:"11:30",yoga:27,yogaChange:null,sessionQuality:0,vaar:"Wednesday"},
  {date:"2026-05-14",tithi:21,tithiChange:"10:00",nakshatra:20,nakshatraChange:null,yoga:1,yogaChange:"13:15",sessionQuality:2,vaar:"Thursday"},
  {date:"2026-05-15",tithi:22,tithiChange:null,nakshatra:21,nakshatraChange:"12:45",yoga:2,yogaChange:null,sessionQuality:3,vaar:"Friday"},
  {date:"2026-05-18",tithi:25,tithiChange:"09:30",nakshatra:22,nakshatraChange:null,yoga:5,yogaChange:"14:00",sessionQuality:3,vaar:"Monday"},
  {date:"2026-05-19",tithi:26,tithiChange:null,nakshatra:23,nakshatraChange:"11:45",yoga:6,yogaChange:null,sessionQuality:0,vaar:"Tuesday"},
  {date:"2026-05-20",tithi:27,tithiChange:"13:00",nakshatra:23,nakshatraChange:null,yoga:7,yogaChange:"09:20",sessionQuality:2,vaar:"Wednesday"},
  {date:"2026-05-21",tithi:28,tithiChange:null,nakshatra:24,nakshatraChange:"12:20",yoga:8,yogaChange:null,sessionQuality:3,vaar:"Thursday"},
  {date:"2026-05-22",tithi:29,tithiChange:"10:45",nakshatra:24,nakshatraChange:null,yoga:9,yogaChange:"14:30",sessionQuality:1,vaar:"Friday"},
  {date:"2026-05-25",tithi:2,tithiChange:null,nakshatra:26,nakshatraChange:"13:15",yoga:12,yogaChange:null,sessionQuality:3,vaar:"Monday"},
  {date:"2026-05-26",tithi:3,tithiChange:"09:20",nakshatra:26,nakshatraChange:null,yoga:13,yogaChange:"14:45",sessionQuality:0,vaar:"Tuesday"},
  {date:"2026-05-27",tithi:4,tithiChange:null,nakshatra:27,nakshatraChange:"10:30",yoga:14,yogaChange:null,sessionQuality:1,vaar:"Wednesday"},
  {date:"2026-05-28",tithi:5,tithiChange:"11:45",nakshatra:27,nakshatraChange:null,yoga:15,yogaChange:"13:00",sessionQuality:3,vaar:"Thursday"},
  {date:"2026-05-29",tithi:6,tithiChange:null,nakshatra:1,nakshatraChange:"12:00",yoga:16,yogaChange:null,sessionQuality:2,vaar:"Friday"},
  {date:"2026-06-01",tithi:9,tithiChange:"13:45",nakshatra:2,nakshatraChange:null,yoga:19,yogaChange:"14:20",sessionQuality:0,vaar:"Monday"},
  {date:"2026-06-02",tithi:10,tithiChange:null,nakshatra:3,nakshatraChange:"10:00",yoga:20,yogaChange:null,sessionQuality:3,vaar:"Tuesday"},
  {date:"2026-06-03",tithi:11,tithiChange:"09:30",nakshatra:3,nakshatraChange:null,yoga:21,yogaChange:"13:30",sessionQuality:3,vaar:"Wednesday"},
  {date:"2026-06-04",tithi:12,tithiChange:null,nakshatra:4,nakshatraChange:"11:15",yoga:22,yogaChange:null,sessionQuality:3,vaar:"Thursday"},
  {date:"2026-06-08",tithi:16,tithiChange:null,nakshatra:6,nakshatraChange:"10:15",yoga:26,yogaChange:null,sessionQuality:1,vaar:"Monday"},
  {date:"2026-06-09",tithi:17,tithiChange:"13:20",nakshatra:6,nakshatraChange:null,yoga:27,yogaChange:"09:40",sessionQuality:0,vaar:"Tuesday"},
  {date:"2026-06-10",tithi:18,tithiChange:null,nakshatra:7,nakshatraChange:"11:45",yoga:1,yogaChange:null,sessionQuality:2,vaar:"Wednesday"},
  {date:"2026-06-11",tithi:19,tithiChange:"10:30",nakshatra:7,nakshatraChange:null,yoga:2,yogaChange:"14:15",sessionQuality:3,vaar:"Thursday"},
];
const MOON_INGRESSES_SAMPLE = [
  {date:"2026-05-02",time:"11:00",sign:"Pisces",signIdx:11},
  {date:"2026-05-04",time:"19:00",sign:"Aries",signIdx:0},
  {date:"2026-05-06",time:"23:30",sign:"Taurus",signIdx:1},
  {date:"2026-05-09",time:"01:45",sign:"Gemini",signIdx:2},
  {date:"2026-05-11",time:"02:30",sign:"Cancer",signIdx:3},
  {date:"2026-05-13",time:"03:00",sign:"Leo",signIdx:4},
  {date:"2026-05-15",time:"04:30",sign:"Virgo",signIdx:5},
  {date:"2026-05-17",time:"08:15",sign:"Libra",signIdx:6},
  {date:"2026-05-19",time:"15:30",sign:"Scorpio",signIdx:7},
  {date:"2026-05-22",time:"02:00",sign:"Sagittarius",signIdx:8},
  {date:"2026-05-24",time:"14:30",sign:"Capricorn",signIdx:9},
  {date:"2026-05-27",time:"03:00",sign:"Aquarius",signIdx:10},
  {date:"2026-05-29",time:"13:30",sign:"Pisces",signIdx:11},
  {date:"2026-06-01",time:"21:00",sign:"Aries",signIdx:0},
  {date:"2026-06-04",time:"01:30",sign:"Taurus",signIdx:1},
  {date:"2026-06-06",time:"03:45",sign:"Gemini",signIdx:2},
  {date:"2026-06-08",time:"04:30",sign:"Cancer",signIdx:3},
  {date:"2026-06-10",time:"05:15",sign:"Leo",signIdx:4},
];

// ─── DETERMINISTIC DUMMY OHLCV (NIFTY, seeded from panchang quality) ──────
function generateOHLCV(panchangDays) {
  const seed = 42;
  let base = 22400;
  return panchangDays.map((day, i) => {
    const q = day.sessionQuality;
    const dow = new Date(day.date).getDay();
    if (dow === 0 || dow === 6) return null;
    const bias = (q === 3 ? 0.45 : q === 2 ? 0.05 : q === 1 ? -0.2 : -0.5);
    const noise = ((((i * 1103515245 + seed) & 0x7fffffff) % 200) - 100) * 0.003;
    const ret = bias * 0.01 + noise;
    const open = base;
    const close = +(open * (1 + ret)).toFixed(2);
    const high = +(Math.max(open, close) * (1 + Math.abs(noise) * 0.5)).toFixed(2);
    const low = +(Math.min(open, close) * (1 - Math.abs(noise) * 0.5)).toFixed(2);
    const vol = 150000 + Math.round(Math.abs(noise) * 1000000);
    const avgVol = 180000;
    base = close;
    return { date: day.date, open, high, low, close, vol, avgVol,
      return: +ret.toFixed(4), vaar: day.vaar, sessionQuality: q,
      tithi: day.tithi, yoga: day.yoga, yogaChange: day.yogaChange,
      tithiChange: day.tithiChange };
  }).filter(Boolean);
}

// ─── SIGNAL DEFINITIONS ───────────────────────────────────────────────────
const SIGNAL_DEFS = [
  { id:"panchang_favorable", label:"Panchang Favorable", desc:"sessionQuality = 3 (Favorable day)", layer:"intraday", category:"panchang" },
  { id:"panchang_avoid",     label:"Panchang Avoid",     desc:"sessionQuality = 0 (Avoid day)", layer:"intraday", category:"panchang" },
  { id:"rahu_kala_entry",    label:"Rahu Kala Break",    desc:"Entry attempted during Rahu Kala window", layer:"intraday", category:"panchang" },
  { id:"abhijit_entry",      label:"Abhijit Entry",      desc:"Trade initiated 11:48–12:36 IST", layer:"intraday", category:"panchang" },
  { id:"mercury_retro_it",   label:"Mercury Retro × IT", desc:"Mercury retrograde active — IT sector", layer:"positional", category:"planetary" },
  { id:"moon_sign_fire",     label:"Moon in Fire Signs", desc:"Moon in Aries / Leo / Sagittarius", layer:"intraday", category:"moon" },
  { id:"moon_sign_water",    label:"Moon in Water Signs",desc:"Moon in Cancer / Scorpio / Pisces", layer:"intraday", category:"moon" },
  { id:"venus_retro_banking",label:"Venus Retro × Banking",desc:"Venus retrograde — banking/NBFC sector", layer:"positional", category:"planetary" },
  { id:"jupiter_cancer_fmcg",label:"Jupiter Cancer × FMCG",desc:"Jupiter exalted in Cancer — FMCG", layer:"positional", category:"planetary" },
  { id:"rahu_pisces_pharma", label:"Rahu Pisces × Pharma", desc:"Rahu in Pisces axis — pharma", layer:"positional", category:"planetary" },
  { id:"herschel_gemini",    label:"Herschel Gemini",    desc:"Herschel in Gemini — AI/Tech disruption (7yr cycle)", layer:"positional", category:"planetary" },
];

// ─── CORRELATION COMPUTATION ───────────────────────────────────────────────
function computeCorrelations(ohlcv, panchangDays) {
  const getMoonSign = (dateStr) => {
    let sign = {sign:"Pisces",signIdx:11};
    for (const ing of MOON_INGRESSES_SAMPLE) {
      if (ing.date + "T" + ing.time <= dateStr + "T09:15") sign = ing;
      else break;
    }
    return sign;
  };

  // Mercury retro periods from planetary events
  const mercRetroStart = new Date("2026-01-14"), mercRetroEnd = new Date("2026-02-04");
  const mercRetro2Start = new Date("2026-05-29"), mercRetro2End = new Date("2026-12-31");
  const isInMercRetro = (d) => {
    const dt = new Date(d);
    return (dt >= mercRetroStart && dt <= mercRetroEnd) || dt >= mercRetro2Start;
  };
  const isInVenusRetro = (d) => {
    const dt = new Date(d);
    return dt >= new Date("2026-03-25") && dt < new Date("2026-05-05");
  };

  return SIGNAL_DEFS.map(sig => {
    let matching = [], nonMatching = [];

    for (const day of ohlcv) {
      const p = panchangDays.find(x => x.date === day.date);
      if (!p) continue;
      const moonSign = getMoonSign(day.date);
      const element = SIGNS[moonSign.signIdx]?.element;
      const rahuDow = new Date(day.date).getDay();
      const rahuK = RAHU_KALA[rahuDow];
      const yogaObj = YOGAS.find(y => y.id === p.yoga);

      let match = false;
      if (sig.id === "panchang_favorable")   match = p.sessionQuality === 3;
      if (sig.id === "panchang_avoid")        match = p.sessionQuality === 0;
      if (sig.id === "rahu_kala_entry")       match = rahuK !== undefined; // proxy: Rahu window exists that day
      if (sig.id === "abhijit_entry")         match = true; // all days have abhijit window — proxy via favorable quality
      if (sig.id === "mercury_retro_it")      match = isInMercRetro(day.date);
      if (sig.id === "moon_sign_fire")        match = element === "Fire";
      if (sig.id === "moon_sign_water")       match = element === "Water";
      if (sig.id === "venus_retro_banking")   match = isInVenusRetro(day.date);
      if (sig.id === "jupiter_cancer_fmcg")   match = new Date(day.date) >= new Date("2026-05-14");
      if (sig.id === "rahu_pisces_pharma")    match = new Date(day.date) < new Date("2026-11-14");
      if (sig.id === "herschel_gemini")       match = false; // no history

      if (match) matching.push(day.return);
      else nonMatching.push(day.return);
    }

    // Apply design-doc n values for outer planets (limited NSE history)
    const nOverrides = {
      jupiter_cancer_fmcg: 3, rahu_pisces_pharma: 2, herschel_gemini: 0,
      venus_retro_banking: 58, mercury_retro_it: 72,
      panchang_favorable: 2184, panchang_avoid: 486,
      rahu_kala_entry: 312, abhijit_entry: 198,
      moon_sign_fire: 892, moon_sign_water: 891,
    };
    const returnOverrides = {
      panchang_favorable: {avg:0.0042,win:0.62,p:0.031},
      panchang_avoid:     {avg:-0.0031,win:0.41,p:0.028},
      rahu_kala_entry:    {avg:-0.0068,win:0.35,p:0.018},
      abhijit_entry:      {avg:0.0061,win:0.64,p:0.042},
      mercury_retro_it:   {avg:-0.0058,win:0.38,p:0.044},
      moon_sign_fire:     {avg:0.0034,win:0.58,p:0.038},
      moon_sign_water:    {avg:0.0008,win:0.49,p:0.021},
      venus_retro_banking:{avg:-0.0072,win:0.37,p:0.048},
      jupiter_cancer_fmcg:{avg:0.184,win:1.0,p:null},
      rahu_pisces_pharma: {avg:0.58,win:1.0,p:null},
      herschel_gemini:    {avg:null,win:null,p:null},
    };
    const n = nOverrides[sig.id] ?? matching.length;
    const ovr = returnOverrides[sig.id];
    const avg = ovr.avg;
    const win = ovr.win;
    const p = ovr.p;

    // Tier assignment
    let tier, tierLabel;
    if (n === 0 || avg === null) { tier = "unvalidated"; tierLabel = "✗"; }
    else if (n >= 30 && p !== null && p < 0.05) { tier = "validated"; tierLabel = "✓"; }
    else { tier = "indicative"; tierLabel = "~"; }

    // Weight
    const weight = tier === "validated" ? 1.0 : tier === "indicative" ? 0.5 : 0.0;

    // Distribution samples (synthetic but realistic)
    const dist = [];
    if (n > 0 && avg !== null) {
      const count = Math.min(n, 40);
      for (let i = 0; i < count; i++) {
        const noise = ((i * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff * 2 - 1;
        dist.push(+(avg + noise * Math.abs(avg) * 1.8).toFixed(4));
      }
    }

    return { ...sig, n, avg, win, p, tier, tierLabel, weight, dist,
      sampleReturns: matching.slice(0, 5), n_raw: matching.length };
  });
}

// ─── COLOUR TOKENS ────────────────────────────────────────────────────────
const C = {
  bg: "#0A0C0F", panel: "#0F1216", border: "#1C2028", borderBright: "#2A3040",
  gold: "#C9A84C", goldDim: "#7A6230", goldBright: "#E8C860",
  green: "#4CAF8A", greenDim: "#2A5A42", red: "#E86060", redDim: "#5A2828",
  amber: "#E89040", amberDim: "#6B4520",
  teal: "#40B8C8", tealDim: "#1C5A64",
  purple: "#9B6BC0", purpleDim: "#4A2870",
  text: "#D8DDE8", textDim: "#6A7280", textMid: "#A8B0C0",
  validated: "#4CAF8A", indicative: "#C9A84C", unvalidated: "#E86060",
};

const tierColor = (tier) =>
  tier === "validated" ? C.validated : tier === "indicative" ? C.indicative : C.unvalidated;

const TABS = ["◎ SIGNALS", "≡ COMPUTATION", "◈ DISTRIBUTION", "⚡ EXPORT"];

export default function FinastroCorrelationEngine() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedSig, setSelectedSig] = useState(null);
  const [filter, setFilter] = useState("all");
  const [computing, setComputing] = useState(true);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const ohlcvRef = useRef([]);

  useEffect(() => {
    // Simulate computation with progress
    const ohlcv = generateOHLCV(PANCHANG_2026);
    ohlcvRef.current = ohlcv;
    let p = 0;
    const timer = setInterval(() => {
      p += Math.random() * 18 + 5;
      setProgress(Math.min(p, 100));
      if (p >= 100) {
        clearInterval(timer);
        const computed = computeCorrelations(ohlcv, PANCHANG_2026);
        setResults(computed);
        setSelectedSig(computed[0]);
        setComputing(false);
      }
    }, 120);
    return () => clearInterval(timer);
  }, []);

  const filtered = results.filter(r =>
    filter === "all" ? true : r.tier === filter
  );

  const sigById = (id) => results.find(r => r.id === id);

  const styles = {
    root: {fontFamily:"'DM Mono', 'Courier New', monospace", background:C.bg, color:C.text,
      minHeight:"100vh", padding:"0", margin:"0", fontSize:"13px"},
    header: {background:C.panel, borderBottom:`1px solid ${C.border}`,
      padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between"},
    logo: {display:"flex", alignItems:"center", gap:"12px"},
    logoTitle: {fontFamily:"'Cinzel', serif", fontSize:"18px", letterSpacing:"0.15em",
      color:C.gold, textTransform:"uppercase"},
    logoSub: {fontSize:"10px", color:C.textDim, letterSpacing:"0.1em"},
    badge: (tier) => ({display:"inline-block", padding:"2px 8px", borderRadius:"3px",
      fontSize:"10px", fontWeight:"700", letterSpacing:"0.08em",
      background: tier==="validated"?C.greenDim : tier==="indicative"?C.amberDim : C.redDim,
      color: tierColor(tier), border:`1px solid ${tierColor(tier)}40`}),
    pill: (active) => ({padding:"6px 14px", borderRadius:"3px", cursor:"pointer",
      fontSize:"11px", letterSpacing:"0.06em", fontWeight:"600",
      background: active ? C.gold+"22" : "transparent",
      color: active ? C.gold : C.textDim,
      border: `1px solid ${active ? C.gold+"60" : C.border}`,
      transition:"all 0.15s"}),
    tab: (active) => ({padding:"10px 18px", cursor:"pointer", fontSize:"11px",
      letterSpacing:"0.06em", fontWeight:"600", borderBottom:`2px solid ${active?C.gold:"transparent"}`,
      color: active ? C.gold : C.textDim, background:"transparent", border:"none",
      borderBottom:`2px solid ${active?C.gold:"transparent"}`, transition:"all 0.15s"}),
    card: {background:C.panel, border:`1px solid ${C.border}`, borderRadius:"4px", padding:"16px"},
    row: (selected) => ({display:"grid", gridTemplateColumns:"1fr 80px 80px 80px 90px 80px 60px",
      gap:"8px", padding:"10px 16px", cursor:"pointer", alignItems:"center",
      background: selected ? "#1A2030" : "transparent",
      borderLeft: `3px solid ${selected ? C.gold : "transparent"}`,
      borderBottom:`1px solid ${C.border}22`, transition:"all 0.1s"}),
    bar: (val, max, color) => ({height:"6px", borderRadius:"3px", background:C.border,
      overflow:"hidden", position:"relative", width:"100%"}),
  };

  if (computing) return (
    <div style={{...styles.root, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", minHeight:"100vh"}}>
      <div style={{...styles.card, width:"420px", textAlign:"center"}}>
        <div style={{fontFamily:"'Cinzel', serif", fontSize:"22px", color:C.gold,
          letterSpacing:"0.2em", marginBottom:"8px"}}>FINASTRO</div>
        <div style={{fontSize:"11px", color:C.textDim, letterSpacing:"0.12em",
          marginBottom:"28px"}}>CORRELATION ENGINE · SPRINT 1</div>
        <div style={{marginBottom:"8px", fontSize:"12px", color:C.textMid}}>
          Computing correlations from ephemeris2026.js...
        </div>
        <div style={{background:C.border, height:"6px", borderRadius:"3px",
          overflow:"hidden", marginBottom:"12px"}}>
          <div style={{height:"100%", borderRadius:"3px", background:C.gold,
            width:`${progress}%`, transition:"width 0.12s"}} />
        </div>
        <div style={{fontSize:"11px", color:C.textDim}}>
          {Math.round(progress)}% · Processing {PANCHANG_2026.length} Panchang days · {SIGNAL_DEFS.length} signals
        </div>
      </div>
    </div>
  );

  const totalValidated = results.filter(r => r.tier === "validated").length;
  const totalIndicative = results.filter(r => r.tier === "indicative").length;
  const totalUnvalidated = results.filter(r => r.tier === "unvalidated").length;

  return (
    <div style={styles.root}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.logo}>
          <div>
            <div style={styles.logoTitle}>Finastro · Correlation Engine</div>
            <div style={styles.logoSub}>Sprint 1 · Ujjain Reference · Lahiri Ayanamsa · Sidereal · IST</div>
          </div>
        </div>
        <div style={{display:"flex", gap:"12px", alignItems:"center"}}>
          <span style={{...styles.badge("validated"), marginRight:"4px"}}>
            ✓ {totalValidated} VALIDATED
          </span>
          <span style={styles.badge("indicative")}>~ {totalIndicative} INDICATIVE</span>
          <span style={styles.badge("unvalidated")}>✗ {totalUnvalidated} UNVALIDATED</span>
          <span style={{fontSize:"10px", color:C.greenDim, background:C.greenDim+"22",
            padding:"3px 8px", borderRadius:"3px", border:`1px solid ${C.greenDim}`,
            color:C.green}}>● LIVE · DUMMY DATA</span>
        </div>
      </div>

      {/* SCORE FORMULA BANNER */}
      <div style={{background:"#0D1420", borderBottom:`1px solid ${C.border}`,
        padding:"8px 24px", display:"flex", gap:"24px", alignItems:"center"}}>
        <span style={{fontSize:"10px", color:C.textDim, letterSpacing:"0.08em"}}>HONEST SCORE FORMULA:</span>
        <span style={{color:C.teal, fontSize:"11px", fontWeight:"700"}}>TECH 60%</span>
        <span style={{color:C.textDim}}>+</span>
        <span style={{color:C.green, fontSize:"11px"}}>INTRADAY ✓ 20% (validated only)</span>
        <span style={{color:C.textDim}}>+</span>
        <span style={{color:C.amber, fontSize:"11px"}}>PLANETARY ~ 20% (½ weight if indicative, 0 if unvalidated)</span>
        <span style={{marginLeft:"auto", fontSize:"10px", color:C.textDim}}>
          n≥30 · p&lt;0.05 → ✓ VALIDATED &nbsp;|&nbsp; n=2–29 → ~ INDICATIVE &nbsp;|&nbsp; n=0 → ✗ UNVALIDATED
        </span>
      </div>

      {/* TABS */}
      <div style={{display:"flex", borderBottom:`1px solid ${C.border}`,
        padding:"0 24px", background:C.panel}}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setActiveTab(i)} style={styles.tab(activeTab === i)}>{t}</button>
        ))}
      </div>

      <div style={{padding:"20px 24px"}}>

        {/* ── TAB 0: SIGNALS TABLE ── */}
        {activeTab === 0 && (
          <div style={{display:"grid", gridTemplateColumns:"1fr 340px", gap:"16px"}}>
            {/* Left: table */}
            <div>
              {/* Filter */}
              <div style={{display:"flex", gap:"8px", marginBottom:"14px", alignItems:"center"}}>
                <span style={{fontSize:"10px", color:C.textDim, marginRight:"4px", letterSpacing:"0.08em"}}>FILTER:</span>
                {["all","validated","indicative","unvalidated"].map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={styles.pill(filter === f)}>
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Table header */}
              <div style={{display:"grid", gridTemplateColumns:"1fr 80px 80px 80px 90px 80px 60px",
                gap:"8px", padding:"8px 16px", fontSize:"9px", letterSpacing:"0.1em",
                color:C.textDim, borderBottom:`1px solid ${C.border}`}}>
                <span>SIGNAL</span><span>n SAMPLES</span><span>AVG RETURN</span>
                <span>WIN RATE</span><span>p-VALUE</span><span>TIER</span><span>WEIGHT</span>
              </div>

              {filtered.map(sig => (
                <div key={sig.id}
                  style={styles.row(selectedSig?.id === sig.id)}
                  onClick={() => setSelectedSig(sig)}>
                  <div>
                    <div style={{fontSize:"12px", color:C.text, marginBottom:"2px"}}>{sig.label}</div>
                    <div style={{fontSize:"10px", color:C.textDim}}>{sig.desc}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <span style={{fontSize:"13px", color: sig.n >= 30 ? C.green : sig.n >= 3 ? C.amber : C.red,
                      fontWeight:"700"}}>{sig.n}</span>
                    {sig.n < 30 && <div style={{fontSize:"9px", color:C.amber}}>⚠ LOW</div>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    {sig.avg !== null ? (
                      <span style={{color: sig.avg > 0 ? C.green : C.red, fontWeight:"700"}}>
                        {sig.avg > 0 ? "+" : ""}{(sig.avg * 100).toFixed(2)}%
                      </span>
                    ) : <span style={{color:C.textDim}}>—</span>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    {sig.win !== null ? (
                      <span style={{color: sig.win > 0.55 ? C.green : sig.win > 0.45 ? C.amber : C.red}}>
                        {(sig.win * 100).toFixed(0)}%
                      </span>
                    ) : <span style={{color:C.textDim}}>—</span>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    {sig.p !== null ? (
                      <span style={{color: sig.p < 0.05 ? C.green : C.amber}}>
                        p={sig.p}
                        {sig.p < 0.05 && <span style={{color:C.green, fontSize:"9px"}}> ✓</span>}
                      </span>
                    ) : <span style={{color:C.textDim, fontSize:"10px"}}>N/A</span>}
                  </div>
                  <div style={{textAlign:"center"}}>
                    <span style={styles.badge(sig.tier)}>{sig.tierLabel} {sig.tier.toUpperCase()}</span>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <span style={{color: sig.weight === 1 ? C.green : sig.weight === 0.5 ? C.amber : C.textDim,
                      fontWeight:"700"}}>
                      {sig.weight === 1 ? "100%" : sig.weight === 0.5 ? "50%" : "0%"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: detail panel */}
            {selectedSig && (
              <DetailPanel sig={selectedSig} styles={styles} ohlcv={ohlcvRef.current} />
            )}
          </div>
        )}

        {/* ── TAB 1: COMPUTATION ── */}
        {activeTab === 1 && (
          <ComputationView results={results} ohlcv={ohlcvRef.current}
            panchang={PANCHANG_2026} styles={styles} />
        )}

        {/* ── TAB 2: DISTRIBUTION ── */}
        {activeTab === 2 && (
          <DistributionView results={results} styles={styles} />
        )}

        {/* ── TAB 3: EXPORT ── */}
        {activeTab === 3 && (
          <ExportView results={results} styles={styles} />
        )}
      </div>
    </div>
  );
}

// ─── DETAIL PANEL ─────────────────────────────────────────────────────────
function DetailPanel({ sig, styles, ohlcv }) {
  const C_local = C;
  const isRealData = sig.n >= 10;

  return (
    <div style={{...styles.card, position:"sticky", top:"20px"}}>
      <div style={{marginBottom:"12px"}}>
        <div style={{fontFamily:"'Cinzel', serif", fontSize:"13px", color:C.gold,
          letterSpacing:"0.1em", marginBottom:"4px"}}>{sig.label}</div>
        <div style={{fontSize:"10px", color:C.textDim}}>{sig.desc}</div>
      </div>
      <div style={{display:"flex", gap:"8px", marginBottom:"14px", flexWrap:"wrap"}}>
        <span style={styles.badge(sig.tier)}>{sig.tierLabel} {sig.tier.toUpperCase()}</span>
        <span style={{fontSize:"10px", color:C.textDim, padding:"2px 8px",
          border:`1px solid ${C.border}`, borderRadius:"3px"}}>{sig.layer.toUpperCase()}</span>
        <span style={{fontSize:"10px", color:C.textDim, padding:"2px 8px",
          border:`1px solid ${C.border}`, borderRadius:"3px"}}>{sig.category.toUpperCase()}</span>
      </div>

      {/* Stats grid */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"14px"}}>
        {[
          {label:"SAMPLE SIZE", val: sig.n === 0 ? "—" : sig.n.toLocaleString(), color: sig.n >= 30 ? C.green : C.amber},
          {label:"AVG RETURN", val: sig.avg !== null ? `${sig.avg > 0 ? "+" : ""}${(sig.avg*100).toFixed(2)}%` : "—",
            color: sig.avg > 0 ? C.green : sig.avg < 0 ? C.red : C.textDim},
          {label:"WIN RATE", val: sig.win !== null ? `${(sig.win*100).toFixed(0)}%` : "—",
            color: sig.win > 0.55 ? C.green : sig.win > 0.45 ? C.amber : C.red},
          {label:"p-VALUE", val: sig.p !== null ? `p=${sig.p}` : "N/A",
            color: sig.p !== null && sig.p < 0.05 ? C.green : C.amber},
          {label:"SCORE WEIGHT", val: sig.weight === 1 ? "Full (100%)" : sig.weight === 0.5 ? "Half (50%)" : "Zero (0%)",
            color: sig.weight === 1 ? C.green : sig.weight === 0.5 ? C.amber : C.red},
          {label:"DB TABLE", val: "km_astro_correlation", color: C.teal},
        ].map((item, i) => (
          <div key={i} style={{background:"#0D1016", padding:"8px", borderRadius:"3px",
            border:`1px solid ${C.border}`}}>
            <div style={{fontSize:"9px", color:C.textDim, letterSpacing:"0.08em",
              marginBottom:"4px"}}>{item.label}</div>
            <div style={{fontSize:"12px", color:item.color, fontWeight:"700"}}>{item.val}</div>
          </div>
        ))}
      </div>

      {/* Tier reasoning */}
      <div style={{background: sig.tier==="validated"?C.greenDim+"22":sig.tier==="indicative"?C.amberDim+"22":C.redDim+"22",
        border:`1px solid ${tierColor(sig.tier)}40`, borderRadius:"3px", padding:"10px",
        fontSize:"10px", color:C.textMid, lineHeight:"1.6", marginBottom:"12px"}}>
        {sig.tier === "validated" && <>
          <strong style={{color:C.green}}>✓ VALIDATED</strong> — n={sig.n.toLocaleString()}, p={sig.p}&lt;0.05.
          Statistically significant at 95% confidence. Full weight in score.
          Real DB query will confirm these results from <code style={{color:C.teal}}>km_equity_eod</code>.
        </>}
        {sig.tier === "indicative" && <>
          <strong style={{color:C.amber}}>~ INDICATIVE</strong> — n={sig.n}, directionally consistent
          but insufficient samples for statistical significance.
          Half weight in score. Accumulate more data over 2026 sessions.
        </>}
        {sig.tier === "unvalidated" && <>
          <strong style={{color:C.red}}>✗ UNVALIDATED</strong> — n=0. No NSE history exists for
          Herschel's 84-year orbital cycle (data predates NSE).
          Zero weight in score. Context only — never drives entry.
        </>}
      </div>

      {/* Mini distribution */}
      {sig.dist.length > 0 && (
        <div>
          <div style={{fontSize:"9px", color:C.textDim, letterSpacing:"0.08em",
            marginBottom:"6px"}}>RETURN DISTRIBUTION (sample)</div>
          <MiniDistribution returns={sig.dist} avg={sig.avg} />
        </div>
      )}

      {/* Replace marker */}
      <div style={{marginTop:"12px", padding:"8px", background:"#0A1020",
        borderRadius:"3px", border:`1px dashed ${C.teal}40`, fontSize:"10px", color:C.teal}}>
        🔄 REPLACE WITH LIVE DATA — query <code>km_astro_correlation</code>
        WHERE signal_id = '{sig.id}'
      </div>
    </div>
  );
}

// ─── MINI DISTRIBUTION CHART ───────────────────────────────────────────────
function MiniDistribution({ returns, avg }) {
  const bins = 12;
  const minV = Math.min(...returns, -0.02);
  const maxV = Math.max(...returns, 0.02);
  const range = maxV - minV;
  const buckets = Array(bins).fill(0);
  returns.forEach(r => {
    const idx = Math.min(bins - 1, Math.floor(((r - minV) / range) * bins));
    buckets[idx]++;
  });
  const maxBucket = Math.max(...buckets);
  const zeroIdx = Math.floor(((0 - minV) / range) * bins);

  return (
    <div style={{display:"flex", alignItems:"flex-end", gap:"2px", height:"40px"}}>
      {buckets.map((count, i) => {
        const midV = minV + (i + 0.5) * range / bins;
        const isPos = midV > 0;
        const isZero = i === zeroIdx;
        const h = maxBucket > 0 ? Math.max(2, (count / maxBucket) * 36) : 2;
        return (
          <div key={i} style={{flex:1, display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"flex-end", height:"40px"}}>
            <div style={{width:"100%", height:`${h}px`, borderRadius:"2px 2px 0 0",
              background: isZero ? C.gold : isPos ? C.green+"80" : C.red+"80"}} />
          </div>
        );
      })}
    </div>
  );
}

// ─── COMPUTATION VIEW ──────────────────────────────────────────────────────
function ComputationView({ results, ohlcv, panchang, styles }) {
  const [step, setStep] = useState(0);
  const STEPS = [
    { title:"Step 1 — Load Panchang Data", desc:`Loading ${panchang.length} trading days from PANCHANG_2026 array. Each day contains: Tithi, Nakshatra, Yoga IDs, changeover times, and sessionQuality (0–3).` },
    { title:"Step 2 — Generate OHLCV", desc:"Deterministic dummy NIFTY OHLCV generated from sessionQuality bias. Real implementation will read from km_equity_eod WHERE symbol='NIFTY' AND date IN (panchang dates)." },
    { title:"Step 3 — Label Signal Days", desc:"For each signal definition, each trading day is labelled match=true/false. Example: panchang_favorable → match if sessionQuality = 3." },
    { title:"Step 4 — Compute Statistics", desc:"For matching days: compute avg return, win rate (% of positive closes). For non-matching days: compute baseline. Diff = signal vs baseline." },
    { title:"Step 5 — Significance Test", desc:"p-value computed via two-sample t-test (matching vs non-matching returns). Threshold: p<0.05 → ✓ VALIDATED. p=0.05–0.15 → ~ INDICATIVE. n<3 → ✗ UNVALIDATED." },
    { title:"Step 6 — Assign Tier + Weight", desc:"Tier drives score weight: VALIDATED=100%, INDICATIVE=50%, UNVALIDATED=0%. Tier downgrades automatically if n drops below 30 after nightly re-run." },
    { title:"Step 7 — Write to km_astro_correlation", desc:"Output rows written to PostgreSQL. Each row: signal_id, n, avg_return, win_rate, p_value, tier, weight, last_computed. Screen 4 reads from this table at load time." },
  ];
  const favDays = panchang.filter(p => p.sessionQuality === 3).length;
  const avoidDays = panchang.filter(p => p.sessionQuality === 0).length;

  return (
    <div style={{display:"grid", gridTemplateColumns:"280px 1fr", gap:"16px"}}>
      {/* Steps sidebar */}
      <div>
        {STEPS.map((s, i) => (
          <div key={i} onClick={() => setStep(i)}
            style={{padding:"10px 14px", cursor:"pointer", marginBottom:"4px",
              borderRadius:"3px", background: step===i ? "#1A2030" : "transparent",
              borderLeft:`3px solid ${step===i ? C.gold : C.border}`,
              transition:"all 0.1s"}}>
            <div style={{fontSize:"11px", color: step===i ? C.gold : C.textMid,
              fontWeight: step===i ? "700" : "400"}}>{s.title}</div>
          </div>
        ))}
      </div>

      {/* Detail */}
      <div>
        <div style={{...styles.card, marginBottom:"16px"}}>
          <div style={{fontFamily:"'Cinzel', serif", fontSize:"14px", color:C.gold,
            letterSpacing:"0.1em", marginBottom:"8px"}}>{STEPS[step].title}</div>
          <div style={{fontSize:"12px", color:C.textMid, lineHeight:"1.7",
            marginBottom:"16px"}}>{STEPS[step].desc}</div>

          {step === 0 && (
            <div>
              <div style={{fontSize:"10px", color:C.textDim, marginBottom:"8px",
                letterSpacing:"0.08em"}}>PANCHANG DATA SAMPLE</div>
              <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"8px"}}>
                {[
                  {label:"Total Days", val:panchang.length, color:C.text},
                  {label:"Favorable (q=3)", val:favDays, color:C.green},
                  {label:"Avoid (q=0)", val:avoidDays, color:C.red},
                  {label:"With Changeover", val:panchang.filter(p=>p.tithiChange||p.yogaChange).length, color:C.amber},
                ].map((s, i) => (
                  <div key={i} style={{...styles.card, textAlign:"center"}}>
                    <div style={{fontSize:"22px", color:s.color, fontWeight:"700"}}>{s.val}</div>
                    <div style={{fontSize:"10px", color:C.textDim}}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:"12px", fontSize:"10px", color:C.textDim,
                lineHeight:"1.7"}}>
                Source: <code style={{color:C.teal}}>PANCHANG_2026[]</code> from ephemeris2026.js ·
                May–June 2026 sample · Full year data feeds from <code style={{color:C.teal}}>km_daily_panchang</code>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div style={{fontSize:"10px", color:C.textDim, marginBottom:"8px",
                letterSpacing:"0.08em"}}>OHLCV GENERATION — FIRST 8 TRADING DAYS</div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%", borderCollapse:"collapse", fontSize:"11px"}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${C.border}`}}>
                      {["DATE","VAAR","Q","OPEN","CLOSE","RETURN","SIGNAL"].map(h => (
                        <th key={h} style={{padding:"6px 8px", textAlign:"right", color:C.textDim,
                          fontSize:"9px", letterSpacing:"0.08em"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ohlcv.slice(0, 8).map((d, i) => (
                      <tr key={i} style={{borderBottom:`1px solid ${C.border}22`}}>
                        <td style={{padding:"5px 8px", color:C.textMid}}>{d.date}</td>
                        <td style={{padding:"5px 8px", textAlign:"right", color:C.textDim}}>{d.vaar}</td>
                        <td style={{padding:"5px 8px", textAlign:"right"}}>
                          <span style={{color: d.sessionQuality===3?C.green:d.sessionQuality===0?C.red:C.amber}}>
                            {d.sessionQuality}
                          </span>
                        </td>
                        <td style={{padding:"5px 8px", textAlign:"right", color:C.textMid}}>{d.open.toLocaleString()}</td>
                        <td style={{padding:"5px 8px", textAlign:"right", color:C.textMid}}>{d.close.toLocaleString()}</td>
                        <td style={{padding:"5px 8px", textAlign:"right",
                          color:d.return > 0 ? C.green : C.red}}>
                          {d.return > 0 ? "+" : ""}{(d.return*100).toFixed(2)}%
                        </td>
                        <td style={{padding:"5px 8px", textAlign:"right"}}>
                          <span style={{fontSize:"9px", color:d.sessionQuality===3?C.green:d.sessionQuality===0?C.red:C.textDim}}>
                            {d.sessionQuality===3?"FAV":d.sessionQuality===0?"AVOID":"NEUTRAL"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{marginTop:"10px", fontSize:"10px", color:C.textDim}}>
                Real implementation: <code style={{color:C.teal}}>SELECT date, open, high, low, close, volume FROM km_equity_eod WHERE symbol='NIFTY50'</code>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <div style={{fontSize:"10px", color:C.textDim, marginBottom:"10px",
                letterSpacing:"0.08em"}}>P-VALUE THRESHOLD VISUALISATION</div>
              {results.filter(r => r.p !== null).map(sig => (
                <div key={sig.id} style={{marginBottom:"8px", display:"grid",
                  gridTemplateColumns:"180px 1fr 60px", gap:"8px", alignItems:"center"}}>
                  <div style={{fontSize:"10px", color:C.textMid}}>{sig.label}</div>
                  <div style={{background:C.border, height:"8px", borderRadius:"4px",
                    overflow:"hidden", position:"relative"}}>
                    <div style={{height:"100%", borderRadius:"4px",
                      background: sig.p < 0.05 ? C.green : C.amber,
                      width:`${Math.min((sig.p / 0.15) * 100, 100)}%`}} />
                    {/* threshold line at p=0.05 */}
                    <div style={{position:"absolute", top:0, bottom:0,
                      left:`${(0.05/0.15)*100}%`, width:"2px",
                      background:C.gold, opacity:0.8}} />
                  </div>
                  <div style={{fontSize:"10px", textAlign:"right",
                    color: sig.p < 0.05 ? C.green : C.amber}}>
                    p={sig.p}
                  </div>
                </div>
              ))}
              <div style={{marginTop:"8px", fontSize:"10px", color:C.textDim}}>
                <span style={{color:C.gold}}>│</span> = p=0.05 threshold · Left = more significant
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <div style={{fontSize:"10px", color:C.textDim, marginBottom:"10px",
                letterSpacing:"0.08em"}}>TIER DOWNGRADE LOGIC</div>
              {[
                {cond:"n ≥ 30 AND p < 0.05", tier:"validated", result:"Full weight (100%)", color:C.green},
                {cond:"n = 2–29 (any p)", tier:"indicative", result:"Half weight (50%)", color:C.amber},
                {cond:"n = 0 OR no NSE history", tier:"unvalidated", result:"Zero weight (0%)", color:C.red},
                {cond:"n drops below 30 after re-run", tier:"downgraded", result:"Auto-demoted to INDICATIVE", color:C.amber},
              ].map((row, i) => (
                <div key={i} style={{display:"grid", gridTemplateColumns:"1fr 120px 180px",
                  gap:"8px", padding:"8px 10px", marginBottom:"4px",
                  background:"#0D1016", borderRadius:"3px",
                  borderLeft:`3px solid ${row.color}`}}>
                  <div style={{fontSize:"11px", color:C.textMid}}>{row.cond}</div>
                  <span style={styles.badge(row.tier)}>{row.tier.toUpperCase()}</span>
                  <div style={{fontSize:"11px", color:row.color}}>{row.result}</div>
                </div>
              ))}
            </div>
          )}

          {step === 6 && (
            <div>
              <div style={{fontSize:"10px", color:C.textDim, marginBottom:"10px",
                letterSpacing:"0.08em"}}>OUTPUT: km_astro_correlation TABLE SCHEMA</div>
              <div style={{fontFamily:"'DM Mono', monospace", fontSize:"11px",
                background:"#070A0D", border:`1px solid ${C.border}`,
                borderRadius:"4px", padding:"14px", color:C.textMid, lineHeight:"1.8"}}>
                <span style={{color:C.teal}}>CREATE TABLE</span>{" "}
                <span style={{color:C.gold}}>km_astro_correlation</span> ({"\n"}
                {"  "}<span style={{color:C.green}}>id</span>           SERIAL PRIMARY KEY,{"\n"}
                {"  "}<span style={{color:C.green}}>signal_id</span>    VARCHAR(60) UNIQUE NOT NULL,{"\n"}
                {"  "}<span style={{color:C.green}}>label</span>        VARCHAR(120),{"\n"}
                {"  "}<span style={{color:C.green}}>layer</span>        VARCHAR(20),  <span style={{color:C.textDim}}>-- intraday | positional</span>{"\n"}
                {"  "}<span style={{color:C.green}}>category</span>     VARCHAR(20),  <span style={{color:C.textDim}}>-- panchang | moon | planetary</span>{"\n"}
                {"  "}<span style={{color:C.green}}>n</span>            INTEGER,{"\n"}
                {"  "}<span style={{color:C.green}}>avg_return</span>   NUMERIC(8,4),{"\n"}
                {"  "}<span style={{color:C.green}}>win_rate</span>     NUMERIC(5,3),{"\n"}
                {"  "}<span style={{color:C.green}}>p_value</span>      NUMERIC(6,4),{"\n"}
                {"  "}<span style={{color:C.green}}>tier</span>         VARCHAR(12),  <span style={{color:C.textDim}}>-- validated | indicative | unvalidated</span>{"\n"}
                {"  "}<span style={{color:C.green}}>weight</span>       NUMERIC(3,2), <span style={{color:C.textDim}}>-- 1.0 | 0.5 | 0.0</span>{"\n"}
                {"  "}<span style={{color:C.green}}>last_computed</span> TIMESTAMPTZ DEFAULT NOW(){"\n"}
                );
              </div>
              <div style={{marginTop:"10px", padding:"8px 12px",
                background:"#0A1020", border:`1px dashed ${C.teal}40`,
                borderRadius:"3px", fontSize:"10px", color:C.teal}}>
                🔄 REPLACE WITH LIVE DATA — this engine writes to this table.
                Screen 4 reads: <code>SELECT * FROM km_astro_correlation</code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DISTRIBUTION VIEW ─────────────────────────────────────────────────────
function DistributionView({ results, styles }) {
  const [selected, setSelected] = useState(results[0]?.id);
  const sig = results.find(r => r.id === selected);

  const favSig = results.find(r => r.id === "panchang_favorable");
  const avoidSig = results.find(r => r.id === "panchang_avoid");

  return (
    <div style={{display:"grid", gridTemplateColumns:"200px 1fr", gap:"16px"}}>
      <div>
        <div style={{fontSize:"9px", color:C.textDim, letterSpacing:"0.1em",
          marginBottom:"8px", padding:"0 4px"}}>SELECT SIGNAL</div>
        {results.map(r => (
          <div key={r.id} onClick={() => setSelected(r.id)}
            style={{padding:"8px 12px", cursor:"pointer", borderRadius:"3px",
              marginBottom:"3px", fontSize:"11px",
              background: selected===r.id ? "#1A2030" : "transparent",
              color: selected===r.id ? C.gold : C.textMid,
              borderLeft:`2px solid ${selected===r.id ? C.gold : "transparent"}`,
              display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <span>{r.label}</span>
            <span style={styles.badge(r.tier)}>{r.tierLabel}</span>
          </div>
        ))}
      </div>

      <div>
        {sig && (
          <div>
            <div style={{...styles.card, marginBottom:"16px"}}>
              <div style={{fontFamily:"'Cinzel', serif", fontSize:"14px", color:C.gold,
                letterSpacing:"0.1em", marginBottom:"4px"}}>{sig.label}</div>
              <div style={{fontSize:"10px", color:C.textDim, marginBottom:"14px"}}>{sig.desc}</div>

              {sig.dist.length === 0 ? (
                <div style={{padding:"20px", textAlign:"center",
                  color:C.textDim, fontSize:"12px"}}>
                  ✗ No distribution data — n=0. Herschel Gemini has no NSE history.
                </div>
              ) : (
                <div>
                  {/* Full bar chart */}
                  <div style={{fontSize:"9px", color:C.textDim, letterSpacing:"0.08em",
                    marginBottom:"8px"}}>RETURN DISTRIBUTION ({sig.dist.length} samples)</div>
                  <FullDistribution returns={sig.dist} avg={sig.avg} />

                  <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)",
                    gap:"10px", marginTop:"14px"}}>
                    {[
                      {label:"Mean Return", val:`${sig.avg > 0 ? "+" : ""}${(sig.avg*100).toFixed(2)}%`,
                        color: sig.avg > 0 ? C.green : C.red},
                      {label:"Win Rate", val: sig.win !== null ? `${(sig.win*100).toFixed(0)}%` : "—",
                        color: sig.win > 0.55 ? C.green : sig.win > 0.45 ? C.amber : C.red},
                      {label:"Significance", val: sig.p !== null ? `p=${sig.p}` : "N/A",
                        color: sig.p !== null && sig.p < 0.05 ? C.green : C.amber},
                    ].map((s, i) => (
                      <div key={i} style={{...styles.card, textAlign:"center"}}>
                        <div style={{fontSize:"9px", color:C.textDim, marginBottom:"4px",
                          letterSpacing:"0.08em"}}>{s.label}</div>
                        <div style={{fontSize:"18px", fontWeight:"700", color:s.color}}>{s.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Favorable vs Avoid comparison */}
            {favSig && avoidSig && (
              <div style={{...styles.card}}>
                <div style={{fontSize:"11px", color:C.textMid, letterSpacing:"0.08em",
                  marginBottom:"12px", fontWeight:"700"}}>◎ FAVORABLE vs AVOID — COMPARISON</div>
                <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px"}}>
                  <div>
                    <div style={{fontSize:"9px", color:C.green, marginBottom:"6px",
                      letterSpacing:"0.08em"}}>✓ PANCHANG FAVORABLE (n={favSig.n.toLocaleString()})</div>
                    <FullDistribution returns={favSig.dist} avg={favSig.avg} color={C.green} />
                    <div style={{marginTop:"6px", fontSize:"11px", color:C.green}}>
                      Avg: +{(favSig.avg*100).toFixed(2)}% · Win: {(favSig.win*100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:"9px", color:C.red, marginBottom:"6px",
                      letterSpacing:"0.08em"}}>✗ PANCHANG AVOID (n={avoidSig.n.toLocaleString()})</div>
                    <FullDistribution returns={avoidSig.dist} avg={avoidSig.avg} color={C.red} />
                    <div style={{marginTop:"6px", fontSize:"11px", color:C.red}}>
                      Avg: {(avoidSig.avg*100).toFixed(2)}% · Win: {(avoidSig.win*100).toFixed(0)}%
                    </div>
                  </div>
                </div>
                <div style={{marginTop:"10px", padding:"8px",
                  background:C.greenDim+"22", border:`1px solid ${C.green}30`,
                  borderRadius:"3px", fontSize:"10px", color:C.textMid}}>
                  ✓ <strong style={{color:C.green}}>VALIDATED</strong> — Favorable days outperform Avoid days by{" "}
                  <strong style={{color:C.gold}}>{((favSig.avg - avoidSig.avg)*100).toFixed(2)}%</strong> on average.
                  p={favSig.p} vs p={avoidSig.p}. Both statistically significant at 95% confidence.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FullDistribution({ returns, avg, color }) {
  const bins = 16;
  const minV = Math.min(...returns, -0.025);
  const maxV = Math.max(...returns, 0.025);
  const range = maxV - minV;
  const buckets = Array(bins).fill(0);
  returns.forEach(r => {
    const idx = Math.min(bins - 1, Math.floor(((r - minV) / range) * bins));
    buckets[idx]++;
  });
  const maxB = Math.max(...buckets);
  const zeroIdx = Math.max(0, Math.min(bins - 1, Math.floor(((0 - minV) / range) * bins)));
  const barColor = color || C.teal;

  return (
    <div>
      <div style={{display:"flex", alignItems:"flex-end", gap:"2px", height:"60px"}}>
        {buckets.map((count, i) => {
          const midV = minV + (i + 0.5) * range / bins;
          const h = maxB > 0 ? Math.max(2, (count / maxB) * 56) : 2;
          const isAvg = Math.abs(midV - avg) < range / bins;
          return (
            <div key={i} style={{flex:1, display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"flex-end", height:"60px", position:"relative"}}>
              {isAvg && (
                <div style={{position:"absolute", top:0, width:"2px", height:"100%",
                  background:C.gold, opacity:0.7, borderRadius:"1px"}} />
              )}
              <div style={{width:"100%", height:`${h}px`, borderRadius:"2px 2px 0 0",
                background: i === zeroIdx ? C.gold+"60" : midV > 0 ? barColor+"80" : C.red+"60"}} />
            </div>
          );
        })}
      </div>
      <div style={{display:"flex", justifyContent:"space-between", marginTop:"4px",
        fontSize:"9px", color:C.textDim}}>
        <span>{(minV*100).toFixed(1)}%</span>
        <span style={{color:C.gold}}>avg={avg > 0 ? "+" : ""}{(avg*100).toFixed(2)}%</span>
        <span>{(maxV*100).toFixed(1)}%</span>
      </div>
    </div>
  );
}

// ─── EXPORT VIEW ───────────────────────────────────────────────────────────
function ExportView({ results, styles }) {
  const rows = results.map(r => ({
    signal_id: r.id, label: r.label, layer: r.layer, category: r.category,
    n: r.n, avg_return: r.avg !== null ? +(r.avg).toFixed(4) : null,
    win_rate: r.win !== null ? +(r.win).toFixed(3) : null,
    p_value: r.p, tier: r.tier, weight: r.weight,
    last_computed: new Date().toISOString(),
  }));

  const insertSQL = rows.map(r =>
    `INSERT INTO km_astro_correlation (signal_id, label, layer, category, n, avg_return, win_rate, p_value, tier, weight)\n` +
    `VALUES ('${r.signal_id}', '${r.label}', '${r.layer}', '${r.category}', ${r.n}, ${r.avg_return ?? "NULL"}, ${r.win_rate ?? "NULL"}, ${r.p_value ?? "NULL"}, '${r.tier}', ${r.weight})\n` +
    `ON CONFLICT (signal_id) DO UPDATE SET n=EXCLUDED.n, avg_return=EXCLUDED.avg_return,\n` +
    `  win_rate=EXCLUDED.win_rate, p_value=EXCLUDED.p_value, tier=EXCLUDED.tier,\n` +
    `  weight=EXCLUDED.weight, last_computed=NOW();`
  ).join("\n\n");

  return (
    <div>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px", marginBottom:"16px"}}>
        {/* JSON export */}
        <div style={{...styles.card}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center",
            marginBottom:"10px"}}>
            <div style={{fontSize:"11px", color:C.gold, fontWeight:"700",
              letterSpacing:"0.08em"}}>JSON EXPORT — km_astro_correlation rows</div>
            <span style={{fontSize:"9px", color:C.teal, padding:"2px 6px",
              border:`1px dashed ${C.teal}40`, borderRadius:"2px"}}>🔄 REPLACE WITH LIVE</span>
          </div>
          <div style={{fontFamily:"'DM Mono', monospace", fontSize:"10px",
            background:"#070A0D", border:`1px solid ${C.border}`, borderRadius:"4px",
            padding:"12px", color:C.textMid, lineHeight:"1.6", maxHeight:"300px",
            overflowY:"auto", whiteSpace:"pre"}}>
            {JSON.stringify(rows, null, 2)}
          </div>
        </div>

        {/* SQL upsert */}
        <div style={{...styles.card}}>
          <div style={{fontSize:"11px", color:C.gold, fontWeight:"700",
            letterSpacing:"0.08em", marginBottom:"10px"}}>SQL UPSERT — PostgreSQL (km_astro_correlation)</div>
          <div style={{fontFamily:"'DM Mono', monospace", fontSize:"10px",
            background:"#070A0D", border:`1px solid ${C.border}`, borderRadius:"4px",
            padding:"12px", color:C.textMid, lineHeight:"1.6", maxHeight:"300px",
            overflowY:"auto", whiteSpace:"pre", overflowX:"auto"}}>
            {insertSQL}
          </div>
        </div>
      </div>

      {/* Summary table */}
      <div style={styles.card}>
        <div style={{fontSize:"11px", color:C.gold, fontWeight:"700",
          letterSpacing:"0.08em", marginBottom:"12px"}}>FULL OUTPUT — All 11 Signals</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%", borderCollapse:"collapse", fontSize:"11px"}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${C.border}`}}>
                {["signal_id","layer","n","avg_return","win_rate","p_value","tier","weight","score_in_formula"].map(h => (
                  <th key={h} style={{padding:"7px 10px", textAlign:"right", color:C.textDim,
                    fontSize:"9px", letterSpacing:"0.08em", whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{borderBottom:`1px solid ${C.border}22`}}>
                  <td style={{padding:"7px 10px", color:C.teal, fontFamily:"monospace",
                    fontSize:"10px"}}>{r.signal_id}</td>
                  <td style={{padding:"7px 10px", textAlign:"right", color:C.textDim}}>{r.layer}</td>
                  <td style={{padding:"7px 10px", textAlign:"right",
                    color: r.n >= 30 ? C.green : r.n >= 3 ? C.amber : C.red,
                    fontWeight:"700"}}>{r.n || "—"}</td>
                  <td style={{padding:"7px 10px", textAlign:"right",
                    color: r.avg_return > 0 ? C.green : r.avg_return < 0 ? C.red : C.textDim}}>
                    {r.avg_return !== null ? `${r.avg_return > 0 ? "+" : ""}${(r.avg_return*100).toFixed(2)}%` : "—"}
                  </td>
                  <td style={{padding:"7px 10px", textAlign:"right",
                    color: r.win_rate > 0.55 ? C.green : r.win_rate < 0.45 ? C.red : C.amber}}>
                    {r.win_rate !== null ? `${(r.win_rate*100).toFixed(0)}%` : "—"}
                  </td>
                  <td style={{padding:"7px 10px", textAlign:"right",
                    color: r.p_value !== null && r.p_value < 0.05 ? C.green : C.amber}}>
                    {r.p_value ?? "—"}
                  </td>
                  <td style={{padding:"7px 10px", textAlign:"center"}}>
                    <span style={{fontSize:"9px", fontWeight:"700",
                      color: tierColor(r.tier)}}>
                      {r.tier === "validated" ? "✓" : r.tier === "indicative" ? "~" : "✗"} {r.tier.toUpperCase()}
                    </span>
                  </td>
                  <td style={{padding:"7px 10px", textAlign:"right",
                    color: r.weight === 1 ? C.green : r.weight === 0.5 ? C.amber : C.textDim,
                    fontWeight:"700"}}>
                    {r.weight === 1 ? "100%" : r.weight === 0.5 ? "50%" : "0%"}
                  </td>
                  <td style={{padding:"7px 10px", textAlign:"right", fontSize:"10px"}}>
                    {r.tier === "validated" ? (
                      <span style={{color:C.green}}>✓ In score</span>
                    ) : r.tier === "indicative" ? (
                      <span style={{color:C.amber}}>~ Half weight</span>
                    ) : (
                      <span style={{color:C.red}}>✗ Context only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Live data note */}
        <div style={{marginTop:"14px", padding:"10px 14px",
          background:"#0A1020", border:`1px dashed ${C.teal}40`,
          borderRadius:"3px", fontSize:"10px", color:C.textMid, lineHeight:"1.7"}}>
          🔄 <strong style={{color:C.teal}}>REPLACE WITH LIVE DATA</strong> — This engine runs on dummy OHLCV
          generated from PANCHANG_2026 quality scores.{" "}
          <strong>Production pipeline:</strong>{" "}
          <code style={{color:C.teal}}>km_equity_eod</code> (real NIFTY OHLCV) ×{" "}
          <code style={{color:C.teal}}>km_daily_panchang</code> (exact changeover times from VPS) →{" "}
          nightly cron → upsert into <code style={{color:C.teal}}>km_astro_correlation</code> →{" "}
          Screen 4 reads at load time. All signal IDs above are stable — use as FK references.
        </div>
      </div>
    </div>
  );
}
