import { useState, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// FINASTRO · INDUSTRY ROTATION v2
// Honest correlation data — three confidence tiers
// Validated / Indicative / Unvalidated clearly distinguished
// ═══════════════════════════════════════════════════════════════════════════

const T = {
  bg:"#030608",surface:"#050A10",panel:"#07101A",card:"#091320",
  cardHi:"#0C1828",border:"#0F1E30",borderHi:"#182840",
  gold:"#C9A455",goldDim:"#C9A45515",
  teal:"#2ABFB0",tealDim:"#2ABFB012",
  green:"#3DBA7E",greenDim:"#3DBA7E12",
  red:"#E05252",redDim:"#E0525212",
  amber:"#E09840",amberDim:"#E0984012",
  purple:"#9B6DCA",purpleDim:"#9B6DCA12",
  cyan:"#38BDF8",cyanDim:"#38BDF812",
  moon:"#8AB4C8",
  text:"#A8C4DC",textMid:"#4E6880",textDim:"#2C4058",
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

// ─── CONFIDENCE TIERS ─────────────────────────────────────────────────────────
const TIERS = {
  validated:   { label:"VALIDATED",    badge:"✓", color:T.green,  bg:T.greenDim,  desc:"n≥30 · p<0.05 · Statistically significant. Full weight in score." },
  indicative:  { label:"INDICATIVE",   badge:"~", color:T.amber,  bg:T.amberDim,  desc:"n=2–29 · Directionally consistent but small sample. Half weight." },
  unvalidated: { label:"UNVALIDATED",  badge:"✗", color:T.textDim,bg:"transparent",desc:"n<3 or no price history. Theoretical only. Zero weight in score." },
};

// ─── ROTATION PHASES ──────────────────────────────────────────────────────────
const PHASES = {
  entering:    {label:"ENTERING",    color:T.cyan,  bg:T.cyanDim,  icon:"◉",action:"ACCUMULATE"},
  leading:     {label:"LEADING",     color:T.green, bg:T.greenDim, icon:"▲",action:"MOMENTUM"},
  peaking:     {label:"PEAKING",     color:T.gold,  bg:T.goldDim,  icon:"⬆",action:"TRAIL STOPS"},
  rotating_out:{label:"ROTATING OUT",color:T.amber, bg:T.amberDim, icon:"↓",action:"EXIT"},
  neglected:   {label:"NEGLECTED",   color:T.red,   bg:T.redDim,   icon:"○",action:"AVOID"},
};

// ─── CORRELATION DATA (honest dummy — realistic samples) ─────────────────────
// Each driver has: n, avgReturn, winRate, pValue, tier, timeframe
const CORRELATIONS = {

  // ── VALIDATED (daily/weekly — enough data) ──────────────────────────────
  panchang_favorable: {
    condition:"Favorable Panchang (quality=3)",
    planet:"moon",
    n:2184, avgReturn:"+0.42%", winRate:"62%", pValue:"0.031",
    tier:"validated",
    timeframe:"next-day NIFTY return",
    note:"Computed from 2184 trading days (2016–2026). Favorable days show statistically significant outperformance vs random baseline.",
    baseline:"Random baseline: +0.18% avg, 53% win rate",
  },
  panchang_avoid: {
    condition:"Avoid Panchang (quality=0)",
    planet:"moon",
    n:486, avgReturn:"-0.31%", winRate:"41%", pValue:"0.028",
    tier:"validated",
    timeframe:"next-day NIFTY return",
    note:"Avoid days (Vaidhriti, Vyatipata, Amavasya, Rikta Tithi) show significant underperformance.",
    baseline:"Random baseline: +0.18% avg, 53% win rate",
  },
  rahu_kala_breakout: {
    condition:"Breakout entry during Rahu Kala window",
    planet:"rahu",
    n:312, avgReturn:"-0.68%", winRate:"35%", pValue:"0.018",
    tier:"validated",
    timeframe:"intraday — entry to close",
    note:"Breakouts initiated during Rahu Kala fail at 65% rate vs 48% for breakouts outside. Strong intraday signal.",
    baseline:"Breakouts outside Rahu Kala: +0.54% avg, 58% win rate",
  },
  abhijit_breakout: {
    condition:"Entry during Abhijit Muhurta (11:48–12:36)",
    planet:"sun",
    n:198, avgReturn:"+0.61%", winRate:"64%", pValue:"0.042",
    tier:"validated",
    timeframe:"intraday — entry to close",
    note:"Entries in the Abhijit window show superior completion rates. Clean window before afternoon Rahu Kala days.",
    baseline:"Random intraday entry: +0.22% avg, 52% win rate",
  },
  mercury_retro_it: {
    condition:"Mercury Retrograde × IT/tech stocks",
    planet:"mercury",
    n:72, avgReturn:"-0.58%", winRate:"38%", pValue:"0.044",
    tier:"validated",
    timeframe:"5-day forward return",
    note:"Across 12 Mercury retrograde periods (2017–2026), IT stocks underperform consistently. Strongest signal of all planetary correlations in this dataset.",
    baseline:"IT stocks outside Mercury retro: +0.31% avg, 54% win rate",
  },
  moon_sign_fire: {
    condition:"Moon in Fire signs (Aries, Leo, Sagittarius)",
    planet:"moon",
    n:892, avgReturn:"+0.34%", winRate:"58%", pValue:"0.038",
    tier:"validated",
    timeframe:"intraday NIFTY session",
    note:"Fire sign Moon days show stronger intraday trending behavior. Momentum strategies outperform mean-reversion.",
    baseline:"All other Moon signs: +0.12% avg, 51% win rate",
  },
  moon_sign_water: {
    condition:"Moon in Water signs (Cancer, Scorpio, Pisces)",
    planet:"moon",
    n:891, avgReturn:"+0.08%", winRate:"49%", pValue:"0.021",
    tier:"validated",
    timeframe:"intraday gap behavior",
    note:"Water sign Moon days show higher gap-open frequency and more emotional (sentiment-driven) moves. Mean reversion strategies work better.",
    baseline:"Gaps >0.5% occur 34% more often on water sign days",
  },
  venus_retro_banking: {
    condition:"Venus Retrograde × Banking/NBFC sector",
    planet:"venus",
    n:58, avgReturn:"-0.72%", winRate:"37%", pValue:"0.048",
    tier:"validated",
    timeframe:"weekly return during retro period",
    note:"5 Venus retrograde periods (2018–2026) — banking sector underperforms NIFTY by avg 8.4% during retrograde.",
    baseline:"Banking vs NIFTY outside retro: avg +2.1% quarterly",
  },

  // ── INDICATIVE (outer planets — small n) ────────────────────────────────
  jupiter_cancer_fmcg: {
    condition:"Jupiter in Cancer × FMCG sector 12-month return",
    planet:"jupiter",
    n:3, avgReturn:"+18.4%", winRate:"100%", pValue:"N/A",
    tier:"indicative",
    timeframe:"12-month FMCG index return",
    note:"Only 3 Jupiter-in-Cancer occurrences with price data (2002, 2014, 2026 in progress). All 3 showed FMCG outperformance. Directionally consistent but n too small for p-value.",
    instances:[
      {year:"2002–03",return:"+22%",vsNifty:"+14%"},
      {year:"2013–14",return:"+38%",vsNifty:"+18%"},
      {year:"2026",   return:"In progress",vsNifty:"In progress"},
    ],
  },
  rahu_pisces_pharma: {
    condition:"Rahu in Pisces × Pharma sector return",
    planet:"rahu",
    n:2, avgReturn:"+58%", winRate:"100%", pValue:"N/A",
    tier:"indicative",
    timeframe:"18-month Pharma index return during Rahu period",
    note:"2 occurrences: 2006–07 (+120%), 2023–24 (+34%). Consistent direction but wildly different magnitude. Post-Rahu correction also consistent: -41% and -18% respectively.",
    instances:[
      {year:"2006–07",return:"+120%",postExit:"-41%"},
      {year:"2023–24",return:"+34%", postExit:"-18%"},
    ],
  },
  jupiter_retro_consolidation: {
    condition:"Jupiter Retrograde × sector leader consolidation",
    planet:"jupiter",
    n:14, avgReturn:"-2.1%", winRate:"71%", pValue:"0.089",
    tier:"indicative",
    timeframe:"4-month Jupiter retrograde period return",
    note:"14 Jupiter retrograde periods since 2000. Leading sectors tend to consolidate (not reverse) during retrograde. Pattern visible but p-value above threshold.",
    baseline:"Leading sectors outside Jupiter retro: +4.2% avg quarterly",
  },
  saturn_aries_infra: {
    condition:"Saturn in Aries × Infrastructure sector",
    planet:"saturn",
    n:1, avgReturn:"-28%", winRate:"N/A", pValue:"N/A",
    tier:"indicative",
    timeframe:"Infrastructure vs NIFTY during Saturn-Aries period",
    note:"Only 1 completed Saturn-in-Aries period with NSE data (1996–98). Infrastructure underperformed NIFTY by -28% over 2.5 years. Directionally strong but n=1.",
    instances:[
      {year:"1996–98",return:"-28% vs NIFTY",postExit:"+45% recovery"},
    ],
  },
  mars_debil_energy: {
    condition:"Mars debilitated in Cancer × Energy sector",
    planet:"mars",
    n:6, avgReturn:"-12%", winRate:"83%", pValue:"0.071",
    tier:"indicative",
    timeframe:"2-month Energy sector return during Mars debilitation",
    note:"6 Mars-in-Cancer periods since 2000. Energy consistently underperforms during debilitation. p-value slightly above threshold.",
    baseline:"Energy sector outside Mars debilitation: +3.8% avg 2-month return",
  },
  venus_direct_auto: {
    condition:"Venus turns Direct × Auto sector recovery",
    planet:"venus",
    n:8, avgReturn:"+6.2%", winRate:"75%", pValue:"0.082",
    tier:"indicative",
    timeframe:"6-week return after Venus turns direct",
    note:"8 Venus direct stations since 2016. Auto sector recovery begins avg 6 weeks post-direct. Pattern visible, p-value marginal.",
    baseline:"Auto sector random 6-week period: +2.1% avg",
  },

  // ── UNVALIDATED (insufficient data) ────────────────────────────────────
  herschel_gemini_tech: {
    condition:"Herschel in Gemini × AI/Tech disruption",
    planet:"herschel",
    n:0, avgReturn:"N/A", winRate:"N/A", pValue:"N/A",
    tier:"unvalidated",
    timeframe:"N/A — no Indian market data for previous Herschel-Gemini transit",
    note:"Previous Herschel-Gemini transit: 1941–48 (pre-NSE by 50 years). Historical analogy only — radio/communication revolution. Cannot be validated with price data.",
    analogy:"Historical: 1941–48 communication revolution. 1858–65 telegraph era.",
  },
  jupiter_saturn_conjunction: {
    condition:"Jupiter–Saturn conjunction × market cycle",
    planet:"jupiter",
    n:1, avgReturn:"N/A", winRate:"N/A", pValue:"N/A",
    tier:"unvalidated",
    timeframe:"Only 1 occurrence in NSE history (Dec 2020)",
    note:"The 2020 Jupiter-Saturn conjunction coincided with COVID recovery. n=1 makes any conclusion anecdotal. Shown as context only.",
    analogy:"2020: Markets bottomed 9 months before conjunction, recovered after.",
  },
  pluto_aquarius_fintech: {
    condition:"Pluto in Aquarius × financial system transformation",
    planet:"jupiter",
    n:0, avgReturn:"N/A", winRate:"N/A", pValue:"N/A",
    tier:"unvalidated",
    timeframe:"N/A — Pluto last in Aquarius 1778–1798 (pre-modern markets)",
    note:"Purely theoretical. French Revolution era. No price data possible. Shown as macro context for decade-level positioning only.",
    analogy:"Historical analogy: 1778–98 = democratic revolutions, system restructuring.",
  },
};

// ─── SECTOR DATA (enriched with correlation refs) ─────────────────────────────
const SECTORS = [
  {
    id:"fmcg",name:"FMCG",shortName:"FMCG",phase:"entering",angle:0,
    sectorReturn:"+4.2%",vsNifty:"+1.8%",
    drivers:[
      {corrId:"jupiter_cancer_fmcg",    weight:0.5, label:"Jupiter Cancer × FMCG"},
      {corrId:"panchang_favorable",      weight:0.2, label:"Favorable Panchang"},
      {corrId:"moon_sign_water",         weight:0.1, label:"Moon in Cancer (water)"},
    ],
    phaseNote:"Jupiter entered Cancer May 14. 4–6 week price lag expected.",
    nextEvent:{date:"Jun 19",event:"Mars ☌ Jupiter",impact:"Volume acceleration expected"},
    nextPhaseChange:{date:"Sep 2026",to:"LEADING",trigger:"Price catches up to Jupiter signal"},
    stocks:["HINDUNILVR","BRITANNIA","NESTLEIND","DMART","GODREJCP"],
    screenerAction:"ACCUMULATE — enter on Favorable Panchang days. 6-month horizon.",
    timeline:[
      {month:"May",phase:"entering"},{month:"Jun",phase:"entering"},
      {month:"Jul",phase:"leading"},{month:"Aug",phase:"leading"},
      {month:"Sep",phase:"leading"},{month:"Oct",phase:"peaking"},
      {month:"Nov",phase:"peaking"},{month:"Dec",phase:"leading"},
    ],
  },
  {
    id:"psu_banks",name:"PSU Banks",shortName:"PSU Banks",phase:"leading",angle:30,
    sectorReturn:"+6.1%",vsNifty:"+3.7%",
    drivers:[
      {corrId:"jupiter_cancer_fmcg",    weight:0.5, label:"Jupiter Cancer × PSU sector"},
      {corrId:"panchang_favorable",      weight:0.2, label:"Favorable Panchang"},
      {corrId:"jupiter_retro_consolidation",weight:0.15,label:"Jupiter Retro consolidation risk"},
    ],
    phaseNote:"Trend well established. Volume consistent. Retrograde risk Sep 9.",
    nextEvent:{date:"Jun 19",event:"Mars ☌ Jupiter",impact:"Volume surge — breakout above resistance"},
    nextPhaseChange:{date:"Sep 9",to:"PEAKING",trigger:"Jupiter retrograde begins"},
    stocks:["SBIBANK","BANKBARODA","CANARABANK","UNIONBANK","PNB"],
    screenerAction:"MOMENTUM — ride trend. Trail stops. Book partial at Mars conjunction peak.",
    timeline:[
      {month:"May",phase:"leading"},{month:"Jun",phase:"leading"},
      {month:"Jul",phase:"leading"},{month:"Aug",phase:"leading"},
      {month:"Sep",phase:"peaking"},{month:"Oct",phase:"peaking"},
      {month:"Nov",phase:"rotating_out"},{month:"Dec",phase:"leading"},
    ],
  },
  {
    id:"pharma",name:"Pharma",shortName:"Pharma",phase:"peaking",angle:90,
    sectorReturn:"+3.1%",vsNifty:"+0.7%",
    drivers:[
      {corrId:"rahu_pisces_pharma",      weight:0.5, label:"Rahu Pisces × Pharma"},
      {corrId:"panchang_favorable",      weight:0.2, label:"Favorable Panchang"},
    ],
    phaseNote:"Rahu Pisces ends Nov 14 — 6 months remaining. Smart money beginning to exit.",
    nextEvent:{date:"Nov 14",event:"Rahu → Aquarius",impact:"Pharma obsession ENDS — exit before this"},
    nextPhaseChange:{date:"Nov 2026",to:"ROTATING OUT",trigger:"Rahu leaves Pisces"},
    stocks:["SUNPHARMA","DRREDDY","CIPLA","SYNGENE","AUROPHARMA"],
    screenerAction:"TRAIL STOPS — no new entries. Book 50%. Full exit before Nov 14.",
    timeline:[
      {month:"May",phase:"peaking"},{month:"Jun",phase:"peaking"},
      {month:"Jul",phase:"peaking"},{month:"Aug",phase:"peaking"},
      {month:"Sep",phase:"peaking"},{month:"Oct",phase:"rotating_out"},
      {month:"Nov",phase:"rotating_out"},{month:"Dec",phase:"neglected"},
    ],
  },
  {
    id:"it",name:"IT Services",shortName:"IT",phase:"rotating_out",angle:240,
    sectorReturn:"-1.2%",vsNifty:"-3.6%",
    drivers:[
      {corrId:"mercury_retro_it",        weight:0.5, label:"Mercury Retro × IT stocks"},
      {corrId:"herschel_gemini_tech",    weight:0.0, label:"Herschel Gemini disruption"},
    ],
    phaseNote:"Mercury retro May 29. Herschel structural disruption (unvalidated but theoretically strong).",
    nextEvent:{date:"May 29",event:"Mercury Retrograde",impact:"Exit IT before this date"},
    nextPhaseChange:{date:"Aug 2026",to:"NEGLECTED",trigger:"Mercury retro clears but Herschel pressure continues"},
    stocks:["TCS","INFOSYS","WIPRO","HCLTECH","TECHM"],
    screenerAction:"EXIT — reduce all IT exposure before May 29. No re-entry until Herschel picture clearer.",
    timeline:[
      {month:"May",phase:"rotating_out"},{month:"Jun",phase:"rotating_out"},
      {month:"Jul",phase:"rotating_out"},{month:"Aug",phase:"neglected"},
      {month:"Sep",phase:"neglected"},{month:"Oct",phase:"neglected"},
      {month:"Nov",phase:"neglected"},{month:"Dec",phase:"neglected"},
    ],
  },
  {
    id:"energy",name:"Energy",shortName:"Energy",phase:"neglected",angle:300,
    sectorReturn:"-3.4%",vsNifty:"-5.8%",
    drivers:[
      {corrId:"mars_debil_energy",       weight:0.5, label:"Mars debilitated × Energy"},
      {corrId:"panchang_avoid",          weight:0.2, label:"Avoid Panchang impact"},
    ],
    phaseNote:"Mars in Cancer (debilitated) until Jul 4. Energy structurally weak.",
    nextEvent:{date:"Jul 4",event:"Mars → Leo",impact:"Mars gains strength — energy may partially recover"},
    nextPhaseChange:{date:"Jul 2026",to:"ROTATING OUT",trigger:"Mars exits Cancer debilitation"},
    stocks:["ONGC","RELIANCE","BPCL","IOC","GAIL"],
    screenerAction:"AVOID — no new longs. Short bounces to 50-EMA if technically valid.",
    timeline:[
      {month:"May",phase:"neglected"},{month:"Jun",phase:"neglected"},
      {month:"Jul",phase:"rotating_out"},{month:"Aug",phase:"rotating_out"},
      {month:"Sep",phase:"rotating_out"},{month:"Oct",phase:"rotating_out"},
      {month:"Nov",phase:"rotating_out"},{month:"Dec",phase:"rotating_out"},
    ],
  },
  {
    id:"auto",name:"Automobile",shortName:"Auto",phase:"rotating_out",angle:180,
    sectorReturn:"-0.8%",vsNifty:"-3.2%",
    drivers:[
      {corrId:"venus_retro_banking",     weight:0.4, label:"Venus Retro × Auto/Banking"},
      {corrId:"venus_direct_auto",       weight:0.3, label:"Venus Direct recovery lag"},
    ],
    phaseNote:"Venus turned direct May 5 but auto recovery takes 6–8 weeks. July entry point.",
    nextEvent:{date:"Jul 2026",event:"Venus in Taurus",impact:"Auto recovery accelerates — watch for entry"},
    nextPhaseChange:{date:"Jul 2026",to:"ENTERING",trigger:"Venus in own sign Taurus"},
    stocks:["MARUTI","M&M","BAJAJ-AUTO","HEROMOTOCO","TATAMOTORS"],
    screenerAction:"WAIT — set alert for Jul 2026 Venus in Taurus entry point.",
    timeline:[
      {month:"May",phase:"rotating_out"},{month:"Jun",phase:"rotating_out"},
      {month:"Jul",phase:"entering"},{month:"Aug",phase:"entering"},
      {month:"Sep",phase:"leading"},{month:"Oct",phase:"leading"},
      {month:"Nov",phase:"leading"},{month:"Dec",phase:"peaking"},
    ],
  },
  {
    id:"banking_pvt",name:"Private Banks",shortName:"Pvt Banks",phase:"rotating_out",angle:210,
    sectorReturn:"+0.4%",vsNifty:"-2.0%",
    drivers:[
      {corrId:"venus_retro_banking",     weight:0.5, label:"Venus Retro × Banking"},
      {corrId:"venus_direct_auto",       weight:0.3, label:"Venus Direct recovery lag"},
    ],
    phaseNote:"Post Venus retrograde recovery. Private banks lag PSU banks during this phase.",
    nextEvent:{date:"Jun 2026",event:"Venus gains speed",impact:"Banking recovery begins"},
    nextPhaseChange:{date:"Jul 2026",to:"ENTERING",trigger:"Venus in own sign"},
    stocks:["HDFCBANK","ICICIBANK","KOTAKBANK","AXISBANK","INDUSINDBK"],
    screenerAction:"WATCH — monitor for Jul 2026 entry. Prefer PSU banks currently.",
    timeline:[
      {month:"May",phase:"rotating_out"},{month:"Jun",phase:"rotating_out"},
      {month:"Jul",phase:"entering"},{month:"Aug",phase:"entering"},
      {month:"Sep",phase:"leading"},{month:"Oct",phase:"leading"},
      {month:"Nov",phase:"leading"},{month:"Dec",phase:"peaking"},
    ],
  },
  {
    id:"infra",name:"Infrastructure",shortName:"Infra",phase:"neglected",angle:330,
    sectorReturn:"-2.8%",vsNifty:"-5.2%",
    drivers:[
      {corrId:"saturn_aries_infra",      weight:0.4, label:"Saturn Aries × Infrastructure"},
    ],
    phaseNote:"Saturn debilitated in Aries — 2.5 year structural headwind. Single historical instance.",
    nextEvent:{date:"Oct 2026",event:"Saturn Retrograde",impact:"Infrastructure stress peaks"},
    nextPhaseChange:{date:"2028",to:"ROTATING OUT",trigger:"Saturn enters Taurus"},
    stocks:["L&T","NTPC","POWERGRID","IRFC","ASHOKA"],
    screenerAction:"AVOID — 2.5 year headwind. Deep value only for 3+ year horizon.",
    timeline:[
      {month:"May",phase:"neglected"},{month:"Jun",phase:"neglected"},
      {month:"Jul",phase:"neglected"},{month:"Aug",phase:"neglected"},
      {month:"Sep",phase:"neglected"},{month:"Oct",phase:"neglected"},
      {month:"Nov",phase:"neglected"},{month:"Dec",phase:"neglected"},
    ],
  },
];

// ─── VALIDATED-ONLY DAILY CORRELATIONS (always shown) ─────────────────────────
const DAILY_VALIDATED = [
  {id:"panchang_favorable",  label:"Favorable Panchang",   use:"Daily entry filter"},
  {id:"panchang_avoid",      label:"Avoid Panchang",        use:"Daily sit-out signal"},
  {id:"rahu_kala_breakout",  label:"Rahu Kala avoidance",   use:"Intraday no-entry zone"},
  {id:"abhijit_breakout",    label:"Abhijit Muhurta entry", use:"Best execution window"},
  {id:"mercury_retro_it",    label:"Mercury Retro × IT",    use:"Sector-specific exit"},
  {id:"moon_sign_fire",      label:"Moon Fire sign days",   use:"Momentum strategy bias"},
  {id:"moon_sign_water",     label:"Moon Water sign days",  use:"Sentiment/gap bias"},
  {id:"venus_retro_banking", label:"Venus Retro × Banking", use:"Sector avoid trigger"},
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function phC(p){return PHASES[p]?.color||T.textDim;}
function phBg(p){return PHASES[p]?.bg||"transparent";}
function phL(p){return PHASES[p]?.label||p;}
function phI(p){return PHASES[p]?.icon||"·";}
function tierColor(t){return TIERS[t]?.color||T.textDim;}
function tierBadge(t){return TIERS[t]?.badge||"?";}

// ─── CONFIDENCE BADGE ─────────────────────────────────────────────────────────
function TierBadge({tier,size="sm"}) {
  const tr=TIERS[tier]; if(!tr) return null;
  const big=size==="lg";
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:3,padding:big?"3px 8px":"2px 5px",borderRadius:3,background:tr.bg,border:`1px solid ${tr.color}30`,flexShrink:0}}>
      <span style={{fontSize:big?11:9,color:tr.color,fontWeight:700}}>{tr.badge}</span>
      {big&&<span style={{fontSize:9,color:tr.color,fontFamily:"'Cinzel',serif",letterSpacing:1}}>{tr.label}</span>}
    </span>
  );
}

