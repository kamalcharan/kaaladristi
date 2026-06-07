import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// FINASTRO — SPRINT 3: ALERT LAYER
// File: finastro_alerts.jsx
// Contains: Alert config screen · Alert feed · Alert history · Bell header
// Alert types: Time-based · Condition-based · Rotation change · Changeover warning
// Delivery: In-app only (WhatsApp via MSG91 in future sprint)
// ═══════════════════════════════════════════════════════════════════════════

// ─── COLOUR TOKENS ────────────────────────────────────────────────────────
const C = {
  bg:"#0A0C0F", panel:"#0F1216", border:"#1C2028", borderBright:"#2A3040",
  gold:"#C9A84C", goldDim:"#7A6230",
  green:"#4CAF8A", greenDim:"#2A5A42",
  red:"#E86060", redDim:"#5A2828",
  amber:"#E89040", amberDim:"#6B4520",
  teal:"#40B8C8", tealDim:"#1C5A64",
  purple:"#9B6BC0", purpleDim:"#4A2870",
  text:"#D8DDE8", textDim:"#6A7280", textMid:"#A8B0C0",
};

// ─── ALERT TYPE DEFINITIONS ───────────────────────────────────────────────
const ALERT_TYPES = [
  // TIME-BASED
  { id:"abhijit_start",     category:"time",      label:"Abhijit Window Opens",      desc:"11:48 IST — Best execution window begins",   icon:"☀", color:C.green,  tier:"validated", n:198, p:0.042, default_lead:8,  unit:"min" },
  { id:"abhijit_end",       category:"time",      label:"Abhijit Window Closes",     desc:"12:36 IST — Execution window ends",           icon:"☀", color:C.green,  tier:"validated", n:198, p:0.042, default_lead:5,  unit:"min" },
  { id:"rahu_start",        category:"time",      label:"Rahu Kala Begins",          desc:"Inauspicious window — no new entries",        icon:"☊", color:C.red,    tier:"validated", n:312, p:0.018, default_lead:8,  unit:"min" },
  { id:"rahu_end",          category:"time",      label:"Rahu Kala Ends",            desc:"Inauspicious window closes — normal trading", icon:"☊", color:C.amber,  tier:"validated", n:312, p:0.018, default_lead:3,  unit:"min" },
  { id:"tithi_change",      category:"time",      label:"Tithi Changeover",          desc:"Lunar day changes within session",            icon:"🌙", color:C.gold,   tier:"validated", n:2184,p:0.031, default_lead:5,  unit:"min" },
  { id:"yoga_change",       category:"time",      label:"Yoga Changeover",           desc:"Yoga changes — quality may shift",           icon:"⚡", color:C.gold,   tier:"validated", n:2184,p:0.031, default_lead:5,  unit:"min" },
  { id:"session_open",      category:"time",      label:"Session Opens (09:15)",     desc:"NSE market opens",                           icon:"▶", color:C.teal,   tier:"validated", n:0,   p:null,  default_lead:10, unit:"min" },
  { id:"session_close",     category:"time",      label:"Session Close Warning",     desc:"15:15 IST — 15 min before close",            icon:"◼", color:C.amber,  tier:"validated", n:0,   p:null,  default_lead:15, unit:"min" },

  // CONDITION-BASED
  { id:"score_threshold",   category:"condition", label:"Stock Score ≥ Threshold",   desc:"Any stock in watchlist hits target score",   icon:"★", color:C.gold,   tier:"validated", n:0,   p:null,  default_lead:0,  unit:null },
  { id:"lp_fin_aligned",    category:"condition", label:"LuckyPop + Finastro Aligned",desc:"LuckyPop BUY + Panchang FAVORABLE",         icon:"▲▲",color:C.green,  tier:"validated", n:0,   p:null,  default_lead:0,  unit:null },
  { id:"lp_fin_conflict",   category:"condition", label:"LuckyPop × Panchang AVOID", desc:"LuckyPop BUY during AVOID — conflict alert", icon:"⚠", color:C.red,    tier:"validated", n:486, p:0.028, default_lead:0,  unit:null },
  { id:"vol_spike",         category:"condition", label:"Volume Spike >1.5x",        desc:"RVOL exceeds threshold on watchlist stock",  icon:"📊", color:C.teal,   tier:"indicative",n:0,   p:null,  default_lead:0,  unit:null },
  { id:"favorable_session", category:"condition", label:"Favorable Session Day",     desc:"sessionQuality = 3 at 09:00",                icon:"✦", color:C.green,  tier:"validated", n:2184,p:0.031, default_lead:30, unit:"min" },
  { id:"avoid_session",     category:"condition", label:"Avoid Session Day",         desc:"sessionQuality = 0 — stand aside all day",   icon:"✕", color:C.red,    tier:"validated", n:486, p:0.028, default_lead:30, unit:"min" },
  { id:"vyatipata_yoga",    category:"condition", label:"Vyatipata / Vaidhriti Yoga",desc:"Most inauspicious yogas — AVOID",            icon:"⚠", color:C.red,    tier:"validated", n:2184,p:0.031, default_lead:30, unit:"min" },

  // ROTATION CHANGE
  { id:"sector_entering",   category:"rotation",  label:"Sector Enters ENTERING",   desc:"New sector gets planetary tailwind",          icon:"◉", color:C.teal,   tier:"indicative",n:0,   p:null,  default_lead:0,  unit:null },
  { id:"sector_leading",    category:"rotation",  label:"Sector Becomes LEADING",   desc:"Phase upgrade — momentum + astro aligned",   icon:"▲", color:C.green,  tier:"indicative",n:0,   p:null,  default_lead:0,  unit:null },
  { id:"sector_peaking",    category:"rotation",  label:"Sector Hits PEAKING",      desc:"Smart money exiting — trail stops now",      icon:"⬆", color:C.gold,   tier:"indicative",n:0,   p:null,  default_lead:0,  unit:null },
  { id:"sector_rotating",   category:"rotation",  label:"Sector Starts ROTATING OUT",desc:"Exit signal — tighten stops",               icon:"↓", color:C.amber,  tier:"validated", n:58,  p:0.048, default_lead:0,  unit:null },
  { id:"mercury_retro",     category:"rotation",  label:"Mercury Retrograde Starts", desc:"IT/Telecom execution risk begins",           icon:"☿", color:C.amber,  tier:"validated", n:72,  p:0.044, default_lead:0,  unit:null },
  { id:"jupiter_sign",      category:"rotation",  label:"Jupiter Sign Change",       desc:"Major structural shift — sector rotation",  icon:"♃", color:C.gold,   tier:"indicative",n:3,   p:null,  default_lead:0,  unit:null },
];

const CATEGORY_LABELS = { time:"⏱ TIME-BASED", condition:"◎ CONDITION", rotation:"⬡ ROTATION" };
const CATEGORY_COLORS = { time:C.teal, condition:C.gold, rotation:C.purple };

