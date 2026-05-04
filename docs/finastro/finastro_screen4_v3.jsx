import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// FINASTRO — SCREEN 4 v3: SIGNAL SCREENER + LUCKYPOP INTEGRATION
// File: finastro_screen4_v3.jsx  [Sprint 6]
//
// COLUMNS (left → right):
//   Symbol · Sector · Phase · Tech Score · Panchang Score · Planetary ~
//   HONEST SCORE (60/20/20) · LP SIGNAL ★ · CONFLUENCE ★ · ACTION ★ · ALERT ★
//
// FEATURES:
//   · Full honest scoring with tier-aware weighting
//   · LP signal column with score ±10 + dot indicator
//   · Confluence badge: ALIGNED / CONFLICT / OVERRIDE / WATCH / LP ONLY
//   · Action directive per row
//   · Set Alert button → Sprint 3 alert config modal
//   · Sector phase filter · Score sort · Grade filter
//   · Detail drawer per stock
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  bg:"#0A0C0F", panel:"#0F1216", border:"#1C2028", borderBright:"#2A3040",
  gold:"#C9A84C", goldDim:"#7A6230",
  green:"#4CAF8A", greenDim:"#2A5A42",
  red:"#E86060", redDim:"#5A2828",
  amber:"#E89040", amberDim:"#6B4520",
  teal:"#40B8C8", tealDim:"#1C5A64",
  purple:"#9B6BC0", purpleDim:"#4A2870",
  blue:"#5B8DD9", blueDim:"#243660",
  text:"#D8DDE8", textDim:"#6A7280", textMid:"#A8B0C0",
};

// ─── PANCHANG CONTEXT ─────────────────────────────────────────────────────
const PANCHANG = {
  sessionQuality:2, qualityLabel:"NEUTRAL",
  yoga:"Siddhi", yogaQuality:3,
  yogaIsAvoid:false, tithiType:"Nanda",
  mercuryRetro:true, jupiterCancer:true,
  rahuKala:{ start:"10:30", end:"12:00" },
  abhijit:{ start:"11:48", end:"12:36" },
};

// ─── PHASE DEFINITIONS ────────────────────────────────────────────────────
const PHASES = {
  ENTERING:    { color:C.teal,   icon:"◉", scoreAdj:+0.5, tierReq:"indicative" },
  LEADING:     { color:C.green,  icon:"▲", scoreAdj:+0.8, tierReq:"indicative" },
  PEAKING:     { color:C.gold,   icon:"⬆", scoreAdj:-0.3, tierReq:"indicative" },
  "ROTATING OUT":{ color:C.amber,icon:"↓", scoreAdj:-1.0, tierReq:"validated"  },
  NEGLECTED:   { color:C.red,    icon:"○", scoreAdj:-1.5, tierReq:"indicative" },
};

// ─── LP SIGNAL DATA ────────────────────────────────────────────────────────
const LP_SCORES = {
  "POWER BUY":10,"STRONG BUY":9,"BUY CONFIRMED":8,"BUY":7,
  "BUY BOOK FAST":6,"ACCUMULATION":5,"SCALP ONLY":4,
  "CAUTION":3,"WAIT":2,"AVOID":1,"NO TRADE":0,
  "POWER SELL":-10,"STRONG SELL":-9,"SELL":-8,
  "SELL BOOK FAST":-7,"SCALP SHORT":-6,"DISTRIBUTION":-5,"SQUEEZE RISK":-4,
};
const lpColor = (sig) => {
  const s = LP_SCORES[sig] ?? 0;
  if (s >= 9) return C.green;
  if (s >= 7) return "#6DD68A";
  if (s >= 5) return C.teal;
  if (s > 0)  return C.amber;
  if (s <= -9) return C.red;
  if (s <= -6) return "#E07070";
  if (s < 0)  return C.amber;
  return C.textDim;
};
const lpDir = (s) => s >= 7 ? "▲" : s >= 4 ? "~" : s === 0 ? "—" : s <= -6 ? "▼" : "~";

// ─── HONEST SCORE FORMULA ─────────────────────────────────────────────────
// TECH 60% · INTRADAY VALIDATED 20% · PLANETARY INDICATIVE 20%
function computeHonestScore(stock, panchang) {
  // 1. Tech score (from MagicRS, LP score proxy, breakout quality)
  const techRaw = stock.techScore; // 0–10
  const tech = techRaw * 0.6;

  // 2. Intraday Panchang — validated tier only
  const sq = panchang.sessionQuality;
  const yogaFav = panchang.yogaQuality >= 3 && !panchang.yogaIsAvoid;
  let intraday = 0;
  if (sq === 3) intraday = yogaFav ? 2.0 : 1.5;
  else if (sq === 2) intraday = yogaFav ? 1.0 : 0.7;
  else if (sq === 1) intraday = 0.3;
  else intraday = 0;
  const intradayWeighted = intraday * 0.2;

  // 3. Planetary — indicative (½ weight if indicative, 0 if unvalidated)
  const phaseData = PHASES[stock.phase];
  const phaseScore = phaseData ? phaseData.scoreAdj : 0;
  const planetTier = stock.planetTier; // validated | indicative | unvalidated
  const planetWeight = planetTier === "validated" ? 1.0 : planetTier === "indicative" ? 0.5 : 0;
  const jupBoost = panchang.jupiterCancer && stock.sector === "FMCG" ? 0.3 : 0;
  const mercPenalty = panchang.mercuryRetro && stock.sector === "IT" ? -0.4 : 0;
  const planetary = Math.max(-2, Math.min(2, phaseScore + jupBoost + mercPenalty)) * planetWeight;
  const planetaryWeighted = planetary * 0.2;

  const total = Math.max(0, Math.min(10, tech + intradayWeighted + planetaryWeighted));
  return {
    total: +total.toFixed(1),
    tech: +tech.toFixed(1),
    intraday: +intradayWeighted.toFixed(1),
    planetary: +planetaryWeighted.toFixed(1),
    techRaw, intraday_raw: intraday, planetary_raw: +planetary.toFixed(2),
  };
}

