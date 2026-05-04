import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// FINASTRO — SCREEN 1: TODAY (Intraday Cockpit) — v2 with LuckyPop
// File: finastro_screen1_v2.jsx  [Sprint 5 update]
//
// CHANGES FROM v1 (842 lines):
//   + 9th Top Strip cell — LP signal type · direction · score
//   + Right Sidebar — LP+FIN confluence badge below score dial
//   + Alert strip between Top Strip and Panchang Band (Sprint 3)
//
// All other screen 1 elements unchanged from v1.
// Reference: Ujjain · Lahiri · Sidereal · IST
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  bg:"#0A0C0F", panel:"#0F1216", border:"#1C2028", borderBright:"#2A3040",
  gold:"#C9A84C", goldDim:"#7A6230", goldBright:"#E8C860",
  green:"#4CAF8A", greenDim:"#2A5A42",
  red:"#E86060", redDim:"#5A2828",
  amber:"#E89040", amberDim:"#6B4520",
  teal:"#40B8C8", tealDim:"#1C5A64",
  purple:"#9B6BC0", purpleDim:"#4A2870",
  text:"#D8DDE8", textDim:"#6A7280", textMid:"#A8B0C0",
};

// ─── PANCHANG DATA (today — 2026-05-04) ───────────────────────────────────
const TODAY = {
  date:"2026-05-04", vaar:"Monday",
  sessionQuality:2, qualityLabel:"NEUTRAL",
  tithi:"Ekadashi", tithiPaksha:"Shukla", tithiChange:"13:40",
  yoga:"Siddhi",    yogaQuality:3, yogaChange:"09:50",
  nakshatra:"Pushya", nakshatraLord:"saturn",
  moonSign:"Cancer", moonElement:"Water",
  moonPhase:0.72,    // waxing gibbous
  rahuKala:{ start:"10:30", end:"12:00" },
  abhijit: { start:"11:48", end:"12:36" },
  sunrise:"06:18",   sunset:"18:44",
  jupiterCancer:true, mercuryRetro:true,
  nextEvent:{ time:"09:50", label:"Yoga → Variyana" },
};

// ─── RAHU KALA ─────────────────────────────────────────────────────────────
const RAHU_BY_DOW = {
  1:{start:"07:30",end:"09:00"},2:{start:"15:00",end:"16:30"},
  3:{start:"12:00",end:"13:30"},4:{start:"13:30",end:"15:00"},
  5:{start:"10:30",end:"12:00"},6:{start:"09:00",end:"10:30"},
};

// ─── LP SIGNAL SCORES ──────────────────────────────────────────────────────
const LP_SCORES = {
  "POWER BUY":10,"STRONG BUY":9,"BUY CONFIRMED":8,"BUY":7,
  "BUY BOOK FAST":6,"ACCUMULATION":5,"SCALP ONLY":4,
  "CAUTION":3,"WAIT":2,"AVOID":1,"NO TRADE":0,
  "POWER SELL":-10,"STRONG SELL":-9,"SELL":-8,
  "SELL BOOK FAST":-7,"SCALP SHORT":-6,
  "DISTRIBUTION":-5,"SQUEEZE RISK":-4,
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

const lpDirection = (sig) => {
  const s = LP_SCORES[sig] ?? 0;
  if (s >= 7) return "▲";
  if (s >= 4) return "~";
  if (s === 0) return "—";
  if (s <= -6) return "▼";
  if (s < 0)  return "~";
  return "—";
};

// ─── CONFLICT VERDICT ──────────────────────────────────────────────────────
function getLPFinVerdict(lpSignal, lpScore, panchang, inRahu, inAbhijit) {
  if (!lpSignal || lpSignal === "NO TRADE" || lpSignal === "WAIT") {
    if (panchang.sessionQuality === 3)
      return { text:"◈ WATCH", color:C.purple, sub:"No LP signal — watch" };
    return { text:"— IDLE", color:C.textDim, sub:"No signal" };
  }
  const isBull = lpScore >= 7;
  const isBear = lpScore <= -6;
  if (inRahu && (isBull || isBear))
    return { text:"✕ RAHU BLOCK", color:C.red, sub:"n=312 · p=0.018" };
  if (isBull && panchang.sessionQuality === 0)
    return { text:"⚠ CONFLICT", color:C.red, sub:"AVOID overrides LP · n=486" };
  if (panchang.yoga === "Vyatipata" || panchang.yoga === "Vaidhriti")
    return { text:"⚠ YOGA BLOCK", color:C.red, sub:"Inauspicious yoga" };
  if (isBull && panchang.sessionQuality === 3) {
    const finBoost = (inAbhijit ? 2 : 0) + (panchang.jupiterCancer ? 1.5 : 0);
    const combined = +((lpScore/10*6*0.6) + (Math.min(4+finBoost,6)*0.4)).toFixed(1);
    return {
      text:`▲▲ ALIGNED ${combined}`, color:C.gold,
      sub:inAbhijit ? "Abhijit ✓ Full size" : "Standard entry",
      combined,
    };
  }
  if (isBull && panchang.sessionQuality === 2)
    return { text:"▲ PARTIAL", color:C.green, sub:"Neutral panchang" };
  if (isBear && panchang.sessionQuality <= 1)
    return { text:"▼▼ BEAR ALIGNED", color:C.red, sub:"Both systems bearish" };
  return { text:"○ LP ONLY", color:C.textMid, sub:"Astro neutral" };
}

// ─── SYNTHETIC OHLCV (intraday NIFTY proxy) ────────────────────────────────
function buildIntradayCandles(sessionQuality) {
  const candles = [];
  const open915 = 22420;
  let price = open915;
  const bias = sessionQuality === 3 ? 0.0004 : sessionQuality === 2 ? 0.00005 : -0.0003;

  for (let m = 0; m < 75; m++) {
    const mins = 9*60 + 15 + m * 5;
    const h = Math.floor(mins / 60);
    const mm = mins % 60;
    const time = `${String(h).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
    const noise = ((m * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff * 2 - 1;
    const ret = bias + noise * 0.0018;
    const o = +price.toFixed(2);
    const c = +(price * (1 + ret)).toFixed(2);
    const hi = +(Math.max(o, c) * (1 + Math.abs(noise) * 0.0004)).toFixed(2);
    const lo = +(Math.min(o, c) * (1 - Math.abs(noise) * 0.0004)).toFixed(2);
    const vol = 8000 + Math.abs(Math.round(noise * 40000));
    candles.push({ time, o, h:hi, l:lo, c, vol, mins });
    price = c;
  }
  return candles;
}

// ─── CONFLUENCE SCORE ──────────────────────────────────────────────────────
function computeConfluence(panchang, inAbhijit, inRahu, lpScore) {
  let score = 0;
  const breakdown = [];

  // Technical proxy (LP score normalised)
  const techScore = lpScore !== null ? Math.max(0, lpScore / 10) * 6 : 3;
  score += techScore * 0.6;
  breakdown.push({ label:"Technical (LP)", val:+(techScore*0.6).toFixed(1), color:C.teal });

  // Intraday panchang
  const panchangScore = inRahu ? 0 :
    panchang.sessionQuality === 3 ? 2 :
    panchang.sessionQuality === 2 ? 1.2 :
    panchang.sessionQuality === 1 ? 0.5 : 0;
  const abhijitBonus = inAbhijit ? 0.8 : 0;
  score += (panchangScore + abhijitBonus) * 0.2;
  breakdown.push({ label:"Panchang ✓", val:+((panchangScore+abhijitBonus)*0.2).toFixed(1), color:C.green });

  // Planetary
  const planScore = panchang.jupiterCancer ? 1.5 : 1.0;
  const mercPenalty = panchang.mercuryRetro ? -0.5 : 0;
  score += Math.max(0, planScore + mercPenalty) * 0.2;
  breakdown.push({ label:"Planetary ~", val:+(Math.max(0,planScore+mercPenalty)*0.2).toFixed(1), color:C.amber });

  return { total:+Math.min(10, score).toFixed(1), breakdown };
}

// ─── TIME UTILITIES ────────────────────────────────────────────────────────
function timeToMins(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minsToTime(m) {
  return `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
}
function sessionPct(t) {
  const open = timeToMins("09:15"), close = timeToMins("15:30");
  const cur = timeToMins(t);
  return Math.max(0, Math.min(1, (cur - open) / (close - open)));
}

// ─── MOON PHASE SVG ────────────────────────────────────────────────────────
function MoonPhaseIcon({ phase, size = 20 }) {
  const emoji = phase < 0.1 ? "🌑" : phase < 0.25 ? "🌒" : phase < 0.4 ? "🌓"
    : phase < 0.6 ? "🌔" : phase < 0.75 ? "🌕" : phase < 0.85 ? "🌖" : phase < 0.95 ? "🌗" : "🌘";
  return <span style={{ fontSize: size }}>{emoji}</span>;
}

// ─── SCORE RING ────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 72, label = "CONFLUENCE" }) {
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  const dash = (score / 10) * circ;
  const color = score >= 7.5 ? C.gold : score >= 6 ? C.green : score >= 4 ? C.amber : C.red;
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={C.border} strokeWidth="4"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}/>
        <text x={size/2} y={size/2 - 4} textAnchor="middle"
          fontSize="16" fontWeight="700" fill={color}>{score}</text>
        <text x={size/2} y={size/2 + 10} textAnchor="middle"
          fontSize="8" fill={C.textDim}>/10</text>
      </svg>
      <div style={{ fontSize:"8px", color:C.textDim, letterSpacing:"0.1em",
        marginTop:"2px" }}>{label}</div>
    </div>
  );
}

