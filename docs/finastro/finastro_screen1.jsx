import { useState, useEffect, useRef, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// FINASTRO · SCREEN 1 · TODAY
// The trader's primary daily screen
// Ujjain ref · Lahiri Ayanamsa · IST · Sidereal
// ═══════════════════════════════════════════════════════════════════════════

// ─── THEME ───────────────────────────────────────────────────────────────────
const T = {
  bg:        "#05080F",
  surface:   "#080D18",
  panel:     "#0A1020",
  border:    "#141E30",
  borderHi:  "#1E2E48",
  gold:      "#C9A455",
  goldDim:   "#C9A45530",
  teal:      "#2EC4B6",
  green:     "#3DBA7E",
  greenDim:  "#3DBA7E18",
  red:       "#E05252",
  redDim:    "#E0525218",
  amber:     "#E09840",
  amberDim:  "#E0984018",
  purple:    "#9B6DCA",
  purpleDim: "#9B6DCA20",
  moonBlue:  "#8AB4C8",
  text:      "#B8CCE0",
  textDim:   "#506070",
  textMid:   "#7890A8",
};

// ─── PLANET COLORS ────────────────────────────────────────────────────────────
const P = {
  sun:     { s:"☉", c:"#F5C842", n:"Sun" },
  moon:    { s:"☽", c:"#8AB4C8", n:"Moon" },
  mercury: { s:"☿", c:"#8EC88E", n:"Mercury" },
  venus:   { s:"♀", c:"#E8A0C0", n:"Venus" },
  mars:    { s:"♂", c:"#E06040", n:"Mars" },
  jupiter: { s:"♃", c:"#C9A455", n:"Jupiter" },
  saturn:  { s:"♄", c:"#A89870", n:"Saturn" },
  rahu:    { s:"☊", c:"#8060C0", n:"Rahu" },
  ketu:    { s:"☋", c:"#607080", n:"Ketu" },
};

const SIGNS = [
  {n:"Aries",s:"♈",c:"#E06040"},{n:"Taurus",s:"♉",c:"#8BC34A"},
  {n:"Gemini",s:"♊",c:"#4FC3F7"},{n:"Cancer",s:"♋",c:"#2EC4B6"},
  {n:"Leo",s:"♌",c:"#FFD54F"},{n:"Virgo",s:"♍",c:"#A5D6A7"},
  {n:"Libra",s:"♎",c:"#F48FB1"},{n:"Scorpio",s:"♏",c:"#CE93D8"},
  {n:"Sagittarius",s:"♐",c:"#FFCC02"},{n:"Capricorn",s:"♑",c:"#90A4AE"},
  {n:"Aquarius",s:"♒",c:"#80DEEA"},{n:"Pisces",s:"♓",c:"#B39DDB"},
];

// ─── TODAY'S DATA (02 May 2026) ───────────────────────────────────────────────
const TODAY = {
  date:        "02 May 2026",
  vaar:        "Saturday",
  moonPhase:   "🌒",
  moonAngle:   52,
  moonSign:    "Pisces",
  moonSignIdx: 11,
  paksha:      "Shukla",
  tithi:       { id:9,  name:"Navami",    quality:2, desc:"Moderate energy — selective entries" },
  nakshatra:   { id:14, name:"Chitra",    quality:2, lord:"mars", desc:"Brilliant, creative, architectural" },
  yoga:        { id:16, name:"Siddhi",    quality:3, desc:"Achievement — most favorable yoga" },
  sessionQ:    2,   // Overall session quality
  tithiChange:    { time:"11:20", min:680 },
  nakshatraChange: null,
  yogaChange:  { time:"14:30", min:870 },
  rahuKala:    { start:"09:00", end:"10:30", sMin:540, eMin:630 },
  abhijit:     { start:"11:48", end:"12:36", sMin:708, eMin:756 },
  gulikaKala:  { start:"06:00", end:"07:30", sMin:360, eMin:450 },
  planets: [
    { pk:"jupiter", sign:"Cancer",  status:"Direct",   note:"Exalted ✦", strong:true },
    { pk:"mars",    sign:"Cancer",  status:"Direct",   note:"Debilitated", weak:true },
    { pk:"mercury", sign:"Taurus",  status:"Direct",   note:"Clear" },
    { pk:"venus",   sign:"Aries",   status:"Direct",   note:"Post-retro" },
    { pk:"saturn",  sign:"Pisces",  status:"Direct",   note:"Transitioning" },
    { pk:"rahu",    sign:"Pisces",  status:"Retro",    note:"Pharma" },
  ],
  dayEvents: [
    { planet:"jupiter", type:"Jupiter in Cancer", time:null, bias:"bullish", desc:"Exalted Jupiter — broad bull backdrop active all day. FMCG/PSU Banks favored." },
  ],
  upcomingEvents: [
    { planet:"venus",   date:"05 May", type:"Venus Direct",        bias:"bullish", daysAway:3  },
    { planet:"jupiter", date:"14 May", type:"Jupiter → Cancer ♋",  bias:"bullish", daysAway:12 },
    { planet:"mars",    date:"19 Jun", type:"Mars ☌ Jupiter",       bias:"bullish", daysAway:48 },
  ],
};

// ─── DUMMY OHLCV DATA (intraday, 5-min candles 09:15–15:30 IST) ──────────────
function generateCandles() {
  const candles = [];
  let price = 22480;
  const times = [];
  for (let m = 555; m < 930; m += 5) {
    const h = Math.floor(m/60), mn = m%60;
    times.push({ min:m, label:`${String(h).padStart(2,"0")}:${String(mn).padStart(2,"0")}` });
  }
  // Simulate a realistic NIFTY intraday with Rahu Kala trap + Abhijit breakout
  times.forEach((t, i) => {
    const inRahu  = t.min >= 540 && t.min < 630;   // 09:00–10:30
    const inAbhijit = t.min >= 708 && t.min < 756; // 11:48–12:36
    const postChange = t.min >= 680;               // after Tithi change 11:20
    let drift = (Math.random() - 0.48) * 18;
    if (inRahu)    drift = (Math.random() - 0.55) * 22; // choppy/down in Rahu
    if (inAbhijit) drift = Math.abs(Math.random() * 25); // bullish in Abhijit
    if (postChange && t.min < 708) drift = (Math.random() - 0.5) * 15;
    if (t.min >= 820 && t.min < 870) drift = (Math.random()-0.48)*20;
    if (t.min >= 870) drift = (Math.random()-0.52)*18; // after Yoga change caution
    const open  = price;
    const close = price + drift;
    const high  = Math.max(open, close) + Math.random() * 12;
    const low   = Math.min(open, close) - Math.random() * 12;
    const vol   = Math.round(800000 + Math.random()*400000 + (inAbhijit?300000:0) + (inRahu?-200000:0));
    candles.push({ ...t, open, high, low, close, vol, bull: close>=open });
    price = close;
  });
  return candles;
}
const CANDLES = generateCandles();

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const SS=555, SE=930; // session mins
function qC(q){return q===3?T.green:q===2?T.amber:q===1?"#E09040":T.red;}
function qL(q){return q===3?"FAVORABLE":q===2?"NEUTRAL":q===1?"CAUTION":"AVOID";}
function qBg(q){return q===3?T.greenDim:q===2?T.amberDim:q===1?"#E0904018":T.redDim;}
function mToX(m,w){return((m-SS)/(SE-SS))*w;}
function nowMin(){
  // Simulate current time at 10:15 IST for demo
  return 615; // 10:15
}

// ─── COUNTDOWN ────────────────────────────────────────────────────────────────
function useCountdown(targetMin) {
  const [remaining, setRemaining] = useState(targetMin - nowMin());
  useEffect(() => {
    const t = setInterval(() => setRemaining(prev => Math.max(0, prev - 1/60)), 1000);
    return () => clearInterval(t);
  }, [targetMin]);
  const mins = Math.floor(remaining);
  const secs = Math.floor((remaining % 1) * 60);
  return `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
}

// ─── PLANET PILL ──────────────────────────────────────────────────────────────
function PlanetPill({ pk, label, size=18 }) {
  const pl = P[pk];
  if (!pl) return null;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5 }}>
      <span style={{
        width:size, height:size, borderRadius:"50%", flexShrink:0,
        background:`radial-gradient(circle at 35% 35%, ${pl.c}30, ${pl.c}08)`,
        border:`1px solid ${pl.c}50`, display:"flex", alignItems:"center",
        justifyContent:"center", fontSize:size*0.55, color:pl.c,
        boxShadow:`0 0 ${size*0.4}px ${pl.c}30`,
      }}>{pl.s}</span>
      {label && <span style={{ fontSize:10, color:pl.c, fontFamily:"'Cinzel',serif", letterSpacing:0.5 }}>{label}</span>}
    </span>
  );
}

// ─── TOP STRIP ────────────────────────────────────────────────────────────────
function TopStrip() {
  const nowCountdown = useCountdown(TODAY.tithiChange.min);
  const yogaCountdown = useCountdown(TODAY.yogaChange.min);
  const sign = SIGNS[TODAY.moonSignIdx];
  const q = TODAY.sessionQ;

  return (
    <div style={{
      display:"flex", alignItems:"stretch", gap:1,
      background:T.surface, borderBottom:`1px solid ${T.border}`,
      height:52,
    }}>
      {/* Session quality */}
      <div style={{
        padding:"0 20px", display:"flex", alignItems:"center", gap:12,
        background:`${qC(q)}10`, borderRight:`2px solid ${qC(q)}40`,
        minWidth:180,
      }}>
        <div style={{
          width:36, height:36, borderRadius:"50%",
          background:`${qC(q)}20`, border:`1.5px solid ${qC(q)}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:16, color:qC(q), boxShadow:`0 0 14px ${qC(q)}40`,
        }}>
          {q===3?"✦":q===2?"◎":q===1?"⚠":"✕"}
        </div>
        <div>
          <div style={{ fontSize:13, fontFamily:"'Cinzel',serif", fontWeight:700, color:qC(q), letterSpacing:2, lineHeight:1 }}>{qL(q)}</div>
          <div style={{ fontSize:9, color:T.textDim, marginTop:3, letterSpacing:1 }}>SESSION QUALITY</div>
        </div>
      </div>

      {/* Moon */}
      <div style={{ padding:"0 16px", display:"flex", alignItems:"center", gap:10, borderRight:`1px solid ${T.border}`, minWidth:140 }}>
        <span style={{ fontSize:22, lineHeight:1 }}>{TODAY.moonPhase}</span>
        <div>
          <div style={{ fontSize:11, color:sign.c, fontFamily:"'Cinzel',serif" }}>{sign.s} {TODAY.moonSign}</div>
          <div style={{ fontSize:9, color:T.textDim, marginTop:2 }}>{TODAY.paksha} · {TODAY.tithi.name}</div>
        </div>
      </div>

      {/* Yoga */}
      <div style={{ padding:"0 16px", display:"flex", alignItems:"center", gap:8, borderRight:`1px solid ${T.border}`, minWidth:140 }}>
        <div>
          <div style={{ fontSize:11, color:T.green, fontFamily:"'Cinzel',serif" }}>{TODAY.yoga.name}</div>
          <div style={{ fontSize:9, color:T.textDim, marginTop:2 }}>YOGA · FAVORABLE</div>
        </div>
      </div>

      {/* Next changeover countdown */}
      <div style={{ padding:"0 16px", display:"flex", alignItems:"center", gap:10, borderRight:`1px solid ${T.border}`, background:"#C9A45508", minWidth:180 }}>
        <span style={{ fontSize:16, color:T.gold }}>⚡</span>
        <div>
          <div style={{ fontSize:11, fontFamily:"'Cinzel',serif", color:T.gold }}>Tithi → Dashami</div>
          <div style={{ fontSize:9, color:T.textDim, marginTop:2 }}>CHANGES AT 11:20 · IN <span style={{ color:T.gold, fontFamily:"monospace" }}>{nowCountdown}</span></div>
        </div>
      </div>

      {/* Yoga changeover */}
      <div style={{ padding:"0 16px", display:"flex", alignItems:"center", gap:10, borderRight:`1px solid ${T.border}`, background:"#E0984008", minWidth:160 }}>
        <span style={{ fontSize:16, color:T.amber }}>⚡</span>
        <div>
          <div style={{ fontSize:11, fontFamily:"'Cinzel',serif", color:T.amber }}>Yoga → Vriddhi</div>
          <div style={{ fontSize:9, color:T.textDim, marginTop:2 }}>CHANGES AT 14:30 · IN <span style={{ color:T.amber, fontFamily:"monospace" }}>{yogaCountdown}</span></div>
        </div>
      </div>

      {/* Rahu Kala */}
      <div style={{ padding:"0 16px", display:"flex", alignItems:"center", gap:8, borderRight:`1px solid ${T.border}`, background:"#E0525208" }}>
        <span style={{ fontSize:14, color:T.red }}>☊</span>
        <div>
          <div style={{ fontSize:11, fontFamily:"'Cinzel',serif", color:T.red }}>Rahu Kala</div>
          <div style={{ fontSize:9, color:"#E0525280", marginTop:2 }}>09:00–10:30 IST</div>
        </div>
      </div>

      {/* Abhijit */}
      <div style={{ padding:"0 16px", display:"flex", alignItems:"center", gap:8, borderRight:`1px solid ${T.border}`, background:"#3DBA7E08" }}>
        <span style={{ fontSize:14, color:T.green }}>☀</span>
        <div>
          <div style={{ fontSize:11, fontFamily:"'Cinzel',serif", color:T.green }}>Abhijit</div>
          <div style={{ fontSize:9, color:`${T.green}80`, marginTop:2 }}>11:48–12:36 IST</div>
        </div>
      </div>

      {/* Date/time */}
      <div style={{ marginLeft:"auto", padding:"0 20px", display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:12, fontFamily:"'Cinzel',serif", color:T.text }}>02 MAY 2026</div>
          <div style={{ fontSize:9, color:T.textDim, marginTop:2 }}>SATURDAY · UJJAIN REF</div>
        </div>
      </div>
    </div>
  );
}