// ─── CONFLUENCE VERDICT ────────────────────────────────────────────────────
function getConfluence(lpSig, lpScore, stock, panchang, nowIST) {
  if (!lpSig || lpScore === 0) {
    if (panchang.sessionQuality === 3)
      return { verdict:"WATCH", badge:"◈ WATCH", color:C.purple,
        priority:"MED", action:"Set watch alert for LP signal" };
    return { verdict:"IDLE", badge:"— IDLE", color:C.textDim,
      priority:"LOW", action:"No signal active" };
  }

  const isBull = lpScore >= 7, isBear = lpScore <= -6;

  // Time checks
  const inRahu = nowIST >= panchang.rahuKala.start && nowIST < panchang.rahuKala.end;
  const inAbhijit = nowIST >= panchang.abhijit.start && nowIST < panchang.abhijit.end;

  // Hard overrides
  if (isBull && inRahu)
    return { verdict:"RAHU_OVERRIDE", badge:"✕ RAHU", color:C.red,
      priority:"CRITICAL", action:"SKIP — Rahu Kala · n=312, p=0.018" };
  if (isBull && panchang.sessionQuality === 0)
    return { verdict:"HARD_CONFLICT", badge:"⚠ CONFLICT", color:C.red,
      priority:"CRITICAL", action:"SKIP — AVOID overrides LP · n=486, p=0.028" };
  if (panchang.yogaIsAvoid)
    return { verdict:"YOGA_OVERRIDE", badge:"⚠ YOGA", color:C.red,
      priority:"CRITICAL", action:"SKIP — Inauspicious yoga · n=2184" };

  // Aligned
  if (isBull && panchang.sessionQuality === 3) {
    const finBoost = (inAbhijit ? 2 : 0) + (panchang.jupiterCancer ? 1.5 : 0)
      + (panchang.mercuryRetro && stock.sector === "IT" ? -1.5 : 0);
    const combined = +((lpScore / 10 * 6 * 0.6) + (Math.min(4 + finBoost, 6) * 0.4)).toFixed(1);
    return {
      verdict:"ALIGNED", badge:`▲▲ ${inAbhijit?"ABHIJIT":"ALIGNED"}`,
      color:C.gold, priority:"HIGH",
      action:inAbhijit ? "FULL SIZE ENTRY — Abhijit ✓" : "STANDARD ENTRY",
      combined,
    };
  }
  if (isBull && panchang.sessionQuality === 2)
    return { verdict:"PARTIAL", badge:"▲ PARTIAL", color:C.green,
      priority:"MED", action:"REDUCED SIZE — neutral panchang" };

  // Bear aligned
  if (isBear && panchang.sessionQuality <= 1)
    return { verdict:"BEAR_ALIGNED", badge:"▼▼ BEAR", color:C.red,
      priority:"HIGH", action:"SHORT — both systems bearish" };

  // LP only
  return { verdict:"LP_ONLY", badge:"○ LP ONLY", color:C.textMid,
    priority:"LOW", action:"Optional — standard LP rules, no astro boost" };
}

// ─── STOCK UNIVERSE ────────────────────────────────────────────────────────
const STOCKS = [
  // FMCG — ENTERING (Jupiter Cancer)
  { symbol:"HINDUNILVR", name:"Hindustan Unilever",   sector:"FMCG",      phase:"ENTERING",
    techScore:6.8, planetTier:"indicative",
    lpSignal:"BUY",          lpScore:7,  lpDot:"SBD", lpRvol:1.24, lpBq:4, lpMagicRS:4,
    price:2418.65, chg:+0.82 },
  { symbol:"NESTLEIND",  name:"Nestle India",         sector:"FMCG",      phase:"ENTERING",
    techScore:5.9, planetTier:"indicative",
    lpSignal:"ACCUMULATION", lpScore:5,  lpDot:"NONE",lpRvol:0.94, lpBq:2, lpMagicRS:3,
    price:2284.40, chg:+0.44 },
  { symbol:"BRITANNIA",  name:"Britannia Industries", sector:"FMCG",      phase:"ENTERING",
    techScore:7.2, planetTier:"indicative",
    lpSignal:"BUY CONFIRMED",lpScore:8,  lpDot:"SBD", lpRvol:1.48, lpBq:5, lpMagicRS:5,
    price:5124.30, chg:+1.14 },

  // PSU Banks — LEADING
  { symbol:"SBIBANK",    name:"State Bank of India",  sector:"PSU Banks", phase:"LEADING",
    techScore:8.1, planetTier:"indicative",
    lpSignal:"STRONG BUY",   lpScore:9,  lpDot:"SVD", lpRvol:1.82, lpBq:5, lpMagicRS:6,
    price:782.40,  chg:+1.62 },
  { symbol:"BANKBARODA", name:"Bank of Baroda",        sector:"PSU Banks", phase:"LEADING",
    techScore:7.4, planetTier:"indicative",
    lpSignal:"BUY",          lpScore:7,  lpDot:"NONE",lpRvol:1.34, lpBq:3, lpMagicRS:4,
    price:248.80,  chg:+0.98 },
  { symbol:"CANARABANK", name:"Canara Bank",           sector:"PSU Banks", phase:"LEADING",
    techScore:6.6, planetTier:"indicative",
    lpSignal:"BUY BOOK FAST",lpScore:6,  lpDot:"SBD", lpRvol:1.12, lpBq:3, lpMagicRS:3,
    price:108.45,  chg:+0.54 },

  // Pharma — PEAKING (Rahu Pisces)
  { symbol:"SUNPHARMA",  name:"Sun Pharmaceutical",   sector:"Pharma",    phase:"PEAKING",
    techScore:7.8, planetTier:"indicative",
    lpSignal:"POWER BUY",    lpScore:10, lpDot:"SVD", lpRvol:2.14, lpBq:6, lpMagicRS:5,
    price:1648.90, chg:+2.18 },
  { symbol:"DRREDDY",    name:"Dr Reddy's Labs",       sector:"Pharma",    phase:"PEAKING",
    techScore:6.4, planetTier:"indicative",
    lpSignal:"BUY",          lpScore:7,  lpDot:"NONE",lpRvol:1.08, lpBq:3, lpMagicRS:4,
    price:1284.20, chg:+0.66 },
  { symbol:"CIPLA",      name:"Cipla",                 sector:"Pharma",    phase:"PEAKING",
    techScore:5.8, planetTier:"indicative",
    lpSignal:"CAUTION",      lpScore:3,  lpDot:"NONE",lpRvol:0.88, lpBq:1, lpMagicRS:2,
    price:1548.70, chg:-0.22 },

  // IT — ROTATING OUT (Mercury Retro)
  { symbol:"TCS",        name:"Tata Consultancy Svcs", sector:"IT",        phase:"ROTATING OUT",
    techScore:5.2, planetTier:"validated",
    lpSignal:"SELL",         lpScore:-8, lpDot:"SYD", lpRvol:1.56, lpBq:4, lpMagicRS:1,
    price:3412.20, chg:-1.42 },
  { symbol:"INFY",       name:"Infosys",               sector:"IT",        phase:"ROTATING OUT",
    techScore:4.8, planetTier:"validated",
    lpSignal:"STRONG SELL",  lpScore:-9, lpDot:"SYD", lpRvol:1.68, lpBq:5, lpMagicRS:1,
    price:1558.40, chg:-1.88 },
  { symbol:"WIPRO",      name:"Wipro",                 sector:"IT",        phase:"ROTATING OUT",
    techScore:4.4, planetTier:"validated",
    lpSignal:"DISTRIBUTION", lpScore:-5, lpDot:"SYD", lpRvol:1.22, lpBq:3, lpMagicRS:2,
    price:488.60,  chg:-0.92 },
  { symbol:"HCLTECH",    name:"HCL Technologies",      sector:"IT",        phase:"ROTATING OUT",
    techScore:5.6, planetTier:"validated",
    lpSignal:"CAUTION",      lpScore:3,  lpDot:"NONE",lpRvol:0.92, lpBq:1, lpMagicRS:2,
    price:1642.80, chg:-0.38 },

  // Auto — ROTATING OUT (Venus Retro ended, caution lingers)
  { symbol:"TATAMOTORS", name:"Tata Motors",           sector:"Auto",      phase:"ROTATING OUT",
    techScore:5.4, planetTier:"validated",
    lpSignal:"BUY CONFIRMED",lpScore:8,  lpDot:"SBD", lpRvol:1.45, lpBq:3, lpMagicRS:3,
    price:824.50,  chg:+0.74 },
  { symbol:"MARUTI",     name:"Maruti Suzuki",         sector:"Auto",      phase:"ROTATING OUT",
    techScore:6.1, planetTier:"validated",
    lpSignal:"BUY",          lpScore:7,  lpDot:"NONE",lpRvol:1.18, lpBq:3, lpMagicRS:3,
    price:12840.60,chg:+0.48 },

  // Pvt Banks — ENTERING
  { symbol:"AXISBANK",   name:"Axis Bank",             sector:"Pvt Banks", phase:"ENTERING",
    techScore:7.6, planetTier:"indicative",
    lpSignal:"STRONG BUY",   lpScore:9,  lpDot:"NONE",lpRvol:1.91, lpBq:5, lpMagicRS:5,
    price:1124.75, chg:+1.24 },
  { symbol:"HDFCBANK",   name:"HDFC Bank",             sector:"Pvt Banks", phase:"ENTERING",
    techScore:7.1, planetTier:"indicative",
    lpSignal:"ACCUMULATION", lpScore:5,  lpDot:"SBD", lpRvol:3.24, lpBq:1, lpMagicRS:4,
    price:1786.20, chg:+0.84 },
  { symbol:"KOTAKBANK",  name:"Kotak Mahindra Bank",   sector:"Pvt Banks", phase:"ENTERING",
    techScore:6.8, planetTier:"indicative",
    lpSignal:"BUY",          lpScore:7,  lpDot:"NONE",lpRvol:1.28, lpBq:3, lpMagicRS:4,
    price:1924.40, chg:+0.62 },

  // Energy — NEGLECTED
  { symbol:"RELIANCE",   name:"Reliance Industries",   sector:"Energy",    phase:"NEGLECTED",
    techScore:4.2, planetTier:"indicative",
    lpSignal:"CAUTION",      lpScore:3,  lpDot:"NONE",lpRvol:0.82, lpBq:0, lpMagicRS:2,
    price:1284.30, chg:-0.44 },
  { symbol:"ONGC",       name:"ONGC",                  sector:"Energy",    phase:"NEGLECTED",
    techScore:3.8, planetTier:"indicative",
    lpSignal:"AVOID",        lpScore:1,  lpDot:"NONE",lpRvol:0.68, lpBq:0, lpMagicRS:1,
    price:268.40,  chg:-0.88 },
];

