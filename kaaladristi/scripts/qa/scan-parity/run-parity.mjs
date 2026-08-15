/**
 * Scanner matview parity run — km_scan_results vs the live scanEngine.ts.
 *
 * Executes the PRODUCTION bundle-scan code (bundled by build.mjs, reading
 * live data over the read-only MCP endpoint) and diffs each in-scope preset
 * against the deployed matview on membership, rank order, and vani_flag —
 * the same three axes the 2026-07-10 parity proof used.
 *
 * Usage:
 *   node build.mjs && node run-parity.mjs            # verbatim production behavior
 *   PARITY_LIFT_SYMBOL_CAP=1 node run-parity.mjs     # with the 8000-symbol cap lifted
 *
 * Exit 0 = exact parity on all presets; 1 = differences (see report JSON).
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rawSql } from './postgrest-shim.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// Presets the matview serves that are still live product scans.
// fresh_breakout is retired (migration 152) and excluded; flower_pot_burst
// already reads the matview in production (its own dedicated path).
const PRESETS = [
  'power_buy', 'power_sell', 'smart_money',
  'quiet_accumulation', 'distribution_warning', 'conviction_flow',
];

// ── Emulate the two pipeline-API endpoints scanEngine fetches ──────────────
// /api/scan/presets is a straight kd_scan_presets read (pipeline2_api.py:803).
// /api/vani-opportunity/config currently returns a stub whose shape makes the
// frontend parser throw and fall back to DEFAULT_OPP_CONFIG — reproduced
// verbatim so the harness matches production behavior exactly.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes('/api/scan/presets')) {
    const rows = await rawSql(
      'SELECT id,name,description,tooltip,sort_order,result_limit,is_active,' +
      'category,category_label,category_color,category_sort,universe,timeframe,is_default_tab,' +
      'vani_rule,vani_side,vani_short_label,vani_cap ' +
      'FROM kd_scan_presets WHERE is_active = true ORDER BY category_sort, sort_order',
    );
    return { ok: true, status: 200, json: async () => rows };
  }
  if (u.includes('/api/vani-opportunity/config')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ presets: {}, default: { min_rvol: 1.5, min_magic_rs: 20, min_rsi: 50, max_rsi: 80 } }),
    };
  }
  if (u.startsWith('http')) return realFetch(url, init);
  throw new Error('parity harness: unexpected relative fetch ' + u);
};

const engine = await import('./.build/scanEngine.bundle.mjs');

console.log(`mode: ${process.env.PARITY_LIFT_SYMBOL_CAP === '1' ? 'SYMBOL CAP LIFTED (logic parity)' : 'VERBATIM production (includes 8000-symbol truncation)'}`);
console.log('loading presets + bundle from live DB…');
await engine.fetchScanPresets();
const t0 = Date.now();
const bundle = await engine.__loadScanData('daily');
console.log(`bundle loaded in ${Math.round((Date.now() - t0) / 1000)}s — latestDate=${bundle.latestDate}, symbols=${bundle.symbols.size}, stocks w/ latest EOD=${bundle.latestEod.size}, industries=${bundle.industries.length}`);

if (!bundle.latestDate) {
  console.error('ABORT: bundle has no confirmed latest date');
  process.exit(2);
}

const mvDates = await rawSql('SELECT DISTINCT trade_date FROM km_scan_results');
const mvDate = mvDates[0]?.trade_date;
if (mvDates.length !== 1 || mvDate !== bundle.latestDate) {
  console.error(`ABORT: matview trade_date(s) ${JSON.stringify(mvDates)} != bundle latestDate ${bundle.latestDate} — refresh and bundle are out of sync, comparison would be meaningless`);
  process.exit(2);
}

const report = { ranAt: null, mode: process.env.PARITY_LIFT_SYMBOL_CAP === '1' ? 'cap-lifted' : 'verbatim', tradeDate: bundle.latestDate, presets: {} };
let allOk = true;

for (const preset of PRESETS) {
  const fn = engine.__SCAN_FUNCTIONS[preset];
  if (!fn) { console.error(`no scan function for ${preset}`); allOk = false; continue; }

  const js = fn(bundle).map((s, i) => ({ rank: i + 1, equity_id: s.equity_id, symbol: s.symbol, vani: !!s.vaniOpportunity }));
  const mv = await rawSql(`SELECT rank, equity_id, symbol, vani_flag FROM km_scan_results WHERE preset_id = '${preset}' ORDER BY rank`);

  const jsIds = new Set(js.map((r) => r.equity_id));
  const mvIds = new Set(mv.map((r) => r.equity_id));
  const onlyJs = js.filter((r) => !mvIds.has(r.equity_id));
  const onlyMv = mv.filter((r) => !jsIds.has(r.equity_id));

  const rankMismatch = [];
  const vaniMismatch = [];
  const mvById = new Map(mv.map((r) => [r.equity_id, r]));
  for (const r of js) {
    const m = mvById.get(r.equity_id);
    if (!m) continue;
    if (m.rank !== r.rank) rankMismatch.push({ equity_id: r.equity_id, symbol: r.symbol, js_rank: r.rank, mv_rank: m.rank });
    if (!!m.vani_flag !== r.vani) vaniMismatch.push({ equity_id: r.equity_id, symbol: r.symbol, js_vani: r.vani, mv_vani: !!m.vani_flag });
  }

  const ok = onlyJs.length === 0 && onlyMv.length === 0 && rankMismatch.length === 0 && vaniMismatch.length === 0;
  allOk &&= ok;
  console.log(`${ok ? '✓' : '✗'} ${preset.padEnd(22)} js=${String(js.length).padStart(3)} mv=${String(mv.length).padStart(3)}  onlyJS=${onlyJs.length} onlyMV=${onlyMv.length} rankΔ=${rankMismatch.length} vaniΔ=${vaniMismatch.length}`);
  if (onlyJs.length) console.log('    only in JS:', onlyJs.slice(0, 10).map((r) => `${r.symbol}#${r.equity_id}@${r.rank}`).join(' '), onlyJs.length > 10 ? `… +${onlyJs.length - 10}` : '');
  if (onlyMv.length) console.log('    only in MV:', onlyMv.slice(0, 10).map((r) => `${r.symbol}#${r.equity_id}@${r.rank}`).join(' '), onlyMv.length > 10 ? `… +${onlyMv.length - 10}` : '');
  if (rankMismatch.length) console.log('    rank drift:', rankMismatch.slice(0, 8).map((r) => `${r.symbol} js@${r.js_rank}↔mv@${r.mv_rank}`).join(' '));
  if (vaniMismatch.length) console.log('    vani drift:', vaniMismatch.slice(0, 8).map((r) => `${r.symbol} js=${r.js_vani} mv=${r.mv_vani}`).join(' '));

  report.presets[preset] = { ok, jsCount: js.length, mvCount: mv.length, onlyJs, onlyMv, rankMismatch, vaniMismatch };
}

const out = path.join(here, `parity-report-${report.mode}.json`);
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`\n${allOk ? 'EXACT PARITY on all presets ✓' : 'DIFFERENCES FOUND ✗'} — report: ${out}`);
process.exit(allOk ? 0 : 1);
