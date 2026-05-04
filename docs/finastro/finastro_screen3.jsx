import { useState, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// FINASTRO · SCREEN 3 · MONTHLY CONFLUENCE CALENDAR
// Pattern recognition at a glance — both streams in one view
// Ujjain ref · Lahiri Ayanamsa · IST · Sidereal
// ═══════════════════════════════════════════════════════════════════════════

const T = {
  bg:       "#04070E",
  surface:  "#07090F",
  panel:    "#090C16",
  card:     "#0B0F1C",
  cardHi:   "#0E1422",
  border:   "#121B2C",
  borderHi: "#1A2840",
  gold:     "#C9A455",
  goldDim:  "#C9A45520",
  teal:     "#2ABFB0",
  green:    "#3DBA7E",
  red:      "#E05252",
  amber:    "#E09840",
  purple:   "#9B6DCA",
  moon:     "#8AB4C8",
  text:     "#B0C8E0",
  textMid:  "#6080A0",
  textDim:  "#3A5060",
};

const P = {
  sun:     { s:"☉", c:"#F5C842", n:"Sun"      },
  moon:    { s:"☽", c:"#8AB4C8", n:"Moon"     },
  mercury: { s:"☿", c:"#8EC88E", n:"Mercury"  },
  venus:   { s:"♀", c:"#E8A0C0", n:"Venus"    },
  mars:    { s:"♂", c:"#E06040", n:"Mars"     },
  jupiter: { s:"♃", c:"#C9A455", n:"Jupiter"  },
  saturn:  { s:"♄", c:"#A89870", n:"Saturn"   },
  rahu:    { s:"☊", c:"#8060C0", n:"Rahu"     },
  ketu:    { s:"☋", c:"#607080", n:"Ketu"     },
};

const SIGNS = [
  {n:"Aries",s:"♈",c:"#E06040",e:"Fire"},{n:"Taurus",s:"♉",c:"#8BC34A",e:"Earth"},
  {n:"Gemini",s:"♊",c:"#4FC3F7",e:"Air"},{n:"Cancer",s:"♋",c:"#2ABFB0",e:"Water"},
  {n:"Leo",s:"♌",c:"#FFD54F",e:"Fire"},{n:"Virgo",s:"♍",c:"#A5D6A7",e:"Earth"},
  {n:"Libra",s:"♎",c:"#F48FB1",e:"Air"},{n:"Scorpio",s:"♏",c:"#CE93D8",e:"Water"},
  {n:"Sagittarius",s:"♐",c:"#FFCC02",e:"Fire"},{n:"Capricorn",s:"♑",c:"#90A4AE",e:"Earth"},
  {n:"Aquarius",s:"♒",c:"#80DEEA",e:"Air"},{n:"Pisces",s:"♓",c:"#B39DDB",e:"Water"},
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function qC(q){return q===3?T.green:q===2?T.amber:q===1?"#E09040":T.red;}
function qBg(q){return q===3?"#3DBA7E10":q===2?"#E0984010":q===1?"#E0904010":"#E0525210";}
function qL(q){return q===3?"Favorable":q===2?"Neutral":q===1?"Caution":"Avoid";}
function bC(b){return b==="bullish"?T.green:b==="bearish"?T.red:b==="volatile"?T.purple:T.amber;}

// ─── MAY 2026 CALENDAR DATA ───────────────────────────────────────────────────
// Each trading day: Panchang + dummy OHLCV + events + moon
const MAY_DATA = {
  month: "May", year: 2026,
  backdrop: { planet:"jupiter", sign:"Cancer", note:"Exalted — broad bull bias all month", color:T.gold },
  days: [
    // Non-trading days (weekends / holidays) have trade:false
    { d:1,  dow:"Fri", trade:true,  moonPhase:"🌒", moonAngle:34,  moonSignIdx:11, pq:2, tithi:"Ashtami",   yoga:"Vajra",     tithiChange:null,    yogaChange:null,    close:22380, chg:+0.42, bull:true,  vol:1.1, events:[], confluence:6.2 },
    { d:2,  dow:"Sat", trade:false, moonPhase:"🌒", moonAngle:48,  moonSignIdx:11, pq:2, tithi:"Navami",    yoga:"Siddhi",    tithiChange:"11:20", yogaChange:"14:30", close:null,  chg:null,   bull:null,  vol:null, events:[], confluence:null },
    { d:3,  dow:"Sun", trade:false, moonPhase:"🌒", moonAngle:60,  moonSignIdx:11, pq:null,tithi:null,      yoga:null,        tithiChange:null,    yogaChange:null,    close:null,  chg:null,   bull:null,  vol:null, events:[], confluence:null },
    { d:4,  dow:"Mon", trade:true,  moonPhase:"🌒", moonAngle:74,  moonSignIdx:0,  pq:2, tithi:"Ekadashi",  yoga:"Variyana",  tithiChange:"13:40", yogaChange:"09:50", close:22510, chg:+0.58, bull:true,  vol:1.3, events:[{planet:"mercury",type:"Mercury Direct recovery",bias:"bullish"}], confluence:7.1 },
    { d:5,  dow:"Tue", trade:true,  moonPhase:"🌓", moonAngle:88,  moonSignIdx:0,  pq:3, tithi:"Dwadashi",  yoga:"Shiva",     tithiChange:null,    yogaChange:null,    close:22680, chg:+0.75, bull:true,  vol:1.6, events:[{planet:"venus",type:"Venus Direct ♀",bias:"bullish"}], confluence:9.1 },
    { d:6,  dow:"Wed", trade:true,  moonPhase:"🌓", moonAngle:102, moonSignIdx:1,  pq:2, tithi:"Trayodashi",yoga:"Siddha",    tithiChange:"10:30", yogaChange:"15:00", close:22620, chg:-0.26, bull:false, vol:0.9, events:[], confluence:6.8 },
    { d:7,  dow:"Thu", trade:true,  moonPhase:"🌔", moonAngle:116, moonSignIdx:1,  pq:1, tithi:"Chaturdashi",yoga:"Sadhya",   tithiChange:null,    yogaChange:"11:00", close:22540, chg:-0.35, bull:false, vol:0.8, events:[], confluence:5.2 },
    { d:8,  dow:"Fri", trade:true,  moonPhase:"🌔", moonAngle:130, moonSignIdx:2,  pq:2, tithi:"Purnima",   yoga:"Shubha",    tithiChange:"14:20", yogaChange:"10:15", close:22590, chg:+0.22, bull:true,  vol:0.9, events:[], confluence:6.4 },
    { d:9,  dow:"Sat", trade:false, moonPhase:"🌕", moonAngle:148, moonSignIdx:2,  pq:null,tithi:null,      yoga:null,        tithiChange:null,    yogaChange:null,    close:null,  chg:null,   bull:null,  vol:null, events:[], confluence:null },
    { d:10, dow:"Sun", trade:false, moonPhase:"🌕", moonAngle:164, moonSignIdx:3,  pq:null,tithi:null,      yoga:null,        tithiChange:null,    yogaChange:null,    close:null,  chg:null,   bull:null,  vol:null, events:[], confluence:null },
    { d:11, dow:"Mon", trade:true,  moonPhase:"🌕", moonAngle:178, moonSignIdx:3,  pq:1, tithi:"Moola Nak", yoga:"Vriddhi",   tithiChange:null,    yogaChange:"10:20", close:22460, chg:-0.57, bull:false, vol:1.1, events:[], confluence:4.8 },
    { d:12, dow:"Tue", trade:true,  moonPhase:"🌕", moonAngle:192, moonSignIdx:3,  pq:3, tithi:"Panchami",  yoga:"U.Bhadra",  tithiChange:"12:10", yogaChange:"14:45", close:22720, chg:+1.16, bull:true,  vol:2.1, events:[{planet:"moon",type:"Full Moon",bias:"volatile"}], confluence:8.4 },
    { d:13, dow:"Wed", trade:true,  moonPhase:"🌖", moonAngle:206, moonSignIdx:4,  pq:0, tithi:"Shashthi",  yoga:"Vaidhriti", tithiChange:null,    yogaChange:"11:30", close:22580, chg:-0.62, bull:false, vol:1.4, events:[{planet:"moon",type:"Vaidhriti Yoga",bias:"caution"}], confluence:2.1 },
    { d:14, dow:"Thu", trade:true,  moonPhase:"🌖", moonAngle:220, moonSignIdx:4,  pq:2, tithi:"Saptami",   yoga:"Vishkambha",tithiChange:"10:00", yogaChange:"13:15", close:22940, chg:+1.59, bull:true,  vol:2.8, events:[{planet:"jupiter",type:"Jupiter → Cancer ♋",bias:"bullish"}], confluence:8.9 },
    { d:15, dow:"Fri", trade:true,  moonPhase:"🌖", moonAngle:234, moonSignIdx:5,  pq:3, tithi:"Ashtami",   yoga:"Priti",     tithiChange:null,    yogaChange:"12:45", close:23020, chg:+0.35, bull:true,  vol:1.2, events:[], confluence:7.8 },
    { d:16, dow:"Sat", trade:false, moonPhase:"🌗", moonAngle:248, moonSignIdx:5,  pq:null,tithi:null,      yoga:null,        tithiChange:null,    yogaChange:null,    close:null,  chg:null,   bull:null,  vol:null, events:[], confluence:null },
    { d:17, dow:"Sun", trade:false, moonPhase:"🌗", moonAngle:262, moonSignIdx:6,  pq:null,tithi:null,      yoga:null,        tithiChange:null,    yogaChange:null,    close:null,  chg:null,   bull:null,  vol:null, events:[], confluence:null },
    { d:18, dow:"Mon", trade:true,  moonPhase:"🌗", moonAngle:276, moonSignIdx:6,  pq:3, tithi:"Dashami",   yoga:"Shobhana",  tithiChange:"09:30", yogaChange:"14:00", close:23150, chg:+0.56, bull:true,  vol:1.4, events:[], confluence:8.2 },
    { d:19, dow:"Tue", trade:true,  moonPhase:"🌗", moonAngle:290, moonSignIdx:7,  pq:0, tithi:"Ekadashi",  yoga:"Atiganda",  tithiChange:null,    yogaChange:"11:45", close:22980, chg:-0.74, bull:false, vol:1.6, events:[{planet:"mercury",type:"Mercury Retrograde",bias:"caution"},{planet:"moon",type:"Atiganda Yoga",bias:"caution"}], confluence:1.8 },
    { d:20, dow:"Wed", trade:true,  moonPhase:"🌘", moonAngle:304, moonSignIdx:7,  pq:2, tithi:"Dwadashi",  yoga:"Sukarman",  tithiChange:"13:00", yogaChange:"09:20", close:23080, chg:+0.43, bull:true,  vol:1.0, events:[], confluence:6.1 },
    { d:21, dow:"Thu", trade:true,  moonPhase:"🌘", moonAngle:318, moonSignIdx:8,  pq:3, tithi:"Trayodashi",yoga:"Dhriti",    tithiChange:null,    yogaChange:"12:20", close:23210, chg:+0.56, bull:true,  vol:1.3, events:[], confluence:7.9 },
    { d:22, dow:"Fri", trade:true,  moonPhase:"🌘", moonAngle:332, moonSignIdx:8,  pq:1, tithi:"Chaturdashi",yoga:"Shula",    tithiChange:"10:45", yogaChange:"14:30", close:23140, chg:-0.30, bull:false, vol:0.8, events:[], confluence:5.0 },
    { d:23, dow:"Sat", trade:false, moonPhase:"🌑", moonAngle:346, moonSignIdx:9,  pq:null,tithi:null,      yoga:null,        tithiChange:null,    yogaChange:null,    close:null,  chg:null,   bull:null,  vol:null, events:[], confluence:null },
    { d:24, dow:"Sun", trade:false, moonPhase:"🌑", moonAngle:2,   moonSignIdx:9,  pq:null,tithi:null,      yoga:null,        tithiChange:null,    yogaChange:null,    close:null,  chg:null,   bull:null,  vol:null, events:[], confluence:null },
    { d:25, dow:"Mon", trade:true,  moonPhase:"🌑", moonAngle:14,  moonSignIdx:9,  pq:3, tithi:"Dwitiya",   yoga:"Dhruva",    tithiChange:null,    yogaChange:"13:15", close:23380, chg:+0.77, bull:true,  vol:1.5, events:[], confluence:8.0 },
    { d:26, dow:"Tue", trade:true,  moonPhase:"🌒", moonAngle:28,  moonSignIdx:10, pq:0, tithi:"Tritiya",   yoga:"Vyaghata",  tithiChange:"09:20", yogaChange:"14:45", close:23280, chg:-0.43, bull:false, vol:1.1, events:[{planet:"moon",type:"Vyaghata Yoga",bias:"caution"}], confluence:1.5 },
    { d:27, dow:"Wed", trade:true,  moonPhase:"🌒", moonAngle:40,  moonSignIdx:10, pq:1, tithi:"New Moon",  yoga:"Harshana",  tithiChange:null,    yogaChange:"10:30", close:23240, chg:-0.17, bull:false, vol:0.9, events:[{planet:"moon",type:"New Moon",bias:"neutral"}], confluence:4.2 },
    { d:28, dow:"Thu", trade:true,  moonPhase:"🌒", moonAngle:54,  moonSignIdx:11, pq:3, tithi:"Panchami",  yoga:"Vajra",     tithiChange:"11:45", yogaChange:"13:00", close:23450, chg:+0.90, bull:true,  vol:1.7, events:[], confluence:8.5 },
    { d:29, dow:"Fri", trade:true,  moonPhase:"🌒", moonAngle:66,  moonSignIdx:11, pq:2, tithi:"Shashthi",  yoga:"Siddhi",    tithiChange:null,    yogaChange:null,    close:23390, chg:-0.26, bull:false, vol:0.8, events:[{planet:"mercury",type:"Mercury Retrograde begins",bias:"caution"}], confluence:5.8 },
    { d:30, dow:"Sat", trade:false, moonPhase:"🌒", moonAngle:78,  moonSignIdx:11, pq:null,tithi:null,      yoga:null,        tithiChange:null,    yogaChange:null,    close:null,  chg:null,   bull:null,  vol:null, events:[], confluence:null },
    { d:31, dow:"Sun", trade:false, moonPhase:"🌒", moonAngle:92,  moonSignIdx:0,  pq:null,tithi:null,      yoga:null,        tithiChange:null,    yogaChange:null,    close:null,  chg:null,   bull:null,  vol:null, events:[], confluence:null },
  ]
};

// Month stats
const MONTH_STATS = {
  highConfluence: MAY_DATA.days.filter(d=>d.trade&&d.confluence>=8).length,
  avoidDays:      MAY_DATA.days.filter(d=>d.trade&&d.pq===0).length,
  gradaAEvents:   MAY_DATA.days.filter(d=>d.events.length>0).length,
  bullDays:       MAY_DATA.days.filter(d=>d.trade&&d.bull===true).length,
  bearDays:       MAY_DATA.days.filter(d=>d.trade&&d.bull===false).length,
  monthReturn:    "+4.78%",
};

// ─── MINI CANDLE ──────────────────────────────────────────────────────────────
function MiniCandle({ bull, vol }) {
  if (bull === null) return null;
  const color = bull ? T.green : T.red;
  const h = Math.round(8 + (vol||1) * 4);
  return (
    <svg width={8} height={20} style={{ flexShrink:0 }}>
      {/* wick */}
      <line x1={4} y1={1} x2={4} y2={19} stroke={color} strokeWidth={0.8} opacity={0.5}/>
      {/* body */}
      <rect x={1.5} y={bull?6:4} width={5} height={h>14?14:Math.max(3,h/2)} fill={color} rx={0.5} opacity={0.9}/>
    </svg>
  );
}

// ─── CONFLUENCE METER ─────────────────────────────────────────────────────────
function ConfluenceMeter({ score }) {
  if (score === null) return null;
  const pct = score / 10;
  const color = score >= 8 ? T.green : score >= 6 ? T.amber : score >= 4 ? "#E09040" : T.red;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:3 }}>
      <div style={{ width:28, height:3, background:T.border, borderRadius:2, overflow:"hidden" }}>
        <div style={{ width:`${pct*100}%`, height:"100%", background:color, borderRadius:2 }}/>
      </div>
      <span style={{ fontSize:7, color, fontFamily:"monospace" }}>{score.toFixed(1)}</span>
    </div>
  );
}