// ─── GRADE HELPER ─────────────────────────────────────────────────────────
const gradeOf = (score) =>
  score >= 8.5 ? "A+" : score >= 7.5 ? "A" : score >= 6.5 ? "B+" :
  score >= 5.5 ? "B" : score >= 4.5 ? "C" : "D";
const gradeColor = (g) =>
  g==="A+"?C.gold : g==="A"?C.green : g==="B+"?"#6DD68A" :
  g==="B"?C.teal  : g==="C"?C.amber : C.red;

// ─── MINI SCORE BAR ────────────────────────────────────────────────────────
function ScoreBar({ val, max=10, color, width=60, height=6 }) {
  return (
    <div style={{ width, height, background:C.border,
      borderRadius:3, overflow:"hidden" }}>
      <div style={{ height:"100%", borderRadius:3,
        background:color, width:`${(val/max)*100}%`,
        transition:"width 0.3s" }}/>
    </div>
  );
}

// ─── SCORE DIAL (inline, small) ────────────────────────────────────────────
function MiniDial({ score, size=40 }) {
  const r=size/2-4, circ=2*Math.PI*r, dash=(score/10)*circ;
  const col=score>=7.5?C.gold:score>=6?C.green:score>=4?C.amber:C.red;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={C.border} strokeWidth="3"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={col} strokeWidth="3"
        strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <text x={size/2} y={size/2+4} textAnchor="middle"
        fontSize="10" fontWeight="700" fill={col}>{score}</text>
    </svg>
  );
}