// ─── CANDLESTICK SVG CHART ─────────────────────────────────────────────────
function CandlestickChart({ candles, nowMins, rahuStart, rahuEnd,
  abhijitStart, abhijitEnd, changeoverMins }) {
  const W = 680, H = 200;
  const PAD = { t:8, b:8, l:4, r:4 };
  const visible = candles.slice(0, Math.max(1,
    candles.findIndex(c => c.mins > nowMins) || candles.length));
  const all = candles;
  const prices = all.flatMap(c => [c.h, c.l]);
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const range = maxP - minP || 10;

  const cx = (i) => PAD.l + (i / (all.length - 1)) * (W - PAD.l - PAD.r);
  const cy = (p) => PAD.t + (1 - (p - minP) / range) * (H - PAD.t - PAD.b);
  const minsToX = (m) => {
    const open = 9*60+15, close = 15*60+30;
    return PAD.l + ((m - open) / (close - open)) * (W - PAD.l - PAD.r);
  };

  const candleW = Math.max(2, (W - PAD.l - PAD.r) / all.length - 1);

  // Rahu zone
  const rx1 = minsToX(rahuStart), rx2 = minsToX(rahuEnd);
  // Abhijit zone
  const ax1 = minsToX(abhijitStart), ax2 = minsToX(abhijitEnd);
  // Now line
  const nowX = minsToX(Math.min(nowMins, 15*60+30));

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}
      style={{ display:"block", background:"#0A0C0F" }}>
      {/* Rahu zone */}
      <rect x={rx1} y={0} width={Math.max(0,rx2-rx1)} height={H}
        fill={C.red} opacity="0.07"/>
      {/* Abhijit zone */}
      <rect x={ax1} y={0} width={Math.max(0,ax2-ax1)} height={H}
        fill={C.green} opacity="0.07"/>
      {/* Price grid lines */}
      {[0.25, 0.5, 0.75].map((f, i) => {
        const yv = PAD.t + f * (H - PAD.t - PAD.b);
        return <line key={i} x1={PAD.l} y1={yv} x2={W-PAD.r} y2={yv}
          stroke={C.border} strokeWidth="0.5" strokeDasharray="3,3"/>;
      })}
      {/* Changeover verticals */}
      {changeoverMins.map((m, i) => {
        const xv = minsToX(m);
        return (
          <g key={i}>
            <line x1={xv} y1={0} x2={xv} y2={H}
              stroke={C.gold} strokeWidth="0.8" strokeDasharray="4,3" opacity="0.5"/>
          </g>
        );
      })}
      {/* Candles */}
      {all.map((c, i) => {
        const x = cx(i);
        const isFuture = c.mins > nowMins;
        const bull = c.c >= c.o;
        const col = isFuture ? C.border :
          (c.mins >= rahuStart && c.mins < rahuEnd) ? `${C.red}99` :
          bull ? C.green : C.red;
        const bodyTop = cy(Math.max(c.o, c.c));
        const bodyH = Math.max(1, Math.abs(cy(c.o) - cy(c.c)));
        return (
          <g key={i} opacity={isFuture ? 0.3 : 1}>
            <line x1={x} y1={cy(c.h)} x2={x} y2={cy(c.l)}
              stroke={col} strokeWidth="1"/>
            <rect x={x - candleW/2} y={bodyTop}
              width={candleW} height={bodyH}
              fill={bull ? (isFuture ? "transparent" : col) : col}
              stroke={col} strokeWidth="0.5"
              opacity={isFuture ? 0.4 : 1}/>
          </g>
        );
      })}
      {/* NOW line */}
      <line x1={nowX} y1={0} x2={nowX} y2={H}
        stroke={C.gold} strokeWidth="1.5" opacity="0.9"
        style={{ animation:"pulse 1.5s ease-in-out infinite" }}/>
      {/* Zone labels */}
      <text x={(rx1+rx2)/2} y={H-4} textAnchor="middle"
        fontSize="8" fill={C.red} opacity="0.7">☊ RAHU</text>
      <text x={(ax1+ax2)/2} y={H-4} textAnchor="middle"
        fontSize="8" fill={C.green} opacity="0.7">☀ ABHIJIT</text>
    </svg>
  );
}

