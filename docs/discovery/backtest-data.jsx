/* Rule backtest — mock data for Taurus Venus rule */

const RULE = {
  id: 'SP-TAU-VEN-BUL',
  name: 'Taurus Venus',
  type: 'Compound',
  bias: 'Bullish',
  probability: 'High',
  dataSource: 'available',
  scope: 'Market',
  benchmark: 'NIFTY 50',
  remarks: 'Super Bullish — Venus-Taurus strength + compound confirmation.',
  conditions: [
    { k:'SIGN', v:'Taurus' },
    { k:'PLANETS_PRESENT', v:'Venus' },
    { k:'PROBABILITY', v:'High' },
    { k:'SCOPE', v:'Market' },
  ],
  createdBy: 'S. Ramachandran',
  createdAt: '2025-11-03',
};

// 18 historical transits (most recent first). return null for active (in-progress).
const TRANSITS = [
  { id:'t18', start:'2026-04-20', end:'2026-05-13', days:24,  return:null,   matched:null, nifty:+1.8, regime:'bull' },
  { id:'t17', start:'2025-06-30', end:'2025-07-25', days:26,  return:-2.7,   matched:false, nifty:-1.1, regime:'bear' },
  { id:'t16', start:'2024-05-20', end:'2024-06-12', days:24,  return:+3.5,   matched:true,  nifty:+1.2, regime:'bull' },
  { id:'t15', start:'2023-04-06', end:'2023-05-02', days:27,  return:+3.1,   matched:true,  nifty:+2.0, regime:'bull' },
  { id:'t14', start:'2022-06-20', end:'2022-07-12', days:23,  return:+4.6,   matched:true,  nifty:+3.1, regime:'bull' },
  { id:'t13', start:'2021-05-05', end:'2021-05-28', days:24,  return:+5.6,   matched:true,  nifty:+2.4, regime:'bull' },
  { id:'t12', start:'2020-03-30', end:'2020-07-31', days:124, return:+33.7,  matched:true,  nifty:+28.1, regime:'bull', note:'Covid rebound outlier' },
  { id:'t11', start:'2019-06-05', end:'2019-06-28', days:24,  return:-0.5,   matched:false, nifty:+0.3, regime:'side' },
  { id:'t10', start:'2018-05-12', end:'2018-06-04', days:24,  return:+2.1,   matched:true,  nifty:+0.9, regime:'side' },
  { id:'t9',  start:'2017-04-27', end:'2017-05-22', days:26,  return:+4.0,   matched:true,  nifty:+3.2, regime:'bull' },
  { id:'t8',  start:'2016-06-14', end:'2016-07-07', days:24,  return:+3.2,   matched:true,  nifty:+4.1, regime:'bull' },
  { id:'t7',  start:'2015-05-01', end:'2015-05-25', days:25,  return:-3.3,   matched:false, nifty:-1.6, regime:'side' },
  { id:'t6',  start:'2014-06-19', end:'2014-07-13', days:25,  return:+5.1,   matched:true,  nifty:+4.0, regime:'bull' },
  { id:'t5',  start:'2013-05-07', end:'2013-05-30', days:24,  return:+1.2,   matched:true,  nifty:+0.7, regime:'side' },
  { id:'t4',  start:'2012-06-22', end:'2012-07-14', days:23,  return:+2.6,   matched:true,  nifty:+1.5, regime:'bull' },
  { id:'t3',  start:'2011-05-09', end:'2011-06-01', days:24,  return:-4.8,   matched:false, nifty:-3.9, regime:'bear' },
  { id:'t2',  start:'2010-06-27', end:'2010-07-19', days:23,  return:+3.4,   matched:true,  nifty:+2.8, regime:'bull' },
  { id:'t1',  start:'2009-05-14', end:'2009-06-07', days:25,  return:-11.5,  matched:false, nifty:-5.4, regime:'bear', note:'Worst — GFC aftershock' },
];

// Compute stats from transits
function computeStats(ts) {
  const done = ts.filter(t => t.return !== null);
  const matched = done.filter(t => t.matched);
  const unmatched = done.filter(t => !t.matched);
  const avg = arr => arr.length ? arr.reduce((s,t) => s + t.return, 0) / arr.length : 0;
  const avgDays = arr => arr.length ? arr.reduce((s,t) => s + t.days, 0) / arr.length : 0;
  return {
    total: ts.length,
    scored: done.length,
    matchedCount: matched.length,
    matchRate: done.length ? matched.length / done.length : 0,
    avgReturn: avg(done),
    avgMatched: avg(matched),
    avgUnmatched: avg(unmatched),
    best: done.reduce((b,t) => t.return > b.return ? t : b, done[0] || {return:0}),
    worst: done.reduce((b,t) => t.return < b.return ? t : b, done[0] || {return:0}),
    avgDuration: avgDays(done),
  };
}

// Build cumulative equity curve: compound the rule's returns in order, vs benchmark
function buildEquityCurve(ts) {
  const sorted = [...ts].filter(t => t.return !== null).sort((a,b) => a.start.localeCompare(b.start));
  let rule = 1, bench = 1;
  const points = [{ t:'2009-01', rule:1, bench:1, date:'2009-01-01' }];
  sorted.forEach(tr => {
    rule *= (1 + tr.return/100);
    bench *= (1 + tr.nifty/100);
    points.push({ t:tr.start.slice(0,7), rule, bench, date:tr.start, tr });
  });
  return points;
}

// Regime breakdown
function regimeStats(ts) {
  const regs = ['bull','side','bear'];
  return regs.map(r => {
    const sub = ts.filter(t => t.regime===r && t.return !== null);
    const matched = sub.filter(t => t.matched);
    return { regime:r, count:sub.length, matched:matched.length, avg: sub.length ? sub.reduce((s,t)=>s+t.return,0)/sub.length : 0 };
  });
}

// Upcoming occurrences (with aging info)
const UPCOMING = [
  { id:'u1', start:'2026-04-27', end:'2026-05-20', days:24, inDays:3,   signalStrength:4 },
  { id:'u2', start:'2027-06-04', end:'2027-06-28', days:25, inDays:406, signalStrength:4 },
  { id:'u3', start:'2028-03-29', end:'2028-08-01', days:126, inDays:705, signalStrength:5, note:'Long window — rare' },
  { id:'u4', start:'2029-05-04', end:'2029-05-28', days:25, inDays:1106, signalStrength:4 },
];

// Occurrences (daily signals) — mocked shorter
const OCCURRENCES = Array.from({length: 899}).map((_, i) => {
  const base = new Date('2026-04-24');
  base.setDate(base.getDate() - i);
  const y = base.getFullYear(), m = String(base.getMonth()+1).padStart(2,'0'), d = String(base.getDate()).padStart(2,'0');
  return {
    id: 'o'+i,
    date: `${y}-${m}-${d}`,
    signal: 'Bullish',
    strength: 4,
    details: 'Taurus Venus',
    matched: null,
  };
});

// Next firing dates
const NEXT_FIRES = ['2026-04-27','2026-04-28','2026-04-29','2026-04-30','2026-05-01'];

window.BT = { RULE, TRANSITS, UPCOMING, OCCURRENCES, NEXT_FIRES, computeStats, buildEquityCurve, regimeStats };
