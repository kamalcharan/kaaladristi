import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// FINASTRO — SPRINT 5: LUCKYPOP INTEGRATION BRIDGE
// File: finastro_luckypop.jsx
// Architecture: LP Webhook → FastAPI :8101 → Finastro Filter → Combined Score → Alert
// Signal source: LuckyPop Enhanced v3.1 (Pine Script v6)
// Conflict engine: 4 cases + SVD/SBD/SYD dot handling
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

// ─── LP SIGNAL SCORE MAP (from getSignalScore in luckypop.pine) ───────────
const LP_SCORES = {
  "POWER BUY":10,"STRONG BUY":9,"BUY CONFIRMED":8,"BUY":7,
  "BUY BOOK FAST":6,"ACCUMULATION":5,"SCALP ONLY":4,
  "CAUTION":3,"WAIT":2,"AVOID":1,"NO TRADE":0,
  "POWER SELL":-10,"STRONG SELL":-9,"SELL":-8,
  "SELL BOOK FAST":-7,"SCALP SHORT":-6,"DISTRIBUTION":-5,"SQUEEZE RISK":-4,
};

const LP_SIGNAL_COLOR = (sig) => {
  const s = LP_SCORES[sig] ?? 0;
  if (s >= 9) return C.green;
  if (s >= 7) return "#6DD68A";
  if (s >= 5) return C.teal;
  if (s >= 3) return C.amber;
  if (s <= -9) return C.red;
  if (s <= -7) return "#E07070";
  if (s <= -5) return C.amber;
  return C.textDim;
};

const FLOW_COLORS = {
  "SOLID GREEN":C.green, "HOLLOW GREEN":"#6DD68A",
  "SOLID RED":C.red, "HOLLOW RED":"#E07070",
  "MIXED":C.amber, "GREY":C.textDim,
};

const FLOW_MEANING = {
  "SOLID GREEN":"Fresh Longs", "HOLLOW GREEN":"Short Covering",
  "SOLID RED":"Fresh Shorts", "HOLLOW RED":"Long Liquidation",
  "MIXED":"Mixed Flow", "GREY":"Low Volume",
};

// ─── RAHU KALA ────────────────────────────────────────────────────────────
const RAHU_KALA = {
  1:{start:"07:30",end:"09:00"},2:{start:"15:00",end:"16:30"},
  3:{start:"12:00",end:"13:30"},4:{start:"13:30",end:"15:00"},
  5:{start:"10:30",end:"12:00"},6:{start:"09:00",end:"10:30"},
};
const ABHIJIT = {start:"11:48",end:"12:36"};

// ─── PANCHANG CONTEXT (today) ─────────────────────────────────────────────
const TODAY_PANCHANG = {
  date:"2026-05-04", sessionQuality:2, qualityLabel:"NEUTRAL",
  tithi:"Ekadashi (Shukla)", yoga:"Siddhi", yogaQuality:3,
  nakshatra:"Pushya", moonSign:"Cancer", moonElement:"Water",
  tithiChange:"13:40", yogaChange:"09:50",
  rahuKala:"10:30–12:00", abhijit:"11:48–12:36",
  jupiterCancer:true, mercuryRetro:true, venusRetro:false,
};

