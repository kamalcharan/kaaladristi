import { useState, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// FINASTRO · SCREEN 4 v3 · HONEST SIGNAL SCREENER
// Technical score = primary
// Astro = filter with confidence tier
// Both audiences: intraday (Panchang) + positional (planetary)
// ═══════════════════════════════════════════════════════════════════════════

const T = {
  bg:"#030609",surface:"#050A10",panel:"#070D18",card:"#090F1E",
  cardHi:"#0C1428",border:"#0F1B2C",borderHi:"#162438",
  gold:"#C9A455",goldDim:"#C9A45515",
  teal:"#2ABFB0",tealDim:"#2ABFB012",
  green:"#3DBA7E",greenDim:"#3DBA7E10",
  red:"#E05252",redDim:"#E0525210",
  amber:"#E09840",amberDim:"#E0984010",
  purple:"#9B6DCA",purpleDim:"#9B6DCA10",
  cyan:"#38BDF8",cyanDim:"#38BDF810",
  moon:"#8AB4C8",
  text:"#A8C4DC",textMid:"#506880",textDim:"#2E4258",
};

const P = {
  sun:     {s:"☉",c:"#F5C842",n:"Sun"},
  moon:    {s:"☽",c:"#8AB4C8",n:"Moon"},
  mercury: {s:"☿",c:"#8EC88E",n:"Mercury"},
  venus:   {s:"♀",c:"#E8A0C0",n:"Venus"},
  mars:    {s:"♂",c:"#E06040",n:"Mars"},
  jupiter: {s:"♃",c:"#C9A455",n:"Jupiter"},
  saturn:  {s:"♄",c:"#A89870",n:"Saturn"},
  rahu:    {s:"☊",c:"#8060C0",n:"Rahu"},
  ketu:    {s:"☋",c:"#607080",n:"Ketu"},
  herschel:{s:"♅",c:"#2ABFB0",n:"Herschel"},
};

// ─── TIERS ────────────────────────────────────────────────────────────────────
const TIERS = {
  validated:   {label:"VALIDATED",  badge:"✓",color:T.green, bg:T.greenDim, scoreWeight:1.0, desc:"n≥30 · p<0.05"},
  indicative:  {label:"INDICATIVE", badge:"~",color:T.amber, bg:T.amberDim, scoreWeight:0.5, desc:"n=2–29 · directional"},
  unvalidated: {label:"UNVALIDATED",badge:"✗",color:T.textDim,bg:"transparent",scoreWeight:0.0,desc:"no price data"},
};

// ─── ROTATION PHASES ──────────────────────────────────────────────────────────
const PHASES = {
  entering:    {label:"ENTERING",    color:T.cyan, bg:T.cyanDim, icon:"◉",action:"ACCUMULATE"},
  leading:     {label:"LEADING",     color:T.green,bg:T.greenDim,icon:"▲",action:"MOMENTUM"},
  peaking:     {label:"PEAKING",     color:T.gold, bg:T.goldDim, icon:"⬆",action:"TRAIL STOPS"},
  rotating_out:{label:"ROTATING OUT",color:T.amber,bg:T.amberDim,icon:"↓",action:"EXIT"},
  neglected:   {label:"NEGLECTED",   color:T.red,  bg:T.redDim,  icon:"○",action:"AVOID"},
};

// ─── CORRELATION LIBRARY ──────────────────────────────────────────────────────
const CORR = {
  panchang_favorable: {
    tier:"validated",planet:"moon",n:2184,avgReturn:"+0.42%",winRate:"62%",pValue:"0.031",
    label:"Favorable Panchang today",audience:"intraday",
    short:"Panchang ✓ Favorable",
    note:"2184 trading days. +0.42% avg vs +0.18% baseline. p=0.031.",
    scoreBoost:0.8,
  },
  panchang_neutral: {
    tier:"validated",planet:"moon",n:1248,avgReturn:"+0.18%",winRate:"53%",pValue:"baseline",
    label:"Neutral Panchang today",audience:"intraday",
    short:"Panchang ◎ Neutral",
    note:"Neutral Panchang — baseline performance. No boost or penalty.",
    scoreBoost:0.0,
  },
  panchang_avoid: {
    tier:"validated",planet:"moon",n:486,avgReturn:"-0.31%",winRate:"41%",pValue:"0.028",
    label:"Avoid Panchang today",audience:"intraday",
    short:"Panchang ✕ AVOID",
    note:"486 avoid days. -0.31% avg vs +0.18% baseline. p=0.028.",
    scoreBoost:-1.5,
  },
  rahu_kala_risk: {
    tier:"validated",planet:"rahu",n:312,avgReturn:"-0.68%",winRate:"35%",pValue:"0.018",
    label:"Entry would be in Rahu Kala window",audience:"intraday",
    short:"Rahu Kala ☊ risk",
    note:"312 breakouts in Rahu Kala. 65% fail rate. p=0.018.",
    scoreBoost:-1.2,
  },
  abhijit_window: {
    tier:"validated",planet:"sun",n:198,avgReturn:"+0.61%",winRate:"64%",pValue:"0.042",
    label:"Currently in Abhijit Muhurta (11:48–12:36)",audience:"intraday",
    short:"Abhijit ☀ window",
    note:"198 entries in Abhijit. +0.61% avg. p=0.042.",
    scoreBoost:+0.6,
  },
  moon_fire_sign: {
    tier:"validated",planet:"moon",n:892,avgReturn:"+0.34%",winRate:"58%",pValue:"0.038",
    label:"Moon in Fire sign — momentum bias",audience:"intraday",
    short:"Moon 🔥 Fire sign",
    note:"892 fire sign days. Momentum strategies outperform. p=0.038.",
    scoreBoost:+0.4,
  },
  moon_water_sign: {
    tier:"validated",planet:"moon",n:891,avgReturn:"+0.08%",winRate:"49%",pValue:"0.021",
    label:"Moon in Water sign — emotional/gap day",audience:"intraday",
    short:"Moon 💧 Water sign",
    note:"891 water sign days. Higher gap frequency. Sentiment-driven.",
    scoreBoost:0.0,
  },
  mercury_retro_risk: {
    tier:"validated",planet:"mercury",n:72,avgReturn:"-0.58%",winRate:"38%",pValue:"0.044",
    label:"Mercury Retrograde — IT/tech execution risk",audience:"intraday+positional",
    short:"Mercury Retro ☿ risk",
    note:"72 samples across 12 retrogrades. IT stocks -0.58% avg. p=0.044.",
    scoreBoost:-0.9,
  },
  venus_retro_banking: {
    tier:"validated",planet:"venus",n:58,avgReturn:"-0.72%",winRate:"37%",pValue:"0.048",
    label:"Venus Retrograde window — banking/auto sector",audience:"positional",
    short:"Venus Retro ♀ banking",
    note:"58 weeks across 5 retrogrades. Banking -8.4% vs NIFTY. p=0.048.",
    scoreBoost:-0.8,
  },
  jupiter_cancer_sector: {
    tier:"indicative",planet:"jupiter",n:3,avgReturn:"+18.4%",winRate:"100%",pValue:"N/A",
    label:"Jupiter in Cancer — FMCG/PSU Banks sector tailwind",audience:"positional",
    short:"Jupiter Cancer ~ (n=3)",
    note:"3 occurrences: 2002+22%, 2014+38%, 2026 in progress. 100% win rate but n=3 only.",
    scoreBoost:+0.5,
  },
  rahu_pisces_pharma: {
    tier:"indicative",planet:"rahu",n:2,avgReturn:"+58%",winRate:"100%",pValue:"N/A",
    label:"Rahu in Pisces — Pharma sector obsession cycle",audience:"positional",
    short:"Rahu Pisces ~ pharma (n=2)",
    note:"2 occurrences: 2006+120%, 2023+34%. Consistent but post-exit drop brutal (-18 to -41%).",
    scoreBoost:+0.3,
  },
  mars_debil_energy: {
    tier:"indicative",planet:"mars",n:6,avgReturn:"-12%",winRate:"83%",pValue:"0.071",
    label:"Mars debilitated in Cancer — Energy sector weak",audience:"positional",
    short:"Mars Debil. ~ energy (n=6)",
    note:"6 periods. Energy -12% avg during Mars debilitation. p=0.071 (marginal).",
    scoreBoost:-0.6,
  },
  venus_direct_recovery: {
    tier:"indicative",planet:"venus",n:8,avgReturn:"+6.2%",winRate:"75%",pValue:"0.082",
    label:"Venus post-direct — Auto/banking recovery lag 6–8 weeks",audience:"positional",
    short:"Venus Direct ~ recovery (n=8)",
    note:"8 periods. Auto recovers avg 6 weeks post Venus direct. p=0.082.",
    scoreBoost:+0.2,
  },
  saturn_aries_infra: {
    tier:"indicative",planet:"saturn",n:1,avgReturn:"-28%",winRate:"N/A",pValue:"N/A",
    label:"Saturn in Aries — Infrastructure structural headwind",audience:"positional",
    short:"Saturn Aries ~ infra (n=1)",
    note:"1 completed cycle 1996–98. Infra -28% vs NIFTY. Anecdotal but directionally strong.",
    scoreBoost:-0.4,
  },
  herschel_gemini: {
    tier:"unvalidated",planet:"herschel",n:0,avgReturn:"N/A",winRate:"N/A",pValue:"N/A",
    label:"Herschel in Gemini — AI/tech disruption (theoretical)",audience:"positional",
    short:"Herschel Gemini ✗ theory",
    note:"No NSE data. Previous transit 1941–48. Context only — not in score.",
    scoreBoost:0.0,
  },
};

// ─── TODAY CONTEXT ────────────────────────────────────────────────────────────
const TODAY = {
  date:"21 May 2026",dow:"Wednesday",
  pq:2,pqLabel:"Neutral",
  tithi:"Dwadashi",yoga:"Sukarman",nakshatra:"P.Bhadra",
  moonSign:"Scorpio",moonSignElement:"Water",
  finScore:6.1,
  backdrop:"♃ Jupiter exalted Cancer",
  rahuKala:{start:"12:00",end:"13:30"},
  abhijit:{start:"11:48",end:"12:36"},
  tithiChange:"13:00",
  yogaChange:"09:20",
  nowMin:615, // 10:15 IST
  inRahu:false,
  inAbhijit:false,
};

// ─── STOCK DATA ───────────────────────────────────────────────────────────────
// Each stock has:
//   techScore: pure price-based (0-10) — ALWAYS PRIMARY
//   intradayCorrs: validated daily filters
//   positionalCorrs: outer planet correlations (indicative/unvalidated)
//   rotationPhase: from sector rotation map
const STOCKS_RAW = [
  {
    symbol:"HINDUNILVR",name:"Hindustan Unilever",sector:"FMCG",
    cmp:2680,chg:+1.42,vol:2.3,
    techScore:8.4,
    techSignal:"Breakout above 20-EMA on 2.3x volume. RSI 61 — room to run. 52-week high proximity.",
    pattern:"Breakout",aboveEma:true,rsi:61,
    entry:{zone:"2665–2680",sl:"2620",t1:"2750",t2:"2820"},
    rotationPhase:"entering",
    audience:"both",
    intradayCorrs:["panchang_neutral","moon_water_sign"],
    positionalCorrs:["jupiter_cancer_sector"],
    note:"Strong technical breakout in an entering-phase sector. Jupiter Cancer provides indicative tailwind. Panchang neutral today — not the ideal entry day. Wait for Favorable Panchang confirmation.",
  },
  {
    symbol:"SBIBANK",name:"State Bank of India",sector:"PSU Banks",
    cmp:812,chg:+1.18,vol:2.1,
    techScore:8.1,
    techSignal:"Gap up sustained. 200-EMA support. Volume 2.1x. Clean uptrend structure.",
    pattern:"Gap Up Hold",aboveEma:true,rsi:64,
    entry:{zone:"804–812",sl:"785",t1:"845",t2:"875"},
    rotationPhase:"leading",
    audience:"both",
    intradayCorrs:["panchang_neutral","moon_water_sign"],
    positionalCorrs:["jupiter_cancer_sector"],
    note:"Leading phase sector + strong technical. Jupiter Cancer indicative tailwind. Scorpio Moon (water) = more gap-prone emotional behavior — use limit orders.",
  },
  {
    symbol:"SYNGENE",name:"Syngene International",sector:"Pharma",
    cmp:760,chg:+1.05,vol:1.9,
    techScore:7.8,
    techSignal:"Breakout from 3-week consolidation on 1.9x volume. RSI 60. Clean structure.",
    pattern:"Consolidation Breakout",aboveEma:true,rsi:60,
    entry:{zone:"752–760",sl:"728",t1:"800",t2:"830"},
    rotationPhase:"peaking",
    audience:"both",
    intradayCorrs:["panchang_neutral","moon_water_sign"],
    positionalCorrs:["rahu_pisces_pharma"],
    note:"Good technical but PEAKING sector. Rahu Pisces pharma theme has 6 months left but historical exits are sharp. Enter only if trailing stops are tight. No new add — this is a trail-and-book trade.",
  },
  {
    symbol:"BRITANNIA",name:"Britannia Industries",sector:"FMCG",
    cmp:5420,chg:+0.98,vol:1.8,
    techScore:7.6,
    techSignal:"Inside bar breakout. Above 52-week pivot. RSI 58. Moderate volume.",
    pattern:"Inside Bar Breakout",aboveEma:true,rsi:58,
    entry:{zone:"5390–5420",sl:"5310",t1:"5560",t2:"5680"},
    rotationPhase:"entering",
    audience:"positional",
    intradayCorrs:["panchang_neutral"],
    positionalCorrs:["jupiter_cancer_sector"],
    note:"Positional trade — Jupiter Cancer tailwind (indicative). Entering phase = 6-month horizon. Today's Panchang is neutral — valid for positional entry but not optimal for intraday.",
  },
  {
    symbol:"LICHSGFIN",name:"LIC Housing Finance",sector:"Real Estate",
    cmp:680,chg:+0.82,vol:1.6,
    techScore:6.8,
    techSignal:"Weekly support held. Daily engulfing candle. RSI 54. Moderate volume.",
    pattern:"Support Bounce",aboveEma:true,rsi:54,
    entry:{zone:"672–680",sl:"652",t1:"710",t2:"738"},
    rotationPhase:"entering",
    audience:"positional",
    intradayCorrs:["panchang_neutral"],
    positionalCorrs:["jupiter_cancer_sector"],
    note:"Real estate entering phase. Jupiter Cancer tailwind. Technical still building — moderate conviction. Positional entry on weekly support valid.",
  },
  {
    symbol:"SUNPHARMA",name:"Sun Pharmaceutical",sector:"Pharma",
    cmp:1680,chg:+0.72,vol:1.4,
    techScore:7.2,
    techSignal:"Pullback to 20-EMA complete. Tight 3-day range. RSI 52.",
    pattern:"EMA Pullback",aboveEma:true,rsi:52,
    entry:{zone:"1665–1680",sl:"1635",t1:"1730",t2:"TRAIL"},
    rotationPhase:"peaking",
    audience:"positional",
    intradayCorrs:["panchang_neutral"],
    positionalCorrs:["rahu_pisces_pharma"],
    note:"PEAKING sector — Rahu Pisces ends Nov 14. No new positions. Existing holders: trail stops below 20-EMA. Rahu exit historically causes -18 to -41% correction.",
  },
  {
    symbol:"PERSISTENT",name:"Persistent Systems",sector:"AI/Fintech",
    cmp:5840,chg:+0.38,vol:1.1,
    techScore:6.4,
    techSignal:"Coiling pattern — 3 months range. RSI 57. Breakout watch above 5950.",
    pattern:"Coiling — Watch",aboveEma:true,rsi:57,
    entry:{zone:"Watch 5950 break",sl:"5600",t1:"6400",t2:"7200"},
    rotationPhase:"entering",
    audience:"positional",
    intradayCorrs:["panchang_neutral"],
    positionalCorrs:["herschel_gemini"],
    note:"Herschel Gemini is UNVALIDATED (n=0) — carry zero score weight. This is a TECHNICAL trade with a theoretical long-term planetary context. Price must confirm before entering.",
  },
  {
    symbol:"MARUTI",name:"Maruti Suzuki",sector:"Auto",
    cmp:12840,chg:-0.18,vol:0.8,
    techScore:5.5,
    techSignal:"Sideways range 6 weeks. RSI 48. Below 20-EMA. No directional conviction.",
    pattern:"Range Bound",aboveEma:false,rsi:48,
    entry:{zone:"WAIT — Jul 2026 trigger",sl:null,t1:"13,400",t2:"13,800"},
    rotationPhase:"rotating_out",
    audience:"positional",
    intradayCorrs:["panchang_neutral"],
    positionalCorrs:["venus_retro_banking","venus_direct_recovery"],
    note:"ROTATING OUT — Venus retro effect validated (n=58, p=0.048). Auto recovery expected in Jul 2026 when Venus enters Taurus. DO NOT ENTER NOW.",
  },
  {
    symbol:"TCS",name:"Tata Consultancy",sector:"IT Services",
    cmp:3640,chg:-0.42,vol:1.1,
    techScore:5.8,
    techSignal:"At 20-EMA. RSI 51. Technically neutral. Mercury retrograde begins May 29.",
    pattern:"Mercury Risk",aboveEma:true,rsi:51,
    entry:{zone:"EXIT before May 29",sl:null,t1:null,t2:null},
    rotationPhase:"rotating_out",
    audience:"intraday+positional",
    intradayCorrs:["panchang_neutral","mercury_retro_risk"],
    positionalCorrs:["mercury_retro_risk"],
    note:"Mercury Retro × IT is VALIDATED (n=72, p=0.044). Exit all IT positions before May 29. This is the only outer-planet signal with enough data to act on definitively.",
  },
  {
    symbol:"HDFCBANK",name:"HDFC Bank",sector:"Banking (Pvt)",
    cmp:1680,chg:-0.22,vol:0.9,
    techScore:5.2,
    techSignal:"Below 20-EMA. RSI 46. Weak structure. Venus retro recovery still playing out.",
    pattern:"Weak Structure",aboveEma:false,rsi:46,
    entry:{zone:"WAIT — Jul 2026",sl:null,t1:"1820",t2:"1900"},
    rotationPhase:"rotating_out",
    audience:"positional",
    intradayCorrs:["panchang_neutral"],
    positionalCorrs:["venus_retro_banking","venus_direct_recovery"],
    note:"Venus Retro × Banking validated (n=58, p=0.048). Recovery expected post Jul 2026. Do not force entry now. Private banks lag PSU banks during this phase.",
  },
  {
    symbol:"ONGC",name:"Oil & Natural Gas",sector:"Energy",
    cmp:268,chg:-0.72,vol:1.3,
    techScore:4.2,
    techSignal:"Below all EMAs. RSI 38. Approaching oversold — no reversal signal.",
    pattern:"Downtrend",aboveEma:false,rsi:38,
    entry:{zone:"AVOID longs",sl:null,t1:null,t2:null},
    rotationPhase:"neglected",
    audience:"positional",
    intradayCorrs:["panchang_neutral"],
    positionalCorrs:["mars_debil_energy"],
    note:"Mars debilitation × Energy is indicative (n=6, p=0.071). NEGLECTED phase. No technical support. Do not buy. Short on bounces to 50-EMA only if technically clean.",
  },
  {
    symbol:"L&T",name:"Larsen & Toubro",sector:"Infrastructure",
    cmp:3420,chg:-0.54,vol:0.7,
    techScore:4.5,
    techSignal:"Distribution pattern. Low volume. RSI 42. Risk of further downside.",
    pattern:"Distribution",aboveEma:false,rsi:42,
    entry:{zone:"AVOID — 2.5yr headwind",sl:null,t1:null,t2:null},
    rotationPhase:"neglected",
    audience:"positional",
    intradayCorrs:["panchang_neutral"],
    positionalCorrs:["saturn_aries_infra"],
    note:"Saturn Aries × Infra is indicative (n=1, anecdotal). NEGLECTED phase. 2.5-year structural headwind. Deep value only for 3+ year horizon — not a trading position.",
  },
];

// ─── SCORE COMPUTATION ────────────────────────────────────────────────────────
function computeHonestScore(stock) {
  // Technical is PRIMARY — always 60% weight minimum
  const techBase = stock.techScore * 0.6;

  // Intraday (Panchang) layer — validated signals only
  let intradayBoost = 0;
  const intradayDetails = [];
  stock.intradayCorrs.forEach(corrId => {
    const corr = CORR[corrId];
    if (!corr) return;
    const tier = TIERS[corr.tier];
    const boost = corr.scoreBoost * tier.scoreWeight;
    intradayBoost += boost;
    intradayDetails.push({ corrId, corr, boost, tier });
  });

  // Positional (planetary) layer — indicative half-weight, unvalidated zero
  let positionalBoost = 0;
  const positionalDetails = [];
  stock.positionalCorrs.forEach(corrId => {
    const corr = CORR[corrId];
    if (!corr) return;
    const tier = TIERS[corr.tier];
    const boost = corr.scoreBoost * tier.scoreWeight;
    positionalBoost += boost;
    positionalDetails.push({ corrId, corr, boost, tier });
  });

  // Rotation phase modifier (applied to positional layer)
  const ph = PHASES[stock.rotationPhase];
  const rotationMod = stock.rotationPhase === "leading" ? 0.3
    : stock.rotationPhase === "entering" ? 0.2
    : stock.rotationPhase === "peaking" ? -0.1
    : stock.rotationPhase === "rotating_out" ? -0.4
    : -0.8; // neglected

  const rawScore = techBase
    + (intradayBoost * 0.2)
    + (positionalBoost * 0.2)
    + rotationMod;

  const finalScore = Math.min(10, Math.max(0, rawScore));

  return {
    finalScore,
    techComponent:   techBase,
    intradayComponent: intradayBoost * 0.2,
    positionalComponent: positionalBoost * 0.2,
    rotationComponent: rotationMod,
    intradayDetails,
    positionalDetails,
  };
}

// Enrich stocks
const STOCKS = STOCKS_RAW.map(s => {
  const scoreData = computeHonestScore(s);
  return { ...s, ...scoreData };
}).sort((a, b) => b.finalScore - a.finalScore)
  .map((s, i) => ({ ...s, rank: i + 1 }));

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function bC(b){return b==="long"?T.green:b==="short"?T.red:b==="watch"?T.amber:T.textMid;}
function phC(p){return PHASES[p]?.color||T.textDim;}
function phI(p){return PHASES[p]?.icon||"·";}
function tierC(t){return TIERS[t]?.color||T.textDim;}
function tierB(t){return TIERS[t]?.badge||"?";}
function scoreColor(s){return s>=8?T.green:s>=6.5?T.teal:s>=5?T.amber:s>=3.5?T.red:T.textDim;}
function scoreLabel(s){return s>=8?"HIGH":s>=6.5?"MODERATE":s>=5?"LOW":"AVOID";}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
function PlanetBadge({pk,size=18}) {
  const pl=P[pk]; if(!pl) return null;
  return <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:size,height:size,borderRadius:"50%",background:`${pl.c}18`,border:`1px solid ${pl.c}40`,fontSize:size*0.52,color:pl.c,boxShadow:`0 0 3px ${pl.c}20`,flexShrink:0}}>{pl.s}</span>;
}

