import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// FINASTRO — SCREEN 1 v3: TODAY (Intraday Cockpit) + Full Indicator Suite
// File: finastro_screen1_v3.jsx  [Sprint 5 — indicator panels added]
//
// LAYOUT:
//   APP HEADER BAR
//   TOP STRIP (9 cells — original 8 + LP cell)
//   ALERT STRIP
//   PANCHANG BAND (28px)
//   ┌─────────────────────────┬──────────────┐
//   │  CANDLESTICK CHART      │  RIGHT       │
//   │  VOLUME BARS            │  SIDEBAR     │
//   │  TIME AXIS              │  260px       │
//   │  MOON STRIP             │              │
//   ├─────────────────────────┤  · Score dial│
//   │  ▼ LUCKYPOP REC  [▲▼]  │  · Breakdown │
//   │  ▼ RSSI          [▲▼]  │  · Panchang  │
//   │  ▼ SNIPER DRAGON [▲▼]  │  · Planets   │
//   │  ▼ MAGIC RS      [▲▼]  │  · LP+FIN ★  │
//   └─────────────────────────┴──────────────┘
//   GUIDANCE FOOTER
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

// ─── TODAY PANCHANG ────────────────────────────────────────────────────────
const TODAY = {
  date:"2026-05-04", vaar:"Monday",
  sessionQuality:2, qualityLabel:"NEUTRAL",
  tithi:"Ekadashi", tithiPaksha:"Shukla", tithiChange:"13:40",
  yoga:"Siddhi", yogaQuality:3, yogaChange:"09:50",
  nakshatra:"Pushya", nakshatraLord:"saturn",
  moonSign:"Cancer", moonElement:"Water",
  moonPhase:0.72,
  rahuKala:{ start:"10:30", end:"12:00" },
  abhijit:{ start:"11:48", end:"12:36" },
  sunrise:"06:18", sunset:"18:44",
  jupiterCancer:true, mercuryRetro:true,
  nextEvent:{ time:"09:50", label:"Yoga → Variyana" },
};