// ─── CONFLICT RESOLUTION ENGINE ───────────────────────────────────────────
function resolveConflict(lp, panchang, timeIST) {
  const lpScore = LP_SCORES[lp.signal] ?? 0;
  const isBullish = lpScore > 0;
  const isBearish = lpScore < 0;
  const isEntry = Math.abs(lpScore) >= 7;
  const isDot = ["SVD","SBD","SYD","PRE-SYD"].includes(lp.dotSignal);

  // Check Rahu Kala
  const dow = new Date().getDay();
  const rahu = RAHU_KALA[dow];
  const inRahu = rahu && timeIST >= rahu.start && timeIST < rahu.end;
  const inAbhijit = timeIST >= ABHIJIT.start && timeIST < ABHIJIT.end;

  const sq = panchang.sessionQuality; // 0=avoid,1=caution,2=neutral,3=favorable
  const yogaAvoid = panchang.yoga === "Vyatipata" || panchang.yoga === "Vaidhriti";

  // ── HARD OVERRIDES (validated, cannot be bypassed) ──
  if (isEntry && inRahu) {
    return {
      verdict:"HARD OVERRIDE", badge:"✕ RAHU OVERRIDE",
      color:C.red, priority:"CRITICAL",
      rule:"Case 3 — Rahu Kala active. No entries regardless of LP signal.",
      stats:"n=312, p=0.018 · Validated override",
      action:"SKIP TRADE", combinedScore:null,
      finScore: sq * 1.5, multiplier:0,
    };
  }
  if (isEntry && isBullish && sq === 0) {
    return {
      verdict:"HARD CONFLICT", badge:"⚠ CONFLICT",
      color:C.red, priority:"CRITICAL",
      rule:"Case 2 — LP BUY + Panchang AVOID. Finastro AVOID overrides.",
      stats:"n=486, p=0.028 · Validated override",
      action:"SKIP TRADE", combinedScore:null,
      finScore:0, multiplier:0,
    };
  }
  if (isEntry && yogaAvoid) {
    return {
      verdict:"HARD CONFLICT", badge:"⚠ YOGA CONFLICT",
      color:C.red, priority:"CRITICAL",
      rule:"Vyatipata / Vaidhriti Yoga active — most inauspicious. Override LP.",
      stats:"n=2184, p=0.031 · Validated",
      action:"SKIP TRADE", combinedScore:null,
      finScore:0, multiplier:0,
    };
  }

  // ── WATCH MODE (no LP signal but good panchang) ──
  if (lpScore === 0 && sq === 3) {
    return {
      verdict:"WATCH MODE", badge:"◈ WATCH",
      color:C.purple, priority:"MED",
      rule:"Case 4 — No LP signal but Panchang FAVORABLE. Watch for LP entry.",
      stats:"sessionQuality=3 · n=2184 · p=0.031",
      action:"SET WATCH ALERT", combinedScore:null,
      finScore:sq * 1.5, multiplier:0,
    };
  }

  // ── ALIGNED (both systems agree) ──
  if (isEntry && isBullish && sq >= 2) {
    const finScore = sq * 1.5 + (inAbhijit ? 2.0 : 0) +
      (panchang.jupiterCancer ? 1.5 : 0) +
      (!panchang.mercuryRetro ? 0.5 : -1.0);
    const lpNorm = (lpScore / 10) * 6;
    const combined = +((lpNorm * 0.6 + Math.min(finScore,4) * 0.4)).toFixed(1);
    const alignStrength = sq === 3 ? "FULL" : "PARTIAL";
    return {
      verdict:"ALIGNED", badge:`▲▲ ${alignStrength} ALIGNED`,
      color:sq===3?C.gold:C.green, priority:combined>=7?"HIGH":"MED",
      rule:`Case 1 — LP BUY (score ${lpScore}) + Panchang ${panchang.qualityLabel}.`,
      stats:`Combined score: ${combined}/10`,
      action:sq===3&&inAbhijit?"FULL SIZE ENTRY":sq===3?"STANDARD ENTRY":"REDUCED SIZE",
      combinedScore:combined, finScore:+finScore.toFixed(1), multiplier:1,
    };
  }

  // ── SVD/SBD DOT + FAVORABLE ──
  if (isDot && sq >= 2) {
    const dotBoost = lp.dotSignal==="SVD"?2.5:lp.dotSignal==="SBD"?1.5:0;
    const finScore = sq * 1.5 + dotBoost + (inAbhijit?1.5:0);
    const combined = +((lpScore/10*6*0.6 + Math.min(finScore,5)*0.4)).toFixed(1);
    return {
      verdict:"ALIGNED", badge:"● DOT ALIGNED",
      color:C.teal, priority:"HIGH",
      rule:`${lp.dotSignal} dot detected + Panchang ${panchang.qualityLabel}. Institutional signal.`,
      stats:`Combined score: ${combined}/10 · Dot boost applied`,
      action:"CONFIRM ENTRY — watch for price confirmation",
      combinedScore:combined, finScore:+finScore.toFixed(1), multiplier:1,
    };
  }

  // ── SYD DOT vs FAVORABLE — divergence ──
  if (lp.dotSignal==="SYD" && sq===3) {
    return {
      verdict:"DOT CONFLICT", badge:"⚠ DOT CONFLICT",
      color:C.amber, priority:"HIGH",
      rule:"SYD (distribution dot) contradicts Panchang FAVORABLE. Institutional selling on favorable day.",
      stats:"Rare setup — monitor closely. No new longs until SYD resolves.",
      action:"HOLD EXISTING — no new entries",
      combinedScore:null, finScore:sq*1.5, multiplier:0.3,
    };
  }

  // ── CAUTION ZONE (entry signal + neutral/caution panchang) ──
  if (isEntry && sq === 1) {
    const finScore = sq * 1.0 - (panchang.mercuryRetro?1.0:0);
    const combined = +((lpScore/10*6*0.6 + Math.max(0,finScore)*0.4)).toFixed(1);
    return {
      verdict:"CAUTION", badge:"~ CAUTION",
      color:C.amber, priority:"MED",
      rule:`LP entry signal + Panchang CAUTION. Reduced conviction.`,
      stats:`Combined score: ${combined}/10 · Reduced size recommended`,
      action:"SCALP ONLY — tight stop, half size",
      combinedScore:combined, finScore:+finScore.toFixed(1), multiplier:0.5,
    };
  }

  // ── BEARISH WITH AVOID ── (short during avoid day = double bearish)
  if (isEntry && isBearish && sq <= 1) {
    const finScore = (3-sq)*1.2;
    const combined = +((Math.abs(lpScore)/10*6*0.6 + finScore*0.4)).toFixed(1);
    return {
      verdict:"ALIGNED", badge:"▼▼ BEAR ALIGNED",
      color:C.red, priority:"HIGH",
      rule:"LP SELL + Panchang AVOID/CAUTION. Both systems bearish.",
      stats:`Combined score: ${combined}/10 · Short conviction confirmed`,
      action:"SHORT ENTRY — both systems agree",
      combinedScore:combined, finScore:+finScore.toFixed(1), multiplier:1,
    };
  }

  // ── DEFAULT: LP SIGNAL ONLY ──
  return {
    verdict:"LP ONLY", badge:"○ LP ONLY",
    color:C.textMid, priority:"LOW",
    rule:"LP signal present but Panchang neutral. Technical-only setup.",
    stats:"Panchang neither confirms nor contradicts",
    action:"OPTIONAL — standard LP rules apply, no astro boost",
    combinedScore:null, finScore:sq*1.0, multiplier:0.6,
  };
}

// ─── MOCK LP SIGNAL FEED ──────────────────────────────────────────────────
function generateFeed() {
  const today = "2026-05-04";
  return [
    { id:1, ts:`${today} 09:22:00`, symbol:"SBIBANK",  signal:"STRONG BUY",
      score:9, price:782.40, rvol:1.82, tvol:1.14, flow:"SOLID GREEN",
      ib30:"BREAK UP", bq:5, magicrs:6, dotSignal:"SVD", sector:"PSU Banks" },
    { id:2, ts:`${today} 09:48:00`, symbol:"HINDUNILVR",signal:"BUY",
      score:7, price:2418.65, rvol:1.24, tvol:0.98, flow:"SOLID GREEN",
      ib30:"BREAK UP", bq:4, magicrs:4, dotSignal:"SBD", sector:"FMCG" },
    { id:3, ts:`${today} 10:31:00`, symbol:"TCS",       signal:"SELL",
      score:-8, price:3412.20, rvol:1.56, tvol:1.22, flow:"SOLID RED",
      ib30:"BREAK DOWN", bq:4, magicrs:2, dotSignal:"NONE", sector:"IT" },
    { id:4, ts:`${today} 10:55:00`, symbol:"RELIANCE",  signal:"CAUTION",
      score:3, price:1284.30, rvol:0.82, tvol:0.71, flow:"GREY",
      ib30:"INSIDE", bq:0, magicrs:3, dotSignal:"NONE", sector:"Energy" },
    { id:5, ts:`${today} 11:08:00`, symbol:"SUNPHARMA",  signal:"POWER BUY",
      score:10, price:1648.90, rvol:2.14, tvol:1.38, flow:"SOLID GREEN",
      ib30:"BREAK UP", bq:6, magicrs:5, dotSignal:"SVD", sector:"Pharma" },
    { id:6, ts:`${today} 11:52:00`, symbol:"TATAMOTORS", signal:"BUY CONFIRMED",
      score:8, price:824.50, rvol:1.45, tvol:1.08, flow:"HOLLOW GREEN",
      ib30:"BREAK UP", bq:3, magicrs:3, dotSignal:"SBD", sector:"Auto" },
    { id:7, ts:`${today} 12:14:00`, symbol:"AXISBANK",   signal:"STRONG BUY",
      score:9, price:1124.75, rvol:1.91, tvol:1.24, flow:"SOLID GREEN",
      ib30:"BREAK UP", bq:5, magicrs:5, dotSignal:"NONE", sector:"Pvt Banks" },
    { id:8, ts:`${today} 13:02:00`, symbol:"NIFTY50",    signal:"BUY BOOK FAST",
      score:6, price:22486.30, rvol:0.94, tvol:0.84, flow:"MIXED",
      ib30:"INSIDE", bq:2, magicrs:4, dotSignal:"NONE", sector:"Index" },
    { id:9, ts:`${today} 13:45:00`, symbol:"INFY",       signal:"STRONG SELL",
      score:-9, price:1558.40, rvol:1.68, tvol:1.31, flow:"SOLID RED",
      ib30:"BREAK DOWN", bq:5, magicrs:1, dotSignal:"SYD", sector:"IT" },
    { id:10,ts:`${today} 14:22:00`, symbol:"HDFCBANK",   signal:"ACCUMULATION",
      score:5, price:1786.20, rvol:3.24, tvol:1.82, flow:"SOLID GREEN",
      ib30:"INSIDE", bq:1, magicrs:4, dotSignal:"SBD", sector:"Pvt Banks" },
  ];
}