// ─── PANCHANG TIME BAND ───────────────────────────────────────────────────────
function PanchangBand({ width }) {
  const now = nowMin();
  const q = TODAY.sessionQ;
  const changes = [
    TODAY.tithiChange && { min:TODAY.tithiChange.min, label:"Tithi", color:T.gold },
    TODAY.yogaChange  && { min:TODAY.yogaChange.min,  label:"Yoga",  color:T.amber },
  ].filter(Boolean);

  // Quality segments split at changeover times
  const splitMins = changes.map(c=>c.min).filter(m=>m>SS&&m<SE).sort((a,b)=>a-b);
  const segments = [];
  let prev = SS;
  for (const m of splitMins) { segments.push({start:prev, end:m, q}); prev=m; }
  segments.push({start:prev, end:SE, q: Math.max(0, q-1)});

  return (
    <div style={{ position:"relative", height:28 }}>
      {/* Base quality segments */}
      {segments.map((seg,i) => (
        <div key={i} style={{
          position:"absolute",
          left:mToX(seg.start, width),
          width:mToX(seg.end, width)-mToX(seg.start, width),
          height:"100%",
          background:`${qC(seg.q)}14`,
          borderBottom:`2px solid ${qC(seg.q)}50`,
        }}/>
      ))}

      {/* Rahu Kala — hatched red */}
      {TODAY.rahuKala.sMin < SE && TODAY.rahuKala.eMin > SS && (
        <div style={{
          position:"absolute",
          left:mToX(Math.max(TODAY.rahuKala.sMin, SS), width),
          width:mToX(Math.min(TODAY.rahuKala.eMin, SE), width)-mToX(Math.max(TODAY.rahuKala.sMin, SS), width),
          height:"100%",
          background:"repeating-linear-gradient(45deg,#E0525222 0,#E0525222 3px,#E0101008 3px,#E0101008 7px)",
          borderLeft:`2px solid ${T.red}`,
          borderRight:`2px solid ${T.red}60`,
        }}>
          <div style={{ padding:"4px 6px", fontSize:8, color:T.red, fontFamily:"'Cinzel',serif", letterSpacing:0.5, display:"flex", alignItems:"center", gap:4 }}>
            <span>☊</span><span>RAHU KALA</span>
          </div>
        </div>
      )}

      {/* Abhijit — green */}
      <div style={{
        position:"absolute",
        left:mToX(TODAY.abhijit.sMin, width),
        width:mToX(TODAY.abhijit.eMin, width)-mToX(TODAY.abhijit.sMin, width),
        height:"100%",
        background:`${T.green}18`,
        borderLeft:`2px solid ${T.green}80`,
        borderRight:`2px solid ${T.green}40`,
      }}>
        <div style={{ padding:"4px 6px", fontSize:8, color:T.green, fontFamily:"'Cinzel',serif", letterSpacing:0.5, display:"flex", alignItems:"center", gap:4 }}>
          <span>☀</span><span>ABHIJIT</span>
        </div>
      </div>

      {/* Changeover verticals */}
      {changes.map((ch, i) => {
        const x = mToX(ch.min, width);
        if (x <= 0 || x >= width) return null;
        return (
          <div key={i} style={{ position:"absolute", left:x, top:0, width:1.5, height:"100%", background:ch.color, boxShadow:`0 0 4px ${ch.color}` }}>
            <div style={{ position:"absolute", top:-18, left:-18, fontSize:7, color:ch.color, fontFamily:"'Cinzel',serif", whiteSpace:"nowrap", background:T.bg, padding:"1px 4px", border:`1px solid ${ch.color}40`, borderRadius:2 }}>
              {ch.label} ⚡
            </div>
          </div>
        );
      })}

      {/* NOW line */}
      <div style={{
        position:"absolute", left:mToX(now, width), top:-4, bottom:-4, width:1.5,
        background:T.gold, boxShadow:`0 0 6px ${T.gold}`,
        animation:"nowPulse 2s ease-in-out infinite",
      }}>
        <div style={{ position:"absolute", top:-18, left:-10, fontSize:7, color:T.gold, fontFamily:"'Cinzel',serif", background:T.bg, padding:"1px 4px", border:`1px solid ${T.gold}60`, borderRadius:2, whiteSpace:"nowrap" }}>NOW</div>
      </div>
    </div>
  );
}

