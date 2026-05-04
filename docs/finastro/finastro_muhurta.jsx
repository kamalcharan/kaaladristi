import { useState, useEffect, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// FINASTRO — SPRINT 4: MUHURTA SELECTION
// File: finastro_muhurta.jsx
// Financial action types → ranked 48-min windows for next 30 days
// Each window: Tithi · Nakshatra · Yoga · Planet support score
// Reference: Ujjain (23°10'N, 75°46'E) · Lahiri · Sidereal · IST
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  bg:"#0A0C0F", panel:"#0F1216", border:"#1C2028", borderBright:"#2A3040",
  gold:"#C9A84C", goldDim:"#7A6230", goldBright:"#E8C860",
  green:"#4CAF8A", greenDim:"#2A5A42",
  red:"#E86060", redDim:"#5A2828",
  amber:"#E89040", amberDim:"#6B4520",
  teal:"#40B8C8", tealDim:"#1C5A64",
  purple:"#9B6BC0", purpleDim:"#4A2870",
  blue:"#5B8DD9", blueDim:"#243660",
  text:"#D8DDE8", textDim:"#6A7280", textMid:"#A8B0C0",
};

// ─── ACTION TYPES ─────────────────────────────────────────────────────────
const ACTION_TYPES = [
  { id:"new_position",    icon:"▲", label:"New Position Entry",
    desc:"Opening a fresh long or short position",
    color:C.green,
    wants:{ tithiTypes:["Nanda","Bhadra","Jaya"], yogaMin:2, moonElements:["Fire","Earth"],
      avoidYogas:[17,27,1,6,10,13,19], preferNakshatras:[4,7,8,12,13,16,17,21,22],
      planetBoost:"jupiter", needsAbhijit:false, lagnaScore:true } },
  { id:"large_trade",     icon:"▲▲", label:"Large Trade / Block",
    desc:"High-value or block-deal execution",
    color:C.gold,
    wants:{ tithiTypes:["Jaya","Purna"], yogaMin:3, moonElements:["Fire","Air"],
      avoidYogas:[17,27,1,6,10,13,19,9], preferNakshatras:[7,8,16,21,25,26],
      planetBoost:"jupiter", needsAbhijit:true, lagnaScore:true } },
  { id:"ipo_sub",         icon:"◉", label:"IPO Subscription",
    desc:"Applying for new issue / IPO",
    color:C.teal,
    wants:{ tithiTypes:["Nanda","Pratipada"], yogaMin:2, moonElements:["Fire","Air"],
      avoidYogas:[17,27,6,10,13,19], preferNakshatras:[1,2,4,7,11,14,16,22],
      planetBoost:"sun", needsAbhijit:false, lagnaScore:false } },
  { id:"sip_start",       icon:"🔄", label:"SIP Start Date",
    desc:"Initiating a monthly SIP investment",
    color:C.blue,
    wants:{ tithiTypes:["Bhadra","Nanda"], yogaMin:2, moonElements:["Earth","Water"],
      avoidYogas:[17,27,1,6,19], preferNakshatras:[4,7,8,17,22,26,27],
      planetBoost:"moon", needsAbhijit:false, lagnaScore:false } },
  { id:"rebalance",       icon:"⬡", label:"Portfolio Rebalancing",
    desc:"Structural reallocation — Saturn-friendly dates",
    color:C.purple,
    wants:{ tithiTypes:["Jaya","Purna","Bhadra"], yogaMin:2, moonElements:["Earth","Air"],
      avoidYogas:[17,27,1,6,10,13,19,9], preferNakshatras:[8,12,17,22,26],
      planetBoost:"saturn", needsAbhijit:false, lagnaScore:false } },
  { id:"stop_placement",  icon:"◼", label:"Stop Loss Placement",
    desc:"Setting protective stops — Mars-friendly moments",
    color:C.amber,
    wants:{ tithiTypes:["Jaya","Rikta"], yogaMin:1, moonElements:["Fire","Earth"],
      avoidYogas:[17,27], preferNakshatras:[5,14,19,23],
      planetBoost:"mars", needsAbhijit:false, lagnaScore:false } },
  { id:"exit_position",   icon:"↓", label:"Position Exit / Book Profit",
    desc:"Closing an existing position",
    color:C.amber,
    wants:{ tithiTypes:["Purna","Nanda"], yogaMin:2, moonElements:["Fire","Air"],
      avoidYogas:[17,27,1,10], preferNakshatras:[3,12,16,21],
      planetBoost:"sun", needsAbhijit:false, lagnaScore:false } },
  { id:"demat_open",      icon:"📋", label:"Demat / Account Opening",
    desc:"Opening brokerage or demat account",
    color:C.teal,
    wants:{ tithiTypes:["Nanda","Bhadra"], yogaMin:3, moonElements:["Fire","Air","Earth"],
      avoidYogas:[17,27,1,6,10,13,19], preferNakshatras:[4,7,8,16,22,25],
      planetBoost:"mercury", needsAbhijit:false, lagnaScore:true } },
];