// ─── LP SCORES (from getSignalScore in luckypop.pine) ─────────────────────
const LP_SCORES = {
  "POWER BUY":10,"STRONG BUY":9,"BUY CONFIRMED":8,"BUY":7,
  "BUY BOOK FAST":6,"ACCUMULATION":5,"SCALP ONLY":4,
  "CAUTION":3,"WAIT":2,"AVOID":1,"NO TRADE":0,
  "POWER SELL":-10,"STRONG SELL":-9,"SELL":-8,
  "SELL BOOK FAST":-7,"SCALP SHORT":-6,
  "DISTRIBUTION":-5,"SQUEEZE RISK":-4,
};
const LP_REC_COLOR = (sig) => {
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

// ─── TIME HELPERS ──────────────────────────────────────────────────────────
const toMins = (t) => { const [h,m] = t.split(":").map(Number); return h*60+m; };
const toTime = (m) => `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;

// ─── SYNTHETIC INTRADAY DATA GENERATORS ───────────────────────────────────

// NIFTY 5-min candles
function buildCandles(sq) {
  const candles = []; let price = 22420;
  const bias = sq===3?0.0004:sq===2?0.00005:-0.0003;
  for (let m=0; m<75; m++) {
    const mins = 9*60+15+m*5;
    const noise = (((m*1664525+1013904223)&0x7fffffff)/0x7fffffff*2-1);
    const ret = bias + noise*0.0018;
    const o = +price.toFixed(2), c = +(price*(1+ret)).toFixed(2);
    const h = +(Math.max(o,c)*(1+Math.abs(noise)*0.0004)).toFixed(2);
    const l = +(Math.min(o,c)*(1-Math.abs(noise)*0.0004)).toFixed(2);
    const vol = 8000+Math.abs(Math.round(noise*40000));
    candles.push({ mins, time:toTime(mins), o, h, l, c, vol });
    price = c;
  }
  return candles;
}

// RSSI: RSS (SMA spread RSI) + RSI line, 0-100 scale
function buildRSSI(candles) {
  const closes = candles.map(c=>c.c);
  const sma = (arr, n, i) => arr.slice(Math.max(0,i-n+1),i+1).reduce((a,b)=>a+b,0)/Math.min(n,i+1);
  const rsi = (arr, n, i) => {
    if (i < n) return 50;
    let gains=0, losses=0;
    for (let k=i-n+1;k<=i;k++) {
      const d = arr[k]-(arr[k-1]||arr[k]);
      if (d>0) gains+=d; else losses-=d;
    }
    const rs = losses===0?100:gains/losses;
    return 100-(100/(1+rs));
  };
  return candles.map((c,i) => {
    const e1 = sma(closes,10,i), e2 = sma(closes,40,i);
    const spread = e1-e2;
    // Approximate RSS: treat spread as RSI input
    const spreads = candles.slice(Math.max(0,i-4),i+1).map((_,j)=>{
      const ii = Math.max(0,i-4)+j;
      return sma(closes,10,ii)-sma(closes,40,ii);
    });
    const rssRaw = rsi(closes,14,i);
    const rss = +(45+Math.sin(i*0.3)*25+(rssRaw-50)*0.4).toFixed(1);
    const rsiVal = +rsi(closes,14,i).toFixed(1);
    const isNewHigh = i>5 && rss > Math.max(...candles.slice(i-5,i).map((_,j)=>
      45+Math.sin((i-5+j)*0.3)*25));
    const bullDiv = i>10 && rsiVal > 30 && c.l < candles[i-5].l;
    const bearDiv = i>10 && rsiVal < 70 && c.h > candles[i-5].h;
    return { mins:c.mins, rss, rsi:rsiVal, isNewHigh, bullDiv, bearDiv };
  });
}

// SniperDragon: Institution RSI, HotMoney RSI, RSI line (0-50 scale)
function buildSniperDragon(candles) {
  const closes = candles.map(c=>c.c);
  const rsiRaw = (arr, n, i) => {
    if (i < 1) return 25;
    let g=0,l=0;
    for (let k=Math.max(1,i-n+1);k<=i;k++) {
      const d=arr[k]-arr[k-1];
      if (d>0) g+=d; else l-=d;
    }
    const rs = l===0?100:g/l;
    return 100-(100/(1+rs));
  };
  return candles.map((c,i) => {
    const rsiBase = rsiRaw(closes,9,i);
    const rsiBase4 = rsiRaw(closes,4,i);
    // Institution (RSIBase=61, period=9, sensitivity=1.5)
    const institution = Math.max(0, Math.min(50, 1.5*(rsiBase-61)));
    // HotMoney (RSIBase=15, period=4, sensitivity=1.0)
    const hotmoney = Math.max(0, Math.min(50, 1.0*(rsiBase4-15)));
    // RSI line 0-50 mapped
    const rsiLine = rsiBase/2;
    return { mins:c.mins, institution:+institution.toFixed(1),
      hotmoney:+hotmoney.toFixed(1), rsiLine:+rsiLine.toFixed(1) };
  });
}

// MagicRS: relative strength vs CNX500 proxy
function buildMagicRS(candles) {
  // Synthetic RS: smooth price momentum vs a flat index
  const closes = candles.map(c=>c.c);
  const indexProxy = closes.map((c,i) => closes[0]*(1+i*0.00008));
  const sma = (arr,n,i) => arr.slice(Math.max(0,i-n+1),i+1).reduce((a,b)=>a+b,0)/Math.min(n,i+1);
  return candles.map((c,i) => {
    const rs = closes[i]/indexProxy[i];
    const rsMA = sma(candles.map((_,j)=>closes[j]/indexProxy[j]),20,i);
    const magicrs = +(100*(rs/rsMA-1)).toFixed(2);
    const magicma = +(magicrs*0.6 + (i>0?0:0)).toFixed(2);
    // Strength points: 0/1/3/6
    const pts = magicrs > 2 ? 6 : magicrs > 0.5 ? 3 : magicrs > 0 ? 1 : 0;
    // Zone
    const zone = magicrs > magicma + 2 ? "Strong Bull" :
      magicrs > magicma ? "Mild Bull" :
      magicrs < magicma - 2 ? "Strong Bear" :
      magicrs < magicma ? "Mild Bear" : "Neutral";
    return { mins:c.mins, magicrs:+magicrs.toFixed(2),
      magicma:+magicma.toFixed(2), pts, zone };
  });
}

// ─── SVG MINI CHART HELPERS ────────────────────────────────────────────────
function linePoints(data, W, H, padT=4, padB=4) {
  if (!data.length) return "";
  const min = Math.min(...data), max = Math.max(...data);
  const range = max-min || 1;
  return data.map((v,i) =>
    `${(i/(data.length-1))*W},${padT+((1-(v-min)/range)*(H-padT-padB))}`
  ).join(" ");
}
function barPath(data, W, H, zero, min, max) {
  const range = max-min || 1;
  const zeroY = H-((zero-min)/range)*H;
  return data.map((v,i) => {
    const x = (i/(data.length-1))*W;
    const y = H-((v-min)/range)*H;
    const top = Math.min(y,zeroY), bot = Math.max(y,zeroY);
    return { x, top, h:Math.max(1,bot-top), bull:v>=zero };
  });
}

// ─── CONFLICT VERDICT ──────────────────────────────────────────────────────
function getLPFinVerdict(lpSignal, lpScore, panchang, inRahu, inAbhijit) {
  if (!lpSignal || lpScore === 0) {
    if (panchang.sessionQuality === 3)
      return { text:"◈ WATCH", color:C.purple, sub:"No LP signal — set watch alert" };
    return { text:"— IDLE", color:C.textDim, sub:"No signal" };
  }
  const isBull = lpScore >= 7, isBear = lpScore <= -6;
  if (inRahu && (isBull||isBear))
    return { text:"✕ RAHU BLOCK", color:C.red, sub:"n=312 · p=0.018" };
  if (isBull && panchang.sessionQuality===0)
    return { text:"⚠ CONFLICT", color:C.red, sub:"AVOID overrides LP · n=486" };
  if (panchang.yoga==="Vyatipata"||panchang.yoga==="Vaidhriti")
    return { text:"⚠ YOGA BLOCK", color:C.red, sub:"Inauspicious yoga override" };
  if (isBull && panchang.sessionQuality===3) {
    const fin = (inAbhijit?2:0)+(panchang.jupiterCancer?1.5:0);
    const combined = +((lpScore/10*6*0.6)+(Math.min(4+fin,6)*0.4)).toFixed(1);
    return { text:`▲▲ ALIGNED ${combined}`, color:C.gold,
      sub:inAbhijit?"Abhijit ✓ Full size":"Standard entry", combined };
  }
  if (isBull && panchang.sessionQuality===2)
    return { text:"▲ PARTIAL", color:C.green, sub:"Neutral panchang — reduced size" };
  if (isBear && panchang.sessionQuality<=1)
    return { text:"▼▼ BEAR ALIGNED", color:C.red, sub:"Both systems bearish" };
  return { text:"○ LP ONLY", color:C.textMid, sub:"Astro neutral — standard LP rules" };
}

// ─── SHARED PANEL STYLE ────────────────────────────────────────────────────
const pnl = (extra={}) => ({
  background:C.panel, border:`1px solid ${C.border}`,
  borderRadius:"4px", padding:"10px", ...extra
});
const lbl = { fontSize:"8px", color:C.textDim, letterSpacing:"0.1em", marginBottom:"6px" };

// ─── COLLAPSIBLE INDICATOR PANEL ──────────────────────────────────────────
function IndicatorPanel({ id, label, color, subtitle, open, onToggle, children, height=120 }) {
  return (
    <div style={{ background:C.bg, borderTop:`1px solid ${C.border}` }}>
      {/* Header bar */}
      <div onClick={onToggle}
        style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"5px 14px", cursor:"pointer", userSelect:"none",
          background:"#0C0F14", borderBottom:open?`1px solid ${C.border}`:"none" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <div style={{ width:"3px", height:"14px", background:color,
            borderRadius:"2px", flexShrink:0 }}/>
          <span style={{ fontSize:"10px", fontWeight:"700",
            color:C.text, letterSpacing:"0.06em" }}>{label}</span>
          <span style={{ fontSize:"9px", color:C.textDim }}>{subtitle}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          {children?.props?.badge && (
            <span style={{ fontSize:"9px", color:color,
              padding:"1px 7px", border:`1px solid ${color}50`,
              borderRadius:"2px", fontWeight:"700" }}>
              {children.props.badge}
            </span>
          )}
          <span style={{ color:C.textDim, fontSize:"11px",
            transform:open?"rotate(180deg)":"none",
            transition:"transform 0.2s", display:"inline-block" }}>▼</span>
        </div>
      </div>
      {open && (
        <div style={{ height, overflow:"hidden" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── INDICATOR 1: LUCKYPOP RECOMMENDATION ─────────────────────────────────
function LPRecPanel({ candles, lpSignal, lpScore, lpDot, lpFlow,
  lpRvol, lpTvol, lpIb30, lpBq, lpMagicRS }) {
  const recColor = LP_REC_COLOR(lpSignal);
  const dotColors = { SVD:C.purple, SBD:C.blue, SYD:C.amber };

  // Build recommendation history over intraday bars (simulated)
  const recHistory = candles.map((c,i) => {
    const seed = i*7+3;
    const scores = [10,9,8,7,6,5,4,3,2,1,0,-4,-5,-6,-7,-8,-9,-10];
    const idx = ((seed*1103515245)&0x7fffffff) % scores.length;
    return scores[idx];
  });
  const latest = LP_SCORES[lpSignal] ?? 0;
  recHistory[recHistory.length-1] = latest;

  const W=520, H=90;
  const barsD = barPath(recHistory, W, H, 0, -10, 10);

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 200px",
      height:"100%", gap:"0" }}>
      {/* Chart: recommendation score histogram */}
      <div style={{ padding:"8px 14px" }}>
        <div style={{ fontSize:"8px", color:C.textDim,
          letterSpacing:"0.08em", marginBottom:"4px" }}>
          SIGNAL SCORE HISTORY (intraday)
        </div>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
          style={{ display:"block" }}>
          {/* Zero line */}
          <line x1={0} y1={H/2} x2={W} y2={H/2}
            stroke={C.border} strokeWidth="1"/>
          {/* ±7 thresholds */}
          <line x1={0} y1={H-((7+10)/20)*H} x2={W} y2={H-((7+10)/20)*H}
            stroke={C.green} strokeWidth="0.5" strokeDasharray="3,3" opacity="0.5"/>
          <line x1={0} y1={H-((-7+10)/20)*H} x2={W} y2={H-((-7+10)/20)*H}
            stroke={C.red} strokeWidth="0.5" strokeDasharray="3,3" opacity="0.5"/>
          {/* Score bars */}
          {barsD.map((b,i) => (
            <rect key={i} x={b.x-3} y={b.top} width={6}
              height={Math.max(1,b.h)}
              fill={b.bull ? C.green : C.red} opacity="0.7"
              rx="1"/>
          ))}
          {/* Latest highlight */}
          {(() => {
            const last = barsD[barsD.length-1];
            return last && (
              <rect x={last.x-4} y={last.top-1} width={8}
                height={Math.max(2,last.h+2)}
                fill={recColor} opacity="1" rx="1"
                style={{ filter:`drop-shadow(0 0 3px ${recColor})` }}/>
            );
          })()}
          {/* Labels */}
          <text x={W-2} y={H/2-2} textAnchor="end"
            fontSize="7" fill={C.textDim}>0</text>
          <text x={W-2} y={H-((7+10)/20)*H-2} textAnchor="end"
            fontSize="7" fill={C.green}>+7</text>
          <text x={W-2} y={H-((-7+10)/20)*H+8} textAnchor="end"
            fontSize="7" fill={C.red}>-7</text>
        </svg>
      </div>

      {/* Right: current signal details */}
      <div style={{ borderLeft:`1px solid ${C.border}`,
        padding:"8px 10px", display:"flex",
        flexDirection:"column", gap:"5px" }}>
        {/* Main recommendation */}
        <div style={{ background:recColor+"18",
          border:`1px solid ${recColor}40`,
          borderRadius:"3px", padding:"7px 8px", textAlign:"center" }}>
          <div style={{ fontSize:"9px", color:C.textDim,
            letterSpacing:"0.08em" }}>RECOMMENDATION</div>
          <div style={{ fontSize:"13px", fontWeight:"700",
            color:recColor, marginTop:"2px" }}>{lpSignal}</div>
          <div style={{ fontSize:"18px", fontWeight:"700",
            color:recColor }}>{latest>0?"+":""}{latest}</div>
        </div>
        {/* Supporting metrics */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr",
          gap:"4px", fontSize:"9px" }}>
          {[
            {l:"RVOL",v:`${lpRvol}x`,c:lpRvol>=1.5?C.green:lpRvol>=1.1?C.amber:C.red},
            {l:"TVOL",v:`${lpTvol}x`,c:lpTvol>=1.0?C.green:C.amber},
            {l:"IB30", v:lpIb30, c:lpIb30==="BREAK UP"?C.green:lpIb30==="BREAK DOWN"?C.red:C.textDim},
            {l:"BQ",  v:`${lpBq}/6`,c:lpBq>=5?C.gold:lpBq>=3?C.green:C.amber},
            {l:"Flow", v:lpFlow.split(" ")[0],
              c:lpFlow==="SOLID GREEN"?C.green:lpFlow==="SOLID RED"?C.red:C.amber},
            {l:"Dot",  v:lpDot,
              c:lpDot==="SVD"?C.purple:lpDot==="SBD"?C.blue:lpDot==="SYD"?C.amber:C.textDim},
          ].map((m,i)=>(
            <div key={i} style={{ background:"#0A0E14",
              padding:"3px 5px", borderRadius:"2px",
              border:`1px solid ${C.border}`,
              display:"flex", justifyContent:"space-between" }}>
              <span style={{ color:C.textDim }}>{m.l}</span>
              <span style={{ color:m.c, fontWeight:"700" }}>{m.v}</span>
            </div>
          ))}
        </div>
        {/* MagicRS points */}
        <div style={{ display:"flex", gap:"3px" }}>
          {[1,2,3,4,5,6].map(n => (
            <div key={n} style={{ flex:1, height:"6px",
              borderRadius:"2px",
              background:n<=lpMagicRS ? C.green : C.border }}/>
          ))}
        </div>
        <div style={{ fontSize:"8px", color:C.textDim,
          textAlign:"center" }}>MagicRS {lpMagicRS}/6</div>
      </div>
    </div>
  );
}

// ─── INDICATOR 2: RSSI (RSS + RSI + Divergence) ───────────────────────────
function RSSIPanel({ rssiData, nowMins }) {
  const visible = rssiData.filter(d => d.mins <= nowMins);
  const all = rssiData;
  const W=520, H=90;
  const OVERBOUGHT=80, OVERSOLD=20;

  const rssVals = all.map(d=>d.rss);
  const rsiVals = all.map(d=>d.rsi);
  const latest = visible[visible.length-1] || all[0];

  const rssPts = linePoints(rssVals, W, H);
  const rsiPts = linePoints(rsiVals, W, H);
  const visRssPts = linePoints(visible.map(d=>d.rss), W*(visible.length/all.length), H);

  const obY = H - (OVERBOUGHT/100)*H;
  const osY = H - (OVERSOLD/100)*H;

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 200px",
      height:"100%", gap:"0" }}>
      <div style={{ padding:"8px 14px" }}>
        <div style={{ fontSize:"8px", color:C.textDim,
          letterSpacing:"0.08em", marginBottom:"4px" }}>
          RSS (red) · RSI (purple) · OB/OS 80/20
        </div>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
          style={{ display:"block" }}>
          {/* OB/OS bands */}
          <rect x={0} y={0} width={W} height={obY}
            fill={C.red} opacity="0.05"/>
          <rect x={0} y={osY} width={W} height={H-osY}
            fill={C.green} opacity="0.05"/>
          <line x1={0} y1={obY} x2={W} y2={obY}
            stroke={C.red} strokeWidth="0.5" strokeDasharray="3,3" opacity="0.4"/>
          <line x1={0} y1={osY} x2={W} y2={osY}
            stroke={C.green} strokeWidth="0.5" strokeDasharray="3,3" opacity="0.4"/>
          {/* 50 midline */}
          <line x1={0} y1={H/2} x2={W} y2={H/2}
            stroke={C.border} strokeWidth="0.5"/>
          {/* Future RSS (dim) */}
          <polyline points={rssPts} fill="none"
            stroke={C.red} strokeWidth="1" opacity="0.2"/>
          {/* Future RSI (dim) */}
          <polyline points={rsiPts} fill="none"
            stroke={C.purple} strokeWidth="0.8" opacity="0.15"/>
          {/* Past RSS (solid) */}
          <polyline points={visRssPts} fill="none"
            stroke={C.red} strokeWidth="2" opacity="0.85"/>
          {/* New high dots */}
          {visible.filter(d=>d.isNewHigh).map((d,i) => {
            const x = (rssiData.indexOf(d)/all.length)*W;
            const y = H - (d.rss/100)*H;
            return <circle key={i} cx={x} cy={y} r="3"
              fill={C.blue} opacity="0.9"/>;
          })}
          {/* Divergence markers */}
          {visible.filter(d=>d.bullDiv||d.bearDiv).map((d,i) => {
            const x = (rssiData.indexOf(d)/all.length)*W;
            return d.bullDiv
              ? <polygon key={i} points={`${x},${H-6} ${x-5},${H} ${x+5},${H}`}
                  fill={C.green} opacity="0.8"/>
              : <polygon key={i} points={`${x},6 ${x-5},0 ${x+5},0`}
                  fill={C.red} opacity="0.8"/>;
          })}
          {/* Labels */}
          <text x={4} y={obY-2} fontSize="7" fill={C.red} opacity="0.6">OB 80</text>
          <text x={4} y={osY+8} fontSize="7" fill={C.green} opacity="0.6">OS 20</text>
        </svg>
      </div>
      {/* Current values */}
      <div style={{ borderLeft:`1px solid ${C.border}`,
        padding:"8px 10px", display:"flex",
        flexDirection:"column", gap:"6px" }}>
        <div style={pnl({ padding:"7px" })}>
          <div style={{ fontSize:"8px", color:C.textDim, marginBottom:"3px" }}>RSS</div>
          <div style={{ fontSize:"20px", fontWeight:"700",
            color:latest.rss>=80?C.red:latest.rss<=20?C.green:C.red }}>
            {latest.rss}
          </div>
          <div style={{ fontSize:"9px", color:C.textDim }}>
            {latest.rss>=80?"⚠ OVERBOUGHT":latest.rss<=20?"✓ OVERSOLD":"Neutral"}
          </div>
        </div>
        <div style={pnl({ padding:"7px" })}>
          <div style={{ fontSize:"8px", color:C.textDim, marginBottom:"3px" }}>RSI</div>
          <div style={{ fontSize:"20px", fontWeight:"700",
            color:latest.rsi>=70?C.red:latest.rsi<=30?C.green:C.purple }}>
            {latest.rsi}
          </div>
          <div style={{ fontSize:"9px", color:C.textDim }}>
            {latest.rsi>=70?"Overbought":latest.rsi<=30?"Oversold":"Neutral"}
          </div>
        </div>
        <div style={{ display:"flex", gap:"4px" }}>
          {latest.bullDiv && (
            <span style={{ fontSize:"9px", color:C.green,
              padding:"2px 6px", border:`1px solid ${C.green}50`,
              borderRadius:"2px" }}>💚 Bull Div</span>
          )}
          {latest.bearDiv && (
            <span style={{ fontSize:"9px", color:C.red,
              padding:"2px 6px", border:`1px solid ${C.red}50`,
              borderRadius:"2px" }}>❤️ Bear Div</span>
          )}
          {!latest.bullDiv && !latest.bearDiv && (
            <span style={{ fontSize:"9px", color:C.textDim }}>No divergence</span>
          )}
        </div>
        <div style={{ fontSize:"9px", color:C.blue }}>
          ● New high dots = RSS breakout
        </div>
      </div>
    </div>
  );
}

// ─── INDICATOR 3: SNIPER DRAGON ────────────────────────────────────────────
function SniperDragonPanel({ sniperData, nowMins }) {
  const visible = sniperData.filter(d => d.mins <= nowMins);
  const all = sniperData;
  const W=520, H=90;
  const latest = visible[visible.length-1] || all[0];

  // Bar width
  const bw = Math.max(2, W/all.length - 1);

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 200px",
      height:"100%", gap:"0" }}>
      <div style={{ padding:"8px 14px" }}>
        <div style={{ fontSize:"8px", color:C.textDim,
          letterSpacing:"0.08em", marginBottom:"4px" }}>
          INSTITUTION (red) · HOT MONEY (yellow) · RSI LINE (black) · Scale 0–50
        </div>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
          style={{ display:"block" }}>
          {/* Reference lines */}
          {[5,15,25,35,40].map(v => {
            const y = H-(v/50)*H;
            return <line key={v} x1={0} y1={y} x2={W} y2={y}
              stroke={C.border} strokeWidth="0.5"
              strokeDasharray={v===40?"4,2":"2,4"} opacity="0.5"/>;
          })}
          {/* Retailer baseline (green, value=50 → maps to top) */}
          <rect x={0} y={0} width={W} height={H}
            fill={C.green} opacity="0.04"/>
          {/* Histogram bars — stacked: institution + hotmoney */}
          {all.map((d,i) => {
            const x = (i/all.length)*W + bw/2;
            const isFuture = d.mins > nowMins;
            const instH = (d.institution/50)*H;
            const hotH  = (d.hotmoney/50)*H;
            return (
              <g key={i} opacity={isFuture?0.2:1}>
                {/* HotMoney (yellow, behind) */}
                <rect x={x-bw/2} y={H-hotH} width={bw}
                  height={Math.max(1,hotH)}
                  fill="#FFEB3B" opacity="0.7"/>
                {/* Institution (red, front) */}
                <rect x={x-bw/2+1} y={H-instH} width={Math.max(1,bw-2)}
                  height={Math.max(1,instH)}
                  fill={C.red} opacity="0.85"/>
              </g>
            );
          })}
          {/* RSI line */}
          <polyline
            points={visible.map((d,i) => {
              const x = (sniperData.indexOf(d)/all.length)*W + bw/2;
              const y = H-(d.rsiLine/50)*H;
              return `${x},${y}`;
            }).join(" ")}
            fill="none" stroke="#000000" strokeWidth="2" opacity="0.8"/>
          {/* Level labels */}
          {[5,15,25,40].map(v => (
            <text key={v} x={W-2} y={H-(v/50)*H+4}
              textAnchor="end" fontSize="7"
              fill={C.textDim} opacity="0.6">{v}</text>
          ))}
        </svg>
      </div>
      {/* Current values */}
      <div style={{ borderLeft:`1px solid ${C.border}`,
        padding:"8px 10px", display:"flex",
        flexDirection:"column", gap:"6px" }}>
        {[
          { label:"INSTITUTION", val:latest.institution,
            color:C.red, max:50,
            status:latest.institution>=35?"STRONG":latest.institution>=15?"MODERATE":"LOW" },
          { label:"HOT MONEY",   val:latest.hotmoney,
            color:"#FFEB3B", max:50,
            status:latest.hotmoney>=35?"STRONG":latest.hotmoney>=15?"MODERATE":"LOW" },
          { label:"RSI LINE",    val:latest.rsiLine,
            color:C.textMid, max:50,
            status:latest.rsiLine>=40?"HIGH":latest.rsiLine<=10?"LOW":"NEUTRAL" },
        ].map((m,i) => (
          <div key={i} style={pnl({ padding:"6px 8px" })}>
            <div style={{ display:"flex", justifyContent:"space-between",
              alignItems:"center", marginBottom:"3px" }}>
              <span style={{ fontSize:"8px", color:C.textDim,
                letterSpacing:"0.07em" }}>{m.label}</span>
              <span style={{ fontSize:"9px", color:m.color,
                fontWeight:"700" }}>{m.status}</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <div style={{ flex:1, height:"5px", background:C.border,
                borderRadius:"3px", overflow:"hidden" }}>
                <div style={{ height:"100%", background:m.color,
                  width:`${(m.val/m.max)*100}%`,
                  opacity:0.85, borderRadius:"3px" }}/>
              </div>
              <span style={{ fontSize:"12px", fontWeight:"700",
                color:m.color, minWidth:"28px",
                textAlign:"right" }}>{m.val}</span>
            </div>
          </div>
        ))}
        <div style={{ fontSize:"9px", color:C.textDim, lineHeight:"1.5" }}>
          Inst &gt;40 = institutional buying<br/>
          Hot &gt;35 = momentum money
        </div>
      </div>
    </div>
  );
}

// ─── INDICATOR 4: MAGIC RS ─────────────────────────────────────────────────
function MagicRSPanel({ magicData, nowMins }) {
  const visible = magicData.filter(d => d.mins <= nowMins);
  const all = magicData;
  const W=520, H=90;
  const latest = visible[visible.length-1] || all[0];

  const rsVals = all.map(d=>d.magicrs);
  const maVals = all.map(d=>d.magicma);
  const min = Math.min(...rsVals,...maVals)-0.5;
  const max = Math.max(...rsVals,...maVals)+0.5;

  const rsPts  = linePoints(rsVals, W, H);
  const maPts  = linePoints(maVals, W, H);
  const visRs  = linePoints(visible.map(d=>d.magicrs), W*(visible.length/all.length), H);
  const visMa  = linePoints(visible.map(d=>d.magicma), W*(visible.length/all.length), H);

  // Histogram = diff
  const diffVals = all.map(d=>d.magicrs-d.magicma);
  const diffBars = barPath(diffVals, W, H/2, 0, Math.min(...diffVals)-0.2, Math.max(...diffVals)+0.2);

  const zoneColor = latest.zone.includes("Strong Bull") ? C.green :
    latest.zone.includes("Mild Bull") ? "#6DD68A" :
    latest.zone.includes("Strong Bear") ? C.red :
    latest.zone.includes("Mild Bear") ? "#E07070" : C.teal;

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 200px",
      height:"100%", gap:"0" }}>
      <div style={{ padding:"8px 14px" }}>
        <div style={{ fontSize:"8px", color:C.textDim,
          letterSpacing:"0.08em", marginBottom:"4px" }}>
          MagicRS (line) vs MagicMA (blue) · Histogram = strength diff vs CNX500
        </div>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
          style={{ display:"block" }}>
          {/* Zero line */}
          <line x1={0} y1={H*0.5} x2={W} y2={H*0.5}
            stroke={C.border} strokeWidth="0.5"/>
          {/* Histogram diff (bottom half) */}
          {diffBars.map((b,i) => (
            <rect key={i} x={b.x-4} y={H*0.5+b.top-H*0.5}
              width={8} height={Math.max(1,b.h)}
              fill={b.bull?C.green:C.red} opacity="0.5" rx="1"/>
          ))}
          {/* Background zone tint */}
          <rect x={0} y={0} width={W} height={H}
            fill={zoneColor} opacity="0.04"/>
          {/* Future RS/MA dim */}
          <polyline points={rsPts} fill="none"
            stroke={C.green} strokeWidth="1" opacity="0.12"/>
          <polyline points={maPts} fill="none"
            stroke={C.blue} strokeWidth="0.8" opacity="0.12"/>
          {/* Past RS */}
          <polyline points={visRs} fill="none"
            stroke={C.green} strokeWidth="2" opacity="0.9"/>
          {/* Past MA */}
          <polyline points={visMa} fill="none"
            stroke={C.blue} strokeWidth="1.5" opacity="0.7"
            strokeDasharray="4,2"/>
          {/* Latest dot */}
          {visible.length > 0 && (() => {
            const lastIdx = visible.length-1;
            const x = (lastIdx/all.length)*W;
            const vals = visible.map(d=>d.magicrs);
            const mn = Math.min(...all.map(d=>d.magicrs));
            const mx = Math.max(...all.map(d=>d.magicrs));
            const y = H-((latest.magicrs-mn)/(mx-mn||1))*H;
            return <circle cx={x} cy={y} r="4"
              fill={zoneColor} stroke={C.bg} strokeWidth="1.5"
              style={{ filter:`drop-shadow(0 0 4px ${zoneColor})` }}/>;
          })()}
        </svg>
      </div>
      {/* Current values */}
      <div style={{ borderLeft:`1px solid ${C.border}`,
        padding:"8px 10px", display:"flex",
        flexDirection:"column", gap:"6px" }}>
        <div style={{ background:zoneColor+"18",
          border:`1px solid ${zoneColor}50`,
          borderRadius:"3px", padding:"8px", textAlign:"center" }}>
          <div style={{ fontSize:"8px", color:C.textDim,
            letterSpacing:"0.08em" }}>ZONE</div>
          <div style={{ fontSize:"13px", fontWeight:"700",
            color:zoneColor, marginTop:"2px" }}>{latest.zone}</div>
        </div>
        {[
          {l:"MagicRS", v:`${latest.magicrs}%`, c:C.green},
          {l:"MagicMA", v:`${latest.magicma}%`, c:C.blue},
          {l:"Diff",    v:`${(latest.magicrs-latest.magicma).toFixed(2)}%`,
            c:(latest.magicrs-latest.magicma)>=0?C.green:C.red},
        ].map((m,i)=>(
          <div key={i} style={{ display:"flex",
            justifyContent:"space-between",
            padding:"4px 0", borderBottom:`1px solid ${C.border}22`,
            fontSize:"10px" }}>
            <span style={{ color:C.textDim }}>{m.l}</span>
            <span style={{ color:m.c, fontWeight:"700" }}>{m.v}</span>
          </div>
        ))}
        {/* Strength dots */}
        <div style={{ fontSize:"8px", color:C.textDim,
          marginBottom:"3px" }}>MULTI-TF STRENGTH</div>
        <div style={{ display:"flex", gap:"3px" }}>
          {[1,2,3,4,5,6].map(n => (
            <div key={n} title={n<=2?"15m":n<=4?"1H":"D"}
              style={{ flex:1, height:"8px", borderRadius:"2px",
                background:n<=latest.pts?zoneColor:C.border,
                transition:"background 0.3s" }}/>
          ))}
        </div>
        <div style={{ fontSize:"9px", color:zoneColor,
          fontWeight:"700", textAlign:"center" }}>
          {latest.pts}/6 pts
        </div>
      </div>
    </div>
  );
}

// ─── LP+FIN BADGE (sidebar) ────────────────────────────────────────────────
function LPFinBadge({ verdict, panchang, lpSignal, lpScore }) {
  const isAligned = verdict.text.includes("ALIGNED");
  const isConflict = verdict.text.includes("CONFLICT")||verdict.text.includes("BLOCK");
  const isWatch = verdict.text.includes("WATCH");
  return (
    <div style={{ background:verdict.color+"10",
      border:`1px solid ${verdict.color}40`,
      borderRadius:"4px", padding:"10px" }}>
      <div style={{ fontSize:"8px", color:C.textDim,
        letterSpacing:"0.1em", marginBottom:"6px",
        display:"flex", justifyContent:"space-between" }}>
        <span>LP + FIN CONFLUENCE</span>
        <span style={{ color:C.teal }}>★ Sprint 5</span>
      </div>
      {/* Input rows */}
      {[
        { l:"LP Signal", v:lpSignal||"—",
          c:lpSignal?LP_REC_COLOR(lpSignal):C.textDim },
        { l:"Panchang",  v:panchang.qualityLabel,
          c:panchang.sessionQuality===3?C.green:panchang.sessionQuality===0?C.red:C.amber },
      ].map((r,i)=>(
        <div key={i} style={{ display:"flex", justifyContent:"space-between",
          padding:"4px 7px", marginBottom:"3px",
          background:"#0A0E14", borderRadius:"3px",
          border:`1px solid ${C.border}`, fontSize:"10px" }}>
          <span style={{ color:C.textDim }}>{r.l}</span>
          <span style={{ color:r.c, fontWeight:"700" }}>{r.v}</span>
        </div>
      ))}
      {/* Verdict */}
      <div style={{ background:verdict.color+"18",
        border:`1px solid ${verdict.color}50`,
        borderRadius:"3px", padding:"8px",
        textAlign:"center", marginTop:"6px" }}>
        <div style={{ fontSize:"13px", fontWeight:"700",
          color:verdict.color }}>{verdict.text}</div>
        <div style={{ fontSize:"9px", color:C.textDim,
          marginTop:"2px" }}>{verdict.sub}</div>
        {verdict.combined && (
          <div style={{ fontSize:"11px", color:C.gold,
            marginTop:"3px", fontWeight:"700" }}>
            Combined: {verdict.combined}/10
          </div>
        )}
      </div>
      <div style={{ marginTop:"6px", padding:"5px",
        borderRadius:"3px", textAlign:"center",
        fontSize:"10px", fontWeight:"700",
        background:isAligned?C.green+"12":isConflict?C.red+"12":C.purple+"12",
        color:isAligned?C.green:isConflict?C.red:isWatch?C.purple:C.textDim }}>
        {isAligned?"▲ ENTER — CONVICTION CONFIRMED":
         isConflict?"✕ SKIP — FINASTRO OVERRIDE":
         isWatch?"◈ WAITING FOR LP SIGNAL":
         "○ STANDARD LP RULES APPLY"}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function FinastroScreen1v3() {
  const [time, setTime] = useState(new Date());

  // LP state — cycles every 12s to demo all conflict cases
  const [lpState, setLpState] = useState({
    signal:"STRONG BUY", score:9, dot:"SVD",
    flow:"SOLID GREEN", rvol:1.82, tvol:1.14,
    ib30:"BREAK UP", bq:5, magicrs:5, symbol:"SBIBANK",
  });
  const cycleRef = useRef(0);
  const CYCLE = [
    {signal:"STRONG BUY", score:9, dot:"SVD",  flow:"SOLID GREEN",  rvol:1.82, tvol:1.14, ib30:"BREAK UP",   bq:5, magicrs:5, symbol:"SBIBANK"},
    {signal:"POWER BUY",  score:10,dot:"NONE", flow:"SOLID GREEN",  rvol:2.14, tvol:1.38, ib30:"BREAK UP",   bq:6, magicrs:6, symbol:"SUNPHARMA"},
    {signal:"NO TRADE",   score:0, dot:"NONE", flow:"GREY",         rvol:0.72, tvol:0.61, ib30:"INSIDE",     bq:0, magicrs:2, symbol:"RELIANCE"},
    {signal:"SELL",       score:-8,dot:"SYD",  flow:"SOLID RED",    rvol:1.56, tvol:1.22, ib30:"BREAK DOWN", bq:4, magicrs:1, symbol:"TCS"},
    {signal:"BUY",        score:7, dot:"SBD",  flow:"HOLLOW GREEN", rvol:1.24, tvol:0.98, ib30:"BREAK UP",   bq:3, magicrs:4, symbol:"HINDUNILVR"},
  ];

  // Collapsed state for each indicator panel
  const [open, setOpen] = useState({
    lp:true, rssi:true, sniper:true, magicrs:true
  });
  const togglePanel = (id) => setOpen(o => ({...o, [id]:!o[id]}));

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      cycleRef.current = (cycleRef.current+1) % CYCLE.length;
      setLpState(CYCLE[cycleRef.current]);
    }, 12000);
    return () => clearInterval(t);
  }, []);

  // Time
  const nowIST = time.toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour12:false});
  const nowMins = (() => {
    const ist = new Date(time.toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
    return ist.getHours()*60+ist.getMinutes();
  })();

  const rahuS = toMins(TODAY.rahuKala.start), rahuE = toMins(TODAY.rahuKala.end);
  const abhS  = toMins(TODAY.abhijit.start),  abhE  = toMins(TODAY.abhijit.end);
  const inRahu    = nowMins>=rahuS && nowMins<rahuE;
  const inAbhijit = nowMins>=abhS  && nowMins<abhE;

  // Build all indicator data once
  const candles   = useRef(buildCandles(TODAY.sessionQuality)).current;
  const rssiData  = useRef(buildRSSI(candles)).current;
  const sniperData= useRef(buildSniperDragon(candles)).current;
  const magicData = useRef(buildMagicRS(candles)).current;

  // Confluence score
  const techScore = Math.max(0, lpState.score/10)*6;
  const panScore  = inRahu?0:TODAY.sessionQuality===3?2:TODAY.sessionQuality===2?1.2:0.5;
  const abhBonus  = inAbhijit?0.8:0;
  const planScore = (TODAY.jupiterCancer?1.5:1.0)+(TODAY.mercuryRetro?-0.5:0);
  const confTotal = +Math.min(10, techScore*0.6+(panScore+abhBonus)*0.2+Math.max(0,planScore)*0.2).toFixed(1);

  // LP+FIN verdict
  const lpVerdict = getLPFinVerdict(lpState.signal, lpState.score, TODAY, inRahu, inAbhijit);

  const qualColor = TODAY.sessionQuality===3?C.green:TODAY.sessionQuality===2?C.amber:C.red;
  const qualLabel = ["AVOID","CAUTION","NEUTRAL","FAVORABLE"][TODAY.sessionQuality];
  const qualIcon  = ["✕","⚠","◎","✦"][TODAY.sessionQuality];

  // 9 Top Strip cells
  const topCells = [
    // 1 Session Quality
    <div key="sq" style={{textAlign:"center",padding:"5px 6px"}}>
      <div style={{fontSize:"8px",color:C.textDim,letterSpacing:"0.08em",marginBottom:"2px"}}>SESSION</div>
      <div style={{fontSize:"17px",color:qualColor,filter:`drop-shadow(0 0 4px ${qualColor}60)`}}>{qualIcon}</div>
      <div style={{fontSize:"9px",color:qualColor,fontWeight:"700"}}>{qualLabel}</div>
    </div>,
    // 2 Moon
    <div key="moon" style={{textAlign:"center",padding:"5px 6px"}}>
      <div style={{fontSize:"8px",color:C.textDim,letterSpacing:"0.08em",marginBottom:"1px"}}>MOON</div>
      <div style={{fontSize:"18px"}}>{TODAY.moonPhase<0.5?"🌔":"🌕"}</div>
      <div style={{fontSize:"9px",color:C.teal}}>{TODAY.moonSign}</div>
    </div>,
    // 3 Yoga
    <div key="yoga" style={{textAlign:"center",padding:"5px 6px"}}>
      <div style={{fontSize:"8px",color:C.textDim,letterSpacing:"0.08em",marginBottom:"2px"}}>YOGA</div>
      <div style={{fontSize:"11px",fontWeight:"700",color:C.green}}>{TODAY.yoga}</div>
      <div style={{fontSize:"8px",color:C.green}}>Favorable</div>
    </div>,
    // 4 Tithi countdown
    <div key="tithi" style={{textAlign:"center",padding:"5px 6px"}}>
      <div style={{fontSize:"8px",color:C.textDim,letterSpacing:"0.08em",marginBottom:"2px"}}>TITHI</div>
      <div style={{fontSize:"10px",color:C.text,fontWeight:"700"}}>{TODAY.tithi}</div>
      <div style={{fontSize:"9px",color:C.gold}}>⚡ {TODAY.tithiChange}</div>
    </div>,
    // 5 Yoga change
    <div key="yogact" style={{textAlign:"center",padding:"5px 6px"}}>
      <div style={{fontSize:"8px",color:C.textDim,letterSpacing:"0.08em",marginBottom:"2px"}}>YOGA ⚡</div>
      <div style={{fontSize:"9px",color:C.amber,fontWeight:"700"}}>→ Variyana</div>
      <div style={{fontSize:"9px",color:C.gold}}>{TODAY.yogaChange} IST</div>
    </div>,
    // 6 Rahu Kala
    <div key="rahu" style={{textAlign:"center",padding:"5px 6px",
      background:inRahu?C.redDim+"55":"transparent",
      borderRadius:"3px",border:inRahu?`1px solid ${C.red}60`:"1px solid transparent"}}>
      <div style={{fontSize:"8px",color:C.textDim,letterSpacing:"0.08em",marginBottom:"1px"}}>RAHU KALA</div>
      <div style={{fontSize:"10px",color:C.red,fontWeight:"700"}}>☊</div>
      <div style={{fontSize:"9px",color:C.red}}>{TODAY.rahuKala.start}–{TODAY.rahuKala.end}</div>
      {inRahu&&<div style={{fontSize:"8px",color:C.red,fontWeight:"700"}}>ACTIVE</div>}
    </div>,
    // 7 Abhijit
    <div key="abh" style={{textAlign:"center",padding:"5px 6px",
      background:inAbhijit?C.greenDim+"55":"transparent",
      borderRadius:"3px",border:inAbhijit?`1px solid ${C.green}60`:"1px solid transparent"}}>
      <div style={{fontSize:"8px",color:C.textDim,letterSpacing:"0.08em",marginBottom:"1px"}}>ABHIJIT</div>
      <div style={{fontSize:"10px",color:C.green,fontWeight:"700"}}>☀</div>
      <div style={{fontSize:"9px",color:C.green}}>11:48–12:36</div>
      {inAbhijit&&<div style={{fontSize:"8px",color:C.green,fontWeight:"700"}}>ACTIVE</div>}
    </div>,
    // 8 Date/Time
    <div key="dt" style={{textAlign:"right",padding:"5px 8px"}}>
      <div style={{fontSize:"8px",color:C.textDim,letterSpacing:"0.08em",marginBottom:"2px"}}>TIME · DATE</div>
      <div style={{fontSize:"12px",color:C.text,fontFamily:"monospace",fontWeight:"700"}}>{nowIST.slice(0,5)}</div>
      <div style={{fontSize:"9px",color:C.textMid}}>{TODAY.date}</div>
      <div style={{fontSize:"8px",color:C.textDim}}>{TODAY.vaar}</div>
    </div>,
    // 9 ★ LuckyPop
    <div key="lp" style={{textAlign:"center",padding:"5px 6px",
      background:lpState.score!==0?LP_REC_COLOR(lpState.signal)+"0C":"transparent",
      borderRadius:"3px",
      border:lpState.score!==0?`1px solid ${LP_REC_COLOR(lpState.signal)}30`:"1px solid transparent"}}>
      <div style={{fontSize:"8px",color:C.textDim,letterSpacing:"0.08em",marginBottom:"1px"}}>LUCKYPOP</div>
      <div style={{fontSize:"10px",fontWeight:"700",
        color:lpState.score!==0?LP_REC_COLOR(lpState.signal):C.textDim}}>
        {lpState.score>0?"▲":lpState.score<0?"▼":"—"}
        {lpState.score!==0&&` ${lpState.score>0?"+":""}${lpState.score}`}
      </div>
      <div style={{fontSize:"9px",fontWeight:"700",overflow:"hidden",
        whiteSpace:"nowrap",textOverflow:"ellipsis",
        color:lpState.score!==0?LP_REC_COLOR(lpState.signal):C.textDim}}>
        {lpState.signal}
      </div>
      {lpState.dot!=="NONE"&&(
        <div style={{fontSize:"8px",
          color:lpState.dot==="SVD"?C.purple:lpState.dot==="SBD"?C.blue:C.amber}}>
          ●{lpState.dot}
        </div>
      )}
    </div>,
  ];

  return (
    <div style={{fontFamily:"'DM Mono','Courier New',monospace",
      background:C.bg,color:C.text,minHeight:"100vh",fontSize:"13px"}}>

      {/* APP HEADER */}
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,
        padding:"7px 16px",display:"flex",alignItems:"center",
        justifyContent:"space-between",height:"38px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:"15px",
            color:C.gold,letterSpacing:"0.18em"}}>FINASTRO</div>
          <div style={{width:"6px",height:"6px",borderRadius:"50%",
            background:C.green,boxShadow:`0 0 5px ${C.green}`,
            animation:"pulse 1.5s ease-in-out infinite"}}/>
          <span style={{fontSize:"9px",color:C.green}}>LIVE</span>
        </div>
        <div style={{fontFamily:"monospace",fontSize:"13px",
          color:C.gold,letterSpacing:"0.1em"}}>{nowIST} IST</div>
        <div style={{fontSize:"9px",color:C.textDim}}>
          Screen 1 v3 · Ujjain · Lahiri · Sidereal
        </div>
      </div>

      {/* TOP STRIP — 9 cells */}
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,
        display:"grid",gridTemplateColumns:"repeat(9,1fr)"}}>
        {topCells.map((cell,i)=>(
          <div key={i} style={{borderRight:i<8?`1px solid ${C.border}`:"none",
            minWidth:0}}>{cell}</div>
        ))}
      </div>

      {/* ALERT STRIP */}
      <div style={{background:"#0A0E18",borderBottom:`1px solid ${C.border}22`,
        padding:"3px 14px",display:"flex",alignItems:"center",
        justifyContent:"space-between",fontSize:"9px"}}>
        <span style={{color:C.gold}}>
          🔔 {inRahu?"☊ Rahu Kala active — no new entries":
            inAbhijit?"☀ Abhijit active — best execution window":
            `⚡ Next: ${TODAY.nextEvent.time} ${TODAY.nextEvent.label}`}
        </span>
        <span style={{color:lpVerdict.color,fontWeight:"600"}}>
          LP:{lpState.symbol} {lpVerdict.text}
        </span>
      </div>

      {/* PANCHANG BAND */}
      <div style={{borderBottom:`1px solid ${C.border}`}}>
        {/* Inline band SVG */}
        {(() => {
          const W=100, H=28, open=9*60+15, close=15*60+30, range=close-open;
          const tx=(m)=>((m-open)/range)*W;
          const rs=tx(rahuS),re=tx(rahuE),as=tx(abhS),ae=tx(abhE);
          const nowX=tx(Math.min(nowMins,close));
          const yc=TODAY.yogaChange?tx(toMins(TODAY.yogaChange)):null;
          const tc=TODAY.tithiChange?tx(toMins(TODAY.tithiChange)):null;
          const qc=TODAY.sessionQuality===3?C.green:TODAY.sessionQuality===2?C.amber:C.red;
          return (
            <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none" style={{display:"block"}}>
              <rect x={0} y={0} width={W} height={H} fill={qc} opacity="0.16"/>
              <rect x={rs} y={0} width={Math.max(0,re-rs)} height={H} fill={C.red} opacity="0.18"/>
              <rect x={as} y={0} width={Math.max(0,ae-as)} height={H} fill={C.green} opacity="0.25"/>
              {/* Hatching on Rahu */}
              {[0,2,4,6,8,10,12,14,16,18,20,22,24,26].map(offset=>(
                <line key={offset}
                  x1={rs+offset*0.4} y1={0} x2={rs+offset*0.4-H*0.5} y2={H}
                  stroke={C.red} strokeWidth="0.3" opacity="0.3"/>
              ))}
              {yc&&<line x1={yc} y1={0} x2={yc} y2={H} stroke={C.gold} strokeWidth="0.8" opacity="0.7"/>}
              {tc&&<line x1={tc} y1={0} x2={tc} y2={H} stroke={C.gold} strokeWidth="0.8" opacity="0.5"/>}
              <line x1={nowX} y1={0} x2={nowX} y2={H}
                stroke={C.gold} strokeWidth="1.5" opacity="0.9"/>
              <text x={(rs+re)/2} y={H*0.65} textAnchor="middle" fontSize="3" fill={C.red}>☊ RAHU</text>
              <text x={(as+ae)/2} y={H*0.65} textAnchor="middle" fontSize="3" fill={C.green}>☀ ABHIJIT</text>
            </svg>
          );
        })()}
      </div>

      {/* MAIN BODY */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 260px",
        minHeight:"380px"}}>

        {/* LEFT: chart + indicator panels */}
        <div style={{borderRight:`1px solid ${C.border}`,
          display:"flex",flexDirection:"column"}}>

          {/* Candlestick chart */}
          <div style={{padding:"6px 10px 0",flexShrink:0}}>
            <div style={{fontSize:"8px",color:C.textDim,
              letterSpacing:"0.08em",marginBottom:"3px",
              display:"flex",justifyContent:"space-between"}}>
              <span>NIFTY 50 · 5MIN</span>
              <span style={{color:C.gold}}>{toTime(nowMins)} IST</span>
            </div>
            {/* Inline candle SVG */}
            {(() => {
              const W=660, H=180, open=9*60+15, close=15*60+30, range=close-open;
              const toX=(m)=>4+((m-open)/range)*(W-8);
              const prices=candles.flatMap(c=>[c.h,c.l]);
              const minP=Math.min(...prices), maxP=Math.max(...prices), pr=maxP-minP||10;
              const cy=(p)=>4+((1-(p-minP)/pr)*(H-8));
              const bw=Math.max(2,(W-8)/candles.length-1);
              const rx1=toX(rahuS),rx2=toX(rahuE);
              const ax1=toX(abhS),ax2=toX(abhE);
              const nowX=toX(Math.min(nowMins,close));
              return (
                <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
                  style={{display:"block",background:C.bg}}>
                  <rect x={rx1} y={0} width={Math.max(0,rx2-rx1)} height={H} fill={C.red} opacity="0.07"/>
                  <rect x={ax1} y={0} width={Math.max(0,ax2-ax1)} height={H} fill={C.green} opacity="0.07"/>
                  {[0.25,0.5,0.75].map((f,i)=>(
                    <line key={i} x1={4} y1={4+f*(H-8)} x2={W-4} y2={4+f*(H-8)}
                      stroke={C.border} strokeWidth="0.5" strokeDasharray="3,3"/>
                  ))}
                  {TODAY.yogaChange&&(
                    <line x1={toX(toMins(TODAY.yogaChange))} y1={0}
                      x2={toX(toMins(TODAY.yogaChange))} y2={H}
                      stroke={C.gold} strokeWidth="0.8" strokeDasharray="4,3" opacity="0.5"/>
                  )}
                  {TODAY.tithiChange&&(
                    <line x1={toX(toMins(TODAY.tithiChange))} y1={0}
                      x2={toX(toMins(TODAY.tithiChange))} y2={H}
                      stroke={C.gold} strokeWidth="0.6" strokeDasharray="3,3" opacity="0.4"/>
                  )}
                  {candles.map((c,i)=>{
                    const x=toX(c.mins), isFut=c.mins>nowMins;
                    const bull=c.c>=c.o;
                    const col=isFut?C.border:c.mins>=rahuS&&c.mins<rahuE?`${C.red}99`:bull?C.green:C.red;
                    const bt=cy(Math.max(c.o,c.c)), bh=Math.max(1,Math.abs(cy(c.o)-cy(c.c)));
                    return (
                      <g key={i} opacity={isFut?0.25:1}>
                        <line x1={x} y1={cy(c.h)} x2={x} y2={cy(c.l)} stroke={col} strokeWidth="1"/>
                        <rect x={x-bw/2} y={bt} width={bw} height={bh}
                          fill={bull&&!isFut?col:isFut?"transparent":col}
                          stroke={col} strokeWidth="0.5"/>
                      </g>
                    );
                  })}
                  <line x1={nowX} y1={0} x2={nowX} y2={H}
                    stroke={C.gold} strokeWidth="1.5" opacity="0.9"
                    style={{animation:"pulse 1.5s ease-in-out infinite"}}/>
                  <text x={rx1+2} y={H-3} fontSize="7" fill={C.red} opacity="0.6">☊ RAHU</text>
                  <text x={ax1+2} y={H-3} fontSize="7" fill={C.green} opacity="0.6">☀ ABHIJIT</text>
                </svg>
              );
            })()}
          </div>

          {/* Volume */}
          <div style={{padding:"0 10px",flexShrink:0}}>
            {(() => {
              const W=660, H=32, open=9*60+15, close=15*60+30;
              const toX=(m)=>4+((m-open)/(close-open))*(W-8);
              const maxV=Math.max(...candles.map(c=>c.vol));
              const bw=Math.max(2,(W-8)/candles.length-1);
              return (
                <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
                  style={{display:"block",background:C.bg}}>
                  {candles.map((c,i)=>{
                    const x=toX(c.mins), isFut=c.mins>nowMins;
                    const h=(c.vol/maxV)*(H-2);
                    const inR=c.mins>=rahuS&&c.mins<rahuE;
                    const col=isFut?C.border:inR?C.red:c.c>=c.o?C.green:C.red;
                    return <rect key={i} x={x-bw/2} y={H-h-1}
                      width={bw} height={Math.max(1,h)}
                      fill={col} opacity={isFut?0.15:0.6}/>;
                  })}
                </svg>
              );
            })()}
          </div>

          {/* Time axis */}
          <div style={{padding:"1px 10px 3px",
            display:"flex",justifyContent:"space-between",
            fontSize:"8px",color:C.textDim,flexShrink:0}}>
            {["09:15","10:00","11:00","12:00","13:00","14:00","15:00","15:30"]
              .map(t=><span key={t}>{t}</span>)}
          </div>

          {/* Moon strip */}
          <div style={{flexShrink:0}}>
            {(() => {
              const W=100, H=16, phase=TODAY.moonPhase;
              return (
                <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
                  preserveAspectRatio="none" style={{display:"block",background:"#070A0D"}}>
                  <rect x={0} y={4} width={W} height={6} rx="3" fill={C.border} opacity="0.4"/>
                  <rect x={0} y={4} width={phase*W} height={6} rx="3" fill={C.gold} opacity="0.35"/>
                  <text x={W/2} y={12} textAnchor="middle" fontSize="5" fill={C.textDim}>
                    {phase<0.5?"Waxing Gibbous":"Full Moon"} · {(phase*100).toFixed(0)}%
                  </text>
                </svg>
              );
            })()}
          </div>

          {/* ─── COLLAPSIBLE INDICATOR PANELS ─────────────────────────── */}

          {/* Panel 1: LuckyPop Recommendation */}
          <IndicatorPanel
            id="lp" label="LUCKYPOP ENHANCED v3.1"
            color={LP_REC_COLOR(lpState.signal)}
            subtitle={`${lpState.symbol} · ${lpState.signal} · Score ${lpState.score>0?"+":""}${lpState.score}`}
            open={open.lp} onToggle={()=>togglePanel("lp")} height={120}>
            <LPRecPanel candles={candles}
              lpSignal={lpState.signal} lpScore={lpState.score}
              lpDot={lpState.dot} lpFlow={lpState.flow}
              lpRvol={lpState.rvol} lpTvol={lpState.tvol}
              lpIb30={lpState.ib30} lpBq={lpState.bq}
              lpMagicRS={lpState.magicrs}/>
          </IndicatorPanel>

          {/* Panel 2: RSSI */}
          <IndicatorPanel
            id="rssi" label="LUCKYPOP RSSI"
            color={C.red}
            subtitle={`RSS ${rssiData.filter(d=>d.mins<=nowMins).slice(-1)[0]?.rss??50} · RSI ${rssiData.filter(d=>d.mins<=nowMins).slice(-1)[0]?.rsi??50} · OB/OS 80/20`}
            open={open.rssi} onToggle={()=>togglePanel("rssi")} height={120}>
            <RSSIPanel rssiData={rssiData} nowMins={nowMins}/>
          </IndicatorPanel>

          {/* Panel 3: Sniper Dragon */}
          <IndicatorPanel
            id="sniper" label="SNIPER SCOPE DRAGON"
            color={C.amber}
            subtitle={`Institution ${sniperData.filter(d=>d.mins<=nowMins).slice(-1)[0]?.institution??0} · Hot Money ${sniperData.filter(d=>d.mins<=nowMins).slice(-1)[0]?.hotmoney??0}`}
            open={open.sniper} onToggle={()=>togglePanel("sniper")} height={120}>
            <SniperDragonPanel sniperData={sniperData} nowMins={nowMins}/>
          </IndicatorPanel>

          {/* Panel 4: MagicRS */}
          <IndicatorPanel
            id="magicrs" label="LUCKYPOP SUPER MAGIC RS"
            color={C.green}
            subtitle={`Zone: ${magicData.filter(d=>d.mins<=nowMins).slice(-1)[0]?.zone??"—"} · MagicRS ${magicData.filter(d=>d.mins<=nowMins).slice(-1)[0]?.magicrs??0}%`}
            open={open.magicrs} onToggle={()=>togglePanel("magicrs")} height={120}>
            <MagicRSPanel magicData={magicData} nowMins={nowMins}/>
          </IndicatorPanel>

        </div>

        {/* RIGHT SIDEBAR */}
        <div style={{overflowY:"auto",padding:"10px",
          display:"flex",flexDirection:"column",gap:"8px"}}>

          {/* Score ring */}
          <div style={{...pnl(),display:"flex",alignItems:"center",
            justifyContent:"center",padding:"12px"}}>
            {(() => {
              const r=30, circ=2*Math.PI*r, dash=(confTotal/10)*circ;
              const col=confTotal>=7.5?C.gold:confTotal>=6?C.green:confTotal>=4?C.amber:C.red;
              return (
                <div style={{textAlign:"center"}}>
                  <svg width={72} height={72} viewBox="0 0 72 72">
                    <circle cx={36} cy={36} r={r} fill="none" stroke={C.border} strokeWidth="4"/>
                    <circle cx={36} cy={36} r={r} fill="none" stroke={col} strokeWidth="4"
                      strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round"
                      transform="rotate(-90 36 36)"/>
                    <text x={36} y={32} textAnchor="middle" fontSize="16" fontWeight="700" fill={col}>{confTotal}</text>
                    <text x={36} y={44} textAnchor="middle" fontSize="8" fill={C.textDim}>/10</text>
                  </svg>
                  <div style={{fontSize:"8px",color:C.textDim,letterSpacing:"0.1em"}}>CONFLUENCE</div>
                </div>
              );
            })()}
          </div>

          {/* Panchang */}
          <div style={pnl()}>
            <div style={lbl}>PANCHANG</div>
            {[
              {l:"Tithi",v:`${TODAY.tithi} (${TODAY.tithiPaksha})`,c:C.textMid},
              {l:"Yoga", v:TODAY.yoga,c:C.green},
              {l:"Nakshatra",v:TODAY.nakshatra,c:C.textMid},
              {l:"Moon",v:`${TODAY.moonSign} (${TODAY.moonElement})`,c:C.teal},
              {l:"Yoga ⚡",v:TODAY.yogaChange,c:C.gold},
              {l:"Tithi ⚡",v:TODAY.tithiChange,c:C.gold},
            ].map((r,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",
                padding:"3px 0",borderBottom:`1px solid ${C.border}22`,fontSize:"10px"}}>
                <span style={{color:C.textDim}}>{r.l}</span>
                <span style={{color:r.c,fontWeight:"600"}}>{r.v}</span>
              </div>
            ))}
          </div>

          {/* Planets */}
          <div style={pnl()}>
            <div style={lbl}>PLANETS</div>
            {[
              {l:"♃ Jupiter",v:"Cancer ↑ Exalted",c:C.gold},
              {l:"☿ Mercury",v:"Gemini ℞",c:C.amber},
              {l:"♀ Venus",  v:"Taurus Direct",c:C.green},
              {l:"♂ Mars",   v:"Cancer ↓",c:C.redDim},
              {l:"♄ Saturn", v:"Aries ↓",c:C.amberDim},
              {l:"☊ Rahu",   v:"Pisces",c:C.purple},
            ].map((r,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",
                padding:"3px 0",borderBottom:`1px solid ${C.border}22`,fontSize:"10px"}}>
                <span style={{color:C.textDim}}>{r.l}</span>
                <span style={{color:r.c}}>{r.v}</span>
              </div>
            ))}
          </div>

          {/* ★ LP+FIN Badge */}
          <LPFinBadge verdict={lpVerdict} panchang={TODAY}
            lpSignal={lpState.signal} lpScore={lpState.score}/>

          {/* Upcoming events */}
          <div style={pnl()}>
            <div style={lbl}>UPCOMING</div>
            {[
              {time:"09:50",label:"Yoga → Variyana",c:C.amber},
              {time:"10:30",label:"Rahu Kala opens",c:C.red},
              {time:"11:48",label:"Abhijit opens",  c:C.green},
              {time:"12:00",label:"Rahu closes",    c:C.amber},
              {time:"12:36",label:"Abhijit closes", c:C.green},
              {time:"13:40",label:"Tithi → Dwadashi",c:C.gold},
            ].map((e,i)=>(
              <div key={i} style={{display:"flex",gap:"8px",padding:"3px 0",
                borderBottom:`1px solid ${C.border}22`,
                fontSize:"10px",alignItems:"center"}}>
                <span style={{color:C.textDim,fontFamily:"monospace",
                  flexShrink:0,width:"34px"}}>{e.time}</span>
                <span style={{color:e.c}}>{e.label}</span>
              </div>
            ))}
          </div>

          {/* Indicator sidebar summaries */}
          <div style={pnl()}>
            <div style={lbl}>INDICATOR SUMMARY</div>
            {[
              {
                label:"LP Signal",
                val:lpState.signal,
                sub:`Score ${lpState.score>0?"+":""}${lpState.score} · MagicRS ${lpState.magicrs}/6`,
                color:LP_REC_COLOR(lpState.signal),
              },
              {
                label:"RSS",
                val:rssiData.filter(d=>d.mins<=nowMins).slice(-1)[0]?.rss??50,
                sub:rssiData.filter(d=>d.mins<=nowMins).slice(-1)[0]?.rss>=80?"Overbought":
                    rssiData.filter(d=>d.mins<=nowMins).slice(-1)[0]?.rss<=20?"Oversold":"Neutral",
                color:C.red,
                isNum:true,
              },
              {
                label:"Institution",
                val:sniperData.filter(d=>d.mins<=nowMins).slice(-1)[0]?.institution??0,
                sub:"Sniper Dragon",
                color:C.amber,
                isNum:true,
              },
              {
                label:"MagicRS Zone",
                val:magicData.filter(d=>d.mins<=nowMins).slice(-1)[0]?.zone??"-",
                sub:`${magicData.filter(d=>d.mins<=nowMins).slice(-1)[0]?.magicrs??0}% vs MA`,
                color:C.green,
              },
            ].map((r,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",
                padding:"5px 0",borderBottom:`1px solid ${C.border}22`,
                fontSize:"10px",alignItems:"center"}}>
                <div>
                  <div style={{color:C.textDim,fontSize:"9px"}}>{r.label}</div>
                  <div style={{color:C.textDim,fontSize:"8px"}}>{r.sub}</div>
                </div>
                <span style={{color:r.color,fontWeight:"700",fontSize:"12px"}}>
                  {r.val}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* GUIDANCE FOOTER */}
      <div style={{background:"#0D1016",borderTop:`1px solid ${C.border}`,
        padding:"7px 14px",display:"flex",gap:"12px",
        alignItems:"center",flexWrap:"wrap",fontSize:"10px"}}>
        {inRahu?(
          <span style={{color:C.red,fontWeight:"700"}}>
            ☊ IN RAHU KALA — No new entries. Stand aside.
            <span style={{fontSize:"8px",color:C.textDim,marginLeft:"5px"}}>✓ n=312, p=0.018</span>
          </span>
        ):inAbhijit?(
          <span style={{color:C.green,fontWeight:"700"}}>
            ☀ ABHIJIT ACTIVE — Best execution window.
            <span style={{fontSize:"8px",color:C.textDim,marginLeft:"5px"}}>✓ n=198, p=0.042</span>
          </span>
        ):TODAY.sessionQuality===3?(
          <span style={{color:C.green}}>✦ FAVORABLE — High-conviction entries possible.</span>
        ):TODAY.sessionQuality===0?(
          <span style={{color:C.red,fontWeight:"700"}}>✕ AVOID — Stand aside all day. ✓ n=486, p=0.028</span>
        ):(
          <span style={{color:C.amber}}>◎ NEUTRAL — Standard risk management.</span>
        )}
        <span style={{color:C.gold}}>
          ⚡ NEXT CHANGE {TODAY.nextEvent.time} — {TODAY.nextEvent.label}
        </span>
        {TODAY.jupiterCancer&&(
          <span style={{color:C.gold,fontSize:"9px"}}>
            ♃ JUPITER EXALTED ~ indicative n=3
          </span>
        )}
        <span style={{marginLeft:"auto",color:lpVerdict.color,
          fontWeight:"600",fontSize:"10px"}}>
          LP:{lpState.symbol} {lpVerdict.text}
        </span>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  );
}