// ─── PANCHANG BAND ─────────────────────────────────────────────────────────
function PanchangBand({ panchang, nowMins }) {
  const W = 680, H = 28;
  const open = 9*60+15, close = 15*60+30, range = close - open;
  const toX = (m) => ((m - open) / range) * W;
  const nowX = toX(Math.min(nowMins, close));

  const rahuS = timeToMins(panchang.rahuKala.start);
  const rahuE = timeToMins(panchang.rahuKala.end);
  const abhS  = timeToMins(panchang.abhijit.start);
  const abhE  = timeToMins(panchang.abhijit.end);
  const yogaChangeX = panchang.yogaChange ? toX(timeToMins(panchang.yogaChange)) : null;
  const tithiChangeX = panchang.tithiChange ? toX(timeToMins(panchang.tithiChange)) : null;

  const qualColor = panchang.sessionQuality === 3 ? C.green :
    panchang.sessionQuality === 2 ? C.amber :
    panchang.sessionQuality === 1 ? C.amberDim : C.red;

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ display:"block" }}>
      {/* Base quality bar */}
      <rect x={0} y={0} width={W} height={H} fill={qualColor} opacity="0.18"/>
      {/* Rahu — hatched */}
      <defs>
        <pattern id="rahuHatch" x="0" y="0" width="6" height="6"
          patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={C.red} strokeWidth="2" opacity="0.5"/>
        </pattern>
      </defs>
      <rect x={toX(rahuS)} y={0} width={toX(rahuE)-toX(rahuS)} height={H}
        fill="url(#rahuHatch)"/>
      <rect x={toX(rahuS)} y={0} width={toX(rahuE)-toX(rahuS)} height={H}
        fill={C.red} opacity="0.12"/>
      {/* Abhijit — green */}
      <rect x={toX(abhS)} y={0} width={toX(abhE)-toX(abhS)} height={H}
        fill={C.green} opacity="0.28"/>
      {/* Changeover lines */}
      {yogaChangeX && yogaChangeX > 0 && yogaChangeX < W && (
        <g>
          <line x1={yogaChangeX} y1={0} x2={yogaChangeX} y2={H}
            stroke={C.gold} strokeWidth="1.5" opacity="0.8"/>
          <text x={yogaChangeX + 3} y={10} fontSize="7"
            fill={C.gold}>⚡{panchang.yogaChange}</text>
        </g>
      )}
      {tithiChangeX && tithiChangeX > 0 && tithiChangeX < W && (
        <g>
          <line x1={tithiChangeX} y1={0} x2={tithiChangeX} y2={H}
            stroke={C.gold} strokeWidth="1.5" opacity="0.6"/>
          <text x={tithiChangeX + 3} y={20} fontSize="7"
            fill={C.gold}>🌙{panchang.tithiChange}</text>
        </g>
      )}
      {/* Zone labels */}
      <text x={(toX(rahuS)+toX(rahuE))/2} y={H/2+3} textAnchor="middle"
        fontSize="7" fill={C.red} fontWeight="700">☊</text>
      <text x={(toX(abhS)+toX(abhE))/2} y={H/2+3} textAnchor="middle"
        fontSize="7" fill={C.green} fontWeight="700">☀</text>
      {/* NOW pulse */}
      <line x1={nowX} y1={0} x2={nowX} y2={H}
        stroke={C.gold} strokeWidth="2" opacity="0.9"
        style={{ animation:"pulse 1.5s ease-in-out infinite" }}/>
    </svg>
  );
}

// ─── VOLUME BARS ───────────────────────────────────────────────────────────
function VolumeBars({ candles, nowMins, rahuStart, rahuEnd }) {
  const W = 680, H = 36;
  const maxVol = Math.max(...candles.map(c => c.vol));
  const toX = (i) => PAD_L + (i / (candles.length - 1)) * (W - PAD_L - 4);
  const PAD_L = 4;
  const barW = Math.max(2, (W - PAD_L - 4) / candles.length - 1);

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ display:"block", background:"#0A0C0F" }}>
      {candles.map((c, i) => {
        const x = toX(i);
        const h = (c.vol / maxVol) * (H - 4);
        const isFuture = c.mins > nowMins;
        const inRahu = c.mins >= rahuStart && c.mins < rahuEnd;
        const col = isFuture ? C.border : inRahu ? C.red : c.c >= c.o ? C.green : C.red;
        return (
          <rect key={i} x={x - barW/2} y={H - 4 - h}
            width={barW} height={h}
            fill={col} opacity={isFuture ? 0.2 : 0.65}/>
        );
      })}
    </svg>
  );
}