// ─── SET ALERT MODAL ───────────────────────────────────────────────────────
function AlertModal({ stock, scores, confluence, onClose }) {
  const [threshold, setThreshold] = useState((scores.total + 0.5).toFixed(1));
  const [alertTypes, setAlertTypes] = useState({
    lp_aligned:true, lp_conflict:true,
    score_threshold:true, phase_change:false,
  });
  const toggle = (k) => setAlertTypes(a => ({...a, [k]:!a[k]}));

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000080",
      zIndex:100, display:"flex", alignItems:"center",
      justifyContent:"center" }}>
      <div style={{ background:C.panel, border:`1px solid ${C.border}`,
        borderRadius:"6px", padding:"20px", width:"380px",
        boxShadow:"0 8px 40px #00000080" }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between",
          alignItems:"center", marginBottom:"16px" }}>
          <div>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:"14px",
              color:C.gold, letterSpacing:"0.1em" }}>
              SET ALERT — {stock.symbol}
            </div>
            <div style={{ fontSize:"10px", color:C.textDim }}>
              Current score: {scores.total} · {stock.sector}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background:"transparent", border:"none",
              color:C.textDim, cursor:"pointer",
              fontSize:"16px", padding:"2px 6px" }}>✕</button>
        </div>

        {/* Alert types */}
        <div style={{ marginBottom:"14px" }}>
          <div style={{ fontSize:"9px", color:C.textDim,
            letterSpacing:"0.1em", marginBottom:"8px" }}>ALERT TRIGGERS</div>
          {[
            { k:"lp_aligned",      label:"LP + Finastro ALIGNED", desc:"When LP BUY fires on favorable day", color:C.gold },
            { k:"lp_conflict",     label:"LP × Panchang CONFLICT", desc:"LP BUY during AVOID — warns to skip", color:C.red },
            { k:"score_threshold", label:"Score ≥ Threshold",       desc:`Score crosses ${threshold}`, color:C.green },
            { k:"phase_change",    label:"Phase Change",             desc:"Sector rotation phase updates", color:C.purple },
          ].map(({ k, label, desc, color }) => (
            <div key={k} onClick={() => toggle(k)}
              style={{ display:"flex", gap:"10px", padding:"8px 10px",
                marginBottom:"4px", cursor:"pointer", borderRadius:"3px",
                background:alertTypes[k] ? color+"12" : "transparent",
                border:`1px solid ${alertTypes[k] ? color+"50" : C.border}`,
                transition:"all 0.1s", alignItems:"center" }}>
              <div style={{ width:"16px", height:"16px", borderRadius:"3px",
                background:alertTypes[k] ? color : "transparent",
                border:`1px solid ${color}`,
                display:"flex", alignItems:"center",
                justifyContent:"center", flexShrink:0 }}>
                {alertTypes[k] &&
                  <span style={{ color:"#000", fontSize:"10px", fontWeight:"700" }}>✓</span>}
              </div>
              <div>
                <div style={{ fontSize:"11px",
                  color:alertTypes[k] ? C.text : C.textMid }}>{label}</div>
                <div style={{ fontSize:"9px", color:C.textDim }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Score threshold */}
        <div style={{ marginBottom:"14px", padding:"10px",
          background:"#0A0E14", borderRadius:"3px",
          border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:"9px", color:C.textDim,
            letterSpacing:"0.08em", marginBottom:"6px" }}>SCORE THRESHOLD</div>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <input type="range" min="1" max="10" step="0.5"
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
              style={{ flex:1, accentColor:C.gold }}/>
            <span style={{ fontSize:"16px", fontWeight:"700",
              color:C.gold, minWidth:"32px",
              textAlign:"right" }}>{threshold}</span>
          </div>
          <div style={{ fontSize:"9px", color:C.textDim, marginTop:"4px" }}>
            Current: {scores.total} / Threshold: {threshold}
          </div>
        </div>

        {/* Delivery */}
        <div style={{ marginBottom:"14px", padding:"8px 10px",
          background:"#0A0E14", borderRadius:"3px",
          border:`1px solid ${C.border}`, fontSize:"10px" }}>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <span style={{ color:C.textDim }}>In-App Feed</span>
            <span style={{ color:C.green }}>● Active</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between",
            marginTop:"4px" }}>
            <span style={{ color:C.textDim }}>WhatsApp (MSG91)</span>
            <span style={{ color:C.textDim,
              fontSize:"9px" }}>Sprint 5 delivery</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display:"flex", gap:"8px" }}>
          <button onClick={onClose}
            style={{ flex:1, padding:"9px", background:"transparent",
              border:`1px solid ${C.border}`, borderRadius:"4px",
              color:C.textDim, cursor:"pointer", fontSize:"11px" }}>
            CANCEL
          </button>
          <button onClick={onClose}
            style={{ flex:2, padding:"9px", background:C.gold+"22",
              border:`1px solid ${C.gold}60`, borderRadius:"4px",
              color:C.gold, cursor:"pointer", fontSize:"11px",
              fontWeight:"700", letterSpacing:"0.06em" }}>
            🔔 SET ALERTS
          </button>
        </div>

        <div style={{ marginTop:"10px", fontSize:"9px",
          color:C.teal, textAlign:"center" }}>
          🔄 Writes to km_finastro_alerts · Reads km_daily_panchang
        </div>
      </div>
    </div>
  );
}

