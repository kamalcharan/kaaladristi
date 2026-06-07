/* Mock data for DristiQ dashboard */

const DASH = {
  today: {
    label: 'CAPITAL PROTECTION',
    day: 3,
    date: '21 Apr 2026 · Tuesday',
    ist: '14:08 IST',
    verdict: 'Defensive concentration forming. Two lenses agree: breadth narrowing into pharma/FMCG while Jyeṣṭhā Nakṣatra clusters with historical reversal signatures.',
    confidence: 68,
    atmo: 'CHARGED',
    panchangam: {
      vara: 'Maṅgala · Mars',
      tithi: 'Trayodaśī · Kṛṣṇa Pakṣa',
      nakshatra: 'Jyeṣṭhā · Mercury',
      yoga: 'Vyāghāta',
      karana: 'Gara',
    }
  },

  transits: [
    { id:'smm', body:'Saturn', aspect:'□', body2:'Mars', deg:'29°48′', when:'Thu 14:22 IST', countdown:'+2d 19h', sig:'major', sign:'neg', note:'6 of 8 historical occurrences closed negative on NIFTY' },
    { id:'mve', body:'Mercury', aspect:'☌', body2:'Venus', deg:'12°14′', when:'Live · now', countdown:'active', sig:'minor', sign:'pos', note:'Favors IT, telecom, media — intraday' },
    { id:'sun', body:'Sun', aspect:'△', body2:'Jupiter', deg:'04°52′', when:'Sat 09:15 IST', countdown:'+4d 19h', sig:'minor', sign:'pos', note:'Broad-market expansion bias' },
    { id:'rah', body:'Rahu', aspect:'ingress', body2:'Kumbha', deg:'—', when:'29 Apr', countdown:'+8d', sig:'major', sign:'neu', note:'18-month sign change. Technology re-rating historically.' },
    { id:'men', body:'Mercury', aspect:'Retro ends', body2:'—', deg:'09°07′', when:'02 May', countdown:'+11d', sig:'minor', sign:'pos', note:'Execution errors decline' },
  ],

  pings: [
    {
      kind: 'OPPORTUNITY', scope:'INDUSTRY', tag:'TEXTILES',
      title: 'Something is cooking in Textiles & Apparels.',
      body: '3.4× delivery volume surge over 5 days, price still quiet at +3.2%. Classic accumulation footprint.',
      kpis: [{k:'Score 5D', v:'40.4'},{k:'vs 22D', v:'+27.9', sign:'pos'},{k:'stocks', v:'6'},{k:'vs NIFTY50 5D', v:'+1.9%', sign:'pos'}],
      score: '83', scoreLabel: '%ile', color:'gold',
      chart: 'up',
    },
    {
      kind:'OPPORTUNITY', scope:'STOCK', tag:'GRANULES',
      title: 'GRANULES just pinged.',
      body: 'RSI ticked 61 → 68 intraday, RVOL 2.3×. Fresh Longs flow. On VaNi\u2019s watchlist since yesterday.',
      kpis: [{k:'RS', v:'71.2'},{k:'today', v:'+1.8%', sign:'pos'},{k:'', v:'Drug Manufacturers'},{k:'rotating in'},{k:'', v:'Capital Protection in force', sign:'gold'}],
      score: '618', scoreLabel:'NOW', color:'green',
      chart:'up-sharp',
    },
    {
      kind:'HEADS-UP', scope:'6 DAYS AHEAD', tag:'THU 24 APR',
      title: 'Saturn square Mars exact at 14:22 IST Thursday.',
      body: '6 of 8 historical occurrences closed negative; median −0.9%. Worth factoring into multi-day plans.',
      kpis: [{k:'Confidence', v:'8/10'},{k:'Base rate', v:'75% down', sign:'neg'},{k:'Technical alignment', v:'3/3'}],
      score:'6/8', scoreLabel:'PAST NEG', color:'indigo',
      chart:'bars',
    }
  ],

  ambient: [
    { k:'BREADTH', v:'60.1', sub:'1,176 stocks', note:'Widening shallowly — top thin.', trend:[42,45,48,52,55,54,58,60,60.1], color:'gold' },
    { k:'BREADTH MOMENTUM', v:'+0.91', sub:'flattening', sign:'neg', note:'ROC rollover possible in 3–5 sessions.', trend:[0.2,0.4,0.7,0.9,1.1,1.2,1.1,1.0,0.91], color:'red' },
    { k:'ROTATION', v:'6', sub:'rotating in', note:'Defensive concentration — Pharma, Commodities.', trend:[2,3,3,4,5,5,6,6,6], color:'green' },
    { k:'LEADERSHIP', v:'4', sub:'from 12', note:'Narrowed — Capital Protection signature.', trend:[12,11,10,8,7,6,5,4,4], color:'red', invert: true },
  ],

  outlook: [
    { d:'FRI', n:'18', state:'Caution', score:-1, why:'Mars enters Pūrvāṣāḍhā · +0.3 vol surge expected' },
    { d:'MON', n:'21', state:'Caution', score:-1, why:'Approaching Saturn sq Mars · defensives favored' },
    { d:'TUE', n:'22', state:'Caution', score:-1, why:'Trayodaśī · Kṛṣṇa Pakṣa · reversal signature' },
    { d:'WED', n:'23', state:'Positive', score:2, why:'Mercury ingresses Taurus · IT/telecom bias' },
    { d:'THU', n:'24', state:'Negative', score:-2, why:'Saturn ☐ Mars exact · 75% base rate down' },
    { d:'FRI', n:'25', state:'Neutral', score:0, why:'Amāvāsyā proximity · consolidation likely' },
  ],

  sectors: {
    leading: [
      { name:'Copper', rs:'+92', held:'14d' },
      { name:'Heavy Electrical Equipment', rs:'+3', held:'2d' },
      { name:'Iron & Steel Products', rs:'+4', held:'9d' },
      { name:'Auto Ancillaries', rs:'+12', held:'6d' },
    ],
    rotating_in: [
      { name:'Speciality Retail', rs:'+87', delta:'+42 · 3D' },
      { name:'E-Retail / E-Commerce', rs:'+85', delta:'+38 · 3D' },
      { name:'TV Broadcasting & Software Prod.', rs:'+85', delta:'+36 · 3D' },
      { name:'Pharma', rs:'+72', delta:'+28 · 5D' },
    ],
    rotating_out: [
      { name:'Beverages — Non-Alcoholic', rs:'−64', delta:'−32 · 3D' },
      { name:'Medical Devices', rs:'−63', delta:'−29 · 3D' },
      { name:'Drug Manufacturers — General', rs:'−62', delta:'−27 · 3D' },
      { name:'Banks — Regional', rs:'−54', delta:'−18 · 5D' },
    ]
  },

  breadth: {
    score: 60.1,
    zone: 'GREED',
    emas: [{k:'20 EMA', v:'69.5', trend:'up'},{k:'50 EMA', v:'61.2', trend:'up'},{k:'150 EMA', v:'34.4', trend:'up'}],
    series: Array.from({length:90}, (_,i) => {
      const base = 30 + 15*Math.sin(i/7) + i*0.25;
      return Math.max(15, Math.min(85, base + (Math.random()-0.5)*6));
    }),
    roc: {
      fast: 1.47, slow: 0.10, sma: 1.11,
      stance: 'BULL',
      series: Array.from({length: 90}, (_,i) => ({
        fast: Math.sin(i/5)*1.2 + Math.sin(i/17)*0.4,
        slow: Math.sin(i/9)*0.8,
        sma: Math.sin(i/6)*1.0 + 0.1
      }))
    }
  },

  leadership: [
    { sym:'GRANULES', rs:88, d:'+1.8%', sector:'Pharma', flag:'fresh long', new:true },
    { sym:'HINDCOPPER', rs:86, d:'+2.4%', sector:'Metals', flag:'trend', new:false },
    { sym:'ABB', rs:79, d:'+0.9%', sector:'Cap Goods', flag:'stairstep', new:false },
    { sym:'TITAN', rs:74, d:'−0.3%', sector:'Retail', flag:'basing', new:false },
    { sym:'SUNPHARMA', rs:72, d:'+1.1%', sector:'Pharma', flag:'trend', new:false },
  ],

  weakness: [
    { sym:'VARUN BEV.', rs:22, d:'−2.1%', sector:'Bev', flag:'breakdown' },
    { sym:'POLY MEDICURE', rs:24, d:'−1.8%', sector:'MedDev', flag:'stage 4' },
    { sym:'DIVISLAB', rs:28, d:'−1.3%', sector:'Pharma', flag:'fade' },
    { sym:'INDIGO PAINTS', rs:31, d:'−0.9%', sector:'Paints', flag:'rollover' },
  ]
};

window.DASH = DASH;