// ─── MOON STRIP ────────────────────────────────────────────────────────────
function MoonStrip({ phase }) {
  const W = 680, H = 20;
  const fillW = phase * W;
  const phaseLabel = phase < 0.1 ? "New Moon" : phase < 0.35 ? "Waxing Crescent"
    : phase < 0.65 ? "Waxing Gibbous" : phase < 0.85 ? "Full Moon" : "Waning Gibbous";
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ display:"block", background:"#070A0D" }}>
      <rect x={0} y={4} width={W} height={8} rx="4"
        fill={C.border} opacity="0.5"/>
      <rect x={0} y={4} width={fillW} height={8} rx="4"
        fill={C.gold} opacity="0.4"/>
      <text x={W/2} y={13} textAnchor="middle" fontSize="8"
        fill={C.textDim}>{phaseLabel} · {(phase*100).toFixed(0)}%</text>
    </svg>
  );
}

// ─── ★ LP SIGNAL CELL (9th cell — NEW in Sprint 5) ──────────────────────
function LPSignalCell({ lpSignal, lpScore, lpDot, lpFlow, lpRvol }) {
  if (!lpSignal || lpSignal === "NO TRADE") {
    return (
      <div style={{ textAlign:"center", padding:"6px 8px" }}>
        <div style={{ fontSize:"9px", color:C.textDim,
          letterSpacing:"0.08em", marginBottom:"3px" }}>LUCKYPOP</div>
        <div style={{ fontSize:"13px", color:C.textDim }}>—</div>
        <div style={{ fontSize:"9px", color:C.textDim }}>No signal</div>
      </div>
    );
  }
  const col = lpColor(lpSignal);
  const dir = lpDirection(lpSignal);
  const dotColors = { SVD:C.purple, SBD:C.blue, SYD:C.amber, NONE:"transparent" };
  return (
    <div style={{ textAlign:"center", padding:"6px 8px",
      background:col+"0A", borderRadius:"3px",
      border:`1px solid ${col}30` }}>
      <div style={{ fontSize:"9px", color:C.textDim,
        letterSpacing:"0.08em", marginBottom:"2px" }}>LUCKYPOP</div>
      <div style={{ display:"flex", alignItems:"center",
        justifyContent:"center", gap:"4px" }}>
        <span style={{ fontSize:"14px", color:col,
          fontWeight:"700" }}>{dir}</span>
        <span style={{ fontSize:"10px", color:col,
          fontWeight:"700" }}>{lpScore > 0 ? "+" : ""}{lpScore}</span>
      </div>
      <div style={{ fontSize:"9px", color:col,
        fontWeight:"600", marginTop:"1px",
        overflow:"hidden", whiteSpace:"nowrap",
        textOverflow:"ellipsis" }}>{lpSignal}</div>
      <div style={{ display:"flex", justifyContent:"center",
        gap:"4px", marginTop:"3px" }}>
        {lpDot && lpDot !== "NONE" && (
          <span style={{ fontSize:"8px",
            color:dotColors[lpDot] || C.textDim }}>● {lpDot}</span>
        )}
        {lpRvol && (
          <span style={{ fontSize:"8px",
            color:lpRvol >= 1.5 ? C.green : C.textDim }}>
            R{lpRvol}x
          </span>
        )}
      </div>
    </div>
  );
}

// ─── ★ LP+FIN CONFLUENCE BADGE (sidebar — NEW in Sprint 5) ───────────────
function LPFinBadge({ verdict, panchang, lpSignal, lpScore }) {
  const isAligned = verdict.text.includes("ALIGNED");
  const isConflict = verdict.text.includes("CONFLICT") || verdict.text.includes("BLOCK");
  const isWatch = verdict.text.includes("WATCH");
  const isIdle = verdict.text.includes("IDLE") || verdict.text.includes("LP ONLY");

  const borderCol = isAligned ? C.gold : isConflict ? C.red :
    isWatch ? C.purple : C.border;
  const bgCol = isAligned ? C.gold+"12" : isConflict ? C.red+"10" :
    isWatch ? C.purple+"10" : "transparent";

  return (
    <div style={{ background:bgCol, border:`1px solid ${borderCol}50`,
      borderRadius:"4px", padding:"10px 12px" }}>
      {/* Header */}
      <div style={{ fontSize:"8px", color:C.textDim,
        letterSpacing:"0.1em", marginBottom:"6px",
        display:"flex", justifyContent:"space-between",
        alignItems:"center" }}>
        <span>LP + FIN CONFLUENCE</span>
        <span style={{ color:C.teal, fontSize:"8px" }}>Sprint 5</span>
      </div>

      {/* LP signal row */}
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginBottom:"6px",
        padding:"5px 8px", background:"#0A0E14",
        borderRadius:"3px", border:`1px solid ${C.border}` }}>
        <span style={{ fontSize:"9px", color:C.textDim }}>LP Signal</span>
        <span style={{ fontSize:"11px", fontWeight:"700",
          color:lpSignal ? lpColor(lpSignal) : C.textDim }}>
          {lpSignal || "— none"}
          {lpScore !== null && lpScore !== 0 &&
            <span style={{ fontSize:"9px", marginLeft:"4px" }}>
              ({lpScore > 0 ? "+" : ""}{lpScore})
            </span>}
        </span>
      </div>

      {/* Panchang row */}
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginBottom:"8px",
        padding:"5px 8px", background:"#0A0E14",
        borderRadius:"3px", border:`1px solid ${C.border}` }}>
        <span style={{ fontSize:"9px", color:C.textDim }}>Panchang</span>
        <span style={{ fontSize:"11px", fontWeight:"700",
          color:panchang.sessionQuality === 3 ? C.green :
            panchang.sessionQuality === 0 ? C.red : C.amber }}>
          {panchang.qualityLabel}
        </span>
      </div>

      {/* Verdict */}
      <div style={{ background:verdict.color+"18",
        border:`1px solid ${verdict.color}50`,
        borderRadius:"3px", padding:"8px 10px", textAlign:"center" }}>
        <div style={{ fontSize:"13px", fontWeight:"700",
          color:verdict.color, letterSpacing:"0.04em" }}>
          {verdict.text}
        </div>
        <div style={{ fontSize:"9px", color:C.textDim,
          marginTop:"3px" }}>{verdict.sub}</div>
        {verdict.combined && (
          <div style={{ fontSize:"10px", color:C.gold,
            marginTop:"4px", fontWeight:"700" }}>
            Combined: {verdict.combined}/10
          </div>
        )}
      </div>

      {/* Action directive */}
      {isAligned && (
        <div style={{ marginTop:"6px", padding:"5px 8px",
          background:C.green+"10", borderRadius:"3px",
          fontSize:"9px", color:C.green, textAlign:"center",
          fontWeight:"700" }}>
          ▲ ENTER — {verdict.sub}
        </div>
      )}
      {isConflict && (
        <div style={{ marginTop:"6px", padding:"5px 8px",
          background:C.red+"10", borderRadius:"3px",
          fontSize:"9px", color:C.red, textAlign:"center",
          fontWeight:"700" }}>
          ✕ SKIP TRADE — Finastro override
        </div>
      )}
      {isWatch && (
        <div style={{ marginTop:"6px", padding:"5px 8px",
          background:C.purple+"10", borderRadius:"3px",
          fontSize:"9px", color:C.purple, textAlign:"center",
          fontWeight:"700" }}>
          ◈ WATCHING — Await LP signal
        </div>
      )}
    </div>
  );
}