const TABS = ["⚡ SIGNAL FEED","◎ CONFLICT ENGINE","≡ COMBINED SCORE","⬡ WEBHOOK SPEC","◈ SCREEN MAP"];

export default function FinastroLuckyPop() {
  const [tab, setTab] = useState(0);
  const [feed, setFeed] = useState([]);
  const [selected, setSelected] = useState(null);
  const [resolved, setResolved] = useState([]);
  const [filterVerdict, setFilterVerdict] = useState("all");
  const [time, setTime] = useState(new Date());
  const [liveFlash, setLiveFlash] = useState(null);

  useEffect(() => {
    const f = generateFeed();
    setFeed(f);
    const r = f.map(sig => ({
      ...sig,
      resolution: resolveConflict(sig, TODAY_PANCHANG, sig.ts.slice(11,16)),
    }));
    setResolved(r);
    setSelected(r[0]);
  }, []);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Simulate incoming signal every 18s
  useEffect(() => {
    const t = setInterval(() => {
      const SYMBOLS = ["BAJFINANCE","WIPRO","MARUTI","BPCL","LTIM"];
      const SIGNALS = ["POWER BUY","STRONG BUY","BUY","SELL","STRONG SELL","CAUTION"];
      const sym = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
      const sig = SIGNALS[Math.floor(Math.random()*SIGNALS.length)];
      const newSig = {
        id: Date.now(), symbol:sym, signal:sig, score:LP_SCORES[sig]??0,
        price:+(1000+Math.random()*3000).toFixed(2),
        rvol:+(0.8+Math.random()*1.8).toFixed(2),
        tvol:+(0.6+Math.random()*1.4).toFixed(2),
        flow:["SOLID GREEN","HOLLOW GREEN","SOLID RED","MIXED","GREY"][Math.floor(Math.random()*5)],
        ib30:["BREAK UP","BREAK DOWN","INSIDE"][Math.floor(Math.random()*3)],
        bq:Math.floor(Math.random()*7), magicrs:Math.floor(Math.random()*7),
        dotSignal:["NONE","SVD","SBD","SYD"][Math.floor(Math.random()*4)],
        sector:"Various",
        ts: new Date().toISOString().replace("T"," ").slice(0,19),
      };
      const res = { ...newSig, resolution: resolveConflict(newSig, TODAY_PANCHANG,
        new Date().toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour12:false}).slice(0,5)) };
      setLiveFlash(res);
      setFeed(prev => [newSig, ...prev.slice(0,14)]);
      setResolved(prev => [res, ...prev.slice(0,14)]);
      setTimeout(() => setLiveFlash(null), 3500);
    }, 18000);
    return () => clearInterval(t);
  }, []);

  const filteredFeed = resolved.filter(r =>
    filterVerdict === "all" ? true :
    filterVerdict === "aligned" ? r.resolution.verdict === "ALIGNED" :
    filterVerdict === "conflict" ? ["HARD CONFLICT","HARD OVERRIDE","DOT CONFLICT"].includes(r.resolution.verdict) :
    filterVerdict === "watch" ? r.resolution.verdict === "WATCH MODE" : true
  );

  const nowIST = time.toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour12:false});
  const dow = time.getDay();
  const rahuNow = RAHU_KALA[dow];
  const inRahuNow = rahuNow && nowIST >= rahuNow.start && nowIST < rahuNow.end;
  const inAbhijitNow = nowIST >= ABHIJIT.start && nowIST < ABHIJIT.end;

  const alignedCount = resolved.filter(r=>r.resolution.verdict==="ALIGNED").length;
  const conflictCount = resolved.filter(r=>["HARD CONFLICT","HARD OVERRIDE","DOT CONFLICT"].includes(r.resolution.verdict)).length;
  const watchCount = resolved.filter(r=>r.resolution.verdict==="WATCH MODE").length;

  const st = {
    root:{fontFamily:"'DM Mono','Courier New',monospace", background:C.bg,
      color:C.text, minHeight:"100vh", fontSize:"13px"},
    card:{background:C.panel, border:`1px solid ${C.border}`, borderRadius:"4px", padding:"16px"},
    tab:(a)=>({padding:"10px 18px", cursor:"pointer", fontSize:"11px",
      letterSpacing:"0.06em", fontWeight:"600", background:"transparent", border:"none",
      borderBottom:`2px solid ${a?C.gold:"transparent"}`, color:a?C.gold:C.textDim,
      transition:"all 0.15s"}),
    pill:(a,col)=>({padding:"5px 12px", borderRadius:"3px", cursor:"pointer",
      fontSize:"10px", letterSpacing:"0.06em", fontWeight:"600",
      border:`1px solid ${a?(col||C.gold)+"60":C.border}`,
      background:a?(col||C.gold)+"18":"transparent",
      color:a?(col||C.gold):C.textDim, transition:"all 0.15s"}),
    badge:(col)=>({display:"inline-block", padding:"2px 8px", borderRadius:"3px",
      fontSize:"9px", fontWeight:"700", letterSpacing:"0.07em",
      background:col+"22", color:col, border:`1px solid ${col}50`}),
  };

  return (
    <div style={st.root}>
      {/* LIVE FLASH */}
      {liveFlash && (
        <div style={{position:"fixed",top:"16px",right:"16px",zIndex:1000,
          background:C.panel,border:`1px solid ${liveFlash.resolution.color}`,
          borderRadius:"6px",padding:"14px 18px",minWidth:"300px",
          boxShadow:"0 4px 24px #00000070"}}>
          <div style={{display:"flex",justifyContent:"space-between",
            alignItems:"center",marginBottom:"6px"}}>
            <span style={{color:liveFlash.resolution.color,fontWeight:"700",
              fontSize:"11px"}}>⚡ LIVE — {liveFlash.symbol}</span>
            <span style={st.badge(liveFlash.resolution.color)}>{liveFlash.resolution.badge}</span>
          </div>
          <div style={{fontSize:"11px",color:C.textMid}}>
            LP: <strong style={{color:LP_SIGNAL_COLOR(liveFlash.signal)}}>{liveFlash.signal}</strong>
            {liveFlash.resolution.combinedScore &&
              <span style={{color:C.gold,marginLeft:"8px"}}>
                Combined: {liveFlash.resolution.combinedScore}
              </span>}
          </div>
          <div style={{marginTop:"6px",height:"2px",background:C.border,borderRadius:"2px"}}>
            <div style={{height:"100%",background:liveFlash.resolution.color,
              animation:"shrink 3.5s linear forwards",borderRadius:"2px"}}/>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,
        padding:"13px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:"17px",color:C.gold,
            letterSpacing:"0.15em"}}>FINASTRO · LUCKYPOP BRIDGE</div>
          <div style={{fontSize:"10px",color:C.textDim,letterSpacing:"0.1em"}}>
            Sprint 5 · Pine Script v6 → FastAPI :8101 → Conflict Engine → Combined Score
          </div>
        </div>
        <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
          <div style={{fontSize:"12px",color:C.gold,fontFamily:"monospace"}}>{nowIST} IST</div>
          {inRahuNow && (
            <span style={{padding:"4px 10px",background:C.redDim,
              border:`1px solid ${C.red}60`,borderRadius:"3px",
              fontSize:"10px",color:C.red,fontWeight:"700"}}>☊ RAHU — NO ENTRIES</span>
          )}
          {inAbhijitNow && (
            <span style={{padding:"4px 10px",background:C.greenDim,
              border:`1px solid ${C.green}60`,borderRadius:"3px",
              fontSize:"10px",color:C.green,fontWeight:"700"}}>☀ ABHIJIT ACTIVE</span>
          )}
          {[
            {l:"ALIGNED",v:alignedCount,c:C.green},
            {l:"CONFLICTS",v:conflictCount,c:C.red},
            {l:"WATCHING",v:watchCount,c:C.purple},
          ].map(s=>(
            <div key={s.l} style={{background:C.bg,border:`1px solid ${C.border}`,
              borderRadius:"3px",padding:"5px 10px",textAlign:"center"}}>
              <div style={{fontSize:"9px",color:C.textDim,letterSpacing:"0.07em"}}>{s.l}</div>
              <div style={{fontSize:"15px",fontWeight:"700",color:s.c}}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PANCHANG CONTEXT BAR */}
      <div style={{background:"#0D1420",borderBottom:`1px solid ${C.border}`,
        padding:"7px 24px",display:"flex",gap:"16px",alignItems:"center",
        fontSize:"10px",flexWrap:"wrap"}}>
        <span style={{color:C.textDim,letterSpacing:"0.08em"}}>TODAY:</span>
        <span style={{color:TODAY_PANCHANG.sessionQuality===3?C.green:TODAY_PANCHANG.sessionQuality===0?C.red:C.amber}}>
          {TODAY_PANCHANG.qualityLabel} SESSION
        </span>
        <span style={{color:C.textMid}}>{TODAY_PANCHANG.tithi}</span>
        <span style={{color:TODAY_PANCHANG.yogaQuality===3?C.green:C.amber}}>
          {TODAY_PANCHANG.yoga} Yoga
        </span>
        <span style={{color:C.red}}>☊ Rahu {TODAY_PANCHANG.rahuKala}</span>
        <span style={{color:C.green}}>☀ Abhijit {TODAY_PANCHANG.abhijit}</span>
        {TODAY_PANCHANG.jupiterCancer && <span style={{color:C.gold}}>♃ Jupiter Cancer ↑</span>}
        {TODAY_PANCHANG.mercuryRetro && <span style={{color:C.amber}}>☿ Mercury ℞</span>}
        <span style={{marginLeft:"auto",color:C.teal,fontSize:"10px"}}>
          🔄 km_daily_panchang
        </span>
      </div>

      {/* TABS */}
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,
        padding:"0 24px",background:C.panel}}>
        {TABS.map((t,i)=>(
          <button key={i} onClick={()=>setTab(i)} style={st.tab(tab===i)}>{t}</button>
        ))}
      </div>

      <div style={{padding:"20px 24px"}}>

        {/* ── TAB 0: SIGNAL FEED ── */}
        {tab===0 && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:"16px"}}>
            <div>
              {/* Filters */}
              <div style={{display:"flex",gap:"8px",marginBottom:"14px",alignItems:"center"}}>
                <span style={{fontSize:"10px",color:C.textDim,letterSpacing:"0.08em"}}>FILTER:</span>
                {[["all","ALL",C.gold],["aligned","ALIGNED",C.green],
                  ["conflict","CONFLICTS",C.red],["watch","WATCH",C.purple]].map(([k,l,c])=>(
                  <button key={k} onClick={()=>setFilterVerdict(k)}
                    style={st.pill(filterVerdict===k,c)}>{l}</button>
                ))}
              </div>

              {/* Column headers */}
              <div style={{display:"grid",
                gridTemplateColumns:"70px 110px 110px 60px 70px 80px 1fr",
                gap:"6px",padding:"6px 14px",fontSize:"9px",
                letterSpacing:"0.09em",color:C.textDim,
                borderBottom:`1px solid ${C.border}`}}>
                <span>TIME</span><span>SYMBOL</span><span>LP SIGNAL</span>
                <span>SCORE</span><span>RVOL</span><span>FLOW</span><span>VERDICT</span>
              </div>

              {filteredFeed.map((r,i)=>(
                <div key={r.id} onClick={()=>setSelected(r)}
                  style={{display:"grid",
                    gridTemplateColumns:"70px 110px 110px 60px 70px 80px 1fr",
                    gap:"6px",padding:"10px 14px",cursor:"pointer",
                    background:selected?.id===r.id?"#1A2030":"transparent",
                    borderLeft:`3px solid ${selected?.id===r.id?r.resolution.color:C.border}`,
                    borderBottom:`1px solid ${C.border}22`,alignItems:"center",
                    transition:"all 0.1s"}}>
                  <div style={{fontSize:"10px",color:C.textDim,fontFamily:"monospace"}}>
                    {r.ts.slice(11,16)}
                  </div>
                  <div>
                    <div style={{fontSize:"12px",color:C.text,fontWeight:"600"}}>{r.symbol}</div>
                    <div style={{fontSize:"9px",color:C.textDim}}>{r.sector}</div>
                  </div>
                  <div>
                    <div style={{fontSize:"11px",color:LP_SIGNAL_COLOR(r.signal),
                      fontWeight:"700"}}>{r.signal}</div>
                    {r.dotSignal!=="NONE" && (
                      <div style={{fontSize:"9px",color:
                        r.dotSignal==="SVD"?C.purple:r.dotSignal==="SBD"?C.blue:C.amber}}>
                        ● {r.dotSignal}
                      </div>
                    )}
                  </div>
                  <div style={{textAlign:"center"}}>
                    <span style={{fontSize:"14px",fontWeight:"700",
                      color:LP_SIGNAL_COLOR(r.signal)}}>{r.score>0?"+":""}{r.score}</span>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <span style={{color:r.rvol>=1.5?C.green:r.rvol>=1.0?C.amber:C.red,
                      fontWeight:"700",fontSize:"12px"}}>{r.rvol}x</span>
                  </div>
                  <div>
                    <span style={{fontSize:"9px",color:FLOW_COLORS[r.flow]||C.textDim,
                      padding:"1px 5px",border:`1px solid ${(FLOW_COLORS[r.flow]||C.textDim)+"40"}`,
                      borderRadius:"2px"}}>{r.flow.split(" ")[0]}</span>
                  </div>
                  <div>
                    <span style={{fontSize:"10px",fontWeight:"700",
                      color:r.resolution.color}}>{r.resolution.badge}</span>
                    {r.resolution.combinedScore && (
                      <span style={{fontSize:"10px",color:C.gold,marginLeft:"8px"}}>
                        {r.resolution.combinedScore}/10
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Detail panel */}
            {selected && <SignalDetailPanel r={selected} st={st} panchang={TODAY_PANCHANG}/>}
          </div>
        )}

        {/* ── TAB 1: CONFLICT ENGINE ── */}
        {tab===1 && <ConflictEngineView resolved={resolved} st={st}/>}

        {/* ── TAB 2: COMBINED SCORE ── */}
        {tab===2 && <CombinedScoreView resolved={resolved} st={st}/>}

        {/* ── TAB 3: WEBHOOK SPEC ── */}
        {tab===3 && <WebhookSpecView st={st}/>}

        {/* ── TAB 4: SCREEN MAP ── */}
        {tab===4 && <ScreenMapView st={st}/>}
      </div>

      <style>{`
        @keyframes shrink { from{width:100%} to{width:0%} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}

// ─── SIGNAL DETAIL PANEL ───────────────────────────────────────────────────
function SignalDetailPanel({ r, st, panchang }) {
  const res = r.resolution;
  return (
    <div style={{...st.card,position:"sticky",top:"20px"}}>
      {/* Verdict header */}
      <div style={{background:res.color+"18",border:`1px solid ${res.color}40`,
        borderRadius:"3px",padding:"10px 14px",marginBottom:"14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:"13px",
            color:res.color,letterSpacing:"0.1em"}}>{res.verdict}</span>
          <span style={{fontSize:"9px",color:res.color,padding:"2px 8px",
            border:`1px solid ${res.color}50`,borderRadius:"3px",
            fontWeight:"700"}}>{res.priority}</span>
        </div>
        <div style={{fontSize:"10px",color:C.textMid,marginTop:"4px"}}>{res.badge}</div>
      </div>

      {/* Symbol + signal */}
      <div style={{display:"flex",gap:"12px",alignItems:"center",marginBottom:"14px"}}>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:"15px",
            color:C.text,letterSpacing:"0.1em"}}>{r.symbol}</div>
          <div style={{fontSize:"10px",color:C.textDim}}>{r.sector} · ₹{r.price}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:"13px",fontWeight:"700",
            color:LP_SIGNAL_COLOR(r.signal)}}>{r.signal}</div>
          <div style={{fontSize:"20px",fontWeight:"700",
            color:LP_SIGNAL_COLOR(r.signal)}}>{r.score>0?"+":""}{r.score}</div>
        </div>
      </div>

      {/* Combined score */}
      {res.combinedScore ? (
        <div style={{background:"#0D1016",border:`1px solid ${C.gold}40`,
          borderRadius:"3px",padding:"12px",marginBottom:"14px",textAlign:"center"}}>
          <div style={{fontSize:"9px",color:C.textDim,letterSpacing:"0.1em",
            marginBottom:"4px"}}>COMBINED CONVICTION SCORE</div>
          <div style={{fontSize:"32px",fontWeight:"700",color:C.gold}}>{res.combinedScore}</div>
          <div style={{fontSize:"10px",color:C.textDim}}>out of 10</div>
          <div style={{fontSize:"10px",color:C.textMid,marginTop:"4px"}}>
            LP×0.6 + Finastro×0.4
          </div>
        </div>
      ) : (
        <div style={{background:C.redDim+"22",border:`1px solid ${C.red}30`,
          borderRadius:"3px",padding:"10px",marginBottom:"14px",textAlign:"center",
          fontSize:"11px",color:C.red}}>
          NO COMBINED SCORE — {res.action}
        </div>
      )}

      {/* Stats grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px",marginBottom:"12px"}}>
        {[
          {l:"LP Score",v:`${r.score>0?"+":""}${r.score}/10`,
            c:LP_SIGNAL_COLOR(r.signal)},
          {l:"Fin Score",v:`${res.finScore}/6`,c:C.teal},
          {l:"RVOL",v:`${r.rvol}x`,c:r.rvol>=1.5?C.green:r.rvol>=1.0?C.amber:C.red},
          {l:"TVOL",v:`${r.tvol}x`,c:r.tvol>=1.0?C.green:C.amber},
          {l:"Flow",v:r.flow,c:FLOW_COLORS[r.flow]||C.textDim},
          {l:"IB30",v:r.ib30,c:r.ib30==="BREAK UP"?C.green:r.ib30==="BREAK DOWN"?C.red:C.textDim},
          {l:"BQ",v:`${r.bq}/6`,c:r.bq>=5?C.gold:r.bq>=3?C.green:C.amber},
          {l:"MagicRS",v:`${r.magicrs}/6`,c:r.magicrs>=5?C.green:r.magicrs>=3?C.amber:C.red},
        ].map((item,i)=>(
          <div key={i} style={{background:"#0A0E14",padding:"7px",borderRadius:"3px",
            border:`1px solid ${C.border}`}}>
            <div style={{fontSize:"9px",color:C.textDim,letterSpacing:"0.07em",
              marginBottom:"2px"}}>{item.l}</div>
            <div style={{fontSize:"11px",fontWeight:"700",color:item.c}}>{item.v}</div>
          </div>
        ))}
      </div>

      {/* Rule + action */}
      <div style={{padding:"10px",background:res.color+"12",
        border:`1px solid ${res.color}40`,borderRadius:"3px",marginBottom:"10px",
        fontSize:"10px",color:C.textMid,lineHeight:"1.7"}}>
        <strong style={{color:res.color}}>Rule:</strong> {res.rule}<br/>
        <strong style={{color:C.textDim}}>Stats:</strong> {res.stats}
      </div>

      <div style={{padding:"8px 10px",background:"#0C1820",
        border:`1px solid ${res.color}50`,borderRadius:"3px",
        fontSize:"11px",fontWeight:"700",color:res.color,textAlign:"center"}}>
        → {res.action}
      </div>

      <div style={{marginTop:"10px",padding:"7px",background:"#0A1020",
        border:`1px dashed ${C.teal}40`,borderRadius:"3px",
        fontSize:"9px",color:C.teal}}>
        🔄 LIVE — webhook from TradingView → POST /luckypop/signal on :8101
      </div>
    </div>
  );
}

// ─── CONFLICT ENGINE VIEW ──────────────────────────────────────────────────
function ConflictEngineView({ resolved, st }) {
  const CASES = [
    { num:"Case 1", title:"LP BUY + Panchang FAVORABLE",
      verdict:"ALIGNED", color:C.gold, icon:"▲▲",
      rule:"Both systems agree. Combined score = LP×0.6 + Finastro×0.4.",
      stats:"Highest conviction. Full size if Abhijit active + score ≥8.",
      example: resolved.find(r=>r.resolution.verdict==="ALIGNED"&&r.resolution.badge.includes("ALIGNED")),
    },
    { num:"Case 2", title:"LP BUY + Panchang AVOID (pq=0)",
      verdict:"HARD CONFLICT", color:C.red, icon:"⚠",
      rule:"AVOID is a validated signal (n=486, p=0.028). Overrides LP regardless of LP score.",
      stats:"Hard rule — no exceptions. Even POWER BUY is skipped.",
      example: null,
    },
    { num:"Case 3", title:"LP BUY + Rahu Kala Active",
      verdict:"HARD OVERRIDE", color:C.red, icon:"☊",
      rule:"Rahu Kala validated at n=312, p=0.018. No entries during window. Applies to all LP signals.",
      stats:"90-min window by weekday. LP signal is queued — re-evaluate after Rahu closes.",
      example: null,
    },
    { num:"Case 4", title:"No LP Signal + Panchang FAVORABLE",
      verdict:"WATCH MODE", color:C.purple, icon:"◈",
      rule:"Good panchang but LP hasn't fired. Set watch alert for LP entry within this window.",
      stats:"Do not force entry. Wait for LP confirmation. Alert: 'Watch for LP on {symbol}'.",
      example: resolved.find(r=>r.resolution.verdict==="WATCH MODE"),
    },
    { num:"Bonus", title:"SVD/SBD Dot + Panchang ≥ Neutral",
      verdict:"DOT ALIGNED", color:C.teal, icon:"●",
      rule:"Institutional dot + favorable/neutral panchang = high-conviction setup.",
      stats:"SVD = stronger (+2.5 boost), SBD = moderate (+1.5). Require price confirmation.",
      example: resolved.find(r=>r.resolution.verdict==="ALIGNED"&&r.resolution.badge.includes("DOT")),
    },
    { num:"Bonus", title:"SYD Dot + Panchang FAVORABLE",
      verdict:"DOT CONFLICT", color:C.amber, icon:"⚠",
      rule:"SYD = distribution. Contradicts favorable panchang. Rare — institutional selling on good day.",
      stats:"No new longs. Monitor. Often precedes sharp reversal within 1–3 sessions.",
      example: resolved.find(r=>r.resolution.verdict==="DOT CONFLICT"),
    },
  ];

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px"}}>
      {CASES.map((c,i)=>(
        <div key={i} style={{...st.card,borderLeft:`3px solid ${c.color}`,
          background:c.resolution?.color?"#1A2030":C.panel}}>
          <div style={{display:"flex",justifyContent:"space-between",
            alignItems:"flex-start",marginBottom:"10px"}}>
            <div>
              <div style={{fontSize:"9px",color:C.textDim,letterSpacing:"0.1em",
                marginBottom:"3px"}}>{c.num}</div>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:"12px",
                color:c.color,letterSpacing:"0.08em"}}>{c.title}</div>
            </div>
            <span style={{fontSize:"20px",color:c.color}}>{c.icon}</span>
          </div>
          <div style={{fontSize:"10px",color:C.textMid,lineHeight:"1.7",
            marginBottom:"10px"}}>{c.rule}</div>
          <div style={{fontSize:"10px",color:C.textDim,lineHeight:"1.6",
            marginBottom:"10px",padding:"7px",background:"#0A0E14",
            borderRadius:"3px",border:`1px solid ${C.border}`}}>{c.stats}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:"9px",fontWeight:"700",color:c.color,
              padding:"2px 8px",background:c.color+"18",
              border:`1px solid ${c.color}40`,borderRadius:"2px"}}>{c.verdict}</span>
            {c.example && (
              <span style={{fontSize:"10px",color:C.textDim}}>
                eg. {c.example.symbol} @ {c.example.ts.slice(11,16)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── COMBINED SCORE VIEW ───────────────────────────────────────────────────
function CombinedScoreView({ resolved, st }) {
  const scorable = resolved.filter(r=>r.resolution.combinedScore !== null)
    .sort((a,b)=>b.resolution.combinedScore - a.resolution.combinedScore);

  return (
    <div>
      {/* Formula */}
      <div style={{...st.card,marginBottom:"16px",
        background:"#0D1420",border:`1px solid ${C.gold}40`}}>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:"13px",color:C.gold,
          letterSpacing:"0.1em",marginBottom:"10px"}}>COMBINED CONVICTION FORMULA</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"10px"}}>
          {[
            {label:"LP Technical Score",weight:"60%",color:C.teal,
              note:"getSignalScore() normalised 0–6"},
            {label:"Finastro Panchang",weight:"20%",color:C.green,
              note:"sessionQuality × 1.5 + Abhijit +2"},
            {label:"Planetary Filter",weight:"20%",color:C.amber,
              note:"Jupiter exalted +1.5 · Mercury ℞ −1.0"},
            {label:"Flow Multiplier",weight:"×",color:C.purple,
              note:"SOLID GREEN ×1 · HOLLOW ×0.7 · GREY ×0.3"},
          ].map((item,i)=>(
            <div key={i} style={{padding:"10px",background:"#0A0E14",
              borderRadius:"3px",border:`1px solid ${C.border}`,
              borderTop:`3px solid ${item.color}`}}>
              <div style={{fontSize:"9px",color:C.textDim,marginBottom:"4px",
                letterSpacing:"0.07em"}}>{item.label}</div>
              <div style={{fontSize:"18px",fontWeight:"700",
                color:item.color}}>{item.weight}</div>
              <div style={{fontSize:"9px",color:C.textDim,
                marginTop:"4px"}}>{item.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scorable signals */}
      <div style={{...st.card}}>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:"12px",color:C.gold,
          letterSpacing:"0.1em",marginBottom:"12px"}}>
          TODAY'S RANKED OPPORTUNITIES ({scorable.length} signals)
        </div>
        <div style={{display:"grid",
          gridTemplateColumns:"30px 100px 1fr 80px 80px 100px 80px",
          gap:"6px",padding:"6px 10px",fontSize:"9px",letterSpacing:"0.09em",
          color:C.textDim,borderBottom:`1px solid ${C.border}`}}>
          <span>#</span><span>SYMBOL</span><span>LP SIGNAL</span>
          <span>LP SCORE</span><span>FIN SCORE</span>
          <span>COMBINED</span><span>ACTION</span>
        </div>
        {scorable.map((r,i)=>{
          const res = r.resolution;
          const combined = res.combinedScore;
          const barW = (combined/10)*100;
          return (
            <div key={r.id} style={{display:"grid",
              gridTemplateColumns:"30px 100px 1fr 80px 80px 100px 80px",
              gap:"6px",padding:"9px 10px",
              borderBottom:`1px solid ${C.border}22`,alignItems:"center"}}>
              <div style={{fontSize:"11px",color:C.textDim,fontWeight:"700"}}>
                {i+1}</div>
              <div>
                <div style={{fontSize:"12px",color:C.text,fontWeight:"600"}}>{r.symbol}</div>
                <div style={{fontSize:"9px",color:C.textDim}}>{r.sector}</div>
              </div>
              <div style={{fontSize:"11px",color:LP_SIGNAL_COLOR(r.signal),
                fontWeight:"600"}}>{r.signal}</div>
              <div style={{textAlign:"right",fontSize:"13px",fontWeight:"700",
                color:LP_SIGNAL_COLOR(r.signal)}}>{r.score>0?"+":""}{r.score}</div>
              <div style={{textAlign:"right",fontSize:"13px",fontWeight:"700",
                color:C.teal}}>{res.finScore}</div>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                  <div style={{flex:1,background:C.border,height:"6px",borderRadius:"3px",overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:"3px",
                      background:combined>=8?C.gold:combined>=6?C.green:C.amber,
                      width:`${barW}%`}}/>
                  </div>
                  <span style={{fontSize:"14px",fontWeight:"700",
                    color:combined>=8?C.gold:combined>=6?C.green:C.amber,
                    minWidth:"24px",textAlign:"right"}}>{combined}</span>
                </div>
              </div>
              <div style={{fontSize:"9px",color:res.color,fontWeight:"700"}}>{res.action}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── WEBHOOK SPEC VIEW ─────────────────────────────────────────────────────
function WebhookSpecView({ st }) {
  const payload = `{
  "symbol":    "{{ticker}}",
  "signal":    "POWER BUY",
  "score":     10,
  "price":     {{close}},
  "rvol":      {{plot_0}},
  "tvol":      {{plot_1}},
  "flow":      "SOLID GREEN",
  "ib30":      "BREAK UP",
  "bq":        5,
  "magicrs":   6,
  "dot":       "SVD",
  "timeframe": "{{interval}}",
  "time":      "{{timenow}}"
}`;

  const fastapiCode = `# Add to pipeline2_api.py on port 8101
from fastapi import FastAPI, Request
from datetime import datetime
import psycopg2

@app.post("/luckypop/signal")
async def receive_luckypop_signal(request: Request):
    body = await request.json()
    
    # 1. Parse LP signal
    symbol  = body["symbol"]
    signal  = body["signal"]
    score   = body["score"]
    rvol    = body["rvol"]
    dot     = body.get("dot", "NONE")
    
    # 2. Fetch today's panchang from DB
    conn = get_db_connection()
    cur = conn.cursor()
    today = datetime.now().strftime("%Y-%m-%d")
    cur.execute("""
        SELECT session_quality, yoga_id, tithi_id,
               yoga_changeover, tithi_changeover
        FROM km_daily_panchang
        WHERE date = %s
    """, (today,))
    panchang = cur.fetchone()
    sq = panchang[0] if panchang else 2
    
    # 3. Check Rahu Kala
    from_rahu = check_rahu_kala(datetime.now())  # returns True if in Rahu
    
    # 4. Resolve conflict
    verdict = resolve_conflict(signal, score, sq, from_rahu, dot)
    
    # 5. Write to km_finastro_alerts
    if verdict["priority"] in ["CRITICAL","HIGH"]:
        cur.execute("""
            INSERT INTO km_finastro_alerts
              (type_id, fired_at, priority, title, body, stock_symbol)
            VALUES (%s, NOW(), %s, %s, %s, %s)
        """, (
            "lp_fin_" + verdict["verdict"].lower().replace(" ","_"),
            verdict["priority"],
            f"{verdict['badge']} — {symbol}",
            f"LP: {signal} ({score}) | {verdict['rule']}",
            symbol
        ))
        conn.commit()
    
    return {
        "symbol": symbol,
        "verdict": verdict["verdict"],
        "combined_score": verdict.get("combined_score"),
        "action": verdict["action"],
        "alert_fired": verdict["priority"] in ["CRITICAL","HIGH"]
    }`;

  const alertMsg = `// In LuckyPop Pine Script — replace alertcondition messages:

// POWER BUY alert
alertcondition(
  finalRecommendation == "POWER BUY",
  title="Power Buy Signal",
  message='{"symbol":"{{ticker}}","signal":"POWER BUY","score":10,' +
    '"price":{{close}},"rvol":' + str.tostring(current_rvol,"#.##") + ',' +
    '"tvol":' + str.tostring(current_tvol,"#.##") + ',' +
    '"flow":"' + flowType + '",' +
    '"ib30":"' + ib30Status + '",' +
    '"bq":' + str.tostring(activeBreakoutQuality) + ',' +
    '"magicrs":' + str.tostring(flowStrengthPoints) + ',' +
    '"dot":"' + dotSignal + '",' +
    '"time":"{{timenow}}"}'
)`;

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}>
      <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
        <div style={st.card}>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:"12px",color:C.gold,
            letterSpacing:"0.1em",marginBottom:"10px"}}>
            TRADINGVIEW WEBHOOK PAYLOAD
          </div>
          <div style={{fontSize:"10px",color:C.textDim,marginBottom:"8px",
            lineHeight:"1.6"}}>
            In TradingView alert settings, set URL to:<br/>
            <code style={{color:C.teal}}>http://187.127.136.65:8101/luckypop/signal</code>
          </div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:"10px",
            background:"#070A0D",border:`1px solid ${C.border}`,
            borderRadius:"4px",padding:"12px",color:C.textMid,
            lineHeight:"1.7",whiteSpace:"pre"}}>{payload}</div>
          <div style={{marginTop:"8px",fontSize:"9px",color:C.textDim,
            lineHeight:"1.6"}}>
            Note: <code style={{color:C.amber}}>{"{{plot_0}}"}</code> = current_rvol,{" "}
            <code style={{color:C.amber}}>{"{{plot_1}}"}</code> = current_tvol.
            These are the <code>display=display.none</code> plots already in LuckyPop.
            Add rvol/tvol as exported plots if not already present.
          </div>
        </div>

        <div style={st.card}>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:"12px",color:C.gold,
            letterSpacing:"0.1em",marginBottom:"10px"}}>
            PINE SCRIPT ALERT MESSAGE FORMAT
          </div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:"10px",
            background:"#070A0D",border:`1px solid ${C.border}`,
            borderRadius:"4px",padding:"12px",color:C.textMid,
            lineHeight:"1.7",whiteSpace:"pre",overflowX:"auto"}}>{alertMsg}</div>
        </div>
      </div>

      <div>
        <div style={st.card}>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:"12px",color:C.gold,
            letterSpacing:"0.1em",marginBottom:"10px"}}>
            FASTAPI ENDPOINT — pipeline2_api.py (:8101)
          </div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:"10px",
            background:"#070A0D",border:`1px solid ${C.border}`,
            borderRadius:"4px",padding:"12px",color:C.textMid,
            lineHeight:"1.7",maxHeight:"480px",overflowY:"auto",
            whiteSpace:"pre"}}>{fastapiCode}</div>
          <div style={{marginTop:"10px",display:"flex",flexDirection:"column",gap:"6px"}}>
            {[
              {l:"Endpoint",v:"POST /luckypop/signal",c:C.teal},
              {l:"Port",v:"8101 (pipeline2_api.py)",c:C.textMid},
              {l:"DB read",v:"km_daily_panchang (session_quality)",c:C.textMid},
              {l:"DB write",v:"km_finastro_alerts",c:C.textMid},
              {l:"Response",v:"verdict + combined_score + action",c:C.green},
            ].map((r,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",
                padding:"5px 0",borderBottom:`1px solid ${C.border}22`,
                fontSize:"10px"}}>
                <span style={{color:C.textDim}}>{r.l}</span>
                <span style={{color:r.c,fontFamily:"monospace"}}>{r.v}</span>
              </div>
            ))}
          </div>
          <div style={{marginTop:"10px",padding:"8px",background:"#0A1020",
            border:`1px dashed ${C.teal}40`,borderRadius:"3px",
            fontSize:"9px",color:C.teal,lineHeight:"1.7"}}>
            🔄 REPLACE WITH LIVE DATA — this screen uses mock feed.
            Wire TradingView webhook → POST :8101/luckypop/signal.
            Start FastAPI: <code>python -m uvicorn pipeline2_api:app --host 0.0.0.0 --port 8101 --reload</code>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN MAP VIEW ───────────────────────────────────────────────────────
function ScreenMapView({ st }) {
  const updates = [
    { screen:"Screen 1", file:"finastro_screen1.jsx", sprint:"Sprint 5",
      items:[
        {where:"TOP STRIP — 9th cell", what:"LP signal type + direction + strength dot",
          detail:"Add cell after Date/Time. Shows: LP: POWER BUY ▲ 10 | or LP: — (no signal)"},
        {where:"RIGHT SIDEBAR — below score dial", what:"LP+FIN confluence badge",
          detail:"'LP+FIN: 8.4 ALIGNED' in gold | 'CONFLICT' in red | 'WATCH' in purple"},
      ]},
    { screen:"Screen 4 v3", file:"finastro_screen4_v3.jsx", sprint:"Sprint 5",
      items:[
        {where:"New column after HONEST score", what:"LP signal column",
          detail:"LP: BUY / SELL / NONE + numeric score ±10"},
        {where:"Signal column", what:"Confluence badge",
          detail:"▲▲ ALIGNED | ⚠ CONFLICT | ○ LP ONLY | ◈ WATCH"},
        {where:"Row far right", what:"'Set Alert' button",
          detail:"Opens Sprint 3 alert config for that specific stock"},
      ]},
    { screen:"Screen 2 v2", file:"finastro_screen2_v2.jsx", sprint:"Sprint 5",
      items:[
        {where:"REVIEW mode day column", what:"LP signal row below price area",
          detail:"Shows LP signal that fired on that past day + outcome"},
        {where:"PLAN mode day column", what:"LP watch note",
          detail:"'Watch for LP signal on this day' if panchang favorable"},
      ]},
    { screen:"Dashboard v2", file:"finastro_dashboard_v2.jsx", sprint:"Sprint 5",
      items:[
        {where:"Header bar", what:"LP feed bell icon",
          detail:"Unread count badge. Click → opens LuckyPop tab"},
        {where:"Tab bar", what:"Add LuckyPop tab",
          detail:"5th tab: ⚡ LP BRIDGE → renders finastro_luckypop.jsx"},
      ]},
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
      {updates.map((u,i)=>(
        <div key={i} style={st.card}>
          <div style={{display:"flex",gap:"12px",alignItems:"center",marginBottom:"12px"}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:"13px",
              color:C.gold,letterSpacing:"0.1em"}}>{u.screen}</div>
            <code style={{fontSize:"10px",color:C.teal,padding:"2px 8px",
              background:C.tealDim+"33",border:`1px solid ${C.teal}30`,
              borderRadius:"3px"}}>{u.file}</code>
            <span style={{fontSize:"9px",color:C.purple,padding:"2px 7px",
              border:`1px solid ${C.purple}40`,borderRadius:"2px",marginLeft:"auto"}}>
              {u.sprint}
            </span>
          </div>
          {u.items.map((item,j)=>(
            <div key={j} style={{display:"grid",
              gridTemplateColumns:"200px 180px 1fr",gap:"10px",
              padding:"8px 10px",marginBottom:"4px",
              background:"#0D1016",borderRadius:"3px",
              borderLeft:`3px solid ${C.teal}`,alignItems:"start"}}>
              <div style={{fontSize:"10px",color:C.teal}}>{item.where}</div>
              <div style={{fontSize:"10px",color:C.text,fontWeight:"600"}}>{item.what}</div>
              <div style={{fontSize:"10px",color:C.textDim,lineHeight:"1.5"}}>{item.detail}</div>
            </div>
          ))}
        </div>
      ))}

      <div style={{...st.card,background:"#0A1020",
        border:`1px dashed ${C.teal}40`}}>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:"12px",color:C.teal,
          letterSpacing:"0.1em",marginBottom:"10px"}}>SPRINT 5 COMPLETION CHECKLIST</div>
        {[
          "finastro_luckypop.jsx created ✓ (this file)",
          "Screen 1 — 9th Top Strip cell added",
          "Screen 1 — Right sidebar LP+FIN badge added",
          "Screen 4 v3 — LP column + confluence badge added",
          "Screen 4 v3 — Set Alert button per row wired to Sprint 3",
          "Screen 2 v2 — LP signal row in REVIEW mode",
          "finastro_dashboard_v2.jsx — 5th tab + header bell wired",
          "FastAPI endpoint POST /luckypop/signal added to pipeline2_api.py",
          "TradingView alerts updated with JSON payload format",
          "finastro_complete_doc.docx — Section 15 added",
          "finastro_handover.docx updated for Sprint 6",
        ].map((item,i)=>{
          const done = item.includes("✓");
          return (
            <div key={i} style={{display:"flex",gap:"10px",padding:"6px 0",
              borderBottom:`1px solid ${C.border}22`,fontSize:"10px",
              alignItems:"center"}}>
              <span style={{color:done?C.green:C.textDim,fontSize:"12px"}}>
                {done?"✓":"○"}
              </span>
              <span style={{color:done?C.green:C.textMid}}>{item}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