function TierBadge({tier,showLabel=false}) {
  const tr=TIERS[tier]; if(!tr) return null;
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:3,padding:showLabel?"2px 6px":"1px 4px",borderRadius:3,background:tr.bg,border:`1px solid ${tr.color}30`,flexShrink:0}}>
      <span style={{fontSize:showLabel?9:8,color:tr.color,fontWeight:700}}>{tr.badge}</span>
      {showLabel&&<span style={{fontSize:8,color:tr.color,fontFamily:"'Cinzel',serif",letterSpacing:0.5}}>{tr.label}</span>}
    </span>
  );
}

function AudienceBadge({audience}) {
  const map={
    "intraday":          {label:"INTRADAY",  color:T.teal},
    "positional":        {label:"POSITIONAL",color:T.purple},
    "both":              {label:"BOTH",      color:T.gold},
    "intraday+positional":{label:"BOTH",     color:T.gold},
  };
  const m=map[audience]||map["both"];
  return <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:`${m.color}15`,color:m.color,fontFamily:"'Cinzel',serif",letterSpacing:0.5,border:`1px solid ${m.color}25`}}>{m.label}</span>;
}

// Mini score bar showing three components
function ScoreBar({stock,width=120}) {
  const techW   = (stock.techComponent/10)*width*0.6;
  const intW    = Math.max(0,(stock.intradayComponent/10))*width*0.2;
  const posW    = Math.max(0,(stock.positionalComponent/10))*width*0.2;
  const finalColor = scoreColor(stock.finalScore);
  return (
    <div>
      <div style={{display:"flex",gap:1,height:6,width,borderRadius:2,overflow:"hidden",marginBottom:2}}>
        <div style={{width:techW,background:T.teal,opacity:0.9}} title="Technical"/>
        <div style={{width:Math.abs(intW),background:stock.intradayComponent>=0?T.green:T.red,opacity:0.8}} title="Intraday Panchang"/>
        <div style={{width:Math.abs(posW),background:stock.positionalComponent>=0?T.amber:T.red,opacity:0.7}} title="Positional planetary"/>
      </div>
      <div style={{display:"flex",gap:4}}>
        <span style={{fontSize:7,color:T.teal}}>T</span>
        <span style={{fontSize:7,color:T.green}}>I</span>
        <span style={{fontSize:7,color:T.amber}}>P</span>
        <span style={{fontSize:7,color:T.textDim}}>= Technical / Intraday / Positional</span>
      </div>
    </div>
  );
}

