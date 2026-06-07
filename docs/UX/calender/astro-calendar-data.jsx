/* Mock event data for the Astro Calendar — April 2026
   Each day carries a bias per 2-hour market batch:
     'bullish' | 'mild-bullish' | 'neutral' | 'volatile' | 'mild-bearish' | 'bearish' | 'closed'
   Batches: morning (9:15–11:15), midday (11:15–1:15), close (1:15–3:30)
*/

const MONTH = {
  label: 'April 2026',
  days: 30,
  firstDow: 3, // Apr 1, 2026 is Wed. 0=Sun, 1=Mon, ... 3=Wed
};

const BIAS_META = {
  'bullish':       { label:'Bullish',        color:'#6ecf9a', fill:'rgba(110,207,154,0.95)', dim:'rgba(110,207,154,0.25)', symbol:'▲▲' },
  'mild-bullish':  { label:'Mild Bullish',   color:'#7fa87d', fill:'rgba(127,168,125,0.6)',  dim:'rgba(127,168,125,0.18)', symbol:'▲'  },
  'neutral':       { label:'Neutral',        color:'#6b6352', fill:'rgba(107,99,82,0.55)',   dim:'rgba(107,99,82,0.2)',    symbol:'·'  },
  'volatile':      { label:'Volatile',       color:'#e2b96f', fill:'rgba(226,185,111,0.7)',  dim:'rgba(226,185,111,0.25)', symbol:'✕'  },
  'mild-bearish':  { label:'Mild Bearish',   color:'#b07a72', fill:'rgba(176,122,114,0.55)', dim:'rgba(176,122,114,0.18)', symbol:'▼'  },
  'bearish':       { label:'Bearish',        color:'#d97a6c', fill:'rgba(217,122,108,0.9)',  dim:'rgba(217,122,108,0.25)', symbol:'▼▼' },
  'closed':        { label:'Market Closed',  color:'#2e2a22', fill:'rgba(46,42,34,0.4)',     dim:'rgba(46,42,34,0.3)',     symbol:'—'  },
};

// Persistent transits: horizontal bands across the month
const TRANSITS_SEED = [
  { id:'t1', name:'Rahu Vedh of Puṣya, Svātī, Anurādhā', group:'Rahu', start:1, end:30, bias:'mild-bearish', tag:'VEDH', note:'Caution layer on Mercury/Venus-ruled counters all month.' },
  { id:'t2', name:'Saturn Vedh of Ārdrā',                group:'Saturn', start:1, end:30, bias:'mild-bearish', tag:'VEDH', note:'Slow-drag on financials, PSU banks.' },
  { id:'t3', name:'Mars in Kṛttikā',                     group:'Mars', start:1, end:12, bias:'mild-bullish', tag:'SIGN', note:'Energy to metals & defence. Tapers after 12 Apr.' },
  { id:'t4', name:'Venus in Revatī',                     group:'Venus', start:1, end:8,  bias:'mild-bullish', tag:'SIGN', note:'Short FMCG / luxury window.' },
  { id:'t5', name:'Jupiter in Punarvasu',                group:'Jupiter', start:1, end:30, bias:'bullish',      tag:'SIGN', note:'Broad-market tailwind under cautious veneer.' },
  { id:'t6', name:'Rahu ingress → Kumbha (approach)',    group:'Rahu', start:22, end:30, bias:'volatile', tag:'INGRESS', note:'18-month sign change approaching. Tech re-rating historically.' },
];

// Discrete events: single-day yogas, conjunctions, tithis
const EVENTS_SEED = [
  { id:'e1',  name:'Vyatīpāta Yog on Tuesday',     day:7,  tag:'YOG',  sig:'minor', note:'Classical inauspicious window.' },
  { id:'e2',  name:'Pradoṣa',                       day:15, tag:'TITHI', sig:'minor', note:'Trayodaśī evening. Neutral-positive banks.' },
  { id:'e3',  name:'Chandra Yog in Pañcak',         day:16, tag:'YOG',  sig:'minor', note:'Moon-dominated positive window.' },
  { id:'e4',  name:'Neptune Conjunction Mercury',   day:17, tag:'CONJ', sig:'major', note:'Rare. IT / media volatility spike; directional bias up.' },
  { id:'e5',  name:'Pariṣka Gatre',                 day:19, tag:'YOG',  sig:'minor', note:'Minor auspicious window.' },
  { id:'e6',  name:'Kṣaya Tithi in Śukla Pakṣa',    day:20, tag:'TITHI', sig:'minor', note:'Dropped tithi — intraday dislocations.' },
  { id:'e7',  name:'Sun–Horōscopē Conjunction',     day:24, tag:'CONJ', sig:'major', note:'Annual peak influence. Strongest forward-bias day.' },
  { id:'e8',  name:'Bhadrā',                        day:28, tag:'KARAN', sig:'minor', note:'Karaṇa of restraint — afternoon caution.' },
  { id:'e9',  name:'Pradoṣa',                       day:28, tag:'TITHI', sig:'minor', note:'Evening positive tint.' },
];

