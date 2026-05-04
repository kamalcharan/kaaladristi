import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// FINASTRO — DASHBOARD v2: UNIFIED SHELL
// File: finastro_dashboard_v2.jsx  [Sprint 7]
//
// TABS:
//   1. TODAY       → Screen 1 v3 (intraday cockpit + all 4 indicators)
//   2. WEEKLY      → Screen 2 (swing plan)
//   3. MONTHLY     → Screen 3 (calendar)
//   4. SCREENER    → Screen 4 v3 (signal screener + LP)
//   5. ⚡ LP BRIDGE → finastro_luckypop (conflict engine)
//   6. CORRELATION → Sprint 1
//   7. BACKTEST    → Sprint 2
//   8. ALERTS      → Sprint 3
//   9. MUHURTA     → Sprint 4
//
// SHARED:
//   · Single header with live clock, Rahu/Abhijit status, LP bell
//   · Panchang context strip (persists across all tabs)
//   · Alert count badge on bell
//   · LP signal flash notification
//   · Planetary context bar
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

// ─── PANCHANG (shared across all tabs) ────────────────────────────────────
const PANCHANG = {
  date:"2026-05-04", vaar:"Monday",
  sessionQuality:2, qualityLabel:"NEUTRAL",
  tithi:"Ekadashi", yoga:"Siddhi", yogaQuality:3,
  nakshatra:"Pushya", moonSign:"Cancer", moonElement:"Water",
  moonPhase:0.72,
  rahuKala:{ start:"10:30", end:"12:00" },
  abhijit:{ start:"11:48", end:"12:36" },
  tithiChange:"13:40", yogaChange:"09:50",
  jupiterCancer:true, mercuryRetro:true,
};

const PLANETS = [
  { sym:"♃", name:"Jupiter", pos:"Cancer", status:"exalted", retro:false,  color:C.gold  },
  { sym:"☿", name:"Mercury", pos:"Gemini", status:"retro",   retro:true,   color:C.amber },
  { sym:"♀", name:"Venus",   pos:"Taurus", status:"direct",  retro:false,  color:C.green },
  { sym:"♂", name:"Mars",    pos:"Cancer", status:"debil",   retro:false,  color:C.red   },
  { sym:"♄", name:"Saturn",  pos:"Aries",  status:"debil",   retro:false,  color:C.amberDim },
  { sym:"☉", name:"Sun",     pos:"Taurus", status:"normal",  retro:false,  color:C.amber },
  { sym:"☊", name:"Rahu",    pos:"Pisces", status:"normal",  retro:true,   color:C.purple},
  { sym:"♅", name:"Herschel",pos:"Gemini", status:"normal",  retro:false,  color:C.textDim },
];

const LP_SCORES = {
  "POWER BUY":10,"STRONG BUY":9,"BUY CONFIRMED":8,"BUY":7,
  "BUY BOOK FAST":6,"ACCUMULATION":5,"SCALP ONLY":4,
  "CAUTION":3,"WAIT":2,"AVOID":1,"NO TRADE":0,
  "POWER SELL":-10,"STRONG SELL":-9,"SELL":-8,
  "SELL BOOK FAST":-7,"SCALP SHORT":-6,"DISTRIBUTION":-5,"SQUEEZE RISK":-4,
};
const lpColor = (sig) => {
  const s = LP_SCORES[sig] ?? 0;
  if (s >= 9) return C.green; if (s >= 7) return "#6DD68A";
  if (s >= 5) return C.teal;  if (s > 0)  return C.amber;
  if (s <= -9) return C.red;  if (s <= -6) return "#E07070";
  if (s < 0)  return C.amber; return C.textDim;
};