// ─── GUIDANCE FOOTER ───────────────────────────────────────────────────────
function GuidanceFooter({ panchang, inRahu, inAbhijit, nowMins, lpVerdict }) {
  const nextChange = panchang.yogaChange
    ? { time:panchang.yogaChange, label:"Yoga changes" }
    : { time:"15:30", label:"Session close" };
  const changeMin = timeToMins(nextChange.time);
  const minsUntil = changeMin - nowMins;

  return (
    <div style={{ background:"#0D1016",
      borderTop:`1px solid ${C.border}`,
      padding:"8px 16px", display:"flex",
      gap:"12px", alignItems:"center",
      flexWrap:"wrap", fontSize:"11px" }}>
      {inRahu ? (
        <span style={{ color:C.red, fontWeight:"700" }}>
          ☊ IN RAHU KALA — No new entries. Stand aside.
          <span style={{ fontSize:"9px", color:C.textDim,
            marginLeft:"6px" }}>✓ n=312, p=0.018</span>
        </span>
      ) : inAbhijit ? (
        <span style={{ color:C.green, fontWeight:"700" }}>
          ☀ ABHIJIT ACTIVE — Best execution window.
          <span style={{ fontSize:"9px", color:C.textDim,
            marginLeft:"6px" }}>✓ n=198, p=0.042</span>
        </span>
      ) : panchang.sessionQuality === 3 ? (
        <span style={{ color:C.green }}>
          ✦ FAVORABLE SESSION — High-conviction entries possible.
        </span>
      ) : panchang.sessionQuality === 0 ? (
        <span style={{ color:C.red, fontWeight:"700" }}>
          ✕ AVOID SESSION — Stand aside all day.
          <span style={{ fontSize:"9px", color:C.textDim,
            marginLeft:"6px" }}>✓ n=486, p=0.028</span>
        </span>
      ) : (
        <span style={{ color:C.amber }}>
          ◎ NEUTRAL ZONE — Standard risk management.
        </span>
      )}
      <span style={{ color:C.gold }}>
        ⚡ NEXT CHANGE {nextChange.time}
        {minsUntil > 0 && minsUntil < 60 &&
          <span style={{ fontSize:"9px", marginLeft:"4px",
            color:C.textDim }}>in {minsUntil}min — tighten stops</span>}
      </span>
      {panchang.jupiterCancer && (
        <span style={{ color:C.gold, fontSize:"10px" }}>
          ♃ JUPITER EXALTED — Bull backdrop.
          <span style={{ fontSize:"8px", color:C.textDim,
            marginLeft:"4px" }}>~ indicative n=3</span>
        </span>
      )}
      {/* LP verdict in footer */}
      {lpVerdict && !lpVerdict.text.includes("IDLE") && (
        <span style={{ color:lpVerdict.color, fontSize:"10px",
          fontWeight:"600", marginLeft:"auto" }}>
          LP: {lpVerdict.text}
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCREEN 1 COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function FinastroScreen1() {
  const [time, setTime] = useState(new Date());
  const [countdown, setCountdown] = useState("");

  // ── LP state (fed from webhook in production) ──────────────────────────
  const [lpSignal, setLpSignal] = useState("STRONG BUY");
  const [lpScore, setLpScore]   = useState(9);
  const [lpDot, setLpDot]       = useState("SVD");
  const [lpFlow, setLpFlow]     = useState("SOLID GREEN");
  const [lpRvol, setLpRvol]     = useState(1.82);
  const [lpTvol, setLpTvol]     = useState(1.14);
  const [lpSymbol, setLpSymbol] = useState("SBIBANK");
  const [lpIb30, setLpIb30]     = useState("BREAK UP");
  const [lpBq, setLpBq]         = useState(5);

  // Simulate LP signal cycling to demo all cases
  const LP_DEMO_CYCLE = [
    { signal:"STRONG BUY", score:9, dot:"SVD", flow:"SOLID GREEN", rvol:1.82, symbol:"SBIBANK" },
    { signal:"POWER BUY",  score:10,dot:"NONE",flow:"SOLID GREEN", rvol:2.14, symbol:"SUNPHARMA" },
    { signal:"NO TRADE",   score:0, dot:"NONE",flow:"GREY",        rvol:0.72, symbol:"RELIANCE" },
    { signal:"SELL",       score:-8,dot:"SYD", flow:"SOLID RED",   rvol:1.56, symbol:"TCS" },
    { signal:"BUY",        score:7, dot:"SBD", flow:"HOLLOW GREEN",rvol:1.24, symbol:"HINDUNILVR" },
  ];
  const cycleRef = useRef(0);

  useEffect(() => {
    const clock = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  // Cycle LP signals every 12s for demo
  useEffect(() => {
    const t = setInterval(() => {
      cycleRef.current = (cycleRef.current + 1) % LP_DEMO_CYCLE.length;
      const s = LP_DEMO_CYCLE[cycleRef.current];
      setLpSignal(s.signal); setLpScore(s.score);
      setLpDot(s.dot); setLpFlow(s.flow);
      setLpRvol(s.rvol); setLpSymbol(s.symbol);
    }, 12000);
    return () => clearInterval(t);
  }, []);

  // IST time string
  const nowIST = time.toLocaleTimeString("en-IN",
    { timeZone:"Asia/Kolkata", hour12:false });
  const nowMins = (() => {
    const ist = new Date(time.toLocaleString("en-US",
      { timeZone:"Asia/Kolkata" }));
    return ist.getHours() * 60 + ist.getMinutes();
  })();

  // Session state
  const SESSION_OPEN  = timeToMins("09:15");
  const SESSION_CLOSE = timeToMins("15:30");
  const inSession = nowMins >= SESSION_OPEN && nowMins < SESSION_CLOSE;

  const rahuStart = timeToMins(TODAY.rahuKala.start);
  const rahuEnd   = timeToMins(TODAY.rahuKala.end);
  const abhStart  = timeToMins(TODAY.abhijit.start);
  const abhEnd    = timeToMins(TODAY.abhijit.end);
  const inRahu    = nowMins >= rahuStart && nowMins < rahuEnd;
  const inAbhijit = nowMins >= abhStart  && nowMins < abhEnd;

  // Candles
  const candles = buildIntradayCandles(TODAY.sessionQuality);
  const changeoverMins = [
    TODAY.yogaChange  ? timeToMins(TODAY.yogaChange)  : null,
    TODAY.tithiChange ? timeToMins(TODAY.tithiChange) : null,
  ].filter(Boolean);

  // Confluence
  const { total:confScore, breakdown } = computeConfluence(
    TODAY, inAbhijit, inRahu, lpScore);

  // LP+FIN verdict
  const lpVerdict = getLPFinVerdict(lpSignal, lpScore, TODAY, inRahu, inAbhijit);

  // Next tithi countdown
  useEffect(() => {
    const target = timeToMins(TODAY.tithiChange);
    const diff = target - nowMins;
    if (diff > 0 && diff < 400) {
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      setCountdown(h > 0 ? `${h}h ${m}m` : `${m}m`);
    } else {
      setCountdown("—");
    }
  }, [nowMins]);

  const qualColor = TODAY.sessionQuality === 3 ? C.green :
    TODAY.sessionQuality === 2 ? C.amber :
    TODAY.sessionQuality === 1 ? C.amberDim : C.red;
  const qualIcon = TODAY.sessionQuality === 3 ? "✦" :
    TODAY.sessionQuality === 2 ? "◎" :
    TODAY.sessionQuality === 1 ? "⚠" : "✕";
  const qualLabel = TODAY.sessionQuality === 3 ? "FAVORABLE" :
    TODAY.sessionQuality === 2 ? "NEUTRAL" :
    TODAY.sessionQuality === 1 ? "CAUTION" : "AVOID";

  // ── 8 original cells ───────────────────────────────────────────────────
  const topCells = [
    // Cell 1 — Session Quality
    <div key="sq" style={{ textAlign:"center", padding:"6px 8px" }}>
      <div style={{ fontSize:"9px", color:C.textDim,
        letterSpacing:"0.08em", marginBottom:"3px" }}>SESSION</div>
      <div style={{ fontSize:"18px", color:qualColor,
        filter:`drop-shadow(0 0 4px ${qualColor}80)` }}>{qualIcon}</div>
      <div style={{ fontSize:"10px", color:qualColor,
        fontWeight:"700" }}>{qualLabel}</div>
    </div>,

    // Cell 2 — Moon
    <div key="moon" style={{ textAlign:"center", padding:"6px 8px" }}>
      <div style={{ fontSize:"9px", color:C.textDim,
        letterSpacing:"0.08em", marginBottom:"2px" }}>MOON</div>
      <MoonPhaseIcon phase={TODAY.moonPhase} size={20}/>
      <div style={{ fontSize:"10px", color:C.teal,
        marginTop:"2px" }}>{TODAY.moonSign}</div>
      <div style={{ fontSize:"8px", color:C.textDim }}>{TODAY.moonElement}</div>
    </div>,

    // Cell 3 — Yoga
    <div key="yoga" style={{ textAlign:"center", padding:"6px 8px" }}>
      <div style={{ fontSize:"9px", color:C.textDim,
        letterSpacing:"0.08em", marginBottom:"3px" }}>YOGA</div>
      <div style={{ fontSize:"12px", fontWeight:"700",
        color:TODAY.yogaQuality === 3 ? C.green : C.amber }}>
        {TODAY.yoga}
      </div>
      <div style={{ fontSize:"9px",
        color:TODAY.yogaQuality === 3 ? C.green : C.amber }}>
        {TODAY.yogaQuality === 3 ? "Favorable" : "Neutral"}
      </div>
    </div>,

    // Cell 4 — Tithi Countdown
    <div key="tithi" style={{ textAlign:"center", padding:"6px 8px" }}>
      <div style={{ fontSize:"9px", color:C.textDim,
        letterSpacing:"0.08em", marginBottom:"3px" }}>TITHI</div>
      <div style={{ fontSize:"11px", color:C.text,
        fontWeight:"700" }}>{TODAY.tithi}</div>
      <div style={{ fontSize:"10px", color:C.gold }}>
        ⚡ {TODAY.tithiChange}
      </div>
      <div style={{ fontSize:"9px", color:C.textDim }}>in {countdown}</div>
    </div>,

    // Cell 5 — Yoga Countdown
    <div key="yogact" style={{ textAlign:"center", padding:"6px 8px" }}>
      <div style={{ fontSize:"9px", color:C.textDim,
        letterSpacing:"0.08em", marginBottom:"3px" }}>YOGA ⚡</div>
      <div style={{ fontSize:"10px", color:C.amber,
        fontWeight:"700" }}>→ Variyana</div>
      <div style={{ fontSize:"10px", color:C.gold }}>{TODAY.yogaChange}</div>
      <div style={{ fontSize:"9px", color:C.textDim }}>IST</div>
    </div>,

    // Cell 6 — Rahu Kala
    <div key="rahu" style={{ textAlign:"center", padding:"6px 8px",
      background: inRahu ? C.redDim+"44" : "transparent",
      borderRadius:"3px",
      border: inRahu ? `1px solid ${C.red}60` : "1px solid transparent" }}>
      <div style={{ fontSize:"9px", color:C.textDim,
        letterSpacing:"0.08em", marginBottom:"3px" }}>RAHU KALA</div>
      <div style={{ fontSize:"10px", color:C.red,
        fontWeight:"700" }}>☊</div>
      <div style={{ fontSize:"10px", color:C.red }}>
        {TODAY.rahuKala.start}
      </div>
      <div style={{ fontSize:"9px", color:C.textDim }}>
        –{TODAY.rahuKala.end}
        {inRahu && <span style={{ color:C.red, marginLeft:"4px",
          fontWeight:"700" }}>ACTIVE</span>}
      </div>
    </div>,

    // Cell 7 — Abhijit
    <div key="abh" style={{ textAlign:"center", padding:"6px 8px",
      background: inAbhijit ? C.greenDim+"44" : "transparent",
      borderRadius:"3px",
      border: inAbhijit ? `1px solid ${C.green}60` : "1px solid transparent" }}>
      <div style={{ fontSize:"9px", color:C.textDim,
        letterSpacing:"0.08em", marginBottom:"3px" }}>ABHIJIT</div>
      <div style={{ fontSize:"10px", color:C.green,
        fontWeight:"700" }}>☀</div>
      <div style={{ fontSize:"10px", color:C.green }}>11:48</div>
      <div style={{ fontSize:"9px", color:C.textDim }}>
        –12:36
        {inAbhijit && <span style={{ color:C.green, marginLeft:"4px",
          fontWeight:"700" }}>ACTIVE</span>}
      </div>
    </div>,

    // Cell 8 — Date/Time
    <div key="dt" style={{ textAlign:"right", padding:"6px 8px" }}>
      <div style={{ fontSize:"9px", color:C.textDim,
        letterSpacing:"0.08em", marginBottom:"3px" }}>DATE · TIME</div>
      <div style={{ fontSize:"11px", color:C.text,
        fontFamily:"monospace" }}>{nowIST.slice(0,5)}</div>
      <div style={{ fontSize:"10px", color:C.textMid }}>
        {TODAY.date}
      </div>
      <div style={{ fontSize:"9px", color:C.textDim }}>
        {TODAY.vaar} · Ujjain
      </div>
    </div>,

    // ★ Cell 9 — LUCKYPOP (NEW Sprint 5)
    <LPSignalCell key="lp"
      lpSignal={lpSignal} lpScore={lpScore}
      lpDot={lpDot} lpFlow={lpFlow} lpRvol={lpRvol}/>,
  ];

  // ── ALERT STRIP (Sprint 3 integration) ────────────────────────────────
  const nextAlertMsg = inRahu
    ? `☊ Rahu Kala ends ${TODAY.rahuKala.end} — re-entry window opens then`
    : inAbhijit
    ? `☀ Abhijit closes 12:36 — tighten stops after window`
    : `⚡ Next change ${TODAY.nextEvent.time}: ${TODAY.nextEvent.label}`;

  return (
    <div style={{ fontFamily:"'DM Mono','Courier New',monospace",
      background:C.bg, color:C.text, minHeight:"100vh",
      fontSize:"13px" }}>

      {/* ── APP HEADER BAR ──────────────────────────────────────────── */}
      <div style={{ background:C.panel,
        borderBottom:`1px solid ${C.border}`,
        padding:"8px 16px",
        display:"flex", alignItems:"center",
        justifyContent:"space-between", height:"42px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:"16px",
            color:C.gold, letterSpacing:"0.18em" }}>FINASTRO</div>
          <div style={{ width:"6px", height:"6px", borderRadius:"50%",
            background:C.green,
            boxShadow:`0 0 6px ${C.green}`,
            animation:"pulse 1.5s ease-in-out infinite" }}/>
          <span style={{ fontSize:"10px", color:C.green }}>LIVE</span>
        </div>
        <div style={{ fontFamily:"monospace", fontSize:"14px",
          color:C.gold, letterSpacing:"0.1em" }}>{nowIST} IST</div>
        <div style={{ fontSize:"10px", color:C.textDim }}>
          Ujjain ref · Lahiri · Screen 1 v2
        </div>
      </div>

      {/* ── TOP STRIP — 9 cells ─────────────────────────────────────── */}
      <div style={{ background:C.panel,
        borderBottom:`1px solid ${C.border}`,
        display:"grid",
        gridTemplateColumns:"repeat(9, 1fr)",
        gap:"0px" }}>
        {topCells.map((cell, i) => (
          <div key={i} style={{
            borderRight: i < 8 ? `1px solid ${C.border}` : "none",
            minWidth:0 }}>
            {cell}
          </div>
        ))}
      </div>

      {/* ── ALERT STRIP (Sprint 3) ───────────────────────────────────── */}
      <div style={{ background:"#0A0E18",
        borderBottom:`1px solid ${C.border}22`,
        padding:"4px 16px",
        display:"flex", alignItems:"center",
        justifyContent:"space-between", fontSize:"10px" }}>
        <span style={{ color:C.gold }}>🔔 {nextAlertMsg}</span>
        {lpSymbol && (
          <span style={{ color:lpVerdict.color, fontWeight:"600" }}>
            LP:{lpSymbol} {lpVerdict.text}
          </span>
        )}
      </div>

      {/* ── PANCHANG BAND ───────────────────────────────────────────── */}
      <div style={{ borderBottom:`1px solid ${C.border}` }}>
        <PanchangBand panchang={TODAY} nowMins={nowMins}/>
      </div>

      {/* ── MAIN BODY: chart + sidebar ───────────────────────────────── */}
      <div style={{ display:"grid",
        gridTemplateColumns:"1fr 260px",
        gap:"0", height:"calc(100vh - 230px)",
        minHeight:"480px" }}>

        {/* LEFT: chart area */}
        <div style={{ display:"flex", flexDirection:"column",
          borderRight:`1px solid ${C.border}` }}>

          {/* Candlestick */}
          <div style={{ flex:"1 1 auto", padding:"8px 12px 0",
            overflow:"hidden" }}>
            <div style={{ fontSize:"9px", color:C.textDim,
              letterSpacing:"0.08em", marginBottom:"4px",
              display:"flex", justifyContent:"space-between" }}>
              <span>NIFTY 50 · 5MIN · TODAY</span>
              <span style={{ color:C.gold }}>{minsToTime(nowMins)} IST</span>
            </div>
            <CandlestickChart candles={candles} nowMins={nowMins}
              rahuStart={rahuStart} rahuEnd={rahuEnd}
              abhijitStart={abhStart} abhijitEnd={abhEnd}
              changeoverMins={changeoverMins}/>
          </div>

          {/* Volume bars */}
          <div style={{ padding:"0 12px", flexShrink:0 }}>
            <VolumeBars candles={candles} nowMins={nowMins}
              rahuStart={rahuStart} rahuEnd={rahuEnd}/>
          </div>

          {/* Time axis */}
          <div style={{ padding:"2px 12px 4px",
            display:"flex", justifyContent:"space-between",
            fontSize:"8px", color:C.textDim, flexShrink:0 }}>
            {["09:15","10:00","11:00","12:00","13:00","14:00","15:00","15:30"]
              .map(t => <span key={t}>{t}</span>)}
          </div>

          {/* Moon strip */}
          <div style={{ flexShrink:0 }}>
            <MoonStrip phase={TODAY.moonPhase}/>
          </div>
        </div>

        {/* RIGHT: sidebar */}
        <div style={{ overflowY:"auto", padding:"12px",
          display:"flex", flexDirection:"column", gap:"10px" }}>

          {/* Score dial */}
          <div style={{ ...panelSt, display:"flex",
            alignItems:"center", justifyContent:"center",
            padding:"12px" }}>
            <ScoreRing score={confScore} size={80}/>
          </div>

          {/* Score breakdown */}
          <div style={panelSt}>
            <div style={labelSt}>SCORE BREAKDOWN</div>
            {breakdown.map((b, i) => (
              <div key={i} style={{ display:"flex",
                justifyContent:"space-between",
                alignItems:"center", padding:"4px 0",
                borderBottom:`1px solid ${C.border}22`,
                fontSize:"10px" }}>
                <span style={{ color:C.textDim }}>{b.label}</span>
                <div style={{ display:"flex",
                  alignItems:"center", gap:"6px" }}>
                  <div style={{ width:"40px", height:"4px",
                    background:C.border, borderRadius:"2px",
                    overflow:"hidden" }}>
                    <div style={{ height:"100%", borderRadius:"2px",
                      background:b.color,
                      width:`${Math.max(0,b.val/2.5*100)}%` }}/>
                  </div>
                  <span style={{ color:b.color, fontWeight:"700",
                    minWidth:"24px", textAlign:"right" }}>
                    {b.val}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Panchang details */}
          <div style={panelSt}>
            <div style={labelSt}>PANCHANG</div>
            {[
              {l:"Tithi",  v:`${TODAY.tithi} (${TODAY.tithiPaksha})`, c:C.textMid},
              {l:"Yoga",   v:TODAY.yoga, c:TODAY.yogaQuality===3?C.green:C.amber},
              {l:"Nakshatra", v:TODAY.nakshatra, c:C.textMid},
              {l:"Moon",   v:`${TODAY.moonSign} (${TODAY.moonElement})`, c:C.teal},
              {l:"Yoga ⚡", v:TODAY.yogaChange+" IST", c:C.gold},
              {l:"Tithi ⚡",v:TODAY.tithiChange+" IST", c:C.gold},
            ].map((r,i)=>(
              <div key={i} style={{ display:"flex",
                justifyContent:"space-between", padding:"4px 0",
                borderBottom:`1px solid ${C.border}22`,
                fontSize:"10px" }}>
                <span style={{ color:C.textDim }}>{r.l}</span>
                <span style={{ color:r.c, fontWeight:"600" }}>{r.v}</span>
              </div>
            ))}
          </div>

          {/* Planetary */}
          <div style={panelSt}>
            <div style={labelSt}>PLANETS</div>
            {[
              {l:"♃ Jupiter", v:"Cancer ↑ Exalted", c:C.gold},
              {l:"☿ Mercury", v:"Gemini ℞ Retro",   c:C.amber},
              {l:"♀ Venus",   v:"Taurus → Direct",  c:C.green},
              {l:"♂ Mars",    v:"Cancer ↓ Debil.",  c:C.redDim},
              {l:"♄ Saturn",  v:"Aries ↓ Debil.",   c:C.amberDim},
            ].map((r,i)=>(
              <div key={i} style={{ display:"flex",
                justifyContent:"space-between", padding:"4px 0",
                borderBottom:`1px solid ${C.border}22`,
                fontSize:"10px" }}>
                <span style={{ color:C.textDim }}>{r.l}</span>
                <span style={{ color:r.c }}>{r.v}</span>
              </div>
            ))}
          </div>

          {/* ★ LP+FIN CONFLUENCE BADGE — NEW Sprint 5 ★ */}
          <LPFinBadge
            verdict={lpVerdict}
            panchang={TODAY}
            lpSignal={lpSignal}
            lpScore={lpScore}/>

          {/* Upcoming events */}
          <div style={panelSt}>
            <div style={labelSt}>UPCOMING</div>
            {[
              {time:"09:50",label:"Yoga → Variyana",color:C.amber},
              {time:"10:30",label:"Rahu Kala opens",color:C.red},
              {time:"11:48",label:"Abhijit opens",  color:C.green},
              {time:"12:00",label:"Rahu Kala closes",color:C.amber},
              {time:"12:36",label:"Abhijit closes", color:C.green},
              {time:"13:40",label:"Tithi → Dwadashi",color:C.gold},
            ].map((e,i)=>(
              <div key={i} style={{ display:"flex",
                gap:"8px", padding:"4px 0",
                borderBottom:`1px solid ${C.border}22`,
                fontSize:"10px", alignItems:"center" }}>
                <span style={{ color:C.textDim,
                  fontFamily:"monospace", flexShrink:0,
                  width:"36px" }}>{e.time}</span>
                <span style={{ color:e.color }}>{e.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── GUIDANCE FOOTER ──────────────────────────────────────────── */}
      <GuidanceFooter
        panchang={TODAY} inRahu={inRahu} inAbhijit={inAbhijit}
        nowMins={nowMins} lpVerdict={lpVerdict}/>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  );
}

// ─── SHARED MICRO STYLES ───────────────────────────────────────────────────
const panelSt = {
  background:C.panel, border:`1px solid ${C.border}`,
  borderRadius:"3px", padding:"10px",
};
const labelSt = {
  fontSize:"8px", color:C.textDim,
  letterSpacing:"0.1em", marginBottom:"6px",
};