// Hand-curated per-day bias by batch (morning/midday/close) for April 2026.
// In production this would be computed from transits+events+VaNi.
// Patterns encode the "shape" of each day.
const DAY_BIAS = {
  1:  ['mild-bearish', 'bearish', 'mild-bearish'],       // Wed — heavy Vedh
  2:  ['neutral',      'mild-bullish', 'bullish'],
  3:  ['mild-bullish', 'bullish', 'mild-bullish'],
  4:  ['closed','closed','closed'],  // Sat
  5:  ['closed','closed','closed'],  // Sun
  6:  ['bullish',      'mild-bullish', 'neutral'],
  7:  ['bearish',      'bearish', 'mild-bearish'],       // Vyatīpāta
  8:  ['mild-bullish', 'bullish', 'bullish'],
  9:  ['neutral',      'mild-bullish', 'mild-bullish'],
  10: ['bullish',      'mild-bullish', 'neutral'],
  11: ['closed','closed','closed'],
  12: ['closed','closed','closed'],
  13: ['mild-bearish', 'neutral', 'mild-bullish'],
  14: ['bullish',      'bullish', 'mild-bullish'],
  15: ['mild-bullish', 'neutral', 'bullish'],            // Pradoṣa eve lift
  16: ['bullish',      'bullish', 'bullish'],            // Chandra Yog
  17: ['volatile',     'bullish', 'bullish'],            // Neptune ☌ Mercury (major)
  18: ['closed','closed','closed'],
  19: ['closed','closed','closed'],
  20: ['mild-bearish', 'volatile', 'mild-bearish'],      // Kṣaya Tithi
  21: ['neutral',      'mild-bullish', 'neutral'],
  22: ['mild-bullish', 'neutral', 'volatile'],           // today · Rahu ingress approach starts
  23: ['neutral',      'mild-bullish', 'bullish'],
  24: ['bullish',      'bullish', 'bullish'],            // Sun–Horōscopē (major, full green)
  25: ['closed','closed','closed'],
  26: ['closed','closed','closed'],
  27: ['mild-bullish', 'bullish', 'mild-bullish'],
  28: ['mild-bearish', 'neutral', 'mild-bullish'],       // Bhadrā + Pradoṣa
  29: ['neutral',      'mild-bullish', 'bullish'],
  30: ['volatile',     'volatile', 'mild-bearish'],      // Rahu ingress imminent
};

const BATCH_LABELS = ['09:15–11:15', '11:15–13:15', '13:15–15:30'];
const BATCH_SHORT  = ['AM', 'MID', 'CLOSE'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DOW_ORDER = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']; // how we render columns

// Resolve day's active transits + events + batches for tooltip
function getDayContext(day, transits, events, dayBias) {
  const activeT = transits.filter(t => day >= t.start && day <= t.end);
  const activeE = events.filter(e => e.day === day);
  const batches = (dayBias[day] || ['neutral','neutral','neutral']).map((b,i) => ({
    label: BATCH_LABELS[i], short: BATCH_SHORT[i], bias: b
  }));
  const isClosed = batches.every(b => b.bias === 'closed');
  return { activeT, activeE, batches, isClosed };
}

// Group days into week-rows (Mon-first), for the grid layout
function buildWeekRows() {
  const rows = [];
  let row = Array(7).fill(null); // Mon..Sun
  const mondayIdx = (dow) => (dow === 0 ? 6 : dow - 1); // Sun -> 6, Mon -> 0

  for (let d = 1; d <= MONTH.days; d++) {
    const dow = (MONTH.firstDow + d - 1) % 7;
    const col = mondayIdx(dow);
    row[col] = d;
    if (col === 6) { rows.push(row); row = Array(7).fill(null); }
  }
  if (row.some(x => x !== null)) rows.push(row);
  return rows;
}

window.AC = { MONTH, BIAS_META, TRANSITS_SEED, EVENTS_SEED, DAY_BIAS, BATCH_LABELS, BATCH_SHORT, DOW, DOW_ORDER, getDayContext, buildWeekRows };