// ─── PANCHANG DATA ────────────────────────────────────────────────────────
const TITHIS = [
  {id:1,name:"Pratipada",paksha:"Shukla",type:"Nanda",quality:3},
  {id:2,name:"Dwitiya",paksha:"Shukla",type:"Bhadra",quality:3},
  {id:3,name:"Tritiya",paksha:"Shukla",type:"Jaya",quality:3},
  {id:4,name:"Chaturthi",paksha:"Shukla",type:"Rikta",quality:1},
  {id:5,name:"Panchami",paksha:"Shukla",type:"Purna",quality:3},
  {id:6,name:"Shashthi",paksha:"Shukla",type:"Nanda",quality:2},
  {id:7,name:"Saptami",paksha:"Shukla",type:"Bhadra",quality:3},
  {id:8,name:"Ashtami",paksha:"Shukla",type:"Jaya",quality:2},
  {id:9,name:"Navami",paksha:"Shukla",type:"Rikta",quality:2},
  {id:10,name:"Dashami",paksha:"Shukla",type:"Purna",quality:3},
  {id:11,name:"Ekadashi",paksha:"Shukla",type:"Nanda",quality:3},
  {id:12,name:"Dwadashi",paksha:"Shukla",type:"Bhadra",quality:3},
  {id:13,name:"Trayodashi",paksha:"Shukla",type:"Jaya",quality:2},
  {id:14,name:"Chaturdashi",paksha:"Shukla",type:"Rikta",quality:1},
  {id:15,name:"Purnima",paksha:"Shukla",type:"Purna",quality:2},
  {id:16,name:"Pratipada",paksha:"Rishna",type:"Nanda",quality:3},
  {id:17,name:"Dwitiya",paksha:"Krishna",type:"Bhadra",quality:3},
  {id:18,name:"Tritiya",paksha:"Krishna",type:"Jaya",quality:3},
  {id:19,name:"Chaturthi",paksha:"Krishna",type:"Rikta",quality:1},
  {id:20,name:"Panchami",paksha:"Krishna",type:"Purna",quality:3},
  {id:21,name:"Shashthi",paksha:"Krishna",type:"Nanda",quality:2},
  {id:22,name:"Saptami",paksha:"Krishna",type:"Bhadra",quality:3},
  {id:23,name:"Ashtami",paksha:"Krishna",type:"Jaya",quality:2},
  {id:24,name:"Navami",paksha:"Krishna",type:"Rikta",quality:2},
  {id:25,name:"Dashami",paksha:"Krishna",type:"Purna",quality:3},
  {id:26,name:"Ekadashi",paksha:"Krishna",type:"Nanda",quality:3},
  {id:27,name:"Dwadashi",paksha:"Krishna",type:"Bhadra",quality:3},
  {id:28,name:"Trayodashi",paksha:"Krishna",type:"Jaya",quality:2},
  {id:29,name:"Chaturdashi",paksha:"Krishna",type:"Rikta",quality:1},
  {id:30,name:"Amavasya",paksha:"Krishna",type:"Purna",quality:0},
];