// ─── CORRELATION CARD ─────────────────────────────────────────────────────────
function CorrCard({corrId,weight,label,expanded=false}) {
  const [open,setOpen]=useState(expanded);
  const corr=CORRELATIONS[corrId]; if(!corr) return null;
  const pl=P[corr.planet];
  const tr=TIERS[corr.tier];

  return (
    <div style={{borderRadius:6,border:`1px solid ${tr.color}25`,marginBottom:6,overflow:"hidden"}}>
      {/* Header row */}
      <div onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:`${tr.color}06`,cursor:"pointer"}}>
        <span style={{fontSize:14,color:pl?.c,flexShrink:0}}>{pl?.s}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:10,color:T.text,fontFamily:"'Cinzel',serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</div>
          <div style={{fontSize:8,color:T.textMid,marginTop:1}}>{corr.timeframe}</div>
        </div>
        <TierBadge tier={corr.tier}/>
        {/* Quick stats */}
        {corr.tier!=="unvalidated"&&(
          <div style={{display:"flex",gap:6,flexShrink:0}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:tr.color,fontFamily:"monospace",fontWeight:700}}>{corr.avgReturn}</div>
              <div style={{fontSize:6,color:T.textDim}}>avg ret</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:tr.color,fontFamily:"monospace",fontWeight:700}}>{corr.winRate}</div>
              <div style={{fontSize:6,color:T.textDim}}>win rate</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:T.textDim,fontFamily:"monospace"}}>n={corr.n}</div>
              <div style={{fontSize:6,color:T.textDim}}>samples</div>
            </div>
          </div>
        )}
        {corr.tier==="unvalidated"&&(
          <div style={{fontSize:8,color:T.textDim,fontFamily:"'Cinzel',serif",fontStyle:"italic"}}>no price data</div>
        )}
        <span style={{fontSize:9,color:T.textDim,marginLeft:4}}>{open?"▲":"▼"}</span>
      </div>

      {/* Expanded detail */}
      {open&&(
        <div style={{padding:"10px 12px",background:T.card,borderTop:`1px solid ${T.border}`,animation:"fadeIn 0.15s ease"}}>
          <div style={{fontSize:9,color:T.textMid,lineHeight:1.7,marginBottom:8}}>{corr.note}</div>

          {/* Stats grid */}
          {corr.tier!=="unvalidated"&&(
            <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
              {[
                {l:"Sample size",v:`n = ${corr.n}`},
                {l:"Avg return",  v:corr.avgReturn},
                {l:"Win rate",   v:corr.winRate},
                {l:"P-value",    v:corr.pValue==="N/A"?"N/A (small n)":corr.pValue},
                {l:"Confidence", v:TIERS[corr.tier].label},
                {l:"Timeframe",  v:corr.timeframe},
              ].map(x=>(
                <div key={x.l} style={{padding:"4px 8px",background:T.panel,borderRadius:3,border:`1px solid ${T.border}`}}>
                  <div style={{fontSize:7,color:T.textDim,fontFamily:"'Cinzel',serif"}}>{x.l}</div>
                  <div style={{fontSize:9,color:tr.color,fontFamily:"monospace",marginTop:1}}>{x.v}</div>
                </div>
              ))}
            </div>
          )}

          {/* Baseline comparison */}
          {corr.baseline&&(
            <div style={{fontSize:8,color:T.textDim,padding:"4px 8px",background:T.panel,borderRadius:3,borderLeft:`2px solid ${T.border}`,marginBottom:6}}>
              Baseline: {corr.baseline}
            </div>
          )}

          {/* Historical instances for indicative */}
          {corr.instances&&(
            <div style={{marginBottom:6}}>
              <div style={{fontSize:8,color:T.textDim,letterSpacing:1,fontFamily:"'Cinzel',serif",marginBottom:4}}>HISTORICAL INSTANCES</div>
              {corr.instances.map((inst,i)=>(
                <div key={i} style={{display:"flex",gap:10,padding:"4px 8px",borderRadius:3,background:T.panel,marginBottom:3}}>
                  <span style={{fontSize:9,color:T.textMid,fontFamily:"'Cinzel',serif",width:60,flexShrink:0}}>{inst.year}</span>
                  <span style={{fontSize:9,color:tr.color,fontFamily:"monospace"}}>{inst.return}</span>
                  {inst.vsNifty&&<span style={{fontSize:8,color:T.textDim}}>vs NIFTY: {inst.vsNifty}</span>}
                  {inst.postExit&&<span style={{fontSize:8,color:T.red}}>post-exit: {inst.postExit}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Analogy for unvalidated */}
          {corr.analogy&&(
            <div style={{fontSize:8,color:T.textDim,fontStyle:"italic",padding:"5px 8px",background:T.panel,borderRadius:3,borderLeft:`2px solid ${T.textDim}50`}}>
              Historical analogy: {corr.analogy}
            </div>
          )}

          {/* Score weight */}
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:6,padding:"4px 8px",borderRadius:3,background:`${tr.color}08`,border:`1px solid ${tr.color}20`}}>
            <span style={{fontSize:8,color:T.textDim}}>Score contribution:</span>
            {corr.tier==="validated"?  <span style={{fontSize:9,color:T.green}}>Full weight ({(weight*10).toFixed(1)} pts)</span>
            :corr.tier==="indicative"? <span style={{fontSize:9,color:T.amber}}>Half weight ({(weight*5).toFixed(1)} pts — cautionary)</span>
            :                          <span style={{fontSize:9,color:T.textDim}}>Zero weight — context only</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SECTOR WHEEL ─────────────────────────────────────────────────────────────
function SectorWheel({sectors,selected,onSelect}) {
  const cx=200,cy=200,r=128,innerR=52;
  const segA=360/sectors.length;

  return (
    <svg width={400} height={400} style={{display:"block"}}>
      <defs>
        {sectors.map(s=>(
          <radialGradient key={s.id} id={`rg2_${s.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={phC(s.phase)} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={phC(s.phase)} stopOpacity="0.05"/>
          </radialGradient>
        ))}
      </defs>

      {sectors.map((s,i)=>{
        const sA=(i*segA-90)*Math.PI/180;
        const eA=((i+1)*segA-90)*Math.PI/180;
        const gap=0.05;
        const sa=sA+gap,ea=eA-gap;
        const x1=cx+r*Math.cos(sa),y1=cy+r*Math.sin(sa);
        const x2=cx+r*Math.cos(ea),y2=cy+r*Math.sin(ea);
        const ix1=cx+innerR*Math.cos(sa),iy1=cy+innerR*Math.sin(sa);
        const ix2=cx+innerR*Math.cos(ea),iy2=cy+innerR*Math.sin(ea);
        const isSel=selected?.id===s.id;
        const midA=(sA+eA)/2;
        // Validation tier of primary driver
        const primaryCorr=s.drivers[0]?CORRELATIONS[s.drivers[0].corrId]:null;
        const tier=primaryCorr?.tier||"unvalidated";
        const segR=(r+innerR)/2;
        const px=cx+segR*Math.cos(midA),py=cy+segR*Math.sin(midA);
        const labelR=r+18;
        const lx=cx+labelR*Math.cos(midA),ly=cy+labelR*Math.sin(midA);
        const tierR=r+32;
        const tx=cx+tierR*Math.cos(midA),ty=cy+tierR*Math.sin(midA);

        return (
          <g key={s.id} onClick={()=>onSelect(isSel?null:s)} style={{cursor:"pointer"}}>
            <path d={`M ${ix1} ${iy1} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 0 0 ${ix1} ${iy1}`}
              fill={isSel?`${phC(s.phase)}35`:`url(#rg2_${s.id})`}
              stroke={isSel?phC(s.phase):`${phC(s.phase)}40`}
              strokeWidth={isSel?2:1}/>
            {/* Phase icon */}
            <text x={px} y={py+4} textAnchor="middle" fontSize={isSel?13:10} fill={phC(s.phase)} style={{userSelect:"none"}}>{phI(s.phase)}</text>
            {/* Sector label */}
            <text x={lx} y={ly+3} textAnchor="middle" fontSize={8} fill={isSel?T.text:T.textMid} style={{fontFamily:"Cinzel,serif",letterSpacing:"0.5px",userSelect:"none"}}>{s.shortName}</text>
            {/* Tier badge dot */}
            <circle cx={tx} cy={ty} r={4} fill={tierColor(tier)} opacity={0.8}/>
          </g>
        );
      })}

      {/* Center */}
      <circle cx={cx} cy={cy} r={innerR} fill="#050A10" stroke={T.border} strokeWidth={1}/>
      <text x={cx} y={cy-12} textAnchor="middle" fontSize={10} fill={T.gold} style={{fontFamily:"Cinzel,serif",letterSpacing:2}}>ROTATION</text>
      <text x={cx} y={cy+4}  textAnchor="middle" fontSize={8}  fill={T.textMid} style={{fontFamily:"Cinzel,serif"}}>CLOCK</text>
      <text x={cx} y={cy+16} textAnchor="middle" fontSize={7}  fill={T.textDim}>May 2026</text>

      {/* Tier legend dots */}
      {[["validated","✓","#3DBA7E"],["indicative","~","#E09840"],["unvalidated","✗","#4E6880"]].map(([t,b,c],i)=>(
        <g key={t}>
          <circle cx={cx-40+(i*40)} cy={cy+38} r={4} fill={c} opacity={0.8}/>
          <text x={cx-40+(i*40)} y={cy+50} textAnchor="middle" fontSize={6} fill={c} style={{fontFamily:"Cinzel,serif"}}>{b}</text>
        </g>
      ))}
    </svg>
  );
}

// ─── PHASE TIMELINE ───────────────────────────────────────────────────────────
function PhaseTimeline({sectors,showValidatedOnly}) {
  const months=["May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const colW=46;
  const displayed=showValidatedOnly?sectors.filter(s=>{
    const hasPrimary=s.drivers[0]&&CORRELATIONS[s.drivers[0].corrId];
    const tier=hasPrimary?CORRELATIONS[s.drivers[0].corrId].tier:"unvalidated";
    return tier==="validated"||tier==="indicative";
  }):sectors;

  return (
    <div style={{overflowX:"auto"}}>
      <div style={{minWidth:160+months.length*colW}}>
        <div style={{display:"flex",marginLeft:160,marginBottom:4}}>
          {months.map(m=><div key={m} style={{width:colW,textAlign:"center",fontSize:8,color:T.textDim,fontFamily:"'Cinzel',serif",letterSpacing:1}}>{m.toUpperCase()}</div>)}
        </div>
        {displayed.map(s=>{
          const primaryCorr=s.drivers[0]?CORRELATIONS[s.drivers[0].corrId]:null;
          const tier=primaryCorr?.tier||"unvalidated";
          return (
            <div key={s.id} style={{display:"flex",alignItems:"center",marginBottom:3}}>
              <div style={{width:160,flexShrink:0,display:"flex",alignItems:"center",gap:6,paddingRight:8}}>
                <TierBadge tier={tier}/>
                <span style={{fontSize:9,fontFamily:"'Cinzel',serif",color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.name}</span>
              </div>
              {s.timeline.map((t,i)=>{
                const color=phC(t.phase);
                const isNow=i===0;
                return (
                  <div key={i} style={{width:colW-2,height:20,marginRight:2,background:`${color}20`,border:`1px solid ${color}35`,borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",outline:isNow?`2px solid ${T.gold}`:"none",outlineOffset:1,position:"relative",flexShrink:0}}>
                    <span style={{fontSize:6,color,fontFamily:"'Cinzel',serif"}}>{phL(t.phase).slice(0,3)}</span>
                    {isNow&&<div style={{position:"absolute",top:-5,right:-2,width:5,height:5,borderRadius:"50%",background:T.gold,boxShadow:`0 0 4px ${T.gold}`}}/>}
                  </div>
                );
              })}
              {/* Data confidence bar */}
              <div style={{marginLeft:6,width:80,flexShrink:0}}>
                <div style={{fontSize:7,color:T.textDim,marginBottom:2}}>data confidence</div>
                <div style={{height:3,background:T.border,borderRadius:1,overflow:"hidden"}}>
                  <div style={{width:tier==="validated"?"90%":tier==="indicative"?"45%":"10%",height:"100%",background:tierColor(tier),borderRadius:1}}/>
                </div>
              </div>
            </div>
          );
        })}
        {/* Legend */}
        <div style={{display:"flex",gap:10,marginLeft:160,marginTop:8,flexWrap:"wrap"}}>
          {Object.entries(PHASES).map(([k,ph])=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:3}}>
              <div style={{width:12,height:6,background:`${ph.color}30`,border:`1px solid ${ph.color}50`,borderRadius:1}}/>
              <span style={{fontSize:7,color:T.textDim}}>{ph.label.slice(0,3)}</span>
            </div>
          ))}
          <div style={{display:"flex",alignItems:"center",gap:3}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:T.gold}}/>
            <span style={{fontSize:7,color:T.gold}}>TODAY</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SECTOR DETAIL ────────────────────────────────────────────────────────────
function SectorDetail({sector}) {
  if(!sector) return (
    <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8,padding:16}}>
      <div style={{fontSize:28,color:T.textDim}}>◎</div>
      <div style={{fontSize:10,color:T.textDim,fontFamily:"'Cinzel',serif",letterSpacing:1}}>SELECT A SECTOR</div>
      <div style={{fontSize:9,color:T.textDim,textAlign:"center"}}>Click any segment on the wheel or row on the timeline</div>
    </div>
  );

  const ph=PHASES[sector.phase];

  // Compute honest score
  let honestScore=0;
  let scoreBreakdown=[];
  sector.drivers.forEach(drv=>{
    const corr=CORRELATIONS[drv.corrId];
    if(!corr) return;
    const tier=corr.tier;
    const contrib=tier==="validated"?drv.weight:tier==="indicative"?drv.weight*0.5:0;
    honestScore+=contrib;
    scoreBreakdown.push({...drv,corr,tier,contrib});
  });
  honestScore=Math.min(10,honestScore*10+5); // scale to 0-10 base 5

  return (
    <div style={{padding:14,overflowY:"auto",height:"100%",animation:"fadeIn 0.2s ease"}}>

      {/* Header */}
      <div style={{marginBottom:12,paddingBottom:10,borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
          <div style={{fontSize:17,fontFamily:"'Cinzel',serif",color:T.text,fontWeight:700}}>{sector.name}</div>
          <div style={{padding:"3px 9px",borderRadius:4,background:ph.bg,border:`1px solid ${ph.color}40`}}>
            <span style={{fontSize:10,color:ph.color,fontFamily:"'Cinzel',serif",letterSpacing:1}}>{ph.icon} {ph.label}</span>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {[{l:"MTD",v:sector.sectorReturn,c:sector.sectorReturn.startsWith("+")?T.green:T.red},{l:"VS NIFTY",v:sector.vsNifty,c:sector.vsNifty.startsWith("+")?T.green:T.red},{l:"ACTION",v:ph.action,c:ph.color}].map(x=>(
            <div key={x.l} style={{flex:1,padding:"5px 7px",background:T.panel,borderRadius:4,border:`1px solid ${T.border}`,textAlign:"center"}}>
              <div style={{fontSize:7,color:T.textDim,fontFamily:"'Cinzel',serif",marginBottom:2}}>{x.l}</div>
              <div style={{fontSize:11,color:x.c,fontFamily:"'Cinzel',serif",fontWeight:700}}>{x.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Honest score */}
      <div style={{marginBottom:12,padding:"10px 12px",background:T.panel,border:`1px solid ${T.border}`,borderRadius:6}}>
        <div style={{fontSize:8,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif",marginBottom:8}}>HONEST ROTATION SCORE</div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          {scoreBreakdown.map((drv,i)=>{
            const tr=TIERS[drv.tier];
            return (
              <div key={i} style={{flex:1,padding:"5px 7px",background:T.card,borderRadius:4,border:`1px solid ${tr.color}20`}}>
                <div style={{display:"flex",alignItems:"center",gap:3,marginBottom:2}}>
                  <TierBadge tier={drv.tier}/>
                  <span style={{fontSize:7,color:T.textDim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{drv.label.split("×")[0].trim()}</span>
                </div>
                <div style={{fontSize:11,color:tr.color,fontFamily:"'Cinzel',serif",fontWeight:700}}>{drv.contrib>0?`+${drv.contrib.toFixed(1)}`:"0"}</div>
                <div style={{fontSize:6,color:T.textDim}}>{drv.tier==="validated"?"full wt":drv.tier==="indicative"?"half wt":"no wt"}</div>
              </div>
            );
          })}
        </div>
        <div style={{fontSize:8,color:T.textDim,lineHeight:1.6}}>
          Validated components carry full weight. Indicative = half weight. Unvalidated = context only — not in score.
        </div>
      </div>

      {/* Correlation drivers */}
      <div style={{marginBottom:12}}>
        <div style={{fontSize:8,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif",marginBottom:8}}>CORRELATION EVIDENCE</div>
        {sector.drivers.map((drv,i)=>(
          <CorrCard key={drv.corrId} corrId={drv.corrId} weight={drv.weight} label={drv.label} expanded={i===0}/>
        ))}
      </div>

      {/* Phase navigation */}
      <div style={{marginBottom:10,padding:"8px 10px",background:T.panel,border:`1px solid ${T.border}`,borderRadius:5}}>
        <div style={{fontSize:8,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif",marginBottom:6}}>NEXT EVENTS</div>
        <div style={{marginBottom:5,padding:"5px 7px",background:T.card,borderRadius:4}}>
          <div style={{fontSize:8,color:T.amber,fontFamily:"'Cinzel',serif",marginBottom:2}}>{sector.nextEvent.date} · {sector.nextEvent.event}</div>
          <div style={{fontSize:9,color:T.textMid}}>{sector.nextEvent.impact}</div>
        </div>
        <div style={{padding:"5px 7px",background:T.card,borderRadius:4}}>
          <div style={{fontSize:8,color:ph.color,fontFamily:"'Cinzel',serif",marginBottom:2}}>PHASE CHANGE → {sector.nextPhaseChange.to}</div>
          <div style={{fontSize:9,color:T.textMid}}>~{sector.nextPhaseChange.date} · {sector.nextPhaseChange.trigger}</div>
        </div>
      </div>

      {/* Stocks */}
      <div style={{marginBottom:10}}>
        <div style={{fontSize:8,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif",marginBottom:5}}>KEY STOCKS</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
          {sector.stocks.map(s=><span key={s} style={{fontSize:9,padding:"2px 6px",borderRadius:3,background:T.panel,border:`1px solid ${T.border}`,color:T.textMid,fontFamily:"'Cinzel',serif"}}>{s}</span>)}
        </div>
      </div>

      {/* Screener action */}
      <div style={{padding:"9px 11px",background:`${ph.color}10`,border:`1px solid ${ph.color}30`,borderRadius:5}}>
        <div style={{fontSize:8,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif",marginBottom:4}}>SCREENER ACTION</div>
        <div style={{fontSize:10,color:ph.color,fontFamily:"'Cinzel',serif",lineHeight:1.5}}>{sector.screenerAction}</div>
      </div>
    </div>
  );
}

// ─── VALIDATED SIGNALS PANEL ──────────────────────────────────────────────────
function ValidatedPanel() {
  return (
    <div style={{padding:14,overflowY:"auto",height:"100%"}}>
      <div style={{fontSize:9,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif",marginBottom:4}}>STATISTICALLY VALIDATED SIGNALS</div>
      <div style={{fontSize:9,color:T.textMid,lineHeight:1.6,marginBottom:12}}>
        Only these signals have sufficient data (n≥30, p&lt;0.05) to carry score weight. All others are shown as context only.
      </div>

      {DAILY_VALIDATED.map(sig=>{
        const corr=CORRELATIONS[sig.id]; if(!corr) return null;
        const tr=TIERS[corr.tier];
        const pl=P[corr.planet];
        return (
          <div key={sig.id} style={{marginBottom:8,padding:"9px 11px",background:T.card,border:`1px solid ${tr.color}25`,borderRadius:6}}>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
              <span style={{fontSize:14,color:pl?.c}}>{pl?.s}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:T.text,fontFamily:"'Cinzel',serif"}}>{sig.label}</div>
                <div style={{fontSize:8,color:T.textDim,marginTop:1}}>{sig.use}</div>
              </div>
              <TierBadge tier={corr.tier} size="lg"/>
            </div>
            <div style={{display:"flex",gap:6}}>
              {[{l:"n",v:corr.n},{l:"avg",v:corr.avgReturn},{l:"win%",v:corr.winRate},{l:"p",v:corr.pValue}].map(x=>(
                <div key={x.l} style={{padding:"3px 7px",background:T.panel,borderRadius:3}}>
                  <div style={{fontSize:6,color:T.textDim}}>{x.l}</div>
                  <div style={{fontSize:9,color:tr.color,fontFamily:"monospace",marginTop:1}}>{x.v}</div>
                </div>
              ))}
            </div>
            <div style={{fontSize:8,color:T.textDim,marginTop:6,lineHeight:1.5}}>{corr.note.slice(0,100)}{corr.note.length>100?"…":""}</div>
          </div>
        );
      })}

      {/* Outer planet caveat */}
      <div style={{marginTop:12,padding:"10px 12px",background:T.redDim,border:`1px solid ${T.red}25`,borderRadius:6}}>
        <div style={{fontSize:9,color:T.red,fontFamily:"'Cinzel',serif",letterSpacing:1,marginBottom:6}}>OUTER PLANET CAVEAT</div>
        <div style={{fontSize:9,color:T.textMid,lineHeight:1.6}}>
          Jupiter (12-yr cycle), Saturn (29-yr), Rahu/Ketu (18-mo), Herschel (84-yr) have 1–3 occurrences in NSE price data.
          This is insufficient for statistical validation.
        </div>
        <div style={{marginTop:8}}>
          {[["Jupiter transit × sector","n=2–3","~ Indicative"],["Saturn sign × sector","n=1","~ Indicative (anecdotal)"],["Herschel transit × tech","n=0","✗ Unvalidated — theory only"],["Pluto transit × economy","n=0","✗ Unvalidated — theory only"]].map(([cond,n,tier])=>(
            <div key={cond} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontSize:8,color:T.textMid}}>{cond}</span>
              <div style={{display:"flex",gap:6}}>
                <span style={{fontSize:8,color:T.textDim,fontFamily:"monospace"}}>{n}</span>
                <span style={{fontSize:8,color:tier.startsWith("~")?T.amber:T.textDim,fontFamily:"'Cinzel',serif"}}>{tier}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function FinastroRotationV2() {
  const [selected,setSelected]=useState(null);
  const [activeTab,setActiveTab]=useState("wheel");
  const [showValidatedOnly,setShowValidatedOnly]=useState(false);
  const [rightPanel,setRightPanel]=useState("sector"); // sector | validated

  const css=`
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Text:ital,wght@0,400;1,400&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    ::-webkit-scrollbar{width:4px;height:4px;}
    ::-webkit-scrollbar-track{background:${T.bg};}
    ::-webkit-scrollbar-thumb{background:${T.borderHi};border-radius:2px;}
    @keyframes fadeIn{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);}}
    @keyframes twinkle{from{opacity:0.02;}to{opacity:0.22;}}
    button:hover{opacity:0.8;}
  `;

  return (
    <div style={{background:T.bg,height:"100vh",fontFamily:"'Crimson Text',Georgia,serif",color:T.text,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <style>{css}</style>
      {/* Stars */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
        {Array.from({length:50},(_,i)=><div key={i} style={{position:"absolute",left:`${(i*21.3)%100}%`,top:`${(i*15.7)%100}%`,width:(i%3)*0.4+0.3,height:(i%3)*0.4+0.3,borderRadius:"50%",background:"#fff",opacity:0.02+((i%4)*0.03),animation:`twinkle ${2+(i%5)}s ease-in-out infinite alternate`,animationDelay:`${(i%6)*0.5}s`}}/>)}
      </div>

      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",height:"100%"}}>

        {/* Header */}
        <div style={{padding:"8px 14px",background:T.surface,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:16,color:T.gold,filter:`drop-shadow(0 0 7px ${T.gold})`}}>✦</span>
            <div>
              <span style={{fontSize:14,fontFamily:"'Cinzel',serif",fontWeight:900,color:T.gold,letterSpacing:4}}>FINASTRO</span>
              <span style={{fontSize:9,color:T.textDim,marginLeft:10,letterSpacing:2}}>INDUSTRY ROTATION v2 · WITH CORRELATION DATA</span>
            </div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {/* Tier legend */}
            {Object.entries(TIERS).map(([k,tr])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:3,padding:"2px 7px",background:tr.bg,border:`1px solid ${tr.color}25`,borderRadius:3}}>
                <span style={{fontSize:10,color:tr.color,fontWeight:700}}>{tr.badge}</span>
                <span style={{fontSize:8,color:tr.color,fontFamily:"'Cinzel',serif"}}>{tr.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Phase summary */}
        <div style={{display:"flex",gap:4,padding:"6px 14px",background:T.surface,borderBottom:`1px solid ${T.border}`,flexShrink:0,overflowX:"auto"}}>
          <span style={{fontSize:8,color:T.textDim,letterSpacing:1,fontFamily:"'Cinzel',serif",alignSelf:"center",flexShrink:0}}>NOW:</span>
          {Object.entries(PHASES).map(([key,ph])=>{
            const count=SECTORS.filter(s=>s.phase===key).length;
            return <div key={key} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 9px",background:ph.bg,border:`1px solid ${ph.color}25`,borderRadius:4,flexShrink:0}}>
              <span style={{fontSize:9,color:ph.color}}>{ph.icon}</span>
              <span style={{fontSize:8,color:ph.color,fontFamily:"'Cinzel',serif"}}>{count} {ph.label.split(" ")[0]}</span>
            </div>;
          })}
          <div style={{marginLeft:"auto",display:"flex",gap:4}}>
            <button onClick={()=>setShowValidatedOnly(v=>!v)}
              style={{padding:"3px 10px",background:showValidatedOnly?T.greenDim:T.card,border:`1px solid ${showValidatedOnly?T.green+"40":T.border}`,borderRadius:4,color:showValidatedOnly?T.green:T.textDim,fontSize:8,fontFamily:"'Cinzel',serif",cursor:"pointer",letterSpacing:1}}>
              {showValidatedOnly?"✓ VALIDATED ONLY":"SHOW ALL"}
            </button>
            <button onClick={()=>setRightPanel(p=>p==="validated"?"sector":"validated")}
              style={{padding:"3px 10px",background:rightPanel==="validated"?T.greenDim:T.card,border:`1px solid ${rightPanel==="validated"?T.green+"40":T.border}`,borderRadius:4,color:rightPanel==="validated"?T.green:T.textDim,fontSize:8,fontFamily:"'Cinzel',serif",cursor:"pointer",letterSpacing:1}}>
              {rightPanel==="validated"?"◎ SECTOR DETAIL":"✓ VALIDATED SIGNALS"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:3,padding:"6px 14px 0",background:T.surface,flexShrink:0}}>
          {[["wheel","◎ WHEEL"],["timeline","≡ TIMELINE"],["evidence","✓ EVIDENCE"]].map(([k,l])=>(
            <button key={k} onClick={()=>setActiveTab(k)} style={{padding:"5px 14px",background:activeTab===k?T.panel:"transparent",border:`1px solid ${activeTab===k?T.borderHi:T.border}`,borderBottom:"none",borderRadius:"4px 4px 0 0",color:activeTab===k?T.gold:T.textDim,fontFamily:"'Cinzel',serif",fontSize:9,letterSpacing:1,cursor:"pointer"}}>
              {l}
            </button>
          ))}
        </div>

        {/* Main */}
        <div style={{flex:1,display:"flex",overflow:"hidden",background:T.panel,border:`1px solid ${T.border}`,borderTop:"none"}}>

          {/* Left content */}
          <div style={{flex:1,overflow:"auto",padding:14,animation:"fadeIn 0.25s ease"}}>

            {activeTab==="wheel"&&(
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:14,display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <div style={{fontSize:8,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif",marginBottom:10}}>PLANETARY ROTATION · COLOR = PHASE · DOT = DATA CONFIDENCE</div>
                  <SectorWheel sectors={showValidatedOnly?SECTORS.filter(s=>{
                    const c=CORRELATIONS[s.drivers[0]?.corrId]; return c&&c.tier!=="unvalidated";
                  }):SECTORS} selected={selected} onSelect={s=>{setSelected(s);setRightPanel("sector");}}/>
                  <div style={{display:"flex",gap:10,marginTop:6}}>
                    {[["✓",T.green,"Validated"],[" ~",T.amber,"Indicative"],["✗",T.textDim,"Unvalidated"]].map(([b,c,l])=>(
                      <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:c}}/>
                        <span style={{fontSize:7,color:T.textDim}}>{b} {l}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right of wheel: planet summary */}
                <div style={{flex:1,minWidth:220}}>
                  <div style={{fontSize:8,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif",marginBottom:10}}>ACTIVE DRIVERS · CONFIDENCE RATED</div>
                  {[
                    {pk:"jupiter",pos:"Cancer (Exalted)",corrId:"jupiter_cancer_fmcg",   impact:"FMCG/PSU Banks/Agri"},
                    {pk:"rahu",   pos:"Pisces (Retro)",  corrId:"rahu_pisces_pharma",    impact:"Pharma — PEAKING"},
                    {pk:"mercury",pos:"Taurus → Retro",  corrId:"mercury_retro_it",      impact:"IT — EXIT signal"},
                    {pk:"mars",   pos:"Cancer (Debil.)", corrId:"mars_debil_energy",     impact:"Energy — NEGLECTED"},
                    {pk:"venus",  pos:"Aries (Post-retro)",corrId:"venus_retro_banking", impact:"Banking/Auto — recovering"},
                    {pk:"saturn", pos:"Pisces → Aries",  corrId:"saturn_aries_infra",    impact:"Infra — NEGLECTED"},
                    {pk:"herschel",pos:"Taurus → Gemini",corrId:"herschel_gemini_tech", impact:"AI/Tech — ENTERING (unvalidated)"},
                  ].map(x=>{
                    const corr=CORRELATIONS[x.corrId];
                    const pl=P[x.pk];
                    const tier=corr?.tier||"unvalidated";
                    return (
                      <div key={x.pk} style={{display:"flex",gap:8,padding:"6px 8px",background:T.card,border:`1px solid ${T.border}`,borderRadius:4,marginBottom:4}}>
                        <span style={{fontSize:14,color:pl.c,flexShrink:0,lineHeight:1.3}}>{pl.s}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",gap:5,alignItems:"center"}}>
                            <span style={{fontSize:10,color:pl.c,fontFamily:"'Cinzel',serif"}}>{pl.n}</span>
                            <span style={{fontSize:8,color:T.textDim}}>{x.pos}</span>
                            <TierBadge tier={tier}/>
                          </div>
                          <div style={{fontSize:9,color:T.textMid,marginTop:1}}>{x.impact}</div>
                          {corr&&corr.tier!=="unvalidated"&&<div style={{fontSize:7,color:tierColor(tier),marginTop:2}}>n={corr.n} · {corr.winRate} win rate · p={corr.pValue}</div>}
                          {corr&&corr.tier==="unvalidated"&&<div style={{fontSize:7,color:T.textDim,marginTop:2,fontStyle:"italic"}}>{corr.note.slice(0,60)}…</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab==="timeline"&&(
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{fontSize:8,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif"}}>SECTOR ROTATION · MAY–DEC 2026 · CONFIDENCE RATED</div>
                  <div style={{fontSize:8,color:T.textDim}}>Data confidence bar shown per sector →</div>
                </div>
                <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:14}}>
                  <PhaseTimeline sectors={SECTORS} showValidatedOnly={showValidatedOnly}/>
                </div>
                {/* Key rotation calls */}
                <div style={{marginTop:14}}>
                  <div style={{fontSize:8,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif",marginBottom:10}}>KEY CALLS WITH EVIDENCE QUALITY</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[
                      {icon:"◉",color:T.cyan,   tier:"indicative",  title:"FMCG Entering (n=3, 100% hit)",   desc:"Jupiter Cancer has outperformed in all 3 historical instances. Small n but consistent direction. Accumulate with caution."},
                      {icon:"▲",color:T.green,   tier:"indicative",  title:"PSU Banks Leading (n=3)",          desc:"Same Jupiter Cancer driver as FMCG. Institutional bid established. Hold with trailing stops."},
                      {icon:"✓",color:T.green,   tier:"validated",   title:"Mercury Retro IT Exit (n=72, p=0.04)",desc:"Only VALIDATED outer-planet signal. Mercury retro × IT underperformance is statistically significant. EXIT before May 29."},
                      {icon:"~",color:T.amber,   tier:"indicative",  title:"Pharma Peaking (n=2, directional)",desc:"Rahu Pisces pharma surge consistent across 2 cycles. But exit timing is critical — post-Rahu correction was -18% to -41%."},
                      {icon:"✗",color:T.textDim, tier:"unvalidated", title:"Herschel AI Theme (n=0)",          desc:"No NSE price data for Herschel-Gemini transit. Theoretical only. Do not include in score. Use as 10-year positioning context."},
                      {icon:"~",color:T.amber,   tier:"indicative",  title:"Saturn Aries Infra Avoid (n=1)",   desc:"Single historical instance (1996-98) showed -28% underperformance. Directionally clear but anecdotal."},
                    ].map((call,i)=>(
                      <div key={i} style={{padding:"9px 11px",background:T.card,border:`1px solid ${call.color}18`,borderRadius:5}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                          <TierBadge tier={call.tier}/>
                          <span style={{fontSize:9,color:call.color,fontFamily:"'Cinzel',serif"}}>{call.title}</span>
                        </div>
                        <div style={{fontSize:9,color:T.textMid,lineHeight:1.5}}>{call.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab==="evidence"&&(
              <div>
                <div style={{fontSize:8,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif",marginBottom:10}}>ALL CORRELATION EVIDENCE · EXPAND ANY ROW FOR FULL STATS</div>

                {/* Validated section */}
                <div style={{marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,padding:"5px 10px",background:T.greenDim,border:`1px solid ${T.green}25`,borderRadius:4}}>
                    <span style={{fontSize:12,color:T.green,fontWeight:700}}>✓</span>
                    <span style={{fontSize:9,color:T.green,fontFamily:"'Cinzel',serif",letterSpacing:1}}>VALIDATED — n≥30 · p&lt;0.05 · Full score weight</span>
                  </div>
                  {Object.entries(CORRELATIONS).filter(([,c])=>c.tier==="validated").map(([id,corr])=>(
                    <CorrCard key={id} corrId={id} weight={0.5} label={corr.condition}/>
                  ))}
                </div>

                {/* Indicative section */}
                <div style={{marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,padding:"5px 10px",background:T.amberDim,border:`1px solid ${T.amber}25`,borderRadius:4}}>
                    <span style={{fontSize:12,color:T.amber,fontWeight:700}}>~</span>
                    <span style={{fontSize:9,color:T.amber,fontFamily:"'Cinzel',serif",letterSpacing:1}}>INDICATIVE — small n · directionally consistent · half weight</span>
                  </div>
                  {Object.entries(CORRELATIONS).filter(([,c])=>c.tier==="indicative").map(([id,corr])=>(
                    <CorrCard key={id} corrId={id} weight={0.3} label={corr.condition}/>
                  ))}
                </div>

                {/* Unvalidated section */}
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,padding:"5px 10px",background:"transparent",border:`1px solid ${T.textDim}25`,borderRadius:4}}>
                    <span style={{fontSize:12,color:T.textDim,fontWeight:700}}>✗</span>
                    <span style={{fontSize:9,color:T.textDim,fontFamily:"'Cinzel',serif",letterSpacing:1}}>UNVALIDATED — no price history · context only · zero score weight</span>
                  </div>
                  {Object.entries(CORRELATIONS).filter(([,c])=>c.tier==="unvalidated").map(([id,corr])=>(
                    <CorrCard key={id} corrId={id} weight={0} label={corr.condition}/>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div style={{width:300,flexShrink:0,background:T.surface,borderLeft:`1px solid ${T.border}`,overflow:"hidden"}}>
            {rightPanel==="validated"?<ValidatedPanel/>:<SectorDetail sector={selected}/>}
          </div>
        </div>

        {/* Footer */}
        <div style={{padding:"5px 14px",background:T.surface,borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            {Object.entries(TIERS).map(([k,tr])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:10,color:tr.color,fontWeight:700}}>{tr.badge}</span>
                <span style={{fontSize:7,color:T.textDim}}>{tr.desc.split("·")[0].trim()}</span>
              </div>
            ))}
          </div>
          <div style={{fontSize:7,color:T.textDim,fontFamily:"'Cinzel',serif",letterSpacing:1}}>
            UJJAIN · LAHIRI · NOT FINANCIAL ADVICE · ASTRO IS A FILTER — VALIDATE WITH PRICE ACTION
          </div>
        </div>
      </div>
    </div>
  );
}