// ─── CANDLESTICK CHART ────────────────────────────────────────────────────────
function CandleChart({ width, height=220 }) {
  const [hovered, setHovered] = useState(null);
  const now = nowMin();

  const prices = CANDLES.flatMap(c=>[c.high,c.low]);
  const minP = Math.min(...prices) - 20;
  const maxP = Math.max(...prices) + 20;
  const pRange = maxP - minP;
  const totalCandles = CANDLES.length;
  const candleW = width / totalCandles;
  const bodyW = Math.max(candleW * 0.55, 2);

  function pToY(p) { return height - ((p-minP)/pRange)*height; }
  function cToX(i) { return (i / totalCandles) * width + candleW/2; }

  // Determine zone for each candle
  function getCandleZone(c) {
    if (c.min >= TODAY.rahuKala.sMin && c.min < TODAY.rahuKala.eMin) return "rahu";
    if (c.min >= TODAY.abhijit.sMin && c.min < TODAY.abhijit.eMin) return "abhijit";
    if (c.min >= TODAY.yogaChange.min) return "caution";
    if (c.min >= TODAY.tithiChange.min) return "neutral";
    return "normal";
  }

  // Volume
  const maxVol = Math.max(...CANDLES.map(c=>c.vol));

  return (
    <div style={{ position:"relative" }}>
      {/* Price + volume chart */}
      <svg width={width} height={height} style={{ display:"block", overflow:"visible" }}
        onMouseLeave={() => setHovered(null)}>

        {/* Zone background tints */}
        {/* Rahu Kala bg */}
        {(() => {
          const rk = TODAY.rahuKala;
          const startI = CANDLES.findIndex(c=>c.min>=rk.sMin);
          const endI   = CANDLES.findIndex(c=>c.min>=rk.eMin);
          if (startI<0) return null;
          const x1 = cToX(startI)-candleW/2;
          const x2 = endI>0 ? cToX(endI)-candleW/2 : width;
          return <rect x={x1} y={0} width={x2-x1} height={height} fill={`${T.red}08`}/>;
        })()}

        {/* Abhijit bg */}
        {(() => {
          const ab = TODAY.abhijit;
          const startI = CANDLES.findIndex(c=>c.min>=ab.sMin);
          const endI   = CANDLES.findIndex(c=>c.min>=ab.eMin);
          if (startI<0) return null;
          const x1 = cToX(startI)-candleW/2;
          const x2 = endI>0 ? cToX(endI)-candleW/2 : width;
          return <rect x={x1} y={0} width={x2-x1} height={height} fill={`${T.green}0A`}/>;
        })()}

        {/* Post Tithi-change bg */}
        {(() => {
          const startI = CANDLES.findIndex(c=>c.min>=TODAY.tithiChange.min);
          if (startI<0) return null;
          const x = cToX(startI)-candleW/2;
          return <rect x={x} y={0} width={width-x} height={height} fill={`${T.amber}06`}/>;
        })()}

        {/* Post Yoga-change bg */}
        {(() => {
          const startI = CANDLES.findIndex(c=>c.min>=TODAY.yogaChange.min);
          if (startI<0) return null;
          const x = cToX(startI)-candleW/2;
          return <rect x={x} y={0} width={width-x} height={height} fill={`${T.red}06`}/>;
        })()}

        {/* Grid lines */}
        {[0.25,0.5,0.75].map((f,i) => {
          const y = height * f;
          const price = maxP - f * pRange;
          return (
            <g key={i}>
              <line x1={0} y1={y} x2={width} y2={y} stroke={T.border} strokeWidth={0.5}/>
              <text x={4} y={y-3} fontSize={7} fill={T.textDim} fontFamily="monospace">{Math.round(price)}</text>
            </g>
          );
        })}

        {/* Candles */}
        {CANDLES.map((c, i) => {
          const x = cToX(i);
          const zone = getCandleZone(c);
          const isFuture = c.min > now;
          const bullC = zone==="rahu"?`${T.red}90`:zone==="abhijit"?`${T.teal}`:T.green;
          const bearC = zone==="rahu"?T.red:zone==="abhijit"?`${T.teal}90`:T.red;
          const wickC = c.bull ? bullC : bearC;
          const bodyColor = isFuture ? `${c.bull?T.green:T.red}30` : c.bull ? bullC : bearC;
          const opacity = isFuture ? 0.35 : 1;

          return (
            <g key={i} opacity={opacity}
              onMouseEnter={() => setHovered({ ...c, x, i })}
              style={{ cursor:"crosshair" }}>
              {/* Wick */}
              <line x1={x} y1={pToY(c.high)} x2={x} y2={pToY(c.low)}
                stroke={wickC} strokeWidth={0.8} opacity={isFuture?0.3:0.7}/>
              {/* Body */}
              <rect
                x={x - bodyW/2}
                y={pToY(Math.max(c.open, c.close))}
                width={bodyW}
                height={Math.max(1, Math.abs(pToY(c.open)-pToY(c.close)))}
                fill={bodyColor}
                rx={0.5}
              />
            </g>
          );
        })}

        {/* Changeover verticals on chart */}
        {[
          {m:TODAY.tithiChange.min, color:T.gold, label:"Tithi ⚡"},
          {m:TODAY.yogaChange.min,  color:T.amber, label:"Yoga ⚡"},
        ].map((ch, i) => {
          const startI = CANDLES.findIndex(c=>c.min>=ch.m);
          if (startI<0) return null;
          const x = cToX(startI);
          return (
            <g key={i}>
              <line x1={x} y1={0} x2={x} y2={height} stroke={ch.color} strokeWidth={1} strokeDasharray="3,3" opacity={0.7}/>
              <rect x={x+2} y={4} width={36} height={12} fill={T.bg} rx={2}/>
              <text x={x+4} y={13} fontSize={7} fill={ch.color} fontFamily="Cinzel, serif">{ch.label}</text>
            </g>
          );
        })}

        {/* NOW vertical */}
        {(() => {
          const nowI = CANDLES.findIndex(c=>c.min>now);
          if (nowI<0) return null;
          const x = cToX(nowI);
          return (
            <g>
              <line x1={x} y1={0} x2={x} y2={height} stroke={T.gold} strokeWidth={1.5} opacity={0.9}/>
              <text x={x+3} y={14} fontSize={7} fill={T.gold} fontFamily="Cinzel, serif">NOW</text>
            </g>
          );
        })()}

        {/* Hover tooltip */}
        {hovered && (
          <g>
            <line x1={hovered.x} y1={0} x2={hovered.x} y2={height} stroke={T.moonBlue} strokeWidth={0.5} strokeDasharray="2,2"/>
            <rect x={hovered.x > width-110 ? hovered.x-108 : hovered.x+4} y={4} width={104} height={52} fill={T.panel} stroke={T.borderHi} strokeWidth={0.5} rx={4}/>
            <text x={hovered.x > width-110 ? hovered.x-104 : hovered.x+8} y={16} fontSize={7} fill={T.textDim} fontFamily="Cinzel, serif">{hovered.label}</text>
            <text x={hovered.x > width-110 ? hovered.x-104 : hovered.x+8} y={26} fontSize={7} fill={hovered.bull?T.green:T.red} fontFamily="monospace">O:{Math.round(hovered.open)} C:{Math.round(hovered.close)}</text>
            <text x={hovered.x > width-110 ? hovered.x-104 : hovered.x+8} y={36} fontSize={7} fill={T.textMid} fontFamily="monospace">H:{Math.round(hovered.high)} L:{Math.round(hovered.low)}</text>
            <text x={hovered.x > width-110 ? hovered.x-104 : hovered.x+8} y={46} fontSize={7} fill={T.textDim} fontFamily="monospace">Vol:{(hovered.vol/1000).toFixed(0)}K</text>
          </g>
        )}
      </svg>

      {/* Volume bars */}
      <svg width={width} height={40} style={{ display:"block" }}>
        {CANDLES.map((c,i)=>{
          const x = cToX(i);
          const h = (c.vol/maxVol)*36;
          const zone = getCandleZone(c);
          const isFuture = c.min > now;
          const color = zone==="rahu"?T.red:zone==="abhijit"?T.teal:c.bull?T.green:T.red;
          return(
            <rect key={i} x={x-bodyW/2} y={40-h} width={bodyW} height={h}
              fill={color} opacity={isFuture?0.15:0.5} rx={0.5}/>
          );
        })}
        <text x={4} y={10} fontSize={7} fill={T.textDim} fontFamily="Cinzel, serif">VOLUME</text>
      </svg>
    </div>
  );
}