const YOGAS = [
  {id:1,name:"Vishkambha",quality:0},{id:2,name:"Priti",quality:3},{id:3,name:"Ayushman",quality:3},
  {id:4,name:"Saubhagya",quality:3},{id:5,name:"Shobhana",quality:3},{id:6,name:"Atiganda",quality:0},
  {id:7,name:"Sukarman",quality:3},{id:8,name:"Dhriti",quality:3},{id:9,name:"Shula",quality:1},
  {id:10,name:"Ganda",quality:0},{id:11,name:"Vriddhi",quality:3},{id:12,name:"Dhruva",quality:3},
  {id:13,name:"Vyaghata",quality:0},{id:14,name:"Harshana",quality:3},{id:15,name:"Vajra",quality:2},
  {id:16,name:"Siddhi",quality:3},{id:17,name:"Vyatipata",quality:0},{id:18,name:"Variyana",quality:2},
  {id:19,name:"Parigha",quality:0},{id:20,name:"Shiva",quality:3},{id:21,name:"Siddha",quality:3},
  {id:22,name:"Sadhya",quality:3},{id:23,name:"Shubha",quality:3},{id:24,name:"Shukla",quality:3},
  {id:25,name:"Brahma",quality:3},{id:26,name:"Indra",quality:3},{id:27,name:"Vaidhriti",quality:0},
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

const SIGNS = [
  {name:"Aries",element:"Fire",lord:"mars"},{name:"Taurus",element:"Earth",lord:"venus"},
  {name:"Gemini",element:"Air",lord:"mercury"},{name:"Cancer",element:"Water",lord:"moon"},
  {name:"Leo",element:"Fire",lord:"sun"},{name:"Virgo",element:"Earth",lord:"mercury"},
  {name:"Libra",element:"Air",lord:"venus"},{name:"Scorpio",element:"Water",lord:"mars"},
  {name:"Sagittarius",element:"Fire",lord:"jupiter"},{name:"Capricorn",element:"Earth",lord:"saturn"},
  {name:"Aquarius",element:"Air",lord:"saturn"},{name:"Pisces",element:"Water",lord:"jupiter"},
];

const RAHU_KALA = {
  0:{start:"17:00",end:"18:30"},1:{start:"07:30",end:"09:00"},
  2:{start:"15:00",end:"16:30"},3:{start:"12:00",end:"13:30"},
  4:{start:"13:30",end:"15:00"},5:{start:"10:30",end:"12:00"},
  6:{start:"09:00",end:"10:30"},
};
const ABHIJIT = {start:"11:48",end:"12:36"};

// ─── PLANETARY CONTEXT (May–Jun 2026) ────────────────────────────────────
const PLANET_CONTEXT = {
  jupiter:  {sign:"Cancer",status:"exalted",retro:false,  boost:1.5},
  venus:    {sign:"Taurus",status:"direct", retro:false,  boost:1.2},
  mercury:  {sign:"Gemini",status:"retro",  retro:true,   boost:0.3},
  mars:     {sign:"Cancer",status:"debil",  retro:false,  boost:0.6},
  saturn:   {sign:"Aries", status:"debil",  retro:false,  boost:0.7},
  sun:      {sign:"Taurus",status:"normal", retro:false,  boost:1.0},
  moon:     {sign:"varies",status:"normal", retro:false,  boost:1.0},
  rahu:     {sign:"Pisces",status:"normal", retro:true,   boost:0.8},
  herschel: {sign:"Gemini",status:"normal", retro:false,  boost:0.4},
};

// ─── GENERATE 30-DAY MUHURTA WINDOWS ──────────────────────────────────────
function generateMuhurtaWindows(action, baseDate) {
  const windows = [];
  const start = new Date(baseDate);

  for (let day = 0; day < 30; day++) {
    const d = new Date(start.getTime() + day * 86400000);
    const dow = d.getDay();
    const dateStr = d.toISOString().slice(0,10);

    // Skip Sundays (NSE closed) — Saturdays kept for account/SIP actions
    if (dow === 0) continue;

    // Deterministic panchang for the day (seeded)
    const seed = day * 7 + action.id.length;
    const tithiId = ((seed * 13 + 7) % 30) + 1;
    const yogaId  = ((seed * 11 + 3) % 27) + 1;
    const nakId   = ((seed * 9  + 5) % 27) + 1;
    const moonSignIdx = ((seed * 3 + 1) % 12);

    const tithi   = TITHIS.find(t=>t.id===tithiId) || TITHIS[0];
    const yoga    = YOGAS.find(y=>y.id===yogaId)   || YOGAS[0];
    const nak     = NAKSHATRAS.find(n=>n.id===nakId)|| NAKSHATRAS[0];
    const moonSign = SIGNS[moonSignIdx];

    const rahuK = RAHU_KALA[dow];

    // Build candidate 48-min windows across the session
    const slots = [
      {label:"Opening Slot",  start:"09:15", end:"10:03"},
      {label:"Pre-Rahu",      start:"10:03", end:"10:30"},
      {label:"Mid-Morning",   start:"10:30", end:"11:18"},
      {label:"Abhijit Open",  start:"11:18", end:"11:48"},
      {label:"Abhijit Prime", start:"11:48", end:"12:36"},
      {label:"Post-Abhijit",  start:"12:36", end:"13:24"},
      {label:"Afternoon",     start:"13:24", end:"14:12"},
      {label:"Late Session",  start:"14:12", end:"15:00"},
      {label:"Closing Slot",  start:"15:00", end:"15:30"},
    ];

    for (const slot of slots) {
      // Skip Rahu Kala windows for most action types
      const inRahu = rahuK && slot.start >= rahuK.start && slot.start < rahuK.end;
      if (inRahu && action.id !== "stop_placement") continue;
      // Saturday: only non-market slots
      if (dow === 6 && !["sip_start","demat_open","rebalance"].includes(action.id)) continue;

      const isAbhijit = slot.start >= ABHIJIT.start && slot.end <= ABHIJIT.end + ":59";

      // Score computation
      let score = 0; const breakdown = [];

      // 1. Tithi type match
      const tithiMatch = action.wants.tithiTypes.includes(tithi.type);
      const tithiScore = tithiMatch ? 2.5 : tithi.quality >= 2 ? 1.0 : 0;
      score += tithiScore;
      breakdown.push({label:"Tithi", val:tithiScore, max:2.5,
        note:`${tithi.name} (${tithi.type})${tithiMatch?" ✓":""}`});

      // 2. Yoga score
      const isAvoidYoga = action.wants.avoidYogas.includes(yogaId);
      const yogaScore = isAvoidYoga ? -2.0 : yoga.quality >= action.wants.yogaMin ? 2.0 :
        yoga.quality === action.wants.yogaMin - 1 ? 0.5 : -0.5;
      score += yogaScore;
      breakdown.push({label:"Yoga", val:yogaScore, max:2.0,
        note:`${yoga.name}${isAvoidYoga?" ✗ AVOID":yoga.quality>=2?" ✓":""}`});

      // 3. Nakshatra preference
      const prefNak = action.wants.preferNakshatras.includes(nakId);
      const nakScore = prefNak ? 2.0 : nak.quality >= 2 ? 0.8 : 0;
      score += nakScore;
      breakdown.push({label:"Nakshatra", val:nakScore, max:2.0,
        note:`${nak.name}${prefNak?" ✓":""}`});

      // 4. Moon element
      const moonMatch = action.wants.moonElements.includes(moonSign.element);
      const moonScore = moonMatch ? 1.5 : 0.3;
      score += moonScore;
      breakdown.push({label:"Moon Sign", val:moonScore, max:1.5,
        note:`${moonSign.name} (${moonSign.element})${moonMatch?" ✓":""}`});

      // 5. Abhijit bonus
      if (isAbhijit) {
        const abhScore = action.wants.needsAbhijit ? 2.0 : 1.0;
        score += abhScore;
        breakdown.push({label:"Abhijit", val:abhScore, max:2.0, note:"☀ Active ✓"});
      }

      // 6. Planet boost
      const boostPlanet = PLANET_CONTEXT[action.wants.planetBoost];
      const planetScore = boostPlanet
        ? (boostPlanet.retro ? 0 : boostPlanet.boost * 1.5)
        : 0;
      score += planetScore;
      breakdown.push({label:`${action.wants.planetBoost} support`, val:+planetScore.toFixed(2),
        max:2.25, note:`${boostPlanet?.sign || ""}${boostPlanet?.retro?" (retro)":boostPlanet?.status==="exalted"?" (exalted)":""}`});

      // 7. Mercury retro penalty for execution-heavy actions
      if (PLANET_CONTEXT.mercury.retro &&
          ["new_position","large_trade","ipo_sub","demat_open"].includes(action.id)) {
        score -= 1.5;
        breakdown.push({label:"Mercury Retro", val:-1.5, max:0, note:"☿ Retrograde penalty"});
      }

      // 8. Jupiter exalted bonus for wealth-building actions
      if (!PLANET_CONTEXT.jupiter.retro && PLANET_CONTEXT.jupiter.status === "exalted" &&
          ["new_position","large_trade","sip_start","ipo_sub"].includes(action.id)) {
        score += 1.5;
        breakdown.push({label:"♃ Jupiter Exalted", val:1.5, max:1.5, note:"Cancer — structural bull"});
      }

      // 9. Saturn debilitated penalty for rebalance
      if (action.id === "rebalance" && PLANET_CONTEXT.saturn.status === "debil") {
        score -= 0.5;
        breakdown.push({label:"Saturn Debil.", val:-0.5, max:0, note:"♄ Aries — use caution"});
      }

      // Normalise 0–10
      const rawMax = 14;
      const normalised = Math.max(0, Math.min(10, (score / rawMax) * 10));

      // Grade
      const grade = normalised >= 8.5 ? "EXCELLENT" : normalised >= 7 ? "GOOD" :
        normalised >= 5 ? "FAIR" : "AVOID";
      if (grade === "AVOID") continue;

      windows.push({
        date:dateStr, dow, slot:slot.label,
        windowStart:slot.start, windowEnd:slot.end,
        tithiId, yogaId, nakId, moonSignIdx,
        tithi, yoga, nak, moonSign,
        isAbhijit, rahuKala: rahuK,
        score:+normalised.toFixed(1),
        grade, breakdown,
        isWeekend: dow === 6,
      });
    }
  }

  // Sort by score desc, then date asc
  return windows.sort((a,b) => b.score - a.score || a.date.localeCompare(b.date)).slice(0,48);
}

const GRADE_COLORS = {EXCELLENT:C.gold, GOOD:C.green, FAIR:C.amber, AVOID:C.red};
const DOW_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function FinastroMuhurta() {
  const [selectedAction, setSelectedAction] = useState(ACTION_TYPES[0]);
  const [dateRange, setDateRange] = useState(30);
  const [selectedWindow, setSelectedWindow] = useState(null);
  const [viewMode, setViewMode] = useState("list"); // list | calendar
  const [filterGrade, setFilterGrade] = useState("all");
  const [computing, setComputing] = useState(false);
  const [windows, setWindows] = useState([]);

  const baseDate = "2026-05-04";

  useEffect(() => {
    setComputing(true);
    setSelectedWindow(null);
    setTimeout(() => {
      const w = generateMuhurtaWindows(selectedAction, baseDate);
      setWindows(w);
      setSelectedWindow(w[0] || null);
      setComputing(false);
    }, 300);
  }, [selectedAction, dateRange]);

  const filtered = windows.filter(w =>
    filterGrade === "all" ? true : w.grade === filterGrade
  );

  const top5 = windows.slice(0, 5);
  const excellentCount = windows.filter(w=>w.grade==="EXCELLENT").length;
  const goodCount = windows.filter(w=>w.grade==="GOOD").length;

  const st = {
    root:{fontFamily:"'DM Mono','Courier New',monospace", background:C.bg, color:C.text,
      minHeight:"100vh", fontSize:"13px"},
    card:{background:C.panel, border:`1px solid ${C.border}`, borderRadius:"4px", padding:"16px"},
    pill:(a,col)=>({padding:"5px 12px", borderRadius:"3px", cursor:"pointer", fontSize:"10px",
      letterSpacing:"0.06em", fontWeight:"600",
      border:`1px solid ${a?(col||C.gold)+"60":C.border}`,
      background:a?(col||C.gold)+"18":"transparent",
      color:a?(col||C.gold):C.textDim, transition:"all 0.15s"}),
    badge:(grade)=>({display:"inline-block", padding:"2px 8px", borderRadius:"3px",
      fontSize:"9px", fontWeight:"700", letterSpacing:"0.08em",
      background:GRADE_COLORS[grade]+"22",
      color:GRADE_COLORS[grade], border:`1px solid ${GRADE_COLORS[grade]}50`}),
  };

  return (
    <div style={st.root}>
      {/* HEADER */}
      <div style={{background:C.panel, borderBottom:`1px solid ${C.border}`,
        padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between"}}>
        <div>
          <div style={{fontFamily:"'Cinzel',serif", fontSize:"17px", color:C.gold,
            letterSpacing:"0.15em"}}>FINASTRO · MUHURTA SELECTION</div>
          <div style={{fontSize:"10px", color:C.textDim, letterSpacing:"0.1em"}}>
            Sprint 4 · Ujjain Reference · Lahiri Ayanamsa · 48-min Windows · IST
          </div>
        </div>
        <div style={{display:"flex", gap:"10px"}}>
          {[
            {l:"EXCELLENT",v:excellentCount,c:C.gold},
            {l:"GOOD",v:goodCount,c:C.green},
            {l:"WINDOWS",v:windows.length,c:C.teal},
          ].map(s=>(
            <div key={s.l} style={{background:C.bg, border:`1px solid ${C.border}`,
              borderRadius:"3px", padding:"5px 12px", textAlign:"center"}}>
              <div style={{fontSize:"9px", color:C.textDim, letterSpacing:"0.08em"}}>{s.l}</div>
              <div style={{fontSize:"16px", fontWeight:"700", color:s.c}}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PLANETARY CONTEXT BAR */}
      <div style={{background:"#0D1420", borderBottom:`1px solid ${C.border}`,
        padding:"7px 24px", display:"flex", gap:"16px", alignItems:"center",
        overflowX:"auto", flexWrap:"nowrap"}}>
        <span style={{fontSize:"10px", color:C.textDim, letterSpacing:"0.08em",
          flexShrink:0}}>MAY 2026:</span>
        {Object.entries(PLANET_CONTEXT).map(([p,ctx])=>(
          <span key={p} style={{fontSize:"10px", flexShrink:0,
            color:ctx.retro?C.red:ctx.status==="exalted"?C.gold:ctx.status==="debil"?C.amber:C.textMid}}>
            {p==="jupiter"?"♃":p==="venus"?"♀":p==="mercury"?"☿":p==="mars"?"♂":
             p==="saturn"?"♄":p==="sun"?"☉":p==="moon"?"☽":p==="rahu"?"☊":"♅"}{" "}
            {ctx.sign}{ctx.retro?" ℞":ctx.status==="exalted"?" ↑":ctx.status==="debil"?" ↓":""}
          </span>
        ))}
        <span style={{marginLeft:"auto", fontSize:"10px", color:C.teal, flexShrink:0}}>
          🔄 km_planetary_positions
        </span>
      </div>

      <div style={{padding:"20px 24px", display:"grid",
        gridTemplateColumns:"240px 1fr", gap:"16px"}}>

        {/* LEFT: Action selector */}
        <div>
          <div style={{fontSize:"9px", color:C.textDim, letterSpacing:"0.1em",
            marginBottom:"8px", padding:"0 4px"}}>SELECT ACTION TYPE</div>
          {ACTION_TYPES.map(at => (
            <div key={at.id} onClick={()=>setSelectedAction(at)}
              style={{padding:"11px 14px", cursor:"pointer", marginBottom:"4px",
                borderRadius:"4px", borderLeft:`3px solid ${selectedAction.id===at.id?at.color:C.border}`,
                background:selectedAction.id===at.id?"#1A2030":"transparent",
                transition:"all 0.1s"}}>
              <div style={{display:"flex", gap:"10px", alignItems:"center"}}>
                <span style={{fontSize:"16px", color:at.color, width:"24px",
                  textAlign:"center"}}>{at.icon}</span>
                <div>
                  <div style={{fontSize:"11px", fontWeight:"600",
                    color:selectedAction.id===at.id?C.text:C.textMid}}>{at.label}</div>
                  <div style={{fontSize:"9px", color:C.textDim, marginTop:"1px"}}>{at.desc}</div>
                </div>
              </div>
            </div>
          ))}

          {/* Date range */}
          <div style={{marginTop:"16px", padding:"12px 14px",
            background:C.panel, border:`1px solid ${C.border}`, borderRadius:"4px"}}>
            <div style={{fontSize:"9px", color:C.textDim, letterSpacing:"0.1em",
              marginBottom:"8px"}}>LOOK-AHEAD WINDOW</div>
            {[7,14,30].map(d=>(
              <button key={d} onClick={()=>setDateRange(d)}
                style={{...st.pill(dateRange===d), marginRight:"6px", marginBottom:"4px"}}>
                {d}d
              </button>
            ))}
            <div style={{marginTop:"8px", fontSize:"10px", color:C.textDim}}>
              Base: {baseDate}
            </div>
          </div>

          {/* Planetary boosts */}
          <div style={{marginTop:"12px", padding:"12px 14px",
            background:C.panel, border:`1px solid ${C.border}`, borderRadius:"4px"}}>
            <div style={{fontSize:"9px", color:C.textDim, letterSpacing:"0.1em",
              marginBottom:"8px"}}>ACTION REQUIREMENTS</div>
            <div style={{fontSize:"10px", color:C.textMid, lineHeight:"1.8"}}>
              <div>Tithi types: <span style={{color:selectedAction.color}}>
                {selectedAction.wants.tithiTypes.join(", ")}</span></div>
              <div>Moon elements: <span style={{color:selectedAction.color}}>
                {selectedAction.wants.moonElements.join(", ")}</span></div>
              <div>Planet boost: <span style={{color:selectedAction.color}}>
                {selectedAction.wants.planetBoost}</span></div>
              {selectedAction.wants.needsAbhijit &&
                <div style={{color:C.green}}>☀ Requires Abhijit</div>}
            </div>
          </div>
        </div>

        {/* RIGHT: Windows */}
        <div>
          {/* Controls */}
          <div style={{display:"flex", gap:"8px", marginBottom:"14px",
            alignItems:"center", flexWrap:"wrap"}}>
            <div style={{fontFamily:"'Cinzel',serif", fontSize:"13px", color:selectedAction.color,
              letterSpacing:"0.1em", marginRight:"8px"}}>
              {selectedAction.icon} {selectedAction.label}
            </div>
            {["all","EXCELLENT","GOOD","FAIR"].map(g=>(
              <button key={g} onClick={()=>setFilterGrade(g)}
                style={st.pill(filterGrade===g, g!=="all"?GRADE_COLORS[g]:C.gold)}>
                {g}
              </button>
            ))}
            <button onClick={()=>setViewMode(v=>v==="list"?"calendar":"list")}
              style={{...st.pill(false), marginLeft:"auto"}}>
              {viewMode==="list"?"◈ CALENDAR":"≡ LIST"}
            </button>
          </div>

          {computing ? (
            <div style={{...st.card, textAlign:"center", padding:"40px",
              color:C.textDim, fontSize:"12px"}}>
              Computing muhurta windows...
            </div>
          ) : viewMode === "list" ? (
            <div style={{display:"grid", gridTemplateColumns:"1fr 300px", gap:"14px"}}>
              {/* Window list */}
              <div>
                {/* Column headers */}
                <div style={{display:"grid",
                  gridTemplateColumns:"90px 80px 1fr 70px 70px 80px",
                  gap:"6px", padding:"6px 14px", fontSize:"9px", letterSpacing:"0.09em",
                  color:C.textDim, borderBottom:`1px solid ${C.border}`}}>
                  <span>DATE</span><span>WINDOW</span><span>PANCHANG</span>
                  <span>SCORE</span><span>GRADE</span><span>MOON</span>
                </div>
                <div style={{maxHeight:"520px", overflowY:"auto"}}>
                  {filtered.map((w,i)=>(
                    <div key={i} onClick={()=>setSelectedWindow(w)}
                      style={{display:"grid",
                        gridTemplateColumns:"90px 80px 1fr 70px 70px 80px",
                        gap:"6px", padding:"10px 14px", cursor:"pointer",
                        background:selectedWindow===w?"#1A2030":"transparent",
                        borderLeft:`3px solid ${selectedWindow===w?GRADE_COLORS[w.grade]:C.border}`,
                        borderBottom:`1px solid ${C.border}22`, alignItems:"center",
                        transition:"all 0.1s"}}>
                      <div>
                        <div style={{fontSize:"11px", color:C.text}}>
                          {w.date.slice(5)}</div>
                        <div style={{fontSize:"9px", color:C.textDim}}>
                          {DOW_LABELS[w.dow]}{w.isWeekend?" 🏖":""}</div>
                      </div>
                      <div>
                        <div style={{fontSize:"11px", color:C.teal}}>{w.windowStart}</div>
                        <div style={{fontSize:"9px", color:C.textDim}}>–{w.windowEnd}</div>
                      </div>
                      <div>
                        <div style={{fontSize:"10px", color:C.textMid}}>
                          {w.tithi.name} · {w.yoga.name}</div>
                        <div style={{fontSize:"9px", color:C.textDim}}>{w.nak.name}</div>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <ScoreDial score={w.score} size={32}/>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <span style={st.badge(w.grade)}>{w.grade}</span>
                      </div>
                      <div style={{fontSize:"10px", color:C.textMid}}>
                        {w.moonSign.name}
                        <div style={{fontSize:"9px", color:C.textDim}}>{w.moonSign.element}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detail panel */}
              {selectedWindow && (
                <WindowDetail w={selectedWindow} action={selectedAction}
                  st={st} top5={top5}/>
              )}
            </div>
          ) : (
            <CalendarView windows={filtered} action={selectedAction}
              st={st} baseDate={baseDate}
              onSelect={w=>{setSelectedWindow(w); setViewMode("list");}}/>
          )}

          {/* Top 5 summary */}
          {viewMode === "list" && (
            <div style={{...st.card, marginTop:"16px"}}>
              <div style={{fontFamily:"'Cinzel',serif", fontSize:"12px", color:C.gold,
                letterSpacing:"0.1em", marginBottom:"12px"}}>
                TOP 5 MUHURTA WINDOWS — {selectedAction.label}
              </div>
              <div style={{display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"10px"}}>
                {top5.map((w,i)=>(
                  <div key={i} onClick={()=>setSelectedWindow(w)}
                    style={{padding:"10px", borderRadius:"4px", cursor:"pointer",
                      background:"#0D1016",
                      border:`1px solid ${selectedWindow===w?GRADE_COLORS[w.grade]:C.border}`,
                      borderTop:`3px solid ${GRADE_COLORS[w.grade]}`,
                      transition:"all 0.1s", textAlign:"center"}}>
                    <div style={{fontSize:"9px", color:GRADE_COLORS[w.grade],
                      fontWeight:"700", letterSpacing:"0.08em",
                      marginBottom:"4px"}}>#{i+1}</div>
                    <div style={{fontSize:"12px", color:C.text,
                      marginBottom:"2px"}}>{w.date.slice(5)}</div>
                    <div style={{fontSize:"10px", color:C.teal,
                      marginBottom:"4px"}}>{w.windowStart}</div>
                    <div style={{fontSize:"18px", fontWeight:"700",
                      color:GRADE_COLORS[w.grade]}}>{w.score}</div>
                    <div style={{fontSize:"9px", color:C.textDim,
                      marginTop:"2px"}}>{w.tithi.name}</div>
                    <div style={{fontSize:"9px", color:C.textDim}}>{w.yoga.name}</div>
                    {w.isAbhijit && <div style={{fontSize:"9px",
                      color:C.green, marginTop:"2px"}}>☀ Abhijit</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SCORE DIAL ────────────────────────────────────────────────────────────
function ScoreDial({ score, size=48 }) {
  const r = size/2 - 4;
  const circ = 2 * Math.PI * r;
  const dash = (score/10) * circ;
  const color = score >= 8.5 ? C.gold : score >= 7 ? C.green : C.amber;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={C.border} strokeWidth="3"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth="3"
        strokeDasharray={`${dash} ${circ-dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <text x={size/2} y={size/2+4} textAnchor="middle"
        fontSize={size>40?"11":"8"} fontWeight="700" fill={color}>{score}</text>
    </svg>
  );
}

// ─── WINDOW DETAIL PANEL ───────────────────────────────────────────────────
function WindowDetail({ w, action, st, top5 }) {
  const rahuActive = w.rahuKala &&
    w.windowStart >= w.rahuKala.start && w.windowStart < w.rahuKala.end;

  return (
    <div style={{...st.card, position:"sticky", top:"20px"}}>
      {/* Grade header */}
      <div style={{background:GRADE_COLORS[w.grade]+"18",
        border:`1px solid ${GRADE_COLORS[w.grade]}40`,
        borderRadius:"3px", padding:"10px 14px", marginBottom:"14px",
        display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div>
          <div style={{fontFamily:"'Cinzel',serif", fontSize:"13px",
            color:GRADE_COLORS[w.grade], letterSpacing:"0.1em"}}>{w.grade}</div>
          <div style={{fontSize:"10px", color:C.textDim, marginTop:"2px"}}>
            {w.date} · {DOW_LABELS[w.dow]}
          </div>
        </div>
        <ScoreDial score={w.score} size={52}/>
      </div>

      {/* Time window */}
      <div style={{display:"flex", gap:"10px", marginBottom:"14px", alignItems:"center"}}>
        <div style={{flex:1, background:"#0D1016", padding:"10px", borderRadius:"3px",
          border:`1px solid ${C.tealDim}`, textAlign:"center"}}>
          <div style={{fontSize:"9px", color:C.textDim, letterSpacing:"0.08em",
            marginBottom:"3px"}}>WINDOW</div>
          <div style={{fontSize:"16px", color:C.teal, fontFamily:"monospace",
            fontWeight:"700"}}>{w.windowStart}</div>
          <div style={{fontSize:"11px", color:C.textDim}}>to {w.windowEnd}</div>
        </div>
        <div style={{flex:1, background:"#0D1016", padding:"10px", borderRadius:"3px",
          border:`1px solid ${C.border}`, textAlign:"center"}}>
          <div style={{fontSize:"9px", color:C.textDim, letterSpacing:"0.08em",
            marginBottom:"3px"}}>SLOT</div>
          <div style={{fontSize:"12px", color:C.textMid}}>{w.slot}</div>
          {w.isAbhijit && <div style={{fontSize:"10px", color:C.green,
            marginTop:"2px"}}>☀ Abhijit</div>}
        </div>
      </div>

      {/* Panchang grid */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px",
        marginBottom:"14px"}}>
        {[
          {l:"Tithi", v:`${w.tithi.name} (${w.tithi.type})`, c:w.tithi.quality>=2?C.green:C.amber},
          {l:"Yoga", v:w.yoga.name, c:w.yoga.quality>=2?C.green:w.yoga.quality===0?C.red:C.amber},
          {l:"Nakshatra", v:w.nak.name, c:C.textMid},
          {l:"Moon", v:`${w.moonSign.name} (${w.moonSign.element})`, c:C.textMid},
          {l:"Rahu Kala", v:w.rahuKala?`${w.rahuKala.start}–${w.rahuKala.end}`:"None",
            c:rahuActive?C.red:C.textDim},
          {l:"Day", v:DOW_LABELS[w.dow], c:C.textMid},
        ].map((item,i)=>(
          <div key={i} style={{background:"#0A0E14", padding:"7px", borderRadius:"3px",
            border:`1px solid ${C.border}`}}>
            <div style={{fontSize:"8px", color:C.textDim, letterSpacing:"0.07em",
              marginBottom:"2px"}}>{item.l}</div>
            <div style={{fontSize:"11px", fontWeight:"600", color:item.c}}>{item.v}</div>
          </div>
        ))}
      </div>

      {/* Score breakdown */}
      <div style={{marginBottom:"14px"}}>
        <div style={{fontSize:"9px", color:C.textDim, letterSpacing:"0.08em",
          marginBottom:"8px"}}>SCORE BREAKDOWN</div>
        {w.breakdown.map((b,i)=>{
          const isNeg = b.val < 0;
          const pct = b.max > 0 ? Math.min(100, (b.val / b.max) * 100) : 0;
          return (
            <div key={i} style={{display:"grid",
              gridTemplateColumns:"100px 1fr 36px 50px",
              gap:"6px", marginBottom:"5px", alignItems:"center"}}>
              <div style={{fontSize:"9px", color:C.textDim}}>{b.label}</div>
              <div style={{background:C.border, height:"5px", borderRadius:"3px",
                overflow:"hidden"}}>
                {pct > 0 && <div style={{height:"100%", borderRadius:"3px",
                  background:isNeg?C.red:b.val>=b.max*0.8?C.green:C.amber,
                  width:`${pct}%`}}/>}
              </div>
              <div style={{fontSize:"10px", textAlign:"right",
                color:isNeg?C.red:b.val>0?C.green:C.textDim,
                fontWeight:"700"}}>
                {b.val>0?"+":""}{b.val}
              </div>
              <div style={{fontSize:"8px", color:C.textDim,
                overflow:"hidden", textOverflow:"ellipsis",
                whiteSpace:"nowrap"}}>{b.note}</div>
            </div>
          );
        })}
        <div style={{borderTop:`1px solid ${C.border}`, paddingTop:"6px",
          display:"flex", justifyContent:"flex-end", alignItems:"center", gap:"8px"}}>
          <span style={{fontSize:"10px", color:C.textDim}}>TOTAL SCORE</span>
          <span style={{fontSize:"16px", fontWeight:"700",
            color:GRADE_COLORS[w.grade]}}>{w.score} / 10</span>
        </div>
      </div>

      {/* Action guidance */}
      <div style={{background:action.color+"12",
        border:`1px solid ${action.color}40`, borderRadius:"3px",
        padding:"10px", marginBottom:"12px", fontSize:"10px",
        color:C.textMid, lineHeight:"1.7"}}>
        <strong style={{color:action.color}}>{action.icon} {action.label}</strong>
        {w.grade==="EXCELLENT" && " — Optimal window. All conditions aligned. Execute with full conviction."}
        {w.grade==="GOOD" && " — Strong window. Most conditions favourable. Standard execution."}
        {w.grade==="FAIR" && " — Acceptable window. Some conditions mixed. Use reduced size."}
        {PLANET_CONTEXT.mercury.retro && ["new_position","large_trade","ipo_sub","demat_open"].includes(action.id) &&
          <div style={{color:C.amber, marginTop:"4px"}}>
            ⚠ Mercury Retro active — execution risk. Confirm orders carefully.
          </div>}
        {PLANET_CONTEXT.jupiter.status==="exalted" && !PLANET_CONTEXT.jupiter.retro &&
          <div style={{color:C.gold, marginTop:"4px"}}>
            ♃ Jupiter exalted in Cancer — structural bull support. Score boosted.
          </div>}
      </div>

      <div style={{padding:"7px 10px", background:"#0A1020",
        border:`1px dashed ${C.teal}40`, borderRadius:"3px",
        fontSize:"9px", color:C.teal}}>
        🔄 LIVE — reads <code>km_daily_panchang</code> · <code>km_planetary_positions</code>
        · writes selection to <code>km_finastro_muhurta</code>
      </div>
    </div>
  );
}

// ─── CALENDAR VIEW ─────────────────────────────────────────────────────────
function CalendarView({ windows, action, st, baseDate, onSelect }) {
  const byDate = {};
  windows.forEach(w => {
    if (!byDate[w.date]) byDate[w.date] = [];
    byDate[w.date].push(w);
  });

  // Build May and June grids
  const months = [
    {year:2026, month:4, label:"May 2026"},
    {year:2026, month:5, label:"June 2026"},
  ];

  return (
    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px"}}>
      {months.map(({year,month,label})=>{
        const firstDay = new Date(year,month,1).getDay();
        const daysInMonth = new Date(year,month+1,0).getDate();
        const cells = [];
        for (let i=0;i<firstDay;i++) cells.push(null);
        for (let d=1;d<=daysInMonth;d++){
          const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          cells.push({dateStr,day:d,wins:byDate[dateStr]||[]});
        }
        return (
          <div key={label} style={st.card}>
            <div style={{fontFamily:"'Cinzel',serif", fontSize:"12px", color:C.gold,
              letterSpacing:"0.1em", marginBottom:"10px"}}>{label}</div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(7,1fr)",
              gap:"2px", marginBottom:"3px"}}>
              {["S","M","T","W","T","F","S"].map((d,i)=>(
                <div key={i} style={{textAlign:"center", fontSize:"9px",
                  color:C.textDim, padding:"3px 0"}}>{d}</div>
              ))}
            </div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"2px"}}>
              {cells.map((cell,i)=>{
                if (!cell) return <div key={i}/>;
                const {dateStr,day,wins} = cell;
                const best = wins[0];
                const bg = best
                  ? GRADE_COLORS[best.grade]+"33"
                  : C.border+"22";
                const border = best
                  ? `1px solid ${GRADE_COLORS[best.grade]}60`
                  : `1px solid ${C.border}22`;
                return (
                  <div key={i} onClick={()=>best&&onSelect(best)}
                    style={{aspectRatio:"1", borderRadius:"3px", background:bg,
                      border, cursor:best?"pointer":"default",
                      display:"flex", flexDirection:"column",
                      alignItems:"center", justifyContent:"center", position:"relative"}}>
                    <div style={{fontSize:"9px", color:best?C.text:C.textDim,
                      fontWeight:best?"700":"400"}}>{day}</div>
                    {best && (
                      <div style={{fontSize:"7px", fontWeight:"700",
                        color:GRADE_COLORS[best.grade]}}>{best.score}</div>
                    )}
                    {wins.length > 1 && (
                      <div style={{position:"absolute", top:"1px", right:"2px",
                        fontSize:"6px", color:C.textDim}}>×{wins.length}</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex", gap:"8px", marginTop:"8px",
              fontSize:"9px", color:C.textDim, flexWrap:"wrap"}}>
              {[["EXCELLENT",C.gold],["GOOD",C.green],["FAIR",C.amber]].map(([g,c])=>(
                <span key={g} style={{display:"flex",alignItems:"center",gap:"3px"}}>
                  <span style={{width:"8px",height:"8px",background:c+"33",
                    border:`1px solid ${c}60`,borderRadius:"1px",display:"inline-block"}}/>
                  {g}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