// ─── SCREENER ROW ─────────────────────────────────────────────────────────────
function ScreenerRow({stock,isSelected,onClick}) {
  const ph=PHASES[stock.rotationPhase];
  const fc=scoreColor(stock.finalScore);
  const hasExit=stock.entry.zone&&(stock.entry.zone.includes("EXIT")||stock.entry.zone.includes("AVOID")||stock.entry.zone.includes("WAIT"));

  return (
    <div onClick={onClick} className="srow" style={{
      display:"grid",
      gridTemplateColumns:"26px 150px 80px 55px 55px 55px 90px 1fr 90px",
      gap:0, alignItems:"center",
      padding:"8px 12px",
      background:isSelected?`${fc}06`:T.card,
      border:`1px solid ${isSelected?fc+"40":T.border}`,
      borderLeft:`3px solid ${phC(stock.rotationPhase)}`,
      borderRadius:5, marginBottom:3,
      cursor:"pointer", transition:"all 0.12s",
    }}>
      {/* Rank */}
      <div style={{fontSize:10,color:T.textDim,fontFamily:"'Cinzel',serif",textAlign:"center"}}>{stock.rank}</div>

      {/* Symbol + meta */}
      <div>
        <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
          <span style={{fontSize:12,fontFamily:"'Cinzel',serif",color:T.text}}>{stock.symbol}</span>
          <AudienceBadge audience={stock.audience}/>
        </div>
        <div style={{fontSize:7,color:T.textDim}}>{stock.sector}</div>
      </div>

      {/* CMP */}
      <div>
        <div style={{fontSize:11,fontFamily:"monospace",color:T.text}}>{stock.cmp.toLocaleString()}</div>
        <div style={{fontSize:8,fontFamily:"monospace",color:stock.chg>=0?T.green:T.red}}>{stock.chg>=0?"+":""}{stock.chg.toFixed(2)}%</div>
      </div>

      {/* Tech score — PRIMARY */}
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:12,color:scoreColor(stock.techScore),fontFamily:"'Cinzel',serif",fontWeight:700}}>{stock.techScore.toFixed(1)}</div>
        <div style={{fontSize:6,color:T.teal,letterSpacing:0.5}}>TECH ★</div>
      </div>

      {/* Intraday boost */}
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:11,color:stock.intradayComponent>=0?T.green:T.red,fontFamily:"monospace",fontWeight:700}}>
          {stock.intradayComponent>=0?"+":""}{(stock.intradayComponent).toFixed(1)}
        </div>
        <div style={{fontSize:6,color:T.textDim}}>intra ✓</div>
      </div>

      {/* Positional boost */}
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:11,color:stock.positionalComponent>=0?T.amber:T.red,fontFamily:"monospace",fontWeight:700}}>
          {stock.positionalComponent>=0?"+":""}{(stock.positionalComponent).toFixed(1)}
        </div>
        <div style={{fontSize:6,color:T.textDim}}>plan ~</div>
      </div>

      {/* Final honest score */}
      <div style={{textAlign:"center",padding:"0 4px"}}>
        <div style={{fontSize:14,color:fc,fontFamily:"'Cinzel',serif",fontWeight:700,lineHeight:1}}>{stock.finalScore.toFixed(1)}</div>
        <div style={{fontSize:7,color:fc,letterSpacing:0.5}}>{scoreLabel(stock.finalScore)}</div>
      </div>

      {/* Signal + rotation */}
      <div style={{padding:"0 6px",minWidth:0}}>
        <div style={{fontSize:9,color:T.textMid,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:2}}>{stock.techSignal}</div>
        <div style={{display:"flex",gap:3,alignItems:"center",flexWrap:"wrap"}}>
          {/* Rotation phase */}
          <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:ph.bg,border:`1px solid ${ph.color}25`,color:ph.color,fontFamily:"'Cinzel',serif",flexShrink:0}}>{ph.icon} {ph.action}</span>
          {/* Intraday tier indicators */}
          {stock.intradayDetails.slice(0,2).map((d,i)=><TierBadge key={i} tier={d.corr.tier}/>)}
          {/* Positional tier */}
          {stock.positionalDetails.slice(0,1).map((d,i)=><TierBadge key={i} tier={d.corr.tier}/>)}
        </div>
      </div>

      {/* Entry / action */}
      <div>
        <div style={{fontSize:8,color:hasExit?T.red:T.text,fontFamily:hasExit?"'Cinzel',serif":"monospace",fontWeight:hasExit?700:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{stock.entry.zone||"—"}</div>
        {stock.entry.sl&&<div style={{fontSize:7,color:T.red,fontFamily:"monospace"}}>SL {stock.entry.sl}</div>}
      </div>
    </div>
  );
}