const RAHU_KALA = {
  1:{start:"07:30",end:"09:00"}, 2:{start:"15:00",end:"16:30"},
  3:{start:"12:00",end:"13:30"}, 4:{start:"13:30",end:"15:00"},
  5:{start:"10:30",end:"12:00"}, 6:{start:"09:00",end:"10:30"},
};
const ABHIJIT = { start:"11:48", end:"12:36" };

// ─── MOCK WATCHLIST ───────────────────────────────────────────────────────
const WATCHLIST = [
  { symbol:"HINDUNILVR", sector:"FMCG",      score:7.1, tech:6.2, rotation:"ENTERING" },
  { symbol:"SBIBANK",    sector:"PSU Banks", score:8.4, tech:7.8, rotation:"LEADING"  },
  { symbol:"SUNPHARMA",  sector:"Pharma",    score:6.8, tech:6.1, rotation:"PEAKING"  },
  { symbol:"TCS",        sector:"IT",        score:4.1, tech:5.2, rotation:"ROTATING OUT" },
  { symbol:"RELIANCE",   sector:"Energy",    score:3.2, tech:3.9, rotation:"NEGLECTED"},
  { symbol:"TATAMOTORS", sector:"Auto",      score:4.8, tech:5.6, rotation:"ROTATING OUT"},
];

