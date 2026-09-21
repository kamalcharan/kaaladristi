// Synthetic data for UI regression only. Never loaded by the product router.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StockStoryPage, { StockStoryRedirect } from '../../../src/views/StockStoryPage';
import { stage2LeadersAdapter } from '../../../src/services/thesis/adapters/stage2';
import { initTheme, useThemeStore } from '../../../src/stores/themeStore';
import '../../../src/styles/globals.css';

initTheme();
const params = new URLSearchParams(location.search);
useThemeStore.getState().setMode(params.get('mode') === 'dark' ? 'dark' : 'light');
const missing = params.has('missing');
const latestDate = '2026-09-18';
const id = 39248;
const industry = 'Other Industrial Metals & Mining';
const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false } } });
const rows = Array.from({ length: 130 }, (_, i) => {
  const close = 350 + i * 2 + Math.sin(i / 4) * 18;
  return { trade_date: new Date(Date.UTC(2026, 4, 12 + i)).toISOString().slice(0, 10),
    open: close - 3, close, high: close + 8, low: close - 6, volume: 300000 + i * 100,
    prev_close: close - 2, pct_chng: 0.4, ema_20: close - 15, sma_50: close - 40, sma_150: 444.74, sma_200: 410,
    sma_21: close - 16, sma_55: close - 45, magic_rs: 25 + Math.sin(i / 10) * 14, magic_ma: 25,
    magic_rs_zone: 'Mild Bull', magic_rs_chg_5d: Math.sin(i / 5) * 4, magic_rs_chg_22d: Math.sin(i / 18) * 8,
    magic_rs_chg_66d: 21, magic_rs_align: 1, stage: 'S2', stage_since: '2026-05-12',
    score_5d: i % 12, score_22d: 8, rsi_14: 55, mfi_14: 57, rss_value: 50, rss_spread: 4,
    rvol: 0.47, tvol: 0.57, sniper_inst: 30, sniper_hot: 35, flow_type: 'LOW_VOLUME',
    delivery_pct: 41.3, delivery_qty: 143228, deliv_value_cr: 8, bm_event: null,
    dot_sbd: i % 18 === 0, dot_svd: i % 18 === 0, dot_syd: false,
    prev_week_close: 592.05, prev_month_close: 633.3, pct_wtd: (close / 592.05 - 1) * 100,
    pct_mtd: (close / 633.3 - 1) * 100, breakout_level: 675, breakdown_level: 545,
    w52_high: 675, w52_low: 298.4, ret_5d: -1.15, ret_22d: 3.2, ret_66d: 34,
    pivot_pp: 589, pivot_r1: 598, pivot_r2: 608, pivot_s1: 579, pivot_s2: 569, rs_percentile: 93 };
});
Object.assign(rows[rows.length - 1], { trade_date: latestDate, close: 612.4, magic_rs_chg_5d: -3.29, magic_rs_chg_22d: -6.3 });
const identity = { id, symbol: 'JGCHEM', company_name: 'J.G. Chemicals', industry, exchange: missing ? 'BSE' : 'NSE', mcap_cr: missing ? null : 2399.75, isin: null, is_active: true };
const weekly = rows.filter((_, i) => i % 7 === 0);
client.setQueryData(['pipeline-latest-date'], latestDate);
client.setQueryData(['chart', 'equity', id, '1Y', 'daily', latestDate], rows);
client.setQueryData(['chart-warmup', id, rows[0].trade_date], []);
client.setQueryData(['equity-vp-meta', id], identity);
client.setQueryData(['equity-vp-bars', id, latestDate], rows);
client.setQueryData(['equity-vp-dc-inferences'], []);
client.setQueryData(['equity-vp-industry', industry, latestDate], { current: {}, previous: null, percentile: 83, prevPercentile: 78, category: 'leading', totalIndustries: 50 });
client.setQueryData(['equity-vp-rank', id, industry, latestDate], { rank: 4, total: 35 });
client.setQueryData(['scan-presence', id], { stock: null, matchedScans: [{ id: 'stage_2_leaders', name: 'Stage 2 Leaders', vani: false }] });
client.setQueryData(['sector-series', industry], new Map());
client.setQueryData(['stock-journeys', id], []);
client.setQueryData(['setupData', id, 'stage_2_leaders'], { data: stage2LeadersAdapter(weekly as never, rows.at(-1) as never, identity), weekly });
function RouteProbe() { const loc = useLocation(); return <output data-testid="route-location">{loc.pathname + loc.search + loc.hash}</output>; }
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[(params.has('legacy') ? '/story/equity/' : '/chart/equity/') + '39248?name=JGCHEM&setup=stage_2_leaders' + (params.get('tab') ? '&tab=' + params.get('tab') : '') + '#evidence']}><div style={{ padding: 16 }}><p>QA fixture · synthetic data, not a market snapshot</p><RouteProbe/><Routes><Route path="/chart/equity/:id" element={<StockStoryPage/>}/><Route path="/story/equity/:id" element={<StockStoryRedirect/>}/></Routes></div></MemoryRouter></QueryClientProvider>);
