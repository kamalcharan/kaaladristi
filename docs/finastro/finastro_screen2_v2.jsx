import { useState, useEffect, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// FINASTRO · SCREEN 2 · WEEKLY SWING VIEW (FIXED)
// Past  → Historical OHLCV review
// Today → Partial candle, session in progress
// Future → Panchang preview only, no price projection
// ═══════════════════════════════════════════════════════════════════════════

const T = {
  bg:       "#040810",
  surface:  "#060A14",
  panel:    "#080D1A",
  card:     "#0A1020",
  border:   "#111D30",
  borderHi: "#182840",
  gold:     "#C9A455",
  goldDim:  "#C9A45518",
  teal:     "#2ABFB0",
  green:    "#3DBA7E",
  greenDim: "#3DBA7E12",
  red:      "#E05252",
  redDim:   "#E0525212",
  amber:    "#E09840",
  amberDim: "#E0984012",
  purple:   "#9B6DCA",
  moon:     "#8AB4C8",
  text:     "#B0C8E0",
  textMid:  "#5A7898",
  textDim:  "#334460",
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
function qBg(q){return q===3?T.greenDim:q===2?T.amberDim:q===1?"#E0904010":T.redDim;}
function qL(q){return q===3?"Favorable":q===2?"Neutral":q===1?"Caution":"Avoid";}
function bC(b){return b==="bullish"?T.green:b==="bearish"?T.red:b==="volatile"?T.purple:T.amber;}
function tMin(t){if(!t)return null;const[h,m]=t.split(":").map(Number);return h*60+m;}

const SS_MIN=555, SE_MIN=930; // 09:15, 15:30

// ─── TODAY (for demo: May 19, 2026 is "today") ────────────────────────────────
const TODAY_DATE = "2026-05-19";
const NOW_MIN    = 615; // 10:15 IST — simulated current time

// ─── WEEK DATA ────────────────────────────────────────────────────────────────
const WEEKS = [
  "W3 · May 11–15",
  "W4 · May 19–23",
  "W5 · May 26–30",
];

const WEEK_DATA = {

  // ── W3: All past ──────────────────────────────────────────────────────────
  "W3 · May 11–15": {
    backdrop:{ planet:"jupiter", sign:"Cancer", note:"Jupiter ingress May 14 — week's defining event", color:T.gold },
    summary:{ ret:"+2.47%", high:23020, low:22380, bestDay:"May 14", bestConf:8.9 },
    days:[
      {
        date:"2026-05-11", label:"May 11", dow:"MON", mode:"past",
        moonPhase:"🌕", moonSignIdx:3, moonSignChange:null,
        pq:1, tithi:"Moola Nak.", nakshatra:"Moola", yoga:"Vriddhi",
        tithiChange:null, yogaChange:"10:20",
        rahuKala:{start:"07:30",end:"09:00",sMin:450,eMin:540},
        ohlcv:{open:22480,high:22560,low:22410,close:22460,prevClose:22590,vol:1.1},
        confluence:4.8,
        events:[],
        signals:[
          {type:"caution",text:"Moola Nakshatra — most inauspicious. Avoid new longs."},
          {type:"review",text:"Outcome: NIFTY fell 0.13%. Avoid signal was correct."},
        ],
        watchLevels:null,
      },
      {
        date:"2026-05-12", label:"May 12", dow:"TUE", mode:"past",
        moonPhase:"🌖", moonSignIdx:3, moonSignChange:null,
        pq:3, tithi:"Panchami", nakshatra:"U.Bhadra", yoga:"Siddhi",
        tithiChange:"12:10", yogaChange:"14:45",
        rahuKala:{start:"15:00",end:"16:30",sMin:900,eMin:990},
        ohlcv:{open:22460,high:22810,low:22440,close:22720,prevClose:22460,vol:2.1},
        confluence:8.4,
        events:[{planet:"moon",type:"Full Moon",bias:"volatile",time:"09:28"}],
        signals:[
          {type:"entry",text:"Siddhi Yoga + 2.1x volume + Full Moon burst — long valid at open."},
          {type:"review",text:"Outcome: NIFTY +1.16%. Siddhi Yoga held. Rahu Kala (15:00) saved latecomers."},
        ],
        watchLevels:null,
      },
      {
        date:"2026-05-13", label:"May 13", dow:"WED", mode:"past",
        moonPhase:"🌖", moonSignIdx:4, moonSignChange:{from:"Cancer",to:"Leo",time:"03:00",fromIdx:3,toIdx:4},
        pq:0, tithi:"Shashthi", nakshatra:"P.Ashadha", yoga:"Vaidhriti",
        tithiChange:null, yogaChange:"11:30",
        rahuKala:{start:"12:00",end:"13:30",sMin:720,eMin:810},
        ohlcv:{open:22720,high:22740,low:22530,close:22580,prevClose:22720,vol:1.4},
        confluence:2.1,
        events:[{planet:"moon",type:"Vaidhriti Yoga",bias:"caution",time:null}],
        signals:[
          {type:"avoid",text:"Vaidhriti Yoga all day — stood aside entirely."},
          {type:"review",text:"Outcome: NIFTY -0.62%. High volume red day. Panchang override saved 0.62%."},
        ],
        watchLevels:null,
      },
      {
        date:"2026-05-14", label:"May 14", dow:"THU", mode:"past",
        moonPhase:"🌗", moonSignIdx:4, moonSignChange:null,
        pq:2, tithi:"Saptami", nakshatra:"U.Ashadha", yoga:"Vishkambha",
        tithiChange:"10:00", yogaChange:"13:15",
        rahuKala:{start:"13:30",end:"15:00",sMin:810,eMin:900},
        ohlcv:{open:22580,high:23060,low:22570,close:22940,prevClose:22580,vol:2.8},
        confluence:8.9,
        events:[{planet:"jupiter",type:"Jupiter → Cancer ♋",bias:"bullish",time:"05:30"}],
        signals:[
          {type:"entry",text:"Jupiter ingress before open — entered FMCG/PSU banks at 09:15."},
          {type:"review",text:"Outcome: NIFTY +1.59%, 2.8x volume. Booked 60% at 13:30 before Rahu Kala."},
        ],
        watchLevels:null,
      },
      {
        date:"2026-05-15", label:"May 15", dow:"FRI", mode:"past",
        moonPhase:"🌗", moonSignIdx:5, moonSignChange:{from:"Leo",to:"Virgo",time:"04:30",fromIdx:4,toIdx:5},
        pq:3, tithi:"Ashtami", nakshatra:"Hasta", yoga:"Priti",
        tithiChange:null, yogaChange:"12:45",
        rahuKala:{start:"10:30",end:"12:00",sMin:630,eMin:720},
        ohlcv:{open:22940,high:23080,low:22900,close:23020,prevClose:22940,vol:1.2},
        confluence:7.8,
        events:[],
        signals:[
          {type:"entry",text:"Priti Yoga + Hasta Nakshatra — continuation hold valid."},
          {type:"review",text:"Outcome: NIFTY +0.35%. Held longs. Yoga change at 12:45 was exit cue."},
        ],
        watchLevels:null,
      },
    ]
  },

  // ── W4: Mixed (past Mon/Tue, Today Wed, future Thu/Fri) ──────────────────
  "W4 · May 19–23": {
    backdrop:{ planet:"jupiter", sign:"Cancer (exalted)", note:"Jupiter settled — FMCG/PSU banks structural bid", color:T.gold },
    summary:{ ret:null, high:null, low:null, bestDay:null, bestConf:null },
    days:[
      {
        date:"2026-05-19", label:"May 19", dow:"MON", mode:"past",
        moonPhase:"🌗", moonSignIdx:6, moonSignChange:{from:"Scorpio",to:"Libra",time:"08:15",fromIdx:7,toIdx:6},
        pq:3, tithi:"Dashami", nakshatra:"Vishakha", yoga:"Shobhana",
        tithiChange:"09:30", yogaChange:"14:00",
        rahuKala:{start:"07:30",end:"09:00",sMin:450,eMin:540},
        ohlcv:{open:23020,high:23200,low:22990,close:23150,prevClose:23020,vol:1.4},
        confluence:8.2,
        events:[],
        signals:[
          {type:"entry",text:"Shobhana Yoga + Dashami — momentum continuation from W3."},
          {type:"review",text:"Outcome: NIFTY +0.56%. Rahu Kala before open — clean entry at 09:15."},
        ],
        watchLevels:null,
      },
      {
        date:"2026-05-20", label:"May 20", dow:"TUE", mode:"past",
        moonPhase:"🌘", moonSignIdx:7, moonSignChange:null,
        pq:0, tithi:"Ekadashi", nakshatra:"Shatabhisha", yoga:"Atiganda",
        tithiChange:null, yogaChange:"11:45",
        rahuKala:{start:"15:00",end:"16:30",sMin:900,eMin:990},
        ohlcv:{open:23150,high:23190,low:22940,close:22980,prevClose:23150,vol:1.6},
        confluence:1.8,
        events:[{planet:"moon",type:"Atiganda Yoga",bias:"caution",time:null}],
        signals:[
          {type:"avoid",text:"Atiganda Yoga — dangerous obstacles. Stood aside."},
          {type:"review",text:"Outcome: NIFTY -0.74%. High volume red. Panchang override correct."},
        ],
        watchLevels:null,
      },
      {
        // TODAY
        date:"2026-05-21", label:"May 21", dow:"WED", mode:"today",
        moonPhase:"🌘", moonSignIdx:7, moonSignChange:null,
        pq:2, tithi:"Dwadashi", nakshatra:"P.Bhadra", yoga:"Sukarman",
        tithiChange:"13:00", yogaChange:"09:20",
        rahuKala:{start:"12:00",end:"13:30",sMin:720,eMin:810},
        // Partial candle — only what's happened so far (up to NOW_MIN 10:15)
        ohlcv:{open:22980,high:23040,low:22960,close:23010,prevClose:22980,vol:0.4,partial:true},
        confluence:6.1,
        events:[],
        signals:[
          {type:"neutral",text:"Sukarman Yoga — moderate recovery day. Yoga already changed at 09:20."},
          {type:"caution",text:"Rahu Kala 12:00–13:30 — no new entries in that window. Tithi changes 13:00."},
        ],
        watchLevels:{
          resistance:[23060, 23150],
          support:[22940, 22840],
          note:"Watch 23,060 — prev week high. Break with volume + Abhijit window = valid entry."
        },
      },
      {
        // FUTURE
        date:"2026-05-22", label:"May 22", dow:"THU", mode:"future",
        moonPhase:"🌘", moonSignIdx:8, moonSignChange:{from:"Scorpio",to:"Sagittarius",time:"12:20",fromIdx:7,toIdx:8},
        pq:3, tithi:"Trayodashi", nakshatra:"U.Bhadra", yoga:"Dhriti",
        tithiChange:null, yogaChange:"12:20",
        rahuKala:{start:"13:30",end:"15:00",sMin:810,eMin:900},
        ohlcv:null,
        confluence:7.9,
        events:[],
        signals:[
          {type:"entry",text:"Dhriti Yoga (steady) + Moon → Sagittarius fire sign at 12:20 — momentum bias."},
          {type:"caution",text:"Yoga change coincides with Moon sign change at 12:20. Book partial before."},
          {type:"plan",text:"Plan: If 23,060 breaks today, add on Abhijit window (11:48–12:36)."},
        ],
        watchLevels:{
          resistance:[23060, 23210],
          support:[22940, 22840],
          note:"Thursday historically strong after Wednesday recovery. Breakout above 23,060 is the trigger."
        },
      },
      {
        // FUTURE
        date:"2026-05-23", label:"May 23", dow:"FRI", mode:"future",
        moonPhase:"🌑", moonSignIdx:8, moonSignChange:null,
        pq:1, tithi:"Chaturdashi", nakshatra:"Revati", yoga:"Shula",
        tithiChange:"10:45", yogaChange:"14:30",
        rahuKala:{start:"10:30",end:"12:00",sMin:630,eMin:720},
        ohlcv:null,
        confluence:5.0,
        events:[],
        signals:[
          {type:"caution",text:"Chaturdashi + Shula Yoga — inauspicious Friday. Reduce longs at open."},
          {type:"caution",text:"Rahu Kala overlaps with Tithi change at 10:45 — double caution 10:30–11:00."},
          {type:"plan",text:"Plan: Book remaining profits by 10:30. Light positioning only if quality improves."},
        ],
        watchLevels:{
          resistance:[23210],
          support:[22940, 22840],
          note:"Friday caution day — favour exits over entries. Hold only if Abhijit (11:48) gives clean bounce."
        },
      },
    ]
  },

  // ── W5: All future (planning mode) ───────────────────────────────────────
  "W5 · May 26–30": {
    backdrop:{ planet:"mercury", sign:"Gemini (Retro begins May 29)", note:"Mercury Retrograde warning — exit IT before Friday close", color:T.red },
    summary:{ ret:null, high:null, low:null, bestDay:null, bestConf:null },
    days:[
      {
        date:"2026-05-26", label:"May 26", dow:"MON", mode:"future",
        moonPhase:"🌑", moonSignIdx:9, moonSignChange:null,
        pq:3, tithi:"Dwitiya", nakshatra:"U.Bhadra", yoga:"Dhruva",
        tithiChange:null, yogaChange:"13:15",
        rahuKala:{start:"07:30",end:"09:00",sMin:450,eMin:540},
        ohlcv:null,
        confluence:8.0,
        events:[],
        signals:[
          {type:"entry",text:"Dhruva Yoga — fixed, stable. Post-New Moon build begins. Strong Monday."},
          {type:"plan",text:"Plan: Rahu before open — clean entry at 09:15. Target: breakout above W4 high."},
        ],
        watchLevels:{
          resistance:[23210, 23500],
          support:[22980, 22840],
          note:"New Moon energy building. First strong entry day of W5. Dhruva Yoga = sustained move if it breaks."
        },
      },
      {
        date:"2026-05-27", label:"May 27", dow:"TUE", mode:"future",
        moonPhase:"🌒", moonSignIdx:10, moonSignChange:{from:"Capricorn",to:"Aquarius",time:"14:30",fromIdx:9,toIdx:10},
        pq:0, tithi:"Tritiya", nakshatra:"Revati", yoga:"Vyaghata",
        tithiChange:"09:20", yogaChange:"14:45",
        rahuKala:{start:"15:00",end:"16:30",sMin:900,eMin:990},
        ohlcv:null,
        confluence:1.5,
        events:[{planet:"moon",type:"Vyaghata Yoga",bias:"caution",time:null}],
        signals:[
          {type:"avoid",text:"Vyaghata Yoga — tiger strike. Stand aside entirely."},
          {type:"plan",text:"Plan: Do nothing. Protect Monday profits. Review positions."},
        ],
        watchLevels:{
          resistance:[], support:[22980],
          note:"Classic avoid day. Use the time to review watchlist for Wednesday entry setup."
        },
      },
      {
        date:"2026-05-28", label:"May 28", dow:"WED", mode:"future",
        moonPhase:"🌒", moonSignIdx:10, moonSignChange:null,
        pq:1, tithi:"Chaturthi", nakshatra:"Ashwini", yoga:"Harshana",
        tithiChange:null, yogaChange:"10:30",
        rahuKala:{start:"12:00",end:"13:30",sMin:720,eMin:810},
        ohlcv:null,
        confluence:4.2,
        events:[{planet:"moon",type:"New Moon",bias:"neutral",time:"17:04"}],
        signals:[
          {type:"caution",text:"New Moon day — low energy, market seeks direction. Reduce exposure."},
          {type:"neutral",text:"Harshana positive but Chaturthi (Rikta) limits effect. Sit mostly flat."},
          {type:"plan",text:"Plan: New Moon after close. Thursday will be stronger. Prepare watchlist."},
        ],
        watchLevels:{
          resistance:[23210], support:[22980, 22840],
          note:"Low conviction day. Small positions only. The real move comes Thursday after New Moon energy builds overnight."
        },
      },
      {
        date:"2026-05-29", label:"May 29", dow:"THU", mode:"future",
        moonPhase:"🌒", moonSignIdx:11, moonSignChange:{from:"Aquarius",to:"Pisces",time:"13:30",fromIdx:10,toIdx:11},
        pq:3, tithi:"Panchami", nakshatra:"Bharani", yoga:"Vajra",
        tithiChange:"11:45", yogaChange:"13:00",
        rahuKala:{start:"13:30",end:"15:00",sMin:810,eMin:900},
        ohlcv:null,
        confluence:8.5,
        events:[],
        signals:[
          {type:"entry",text:"Panchami (Purna) + Moon → Pisces + post-New Moon surge. Best entry of W5."},
          {type:"caution",text:"TWO changeovers: Tithi 11:45 + Yoga 13:00 — book half before each."},
          {type:"caution",text:"Rahu Kala 13:30 follows immediately — close balance by 13:25."},
          {type:"plan",text:"Plan: Enter 09:15–10:00 window. Target Abhijit (11:48) for pyramid add. Full exit by 13:25."},
        ],
        watchLevels:{
          resistance:[23500, 23800],
          support:[23000, 22840],
          note:"Highest confluence day of W5. Intraday trade only — three exits planned (11:45, 13:00, 13:25)."
        },
      },
      {
        date:"2026-05-30", label:"May 30", dow:"FRI", mode:"future",
        moonPhase:"🌒", moonSignIdx:11, moonSignChange:null,
        pq:2, tithi:"Shashthi", nakshatra:"Krittika", yoga:"Siddhi",
        tithiChange:null, yogaChange:null,
        rahuKala:{start:"10:30",end:"12:00",sMin:630,eMin:720},
        ohlcv:null,
        confluence:5.8,
        events:[{planet:"mercury",type:"Mercury Retrograde ☿",bias:"caution",time:"08:30"}],
        signals:[
          {type:"caution",text:"Mercury Retrograde begins 08:30 — before open. EXIT all IT/tech by today's close."},
          {type:"neutral",text:"Siddhi Yoga is positive but Mercury risk dominates for tech stocks."},
          {type:"plan",text:"Plan: FMCG/PSU Banks may still hold. IT/Telecom/Fintech — exit by 13:00."},
        ],
        watchLevels:{
          resistance:[23500], support:[23000],
          note:"Mercury Retrograde week begins. Non-tech positions may continue but IT sector risk spikes sharply."
        },
      },
    ]
  }
};

// ─── OHLCV BAR (past days only) ───────────────────────────────────────────────
function OHLCBar({ ohlcv, partial=false, height=80, width=52 }) {
  const {open,high,low,close,prevClose} = ohlcv;
  const pad = (high-low)*0.12;
  const minP=low-pad, maxP=high+pad;
  const rng=maxP-minP;
  const toY=p=>height-((p-minP)/rng)*height;
  const bull=close>=open;
  const color=bull?T.green:T.red;
  const cx=width/2, bw=width*0.48;
  const bodyTop=toY(Math.max(open,close));
  const bodyH=Math.max(2,Math.abs(toY(open)-toY(close)));

  return (
    <svg width={width} height={height} style={{display:"block",overflow:"visible"}}>
      {/* Prev close */}
      <line x1={0} y1={toY(prevClose)} x2={width} y2={toY(prevClose)} stroke={T.textDim} strokeWidth={0.5} strokeDasharray="2,2"/>
      {/* Wick */}
      <line x1={cx} y1={toY(high)} x2={cx} y2={toY(low)} stroke={color} strokeWidth={1} opacity={0.5}/>
      {/* Body */}
      <rect x={cx-bw/2} y={bodyTop} width={bw} height={bodyH} fill={color} rx={1}
        opacity={partial?0.5:0.9}/>
      {/* Partial indicator */}
      {partial && (
        <line x1={cx-bw/2} y1={toY(close)} x2={cx+bw/2} y2={toY(close)}
          stroke={color} strokeWidth={1.5} strokeDasharray="2,1"/>
      )}
      {/* Close label */}
      <text x={width} y={toY(close)-2} fontSize={7} fill={color} fontFamily="monospace" textAnchor="end">{Math.round(close)}</text>
    </svg>
  );
}

// ─── PANCHANG VERTICAL (session timeline) ─────────────────────────────────────
function PanchangVertical({ day, height=180 }) {
  const toY=m=>((m-SS_MIN)/(SE_MIN-SS_MIN))*height;
  const rk=day.rahuKala;
  const rkInSession=rk.eMin>SS_MIN&&rk.sMin<SE_MIN;
  const changes=[
    day.tithiChange&&{m:tMin(day.tithiChange),label:"Tithi",color:T.gold},
    day.yogaChange &&{m:tMin(day.yogaChange), label:"Yoga", color:T.amber},
  ].filter(Boolean).filter(c=>c.m>SS_MIN&&c.m<SE_MIN);

  return (
    <div style={{position:"relative",height,width:"100%",background:`${qC(day.pq)}06`}}>
      {/* Rahu Kala */}
      {rkInSession&&(
        <div style={{
          position:"absolute",left:0,right:0,
          top:toY(Math.max(rk.sMin,SS_MIN)),
          height:Math.max(4,toY(Math.min(rk.eMin,SE_MIN))-toY(Math.max(rk.sMin,SS_MIN))),
          background:"repeating-linear-gradient(45deg,#E0525222 0,#E0525222 3px,transparent 3px,transparent 7px)",
          borderTop:`1px solid ${T.red}50`,borderBottom:`1px solid ${T.red}30`,
        }}>
          <span style={{fontSize:6,color:T.red,padding:"1px 3px",fontFamily:"'Cinzel',serif",whiteSpace:"nowrap"}}>☊ RAHU {rk.start}–{rk.end}</span>
        </div>
      )}
      {/* Abhijit */}
      <div style={{
        position:"absolute",left:0,right:0,
        top:toY(708),height:Math.max(4,toY(756)-toY(708)),
        background:`${T.green}12`,
        borderTop:`1px solid ${T.green}50`,borderBottom:`1px solid ${T.green}30`,
      }}>
        <span style={{fontSize:6,color:T.green,padding:"1px 3px",fontFamily:"'Cinzel',serif",whiteSpace:"nowrap"}}>☀ ABHIJIT 11:48–12:36</span>
      </div>
      {/* Changeovers */}
      {changes.map((ch,i)=>(
        <div key={i} style={{
          position:"absolute",left:0,right:0,
          top:toY(ch.m),height:1.5,
          background:ch.color,boxShadow:`0 0 3px ${ch.color}`,
        }}>
          <span style={{position:"absolute",right:2,top:-9,fontSize:6,color:ch.color,fontFamily:"'Cinzel',serif",whiteSpace:"nowrap",background:T.bg,padding:"0 2px"}}>{ch.label} ⚡ {ch.m===tMin(day.tithiChange)?day.tithiChange:day.yogaChange}</span>
        </div>
      ))}
      {/* NOW line */}
      {day.mode==="today"&&(
        <div style={{
          position:"absolute",left:0,right:0,top:toY(NOW_MIN),height:1.5,
          background:T.gold,boxShadow:`0 0 5px ${T.gold}`,
          animation:"nowPulse 2s ease-in-out infinite",
        }}>
          <span style={{position:"absolute",left:2,top:-9,fontSize:6,color:T.gold,fontFamily:"'Cinzel',serif",background:T.bg,padding:"0 2px"}}>NOW 10:15</span>
        </div>
      )}
      {/* Time ticks */}
      {["09:15","10:00","11:00","12:00","13:00","14:00","15:00","15:30"].map(t=>(
        <div key={t} style={{position:"absolute",left:1,top:toY(tMin(t))-3,fontSize:5,color:T.textDim,fontFamily:"monospace",lineHeight:1}}>{t}</div>
      ))}
    </div>
  );
}

// ─── PRICE AREA — switches by mode ────────────────────────────────────────────
function PriceArea({ day }) {

  // PAST — full historical candle + OHLCV
  if (day.mode==="past") {
    const {open,high,low,close,prevClose,vol}=day.ohlcv;
    const bull=close>=prevClose;
    const chg=((close-prevClose)/prevClose*100);
    return (
      <div style={{padding:"8px 10px 6px 14px",borderBottom:`1px solid ${T.border}`}}>
        <div style={{fontSize:7,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif",marginBottom:5,display:"flex",alignItems:"center",gap:5}}>
          <span style={{color:T.textDim}}>HISTORICAL</span>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"flex-end",marginBottom:5}}>
          <OHLCBar ohlcv={day.ohlcv} height={72} width={48}/>
          <div>
            <div style={{fontSize:15,fontFamily:"monospace",color:bull?T.green:T.red,fontWeight:700}}>{close.toLocaleString()}</div>
            <div style={{fontSize:10,fontFamily:"monospace",color:bull?T.green:T.red}}>{bull?"+":""}{chg.toFixed(2)}%</div>
            <div style={{fontSize:8,color:T.textDim,marginTop:2}}>Vol <span style={{color:vol>1.5?T.amber:T.textMid}}>{vol.toFixed(1)}x</span></div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[["O",open],["H",high],["L",low],["C",close]].map(([l,v])=>(
            <span key={l} style={{fontSize:8,fontFamily:"monospace",color:T.textDim}}>
              <span style={{color:T.textMid}}>{l}:</span>{Math.round(v)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // TODAY — partial candle + session-in-progress label
  if (day.mode==="today") {
    const {open,high,low,close,prevClose,vol}=day.ohlcv;
    const bull=close>=open;
    const chg=((close-open)/open*100);
    return (
      <div style={{padding:"8px 10px 6px 14px",borderBottom:`1px solid ${T.border}`,background:`${T.teal}04`}}>
        <div style={{fontSize:7,color:T.teal,letterSpacing:2,fontFamily:"'Cinzel',serif",marginBottom:5,display:"flex",alignItems:"center",gap:5}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:T.teal,animation:"nowPulse 1.5s ease-in-out infinite"}}/>
          <span>SESSION IN PROGRESS · 10:15 IST</span>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"flex-end",marginBottom:5}}>
          <OHLCBar ohlcv={day.ohlcv} partial={true} height={72} width={48}/>
          <div>
            <div style={{fontSize:15,fontFamily:"monospace",color:bull?T.green:T.red,fontWeight:700}}>{close.toLocaleString()}</div>
            <div style={{fontSize:9,color:T.teal,fontFamily:"monospace"}}>from open {open.toLocaleString()}</div>
            <div style={{fontSize:10,fontFamily:"monospace",color:bull?T.green:T.red}}>{bull?"+":""}{chg.toFixed(2)}% so far</div>
            <div style={{fontSize:8,color:T.textDim,marginTop:2}}>Vol <span style={{color:T.textMid}}>{vol.toFixed(1)}x (partial)</span></div>
          </div>
        </div>
        <div style={{fontSize:8,color:T.textDim,marginTop:2}}>H:{Math.round(high)} · L:{Math.round(low)} · updating live</div>
      </div>
    );
  }

  // FUTURE — no price data, show watch levels
  if (day.mode==="future") {
    const wl=day.watchLevels;
    return (
      <div style={{padding:"8px 10px 8px 14px",borderBottom:`1px solid ${T.border}`,background:`${T.purple}04`}}>
        <div style={{fontSize:7,color:T.purple,letterSpacing:2,fontFamily:"'Cinzel',serif",marginBottom:8,display:"flex",alignItems:"center",gap:5}}>
          <span style={{fontSize:9}}>◈</span>
          <span>PLANNING MODE · NO PRICE DATA</span>
        </div>
        {wl&&(
          <>
            {wl.resistance.length>0&&(
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <span style={{fontSize:8,color:T.textDim,width:60,fontFamily:"'Cinzel',serif",letterSpacing:1}}>WATCH R</span>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {wl.resistance.map(r=>(
                    <span key={r} style={{fontSize:9,fontFamily:"monospace",color:T.red,padding:"1px 5px",background:`${T.red}10`,borderRadius:3,border:`1px solid ${T.red}25`}}>{r.toLocaleString()}</span>
                  ))}
                </div>
              </div>
            )}
            {wl.support.length>0&&(
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <span style={{fontSize:8,color:T.textDim,width:60,fontFamily:"'Cinzel',serif",letterSpacing:1}}>WATCH S</span>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {wl.support.map(s=>(
                    <span key={s} style={{fontSize:9,fontFamily:"monospace",color:T.green,padding:"1px 5px",background:`${T.green}10`,borderRadius:3,border:`1px solid ${T.green}25`}}>{s.toLocaleString()}</span>
                  ))}
                </div>
              </div>
            )}
            <div style={{fontSize:9,color:T.textMid,lineHeight:1.5,fontStyle:"italic"}}>{wl.note}</div>
          </>
        )}
      </div>
    );
  }
  return null;
}

// ─── SIGNAL PILL ──────────────────────────────────────────────────────────────
function SignalPill({ sig }) {
  const map={
    entry:  {color:T.green,  icon:"▲", bg:T.greenDim},
    avoid:  {color:T.red,    icon:"✕", bg:T.redDim},
    caution:{color:T.amber,  icon:"⚠", bg:T.amberDim},
    plan:   {color:T.purple, icon:"◈", bg:`${T.purple}10`},
    neutral:{color:T.textMid,icon:"◎", bg:"transparent"},
    review: {color:T.teal,   icon:"↺", bg:T.tealDim},
  };
  const m=map[sig.type]||map.neutral;
  return (
    <div style={{display:"flex",gap:5,padding:"4px 7px",borderRadius:4,marginBottom:3,background:m.bg,border:`1px solid ${m.color}20`}}>
      <span style={{fontSize:9,color:m.color,flexShrink:0,marginTop:1}}>{m.icon}</span>
      <span style={{fontSize:9,color:T.textMid,lineHeight:1.5}}>{sig.text}</span>
    </div>
  );
}

// ─── MODE BADGE ───────────────────────────────────────────────────────────────
function ModeBadge({ mode }) {
  const map={
    past:  {label:"REVIEW",  color:T.textMid, bg:`${T.textMid}10`},
    today: {label:"LIVE",    color:T.teal,    bg:`${T.teal}12`},
    future:{label:"PLAN",    color:T.purple,  bg:`${T.purple}12`},
  };
  const m=map[mode];
  return (
    <span style={{fontSize:7,color:m.color,padding:"2px 5px",borderRadius:3,background:m.bg,fontFamily:"'Cinzel',serif",letterSpacing:1,border:`1px solid ${m.color}30`}}>{m.label}</span>
  );
}

// ─── CONFLUENCE DIAL ──────────────────────────────────────────────────────────
function ConfDial({ score }) {
  const color=score>=8?T.green:score>=6?T.amber:score>=4?"#E09040":T.red;
  const r=13,cx=16,cy=16,circ=2*Math.PI*r,arc=circ*0.75;
  return (
    <div style={{display:"flex",alignItems:"center",gap:4}}>
      <svg width={32} height={32} style={{transform:"rotate(135deg)"}}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border} strokeWidth={3} strokeDasharray={`${arc} ${circ}`} strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={`${arc*(score/10)} ${circ}`} strokeLinecap="round"
          style={{filter:`drop-shadow(0 0 3px ${color})`}}/>
      </svg>
      <div style={{marginLeft:-32,width:32,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:8,fontWeight:700,color,fontFamily:"'Cinzel',serif"}}>{score.toFixed(0)}</span>
      </div>
      <div>
        <div style={{fontSize:7,color,fontFamily:"'Cinzel',serif",letterSpacing:1}}>{score>=8?"HIGH":score>=6?"MED":score>=4?"LOW":"AVOID"}</div>
        <div style={{fontSize:6,color:T.textDim}}>{score.toFixed(1)}/10</div>
      </div>
    </div>
  );
}

// ─── DAY COLUMN ───────────────────────────────────────────────────────────────
function DayColumn({ day }) {
  const sign=SIGNS[day.moonSignIdx];
  const isToday=day.mode==="today";
  const isFuture=day.mode==="future";
  const isAvoid=day.pq===0;
  const isHigh=day.confluence>=8;

  const borderColor=isToday?`${T.teal}60`:isHigh?`${T.green}35`:isAvoid?`${T.red}35`:T.border;
  const bgColor=isToday?`${T.teal}04`:isFuture?`${T.purple}03`:T.card;

  return (
    <div style={{
      flex:1, background:bgColor,
      border:`1px solid ${borderColor}`,
      borderRadius:8, display:"flex", flexDirection:"column",
      position:"relative", overflow:"hidden", minWidth:0,
    }}>
      {/* Quality left strip */}
      <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:qC(day.pq),opacity:0.6,borderRadius:"8px 0 0 8px"}}/>

      {/* Header */}
      <div style={{padding:"9px 9px 7px 14px",borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:5}}>
          <div>
            <div style={{fontSize:13,fontFamily:"'Cinzel',serif",color:isToday?T.teal:T.text,lineHeight:1}}>{day.label}</div>
            <div style={{fontSize:8,color:T.textDim,marginTop:2,letterSpacing:1}}>{day.dow}</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
            <ModeBadge mode={day.mode}/>
            <span style={{fontSize:14}}>{day.moonPhase}</span>
          </div>
        </div>

        {/* Moon sign */}
        <div style={{display:"flex",alignItems:"center",gap:3,marginBottom:5}}>
          {day.moonSignChange?(
            <div style={{display:"flex",alignItems:"center",gap:3,padding:"2px 6px",borderRadius:4,background:`${SIGNS[day.moonSignChange.toIdx].c}12`,border:`1px solid ${SIGNS[day.moonSignChange.toIdx].c}25`}}>
              <span style={{fontSize:9,color:SIGNS[day.moonSignChange.fromIdx].c}}>{SIGNS[day.moonSignChange.fromIdx].s}</span>
              <span style={{fontSize:8,color:T.textDim}}>→</span>
              <span style={{fontSize:9,color:SIGNS[day.moonSignChange.toIdx].c}}>{SIGNS[day.moonSignChange.toIdx].s}</span>
              <span style={{fontSize:7,color:SIGNS[day.moonSignChange.toIdx].c}}>{day.moonSignChange.time}</span>
            </div>
          ):(
            <div style={{display:"flex",alignItems:"center",gap:3,padding:"2px 6px",borderRadius:4,background:`${sign.c}12`,border:`1px solid ${sign.c}25`}}>
              <span style={{fontSize:9,color:sign.c}}>{sign.s}</span>
              <span style={{fontSize:8,color:sign.c,fontFamily:"'Cinzel',serif"}}>{sign.n}</span>
              <span style={{fontSize:7,color:T.textDim}}>{sign.e}</span>
            </div>
          )}
        </div>

        <ConfDial score={day.confluence}/>
      </div>

      {/* Price area — switches by mode */}
      <PriceArea day={day}/>

      {/* Panchang session band */}
      <div style={{padding:"0 9px 0 14px",borderBottom:`1px solid ${T.border}`}}>
        <div style={{fontSize:7,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif",padding:"4px 0 2px"}}>SESSION · UJJAIN</div>
        <PanchangVertical day={day} height={160}/>
      </div>

      {/* Panchang text */}
      <div style={{padding:"6px 9px 6px 14px",borderBottom:`1px solid ${T.border}`}}>
        {[
          {l:"Tithi",    v:day.tithi,     ch:day.tithiChange},
          {l:"Nakshatra",v:day.nakshatra, ch:day.nakshatraChange},
          {l:"Yoga",     v:day.yoga,      ch:day.yogaChange},
        ].map(row=>(
          <div key={row.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
            <div style={{display:"flex",gap:6,alignItems:"baseline"}}>
              <span style={{fontSize:7,color:T.textDim,fontFamily:"'Cinzel',serif",width:52,flexShrink:0}}>{row.l.toUpperCase()}</span>
              <span style={{fontSize:9,color:T.text}}>{row.v||"—"}</span>
            </div>
            {row.ch&&<span style={{fontSize:7,color:T.gold,flexShrink:0}}>⚡ {row.ch}</span>}
          </div>
        ))}
      </div>

      {/* Events */}
      {day.events.length>0&&(
        <div style={{padding:"5px 9px 5px 14px",borderBottom:`1px solid ${T.border}`}}>
          {day.events.map((ev,i)=>{
            const pl=P[ev.planet];
            return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:5,padding:"3px 6px",borderRadius:3,background:`${bC(ev.bias)}10`,border:`1px solid ${bC(ev.bias)}25`,marginBottom:2}}>
                <span style={{fontSize:12,color:pl?.c}}>{pl?.s}</span>
                <span style={{fontSize:8,color:bC(ev.bias),fontFamily:"'Cinzel',serif"}}>{ev.type}</span>
                {ev.time&&<span style={{fontSize:7,color:T.textDim,marginLeft:"auto"}}>{ev.time}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Signals */}
      <div style={{padding:"6px 9px 8px 14px",flex:1}}>
        {day.signals.map((sig,i)=><SignalPill key={i} sig={sig}/>)}
      </div>

      {/* Quality footer */}
      <div style={{padding:"5px 9px 5px 14px",background:qBg(day.pq),borderTop:`1px solid ${qC(day.pq)}20`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:8,fontFamily:"'Cinzel',serif",color:qC(day.pq),letterSpacing:1}}>{qL(day.pq).toUpperCase()}</span>
        <div style={{display:"flex",gap:2}}>
          {[0,1,2,3].map(n=><div key={n} style={{width:5,height:5,borderRadius:1,background:n<=day.pq?qC(day.pq):T.border}}/>)}
        </div>
      </div>
    </div>
  );
}

// ─── WEEK SUMMARY BAR ─────────────────────────────────────────────────────────
function WeekSummaryBar({ week, weekKey }) {
  const days=week.days;
  const past=days.filter(d=>d.mode==="past");
  const future=days.filter(d=>d.mode==="future"||d.mode==="today");
  const avoidDays=days.filter(d=>d.pq===0);
  const highDays=days.filter(d=>d.confluence>=8);

  return (
    <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:"10px 16px",display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
      {/* Backdrop */}
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",background:`${week.backdrop.color}10`,border:`1px solid ${week.backdrop.color}25`,borderRadius:6}}>
        <span style={{fontSize:15,color:week.backdrop.color}}>{P[week.backdrop.planet]?.s}</span>
        <div>
          <div style={{fontSize:9,color:week.backdrop.color,fontFamily:"'Cinzel',serif",letterSpacing:1}}>{week.backdrop.note}</div>
          <div style={{fontSize:8,color:T.textDim}}>{P[week.backdrop.planet]?.n} in {week.backdrop.sign}</div>
        </div>
      </div>
      <div style={{width:1,height:30,background:T.border}}/>
      {/* Mode summary */}
      <div style={{display:"flex",gap:8}}>
        {past.length>0&&<div style={{textAlign:"center",padding:"4px 10px",background:`${T.textMid}10`,border:`1px solid ${T.textMid}20`,borderRadius:4}}>
          <div style={{fontSize:7,color:T.textDim,letterSpacing:1,fontFamily:"'Cinzel',serif"}}>REVIEW</div>
          <div style={{fontSize:12,color:T.textMid,fontFamily:"'Cinzel',serif"}}>{past.length} days</div>
        </div>}
        {days.find(d=>d.mode==="today")&&<div style={{textAlign:"center",padding:"4px 10px",background:`${T.teal}10`,border:`1px solid ${T.teal}25`,borderRadius:4}}>
          <div style={{fontSize:7,color:T.teal,letterSpacing:1,fontFamily:"'Cinzel',serif"}}>LIVE</div>
          <div style={{fontSize:12,color:T.teal,fontFamily:"'Cinzel',serif"}}>today</div>
        </div>}
        {future.filter(d=>d.mode==="future").length>0&&<div style={{textAlign:"center",padding:"4px 10px",background:`${T.purple}10`,border:`1px solid ${T.purple}25`,borderRadius:4}}>
          <div style={{fontSize:7,color:T.purple,letterSpacing:1,fontFamily:"'Cinzel',serif"}}>PLAN</div>
          <div style={{fontSize:12,color:T.purple,fontFamily:"'Cinzel',serif"}}>{future.filter(d=>d.mode==="future").length} days</div>
        </div>}
      </div>
      <div style={{width:1,height:30,background:T.border}}/>
      {/* Stats */}
      {[
        {l:"HIGH CONF",  v:highDays.length+" days",  c:T.green},
        {l:"AVOID",      v:avoidDays.length+" days",  c:avoidDays.length>0?T.red:T.textDim},
      ].map(s=>(
        <div key={s.l} style={{textAlign:"center"}}>
          <div style={{fontSize:7,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif"}}>{s.l}</div>
          <div style={{fontSize:12,color:s.c,fontFamily:"'Cinzel',serif",marginTop:2}}>{s.v}</div>
        </div>
      ))}
      {/* Past performance if available */}
      {week.summary.ret&&(
        <>
          <div style={{width:1,height:30,background:T.border}}/>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:7,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif"}}>WEEK RETURN</div>
            <div style={{fontSize:14,color:week.summary.ret.startsWith("+")?T.green:T.red,fontFamily:"'Cinzel',serif",marginTop:2,fontWeight:700}}>{week.summary.ret}</div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:7,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif"}}>BEST ENTRY</div>
            <div style={{fontSize:11,color:T.green,marginTop:2}}>{week.summary.bestDay} ({week.summary.bestConf})</div>
          </div>
        </>
      )}
      {/* Future week note */}
      {!week.summary.ret&&future.length===5&&(
        <div style={{marginLeft:"auto",fontSize:9,color:T.textDim,fontStyle:"italic"}}>No price data — planning mode only</div>
      )}
    </div>
  );
}

// ─── SWING RADAR ──────────────────────────────────────────────────────────────
function SwingRadar({ days }) {
  const entries=days.filter(d=>d.signals.some(s=>s.type==="entry")&&d.confluence>=7);
  const avoids=days.filter(d=>d.pq===0);
  const plans=days.filter(d=>d.mode==="future"&&d.signals.some(s=>s.type==="plan"));
  const moonChanges=days.filter(d=>d.moonSignChange);

  const cols=[
    {label:entries.length?"HIGH CONV ENTRIES":"NO ENTRIES ≥7",color:T.green,
     items:entries.map(d=>`${d.label} (${d.confluence.toFixed(1)}) — ${d.signals.find(s=>s.type==="entry")?.text.slice(0,55)}…`)},
    {label:"STAND ASIDE",color:T.red,
     items:avoids.length?avoids.map(d=>`${d.label} — ${d.signals.find(s=>s.type==="avoid")?.text.slice(0,55)}…`):["No avoid days this week"]},
    {label:"TRADING PLAN",color:T.purple,
     items:plans.length?plans.map(d=>`${d.label} — ${d.signals.find(s=>s.type==="plan")?.text.slice(0,55)}…`):["No future planning days"]},
    {label:"MOON TRANSITIONS",color:T.moon,
     items:moonChanges.length?moonChanges.map(d=>`${d.label} — ${SIGNS[d.moonSignChange.fromIdx].n} → ${SIGNS[d.moonSignChange.toIdx].n} at ${d.moonSignChange.time}`):["No sign changes this week"]},
  ];

  return (
    <div style={{background:T.surface,borderTop:`1px solid ${T.border}`,padding:"10px 16px 14px",flexShrink:0}}>
      <div style={{fontSize:8,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif",marginBottom:8}}>SWING RADAR</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
        {cols.map(col=>(
          <div key={col.label} style={{background:T.card,border:`1px solid ${col.color}18`,borderRadius:5,padding:9}}>
            <div style={{fontSize:7,color:col.color,fontFamily:"'Cinzel',serif",letterSpacing:1,marginBottom:7}}>{col.label}</div>
            {col.items.map((t,i)=>(
              <div key={i} style={{fontSize:9,color:T.textMid,lineHeight:1.5,marginBottom:4,paddingLeft:6,borderLeft:`2px solid ${col.color}40`}}>{t}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
export default function FinastroScreen2() {
  const [selWeek, setSelWeek] = useState("W4 · May 19–23");
  const week = WEEK_DATA[selWeek];

  const css=`
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Text:ital,wght@0,400;1,400&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    ::-webkit-scrollbar{width:4px;height:4px;}
    ::-webkit-scrollbar-track{background:${T.bg};}
    ::-webkit-scrollbar-thumb{background:${T.borderHi};border-radius:2px;}
    @keyframes fadeIn{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);}}
    @keyframes nowPulse{0%,100%{opacity:1;box-shadow:0 0 5px ${T.teal};}50%{opacity:0.5;box-shadow:0 0 10px ${T.teal};}}
    @keyframes twinkle{from{opacity:0.02;}to{opacity:0.22;}}
  `;

  return (
    <div style={{background:T.bg,minHeight:"100vh",fontFamily:"'Crimson Text',Georgia,serif",color:T.text,display:"flex",flexDirection:"column"}}>
      <style>{css}</style>

      {/* Stars */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
        {Array.from({length:50},(_,i)=>(
          <div key={i} style={{position:"absolute",left:`${(i*19.3)%100}%`,top:`${(i*13.7)%100}%`,width:(i%3)*0.4+0.4,height:(i%3)*0.4+0.4,borderRadius:"50%",background:"#fff",opacity:0.02+((i%4)*0.04),animation:`twinkle ${2+(i%6)}s ease-in-out infinite alternate`,animationDelay:`${(i%5)*0.5}s`}}/>
        ))}
      </div>

      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",height:"100vh"}}>

        {/* Header */}
        <div style={{padding:"10px 16px",background:T.surface,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:18,color:T.gold,filter:`drop-shadow(0 0 8px ${T.gold})`}}>✦</span>
            <div>
              <span style={{fontSize:16,fontFamily:"'Cinzel',serif",fontWeight:900,color:T.gold,letterSpacing:4}}>FINASTRO</span>
              <span style={{fontSize:10,color:T.textDim,marginLeft:12,letterSpacing:2}}>WEEKLY · SWING VIEW</span>
            </div>
          </div>
          {/* Mode legend */}
          <div style={{display:"flex",gap:8,alignItems:"center",marginRight:16}}>
            {[
              {color:T.textMid, label:"↺ REVIEW — historical"},
              {color:T.teal,    label:"● LIVE — session open"},
              {color:T.purple,  label:"◈ PLAN — no price data"},
            ].map(m=>(
              <div key={m.label} style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:m.color}}/>
                <span style={{fontSize:8,color:T.textDim}}>{m.label}</span>
              </div>
            ))}
          </div>
          {/* Week selector */}
          <div style={{display:"flex",gap:4}}>
            {WEEKS.map(w=>(
              <button key={w} onClick={()=>setSelWeek(w)}
                style={{padding:"5px 11px",background:selWeek===w?T.card:"transparent",border:`1px solid ${selWeek===w?T.borderHi:T.border}`,borderRadius:4,color:selWeek===w?T.gold:T.textDim,fontSize:9,fontFamily:"'Cinzel',serif",letterSpacing:0.5,cursor:"pointer",transition:"all 0.15s"}}>
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* Week summary */}
        {week&&<WeekSummaryBar week={week} weekKey={selWeek}/>}

        {/* Day columns */}
        <div style={{flex:1,overflow:"auto",padding:"10px 12px 0",display:"flex",flexDirection:"column",gap:0}}>
          {week?(
            <div style={{display:"flex",gap:6,flex:1,animation:"fadeIn 0.3s ease",minHeight:0}}>
              {week.days.map((day,i)=>(
                <DayColumn key={i} day={day}/>
              ))}
            </div>
          ):(
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{color:T.textDim,fontFamily:"'Cinzel',serif"}}>Select a week</span>
            </div>
          )}
        </div>

        {/* Swing radar */}
        {week&&<SwingRadar days={week.days}/>}

        {/* Footer */}
        <div style={{padding:"6px 16px",background:T.surface,borderTop:`1px solid ${T.border}`,display:"flex",gap:14,alignItems:"center",flexShrink:0,flexWrap:"wrap"}}>
          <span style={{fontSize:7,color:T.textDim,letterSpacing:2,fontFamily:"'Cinzel',serif"}}>LEGEND</span>
          {[[T.green,"Favorable"],[T.amber,"Neutral"],["#E09040","Caution"],[T.red,"Avoid"]].map(([c,l])=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:3}}>
              <div style={{width:3,height:12,background:c,borderRadius:1}}/>
              <span style={{fontSize:7,color:T.textDim}}>{l}</span>
            </div>
          ))}
          <div style={{width:1,height:10,background:T.border}}/>
          {[{i:"☊",c:T.red,l:"Rahu Kala"},{i:"☀",c:T.green,l:"Abhijit"},{i:"⚡",c:T.gold,l:"Changeover"},{i:"▲",c:T.green,l:"Entry"},{i:"✕",c:T.red,l:"Avoid"},{i:"◈",c:T.purple,l:"Plan"},{i:"↺",c:T.teal,l:"Review outcome"}].map(x=>(
            <div key={x.l} style={{display:"flex",alignItems:"center",gap:3}}>
              <span style={{fontSize:9,color:x.c}}>{x.i}</span>
              <span style={{fontSize:7,color:T.textDim}}>{x.l}</span>
            </div>
          ))}
          <div style={{marginLeft:"auto",fontSize:7,color:T.textDim,fontFamily:"'Cinzel',serif",letterSpacing:1}}>UJJAIN 23°10'N · LAHIRI · SIDEREAL · IST · TODAY: 21 MAY 2026 10:15</div>
        </div>
      </div>
    </div>
  );
}