// ─── GENERATE MOCK ALERT FEED ─────────────────────────────────────────────
function generateAlertFeed() {
  const now = new Date();
  const today = now.toISOString().slice(0,10);
  const hhmm = (h,m) => `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;

  const fired = [
    { id:1,  type_id:"favorable_session",  fired_at:`${today} 08:45:00`, priority:"HIGH",
      title:"✦ FAVORABLE SESSION", body:"sessionQuality = 3 today. Panchang: Dashami Tithi · Pushya Nakshatra · Siddhi Yoga. High-conviction entry window.", read:false, source:"panchang" },
    { id:2,  type_id:"session_open",       fired_at:`${today} 09:05:00`, priority:"MED",
      title:"▶ SESSION OPENS 09:15", body:"NSE market open in 10 min. Today: FAVORABLE. Rahu Kala: 10:30–12:00. Abhijit: 11:48–12:36.", read:false, source:"time" },
    { id:3,  type_id:"score_threshold",    fired_at:`${today} 09:22:00`, priority:"HIGH",
      title:"★ SBIBANK SCORE 8.4", body:"SBIBANK crossed score threshold 8.0. Tech: 7.8 · Rotation: LEADING (♃ Jupiter Cancer) · Panchang: +0.6. Action: Enter with trailing stop.", read:false, source:"condition" },
    { id:4,  type_id:"vol_spike",          fired_at:`${today} 10:05:00`, priority:"MED",
      title:"📊 HINDUNILVR RVOL 1.8x", body:"Volume spike on HINDUNILVR. RVOL = 1.8x average. FMCG sector ENTERING phase. Panchang FAVORABLE. Possible genuine breakout setup.", read:true, source:"condition" },
    { id:5,  type_id:"rahu_start",         fired_at:`${today} 10:22:00`, priority:"CRITICAL",
      title:"☊ RAHU KALA IN 8 MIN", body:"Rahu Kala begins 10:30. No new entries. Tighten stops on open positions. Validated: n=312, p=0.018. Window ends 12:00.", read:false, source:"time" },
    { id:6,  type_id:"yoga_change",        fired_at:`${today} 10:45:00`, priority:"MED",
      title:"⚡ YOGA CHANGES AT 11:15", body:"Yoga shifts from Siddhi (favorable) to Shula (caution) at 11:15 IST. Tighten stops 5 min before. Quality downgrade during Rahu Kala window.", read:true, source:"time" },
    { id:7,  type_id:"abhijit_start",      fired_at:`${today} 11:40:00`, priority:"HIGH",
      title:"☀ ABHIJIT OPENS IN 8 MIN", body:"Abhijit Muhurta starts 11:48. Best execution window of the day. 48-minute window. Validated: n=198, p=0.042. Best for large entries.", read:false, source:"time" },
    { id:8,  type_id:"lp_fin_aligned",     fired_at:`${today} 11:52:00`, priority:"HIGH",
      title:"▲▲ LP+FIN ALIGNED — SBIBANK", body:"LuckyPop BUY signal + Finastro FAVORABLE + Abhijit active. Highest conviction setup. Combined score: 9.1. Sector: LEADING. Full size entry.", read:false, source:"condition" },
    { id:9,  type_id:"rahu_end",           fired_at:`${today} 11:58:00`, priority:"MED",
      title:"☊ RAHU KALA ENDS IN 2 MIN", body:"Rahu Kala closes at 12:00. Normal trading resumes. Abhijit still active (until 12:36). Re-entry window now open.", read:true, source:"time" },
    { id:10, type_id:"tithi_change",       fired_at:`${today} 13:35:00`, priority:"MED",
      title:"🌙 TITHI CHANGES AT 13:40", body:"Tithi shifts from Ekadashi to Dwadashi at 13:40. Both auspicious — quality maintained. No action needed.", read:true, source:"time" },
    { id:11, type_id:"lp_fin_conflict",    fired_at:`${today} 14:10:00`, priority:"CRITICAL",
      title:"⚠ CONFLICT — TCS BUY vs AVOID", body:"LuckyPop BUY on TCS during Vaidhriti Yoga window. Mercury Retro active. Panchang signals AVOID. Skip this trade. Validated override: n=486, p=0.028.", read:false, source:"condition" },
    { id:12, type_id:"session_close",      fired_at:`${today} 15:14:00`, priority:"MED",
      title:"◼ SESSION CLOSE IN 15 MIN", body:"Market closes 15:30. Tighten stops. Today was FAVORABLE — 3 alerts fired with n≥30 validated signals.", read:true, source:"time" },
  ];

  // Yesterday's alerts
  const yesterday = new Date(now - 86400000).toISOString().slice(0,10);
  const past = [
    { id:13, type_id:"mercury_retro",  fired_at:`${yesterday} 08:30:00`, priority:"HIGH",
      title:"☿ MERCURY RETROGRADE STARTS", body:"Mercury stations retrograde in Gemini (May 29). IT/Telecom execution risk begins. Exit IT positions before market open. Mercury Retro × IT: validated n=72, p=0.044.", read:true, source:"rotation" },
    { id:14, type_id:"sector_entering", fired_at:`${yesterday} 07:00:00`, priority:"MED",
      title:"◉ FMCG ENTERS ENTERING PHASE", body:"Jupiter enters Cancer (May 14). FMCG sector rotation phase: ENTERING. Accumulate selectively. 4–6 week price lag expected. n=3, indicative only.", read:true, source:"rotation" },
    { id:15, type_id:"avoid_session",  fired_at:`${yesterday} 08:45:00`, priority:"CRITICAL",
      title:"✕ AVOID — VAIDHRITI YOGA", body:"Today: Vaidhriti Yoga (most inauspicious). sessionQuality = 0. Stand aside all day. No entries. Validated: n=2184, p=0.031.", read:true, source:"panchang" },
  ];

  return { today: fired, past };
}

// ─── DEFAULT CONFIG ────────────────────────────────────────────────────────
function defaultConfig() {
  const enabled = {};
  const leadTime = {};
  const scoreThreshold = {};
  ALERT_TYPES.forEach(t => {
    enabled[t.id] = ["favorable_session","avoid_session","rahu_start","abhijit_start",
      "tithi_change","yoga_change","score_threshold","lp_fin_conflict","mercury_retro",
      "vyatipata_yoga"].includes(t.id);
    leadTime[t.id] = t.default_lead || 0;
  });
  WATCHLIST.forEach(w => { scoreThreshold[w.symbol] = 7.5; });
  return { enabled, leadTime, scoreThreshold,
    delivery:{ inApp:true, whatsapp:false, whatsappNote:"WhatsApp via MSG91 — Sprint 5" },
    watchlist: WATCHLIST.map(w => w.symbol),
  };
}

const TABS = ["🔔 FEED", "⚙ CONFIG", "📋 HISTORY", "◎ SCHEDULE"];

export default function FinastroAlerts() {
  const [tab, setTab] = useState(0);
  const [config, setConfig] = useState(defaultConfig());
  const [feed, setFeed] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [time, setTime] = useState(new Date());
  const [testFlash, setTestFlash] = useState(null);

  useEffect(() => {
    const f = generateAlertFeed();
    setFeed(f);
    setUnreadCount(f.today.filter(a=>!a.read).length);
  }, []);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const markRead = (id) => {
    setFeed(f => {
      const newToday = f.today.map(a => a.id === id ? {...a, read:true} : a);
      const newPast = f.past.map(a => a.id === id ? {...a, read:true} : a);
      setUnreadCount(newToday.filter(a=>!a.read).length);
      return {...f, today:newToday, past:newPast};
    });
  };

  const markAllRead = () => {
    setFeed(f => ({
      ...f,
      today: f.today.map(a=>({...a,read:true})),
      past: f.past.map(a=>({...a,read:true})),
    }));
    setUnreadCount(0);
  };

  const toggleEnabled = (id) => {
    setConfig(c => ({...c, enabled:{...c.enabled, [id]:!c.enabled[id]}}));
  };
  const setLead = (id, val) => {
    setConfig(c => ({...c, leadTime:{...c.leadTime, [id]:Number(val)}}));
  };
  const setThreshold = (sym, val) => {
    setConfig(c => ({...c, scoreThreshold:{...c.scoreThreshold, [sym]:Number(val)}}));
  };

  const fireTestAlert = () => {
    setTestFlash({ id:99, type_id:"score_threshold", fired_at:new Date().toISOString().replace("T"," ").slice(0,19),
      priority:"HIGH", title:"★ TEST ALERT — HINDUNILVR 7.8",
      body:"Test alert fired from Config. HINDUNILVR crossed threshold 7.5. Tech: 6.2 · Rotation: ENTERING · Panchang: FAVORABLE.",
      read:false, source:"condition" });
    setTimeout(() => setTestFlash(null), 4000);
  };

  const now_ist = time.toLocaleTimeString("en-IN", {timeZone:"Asia/Kolkata", hour12:false});
  const dow = time.getDay();
  const rahuToday = RAHU_KALA[dow];
  const inRahu = rahuToday && now_ist >= rahuToday.start && now_ist <= rahuToday.end;
  const inAbhijit = now_ist >= ABHIJIT.start && now_ist <= ABHIJIT.end;

  const st = {
    root:{fontFamily:"'DM Mono','Courier New',monospace", background:C.bg, color:C.text,
      minHeight:"100vh", fontSize:"13px"},
    hdr:{background:C.panel, borderBottom:`1px solid ${C.border}`,
      padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between"},
    tab:(a)=>({padding:"10px 18px", cursor:"pointer", fontSize:"11px",
      letterSpacing:"0.06em", fontWeight:"600", background:"transparent", border:"none",
      borderBottom:`2px solid ${a?C.gold:"transparent"}`, color:a?C.gold:C.textDim,
      transition:"all 0.15s"}),
    card:{background:C.panel, border:`1px solid ${C.border}`, borderRadius:"4px", padding:"16px"},
    pill:(a,col)=>({padding:"5px 12px", borderRadius:"3px", cursor:"pointer", fontSize:"10px",
      letterSpacing:"0.06em", fontWeight:"600",
      border:`1px solid ${a?(col||C.gold)+"60":C.border}`,
      background:a?(col||C.gold)+"18":"transparent",
      color:a?(col||C.gold):C.textDim, transition:"all 0.15s"}),
  };

  const priorityColor = p => p==="CRITICAL"?C.red:p==="HIGH"?C.amber:C.textMid;

  const filteredFeed = feed ? feed.today.filter(a => {
    if (filterPriority !== "all" && a.priority !== filterPriority) return false;
    if (filterSource !== "all" && a.source !== filterSource) return false;
    return true;
  }) : [];

  return (
    <div style={st.root}>
      {/* TEST FLASH */}
      {testFlash && (
        <div style={{position:"fixed", top:"16px", right:"16px", zIndex:1000,
          background:C.panel, border:`1px solid ${C.amber}`, borderRadius:"6px",
          padding:"14px 18px", minWidth:"320px", boxShadow:"0 4px 20px #00000060",
          animation:"slideIn 0.2s ease"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center",
            marginBottom:"6px"}}>
            <span style={{color:C.amber, fontWeight:"700", fontSize:"12px"}}>
              {testFlash.title}
            </span>
            <span style={{fontSize:"9px", color:C.textDim}}>NOW</span>
          </div>
          <div style={{fontSize:"11px", color:C.textMid, lineHeight:"1.5"}}>
            {testFlash.body}
          </div>
          <div style={{marginTop:"8px", height:"3px", borderRadius:"2px",
            background:C.border, overflow:"hidden"}}>
            <div style={{height:"100%", background:C.amber, borderRadius:"2px",
              animation:"shrink 4s linear forwards"}}/>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={st.hdr}>
        <div>
          <div style={{fontFamily:"'Cinzel',serif", fontSize:"17px", color:C.gold,
            letterSpacing:"0.15em"}}>FINASTRO · ALERT LAYER</div>
          <div style={{fontSize:"10px", color:C.textDim, letterSpacing:"0.1em"}}>
            Sprint 3 · In-App Delivery · WhatsApp MSG91 in Sprint 5
          </div>
        </div>

        {/* Live context strip */}
        <div style={{display:"flex", gap:"10px", alignItems:"center"}}>
          <div style={{fontSize:"12px", color:C.gold, fontFamily:"monospace"}}>{now_ist} IST</div>
          {inRahu && (
            <div style={{padding:"4px 10px", background:C.redDim, border:`1px solid ${C.red}60`,
              borderRadius:"3px", fontSize:"10px", color:C.red, fontWeight:"700"}}>
              ☊ RAHU KALA ACTIVE
            </div>
          )}
          {inAbhijit && (
            <div style={{padding:"4px 10px", background:C.greenDim, border:`1px solid ${C.green}60`,
              borderRadius:"3px", fontSize:"10px", color:C.green, fontWeight:"700"}}>
              ☀ ABHIJIT ACTIVE
            </div>
          )}
          {!inRahu && !inAbhijit && (
            <div style={{padding:"4px 10px", background:C.tealDim, border:`1px solid ${C.teal}40`,
              borderRadius:"3px", fontSize:"10px", color:C.teal}}>
              ◎ SESSION NORMAL
            </div>
          )}
          {/* Bell */}
          <div style={{position:"relative", cursor:"pointer",
            padding:"8px 12px", background:unreadCount>0?C.amberDim+"44":C.panel,
            border:`1px solid ${unreadCount>0?C.amber+"60":C.border}`, borderRadius:"3px"}}
            onClick={()=>{ setTab(0); markAllRead(); }}>
            <span style={{fontSize:"16px"}}>🔔</span>
            {unreadCount > 0 && (
              <div style={{position:"absolute", top:"-4px", right:"-4px",
                background:C.red, color:"white", borderRadius:"50%",
                width:"16px", height:"16px", fontSize:"9px", fontWeight:"700",
                display:"flex", alignItems:"center", justifyContent:"center"}}>
                {unreadCount}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{display:"flex", borderBottom:`1px solid ${C.border}`,
        padding:"0 24px", background:C.panel}}>
        {TABS.map((t,i) => (
          <button key={i} onClick={()=>setTab(i)} style={st.tab(tab===i)}>
            {t}
            {i===0 && unreadCount>0 &&
              <span style={{marginLeft:"6px", background:C.red, color:"white",
                borderRadius:"8px", padding:"0 5px", fontSize:"9px",
                fontWeight:"700"}}>{unreadCount}</span>}
          </button>
        ))}
      </div>

      {feed && (
        <div style={{padding:"20px 24px"}}>

          {/* ── TAB 0: FEED ── */}
          {tab === 0 && (
            <div style={{display:"grid", gridTemplateColumns:"1fr 340px", gap:"16px"}}>
              <div>
                {/* Filters */}
                <div style={{display:"flex", gap:"8px", marginBottom:"14px",
                  alignItems:"center", flexWrap:"wrap"}}>
                  <span style={{fontSize:"10px", color:C.textDim,
                    letterSpacing:"0.08em"}}>PRIORITY:</span>
                  {["all","CRITICAL","HIGH","MED"].map(p => (
                    <button key={p} onClick={()=>setFilterPriority(p)}
                      style={st.pill(filterPriority===p,
                        p==="CRITICAL"?C.red:p==="HIGH"?C.amber:p==="MED"?C.teal:C.gold)}>
                      {p}
                    </button>
                  ))}
                  <span style={{fontSize:"10px", color:C.textDim,
                    letterSpacing:"0.08em", marginLeft:"8px"}}>SOURCE:</span>
                  {["all","time","condition","rotation","panchang"].map(s => (
                    <button key={s} onClick={()=>setFilterSource(s)}
                      style={st.pill(filterSource===s)}>
                      {s.toUpperCase()}
                    </button>
                  ))}
                  {unreadCount > 0 && (
                    <button onClick={markAllRead}
                      style={{...st.pill(false), marginLeft:"auto", color:C.textDim}}>
                      MARK ALL READ
                    </button>
                  )}
                </div>

                {/* TODAY header */}
                <div style={{fontSize:"10px", color:C.textDim, letterSpacing:"0.1em",
                  marginBottom:"8px", display:"flex", alignItems:"center", gap:"8px"}}>
                  <span>TODAY</span>
                  <span style={{flex:1, height:"1px", background:C.border}}/>
                  <span>{filteredFeed.length} alerts</span>
                </div>

                {filteredFeed.map(alert => (
                  <AlertCard key={alert.id} alert={alert}
                    onClick={()=>{ setSelectedAlert(alert); setPanelOpen(true); markRead(alert.id); }}
                    selected={selectedAlert?.id === alert.id}
                    priorityColor={priorityColor}/>
                ))}

                {/* YESTERDAY header */}
                <div style={{fontSize:"10px", color:C.textDim, letterSpacing:"0.1em",
                  margin:"16px 0 8px", display:"flex", alignItems:"center", gap:"8px"}}>
                  <span>YESTERDAY</span>
                  <span style={{flex:1, height:"1px", background:C.border}}/>
                </div>
                {feed.past.map(alert => (
                  <AlertCard key={alert.id} alert={alert}
                    onClick={()=>{ setSelectedAlert(alert); setPanelOpen(true); }}
                    selected={selectedAlert?.id === alert.id}
                    priorityColor={priorityColor} dimmed/>
                ))}
              </div>

              {/* Detail panel */}
              <div>
                {selectedAlert && panelOpen ? (
                  <AlertDetailPanel alert={selectedAlert} st={st}
                    onClose={()=>setPanelOpen(false)} priorityColor={priorityColor}/>
                ) : (
                  <TodayContextPanel rahuToday={rahuToday} st={st}
                    feed={feed} config={config}/>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 1: CONFIG ── */}
          {tab === 1 && (
            <ConfigPanel config={config} toggleEnabled={toggleEnabled}
              setLead={setLead} setThreshold={setThreshold}
              fireTestAlert={fireTestAlert} st={st}/>
          )}

          {/* ── TAB 2: HISTORY ── */}
          {tab === 2 && (
            <HistoryPanel feed={feed} st={st} priorityColor={priorityColor}/>
          )}

          {/* ── TAB 3: SCHEDULE ── */}
          {tab === 3 && (
            <SchedulePanel config={config} st={st} rahuToday={rahuToday}/>
          )}
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { transform: translateX(20px); opacity:0; } to { transform:translateX(0); opacity:1; } }
        @keyframes shrink { from { width:100%; } to { width:0%; } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}

// ─── ALERT CARD ────────────────────────────────────────────────────────────
function AlertCard({ alert, onClick, selected, priorityColor, dimmed }) {
  const pc = priorityColor(alert.priority);
  const sourceColors = { time:C.teal, condition:C.gold, rotation:C.purple, panchang:C.green };
  const sc = sourceColors[alert.source] || C.textDim;
  const timeStr = alert.fired_at.slice(11,16);

  return (
    <div onClick={onClick}
      style={{display:"flex", gap:"12px", padding:"11px 14px",
        cursor:"pointer", marginBottom:"4px", borderRadius:"4px",
        background:selected?"#1A2030":alert.read?"transparent":"#0D1520",
        border:`1px solid ${selected?C.gold:alert.read?C.border:C.border+"88"}`,
        borderLeft:`3px solid ${alert.read?C.border:pc}`,
        opacity:dimmed?0.7:1, transition:"all 0.1s"}}>
      {/* Unread dot */}
      <div style={{width:"6px", height:"6px", borderRadius:"50%",
        background:alert.read?"transparent":pc, marginTop:"5px", flexShrink:0,
        boxShadow:alert.read?"none":`0 0 6px ${pc}`}}/>
      <div style={{flex:1, minWidth:0}}>
        <div style={{display:"flex", justifyContent:"space-between",
          alignItems:"flex-start", marginBottom:"3px"}}>
          <div style={{fontSize:"12px", color:alert.read?C.textMid:C.text,
            fontWeight:alert.read?"400":"600"}}>{alert.title}</div>
          <div style={{display:"flex", gap:"6px", alignItems:"center", flexShrink:0,
            marginLeft:"8px"}}>
            <span style={{fontSize:"9px", color:sc, padding:"1px 5px",
              border:`1px solid ${sc}40`, borderRadius:"2px"}}>{alert.source.toUpperCase()}</span>
            <span style={{fontSize:"9px", color:C.textDim, fontFamily:"monospace"}}>{timeStr}</span>
          </div>
        </div>
        <div style={{fontSize:"10px", color:C.textDim, lineHeight:"1.5",
          overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis"}}>
          {alert.body}
        </div>
        <div style={{marginTop:"4px"}}>
          <span style={{fontSize:"9px", fontWeight:"700", color:pc,
            padding:"1px 6px", background:pc+"18",
            border:`1px solid ${pc}40`, borderRadius:"2px"}}>{alert.priority}</span>
        </div>
      </div>
    </div>
  );
}

// ─── ALERT DETAIL PANEL ────────────────────────────────────────────────────
function AlertDetailPanel({ alert, st, onClose, priorityColor }) {
  const pc = priorityColor(alert.priority);
  const atype = ALERT_TYPES.find(t => t.id === alert.type_id);

  return (
    <div style={{...st.card, position:"sticky", top:"20px"}}>
      <div style={{display:"flex", justifyContent:"space-between",
        alignItems:"flex-start", marginBottom:"12px"}}>
        <div>
          <div style={{fontSize:"13px", color:C.text, fontWeight:"700",
            marginBottom:"4px"}}>{alert.title}</div>
          <div style={{fontSize:"10px", color:C.textDim}}>
            {alert.fired_at.slice(11,16)} IST · {alert.source.toUpperCase()}
          </div>
        </div>
        <button onClick={onClose}
          style={{background:"transparent", border:"none", color:C.textDim,
            cursor:"pointer", fontSize:"14px", padding:"2px 6px"}}>✕</button>
      </div>

      <div style={{padding:"12px", background:"#0D1016", borderRadius:"3px",
        border:`1px solid ${pc}30`, marginBottom:"14px", lineHeight:"1.7",
        fontSize:"11px", color:C.textMid}}>
        {alert.body}
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr",
        gap:"8px", marginBottom:"14px"}}>
        {[
          {l:"Priority", v:alert.priority, c:pc},
          {l:"Source", v:alert.source.toUpperCase(), c:C.teal},
          {l:"Fired At", v:alert.fired_at.slice(11,16)+" IST", c:C.textMid},
          {l:"Status", v:alert.read?"READ":"UNREAD", c:alert.read?C.textDim:C.amber},
        ].map((item,i) => (
          <div key={i} style={{background:C.bg, padding:"8px",
            borderRadius:"3px", border:`1px solid ${C.border}`}}>
            <div style={{fontSize:"9px", color:C.textDim, marginBottom:"3px",
              letterSpacing:"0.07em"}}>{item.l}</div>
            <div style={{fontSize:"12px", fontWeight:"700", color:item.c}}>{item.v}</div>
          </div>
        ))}
      </div>

      {atype && (
        <div style={{background:atype.color+"12", border:`1px solid ${atype.color}40`,
          borderRadius:"3px", padding:"10px", marginBottom:"12px"}}>
          <div style={{fontSize:"9px", color:C.textDim, letterSpacing:"0.08em",
            marginBottom:"6px"}}>ALERT TYPE DETAILS</div>
          <div style={{fontSize:"11px", color:C.textMid, lineHeight:"1.6"}}>
            <strong style={{color:atype.color}}>{atype.label}</strong> ·{" "}
            {atype.tier === "validated"
              ? `✓ Validated · n=${atype.n?.toLocaleString()} · p=${atype.p}`
              : atype.tier === "indicative"
              ? `~ Indicative · n=${atype.n}`
              : "Category: time/system"
            }
          </div>
        </div>
      )}

      <div style={{padding:"8px", background:"#0A1020",
        border:`1px dashed ${C.teal}40`, borderRadius:"3px",
        fontSize:"10px", color:C.teal}}>
        🔄 LIVE DATA — fires from <code>km_daily_panchang</code> · <code>km_astro_correlation</code>
        · <code>km_finastro_alerts</code> table
      </div>
    </div>
  );
}

// ─── TODAY CONTEXT PANEL ───────────────────────────────────────────────────
function TodayContextPanel({ rahuToday, st, feed, config }) {
  const enabledCount = Object.values(config.enabled).filter(Boolean).length;
  const todayFired = feed.today.length;
  const critCount = feed.today.filter(a=>a.priority==="CRITICAL").length;

  return (
    <div style={{...st.card}}>
      <div style={{fontFamily:"'Cinzel',serif", fontSize:"12px", color:C.gold,
        letterSpacing:"0.1em", marginBottom:"12px"}}>TODAY'S CONTEXT</div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px",
        marginBottom:"14px"}}>
        {[
          {l:"Session Quality", v:"FAVORABLE ✦", c:C.green},
          {l:"Tithi", v:"Ekadashi (Shukla)", c:C.textMid},
          {l:"Yoga", v:"Siddhi → Shula", c:C.amber},
          {l:"Nakshatra", v:"Pushya", c:C.textMid},
          {l:"Rahu Kala", v:rahuToday?`${rahuToday.start}–${rahuToday.end}`:"N/A", c:C.red},
          {l:"Abhijit", v:"11:48–12:36", c:C.green},
        ].map((item,i) => (
          <div key={i} style={{background:C.bg, padding:"8px", borderRadius:"3px",
            border:`1px solid ${C.border}`}}>
            <div style={{fontSize:"9px", color:C.textDim, marginBottom:"3px",
              letterSpacing:"0.07em"}}>{item.l}</div>
            <div style={{fontSize:"11px", fontWeight:"600", color:item.c}}>{item.v}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex", flexDirection:"column", gap:"6px",
        marginBottom:"12px"}}>
        {[
          {label:"Alerts fired today", val:todayFired, color:C.text},
          {label:"Critical alerts", val:critCount, color:critCount>0?C.red:C.green},
          {label:"Alert types enabled", val:enabledCount, color:C.teal},
          {label:"Stocks on watchlist", val:config.watchlist.length, color:C.textMid},
        ].map((r,i) => (
          <div key={i} style={{display:"flex", justifyContent:"space-between",
            fontSize:"11px", padding:"5px 0",
            borderBottom:`1px solid ${C.border}22`}}>
            <span style={{color:C.textDim}}>{r.label}</span>
            <span style={{color:r.color, fontWeight:"700"}}>{r.val}</span>
          </div>
        ))}
      </div>

      <div style={{padding:"8px 10px", background:C.greenDim+"22",
        border:`1px solid ${C.green}30`, borderRadius:"3px",
        fontSize:"10px", color:C.textMid, lineHeight:"1.6"}}>
        ✦ <strong style={{color:C.green}}>FAVORABLE DAY</strong> — High-conviction entries
        possible. Watch for LuckyPop BUY signals between 11:48–12:36 (Abhijit).
        Avoid all entries 10:30–12:00 (Rahu Kala).
      </div>
    </div>
  );
}

// ─── CONFIG PANEL ──────────────────────────────────────────────────────────
function ConfigPanel({ config, toggleEnabled, setLead, setThreshold, fireTestAlert, st }) {
  const [configTab, setConfigTab] = useState("time");
  const categories = ["time","condition","rotation"];

  return (
    <div style={{display:"grid", gridTemplateColumns:"1fr 300px", gap:"16px"}}>
      <div>
        <div style={{display:"flex", gap:"8px", marginBottom:"16px"}}>
          {categories.map(cat => (
            <button key={cat} onClick={()=>setConfigTab(cat)}
              style={st.pill(configTab===cat, CATEGORY_COLORS[cat])}>
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Alert rows */}
        <div style={{fontSize:"9px", color:C.textDim, letterSpacing:"0.1em",
          padding:"6px 14px", borderBottom:`1px solid ${C.border}`,
          display:"grid", gridTemplateColumns:"1fr 80px 100px 80px"}}>
          <span>ALERT TYPE</span><span style={{textAlign:"center"}}>ENABLED</span>
          <span style={{textAlign:"center"}}>LEAD TIME</span>
          <span style={{textAlign:"center"}}>TIER</span>
        </div>

        {ALERT_TYPES.filter(t => t.category === configTab).map(t => {
          const tierColor = t.tier==="validated"?C.green:t.tier==="indicative"?C.amber:C.textDim;
          return (
            <div key={t.id}
              style={{display:"grid", gridTemplateColumns:"1fr 80px 100px 80px",
                padding:"10px 14px", borderBottom:`1px solid ${C.border}22`,
                alignItems:"center",
                background:config.enabled[t.id]?"#0C1018":"transparent",
                transition:"background 0.1s"}}>
              <div>
                <div style={{fontSize:"12px", color:config.enabled[t.id]?C.text:C.textDim,
                  marginBottom:"2px"}}>
                  <span style={{color:t.color, marginRight:"6px"}}>{t.icon}</span>
                  {t.label}
                </div>
                <div style={{fontSize:"10px", color:C.textDim}}>{t.desc}</div>
              </div>
              {/* Toggle */}
              <div style={{textAlign:"center"}}>
                <div onClick={()=>toggleEnabled(t.id)}
                  style={{display:"inline-flex", alignItems:"center",
                    cursor:"pointer", gap:"6px"}}>
                  <div style={{width:"32px", height:"16px", borderRadius:"8px",
                    background:config.enabled[t.id]?C.green:C.border, position:"relative",
                    transition:"background 0.2s"}}>
                    <div style={{position:"absolute", top:"2px",
                      left:config.enabled[t.id]?"18px":"2px",
                      width:"12px", height:"12px", borderRadius:"50%",
                      background:"white", transition:"left 0.2s"}}/>
                  </div>
                </div>
              </div>
              {/* Lead time */}
              <div style={{textAlign:"center"}}>
                {t.unit === "min" ? (
                  <div style={{display:"flex", alignItems:"center",
                    justifyContent:"center", gap:"4px"}}>
                    <input type="number" min="0" max="30"
                      value={config.leadTime[t.id]}
                      onChange={e=>setLead(t.id, e.target.value)}
                      style={{width:"36px", background:"#0D1016",
                        border:`1px solid ${C.border}`, borderRadius:"3px",
                        color:C.text, padding:"3px 4px", fontSize:"11px",
                        textAlign:"center"}}/>
                    <span style={{fontSize:"10px", color:C.textDim}}>min</span>
                  </div>
                ) : (
                  <span style={{fontSize:"10px", color:C.textDim}}>instant</span>
                )}
              </div>
              {/* Tier */}
              <div style={{textAlign:"center"}}>
                <span style={{fontSize:"9px", fontWeight:"700", color:tierColor}}>
                  {t.tier==="validated"?"✓":t.tier==="indicative"?"~":"—"}
                  {" "}{t.tier.slice(0,3).toUpperCase()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Right: delivery + watchlist */}
      <div style={{display:"flex", flexDirection:"column", gap:"12px"}}>
        {/* Delivery */}
        <div style={st.card}>
          <div style={{fontFamily:"'Cinzel',serif", fontSize:"12px", color:C.gold,
            letterSpacing:"0.1em", marginBottom:"10px"}}>DELIVERY CHANNELS</div>
          {[
            {key:"inApp", label:"In-App Feed", sub:"This panel · Bell icon", color:C.teal, available:true},
            {key:"whatsapp", label:"WhatsApp (MSG91)", sub:config.delivery.whatsappNote, color:C.green, available:false},
          ].map(ch => (
            <div key={ch.key} style={{display:"flex", justifyContent:"space-between",
              alignItems:"center", padding:"8px 0",
              borderBottom:`1px solid ${C.border}22`}}>
              <div>
                <div style={{fontSize:"11px", color:ch.available?C.text:C.textDim}}>{ch.label}</div>
                <div style={{fontSize:"9px", color:C.textDim}}>{ch.sub}</div>
              </div>
              {ch.available ? (
                <span style={{fontSize:"10px", color:C.teal, padding:"2px 8px",
                  border:`1px solid ${C.teal}40`, borderRadius:"3px"}}>● ACTIVE</span>
              ) : (
                <span style={{fontSize:"9px", color:C.textDim, padding:"2px 8px",
                  border:`1px solid ${C.border}`, borderRadius:"3px"}}>SPRINT 5</span>
              )}
            </div>
          ))}
        </div>

        {/* Watchlist thresholds */}
        <div style={st.card}>
          <div style={{fontFamily:"'Cinzel',serif", fontSize:"12px", color:C.gold,
            letterSpacing:"0.1em", marginBottom:"10px"}}>SCORE THRESHOLDS</div>
          {WATCHLIST.map(w => {
            const phaseColors = {ENTERING:C.teal,LEADING:C.green,PEAKING:C.gold,
              "ROTATING OUT":C.amber,NEGLECTED:C.red};
            return (
              <div key={w.symbol} style={{display:"flex", justifyContent:"space-between",
                alignItems:"center", padding:"7px 0",
                borderBottom:`1px solid ${C.border}22`}}>
                <div>
                  <div style={{fontSize:"11px", color:C.text}}>{w.symbol}</div>
                  <div style={{fontSize:"9px", color:phaseColors[w.rotation]}}>{w.rotation}</div>
                </div>
                <div style={{display:"flex", alignItems:"center", gap:"6px"}}>
                  <span style={{fontSize:"11px", color:w.score>=7?C.green:C.amber,
                    fontWeight:"700"}}>{w.score}</span>
                  <input type="number" min="1" max="10" step="0.5"
                    value={config.scoreThreshold[w.symbol]}
                    onChange={e=>setThreshold(w.symbol, e.target.value)}
                    style={{width:"40px", background:"#0D1016",
                      border:`1px solid ${C.border}`, borderRadius:"3px",
                      color:C.text, padding:"3px 4px", fontSize:"11px",
                      textAlign:"center"}}/>
                </div>
              </div>
            );
          })}
        </div>

        {/* Test alert */}
        <button onClick={fireTestAlert}
          style={{padding:"10px", background:C.amberDim+"44",
            border:`1px solid ${C.amber}60`, borderRadius:"4px",
            color:C.amber, fontSize:"12px", fontWeight:"700",
            cursor:"pointer", letterSpacing:"0.06em"}}>
          ⚡ FIRE TEST ALERT
        </button>
      </div>
    </div>
  );
}

// ─── HISTORY PANEL ─────────────────────────────────────────────────────────
function HistoryPanel({ feed, st, priorityColor }) {
  const allAlerts = [...feed.today, ...feed.past].sort((a,b) =>
    b.fired_at.localeCompare(a.fired_at));

  const byType = {};
  allAlerts.forEach(a => {
    if (!byType[a.type_id]) byType[a.type_id] = 0;
    byType[a.type_id]++;
  });
  const topTypes = Object.entries(byType).sort((a,b)=>b[1]-a[1]).slice(0,5);

  return (
    <div style={{display:"grid", gridTemplateColumns:"1fr 260px", gap:"16px"}}>
      <div>
        <div style={{fontSize:"10px", color:C.textDim, letterSpacing:"0.1em",
          marginBottom:"10px"}}>ALERT HISTORY — LAST 7 DAYS (DUMMY)</div>
        {allAlerts.map(alert => {
          const pc = priorityColor(alert.priority);
          const sourceColors = {time:C.teal,condition:C.gold,rotation:C.purple,panchang:C.green};
          return (
            <div key={alert.id}
              style={{display:"grid", gridTemplateColumns:"100px 1fr 80px 70px",
                gap:"8px", padding:"9px 14px", borderBottom:`1px solid ${C.border}22`,
                alignItems:"center", fontSize:"11px",
                background:alert.read?"transparent":"#0D1520"}}>
              <span style={{color:C.textDim, fontFamily:"monospace",
                fontSize:"10px"}}>{alert.fired_at.slice(0,16)}</span>
              <div>
                <div style={{color:alert.read?C.textMid:C.text,
                  fontWeight:alert.read?"400":"600"}}>{alert.title}</div>
              </div>
              <div style={{textAlign:"center"}}>
                <span style={{fontSize:"9px", color:sourceColors[alert.source]||C.textDim,
                  padding:"1px 6px", border:`1px solid ${(sourceColors[alert.source]||C.textDim)+"40"}`,
                  borderRadius:"2px"}}>{alert.source.toUpperCase()}</span>
              </div>
              <div style={{textAlign:"center"}}>
                <span style={{fontSize:"9px", fontWeight:"700", color:pc}}>{alert.priority}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div style={{display:"flex", flexDirection:"column", gap:"12px"}}>
        <div style={st.card}>
          <div style={{fontFamily:"'Cinzel',serif", fontSize:"12px", color:C.gold,
            letterSpacing:"0.1em", marginBottom:"10px"}}>ALERT STATS</div>
          {[
            {l:"Total fired (2 days)", v:allAlerts.length, c:C.text},
            {l:"Critical", v:allAlerts.filter(a=>a.priority==="CRITICAL").length, c:C.red},
            {l:"High", v:allAlerts.filter(a=>a.priority==="HIGH").length, c:C.amber},
            {l:"Unread", v:allAlerts.filter(a=>!a.read).length, c:C.amber},
            {l:"Time-based", v:allAlerts.filter(a=>a.source==="time").length, c:C.teal},
            {l:"Condition", v:allAlerts.filter(a=>a.source==="condition").length, c:C.gold},
            {l:"Rotation", v:allAlerts.filter(a=>a.source==="rotation").length, c:C.purple},
          ].map((r,i) => (
            <div key={i} style={{display:"flex", justifyContent:"space-between",
              padding:"5px 0", borderBottom:`1px solid ${C.border}22`,
              fontSize:"11px"}}>
              <span style={{color:C.textDim}}>{r.l}</span>
              <span style={{color:r.c, fontWeight:"700"}}>{r.v}</span>
            </div>
          ))}
        </div>

        <div style={st.card}>
          <div style={{fontFamily:"'Cinzel',serif", fontSize:"12px", color:C.gold,
            letterSpacing:"0.1em", marginBottom:"10px"}}>TOP ALERT TYPES</div>
          {topTypes.map(([id, count]) => {
            const atype = ALERT_TYPES.find(t=>t.id===id);
            return (
              <div key={id} style={{display:"flex", justifyContent:"space-between",
                padding:"6px 0", borderBottom:`1px solid ${C.border}22`,
                alignItems:"center"}}>
                <span style={{fontSize:"10px", color:C.textMid}}>
                  {atype?.icon} {atype?.label || id}
                </span>
                <span style={{fontSize:"11px", color:C.gold, fontWeight:"700"}}>{count}×</span>
              </div>
            );
          })}
        </div>

        <div style={{padding:"10px", background:"#0A1020",
          border:`1px dashed ${C.teal}40`, borderRadius:"3px",
          fontSize:"10px", color:C.teal, lineHeight:"1.7"}}>
          🔄 LIVE — alerts stored in <code>km_finastro_alerts</code> table.
          Schema: alert_id, type_id, fired_at, priority, body, read, stock_symbol.
          WhatsApp delivery via MSG91 in Sprint 5.
        </div>
      </div>
    </div>
  );
}

// ─── SCHEDULE PANEL ────────────────────────────────────────────────────────
function SchedulePanel({ config, st, rahuToday }) {
  const dow = new Date().getDay();

  // Build today's timeline 09:00–15:30
  const timelineEvents = [
    {time:"09:00", label:"Pre-session check", type:"system", color:C.textDim},
    {time:"09:10", label:"Session quality alert fires", type:"condition", color:C.gold},
    {time:"09:15", label:"▶ SESSION OPENS", type:"time", color:C.teal},
    ...(rahuToday ? [
      {time: String(parseInt(rahuToday.start)-0.13).replace(/\..*/, `:${((parseFloat(rahuToday.start.split(":")[1] || 0)) - 8 + 60) % 60}`.padStart(3,"0")).replace(":-",":("),
        label:`☊ Rahu Kala alert (${config.leadTime["rahu_start"]}min before)`, type:"time", color:C.red},
      {time:rahuToday.start, label:"☊ RAHU KALA BEGINS — no entries", type:"time", color:C.red},
      {time:rahuToday.end, label:"☊ Rahu Kala ends", type:"time", color:C.amber},
    ] : []),
    {time:"11:40", label:`☀ Abhijit alert (${config.leadTime["abhijit_start"]}min before)`, type:"time", color:C.green},
    {time:"11:48", label:"☀ ABHIJIT OPENS — best execution", type:"time", color:C.green},
    {time:"12:36", label:"☀ Abhijit closes", type:"time", color:C.green},
    {time:"15:15", label:"◼ Session close warning", type:"time", color:C.amber},
    {time:"15:30", label:"◼ SESSION CLOSES", type:"time", color:C.textDim},
    {time:"16:00", label:"Nightly correlation engine re-run", type:"system", color:C.teal},
    {time:"18:00", label:"Next-day Panchang alerts queued", type:"system", color:C.purple},
  ].sort((a,b) => a.time.localeCompare(b.time));

  const nowIST = new Date().toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour12:false}).slice(0,5);

  return (
    <div style={{display:"grid", gridTemplateColumns:"1fr 280px", gap:"16px"}}>
      {/* Timeline */}
      <div style={st.card}>
        <div style={{fontFamily:"'Cinzel',serif", fontSize:"13px", color:C.gold,
          letterSpacing:"0.1em", marginBottom:"14px"}}>TODAY'S ALERT SCHEDULE</div>

        <div style={{position:"relative"}}>
          {/* Vertical line */}
          <div style={{position:"absolute", left:"62px", top:0, bottom:0,
            width:"1px", background:C.border}}/>

          {timelineEvents.map((evt, i) => {
            const isPast = evt.time < nowIST;
            const isCurrent = Math.abs(
              parseInt(evt.time.replace(":","")) - parseInt(nowIST.replace(":",""))
            ) < 5;
            return (
              <div key={i} style={{display:"flex", gap:"14px", alignItems:"flex-start",
                marginBottom:"10px", opacity:isPast?0.55:1}}>
                <div style={{width:"48px", textAlign:"right", flexShrink:0,
                  fontSize:"11px", color:isCurrent?C.gold:C.textDim,
                  fontFamily:"monospace", paddingTop:"1px",
                  fontWeight:isCurrent?"700":"400"}}>{evt.time}</div>
                {/* Dot */}
                <div style={{position:"relative", zIndex:1, flexShrink:0, marginTop:"4px"}}>
                  <div style={{width:"8px", height:"8px", borderRadius:"50%",
                    background:isCurrent?C.gold:isPast?C.border:evt.color,
                    boxShadow:isCurrent?`0 0 8px ${C.gold}`:"none",
                    animation:isCurrent?"pulse 1.5s infinite":"none"}}/>
                </div>
                <div style={{flex:1, paddingTop:"0px"}}>
                  <div style={{fontSize:"11px", color:isCurrent?C.gold:isPast?C.textDim:C.text,
                    fontWeight:isCurrent?"700":"400"}}>{evt.label}</div>
                  <div style={{fontSize:"9px", color:C.textDim, marginTop:"1px"}}>
                    {evt.type.toUpperCase()}
                    {isCurrent && <span style={{color:C.gold, marginLeft:"6px"}}>← NOW</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: upcoming + screen update map */}
      <div style={{display:"flex", flexDirection:"column", gap:"12px"}}>
        <div style={st.card}>
          <div style={{fontFamily:"'Cinzel',serif", fontSize:"12px", color:C.gold,
            letterSpacing:"0.1em", marginBottom:"10px"}}>ACTIVE ALERTS TODAY</div>
          {ALERT_TYPES.filter(t=>config.enabled[t.id]).slice(0,8).map(t => (
            <div key={t.id} style={{display:"flex", justifyContent:"space-between",
              padding:"5px 0", borderBottom:`1px solid ${C.border}22`,
              fontSize:"10px", alignItems:"center"}}>
              <span style={{color:t.color}}>{t.icon}</span>
              <span style={{flex:1, color:C.textMid, marginLeft:"8px"}}>{t.label}</span>
              {t.unit==="min" && (
                <span style={{color:C.textDim, fontSize:"9px"}}>-{config.leadTime[t.id]}m</span>
              )}
            </div>
          ))}
          <div style={{fontSize:"10px", color:C.textDim, marginTop:"6px"}}>
            +{Object.values(config.enabled).filter(Boolean).length - 8} more enabled
          </div>
        </div>

        {/* Screen update map reminder */}
        <div style={st.card}>
          <div style={{fontFamily:"'Cinzel',serif", fontSize:"12px", color:C.gold,
            letterSpacing:"0.1em", marginBottom:"10px"}}>SCREEN UPDATE MAP</div>
          <div style={{fontSize:"10px", color:C.textDim, lineHeight:"1.8"}}>
            Per Sprint 3 handover, these screens need alert integration:
          </div>
          {[
            {screen:"Screen 1", item:"Bell icon + count badge in header"},
            {screen:"Screen 1", item:"'Next alert in Xmin' strip"},
            {screen:"Screen 2", item:"Bell marker on day columns"},
            {screen:"Screen 4", item:"'Set Alert' button per stock row"},
            {screen:"Rotation v2", item:"Phase change alert toggle"},
          ].map((r,i) => (
            <div key={i} style={{display:"flex", gap:"8px", padding:"5px 0",
              borderBottom:`1px solid ${C.border}22`, fontSize:"10px"}}>
              <span style={{color:C.teal, width:"68px", flexShrink:0}}>{r.screen}</span>
              <span style={{color:C.textMid}}>{r.item}</span>
            </div>
          ))}
          <div style={{marginTop:"8px", padding:"7px",
            background:"#0A1020", border:`1px dashed ${C.teal}40`,
            borderRadius:"3px", fontSize:"9px", color:C.teal}}>
            🔄 Alert bell component ready to wire into finastro_dashboard_v2.jsx
          </div>
        </div>
      </div>
    </div>
  );
}
