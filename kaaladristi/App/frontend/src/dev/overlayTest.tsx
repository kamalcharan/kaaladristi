/**
 * Overlay test harness — renders TradingChart + AnnotationOverlay with
 * MOCK data so the editorial annotation layer can be verified visually
 * (Playwright screenshot) without a backend, auth, or live DB.
 *
 * Serve: `npm run dev` then open /overlay-test.html
 * NOT part of the app bundle — dev-only entry.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TradingChart from '@/components/charts/TradingChart';
import type { IndicatorRow } from '@/services/indicatorData';
import '../styles/globals.css';

// Force dark mode tokens
document.documentElement.dataset.mode = 'dark';
document.body.style.background = 'var(--bg)';
document.body.style.padding = '24px';

// ── Mock daily bars: Kabra-like archetype over ~500 days ────────────────
// peak ~500 (day 80) → trough ~200 (day 220) → base (to day 400) → breakout → 566
function mockBars(): IndicatorRow[] {
  const bars: IndicatorRow[] = [];
  let seed = 42;
  const rng = () => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >> 16) / 65535; };
  const anchor = (i: number): number => {
    if (i < 80) return 320 + (i / 80) * 180;                 // climb to 500
    if (i < 220) return 500 - ((i - 80) / 140) * 300;        // crash to 200
    if (i < 400) return 200 + Math.sin((i - 220) / 18) * 18 + ((i - 220) / 180) * 40; // base drift to ~240
    return 240 + ((i - 400) / 100) * 326;                    // breakout to 566
  };
  const start = new Date('2024-06-01');
  let d = new Date(start);
  let i = 0;
  while (i < 500) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      const base = anchor(i);
      const noise = (rng() - 0.5) * base * 0.03;
      const close = base + noise;
      const open = i === 0 ? close : bars[bars.length - 1].close;
      const high = Math.max(open, close) * (1 + rng() * 0.012);
      const low = Math.min(open, close) * (1 - rng() * 0.012);
      const iso = d.toISOString().slice(0, 10);
      bars.push({
        trade_date: iso,
        open, high, low, close,
        volume: 200000 + rng() * 800000,
        ema_20: null, ema_60: null,
        sma_8: null, sma_21: null, sma_50: null, sma_55: null, sma_89: null,
        sma_150: close * 0.9, sma_200: null, sma_233: null,
        rsi_14: 55, rsi_9: null, mfi_14: null,
        atr_10: null, atr_14: null, supertrend: null, supertrend_dir: null,
        obv: null, obv_sma_20: null, rvol: 1.2, tvol: null,
        magic_rs: 10, magic_rs_sma144: null, magic_ma: 5, magic_rs_zone: 'Mild Bull',
        sniper_inst: null, sniper_hot: null, sniper_rsi: null,
        rss_value: null, rss_rsi: null, rss_spread: null,
        pivot_pp: null, pivot_r1: null, pivot_r2: null, pivot_r3: null,
        pivot_s1: null, pivot_s2: null, pivot_s3: null,
        chartink_emd_pct: null, chartink_emd_ok: null, chartink_ca_pct: null,
        chartink_ca_ok: null, chartink_vmac_ok: null, chartink_score: null,
        dot_svd: false, dot_sbd: false, dot_syd: false,
        swing_high: false, swing_low: false,
        flow_type: null, vacuum_flag: null, accum_distrib: null, volume_divergence_flag: null,
        score_5d: null, score_22d: null,
      });
      i++;
    }
    d = new Date(d.getTime() + 24 * 3600 * 1000);
  }
  return bars;
}

const bars = mockBars();
const dateAt = (i: number) => bars[Math.min(i, bars.length - 1)].trade_date;
const closeAt = (i: number) => bars[Math.min(i, bars.length - 1)].close;
const LAST = bars.length - 1;

const setupLevels = [
  { price: 560, label: 'Major Resistance', tone: 'bear' as const },
  { price: 545, label: 'Immediate Resistance', tone: 'bear' as const },
  { price: 525, label: 'Pivot', tone: 'neutral' as const },
  { price: 510, label: 'Immediate Support', tone: 'bull' as const },
  { price: 490, label: 'Strong Support', tone: 'bull' as const },
];
const setupEntries = [
  { price: 524, label: 'Structural breakout zone', persona: 'lt' as const, n: 1, axisLabel: false },
  { price: 517, label: 'Continuation zone', persona: 'lt' as const, n: 3, axisLabel: false },
  { price: 545, label: 'Break-of-pivot zone', persona: 'swing' as const, n: 1, axisLabel: false },
  { price: 525, label: 'Mid-range zone', persona: 'swing' as const, n: 2, axisLabel: false },
  { price: 510, label: 'Support-test zone', persona: 'swing' as const, n: 3, axisLabel: false },
];
const overlay = {
  cycleBands: [
    { from: dateAt(0),   to: dateAt(79),  label: 'Old Stage 2 Uptrend',   tone: 'bull' as const },
    { from: dateAt(80),  to: dateAt(219), label: 'Old Cycle Correction',  tone: 'bear' as const },
    { from: dateAt(220), to: dateAt(399), label: 'Long Stage 1 Base',     tone: 'neutral' as const },
    { from: dateAt(400), to: dateAt(LAST), label: 'New Stage 2 Recovery', tone: 'bull' as const },
  ],
  callouts: (() => {
    // Same anchor rule ChartView uses: last bar whose range touched the
    // zone price; fallback last bar.
    const anchorFor = (price: number): string => {
      for (let i = bars.length - 1; i >= 0; i--) {
        if (bars[i].low <= price && price <= bars[i].high) return bars[i].trade_date;
      }
      return bars[LAST].trade_date;
    };
    return [
      { persona: 'lt' as const,    n: 1, price: 524, labelShort: 'Breakout',     anchorDate: anchorFor(524) },
      { persona: 'lt' as const,    n: 3, price: 517, labelShort: 'Continuation', anchorDate: anchorFor(517) },
      { persona: 'swing' as const, n: 1, price: 545, labelShort: 'Break of R1',  anchorDate: anchorFor(545) },
      { persona: 'swing' as const, n: 2, price: 525, labelShort: 'Mid-range',    anchorDate: anchorFor(525) },
      { persona: 'swing' as const, n: 3, price: 510, labelShort: 'Support test', anchorDate: anchorFor(510) },
    ];
  })(),
  bigMoney: [
    { trade_date: dateAt(480), price: closeAt(480), amountCr: 24.8, count: 1 },
    { trade_date: dateAt(490), price: closeAt(490), amountCr: 60.5, count: 3 },
  ],
  storyPins: [
    { trade_date: dateAt(240), kind: 'flow' as const,     title: 'Longs Building',  tone: 'bull' as const,    price: closeAt(240) },
    { trade_date: dateAt(300), kind: 'conviction' as const, title: 'Conviction Turn', tone: 'bull' as const,  price: closeAt(300) },
    { trade_date: dateAt(405), kind: 'stage' as const,    title: 'Stage Flip',      tone: 'bull' as const,    price: closeAt(405) },
    { trade_date: dateAt(430), kind: 'magic_rs' as const, title: 'RS Turn',         tone: 'bull' as const,    price: closeAt(430) },
  ],
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });

function Harness() {
  return (
    <QueryClientProvider client={qc}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <h2 style={{ color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: 14, marginBottom: 12 }}>
          AnnotationOverlay harness — expect: 4 cycle bands w/ labels · 5 callout pills · 2 ₹Cr badges · 4 pins
        </h2>
        <TradingChart
          data={bars}
          workspaceMode
          height={560}
          setupLevels={setupLevels}
          setupEntries={setupEntries}
          overlay={overlay}
        />
      </div>
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Harness />);