// ─── STOCK DETAIL ─────────────────────────────────────────────────────────────
function StockDetail({stock}) {
  if(!stock) return (
    <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8,padding:16}}>
      <div style={{fontSize:24,color:T.textDim}}>◎</div>
      <div style={{fontSize:10,color:T.textDim,fontFamily:"'Cinzel',serif",letterSpacing:1}}>SELECT A STOCK</div>
      <div style={{fontSize:9,color:T.textDim,textAlign:"center",padding:"0 12px"}}>Click any row to see honest score breakdown with correlation evidence</div>
    </div>
  );

  const ph=PHASES[stock.rotationPhase];
  const fc=scoreColor(stock.finalScore);
  const bull=stock.chg>=0;

  return (
    <div style={{padding:13,overflowY:"auto",height:"100%",animation:"fadeIn 0.2s ease"}}>

      {/* Header */}
      <div style={{marginBottom:11,paddingBottom:10,borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
          <span style={{fontSize:17,fontFamily:"'Cinzel',serif",color:T.text,fontWeight:700}}>{stock.symbol}</span>
          <AudienceBadge audience={stock.audience}/>
        </div>
        <div style={{fontSize:9,color:T.textMid,marginBottom:5}}>{stock.name} · {stock.sector}</div>
        <div style={{display:"flex",alignItems:"baseline",gap:8}}>
          <span style={{fontSize:19,fontFamily:"monospace",color:bull?T.green:T.red,fontWeight:700}}>{stock.cmp.toLocaleString()}</span>
          <span style={{fontSize:11,fontFamily:"monospace",color:bull?T.green:T.red}}>{bull?"+":""}{stock.chg.toFixed(2)}%</span>
          <span style={{fontSize:9,color:T.textMid}}>Vol {stock.vol?.toFixed(1)}x</span>
        </div>
      </div>

      {/* Honest score breakdown — THE KEY SECTION */}
      <div style={{marginBottom:11,padding:"10px 11px",background:T.panel,border:`1px solid ${fc}30`,borderRadius:7}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div style={{fontSize:8,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif"}}>HONEST SCORE BREAKDOWN</div>
          <div style={{fontSize:18,fontFamily:"'Cinzel',serif",fontWeight:700,color:fc}}>{stock.finalScore.toFixed(1)}<span style={{fontSize:10,color:T.textDim}}>/10</span></div>
        </div>

        {/* Score bar visual */}
        <ScoreBar stock={stock} width={250}/>

        {/* Component rows */}
        <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:8}}>
          {/* Technical — primary */}
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",background:`${T.teal}10`,border:`1px solid ${T.teal}25`,borderRadius:4}}>
            <div style={{width:3,height:24,background:T.teal,borderRadius:1,flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:8,color:T.teal,fontFamily:"'Cinzel',serif",letterSpacing:1}}>TECHNICAL ★ PRIMARY</div>
              <div style={{fontSize:9,color:T.textMid,marginTop:1}}>{stock.techSignal.slice(0,55)}{stock.techSignal.length>55?"…":""}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:14,color:T.teal,fontFamily:"'Cinzel',serif",fontWeight:700}}>{stock.techScore.toFixed(1)}</div>
              <div style={{fontSize:7,color:T.textDim}}>60% wt</div>
            </div>
          </div>

          {/* Intraday Panchang */}
          <div style={{display:"flex",alignItems:"flex-start",gap:6,padding:"5px 8px",background:`${T.green}08`,border:`1px solid ${T.green}18`,borderRadius:4}}>
            <div style={{width:3,minHeight:24,background:stock.intradayComponent>=0?T.green:T.red,borderRadius:1,flexShrink:0,marginTop:2}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:8,color:T.green,fontFamily:"'Cinzel',serif",letterSpacing:1}}>INTRADAY FILTER ✓ VALIDATED</div>
              {stock.intradayDetails.map((d,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:4,marginTop:3}}>
                  <PlanetBadge pk={d.corr.planet} size={14}/>
                  <TierBadge tier={d.corr.tier}/>
                  <span style={{fontSize:8,color:T.textMid}}>{d.corr.short}</span>
                  <span style={{fontSize:8,color:d.boost>=0?T.green:T.red,marginLeft:"auto",fontFamily:"monospace",flexShrink:0}}>{d.boost>=0?"+":""}{d.boost.toFixed(1)}</span>
                </div>
              ))}
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:13,color:stock.intradayComponent>=0?T.green:T.red,fontFamily:"'Cinzel',serif",fontWeight:700}}>{stock.intradayComponent>=0?"+":""}{stock.intradayComponent.toFixed(1)}</div>
              <div style={{fontSize:7,color:T.textDim}}>20% wt</div>
            </div>
          </div>

          {/* Positional planetary */}
          <div style={{display:"flex",alignItems:"flex-start",gap:6,padding:"5px 8px",background:`${T.amber}08`,border:`1px solid ${T.amber}18`,borderRadius:4}}>
            <div style={{width:3,minHeight:24,background:stock.positionalComponent>=0?T.amber:T.red,borderRadius:1,flexShrink:0,marginTop:2}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:8,color:T.amber,fontFamily:"'Cinzel',serif",letterSpacing:1}}>POSITIONAL FILTER ~ INDICATIVE</div>
              {stock.positionalDetails.map((d,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:4,marginTop:3}}>
                  <PlanetBadge pk={d.corr.planet} size={14}/>
                  <TierBadge tier={d.corr.tier}/>
                  <span style={{fontSize:8,color:T.textMid}}>{d.corr.short}</span>
                  <span style={{fontSize:8,color:d.boost>=0?T.amber:T.red,marginLeft:"auto",fontFamily:"monospace",flexShrink:0}}>{d.boost>=0?"+":""}{d.boost.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:13,color:stock.positionalComponent>=0?T.amber:T.red,fontFamily:"'Cinzel',serif",fontWeight:700}}>{stock.positionalComponent>=0?"+":""}{stock.positionalComponent.toFixed(1)}</div>
              <div style={{fontSize:7,color:T.textDim}}>20% wt</div>
            </div>
          </div>

          {/* Rotation */}
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",background:PHASES[stock.rotationPhase].bg,border:`1px solid ${phC(stock.rotationPhase)}25`,borderRadius:4}}>
            <div style={{width:3,height:24,background:phC(stock.rotationPhase),borderRadius:1,flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:8,color:phC(stock.rotationPhase),fontFamily:"'Cinzel',serif",letterSpacing:1}}>ROTATION PHASE</div>
              <div style={{fontSize:9,color:T.textMid,marginTop:1}}>{PHASES[stock.rotationPhase].label} — {PHASES[stock.rotationPhase].action}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:13,color:phC(stock.rotationPhase),fontFamily:"'Cinzel',serif",fontWeight:700}}>{stock.rotationComponent>=0?"+":""}{stock.rotationComponent.toFixed(1)}</div>
              <div style={{fontSize:7,color:T.textDim}}>phase adj</div>
            </div>
          </div>
        </div>

        {/* Important caveat */}
        {stock.positionalDetails.some(d=>d.corr.tier==="unvalidated")&&(
          <div style={{marginTop:7,padding:"5px 8px",background:T.redDim,border:`1px solid ${T.red}20`,borderRadius:4,fontSize:8,color:T.textDim,fontStyle:"italic"}}>
            ✗ One or more positional signals are UNVALIDATED (no price data). These carry zero weight in the score. Shown as context only.
          </div>
        )}
      </div>

      {/* Analyst note */}
      <div style={{marginBottom:10,padding:"8px 10px",background:T.goldDim,border:`1px solid ${T.gold}20`,borderRadius:5}}>
        <div style={{fontSize:8,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif",marginBottom:4}}>ANALYST NOTE</div>
        <div style={{fontSize:9,color:T.textMid,lineHeight:1.6}}>{stock.note}</div>
      </div>

      {/* Technical detail */}
      <div style={{marginBottom:10,padding:"8px 10px",background:`${T.teal}08`,border:`1px solid ${T.teal}18`,borderRadius:5}}>
        <div style={{fontSize:8,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif",marginBottom:5}}>TECHNICAL DETAIL</div>
        <div style={{fontSize:9,color:T.textMid,lineHeight:1.6,marginBottom:5}}>{stock.techSignal}</div>
        <div style={{display:"flex",gap:8}}>
          {[{l:"EMA",v:stock.aboveEma?"Above":"Below",c:stock.aboveEma?T.green:T.red},{l:"RSI",v:stock.rsi,c:stock.rsi>65?T.amber:stock.rsi<40?T.red:T.green},{l:"Pattern",v:stock.pattern,c:T.teal}].map(x=>(
            <div key={x.l}><div style={{fontSize:7,color:T.textDim}}>{x.l}</div><div style={{fontSize:9,color:x.c,fontFamily:"monospace",marginTop:1}}>{x.v}</div></div>
          ))}
        </div>
      </div>

      {/* Entry plan */}
      {stock.entry.sl&&(
        <div style={{marginBottom:10,padding:"8px 10px",background:T.panel,border:`1px solid ${T.border}`,borderRadius:5}}>
          <div style={{fontSize:8,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif",marginBottom:5}}>ENTRY PLAN</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
            {[{l:"ENTRY",v:stock.entry.zone,c:T.gold},{l:"SL",v:stock.entry.sl,c:T.red},{l:"T1",v:stock.entry.t1,c:T.green},{l:"T2",v:stock.entry.t2,c:T.teal}].filter(x=>x.v&&x.v!=="TRAIL").map(x=>(
              <div key={x.l} style={{padding:"4px 7px",background:T.card,borderRadius:3}}>
                <div style={{fontSize:7,color:T.textDim,fontFamily:"'Cinzel',serif"}}>{x.l}</div>
                <div style={{fontSize:10,color:x.c,fontFamily:"monospace",marginTop:1}}>{x.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today windows */}
      <div style={{display:"flex",flexDirection:"column",gap:3}}>
        <div style={{fontSize:8,color:T.textDim,letterSpacing:1,fontFamily:"'Cinzel',serif",marginBottom:3}}>TODAY · UJJAIN · IST</div>
        {[
          {icon:"☊",c:T.red,  label:"Rahu Kala — AVOID entries",time:`${TODAY.rahuKala.start}–${TODAY.rahuKala.end}`},
          {icon:"☀",c:T.green,label:"Abhijit — BEST entries",    time:`${TODAY.abhijit.start}–${TODAY.abhijit.end}`},
          {icon:"⚡",c:T.gold, label:"Tithi changeover",          time:TODAY.tithiChange},
        ].map((w,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 7px",borderRadius:3,background:`${w.c}08`,border:`1px solid ${w.c}15`}}>
            <span style={{fontSize:8,color:w.c}}>{w.icon} {w.label}</span>
            <span style={{fontSize:8,color:w.c,fontFamily:"monospace"}}>{w.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FILTERS ──────────────────────────────────────────────────────────────────
function FilterBar({filters,setFilters,count}) {
  return (
    <div style={{display:"flex",gap:8,padding:"7px 12px",background:T.surface,borderBottom:`1px solid ${T.border}`,alignItems:"center",flexShrink:0,flexWrap:"wrap"}}>
      <span style={{fontSize:8,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif"}}>FILTER</span>

      {/* Audience */}
      <div style={{display:"flex",gap:3}}>
        <span style={{fontSize:8,color:T.textDim,alignSelf:"center"}}>AUDIENCE:</span>
        {["All","intraday","positional","both"].map(a=>(
          <button key={a} onClick={()=>setFilters(f=>({...f,audience:a}))}
            style={{padding:"3px 8px",background:filters.audience===a?`${T.teal}20`:T.card,border:`1px solid ${filters.audience===a?T.teal+"40":T.border}`,borderRadius:4,color:filters.audience===a?T.teal:T.textDim,fontSize:8,fontFamily:"'Cinzel',serif",cursor:"pointer",letterSpacing:0.3}}>
            {a==="All"?"ALL":a.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{width:1,height:16,background:T.border}}/>

      {/* Rotation */}
      <div style={{display:"flex",gap:3}}>
        <span style={{fontSize:8,color:T.textDim,alignSelf:"center"}}>ROTATION:</span>
        {["All",...Object.keys(PHASES)].map(p=>{
          const ph=PHASES[p];
          return <button key={p} onClick={()=>setFilters(f=>({...f,rotation:p}))}
            style={{padding:"3px 7px",background:filters.rotation===p?(ph?ph.bg:`${T.gold}15`):T.card,border:`1px solid ${filters.rotation===p?(ph?ph.color+"40":T.gold+"40"):T.border}`,borderRadius:4,color:filters.rotation===p?(ph?ph.color:T.gold):T.textDim,fontSize:8,fontFamily:"'Cinzel',serif",cursor:"pointer",letterSpacing:0.3}}>
            {ph?`${ph.icon} ${ph.label.split(" ")[0]}`:"ALL"}
          </button>;
        })}
      </div>

      <div style={{width:1,height:16,background:T.border}}/>

      {/* Score filter */}
      <div style={{display:"flex",gap:3}}>
        {["All","≥7","≥5","<5"].map(s=>(
          <button key={s} onClick={()=>setFilters(f=>({...f,score:s}))}
            style={{padding:"3px 7px",background:filters.score===s?`${T.gold}15`:T.card,border:`1px solid ${filters.score===s?T.gold+"40":T.border}`,borderRadius:4,color:filters.score===s?T.gold:T.textDim,fontSize:8,fontFamily:"'Cinzel',serif",cursor:"pointer"}}>
            {s}
          </button>
        ))}
      </div>

      <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
        <span style={{fontSize:9,color:T.textMid,fontFamily:"'Cinzel',serif"}}>
          <span style={{color:T.gold,fontWeight:700}}>{count}</span> signals
        </span>
        {/* Sort */}
        {["Honest Score","Technical","Rotation"].map(s=>(
          <button key={s} onClick={()=>setFilters(f=>({...f,sort:s}))}
            style={{padding:"3px 8px",background:filters.sort===s?T.panel:T.card,border:`1px solid ${filters.sort===s?T.borderHi:T.border}`,borderRadius:4,color:filters.sort===s?T.text:T.textDim,fontSize:8,fontFamily:"'Cinzel',serif",cursor:"pointer"}}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── TABLE HEADER ─────────────────────────────────────────────────────────────
function TableHeader() {
  return (
    <div style={{display:"grid",gridTemplateColumns:"26px 150px 80px 55px 55px 55px 90px 1fr 90px",gap:0,padding:"5px 12px",background:T.panel,borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
      {["#","SYMBOL · AUDIENCE","CMP","TECH ★","INTRA ✓","PLAN ~","HONEST","SIGNAL · ROTATION · TIERS","ACTION"].map(h=>(
        <div key={h} style={{fontSize:7,color:T.textDim,letterSpacing:0.5,fontFamily:"'Cinzel',serif"}}>{h}</div>
      ))}
    </div>
  );
}

// ─── TODAY CONTEXT STRIP ──────────────────────────────────────────────────────
function TodayStrip() {
  return (
    <div style={{display:"flex",alignItems:"stretch",background:T.surface,borderBottom:`1px solid ${T.border}`,overflowX:"auto",flexShrink:0}}>
      {[
        {l:"DATE",     v:`${TODAY.date} · ${TODAY.dow}`,    c:T.text},
        {l:"PANCHANG", v:`${TODAY.tithi} · ${TODAY.yoga}`,  c:T.amber,   tier:"validated"},
        {l:"MOON",     v:`${TODAY.moonSign} · Water`,        c:"#CE93D8", tier:"validated"},
        {l:"BACKDROP", v:TODAY.backdrop,                     c:T.gold,    tier:"indicative"},
        {l:"☊ RAHU",   v:`${TODAY.rahuKala.start}–${TODAY.rahuKala.end}`,c:T.red,  tier:"validated"},
        {l:"☀ ABHIJIT",v:`${TODAY.abhijit.start}–${TODAY.abhijit.end}`,  c:T.green,tier:"validated"},
        {l:"⚡ TITHI",  v:`Changes ${TODAY.tithiChange}`,   c:T.gold,    tier:"validated"},
        {l:"FIN SCORE",v:`${TODAY.finScore}/10`,             c:T.amber,   note:"today's panchang quality"},
      ].map((item,i)=>(
        <div key={i} style={{padding:"6px 12px",borderRight:`1px solid ${T.border}`,minWidth:"fit-content"}}>
          <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
            <span style={{fontSize:7,color:T.textDim,letterSpacing:1,fontFamily:"'Cinzel',serif"}}>{item.l}</span>
            {item.tier&&<TierBadge tier={item.tier}/>}
          </div>
          <div style={{fontSize:9,color:item.c,fontFamily:"'Cinzel',serif",whiteSpace:"nowrap"}}>{item.v}</div>
          {item.note&&<div style={{fontSize:7,color:T.textDim,marginTop:1}}>{item.note}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── SECTOR STRIP ─────────────────────────────────────────────────────────────
function SectorStrip() {
  const sectors=[
    {s:"FMCG",score:9.2,phase:"entering",tier:"indicative",planet:"jupiter"},
    {s:"PSU Banks",score:8.8,phase:"leading",tier:"indicative",planet:"jupiter"},
    {s:"Agri",score:8.5,phase:"leading",tier:"indicative",planet:"moon"},
    {s:"Pharma",score:7.6,phase:"peaking",tier:"indicative",planet:"rahu"},
    {s:"Real Estate",score:7.2,phase:"entering",tier:"indicative",planet:"jupiter"},
    {s:"AI/Fintech",score:6.0,phase:"entering",tier:"unvalidated",planet:"herschel"},
    {s:"Auto",score:5.5,phase:"rotating_out",tier:"validated",planet:"venus"},
    {s:"Pvt Banks",score:5.2,phase:"rotating_out",tier:"validated",planet:"venus"},
    {s:"IT",score:3.8,phase:"rotating_out",tier:"validated",planet:"mercury"},
    {s:"Energy",score:3.5,phase:"neglected",tier:"indicative",planet:"mars"},
    {s:"Infra",score:3.2,phase:"neglected",tier:"indicative",planet:"saturn"},
  ];

  return (
    <div style={{display:"flex",gap:4,padding:"5px 12px",background:T.surface,borderBottom:`1px solid ${T.border}`,overflowX:"auto",flexShrink:0}}>
      <span style={{fontSize:8,color:T.textDim,letterSpacing:1,fontFamily:"'Cinzel',serif",flexShrink:0,alignSelf:"center"}}>SECTORS</span>
      {sectors.map(s=>{
        const ph=PHASES[s.phase];
        const pl=P[s.planet];
        return (
          <div key={s.s} style={{padding:"3px 8px",borderRadius:4,flexShrink:0,background:`${phC(s.phase)}10`,border:`1px solid ${phC(s.phase)}22`}}>
            <div style={{display:"flex",alignItems:"center",gap:3,marginBottom:1}}>
              <span style={{fontSize:9,color:pl?.c}}>{pl?.s}</span>
              <span style={{fontSize:8,color:T.text,fontFamily:"'Cinzel',serif"}}>{s.s}</span>
              <TierBadge tier={s.tier}/>
            </div>
            <div style={{height:2,background:T.border,borderRadius:1,overflow:"hidden"}}>
              <div style={{width:`${(s.score/10)*100}%`,height:"100%",background:phC(s.phase),borderRadius:1}}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
export default function FinastroScreen4v3() {
  const [selected,setSelected]=useState(null);
  const [filters,setFilters]=useState({audience:"All",rotation:"All",score:"All",sort:"Honest Score"});

  const filtered=useMemo(()=>{
    let data=[...STOCKS];
    if(filters.audience!=="All"){
      data=data.filter(s=>s.audience===filters.audience||s.audience==="both"||s.audience==="intraday+positional");
    }
    if(filters.rotation!=="All") data=data.filter(s=>s.rotationPhase===filters.rotation);
    if(filters.score!=="All"){
      if(filters.score==="<5") data=data.filter(s=>s.finalScore<5);
      else if(filters.score==="≥7") data=data.filter(s=>s.finalScore>=7);
      else if(filters.score==="≥5") data=data.filter(s=>s.finalScore>=5);
    }
    const sk=filters.sort==="Technical"?"techScore":filters.sort==="Rotation"?"rotationComponent":"finalScore";
    return data.sort((a,b)=>b[sk]-a[sk]).map((s,i)=>({...s,rank:i+1}));
  },[filters]);

  const css=`
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Text:ital,wght@0,400;1,400&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    ::-webkit-scrollbar{width:4px;height:4px;}
    ::-webkit-scrollbar-track{background:${T.bg};}
    ::-webkit-scrollbar-thumb{background:${T.borderHi};border-radius:2px;}
    @keyframes fadeIn{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);}}
    @keyframes twinkle{from{opacity:0.02;}to{opacity:0.2;}}
    .srow:hover{background:${T.cardHi}!important;border-color:${T.borderHi}!important;}
    button:hover{opacity:0.8;}
  `;

  return (
    <div style={{background:T.bg,height:"100vh",fontFamily:"'Crimson Text',Georgia,serif",color:T.text,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <style>{css}</style>
      {/* Stars */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
        {Array.from({length:40},(_,i)=><div key={i} style={{position:"absolute",left:`${(i*23.7)%100}%`,top:`${(i*17.3)%100}%`,width:(i%3)*0.4+0.3,height:(i%3)*0.4+0.3,borderRadius:"50%",background:"#fff",opacity:0.02+((i%4)*0.03),animation:`twinkle ${2+(i%5)}s ease-in-out infinite alternate`,animationDelay:`${(i%6)*0.6}s`}}/>)}
      </div>

      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",height:"100%"}}>

        {/* Header */}
        <div style={{padding:"8px 12px",background:T.surface,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:16,color:T.gold,filter:`drop-shadow(0 0 6px ${T.gold})`}}>✦</span>
            <div>
              <span style={{fontSize:14,fontFamily:"'Cinzel',serif",fontWeight:900,color:T.gold,letterSpacing:4}}>FINASTRO</span>
              <span style={{fontSize:9,color:T.textDim,marginLeft:10,letterSpacing:2}}>SIGNAL SCREENER v3 · HONEST SCORING</span>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {/* Score formula */}
            <div style={{padding:"3px 10px",background:T.panel,border:`1px solid ${T.border}`,borderRadius:4,fontSize:8,color:T.textDim,fontFamily:"monospace"}}>
              <span style={{color:T.teal}}>Tech(60%)</span>
              {" + "}
              <span style={{color:T.green}}>Intraday✓(20%)</span>
              {" + "}
              <span style={{color:T.amber}}>Planetary~(20%)</span>
              {" = Honest Score"}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",background:T.greenDim,border:`1px solid ${T.green}25`,borderRadius:3}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:T.green,boxShadow:`0 0 4px ${T.green}`}}/>
              <span style={{fontSize:8,color:T.green,fontFamily:"'Cinzel',serif",letterSpacing:1}}>LIVE · 10:15 IST</span>
            </div>
          </div>
        </div>

        <TodayStrip/>
        <SectorStrip/>
        <FilterBar filters={filters} setFilters={setFilters} count={filtered.length}/>

        {/* Main */}
        <div style={{flex:1,display:"flex",overflow:"hidden"}}>
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <TableHeader/>
            <div style={{flex:1,overflowY:"auto",padding:"6px 12px"}}>
              {filtered.map(stock=>(
                <ScreenerRow key={stock.symbol} stock={stock}
                  isSelected={selected?.symbol===stock.symbol}
                  onClick={()=>setSelected(selected?.symbol===stock.symbol?null:stock)}/>
              ))}
              {filtered.length===0&&(
                <div style={{padding:40,textAlign:"center",color:T.textDim,fontFamily:"'Cinzel',serif"}}>No signals match filters</div>
              )}
            </div>
          </div>

          {/* Detail */}
          <div style={{width:295,flexShrink:0,background:T.surface,borderLeft:`1px solid ${T.border}`,overflow:"hidden"}}>
            <StockDetail stock={selected}/>
          </div>
        </div>

        {/* Footer */}
        <div style={{padding:"5px 12px",background:T.surface,borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:7,color:T.teal}}>★ Technical = primary (always)</span>
            <span style={{fontSize:7,color:T.green}}>✓ Validated = n≥30, p&lt;0.05, full weight</span>
            <span style={{fontSize:7,color:T.amber}}>~ Indicative = small n, half weight</span>
            <span style={{fontSize:7,color:T.textDim}}>✗ Unvalidated = zero weight, context only</span>
            <span style={{fontSize:7,color:T.textDim,fontFamily:"'Cinzel',serif"}}>INTRADAY = Panchang/Moon/Rahu · POSITIONAL = Planetary transits</span>
          </div>
          <div style={{fontSize:7,color:T.textDim,fontFamily:"'Cinzel',serif",letterSpacing:1}}>
            UJJAIN · LAHIRI · NOT FINANCIAL ADVICE · ASTRO FILTERS PRICE ACTION
          </div>
        </div>
      </div>
    </div>
  );
}