// ─── STOCK DETAIL DRAWER ───────────────────────────────────────────────────
function StockDrawer({ stock, scores, confluence, onClose, onSetAlert }) {
  const phaseData = PHASES[stock.phase] || {};
  const chgCol = stock.chg >= 0 ? C.green : C.red;

  return (
    <div style={{ position:"fixed", right:0, top:0, bottom:0,
      width:"340px", background:C.panel,
      border:`1px solid ${C.border}`,
      borderRight:"none", zIndex:50,
      overflowY:"auto", padding:"16px",
      boxShadow:"-8px 0 32px #00000060" }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"flex-start", marginBottom:"14px" }}>
        <div>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:"16px",
            color:C.gold, letterSpacing:"0.1em" }}>{stock.symbol}</div>
          <div style={{ fontSize:"10px", color:C.textDim }}>{stock.name}</div>
          <div style={{ fontSize:"10px", color:C.textDim }}>
            {stock.sector} · ₹{stock.price.toLocaleString()}
            <span style={{ color:chgCol, marginLeft:"6px" }}>
              {stock.chg >= 0 ? "+" : ""}{stock.chg}%
            </span>
          </div>
        </div>
        <button onClick={onClose}
          style={{ background:"transparent", border:"none",
            color:C.textDim, cursor:"pointer", fontSize:"16px" }}>✕</button>
      </div>

      {/* Score dial + grade */}
      <div style={{ display:"flex", gap:"12px", alignItems:"center",
        padding:"12px", background:"#0A0E14",
        borderRadius:"4px", border:`1px solid ${C.border}`,
        marginBottom:"12px" }}>
        <MiniDial score={scores.total} size={56}/>
        <div>
          <div style={{ fontSize:"9px", color:C.textDim,
            letterSpacing:"0.08em" }}>HONEST SCORE</div>
          <div style={{ fontSize:"24px", fontWeight:"700",
            color:gradeColor(gradeOf(scores.total)) }}>
            {gradeOf(scores.total)}
          </div>
          <div style={{ fontSize:"9px", color:C.textDim }}>{scores.total} / 10</div>
        </div>
        <div style={{ marginLeft:"auto", textAlign:"right" }}>
          <div style={{ fontSize:"9px", color:C.textDim,
            marginBottom:"2px" }}>CONFLUENCE</div>
          <div style={{ fontSize:"13px", fontWeight:"700",
            color:confluence.color }}>{confluence.badge}</div>
          {confluence.combined && (
            <div style={{ fontSize:"10px", color:C.gold }}>
              {confluence.combined}/10
            </div>
          )}
        </div>
      </div>

      {/* Score breakdown */}
      <div style={{ background:"#0A0E14", borderRadius:"4px",
        border:`1px solid ${C.border}`, padding:"10px",
        marginBottom:"12px" }}>
        <div style={{ fontSize:"8px", color:C.textDim,
          letterSpacing:"0.1em", marginBottom:"8px" }}>SCORE BREAKDOWN</div>
        {[
          { label:"Technical (LP)", pct:"60%", val:scores.tech,
            raw:scores.techRaw, color:C.teal, max:6 },
          { label:"Panchang ✓", pct:"20%", val:scores.intraday,
            raw:scores.intraday_raw, color:C.green, max:2 },
          { label:"Planetary ~", pct:"20%", val:scores.planetary,
            raw:scores.planetary_raw, color:C.amber, max:2 },
        ].map((b, i) => (
          <div key={i} style={{ marginBottom:"8px" }}>
            <div style={{ display:"flex", justifyContent:"space-between",
              fontSize:"10px", marginBottom:"3px" }}>
              <span style={{ color:C.textDim }}>{b.label}</span>
              <div style={{ display:"flex", gap:"8px" }}>
                <span style={{ color:C.textDim, fontSize:"9px" }}>{b.pct}</span>
                <span style={{ color:b.color, fontWeight:"700" }}>
                  {b.val > 0 ? "+" : ""}{b.val}
                </span>
              </div>
            </div>
            <div style={{ background:C.border, height:"5px",
              borderRadius:"3px", overflow:"hidden" }}>
              <div style={{ height:"100%", borderRadius:"3px",
                background:b.val < 0 ? C.red : b.color,
                width:`${Math.max(0, Math.abs(b.val) / b.max * 100)}%` }}/>
            </div>
          </div>
        ))}
        <div style={{ borderTop:`1px solid ${C.border}`,
          paddingTop:"8px", display:"flex",
          justifyContent:"space-between", fontSize:"11px" }}>
          <span style={{ color:C.textDim }}>TOTAL</span>
          <span style={{ fontWeight:"700",
            color:gradeColor(gradeOf(scores.total)) }}>
            {scores.total} / 10
          </span>
        </div>
      </div>

      {/* LP details */}
      <div style={{ background:"#0A0E14", borderRadius:"4px",
        border:`1px solid ${C.border}`, padding:"10px",
        marginBottom:"12px" }}>
        <div style={{ fontSize:"8px", color:C.textDim,
          letterSpacing:"0.1em", marginBottom:"8px" }}>LUCKYPOP</div>
        <div style={{ display:"flex", justifyContent:"space-between",
          alignItems:"center", marginBottom:"8px" }}>
          <span style={{ fontSize:"13px", fontWeight:"700",
            color:lpColor(stock.lpSignal) }}>{stock.lpSignal}</span>
          <span style={{ fontSize:"18px", fontWeight:"700",
            color:lpColor(stock.lpSignal) }}>
            {stock.lpScore > 0 ? "+" : ""}{stock.lpScore}
          </span>
        </div>
        <div style={{ display:"grid",
          gridTemplateColumns:"1fr 1fr 1fr", gap:"5px" }}>
          {[
            { l:"RVOL", v:`${stock.lpRvol}x`,
              c:stock.lpRvol >= 1.5 ? C.green : stock.lpRvol >= 1.0 ? C.amber : C.red },
            { l:"BQ",   v:`${stock.lpBq}/6`,
              c:stock.lpBq >= 5 ? C.gold : stock.lpBq >= 3 ? C.green : C.amber },
            { l:"MRS",  v:`${stock.lpMagicRS}/6`,
              c:stock.lpMagicRS >= 5 ? C.green : stock.lpMagicRS >= 3 ? C.amber : C.red },
          ].map((m, i) => (
            <div key={i} style={{ background:C.bg, padding:"5px",
              borderRadius:"3px", textAlign:"center",
              border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:"8px", color:C.textDim }}>{m.l}</div>
              <div style={{ fontSize:"11px", fontWeight:"700",
                color:m.c }}>{m.v}</div>
            </div>
          ))}
        </div>
        {stock.lpDot !== "NONE" && (
          <div style={{ marginTop:"6px", fontSize:"10px",
            color:stock.lpDot==="SVD"?C.purple:stock.lpDot==="SBD"?C.blue:C.amber,
            padding:"4px 8px", background:"#0D1016",
            borderRadius:"3px", textAlign:"center" }}>
            ● {stock.lpDot} — {
              stock.lpDot==="SVD" ? "Institutional buy signal" :
              stock.lpDot==="SBD" ? "Accumulation signal" :
              "Distribution signal — caution"}
          </div>
        )}
      </div>

      {/* Phase */}
      <div style={{ padding:"10px", background:"#0A0E14",
        borderRadius:"4px", border:`1px solid ${C.border}`,
        marginBottom:"12px" }}>
        <div style={{ fontSize:"8px", color:C.textDim,
          letterSpacing:"0.1em", marginBottom:"6px" }}>SECTOR PHASE</div>
        <div style={{ display:"flex", justifyContent:"space-between",
          alignItems:"center" }}>
          <div>
            <span style={{ fontSize:"14px", color:phaseData.color,
              marginRight:"6px" }}>{phaseData.icon}</span>
            <span style={{ fontSize:"12px", fontWeight:"700",
              color:phaseData.color }}>{stock.phase}</span>
          </div>
          <span style={{ fontSize:"10px",
            color:stock.planetTier==="validated"?C.green:C.amber }}>
            {stock.planetTier==="validated"?"✓ Validated":"~ Indicative"}
          </span>
        </div>
        <div style={{ fontSize:"10px", color:C.textDim,
          marginTop:"4px" }}>
          Score adj: {phaseData.scoreAdj > 0 ? "+" : ""}{phaseData.scoreAdj} pts
        </div>
      </div>

      {/* Action */}
      <div style={{ padding:"10px", background:confluence.color+"12",
        border:`1px solid ${confluence.color}40`,
        borderRadius:"4px", marginBottom:"12px",
        textAlign:"center" }}>
        <div style={{ fontSize:"12px", fontWeight:"700",
          color:confluence.color, marginBottom:"4px" }}>
          {confluence.badge}
        </div>
        <div style={{ fontSize:"10px", color:C.textMid }}>
          {confluence.action}
        </div>
      </div>

      {/* Set Alert button */}
      <button onClick={onSetAlert}
        style={{ width:"100%", padding:"11px",
          background:C.gold+"22", border:`1px solid ${C.gold}60`,
          borderRadius:"4px", color:C.gold, cursor:"pointer",
          fontSize:"12px", fontWeight:"700",
          letterSpacing:"0.08em" }}>
        🔔 SET ALERT FOR {stock.symbol}
      </button>

      <div style={{ marginTop:"8px", fontSize:"9px",
        color:C.teal, textAlign:"center" }}>
        🔄 km_equity_eod · km_daily_panchang · km_finastro_alerts
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function FinastroScreen4v3() {
  const [sortBy, setSortBy]     = useState("honest");
  const [filterSector, setFilterSector] = useState("all");
  const [filterPhase, setFilterPhase]   = useState("all");
  const [filterGrade, setFilterGrade]   = useState("all");
  const [filterConf, setFilterConf]     = useState("all");
  const [selectedStock, setSelectedStock] = useState(null);
  const [alertStock, setAlertStock]     = useState(null);
  const [time, setTime]         = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const nowIST = time.toLocaleTimeString("en-IN",
    { timeZone:"Asia/Kolkata", hour12:false }).slice(0, 5);
  const inRahu = nowIST >= PANCHANG.rahuKala.start
    && nowIST < PANCHANG.rahuKala.end;
  const inAbhijit = nowIST >= PANCHANG.abhijit.start
    && nowIST < PANCHANG.abhijit.end;

  // Compute scores + confluence for all stocks
  const enriched = STOCKS.map(s => {
    const scores    = computeHonestScore(s, PANCHANG);
    const confluence = getConfluence(s.lpSignal, s.lpScore, s, PANCHANG, nowIST);
    return { ...s, scores, confluence };
  });

  // Sort
  const sorted = [...enriched].sort((a, b) => {
    if (sortBy === "honest")    return b.scores.total - a.scores.total;
    if (sortBy === "lp")        return b.lpScore - a.lpScore;
    if (sortBy === "rvol")      return b.lpRvol - a.lpRvol;
    if (sortBy === "bq")        return b.lpBq - a.lpBq;
    if (sortBy === "magicrs")   return b.lpMagicRS - a.lpMagicRS;
    return 0;
  });

  // Filter
  const sectors = ["all", ...new Set(STOCKS.map(s => s.sector))];
  const filtered = sorted.filter(s => {
    if (filterSector !== "all" && s.sector !== filterSector) return false;
    if (filterPhase  !== "all" && s.phase  !== filterPhase)  return false;
    if (filterGrade  !== "all" && gradeOf(s.scores.total) !== filterGrade) return false;
    if (filterConf   !== "all") {
      const v = s.confluence.verdict;
      if (filterConf === "aligned"   && !["ALIGNED","PARTIAL"].includes(v)) return false;
      if (filterConf === "conflict"  && !["HARD_CONFLICT","RAHU_OVERRIDE","YOGA_OVERRIDE","BEAR_ALIGNED"].includes(v)) return false;
      if (filterConf === "watch"     && v !== "WATCH") return false;
      if (filterConf === "lp_signal" && s.lpScore === 0) return false;
    }
    return true;
  });

  // Summary stats
  const alignedN  = enriched.filter(s => ["ALIGNED","PARTIAL"].includes(s.confluence.verdict)).length;
  const conflictN = enriched.filter(s => ["HARD_CONFLICT","RAHU_OVERRIDE","YOGA_OVERRIDE"].includes(s.confluence.verdict)).length;
  const watchN    = enriched.filter(s => s.confluence.verdict === "WATCH").length;
  const topScore  = enriched.reduce((m, s) => Math.max(m, s.scores.total), 0);

  const st = {
    pill:(a,col)=>({
      padding:"4px 10px", borderRadius:"3px", cursor:"pointer",
      fontSize:"10px", letterSpacing:"0.05em", fontWeight:"600",
      border:`1px solid ${a?(col||C.gold)+"60":C.border}`,
      background:a?(col||C.gold)+"18":"transparent",
      color:a?(col||C.gold):C.textDim, transition:"all 0.15s",
    }),
    sortBtn:(a)=>({
      padding:"4px 10px", borderRadius:"3px", cursor:"pointer",
      fontSize:"10px", letterSpacing:"0.05em", fontWeight:"600",
      border:`1px solid ${a?C.teal+"60":C.border}`,
      background:a?C.teal+"18":"transparent",
      color:a?C.teal:C.textDim,
    }),
  };

  return (
    <div style={{ fontFamily:"'DM Mono','Courier New',monospace",
      background:C.bg, color:C.text, minHeight:"100vh",
      fontSize:"13px" }}>

      {/* HEADER */}
      <div style={{ background:C.panel, borderBottom:`1px solid ${C.border}`,
        padding:"12px 20px", display:"flex",
        alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:"17px",
            color:C.gold, letterSpacing:"0.15em" }}>
            FINASTRO · SIGNAL SCREENER
          </div>
          <div style={{ fontSize:"10px", color:C.textDim,
            letterSpacing:"0.1em" }}>
            Screen 4 v3 · Sprint 6 · Honest Score 60/20/20 · {enriched.length} stocks
          </div>
        </div>
        <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
          {/* Context pills */}
          {inRahu && (
            <span style={{ padding:"4px 10px", background:C.redDim,
              border:`1px solid ${C.red}60`, borderRadius:"3px",
              fontSize:"10px", color:C.red, fontWeight:"700" }}>
              ☊ RAHU — NO ENTRIES
            </span>
          )}
          {inAbhijit && (
            <span style={{ padding:"4px 10px", background:C.greenDim,
              border:`1px solid ${C.green}60`, borderRadius:"3px",
              fontSize:"10px", color:C.green, fontWeight:"700" }}>
              ☀ ABHIJIT ACTIVE
            </span>
          )}
          {[
            {l:"ALIGNED", v:alignedN,  c:C.green},
            {l:"CONFLICT",v:conflictN, c:C.red},
            {l:"WATCH",   v:watchN,    c:C.purple},
            {l:"TOP SCORE",v:topScore, c:C.gold},
          ].map(s => (
            <div key={s.l} style={{ background:C.bg,
              border:`1px solid ${C.border}`, borderRadius:"3px",
              padding:"4px 10px", textAlign:"center" }}>
              <div style={{ fontSize:"8px", color:C.textDim,
                letterSpacing:"0.07em" }}>{s.l}</div>
              <div style={{ fontSize:"14px", fontWeight:"700",
                color:s.c }}>{s.v}</div>
            </div>
          ))}
          <div style={{ fontFamily:"monospace", fontSize:"12px",
            color:C.gold }}>{nowIST} IST</div>
        </div>
      </div>

      {/* FORMULA BAR */}
      <div style={{ background:"#0D1420",
        borderBottom:`1px solid ${C.border}`,
        padding:"6px 20px", display:"flex",
        gap:"16px", alignItems:"center",
        fontSize:"10px", flexWrap:"wrap" }}>
        <span style={{ color:C.textDim,
          letterSpacing:"0.08em" }}>HONEST SCORE:</span>
        <span style={{ color:C.teal }}>TECH 60%</span>
        <span style={{ color:C.textDim }}>+</span>
        <span style={{ color:C.green }}>PANCHANG ✓ 20%</span>
        <span style={{ color:C.textDim }}>+</span>
        <span style={{ color:C.amber }}>PLANETARY ~ 20%
          (½ if indicative, 0 if unvalidated)</span>
        <span style={{ marginLeft:"auto", color:C.textDim }}>
          {PANCHANG.qualityLabel} SESSION ·{" "}
          {PANCHANG.yoga} Yoga ·{" "}
          {PANCHANG.jupiterCancer && "♃ Cancer "}
          {PANCHANG.mercuryRetro && "☿ ℞"}
        </span>
      </div>

      {/* FILTERS + SORT */}
      <div style={{ background:C.panel,
        borderBottom:`1px solid ${C.border}`,
        padding:"8px 20px", display:"flex",
        gap:"12px", alignItems:"center",
        flexWrap:"wrap" }}>

        {/* Sector filter */}
        <div style={{ display:"flex", gap:"4px",
          alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ fontSize:"9px", color:C.textDim,
            letterSpacing:"0.08em", marginRight:"2px" }}>SECTOR</span>
          {sectors.map(s => (
            <button key={s} onClick={() => setFilterSector(s)}
              style={st.pill(filterSector===s)}>
              {s === "all" ? "ALL" : s}
            </button>
          ))}
        </div>

        <div style={{ width:"1px", height:"24px",
          background:C.border, flexShrink:0 }}/>

        {/* Phase filter */}
        <div style={{ display:"flex", gap:"4px", alignItems:"center" }}>
          <span style={{ fontSize:"9px", color:C.textDim,
            letterSpacing:"0.08em", marginRight:"2px" }}>PHASE</span>
          {["all","LEADING","ENTERING","PEAKING","ROTATING OUT","NEGLECTED"].map(p => (
            <button key={p} onClick={() => setFilterPhase(p)}
              style={st.pill(filterPhase===p, p!=="all"?PHASES[p]?.color:C.gold)}>
              {p === "all" ? "ALL" : `${PHASES[p]?.icon||""} ${p}`}
            </button>
          ))}
        </div>

        <div style={{ width:"1px", height:"24px",
          background:C.border, flexShrink:0 }}/>

        {/* Confluence filter */}
        <div style={{ display:"flex", gap:"4px", alignItems:"center" }}>
          <span style={{ fontSize:"9px", color:C.textDim,
            letterSpacing:"0.08em", marginRight:"2px" }}>LP+FIN</span>
          {[
            ["all","ALL",C.gold],["aligned","ALIGNED",C.green],
            ["conflict","CONFLICT",C.red],["watch","WATCH",C.purple],
            ["lp_signal","LP SIGNAL",C.teal],
          ].map(([k,l,c]) => (
            <button key={k} onClick={() => setFilterConf(k)}
              style={st.pill(filterConf===k, c)}>{l}</button>
          ))}
        </div>

        <div style={{ marginLeft:"auto", display:"flex",
          gap:"4px", alignItems:"center" }}>
          <span style={{ fontSize:"9px", color:C.textDim,
            letterSpacing:"0.08em", marginRight:"2px" }}>SORT</span>
          {[
            ["honest","SCORE"],["lp","LP"],["rvol","RVOL"],
            ["bq","BQ"],["magicrs","MRS"],
          ].map(([k,l]) => (
            <button key={k} onClick={() => setSortBy(k)}
              style={st.sortBtn(sortBy===k)}>{l}</button>
          ))}
        </div>
      </div>

      {/* TABLE HEADER */}
      <div style={{ background:"#0C0F14",
        borderBottom:`1px solid ${C.border}`,
        padding:"6px 20px",
        display:"grid",
        gridTemplateColumns:"130px 100px 120px 80px 60px 60px 60px 100px 90px 1fr 80px",
        gap:"8px", fontSize:"9px",
        letterSpacing:"0.09em", color:C.textDim }}>
        <span>SYMBOL</span>
        <span>SECTOR</span>
        <span>PHASE ⬡</span>
        <span style={{ color:C.teal }}>TECH</span>
        <span style={{ color:C.green }}>PAN</span>
        <span style={{ color:C.amber }}>PLAN</span>
        <span style={{ color:C.gold }}>HONEST</span>
        <span style={{ color:C.purple }}>★ LP SIGNAL</span>
        <span style={{ color:C.gold }}>★ CONFLUENCE</span>
        <span>★ ACTION</span>
        <span style={{ textAlign:"center" }}>★ ALERT</span>
      </div>

      {/* ROWS */}
      <div style={{ overflowY:"auto",
        maxHeight:"calc(100vh - 280px)" }}>
        {filtered.map((s, i) => {
          const { scores, confluence } = s;
          const grade = gradeOf(scores.total);
          const phaseD = PHASES[s.phase] || {};
          const isSelected = selectedStock?.symbol === s.symbol;
          const lpCol = lpColor(s.lpSignal);
          const dotColors = { SVD:C.purple, SBD:C.blue, SYD:C.amber };
          const chgCol = s.chg >= 0 ? C.green : C.red;

          return (
            <div key={s.symbol}
              style={{ display:"grid",
                gridTemplateColumns:"130px 100px 120px 80px 60px 60px 60px 100px 90px 1fr 80px",
                gap:"8px", padding:"8px 20px",
                background:isSelected ? "#141820" : i%2===0 ? "#0B0D11" : C.bg,
                borderLeft:`3px solid ${isSelected ? C.gold : "transparent"}`,
                borderBottom:`1px solid ${C.border}22`,
                alignItems:"center", cursor:"pointer",
                transition:"background 0.1s" }}>

              {/* Symbol */}
              <div onClick={() => setSelectedStock(isSelected ? null : s)}>
                <div style={{ fontSize:"12px", color:C.text,
                  fontWeight:"700" }}>{s.symbol}</div>
                <div style={{ fontSize:"9px",
                  color:chgCol }}>{s.chg >= 0 ? "+" : ""}{s.chg}%</div>
              </div>

              {/* Sector */}
              <div onClick={() => setSelectedStock(isSelected ? null : s)}
                style={{ fontSize:"10px", color:C.textMid }}>
                {s.sector}
              </div>

              {/* Phase */}
              <div onClick={() => setSelectedStock(isSelected ? null : s)}>
                <div style={{ display:"flex", alignItems:"center",
                  gap:"4px" }}>
                  <span style={{ color:phaseD.color }}>{phaseD.icon}</span>
                  <span style={{ fontSize:"10px",
                    color:phaseD.color }}>{s.phase}</span>
                </div>
                <div style={{ fontSize:"8px",
                  color:s.planetTier==="validated"?C.green:C.amber }}>
                  {s.planetTier==="validated"?"✓ valid":"~ indic"}
                </div>
              </div>

              {/* Tech */}
              <div onClick={() => setSelectedStock(isSelected ? null : s)}>
                <div style={{ fontSize:"11px", color:C.teal,
                  fontWeight:"700" }}>{scores.techRaw}</div>
                <ScoreBar val={scores.techRaw} max={10}
                  color={C.teal} width={56} height={4}/>
              </div>

              {/* Panchang */}
              <div onClick={() => setSelectedStock(isSelected ? null : s)}
                style={{ fontSize:"11px", fontWeight:"700",
                  color:scores.intraday > 0 ? C.green : C.textDim }}>
                +{scores.intraday}
              </div>

              {/* Planetary */}
              <div onClick={() => setSelectedStock(isSelected ? null : s)}
                style={{ fontSize:"11px", fontWeight:"700",
                  color:scores.planetary > 0 ? C.amber :
                    scores.planetary < 0 ? C.red : C.textDim }}>
                {scores.planetary > 0 ? "+" : ""}{scores.planetary}
              </div>

              {/* Honest Score */}
              <div onClick={() => setSelectedStock(isSelected ? null : s)}
                style={{ display:"flex", alignItems:"center",
                  gap:"6px" }}>
                <MiniDial score={scores.total} size={36}/>
                <span style={{ fontSize:"12px", fontWeight:"700",
                  color:gradeColor(grade) }}>{grade}</span>
              </div>

              {/* ★ LP Signal */}
              <div onClick={() => setSelectedStock(isSelected ? null : s)}>
                <div style={{ display:"flex", alignItems:"center",
                  gap:"3px" }}>
                  <span style={{ fontSize:"11px", fontWeight:"700",
                    color:lpCol }}>
                    {lpDir(s.lpScore)}{" "}
                    {s.lpScore !== 0
                      ? `${s.lpScore > 0 ? "+" : ""}${s.lpScore}`
                      : "—"}
                  </span>
                </div>
                <div style={{ fontSize:"8px", color:lpCol,
                  overflow:"hidden", whiteSpace:"nowrap",
                  textOverflow:"ellipsis", maxWidth:"90px" }}>
                  {s.lpSignal}
                </div>
                {s.lpDot !== "NONE" && (
                  <div style={{ fontSize:"8px",
                    color:dotColors[s.lpDot] || C.textDim }}>
                    ●{s.lpDot} R{s.lpRvol}x
                  </div>
                )}
              </div>

              {/* ★ Confluence badge */}
              <div onClick={() => setSelectedStock(isSelected ? null : s)}>
                <div style={{ fontSize:"10px", fontWeight:"700",
                  color:confluence.color }}>
                  {confluence.badge}
                </div>
                {confluence.combined && (
                  <div style={{ fontSize:"9px",
                    color:C.gold }}>{confluence.combined}/10</div>
                )}
              </div>

              {/* ★ Action */}
              <div onClick={() => setSelectedStock(isSelected ? null : s)}
                style={{ fontSize:"9px", color:confluence.color,
                  lineHeight:"1.5" }}>
                {confluence.action}
              </div>

              {/* ★ Set Alert button */}
              <div style={{ textAlign:"center" }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAlertStock(s);
                  }}
                  style={{ padding:"4px 8px",
                    background:C.gold+"18",
                    border:`1px solid ${C.gold}50`,
                    borderRadius:"3px", color:C.gold,
                    cursor:"pointer", fontSize:"10px",
                    fontWeight:"700",
                    letterSpacing:"0.04em" }}>
                  🔔
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* FOOTER SUMMARY */}
      <div style={{ background:"#0D1016",
        borderTop:`1px solid ${C.border}`,
        padding:"7px 20px", display:"flex",
        gap:"16px", alignItems:"center",
        fontSize:"10px", flexWrap:"wrap" }}>
        <span style={{ color:C.textDim }}>
          Showing <strong style={{ color:C.text }}>{filtered.length}</strong>
          {" "}of {enriched.length} stocks
        </span>
        <span style={{ color:C.textDim }}>·</span>
        <span style={{ color:C.green }}>
          {alignedN} aligned
        </span>
        <span style={{ color:C.red }}>
          {conflictN} hard conflict
        </span>
        <span style={{ color:C.purple }}>
          {watchN} watch mode
        </span>
        {inRahu && (
          <span style={{ color:C.red,
            fontWeight:"700" }}>
            ☊ Rahu Kala active — aligned signals queued, not actionable until {PANCHANG.rahuKala.end}
          </span>
        )}
        <span style={{ marginLeft:"auto",
          fontSize:"9px", color:C.teal }}>
          🔄 km_equity_eod · km_daily_panchang ·
          km_astro_correlation · km_planetary_positions
        </span>
      </div>

      {/* DETAIL DRAWER */}
      {selectedStock && (
        <StockDrawer
          stock={selectedStock}
          scores={selectedStock.scores}
          confluence={selectedStock.confluence}
          onClose={() => setSelectedStock(null)}
          onSetAlert={() => {
            setAlertStock(selectedStock);
            setSelectedStock(null);
          }}/>
      )}

      {/* SET ALERT MODAL */}
      {alertStock && (
        <AlertModal
          stock={alertStock}
          scores={alertStock.scores}
          confluence={alertStock.confluence}
          onClose={() => setAlertStock(null)}/>
      )}
    </div>
  );
}