// ─── TIME AXIS ────────────────────────────────────────────────────────────────
function TimeAxis({ width }) {
  const labels = ["09:15","10:00","10:30","11:00","11:20","11:48","12:00","12:36","13:00","14:00","14:30","15:00","15:30"];
  const important = ["09:15","10:30","11:20","11:48","12:36","14:30","15:30"];
  return (
    <div style={{ position:"relative", height:20, borderTop:`1px solid ${T.border}` }}>
      {labels.map(t => {
        const [h,m] = t.split(":").map(Number);
        const min = h*60+m;
        const x = mToX(min, width);
        const isImportant = important.includes(t);
        return (
          <div key={t} style={{ position:"absolute", left:x, transform:"translateX(-50%)", top:4 }}>
            <span style={{ fontSize:isImportant?8:7, color:isImportant?T.textMid:T.textDim, fontFamily:isImportant?"'Cinzel',serif":"monospace", letterSpacing:isImportant?0.5:0, whiteSpace:"nowrap" }}>{t}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── RIGHT SIDEBAR ────────────────────────────────────────────────────────────
function Sidebar() {
  const sign = SIGNS[TODAY.moonSignIdx];
  const q = TODAY.sessionQ;

  return (
    <div style={{ width:260, flexShrink:0, display:"flex", flexDirection:"column", gap:10, padding:"12px 0 12px 12px" }}>

      {/* Today's score */}
      <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:8, padding:14 }}>
        <div style={{ fontSize:8, color:T.textDim, letterSpacing:2, fontFamily:"'Cinzel',serif", marginBottom:10 }}>CONFLUENCE SCORE</div>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
          <div style={{ position:"relative" }}>
            <svg width={64} height={64} style={{ transform:"rotate(135deg)" }}>
              <circle cx={32} cy={32} r={26} fill="none" stroke={T.border} strokeWidth={5} strokeDasharray={`${2*Math.PI*26*0.75} ${2*Math.PI*26}`} strokeLinecap="round"/>
              <circle cx={32} cy={32} r={26} fill="none" stroke={qC(q)} strokeWidth={5}
                strokeDasharray={`${2*Math.PI*26*0.75*(q/4)} ${2*Math.PI*26}`} strokeLinecap="round"
                style={{ filter:`drop-shadow(0 0 4px ${qC(q)})` }}/>
            </svg>
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:16, fontWeight:900, color:qC(q), fontFamily:"'Cinzel',serif" }}>7.2</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize:12, color:qC(q), fontFamily:"'Cinzel',serif", letterSpacing:1 }}>NORMAL</div>
            <div style={{ fontSize:9, color:T.textDim, marginTop:3 }}>out of 10.0</div>
          </div>
        </div>
        {[
          { label:"Panchang",  score:2, max:3, color:T.amber },
          { label:"Planetary", score:3, max:3, color:T.green },
          { label:"Lunar",     score:2, max:3, color:T.moonBlue },
          { label:"Eclipse",   score:3, max:3, color:T.green },
        ].map(row => (
          <div key={row.label} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
            <div style={{ width:60, fontSize:8, color:T.textDim, fontFamily:"'Cinzel',serif", letterSpacing:1 }}>{row.label.toUpperCase()}</div>
            <div style={{ flex:1, height:3, background:T.border, borderRadius:2 }}>
              <div style={{ width:`${(row.score/row.max)*100}%`, height:"100%", background:row.color, borderRadius:2, boxShadow:`0 0 4px ${row.color}60` }}/>
            </div>
            <div style={{ fontSize:8, color:row.color, fontFamily:"monospace", width:20 }}>{row.score}/{row.max}</div>
          </div>
        ))}
      </div>

      {/* Panchang detail */}
      <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:8, padding:14 }}>
        <div style={{ fontSize:8, color:T.textDim, letterSpacing:2, fontFamily:"'Cinzel',serif", marginBottom:10 }}>PANCHANG · UJJAIN</div>
        {[
          { label:"TITHI",     value:TODAY.tithi.name,     sub:`${TODAY.paksha} Paksha`, q:TODAY.tithi.quality,     change:TODAY.tithiChange },
          { label:"NAKSHATRA", value:TODAY.nakshatra.name, sub:`${P[TODAY.nakshatra.lord].s} ${P[TODAY.nakshatra.lord].n} lord`, q:TODAY.nakshatra.quality, change:null },
          { label:"YOGA",      value:TODAY.yoga.name,      sub:"Achievement",             q:TODAY.yoga.quality,      change:TODAY.yogaChange },
        ].map(row => {
          const hasChange = row.change && row.change.min > nowMin() && row.change.min < SE;
          return (
            <div key={row.label} style={{ marginBottom:10, paddingBottom:10, borderBottom:`1px solid ${T.border}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:7, color:T.textDim, letterSpacing:2, fontFamily:"'Cinzel',serif", marginBottom:3 }}>{row.label}</div>
                  <div style={{ fontSize:12, color:T.text, fontFamily:"'Cinzel',serif" }}>{row.value}</div>
                  <div style={{ fontSize:9, color:T.textMid, marginTop:2 }}>{row.sub}</div>
                </div>
                <div style={{ display:"flex", gap:3 }}>
                  {[1,2,3].map(n=>(
                    <div key={n} style={{ width:6, height:6, borderRadius:"50%", background:n<=row.q?qC(row.q):T.border, boxShadow:n<=row.q?`0 0 4px ${qC(row.q)}`:"none" }}/>
                  ))}
                </div>
              </div>
              {hasChange && (
                <div style={{ marginTop:6, padding:"4px 7px", background:`${T.gold}10`, border:`1px solid ${T.gold}30`, borderRadius:4, display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ fontSize:10, color:T.gold }}>⚡</span>
                  <span style={{ fontSize:9, color:T.gold, fontFamily:"'Cinzel',serif" }}>Changes at {row.change.time} IST</span>
                </div>
              )}
            </div>
          );
        })}
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:7, color:T.textDim, letterSpacing:1, fontFamily:"'Cinzel',serif" }}>MOON IN</div>
            <div style={{ fontSize:11, color:sign.c, marginTop:2 }}>{sign.s} {TODAY.moonSign}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:7, color:T.textDim, letterSpacing:1, fontFamily:"'Cinzel',serif" }}>ELEMENT</div>
            <div style={{ fontSize:11, color:T.moonBlue, marginTop:2 }}>Water</div>
          </div>
        </div>
      </div>

      {/* Planet positions */}
      <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:8, padding:14 }}>
        <div style={{ fontSize:8, color:T.textDim, letterSpacing:2, fontFamily:"'Cinzel',serif", marginBottom:10 }}>PLANETS</div>
        {TODAY.planets.map(pos => {
          const pl = P[pos.pk];
          return (
            <div key={pos.pk} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <PlanetPill pk={pos.pk} size={20}/>
              <div style={{ flex:1 }}>
                <span style={{ fontSize:10, color:pos.strong?T.green:pos.weak?T.red:T.text, fontFamily:"'Cinzel',serif" }}>{pl.n}</span>
                <span style={{ fontSize:9, color:T.textDim, marginLeft:6 }}>{pos.sign}</span>
              </div>
              <span style={{ fontSize:8, color:pos.strong?T.green:pos.weak?T.red:T.textDim, fontFamily:"'Cinzel',serif" }}>{pos.note}</span>
            </div>
          );
        })}
      </div>

      {/* Upcoming events */}
      <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:8, padding:14 }}>
        <div style={{ fontSize:8, color:T.textDim, letterSpacing:2, fontFamily:"'Cinzel',serif", marginBottom:10 }}>UPCOMING</div>
        {TODAY.upcomingEvents.map((ev,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, padding:"7px 8px", background:T.surface, borderRadius:5, border:`1px solid ${T.border}` }}>
            <PlanetPill pk={ev.planet} size={22}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:10, color:T.text, fontFamily:"'Cinzel',serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ev.type}</div>
              <div style={{ fontSize:8, color:T.textDim, marginTop:2 }}>{ev.date}</div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ fontSize:14, color:ev.daysAway<=7?T.gold:T.textMid, fontFamily:"'Cinzel',serif", fontWeight:700 }}>{ev.daysAway}</div>
              <div style={{ fontSize:7, color:T.textDim }}>days</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TRADING GUIDANCE FOOTER ──────────────────────────────────────────────────
function GuidanceFooter() {
  const now = nowMin();
  const inRahu = now >= TODAY.rahuKala.sMin && now < TODAY.rahuKala.eMin;
  const inAbhijit = now >= TODAY.abhijit.sMin && now < TODAY.abhijit.eMin;
  const nextChange = now < TODAY.tithiChange.min ? TODAY.tithiChange : TODAY.yogaChange;

  const items = [
    inRahu    && { icon:"☊", color:T.red,   label:"IN RAHU KALA", text:"No new entries. Stand aside. Close weak positions." },
    inAbhijit && { icon:"☀", color:T.green, label:"ABHIJIT ACTIVE", text:"Best execution window. High-conviction entries valid." },
    !inRahu && !inAbhijit && { icon:"◎", color:T.amber, label:"NEUTRAL ZONE", text:"Standard risk management. Quality setups only." },
    { icon:"⚡", color:T.gold,  label:`NEXT CHANGE ${nextChange.time}`, text:`Panchang quality shifts — tighten stops 5 min before.` },
    { icon:"♃", color:P.jupiter.c, label:"JUPITER EXALTED", text:"All-day bull backdrop. FMCG + PSU Banks favored. Trust breakouts." },
  ].filter(Boolean);

  return (
    <div style={{ display:"flex", gap:8, padding:"10px 16px", background:T.surface, borderTop:`1px solid ${T.border}`, overflowX:"auto" }}>
      {items.map((item,i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 12px", background:`${item.color}08`, border:`1px solid ${item.color}25`, borderRadius:6, flexShrink:0 }}>
          <span style={{ fontSize:14, color:item.color, lineHeight:1 }}>{item.icon}</span>
          <div>
            <div style={{ fontSize:8, color:item.color, fontFamily:"'Cinzel',serif", letterSpacing:1, marginBottom:2 }}>{item.label}</div>
            <div style={{ fontSize:10, color:T.textMid, whiteSpace:"nowrap" }}>{item.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCREEN 1
// ═══════════════════════════════════════════════════════════════════════════
export default function FinastroScreen1() {
  const chartRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(800);

  useEffect(() => {
    const update = () => {
      if (chartRef.current) setChartWidth(chartRef.current.offsetWidth - 4);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Text:ital,wght@0,400;1,400&display=swap');
    * { box-sizing:border-box; margin:0; padding:0; }
    body { background:${T.bg}; }
    ::-webkit-scrollbar { width:4px; height:4px; }
    ::-webkit-scrollbar-track { background:${T.bg}; }
    ::-webkit-scrollbar-thumb { background:${T.borderHi}; border-radius:2px; }
    @keyframes nowPulse { 0%,100%{opacity:1;box-shadow:0 0 6px ${T.gold};} 50%{opacity:0.6;box-shadow:0 0 12px ${T.gold};} }
    @keyframes fadeIn { from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);} }
    @keyframes twinkle { from{opacity:0.04;}to{opacity:0.35;} }
  `;

  return (
    <div style={{ background:T.bg, minHeight:"100vh", fontFamily:"'Crimson Text',Georgia,serif", color:T.text, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <style>{css}</style>

      {/* Stars */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
        {Array.from({length:70},(_,i)=>(
          <div key={i} style={{ position:"absolute", left:`${(i*13.7)%100}%`, top:`${(i*9.3)%100}%`, width:(i%3)*0.5+0.5, height:(i%3)*0.5+0.5, borderRadius:"50%", background:"#fff", opacity:0.04+((i%4)*0.04), animation:`twinkle ${2+(i%5)}s ease-in-out infinite alternate`, animationDelay:`${(i%7)*0.5}s` }}/>
        ))}
      </div>

      <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", height:"100vh" }}>

        {/* ── APP HEADER ── */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px", background:T.surface, borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:18, color:T.gold, filter:`drop-shadow(0 0 8px ${T.gold})` }}>✦</span>
            <div>
              <span style={{ fontSize:16, fontFamily:"'Cinzel',serif", fontWeight:900, color:T.gold, letterSpacing:4 }}>FINASTRO</span>
              <span style={{ fontSize:10, color:T.textDim, marginLeft:12, letterSpacing:2 }}>TODAY</span>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:T.green, boxShadow:`0 0 6px ${T.green}`, animation:"nowPulse 2s ease-in-out infinite" }}/>
              <span style={{ fontSize:9, color:T.green, fontFamily:"'Cinzel',serif", letterSpacing:1 }}>LIVE · 10:15 IST</span>
            </div>
            <span style={{ fontSize:9, color:T.textDim, letterSpacing:1 }}>NIFTY · 5-MIN</span>
            <span style={{ fontSize:9, color:T.textDim }}>|</span>
            <span style={{ fontSize:9, color:T.textDim, letterSpacing:1 }}>UJJAIN 23°10'N · LAHIRI</span>
          </div>
        </div>

        {/* ── TOP STRIP (Panchang summary) ── */}
        <div style={{ flexShrink:0 }}>
          <TopStrip/>
        </div>

        {/* ── MAIN BODY ── */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* Chart area */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", padding:"12px 0 0 12px", overflow:"hidden" }}>

            {/* Chart header */}
            <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:10, paddingRight:12 }}>
              <div>
                <span style={{ fontSize:18, fontFamily:"'Cinzel',serif", color:T.text }}>NIFTY 50</span>
                <span style={{ fontSize:12, color:T.textDim, marginLeft:10 }}>NSE · Index</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginLeft:16 }}>
                <span style={{ fontSize:22, fontFamily:"monospace", fontWeight:700, color:T.green }}>22,618</span>
                <span style={{ fontSize:12, color:T.green }}>+138 (+0.62%)</span>
              </div>
              <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
                {/* Zone legend */}
                {[
                  { color:T.red,   label:"Rahu Kala", style:"hatched" },
                  { color:T.green, label:"Abhijit" },
                  { color:T.gold,  label:"Changeover ⚡" },
                  { color:T.textDim, label:"Future candles" },
                ].map((item,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <div style={{ width:10, height:8, background:`${item.color}30`, border:`1px solid ${item.color}60`, borderRadius:1 }}/>
                    <span style={{ fontSize:8, color:T.textDim, fontFamily:"'Cinzel',serif" }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Panchang band */}
            <div ref={chartRef} style={{ paddingRight:12 }}>
              <div style={{ marginBottom:4 }}>
                <PanchangBand width={chartWidth}/>
              </div>

              {/* Main candle chart */}
              <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:"6px 6px 0 0", overflow:"hidden" }}>
                <CandleChart width={chartWidth} height={220}/>
              </div>

              {/* Time axis */}
              <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderTop:"none", borderRadius:"0 0 6px 6px", paddingTop:2 }}>
                <TimeAxis width={chartWidth}/>
              </div>
            </div>

            {/* Moon phase mini strip */}
            <div style={{ marginTop:8, paddingRight:12, display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:8, color:T.textDim, fontFamily:"'Cinzel',serif", letterSpacing:1, flexShrink:0 }}>☽ MOON</span>
              <div style={{ flex:1, height:4, background:T.border, borderRadius:2, overflow:"hidden" }}>
                <div style={{ width:`${(TODAY.moonAngle/360)*100}%`, height:"100%", background:`linear-gradient(to right, ${T.moonBlue}40, ${T.moonBlue})`, borderRadius:2 }}/>
              </div>
              <span style={{ fontSize:8, color:T.moonBlue, fontFamily:"'Cinzel',serif" }}>{TODAY.moonPhase} {Math.round(TODAY.moonAngle)}° · Waxing</span>
            </div>

          </div>

          {/* Right sidebar */}
          <Sidebar/>
        </div>

        {/* ── GUIDANCE FOOTER ── */}
        <div style={{ flexShrink:0 }}>
          <GuidanceFooter/>
        </div>
      </div>
    </div>
  );
}