// ─── VOLUME BAR ───────────────────────────────────────────────────────────────
function VolumeBar({ vol, pq }) {
  if (vol === null) return null;
  // vol is ratio to avg (1.0 = average)
  const color = vol > 1.5 && pq === 3 ? T.green    // high vol + favorable = breakout
              : vol > 1.5 && pq === 0 ? T.red       // high vol + avoid = trap
              : vol > 1.5             ? T.amber      // high vol + mixed
              : T.textDim;
  const w = Math.min(28, Math.round(vol * 18));
  return (
    <div style={{ display:"flex", alignItems:"center", gap:3 }}>
      <div style={{ width:28, height:2, background:T.border, borderRadius:1 }}>
        <div style={{ width:w, height:"100%", background:color, borderRadius:1, opacity:0.8 }}/>
      </div>
      <span style={{ fontSize:7, color, fontFamily:"monospace" }}>{vol.toFixed(1)}x</span>
    </div>
  );
}

// ─── DAY CELL ────────────────────────────────────────────────────────────────
function DayCell({ day, isToday, onClick, isSelected }) {
  const sign = SIGNS[day.moonSignIdx];
  const hasChange = day.trade && (day.tithiChange || day.yogaChange);
  const hasEvent  = day.events && day.events.length > 0;
  const isHighConf = day.confluence >= 8;
  const isAvoid   = day.pq === 0;
  const isWeekend = !day.trade;

  // Border highlight logic
  const borderColor = isSelected  ? T.gold
    : isToday        ? `${T.teal}80`
    : isHighConf     ? `${T.green}40`
    : isAvoid        ? `${T.red}30`
    : T.border;

  const bgColor = isSelected  ? "#C9A45508"
    : isWeekend      ? T.surface
    : day.pq !== null? qBg(day.pq)
    : T.surface;

  return (
    <div onClick={() => onClick(day)}
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 6,
        padding: "8px 8px 6px",
        cursor: day.trade ? "pointer" : "default",
        minHeight: 100,
        position: "relative",
        transition: "all 0.15s",
        opacity: isWeekend ? 0.45 : 1,
      }}>

      {/* Day number + dow */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:5 }}>
        <div>
          <span style={{ fontSize:14, fontFamily:"'Cinzel',serif", fontWeight:700, color: isToday?T.teal:isWeekend?T.textDim:T.text, lineHeight:1 }}>{day.d}</span>
          <span style={{ fontSize:8, color:T.textDim, marginLeft:4 }}>{day.dow}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          {/* Moon phase */}
          <span style={{ fontSize:12 }}>{day.moonPhase}</span>
          {/* Sign color dot */}
          <div style={{ width:5, height:5, borderRadius:"50%", background:sign.c, opacity:0.7 }}/>
        </div>
      </div>

      {/* Event planets */}
      {hasEvent && (
        <div style={{ display:"flex", gap:3, marginBottom:5, flexWrap:"wrap" }}>
          {day.events.map((ev,i) => {
            const pl = P[ev.planet];
            return (
              <div key={i} style={{
                display:"flex", alignItems:"center", gap:2,
                padding:"1px 5px", borderRadius:3,
                background:`${bC(ev.bias)}15`,
                border:`1px solid ${bC(ev.bias)}30`,
              }}>
                <span style={{ fontSize:9, color:pl?.c }}>{pl?.s}</span>
                <span style={{ fontSize:7, color:bC(ev.bias), fontFamily:"'Cinzel',serif", letterSpacing:0.3 }}>
                  {ev.type.length > 14 ? ev.type.slice(0,14)+"…" : ev.type}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Price + candle */}
      {day.trade && day.close && (
        <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:4 }}>
          <MiniCandle bull={day.bull} vol={day.vol}/>
          <div>
            <div style={{ fontSize:10, fontFamily:"monospace", color:T.text }}>{day.close.toLocaleString()}</div>
            <div style={{ fontSize:8, fontFamily:"monospace", color:day.bull?T.green:T.red }}>
              {day.chg>0?"+":""}{day.chg?.toFixed(2)}%
            </div>
          </div>
        </div>
      )}

      {day.trade && (
        <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
          {/* Confluence score bar */}
          <ConfluenceMeter score={day.confluence}/>
          {/* Volume bar */}
          <VolumeBar vol={day.vol} pq={day.pq}/>
        </div>
      )}

      {/* Panchang quality strip at bottom */}
      {day.pq !== null && (
        <div style={{
          position:"absolute", bottom:0, left:0, right:0, height:3,
          background:qC(day.pq), borderRadius:"0 0 5px 5px", opacity:0.7,
        }}/>
      )}

      {/* Changeover dot */}
      {hasChange && (
        <div style={{
          position:"absolute", top:6, left:6, width:5, height:5,
          borderRadius:"50%", background:T.gold,
          boxShadow:`0 0 4px ${T.gold}`,
        }}/>
      )}

      {/* High confluence glow */}
      {isHighConf && day.trade && (
        <div style={{
          position:"absolute", inset:0, borderRadius:6,
          boxShadow:`inset 0 0 12px ${T.green}08`,
          pointerEvents:"none",
        }}/>
      )}

      {/* TODAY ring */}
      {isToday && (
        <div style={{
          position:"absolute", inset:-1, borderRadius:7,
          border:`1.5px solid ${T.teal}`,
          pointerEvents:"none",
        }}/>
      )}
    </div>
  );
}

// ─── DETAIL PANEL ─────────────────────────────────────────────────────────────
function DayDetail({ day }) {
  if (!day) return (
    <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:28, color:T.textDim, marginBottom:8 }}>◎</div>
        <div style={{ fontSize:11, color:T.textDim, fontFamily:"'Cinzel',serif", letterSpacing:1 }}>SELECT A DAY</div>
        <div style={{ fontSize:9, color:T.textDim, marginTop:4 }}>Click any trading day to see full detail</div>
      </div>
    </div>
  );

  const sign = SIGNS[day.moonSignIdx];
  const q = day.pq;

  return (
    <div style={{ padding:16, animation:"fadeIn 0.2s ease" }}>
      {/* Day header */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, paddingBottom:14, borderBottom:`1px solid ${T.border}` }}>
        <div style={{
          width:44, height:44, borderRadius:"50%",
          background:`${q!==null?qC(q):T.textDim}15`,
          border:`1.5px solid ${q!==null?qC(q):T.border}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:18, color:q!==null?qC(q):T.textDim,
          boxShadow:q!==null?`0 0 10px ${qC(q)}30`:"none",
        }}>
          {day.moonPhase}
        </div>
        <div>
          <div style={{ fontSize:18, fontFamily:"'Cinzel',serif", color:T.text }}>
            {day.d} {MAY_DATA.month} {MAY_DATA.year}
          </div>
          <div style={{ fontSize:10, color:T.textMid, marginTop:3 }}>{day.dow} · {day.trade?"Trading Day":"Non-Trading"}</div>
        </div>
        {day.confluence && (
          <div style={{ marginLeft:"auto", textAlign:"center" }}>
            <div style={{ fontSize:24, fontFamily:"'Cinzel',serif", fontWeight:700, color:day.confluence>=8?T.green:day.confluence>=6?T.amber:T.red }}>{day.confluence.toFixed(1)}</div>
            <div style={{ fontSize:8, color:T.textDim, letterSpacing:1 }}>CONFLUENCE</div>
          </div>
        )}
      </div>

      {!day.trade ? (
        <div style={{ fontSize:11, color:T.textDim, textAlign:"center", padding:"20px 0" }}>Weekend — Markets closed</div>
      ) : (
        <>
          {/* Session quality */}
          {q !== null && (
            <div style={{ padding:"10px 12px", borderRadius:6, marginBottom:12, background:qBg(q), border:`1px solid ${qC(q)}30`, display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:qC(q), boxShadow:`0 0 6px ${qC(q)}` }}/>
              <div>
                <span style={{ fontSize:12, fontFamily:"'Cinzel',serif", color:qC(q), letterSpacing:1 }}>{qL(q).toUpperCase()}</span>
                <span style={{ fontSize:9, color:T.textMid, marginLeft:8 }}>session quality</span>
              </div>
            </div>
          )}

          {/* Price data */}
          {day.close && (
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <div style={{ flex:1, padding:"8px 10px", background:T.card, borderRadius:5, border:`1px solid ${T.border}` }}>
                <div style={{ fontSize:8, color:T.textDim, letterSpacing:1, marginBottom:3 }}>CLOSE</div>
                <div style={{ fontSize:15, fontFamily:"monospace", color:T.text }}>{day.close.toLocaleString()}</div>
              </div>
              <div style={{ flex:1, padding:"8px 10px", background:T.card, borderRadius:5, border:`1px solid ${day.bull?T.green:T.red}25` }}>
                <div style={{ fontSize:8, color:T.textDim, letterSpacing:1, marginBottom:3 }}>CHANGE</div>
                <div style={{ fontSize:15, fontFamily:"monospace", color:day.bull?T.green:T.red }}>{day.chg>0?"+":""}{day.chg?.toFixed(2)}%</div>
              </div>
              <div style={{ flex:1, padding:"8px 10px", background:T.card, borderRadius:5, border:`1px solid ${T.border}` }}>
                <div style={{ fontSize:8, color:T.textDim, letterSpacing:1, marginBottom:3 }}>VOLUME</div>
                <div style={{ fontSize:15, fontFamily:"monospace", color:day.vol>1.3?T.amber:T.textMid }}>{day.vol?.toFixed(1)}x avg</div>
              </div>
            </div>
          )}

          {/* Volume + Panchang interaction */}
          {day.vol && day.pq !== null && (
            <div style={{ padding:"8px 10px", borderRadius:5, marginBottom:12, background:T.card, border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:8, color:T.textDim, letterSpacing:1, marginBottom:5 }}>VOLUME × PANCHANG</div>
              {(() => {
                const v = day.vol, p = day.pq;
                const signal = v>1.5&&p===3?"Genuine Breakout":v>1.5&&p===0?"Volume Trap — False Move":v>1.5&&p>=1?"High Conviction but Mixed":v<0.8&&p===3?"Quiet Accumulation":v<0.8&&p===0?"Quiet Distribution":"Normal Activity";
                const color  = signal.includes("Breakout")?T.green:signal.includes("Trap")?T.red:signal.includes("Accumulation")?T.teal:T.textMid;
                return (
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:color }}/>
                    <span style={{ fontSize:11, color, fontFamily:"'Cinzel',serif" }}>{signal}</span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Panchang */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:8, color:T.textDim, letterSpacing:2, fontFamily:"'Cinzel',serif", marginBottom:8 }}>PANCHANG</div>
            {[
              { label:"Tithi",     value:day.tithi,    change:day.tithiChange },
              { label:"Yoga",      value:day.yoga,     change:day.yogaChange  },
              { label:"Moon in",   value:sign?.n, extra:sign?.e },
            ].filter(r=>r.value).map(row=>(
              <div key={row.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${T.border}` }}>
                <div>
                  <span style={{ fontSize:9, color:T.textDim, fontFamily:"'Cinzel',serif" }}>{row.label}</span>
                  <span style={{ fontSize:11, color:T.text, marginLeft:10 }}>{row.value}</span>
                  {row.extra && <span style={{ fontSize:9, color:T.textMid, marginLeft:6 }}>{row.extra}</span>}
                </div>
                {row.change && (
                  <span style={{ fontSize:8, color:T.gold, fontFamily:"'Cinzel',serif" }}>⚡ {row.change}</span>
                )}
              </div>
            ))}
          </div>

          {/* Events */}
          {day.events?.length > 0 && (
            <div>
              <div style={{ fontSize:8, color:T.textDim, letterSpacing:2, fontFamily:"'Cinzel',serif", marginBottom:8 }}>PLANETARY EVENTS</div>
              {day.events.map((ev,i)=>{
                const pl = P[ev.planet];
                return(
                  <div key={i} style={{ display:"flex", gap:8, padding:"8px 10px", borderRadius:5, marginBottom:6, background:`${bC(ev.bias)}08`, border:`1px solid ${bC(ev.bias)}25` }}>
                    <span style={{ fontSize:16, color:pl?.c }}>{pl?.s}</span>
                    <div>
                      <div style={{ fontSize:11, color:pl?.c, fontFamily:"'Cinzel',serif" }}>{ev.type}</div>
                      <div style={{ fontSize:9, color:bC(ev.bias), marginTop:2, fontFamily:"'Cinzel',serif", letterSpacing:1 }}>{ev.bias.toUpperCase()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Changeover alert */}
          {(day.tithiChange || day.yogaChange) && (
            <div style={{ padding:"8px 10px", borderRadius:5, background:T.goldDim, border:`1px solid ${T.gold}30`, display:"flex", gap:8, alignItems:"flex-start", marginTop:8 }}>
              <span style={{ fontSize:14, color:T.gold }}>⚡</span>
              <div>
                <div style={{ fontSize:9, color:T.gold, fontFamily:"'Cinzel',serif", letterSpacing:1, marginBottom:3 }}>INTRADAY CHANGEOVER</div>
                {day.tithiChange && <div style={{ fontSize:10, color:T.text }}>Tithi changes at {day.tithiChange} IST</div>}
                {day.yogaChange  && <div style={{ fontSize:10, color:T.text }}>Yoga changes at {day.yogaChange} IST</div>}
                <div style={{ fontSize:9, color:T.textMid, marginTop:4 }}>Tighten stops 5 min before each changeover</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── MONTH STATS BAR ──────────────────────────────────────────────────────────
function MonthStats() {
  const stats = [
    { label:"HIGH CONFLUENCE", value:MONTH_STATS.highConfluence, sub:"days ≥ 8.0", color:T.green },
    { label:"AVOID DAYS",      value:MONTH_STATS.avoidDays,      sub:"Panchang 0", color:T.red },
    { label:"EVENT DAYS",      value:MONTH_STATS.gradaAEvents,   sub:"planetary",  color:T.gold },
    { label:"BULL / BEAR",     value:`${MONTH_STATS.bullDays}/${MONTH_STATS.bearDays}`, sub:"trading days", color:T.teal },
    { label:"MONTH RETURN",    value:MONTH_STATS.monthReturn,    sub:"NIFTY",      color:T.green },
  ];
  return (
    <div style={{ display:"flex", gap:8, padding:"10px 16px", background:T.surface, borderBottom:`1px solid ${T.border}` }}>
      {stats.map(s=>(
        <div key={s.label} style={{ flex:1, padding:"8px 12px", background:T.panel, borderRadius:5, border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:7, color:T.textDim, letterSpacing:2, fontFamily:"'Cinzel',serif", marginBottom:4 }}>{s.label}</div>
          <div style={{ fontSize:16, fontFamily:"'Cinzel',serif", fontWeight:700, color:s.color }}>{s.value}</div>
          <div style={{ fontSize:8, color:T.textDim, marginTop:2 }}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─── MOON WAVE STRIP ─────────────────────────────────────────────────────────
function MoonWaveStrip({ width }) {
  const tradingDays = MAY_DATA.days.filter(d=>d.trade);
  const points = tradingDays.map((d,i)=>{
    const x = ((i+0.5)/tradingDays.length)*width;
    const y = 18 - (Math.sin(d.moonAngle*Math.PI/180)*0.5+0.5)*14 - 2;
    return [x,y];
  });
  const path = points.map((p,i)=>`${i===0?"M":"L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const fill = `${path} L${width},18 L0,18 Z`;

  return (
    <div style={{ padding:"4px 0 0" }}>
      <svg width={width} height={22} style={{ display:"block" }}>
        <defs>
          <linearGradient id="mwg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.moon} stopOpacity="0.2"/>
            <stop offset="100%" stopColor={T.moon} stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        <path d={fill} fill="url(#mwg)"/>
        <path d={path} fill="none" stroke={`${T.moon}60`} strokeWidth="1.2"/>
        {tradingDays.map((d,i)=>{
          if(d.moonAngle<10||d.moonAngle>350||(d.moonAngle>170&&d.moonAngle<190)){
            const x=((i+0.5)/tradingDays.length)*width;
            const y=18-(Math.sin(d.moonAngle*Math.PI/180)*0.5+0.5)*14-2;
            return <circle key={i} cx={x} cy={y} r={3} fill={d.moonAngle>170&&d.moonAngle<190?T.moon:"#05080F"} stroke={T.moon} strokeWidth={1.2}/>;
          }
          return null;
        })}
      </svg>
    </div>
  );
}

// ─── CONFLUENCE PATTERN INSIGHT ───────────────────────────────────────────────
function PatternInsight() {
  const insights = [
    { icon:"✦", color:T.green,  text:"May 5 — Venus Direct + Panchami Yoga + high volume = textbook re-entry day. NIFTY +0.75%." },
    { icon:"✦", color:T.green,  text:"May 14 — Jupiter enters Cancer + strong Panchang + 2.8x volume surge = year's highest conviction entry." },
    { icon:"⚠", color:T.red,    text:"May 13 — Vaidhriti Yoga all day. Despite high volume, NIFTY fell. Panchang override was correct." },
    { icon:"⚠", color:T.red,    text:"May 19 — Atiganda Yoga + Mercury Retrograde = double warning. Sitting out saved 0.74% loss." },
    { icon:"◎", color:T.amber,  text:"May 28 — High confluence (8.5) but no technical breakout setup — Finastro signaled WAIT, not enter." },
  ];
  return (
    <div style={{ padding:14 }}>
      <div style={{ fontSize:9, color:T.textDim, letterSpacing:2, fontFamily:"'Cinzel',serif", marginBottom:10 }}>PATTERN INSIGHTS · MAY 2026</div>
      {insights.map((ins,i)=>(
        <div key={i} style={{ display:"flex", gap:8, padding:"7px 9px", borderRadius:5, marginBottom:5, background:`${ins.color}06`, border:`1px solid ${ins.color}18` }}>
          <span style={{ fontSize:12, color:ins.color, flexShrink:0, marginTop:1 }}>{ins.icon}</span>
          <span style={{ fontSize:10, color:T.textMid, lineHeight:1.6 }}>{ins.text}</span>
        </div>
      ))}
    </div>
  );
}

// ─── LEGEND ───────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div style={{ display:"flex", gap:16, alignItems:"center", padding:"8px 16px", background:T.surface, borderTop:`1px solid ${T.border}`, flexWrap:"wrap" }}>
      <span style={{ fontSize:8, color:T.textDim, letterSpacing:2, fontFamily:"'Cinzel',serif" }}>LEGEND</span>
      {[
        {color:T.green, label:"Favorable (3)"},
        {color:T.amber, label:"Neutral (2)"},
        {color:"#E09040",label:"Caution (1)"},
        {color:T.red,   label:"Avoid (0)"},
      ].map(item=>(
        <div key={item.label} style={{ display:"flex", alignItems:"center", gap:4 }}>
          <div style={{ width:10, height:3, background:item.color, borderRadius:1 }}/>
          <span style={{ fontSize:8, color:T.textDim }}>{item.label}</span>
        </div>
      ))}
      <div style={{ width:1, height:12, background:T.border }}/>
      {[
        {icon:"◑", color:T.gold,  label:"⚡ changeover"},
        {icon:"♃", color:T.gold,  label:"Planet event"},
        {icon:"🌕", color:T.moon,  label:"Moon phase"},
        {icon:"▪", color:T.green, label:"≥8 confluence"},
      ].map(item=>(
        <div key={item.label} style={{ display:"flex", alignItems:"center", gap:4 }}>
          <span style={{ fontSize:10, color:item.color }}>{item.icon}</span>
          <span style={{ fontSize:8, color:T.textDim }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCREEN 3
// ═══════════════════════════════════════════════════════════════════════════
export default function FinastroScreen3() {
  const [selectedDay, setSelectedDay] = useState(MAY_DATA.days.find(d=>d.d===2));
  const [view, setView] = useState("calendar"); // calendar | heatmap

  // Calendar grid — start week on Monday
  // May 2026 starts on Friday (dow=5)
  // Pad with empty cells for Mon-Thu
  const gridDays = useMemo(() => {
    const offset = 4; // 4 empty cells before May 1 (Mon=0, so Fri=4)
    const empties = Array(offset).fill(null);
    return [...empties, ...MAY_DATA.days];
  }, []);

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Text:ital,wght@0,400;1,400&display=swap');
    * { box-sizing:border-box; margin:0; padding:0; }
    ::-webkit-scrollbar { width:4px; height:4px; }
    ::-webkit-scrollbar-track { background:${T.bg}; }
    ::-webkit-scrollbar-thumb { background:${T.borderHi}; border-radius:2px; }
    @keyframes fadeIn { from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);} }
    @keyframes twinkle { from{opacity:0.03;}to{opacity:0.3;} }
    .day-cell:hover { border-color: ${T.goldDim} !important; }
  `;

  return (
    <div style={{ background:T.bg, minHeight:"100vh", fontFamily:"'Crimson Text',Georgia,serif", color:T.text, display:"flex", flexDirection:"column" }}>
      <style>{css}</style>

      {/* Stars */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
        {Array.from({length:60},(_,i)=>(
          <div key={i} style={{ position:"absolute", left:`${(i*17.3)%100}%`, top:`${(i*11.7)%100}%`, width:(i%3)*0.4+0.4, height:(i%3)*0.4+0.4, borderRadius:"50%", background:"#fff", opacity:0.03+((i%4)*0.04), animation:`twinkle ${2+(i%6)}s ease-in-out infinite alternate`, animationDelay:`${(i%5)*0.6}s` }}/>
        ))}
      </div>

      <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", height:"100vh" }}>

        {/* ── HEADER ── */}
        <div style={{ padding:"10px 16px", background:T.surface, borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:18, color:T.gold, filter:`drop-shadow(0 0 8px ${T.gold})` }}>✦</span>
            <div>
              <span style={{ fontSize:16, fontFamily:"'Cinzel',serif", fontWeight:900, color:T.gold, letterSpacing:4 }}>FINASTRO</span>
              <span style={{ fontSize:10, color:T.textDim, marginLeft:12, letterSpacing:2 }}>MONTHLY · CONFLUENCE CALENDAR</span>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {/* Month backdrop */}
            <div style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 10px", background:T.goldDim, border:`1px solid ${T.gold}30`, borderRadius:5 }}>
              <span style={{ fontSize:13, color:T.gold }}>{P.jupiter.s}</span>
              <span style={{ fontSize:9, color:T.gold, fontFamily:"'Cinzel',serif", letterSpacing:1 }}>Jupiter exalted Cancer — bull backdrop</span>
            </div>
            {/* Nav */}
            <div style={{ display:"flex", gap:4 }}>
              <button style={{ padding:"5px 10px", background:T.panel, border:`1px solid ${T.border}`, borderRadius:4, color:T.textMid, fontSize:12, cursor:"pointer" }}>‹</button>
              <div style={{ padding:"5px 14px", background:T.panel, border:`1px solid ${T.borderHi}`, borderRadius:4, fontSize:11, fontFamily:"'Cinzel',serif", color:T.text, letterSpacing:2 }}>MAY 2026</div>
              <button style={{ padding:"5px 10px", background:T.panel, border:`1px solid ${T.border}`, borderRadius:4, color:T.textMid, fontSize:12, cursor:"pointer" }}>›</button>
            </div>
          </div>
        </div>

        {/* ── MONTH STATS ── */}
        <MonthStats/>

        {/* ── MAIN BODY ── */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* Calendar grid */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", padding:"12px 12px 0", overflow:"auto" }}>

            {/* Day headers */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:4 }}>
              {["MON","TUE","WED","THU","FRI","SAT","SUN"].map(d=>(
                <div key={d} style={{ textAlign:"center", fontSize:8, color:T.textDim, fontFamily:"'Cinzel',serif", letterSpacing:2, padding:"4px 0" }}>{d}</div>
              ))}
            </div>

            {/* Calendar cells */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, flex:1 }}>
              {gridDays.map((day, i) => (
                day ? (
                  <DayCell
                    key={i}
                    day={day}
                    isToday={day.d === 2}
                    isSelected={selectedDay?.d === day.d}
                    onClick={d => d.trade && setSelectedDay(d)}
                  />
                ) : (
                  <div key={i}/>
                )
              ))}
            </div>

            {/* Moon wave strip */}
            <div style={{ marginTop:8, padding:"4px 0" }}>
              <div style={{ fontSize:7, color:T.textDim, letterSpacing:2, fontFamily:"'Cinzel',serif", marginBottom:2 }}>☽ LUNAR RHYTHM · TRADING DAYS</div>
              <div id="moon-wave-container" style={{ width:"100%" }}>
                <MoonWaveStrip width={860}/>
              </div>
            </div>

            {/* Pattern insights */}
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, marginTop:8, marginBottom:12 }}>
              <PatternInsight/>
            </div>
          </div>

          {/* Right: Day detail panel */}
          <div style={{ width:280, flexShrink:0, background:T.surface, borderLeft:`1px solid ${T.border}`, overflowY:"auto" }}>
            <DayDetail day={selectedDay}/>
          </div>
        </div>

        {/* ── LEGEND ── */}
        <Legend/>
      </div>
    </div>
  );
}