const toMins = (t) => { const [h,m]=t.split(":").map(Number); return h*60+m; };
const toTime = (m) => `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;

// ─── MOCK ALERT FEED ───────────────────────────────────────────────────────
const MOCK_ALERTS = [
  { id:1, title:"✦ FAVORABLE SESSION", priority:"HIGH",   read:false, ts:"08:45", source:"panchang" },
  { id:2, title:"★ SBIBANK SCORE 9.1",  priority:"HIGH",   read:false, ts:"09:22", source:"condition" },
  { id:3, title:"☊ RAHU KALA IN 8 MIN", priority:"CRITICAL",read:false,ts:"10:22", source:"time" },
  { id:4, title:"▲▲ LP+FIN ALIGNED — SBIBANK",priority:"HIGH",read:false,ts:"11:52",source:"condition"},
  { id:5, title:"☀ ABHIJIT IN 8 MIN",   priority:"HIGH",   read:true,  ts:"11:40", source:"time" },
  { id:6, title:"⚠ CONFLICT — TCS BUY", priority:"CRITICAL",read:true, ts:"14:10", source:"condition"},
];

// ─── LP DEMO CYCLE ─────────────────────────────────────────────────────────
const LP_CYCLE = [
  { signal:"STRONG BUY", score:9, dot:"SVD", symbol:"SBIBANK",   rvol:1.82 },
  { signal:"POWER BUY",  score:10,dot:"NONE",symbol:"SUNPHARMA", rvol:2.14 },
  { signal:"NO TRADE",   score:0, dot:"NONE",symbol:"RELIANCE",  rvol:0.72 },
  { signal:"SELL",       score:-8,dot:"SYD", symbol:"TCS",       rvol:1.56 },
  { signal:"BUY",        score:7, dot:"SBD", symbol:"HINDUNILVR",rvol:1.24 },
];

// ─── TAB DEFINITIONS ──────────────────────────────────────────────────────
const TABS = [
  { id:"today",       icon:"◎", label:"TODAY",       subtitle:"Intraday Cockpit",    sprint:"Screen 1 v3" },
  { id:"weekly",      icon:"≡", label:"WEEKLY",      subtitle:"Swing Plan",          sprint:"Screen 2"    },
  { id:"monthly",     icon:"◈", label:"MONTHLY",     subtitle:"Calendar View",       sprint:"Screen 3"    },
  { id:"screener",    icon:"⬡", label:"SCREENER",    subtitle:"Signal Screener",     sprint:"Screen 4 v3" },
  { id:"lp",          icon:"⚡", label:"LP BRIDGE",   subtitle:"LuckyPop Conflict",   sprint:"Sprint 5"    },
  { id:"correlation", icon:"∿", label:"CORRELATION", subtitle:"Signal Validation",   sprint:"Sprint 1"    },
  { id:"backtest",    icon:"▶", label:"BACKTEST",    subtitle:"Signal Performance",  sprint:"Sprint 2"    },
  { id:"alerts",      icon:"🔔", label:"ALERTS",      subtitle:"Alert Feed",          sprint:"Sprint 3"    },
  { id:"muhurta",     icon:"☉", label:"MUHURTA",     subtitle:"Timing Selection",    sprint:"Sprint 4"    },
];

// ─── SHARED MICRO STYLES ───────────────────────────────────────────────────
const pnl = (x={}) => ({ background:C.panel, border:`1px solid ${C.border}`, borderRadius:"4px", padding:"12px", ...x });

// ═══════════════════════════════════════════════════════════════════════════
// INLINE SCREEN COMPONENTS (self-contained, no imports needed)
// ═══════════════════════════════════════════════════════════════════════════

// ─── TODAY MINI (Screen 1 summary embedded) ────────────────────────────────
function TodayScreen({ panchang, nowMins, nowIST, inRahu, inAbhijit, lpState }) {
  const candles = useRef(buildCandles(panchang.sessionQuality)).current;
  const rahuS = toMins(panchang.rahuKala.start), rahuE = toMins(panchang.rahuKala.end);
  const abhS  = toMins(panchang.abhijit.start),  abhE  = toMins(panchang.abhijit.end);
  const qualColor = [C.red,C.amber,C.amber,C.green][panchang.sessionQuality];

  // Confluence
  const techScore = Math.max(0,lpState.score/10)*6;
  const panScore  = inRahu?0:panchang.sessionQuality===3?2:panchang.sessionQuality===2?1.2:0.5;
  const abhBonus  = inAbhijit?0.8:0;
  const planScore = (panchang.jupiterCancer?1.5:1.0)+(panchang.mercuryRetro?-0.5:0);
  const conf = +Math.min(10, techScore*0.6+(panScore+abhBonus)*0.2+Math.max(0,planScore)*0.2).toFixed(1);
  const confColor = conf>=7.5?C.gold:conf>=6?C.green:conf>=4?C.amber:C.red;

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:"14px", padding:"16px" }}>
      {/* Left: chart + key metrics */}
      <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
        {/* Key metric strip */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:"8px" }}>
          {[
            { l:"SESSION", v:["AVOID","CAUTION","NEUTRAL","FAV"][panchang.sessionQuality],
              c:qualColor },
            { l:"YOGA",    v:panchang.yoga, c:C.green },
            { l:"TITHI",   v:panchang.tithi, c:C.textMid },
            { l:"MOON",    v:`${panchang.moonSign} (${panchang.moonElement})`, c:C.teal },
            { l:"RAHU ☊",  v:panchang.rahuKala.start+"–"+panchang.rahuKala.end,
              c:inRahu?C.red:C.textDim },
            { l:"ABHIJIT ☀",v:panchang.abhijit.start+"–"+panchang.abhijit.end,
              c:inAbhijit?C.green:C.textDim },
          ].map((m,i) => (
            <div key={i} style={pnl({ padding:"8px", textAlign:"center",
              background:i===4&&inRahu?C.redDim+"33":i===5&&inAbhijit?C.greenDim+"33":C.panel,
              border:`1px solid ${i===4&&inRahu?C.red+"50":i===5&&inAbhijit?C.green+"50":C.border}` })}>
              <div style={{ fontSize:"8px", color:C.textDim, marginBottom:"3px" }}>{m.l}</div>
              <div style={{ fontSize:"10px", color:m.c, fontWeight:"700" }}>{m.v}</div>
              {i===4&&inRahu&&<div style={{ fontSize:"8px",color:C.red,fontWeight:"700" }}>ACTIVE</div>}
              {i===5&&inAbhijit&&<div style={{ fontSize:"8px",color:C.green,fontWeight:"700" }}>ACTIVE</div>}
            </div>
          ))}
        </div>

        {/* Candlestick */}
        <div style={pnl({ padding:"10px" })}>
          <div style={{ fontSize:"8px", color:C.textDim, letterSpacing:"0.08em",
            marginBottom:"6px", display:"flex", justifyContent:"space-between" }}>
            <span>NIFTY 50 · 5MIN · TODAY</span>
            <span style={{ color:C.gold }}>{toTime(nowMins)} IST</span>
          </div>
          <CandleChart candles={candles} nowMins={nowMins}
            rahuS={rahuS} rahuE={rahuE} abhS={abhS} abhE={abhE}
            yogaChange={panchang.yogaChange} tithiChange={panchang.tithiChange}/>
          {/* Volume */}
          <VolBars candles={candles} nowMins={nowMins} rahuS={rahuS} rahuE={rahuE}/>
          {/* Time axis */}
          <div style={{ display:"flex", justifyContent:"space-between",
            fontSize:"7px", color:C.textDim, marginTop:"2px" }}>
            {["09:15","10:00","11:00","12:00","13:00","14:00","15:00","15:30"]
              .map(t=><span key={t}>{t}</span>)}
          </div>
        </div>

        {/* Upcoming events */}
        <div style={pnl()}>
          <div style={{ fontSize:"8px", color:C.textDim, letterSpacing:"0.1em",
            marginBottom:"8px" }}>UPCOMING EVENTS</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"6px" }}>
            {[
              {time:"09:50",label:"Yoga → Variyana",color:C.amber},
              {time:"10:30",label:"Rahu Kala opens",color:C.red},
              {time:"11:48",label:"Abhijit opens",  color:C.green},
              {time:"12:00",label:"Rahu closes",    color:C.amber},
              {time:"12:36",label:"Abhijit closes", color:C.green},
              {time:"13:40",label:"Tithi → Dwadashi",color:C.gold},
            ].map((e,i)=>(
              <div key={i} style={{ display:"flex", gap:"6px", fontSize:"10px",
                alignItems:"center", padding:"4px 0",
                borderBottom:`1px solid ${C.border}22` }}>
                <span style={{ color:C.textDim, fontFamily:"monospace",
                  flexShrink:0, fontSize:"9px" }}>{e.time}</span>
                <span style={{ color:e.color, fontSize:"9px" }}>{e.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
        {/* Confluence dial */}
        <div style={pnl({ textAlign:"center", padding:"16px" })}>
          <DialSVG score={conf} size={72}/>
          <div style={{ fontSize:"8px", color:C.textDim,
            letterSpacing:"0.1em", marginTop:"4px" }}>CONFLUENCE</div>
          <div style={{ fontSize:"10px", color:confColor,
            marginTop:"2px" }}>
            {conf>=7.5?"EXCELLENT":conf>=6?"GOOD":conf>=4?"FAIR":"LOW"}
          </div>
        </div>

        {/* LP+FIN badge */}
        <LPFinMini lpState={lpState} panchang={panchang}
          inRahu={inRahu} inAbhijit={inAbhijit} combined={conf}/>

        {/* Planets */}
        <div style={pnl()}>
          <div style={{ fontSize:"8px", color:C.textDim,
            letterSpacing:"0.1em", marginBottom:"8px" }}>PLANETS</div>
          {PLANETS.map((p,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:"space-between",
              padding:"3px 0", borderBottom:`1px solid ${C.border}22`,
              fontSize:"10px" }}>
              <span style={{ color:C.textDim }}>{p.sym} {p.name}</span>
              <span style={{ color:p.color }}>
                {p.pos}{p.retro?" ℞":p.status==="exalted"?" ↑":p.status==="debil"?" ↓":""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── WEEKLY SCREEN (compact swing view) ───────────────────────────────────
function WeeklyScreen({ panchang }) {
  const days = [
    { date:"2026-05-04",vaar:"Mon",sq:2,yoga:"Siddhi",  tithi:"Ekadashi",signals:3,bias:"BULLISH" },
    { date:"2026-05-05",vaar:"Tue",sq:3,yoga:"Variyana",tithi:"Dwadashi", signals:5,bias:"BULLISH" },
    { date:"2026-05-06",vaar:"Wed",sq:2,yoga:"Parigha",  tithi:"Trayodashi",signals:2,bias:"NEUTRAL"},
    { date:"2026-05-07",vaar:"Thu",sq:1,yoga:"Shiva",   tithi:"Chaturdashi",signals:1,bias:"CAUTION"},
    { date:"2026-05-08",vaar:"Fri",sq:2,yoga:"Siddha",  tithi:"Purnima",  signals:4,bias:"BULLISH" },
    { date:"2026-05-11",vaar:"Mon",sq:1,yoga:"Vishkambha",tithi:"Pratipada",signals:1,bias:"CAUTION"},
    { date:"2026-05-12",vaar:"Tue",sq:3,yoga:"Priti",   tithi:"Dwitiya",  signals:6,bias:"BULLISH" },
  ];
  const sqColor = [C.red,C.amber,C.amber,C.green];
  const sqLabel = ["AVOID","CAUTION","NEUTRAL","FAVORABLE"];

  return (
    <div style={{ padding:"16px" }}>
      <div style={{ fontFamily:"'Cinzel',serif", fontSize:"13px", color:C.gold,
        letterSpacing:"0.1em", marginBottom:"14px" }}>WEEKLY SWING PLAN — May 4–12, 2026</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"8px" }}>
        {days.map((d,i)=>{
          const isToday = d.date === panchang.date;
          const sc = sqColor[d.sq];
          return (
            <div key={i} style={{ ...pnl({ padding:"10px" }),
              borderTop:`3px solid ${sc}`,
              background:isToday?"#141820":C.panel }}>
              <div style={{ fontSize:"9px", color:isToday?C.gold:C.textDim,
                fontWeight:isToday?"700":"400",
                marginBottom:"4px" }}>{d.vaar} {d.date.slice(5)}</div>
              <div style={{ fontSize:"11px", fontWeight:"700",
                color:sc, marginBottom:"4px" }}>{sqLabel[d.sq]}</div>
              <div style={{ fontSize:"9px", color:C.textMid,
                marginBottom:"2px" }}>{d.yoga}</div>
              <div style={{ fontSize:"9px", color:C.textDim,
                marginBottom:"6px" }}>{d.tithi}</div>
              <div style={{ display:"flex", gap:"3px" }}>
                {Array(6).fill(0).map((_,j)=>(
                  <div key={j} style={{ flex:1, height:"4px",
                    borderRadius:"2px",
                    background:j<d.signals?sc:C.border }}/>
                ))}
              </div>
              <div style={{ fontSize:"8px", color:sc,
                marginTop:"3px" }}>{d.signals} signals</div>
              {isToday&&<div style={{ fontSize:"8px",color:C.gold,
                marginTop:"3px",fontWeight:"700" }}>◉ TODAY</div>}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop:"12px", ...pnl({ padding:"10px" }),
        fontSize:"10px", color:C.textDim, lineHeight:"1.7" }}>
        🔄 Full Screen 2 v2 in <code style={{ color:C.teal }}>finastro_screen2_v2.jsx</code> —
        this is the dashboard summary view. Click any day for full PLAN / REVIEW detail.
      </div>
    </div>
  );
}

// ─── MONTHLY SCREEN ────────────────────────────────────────────────────────
function MonthlyScreen({ panchang }) {
  const [month, setMonth] = useState(4); // May = index 4
  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const year = 2026;
  const firstDay = new Date(year,month,1).getDay();
  const daysInMonth = new Date(year,month+1,0).getDate();

  // Generate synthetic panchang for each day
  const dayData = {};
  for (let d=1; d<=daysInMonth; d++) {
    const seed = d * 7 + month * 3;
    const sq = ((seed*13)%4);
    const signals = ((seed*7)%7);
    dayData[d] = { sq, signals };
  }
  const sqColor = [C.red,C.amberDim,C.amber,C.green];
  const today = panchang.date === `${year}-${String(month+1).padStart(2,"0")}-04` ? 4 : null;

  return (
    <div style={{ padding:"16px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"14px" }}>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:"13px",
          color:C.gold, letterSpacing:"0.1em" }}>
          MONTHLY CALENDAR — {MONTH_NAMES[month]} {year}
        </div>
        <div style={{ display:"flex", gap:"6px" }}>
          {MONTH_NAMES.map((m,i)=>(
            <button key={i} onClick={()=>setMonth(i)}
              style={{ padding:"3px 8px", borderRadius:"3px",
                cursor:"pointer", fontSize:"9px",
                background:month===i?C.gold+"22":"transparent",
                border:`1px solid ${month===i?C.gold+"60":C.border}`,
                color:month===i?C.gold:C.textDim }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"2px",
        marginBottom:"4px" }}>
        {["S","M","T","W","T","F","S"].map((d,i)=>(
          <div key={i} style={{ textAlign:"center", fontSize:"9px",
            color:C.textDim, padding:"3px 0" }}>{d}</div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"2px" }}>
        {Array(firstDay).fill(null).map((_,i)=><div key={`e${i}`}/>)}
        {Array(daysInMonth).fill(0).map((_,i)=>{
          const d = i+1;
          const data = dayData[d];
          const col = sqColor[data.sq];
          const isToday = d === today;
          const dow = (firstDay+i)%7;
          const isWeekend = dow===0||dow===6;
          return (
            <div key={d} style={{ aspectRatio:"1", borderRadius:"3px",
              background:isToday?"#1A2030":isWeekend?C.bg:col+"20",
              border:`1px solid ${isToday?C.gold:isWeekend?C.border:col+"40"}`,
              display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center" }}>
              <div style={{ fontSize:"9px", fontWeight:isToday?"700":"400",
                color:isToday?C.gold:isWeekend?C.textDim+"60":C.text }}>{d}</div>
              {!isWeekend&&(
                <div style={{ display:"flex", gap:"1px", marginTop:"2px" }}>
                  {Array(Math.min(3,data.signals)).fill(0).map((_,j)=>(
                    <div key={j} style={{ width:"3px", height:"3px",
                      borderRadius:"50%", background:col }}/>
                  ))}
                </div>
              )}
              {isToday&&<div style={{ fontSize:"7px",color:C.gold }}>●</div>}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop:"10px", display:"flex", gap:"10px",
        fontSize:"9px", color:C.textDim }}>
        {[["FAVORABLE",C.green],["NEUTRAL",C.amber],["CAUTION",C.amberDim],["AVOID",C.red]]
          .map(([l,c])=>(
            <span key={l} style={{ display:"flex", alignItems:"center", gap:"4px" }}>
              <span style={{ width:"8px", height:"8px", borderRadius:"2px",
                background:c+"30", border:`1px solid ${c}50`,
                display:"inline-block" }}/>
              {l}
            </span>
          ))}
        <span style={{ marginLeft:"auto", color:C.teal }}>
          🔄 km_astro_calendar_2026 · km_daily_panchang
        </span>
      </div>
    </div>
  );
}

// ─── SCREENER MINI (Summary of Screen 4 v3) ───────────────────────────────
function ScreenerMini({ panchang, inRahu, inAbhijit, nowIST }) {
  const stocks = [
    { symbol:"SBIBANK",   sector:"PSU Banks",phase:"LEADING",     score:8.4, lp:"STRONG BUY",  lpS:9,  conf:"▲▲ ALIGNED", confC:C.gold  },
    { symbol:"SUNPHARMA", sector:"Pharma",   phase:"PEAKING",     score:7.8, lp:"POWER BUY",   lpS:10, conf:"▲▲ ALIGNED", confC:C.gold  },
    { symbol:"BRITANNIA", sector:"FMCG",     phase:"ENTERING",    score:7.2, lp:"BUY CONFIRMED",lpS:8, conf:"▲ PARTIAL",  confC:C.green },
    { symbol:"AXISBANK",  sector:"Pvt Banks",phase:"ENTERING",    score:7.6, lp:"STRONG BUY",  lpS:9,  conf:"▲ PARTIAL",  confC:C.green },
    { symbol:"TCS",       sector:"IT",       phase:"ROTATING OUT",score:4.1, lp:"SELL",         lpS:-8, conf:"▼▼ BEAR",   confC:C.red   },
    { symbol:"INFY",      sector:"IT",       phase:"ROTATING OUT",score:3.8, lp:"STRONG SELL",  lpS:-9, conf:"▼▼ BEAR",   confC:C.red   },
    { symbol:"RELIANCE",  sector:"Energy",   phase:"NEGLECTED",   score:3.2, lp:"CAUTION",      lpS:3,  conf:"○ LP ONLY", confC:C.textMid},
  ];
  const PHASE_COLORS = {ENTERING:C.teal,LEADING:C.green,PEAKING:C.gold,"ROTATING OUT":C.amber,NEGLECTED:C.red};

  return (
    <div style={{ padding:"14px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginBottom:"10px" }}>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:"13px",
          color:C.gold, letterSpacing:"0.1em" }}>SIGNAL SCREENER — TOP PICKS</div>
        <div style={{ fontSize:"9px", color:C.teal }}>
          🔄 Full screener → Screen 4 v3 tab
        </div>
      </div>
      {/* Header */}
      <div style={{ display:"grid",
        gridTemplateColumns:"100px 90px 130px 70px 100px 100px",
        gap:"6px", padding:"5px 10px", fontSize:"8px",
        letterSpacing:"0.09em", color:C.textDim,
        borderBottom:`1px solid ${C.border}` }}>
        <span>SYMBOL</span><span>SECTOR</span>
        <span>PHASE</span><span style={{color:C.gold}}>SCORE</span>
        <span style={{color:C.purple}}>LP</span>
        <span style={{color:C.gold}}>CONFLUENCE</span>
      </div>
      {stocks.map((s,i)=>(
        <div key={i} style={{ display:"grid",
          gridTemplateColumns:"100px 90px 130px 70px 100px 100px",
          gap:"6px", padding:"8px 10px",
          borderBottom:`1px solid ${C.border}22`,
          alignItems:"center",
          background:i%2===0?"#0B0D11":C.bg }}>
          <div style={{ fontSize:"11px", color:C.text, fontWeight:"700" }}>{s.symbol}</div>
          <div style={{ fontSize:"9px", color:C.textMid }}>{s.sector}</div>
          <div style={{ fontSize:"9px", color:PHASE_COLORS[s.phase] }}>{s.phase}</div>
          <div>
            <DialSVG score={s.score} size={32}/>
          </div>
          <div style={{ fontSize:"10px", fontWeight:"700",
            color:lpColor(s.lp) }}>{s.lp}</div>
          <div style={{ fontSize:"10px", fontWeight:"700",
            color:s.confC }}>{s.conf}</div>
        </div>
      ))}
    </div>
  );
}

// ─── LP BRIDGE MINI ────────────────────────────────────────────────────────
function LPBridgeMini({ lpState, panchang, inRahu, inAbhijit }) {
  const FEED = [
    { symbol:"SBIBANK",  signal:"STRONG BUY", score:9,  dot:"SVD", rvol:1.82,
      verdict:"▲▲ ALIGNED", color:C.gold, ts:"09:22" },
    { symbol:"SUNPHARMA",signal:"POWER BUY",  score:10, dot:"SVD", rvol:2.14,
      verdict:"▲▲ ALIGNED", color:C.gold, ts:"11:52" },
    { symbol:"TCS",      signal:"SELL",        score:-8, dot:"SYD", rvol:1.56,
      verdict:"▼▼ BEAR ALIGNED", color:C.red, ts:"10:31" },
    { symbol:"RELIANCE", signal:"CAUTION",     score:3,  dot:"NONE",rvol:0.82,
      verdict:"○ LP ONLY",  color:C.textMid, ts:"10:55" },
    { symbol:"HINDUNILVR",signal:"BUY",        score:7,  dot:"SBD", rvol:1.24,
      verdict:"▲ PARTIAL",  color:C.green, ts:"13:45" },
  ];

  return (
    <div style={{ padding:"14px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginBottom:"10px" }}>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:"13px",
          color:C.gold, letterSpacing:"0.1em" }}>LP BRIDGE — SIGNAL FEED</div>
        <div style={{ fontSize:"9px", color:C.teal }}>
          🔄 Full bridge → LP Bridge tab
        </div>
      </div>
      <div style={{ display:"grid",
        gridTemplateColumns:"100px 130px 70px 70px 60px 1fr",
        gap:"6px", padding:"5px 10px", fontSize:"8px",
        letterSpacing:"0.09em", color:C.textDim,
        borderBottom:`1px solid ${C.border}` }}>
        <span>TIME</span><span>SYMBOL</span>
        <span>LP SIGNAL</span><span>SCORE</span>
        <span>RVOL</span><span>VERDICT</span>
      </div>
      {FEED.map((f,i)=>(
        <div key={i} style={{ display:"grid",
          gridTemplateColumns:"100px 130px 70px 70px 60px 1fr",
          gap:"6px", padding:"8px 10px",
          borderBottom:`1px solid ${C.border}22`,
          alignItems:"center",
          background:i%2===0?"#0B0D11":C.bg,
          borderLeft:`3px solid ${i===0?C.gold:"transparent"}` }}>
          <span style={{ fontSize:"9px", color:C.textDim,
            fontFamily:"monospace" }}>{f.ts}</span>
          <span style={{ fontSize:"11px", fontWeight:"700",
            color:C.text }}>{f.symbol}</span>
          <span style={{ fontSize:"10px", fontWeight:"700",
            color:lpColor(f.signal) }}>{f.signal}</span>
          <span style={{ fontSize:"11px", fontWeight:"700",
            color:lpColor(f.signal) }}>
            {f.score>0?"+":""}{f.score}
          </span>
          <span style={{ fontSize:"10px",
            color:f.rvol>=1.5?C.green:C.amber }}>{f.rvol}x</span>
          <span style={{ fontSize:"10px", fontWeight:"700",
            color:f.color }}>{f.verdict}</span>
        </div>
      ))}
      <div style={{ marginTop:"10px", ...pnl({ padding:"8px",
        border:`1px dashed ${C.teal}40`, background:"#0A1020" }),
        fontSize:"9px", color:C.teal }}>
        ⚡ Live feed → POST /luckypop/signal on FastAPI :8101 · DB: km_finastro_alerts
      </div>
    </div>
  );
}

// ─── CORRELATION MINI ──────────────────────────────────────────────────────
function CorrelationMini() {
  const signals = [
    { id:"panchang_favorable", label:"Panchang Favorable", n:2184, avg:0.0042, win:0.62, p:0.031, tier:"validated"  },
    { id:"panchang_avoid",     label:"Panchang Avoid",     n:486,  avg:-0.0031,win:0.41, p:0.028, tier:"validated"  },
    { id:"rahu_kala_entry",    label:"Rahu Kala Entry",    n:312,  avg:-0.0068,win:0.35, p:0.018, tier:"validated"  },
    { id:"abhijit_entry",      label:"Abhijit Entry",      n:198,  avg:0.0061, win:0.64, p:0.042, tier:"validated"  },
    { id:"mercury_retro_it",   label:"Mercury Retro × IT", n:72,   avg:-0.0058,win:0.38, p:0.044, tier:"validated"  },
    { id:"moon_sign_fire",     label:"Moon in Fire Signs", n:892,  avg:0.0034, win:0.58, p:0.038, tier:"validated"  },
    { id:"jupiter_cancer_fmcg",label:"Jupiter Cancer FMCG",n:3,   avg:0.184,  win:1.0,  p:null,  tier:"indicative" },
    { id:"herschel_gemini",    label:"Herschel Gemini",    n:0,   avg:null,   win:null,  p:null,  tier:"unvalidated"},
  ];
  const tierColor = t => t==="validated"?C.green:t==="indicative"?C.amber:C.red;
  const tierIcon  = t => t==="validated"?"✓":t==="indicative"?"~":"✗";

  return (
    <div style={{ padding:"14px 16px" }}>
      <div style={{ fontFamily:"'Cinzel',serif", fontSize:"13px",
        color:C.gold, letterSpacing:"0.1em", marginBottom:"12px" }}>
        CORRELATION ENGINE — SIGNAL VALIDATION
      </div>
      <div style={{ display:"grid",
        gridTemplateColumns:"1fr 70px 80px 70px 80px 80px",
        gap:"6px", padding:"5px 10px", fontSize:"8px",
        letterSpacing:"0.09em", color:C.textDim,
        borderBottom:`1px solid ${C.border}` }}>
        <span>SIGNAL</span><span>n</span><span>AVG RET</span>
        <span>WIN %</span><span>p-VALUE</span><span>TIER</span>
      </div>
      {signals.map((s,i)=>(
        <div key={i} style={{ display:"grid",
          gridTemplateColumns:"1fr 70px 80px 70px 80px 80px",
          gap:"6px", padding:"7px 10px",
          borderBottom:`1px solid ${C.border}22`,
          alignItems:"center",
          background:i%2===0?"#0B0D11":C.bg }}>
          <div style={{ fontSize:"10px", color:C.textMid }}>{s.label}</div>
          <div style={{ fontSize:"11px", fontWeight:"700",
            color:s.n>=30?C.green:s.n>=3?C.amber:C.red }}>{s.n}</div>
          <div style={{ fontSize:"11px", fontWeight:"700",
            color:s.avg===null?C.textDim:s.avg>0?C.green:C.red }}>
            {s.avg===null?"—":`${s.avg>0?"+":""}${(s.avg*100).toFixed(2)}%`}
          </div>
          <div style={{ fontSize:"11px",
            color:s.win===null?C.textDim:s.win>0.55?C.green:C.amber }}>
            {s.win===null?"—":`${(s.win*100).toFixed(0)}%`}
          </div>
          <div style={{ fontSize:"11px",
            color:s.p===null?C.textDim:s.p<0.05?C.green:C.amber }}>
            {s.p===null?"N/A":`p=${s.p}`}
          </div>
          <div style={{ fontSize:"10px", fontWeight:"700",
            color:tierColor(s.tier) }}>
            {tierIcon(s.tier)} {s.tier.slice(0,5).toUpperCase()}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── BACKTEST MINI ─────────────────────────────────────────────────────────
function BacktestMini() {
  const signals = [
    { label:"Panchang Favorable", alpha:+0.42, sharpe:1.82, win:62, grade:"A+" },
    { label:"Rahu Kala Entry",    alpha:-0.68, sharpe:-1.24,win:35, grade:"D"  },
    { label:"Abhijit Window",     alpha:+0.61, sharpe:1.64, win:64, grade:"A"  },
    { label:"Mercury Retro × IT", alpha:-0.58, sharpe:-1.18,win:38, grade:"D"  },
    { label:"Moon Fire Signs",    alpha:+0.34, sharpe:0.94, win:58, grade:"B+" },
    { label:"Venus Retro Banking",alpha:-0.72, sharpe:-1.42,win:37, grade:"D"  },
  ];
  const gradeColor = g => g==="A+"?C.gold:g==="A"?C.green:g==="B+"?C.teal:g==="B"?C.amber:C.red;

  return (
    <div style={{ padding:"14px 16px" }}>
      <div style={{ fontFamily:"'Cinzel',serif", fontSize:"13px",
        color:C.gold, letterSpacing:"0.1em", marginBottom:"12px" }}>
        BACKTEST — SIGNAL PERFORMANCE (Jan–Jun 2026)
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 70px 70px 50px",
        gap:"6px", padding:"5px 10px", fontSize:"8px",
        letterSpacing:"0.09em", color:C.textDim,
        borderBottom:`1px solid ${C.border}` }}>
        <span>SIGNAL</span><span>ALPHA</span>
        <span>SHARPE</span><span>WIN %</span><span>GRADE</span>
      </div>
      {signals.map((s,i)=>(
        <div key={i} style={{ display:"grid",
          gridTemplateColumns:"1fr 90px 70px 70px 50px",
          gap:"6px", padding:"7px 10px",
          borderBottom:`1px solid ${C.border}22`,
          alignItems:"center",
          background:i%2===0?"#0B0D11":C.bg }}>
          <div style={{ fontSize:"10px", color:C.textMid }}>{s.label}</div>
          <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
            <div style={{ width:"40px", height:"5px", background:C.border,
              borderRadius:"3px", overflow:"hidden" }}>
              <div style={{ height:"100%", borderRadius:"3px",
                background:s.alpha>0?C.green:C.red,
                width:`${Math.min(100,Math.abs(s.alpha/1)*100)}%` }}/>
            </div>
            <span style={{ fontSize:"10px", fontWeight:"700",
              color:s.alpha>0?C.green:C.red }}>
              {s.alpha>0?"+":""}{s.alpha}%
            </span>
          </div>
          <div style={{ fontSize:"11px",
            color:s.sharpe>1?C.green:s.sharpe>0?C.amber:C.red }}>
            {s.sharpe}
          </div>
          <div style={{ fontSize:"11px",
            color:s.win>55?C.green:s.win>45?C.amber:C.red }}>
            {s.win}%
          </div>
          <div style={{ fontSize:"12px", fontWeight:"700",
            color:gradeColor(s.grade) }}>{s.grade}</div>
        </div>
      ))}
    </div>
  );
}

// ─── ALERTS MINI ───────────────────────────────────────────────────────────
function AlertsMini({ alerts, onMarkRead }) {
  const priorityColor = p => p==="CRITICAL"?C.red:p==="HIGH"?C.amber:C.textMid;
  return (
    <div style={{ padding:"14px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginBottom:"12px" }}>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:"13px",
          color:C.gold, letterSpacing:"0.1em" }}>ALERT FEED</div>
        <button onClick={onMarkRead}
          style={{ fontSize:"9px", color:C.textDim, cursor:"pointer",
            background:"transparent", border:`1px solid ${C.border}`,
            borderRadius:"3px", padding:"3px 8px" }}>
          MARK ALL READ
        </button>
      </div>
      {alerts.map(a=>(
        <div key={a.id} style={{ display:"flex", gap:"10px", padding:"9px 10px",
          marginBottom:"4px", borderRadius:"3px",
          background:a.read?"transparent":"#0D1520",
          border:`1px solid ${a.read?C.border:C.border+"88"}`,
          borderLeft:`3px solid ${a.read?C.border:priorityColor(a.priority)}`,
          alignItems:"center" }}>
          <div style={{ width:"6px", height:"6px", borderRadius:"50%",
            background:a.read?"transparent":priorityColor(a.priority),
            flexShrink:0 }}/>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:"11px",
              color:a.read?C.textMid:C.text,
              fontWeight:a.read?"400":"600" }}>{a.title}</div>
            <div style={{ fontSize:"9px", color:C.textDim }}>{a.ts} · {a.source}</div>
          </div>
          <span style={{ fontSize:"9px", fontWeight:"700",
            color:priorityColor(a.priority) }}>{a.priority}</span>
        </div>
      ))}
    </div>
  );
}

// ─── MUHURTA MINI ──────────────────────────────────────────────────────────
function MuhurtaMini() {
  const windows = [
    { date:"2026-05-05",dow:"Tue",slot:"Abhijit Prime",time:"11:48",score:9.2,grade:"EXCELLENT",action:"New Position Entry",tithi:"Dwadashi",yoga:"Variyana"},
    { date:"2026-05-12",dow:"Tue",slot:"Abhijit Prime",time:"11:48",score:8.8,grade:"EXCELLENT",action:"Large Trade",tithi:"Dwitiya",yoga:"Priti"},
    { date:"2026-05-05",dow:"Tue",slot:"Opening Slot",  time:"09:15",score:7.8,grade:"GOOD",    action:"SIP Start",tithi:"Dwadashi",yoga:"Variyana"},
    { date:"2026-05-04",dow:"Mon",slot:"Post-Abhijit",  time:"12:36",score:7.2,grade:"GOOD",    action:"Portfolio Rebalance",tithi:"Ekadashi",yoga:"Siddhi"},
    { date:"2026-05-06",dow:"Wed",slot:"Mid-Morning",   time:"10:03",score:6.4,grade:"FAIR",    action:"Stop Loss Placement",tithi:"Trayodashi",yoga:"Parigha"},
  ];
  const gradeColors = {EXCELLENT:C.gold,GOOD:C.green,FAIR:C.amber};

  return (
    <div style={{ padding:"14px 16px" }}>
      <div style={{ fontFamily:"'Cinzel',serif", fontSize:"13px",
        color:C.gold, letterSpacing:"0.1em", marginBottom:"12px" }}>
        MUHURTA SELECTION — TOP 5 WINDOWS
      </div>
      <div style={{ display:"grid",
        gridTemplateColumns:"80px 60px 120px 60px 50px 1fr",
        gap:"6px", padding:"5px 10px", fontSize:"8px",
        letterSpacing:"0.09em", color:C.textDim,
        borderBottom:`1px solid ${C.border}` }}>
        <span>DATE</span><span>TIME</span>
        <span>SLOT</span><span>SCORE</span>
        <span>GRADE</span><span>ACTION</span>
      </div>
      {windows.map((w,i)=>(
        <div key={i} style={{ display:"grid",
          gridTemplateColumns:"80px 60px 120px 60px 50px 1fr",
          gap:"6px", padding:"8px 10px",
          borderBottom:`1px solid ${C.border}22`,
          alignItems:"center",
          background:i%2===0?"#0B0D11":C.bg,
          borderLeft:i===0?`3px solid ${C.gold}`:"3px solid transparent" }}>
          <div style={{ fontSize:"10px", color:C.text }}>
            {w.date.slice(5)}<span style={{ fontSize:"8px",
              color:C.textDim, marginLeft:"3px" }}>{w.dow}</span>
          </div>
          <div style={{ fontSize:"11px", color:C.teal,
            fontFamily:"monospace", fontWeight:"700" }}>{w.time}</div>
          <div style={{ fontSize:"9px", color:C.textMid }}>{w.slot}</div>
          <div>
            <DialSVG score={w.score} size={32}/>
          </div>
          <div style={{ fontSize:"10px", fontWeight:"700",
            color:gradeColors[w.grade] }}>{w.grade}</div>
          <div style={{ fontSize:"9px", color:C.textMid }}>{w.action}</div>
        </div>
      ))}
    </div>
  );
}

// ─── SHARED SVG HELPERS ────────────────────────────────────────────────────
function DialSVG({ score, size=40 }) {
  const r=size/2-4, circ=2*Math.PI*r, dash=(score/10)*circ;
  const col=score>=7.5?C.gold:score>=6?C.green:score>=4?C.amber:C.red;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth="3"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth="3"
        strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <text x={size/2} y={size/2+4} textAnchor="middle"
        fontSize={size>36?"11":"8"} fontWeight="700" fill={col}>{score}</text>
    </svg>
  );
}

function CandleChart({ candles, nowMins, rahuS, rahuE, abhS, abhE, yogaChange, tithiChange }) {
  const W=640, H=160, open=9*60+15, close=15*60+30, range=close-open;
  const toX=(m)=>4+((m-open)/range)*(W-8);
  const prices=candles.flatMap(c=>[c.h,c.l]);
  const minP=Math.min(...prices), maxP=Math.max(...prices), pr=maxP-minP||10;
  const cy=(p)=>4+((1-(p-minP)/pr)*(H-8));
  const bw=Math.max(2,(W-8)/candles.length-1);
  const nowX=toX(Math.min(nowMins,close));
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ display:"block", background:C.bg }}>
      <rect x={toX(rahuS)} y={0} width={Math.max(0,toX(rahuE)-toX(rahuS))} height={H}
        fill={C.red} opacity="0.07"/>
      <rect x={toX(abhS)}  y={0} width={Math.max(0,toX(abhE)-toX(abhS))}  height={H}
        fill={C.green} opacity="0.07"/>
      {yogaChange&&(
        <line x1={toX(toMins(yogaChange))} y1={0}
          x2={toX(toMins(yogaChange))} y2={H}
          stroke={C.gold} strokeWidth="0.8" strokeDasharray="4,3" opacity="0.5"/>
      )}
      {candles.map((c,i)=>{
        const x=(4+((c.mins-open)/range)*(W-8));
        const isFut=c.mins>nowMins;
        const bull=c.c>=c.o;
        const col=isFut?C.border:c.mins>=rahuS&&c.mins<rahuE?`${C.red}99`:bull?C.green:C.red;
        const bt=cy(Math.max(c.o,c.c)), bh=Math.max(1,Math.abs(cy(c.o)-cy(c.c)));
        return (
          <g key={i} opacity={isFut?0.2:1}>
            <line x1={x} y1={cy(c.h)} x2={x} y2={cy(c.l)} stroke={col} strokeWidth="1"/>
            <rect x={x-bw/2} y={bt} width={bw} height={bh}
              fill={bull&&!isFut?col:isFut?"transparent":col}
              stroke={col} strokeWidth="0.5"/>
          </g>
        );
      })}
      <line x1={nowX} y1={0} x2={nowX} y2={H}
        stroke={C.gold} strokeWidth="1.5" opacity="0.9"
        style={{ animation:"pulse 1.5s ease-in-out infinite" }}/>
      <text x={toX(rahuS)+3} y={H-3} fontSize="7" fill={C.red} opacity="0.6">☊ RAHU</text>
      <text x={toX(abhS)+3}  y={H-3} fontSize="7" fill={C.green} opacity="0.6">☀ ABHIJIT</text>
    </svg>
  );
}

function VolBars({ candles, nowMins, rahuS, rahuE }) {
  const W=640, H=28, open=9*60+15, close=15*60+30;
  const toX=(m)=>4+((m-open)/(close-open))*(W-8);
  const maxV=Math.max(...candles.map(c=>c.vol));
  const bw=Math.max(2,(W-8)/candles.length-1);
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ display:"block", background:C.bg }}>
      {candles.map((c,i)=>{
        const x=toX(c.mins), isFut=c.mins>nowMins;
        const h=(c.vol/maxV)*(H-2);
        const col=isFut?C.border:c.mins>=rahuS&&c.mins<rahuE?C.red:c.c>=c.o?C.green:C.red;
        return <rect key={i} x={x-bw/2} y={H-h-1}
          width={bw} height={Math.max(1,h)}
          fill={col} opacity={isFut?0.1:0.6}/>;
      })}
    </svg>
  );
}

function buildCandles(sq) {
  const candles=[]; let price=22420;
  const bias=sq===3?0.0004:sq===2?0.00005:-0.0003;
  for (let m=0;m<75;m++) {
    const mins=9*60+15+m*5;
    const noise=(((m*1664525+1013904223)&0x7fffffff)/0x7fffffff*2-1);
    const ret=bias+noise*0.0018;
    const o=+price.toFixed(2), c=+(price*(1+ret)).toFixed(2);
    const h=+(Math.max(o,c)*(1+Math.abs(noise)*0.0004)).toFixed(2);
    const l=+(Math.min(o,c)*(1-Math.abs(noise)*0.0004)).toFixed(2);
    candles.push({ mins, o, h, l, c, vol:8000+Math.abs(Math.round(noise*40000)) });
    price=c;
  }
  return candles;
}

function LPFinMini({ lpState, panchang, inRahu, inAbhijit, combined }) {
  const isBull = lpState.score >= 7;
  const verdict = inRahu && isBull ? { text:"✕ RAHU BLOCK", color:C.red } :
    isBull && panchang.sessionQuality === 3
      ? { text:`▲▲ ALIGNED ${combined}`, color:C.gold }
    : isBull && panchang.sessionQuality === 2
      ? { text:"▲ PARTIAL",              color:C.green }
    : lpState.score <= -6 && panchang.sessionQuality <= 1
      ? { text:"▼▼ BEAR ALIGNED",        color:C.red }
    : lpState.score === 0 && panchang.sessionQuality === 3
      ? { text:"◈ WATCH",                color:C.purple }
      : { text:"○ LP ONLY",              color:C.textMid };

  return (
    <div style={{ ...pnl(), background:verdict.color+"10",
      border:`1px solid ${verdict.color}40` }}>
      <div style={{ fontSize:"8px", color:C.textDim,
        letterSpacing:"0.1em", marginBottom:"6px" }}>LP + FIN</div>
      <div style={{ display:"flex", justifyContent:"space-between",
        fontSize:"10px", marginBottom:"4px" }}>
        <span style={{ color:C.textDim }}>Signal</span>
        <span style={{ color:lpColor(lpState.signal),
          fontWeight:"700" }}>{lpState.signal}</span>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between",
        fontSize:"10px", marginBottom:"8px" }}>
        <span style={{ color:C.textDim }}>Panchang</span>
        <span style={{ color:panchang.sessionQuality===3?C.green:C.amber,
          fontWeight:"700" }}>{panchang.qualityLabel}</span>
      </div>
      <div style={{ textAlign:"center", padding:"7px",
        background:verdict.color+"18",
        border:`1px solid ${verdict.color}50`,
        borderRadius:"3px",
        fontSize:"12px", fontWeight:"700",
        color:verdict.color }}>{verdict.text}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function FinastroDashboard() {
  const [activeTab, setActiveTab] = useState("today");
  const [time, setTime]           = useState(new Date());
  const [alerts, setAlerts]       = useState(MOCK_ALERTS);
  const [lpState, setLpState]     = useState(LP_CYCLE[0]);
  const [lpFlash, setLpFlash]     = useState(null);
  const [alertPanelOpen, setAlertPanelOpen] = useState(false);
  const cycleRef = useRef(0);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Cycle LP signals + inject live flash every 15s
  useEffect(() => {
    const t = setInterval(() => {
      cycleRef.current = (cycleRef.current+1)%LP_CYCLE.length;
      const next = LP_CYCLE[cycleRef.current];
      setLpState(next);
      if (next.score !== 0) {
        setLpFlash(next);
        setTimeout(() => setLpFlash(null), 4000);
        // Add to alert feed if high score
        if (Math.abs(next.score) >= 7) {
          setAlerts(prev => [{
            id: Date.now(), ts: "live",
            title:`${next.score>=7?"▲":"▼"} ${next.symbol} — ${next.signal}`,
            priority: Math.abs(next.score)>=9?"HIGH":"MED",
            read:false, source:"lp",
          }, ...prev.slice(0,7)]);
        }
      }
    }, 15000);
    return () => clearInterval(t);
  }, []);

  const nowIST = time.toLocaleTimeString("en-IN",
    { timeZone:"Asia/Kolkata", hour12:false });
  const nowMins = (() => {
    const ist = new Date(time.toLocaleString("en-US",
      { timeZone:"Asia/Kolkata" }));
    return ist.getHours()*60+ist.getMinutes();
  })();
  const inRahu    = nowMins >= toMins(PANCHANG.rahuKala.start)
    && nowMins < toMins(PANCHANG.rahuKala.end);
  const inAbhijit = nowMins >= toMins(PANCHANG.abhijit.start)
    && nowMins < toMins(PANCHANG.abhijit.end);
  const unreadCount = alerts.filter(a=>!a.read).length;
  const qualColor = [C.red,C.amber,C.amber,C.green][PANCHANG.sessionQuality];

  const markAllRead = () => {
    setAlerts(a => a.map(x=>({...x,read:true})));
    setAlertPanelOpen(false);
  };

  return (
    <div style={{ fontFamily:"'DM Mono','Courier New',monospace",
      background:C.bg, color:C.text,
      minHeight:"100vh", fontSize:"13px",
      display:"flex", flexDirection:"column" }}>

      {/* ── LIVE FLASH ───────────────────────────────────────────────── */}
      {lpFlash && (
        <div style={{ position:"fixed", top:"14px", right:"14px",
          zIndex:200, background:C.panel,
          border:`1px solid ${lpColor(lpFlash.signal)}`,
          borderRadius:"6px", padding:"12px 16px",
          minWidth:"260px",
          boxShadow:"0 4px 24px #00000070" }}>
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", marginBottom:"5px" }}>
            <span style={{ color:lpColor(lpFlash.signal),
              fontWeight:"700", fontSize:"11px" }}>
              ⚡ LP SIGNAL — {lpFlash.symbol}
            </span>
            <span style={{ fontSize:"10px", color:C.gold }}>LIVE</span>
          </div>
          <div style={{ fontSize:"11px", color:C.textMid }}>
            <strong style={{ color:lpColor(lpFlash.signal) }}>
              {lpFlash.signal}
            </strong>{" "}
            Score: {lpFlash.score>0?"+":""}{lpFlash.score} · RVOL {lpFlash.rvol}x
          </div>
          <div style={{ marginTop:"6px", height:"2px",
            background:C.border, borderRadius:"2px" }}>
            <div style={{ height:"100%",
              background:lpColor(lpFlash.signal),
              animation:"shrink 4s linear forwards",
              borderRadius:"2px" }}/>
          </div>
        </div>
      )}

      {/* ── MAIN HEADER ──────────────────────────────────────────────── */}
      <div style={{ background:C.panel,
        borderBottom:`1px solid ${C.border}`,
        padding:"10px 20px",
        display:"flex", alignItems:"center",
        justifyContent:"space-between",
        flexShrink:0, zIndex:10 }}>

        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:"20px",
            color:C.gold, letterSpacing:"0.2em" }}>FINASTRO</div>
          <div style={{ width:"6px", height:"6px", borderRadius:"50%",
            background:C.green, boxShadow:`0 0 6px ${C.green}`,
            animation:"pulse 1.5s ease-in-out infinite" }}/>
          <span style={{ fontSize:"9px", color:C.green }}>LIVE</span>
          <span style={{ fontSize:"9px", color:C.textDim }}>
            Ujjain · Lahiri · Sidereal · IST
          </span>
        </div>

        {/* Centre: session + time */}
        <div style={{ display:"flex", gap:"12px", alignItems:"center" }}>
          {inRahu && (
            <div style={{ padding:"5px 12px",
              background:C.redDim, border:`1px solid ${C.red}60`,
              borderRadius:"3px", fontSize:"10px",
              color:C.red, fontWeight:"700" }}>
              ☊ RAHU KALA ACTIVE
            </div>
          )}
          {inAbhijit && (
            <div style={{ padding:"5px 12px",
              background:C.greenDim, border:`1px solid ${C.green}60`,
              borderRadius:"3px", fontSize:"10px",
              color:C.green, fontWeight:"700" }}>
              ☀ ABHIJIT ACTIVE
            </div>
          )}
          <div style={{ fontFamily:"monospace", fontSize:"18px",
            color:C.gold, letterSpacing:"0.08em",
            fontWeight:"700" }}>
            {nowIST.slice(0,8)}
          </div>
          <div style={{ fontSize:"10px", color:C.textDim }}>
            {PANCHANG.date} · {PANCHANG.vaar}
          </div>
        </div>

        {/* Right: LP + alerts */}
        <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
          {/* LP pill */}
          {lpState.score !== 0 && (
            <div style={{ padding:"4px 10px",
              background:lpColor(lpState.signal)+"18",
              border:`1px solid ${lpColor(lpState.signal)}50`,
              borderRadius:"3px", fontSize:"10px",
              color:lpColor(lpState.signal), fontWeight:"700",
              display:"flex", gap:"6px", alignItems:"center" }}>
              <span>⚡ LP:{lpState.symbol}</span>
              <span>{lpState.signal}</span>
              <span>{lpState.score>0?"+":""}{lpState.score}</span>
            </div>
          )}

          {/* Alert bell */}
          <div style={{ position:"relative", cursor:"pointer",
            padding:"7px 12px",
            background:unreadCount>0?C.amberDim+"33":C.panel,
            border:`1px solid ${unreadCount>0?C.amber+"60":C.border}`,
            borderRadius:"3px",
            onClick: () => setAlertPanelOpen(o=>!o) }}
            onClick={() => setAlertPanelOpen(o=>!o)}>
            <span style={{ fontSize:"16px" }}>🔔</span>
            {unreadCount > 0 && (
              <div style={{ position:"absolute", top:"-4px", right:"-4px",
                background:C.red, color:"white", borderRadius:"50%",
                width:"16px", height:"16px", fontSize:"9px",
                fontWeight:"700", display:"flex",
                alignItems:"center", justifyContent:"center" }}>
                {unreadCount}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── PANCHANG CONTEXT STRIP ─────────────────────────────────── */}
      <div style={{ background:"#0D1420",
        borderBottom:`1px solid ${C.border}`,
        padding:"5px 20px",
        display:"flex", gap:"20px",
        alignItems:"center", fontSize:"10px",
        flexShrink:0, flexWrap:"wrap" }}>
        <span style={{ color:qualColor, fontWeight:"700" }}>
          {["✕ AVOID","⚠ CAUTION","◎ NEUTRAL","✦ FAVORABLE"][PANCHANG.sessionQuality]}
        </span>
        <span style={{ color:C.textDim }}>|</span>
        <span style={{ color:C.green }}>{PANCHANG.yoga} Yoga</span>
        <span style={{ color:C.textMid }}>{PANCHANG.tithi} ({PANCHANG.tithiPaksha})</span>
        <span style={{ color:C.teal }}>{PANCHANG.nakshatra} · {PANCHANG.moonSign}</span>
        <span style={{ color:C.red }}>☊ Rahu {PANCHANG.rahuKala.start}–{PANCHANG.rahuKala.end}</span>
        <span style={{ color:C.green }}>☀ Abhijit {PANCHANG.abhijit.start}–{PANCHANG.abhijit.end}</span>
        <span style={{ color:C.gold }}>⚡ Yoga→ {PANCHANG.yogaChange}</span>
        {PANCHANG.jupiterCancer && <span style={{ color:C.gold }}>♃ Jupiter Cancer ↑</span>}
        {PANCHANG.mercuryRetro  && <span style={{ color:C.amber }}>☿ Mercury ℞</span>}
        {/* Planet row */}
        <span style={{ marginLeft:"auto", display:"flex", gap:"10px" }}>
          {PLANETS.map((p,i) => (
            <span key={i} style={{ color:p.color, fontSize:"10px" }}>
              {p.sym}{p.pos}
              {p.retro?" ℞":p.status==="exalted"?" ↑":p.status==="debil"?" ↓":""}
            </span>
          ))}
        </span>
      </div>

      {/* ── TAB BAR ──────────────────────────────────────────────────── */}
      <div style={{ background:C.panel,
        borderBottom:`1px solid ${C.border}`,
        display:"flex", padding:"0 20px",
        overflowX:"auto", flexShrink:0 }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const isLP     = tab.id === "lp";
          const isAlerts = tab.id === "alerts";
          return (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{ padding:"10px 16px", cursor:"pointer",
                background:"transparent", border:"none",
                borderBottom:`2px solid ${isActive
                  ? (isLP?C.amber:C.gold)
                  : "transparent"}`,
                color:isActive
                  ? (isLP?C.amber:C.gold)
                  : C.textDim,
                fontSize:"11px", letterSpacing:"0.06em",
                fontWeight:isActive?"700":"400",
                transition:"all 0.15s",
                display:"flex", gap:"5px",
                alignItems:"center",
                whiteSpace:"nowrap",
                flexShrink:0 }}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {isAlerts && unreadCount > 0 && (
                <span style={{ background:C.red,
                  color:"white", borderRadius:"8px",
                  padding:"0 5px", fontSize:"9px",
                  fontWeight:"700" }}>{unreadCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── ALERT DROPDOWN PANEL ─────────────────────────────────────── */}
      {alertPanelOpen && (
        <div style={{ position:"fixed", top:"70px", right:"20px",
          zIndex:100, width:"340px",
          background:C.panel, border:`1px solid ${C.border}`,
          borderRadius:"6px",
          boxShadow:"0 8px 32px #00000070",
          maxHeight:"60vh", overflowY:"auto" }}>
          <div style={{ padding:"12px 14px",
            borderBottom:`1px solid ${C.border}`,
            display:"flex", justifyContent:"space-between",
            alignItems:"center" }}>
            <span style={{ fontSize:"11px", color:C.gold,
              fontWeight:"700", letterSpacing:"0.08em" }}>
              ALERTS ({unreadCount} unread)
            </span>
            <button onClick={markAllRead}
              style={{ fontSize:"9px", color:C.textDim,
                cursor:"pointer", background:"transparent",
                border:`1px solid ${C.border}`,
                borderRadius:"3px", padding:"3px 8px" }}>
              MARK ALL READ
            </button>
          </div>
          <AlertsMini alerts={alerts}
            onMarkRead={markAllRead}/>
        </div>
      )}

      {/* ── TAB CONTENT ──────────────────────────────────────────────── */}
      <div style={{ flex:1, overflowY:"auto" }}>

        {activeTab === "today" && (
          <TodayScreen panchang={PANCHANG} nowMins={nowMins}
            nowIST={nowIST} inRahu={inRahu} inAbhijit={inAbhijit}
            lpState={lpState}/>
        )}

        {activeTab === "weekly" && (
          <WeeklyScreen panchang={PANCHANG}/>
        )}

        {activeTab === "monthly" && (
          <MonthlyScreen panchang={PANCHANG}/>
        )}

        {activeTab === "screener" && (
          <ScreenerMini panchang={PANCHANG}
            inRahu={inRahu} inAbhijit={inAbhijit} nowIST={nowIST.slice(0,5)}/>
        )}

        {activeTab === "lp" && (
          <LPBridgeMini lpState={lpState} panchang={PANCHANG}
            inRahu={inRahu} inAbhijit={inAbhijit}/>
        )}

        {activeTab === "correlation" && <CorrelationMini/>}
        {activeTab === "backtest"    && <BacktestMini/>}

        {activeTab === "alerts" && (
          <AlertsMini alerts={alerts} onMarkRead={markAllRead}/>
        )}

        {activeTab === "muhurta" && <MuhurtaMini/>}
      </div>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <div style={{ background:"#0D1016",
        borderTop:`1px solid ${C.border}`,
        padding:"6px 20px",
        display:"flex", gap:"16px",
        alignItems:"center", fontSize:"9px",
        color:C.textDim, flexShrink:0,
        flexWrap:"wrap" }}>
        <span>FINASTRO Dashboard v2 · Sprint 7</span>
        <span>·</span>
        {inRahu
          ? <span style={{ color:C.red, fontWeight:"700" }}>☊ Rahu Kala — no entries until {PANCHANG.rahuKala.end}</span>
          : inAbhijit
          ? <span style={{ color:C.green }}>☀ Abhijit active — best execution window</span>
          : <span>⚡ Next: {PANCHANG.yogaChange} Yoga changeover</span>}
        <span style={{ marginLeft:"auto", color:C.teal }}>
          🔄 km_daily_panchang · km_planetary_positions · km_astro_correlation ·
          km_equity_eod · km_finastro_alerts
        </span>
      </div>

      <style>{`
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes shrink { from{width:100%} to{width:0%} }
      `}</style>
    </div>
  );
}
