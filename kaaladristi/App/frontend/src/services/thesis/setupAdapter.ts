/**
 * Setup Adapter Contract — Phase 1 of the Scanner Story Page.
 *
 * See: docs/claude/scanner-story-page-poa.md
 *
 * The Thesis tab (existing) gains a Scanner-Arrival section when a URL
 * carries ?setup=<preset>. The section is one shared layout that reads
 * a single `SetupData` shape. All preset-specific logic (entry zones,
 * what-confirms criteria, cycle labels, narrative tone) lives in a
 * per-preset adapter file.
 *
 * Reusability contract:
 *   · One SetupData contract, N adapters.
 *   · No `if (preset === 'stage_2')` inside components — the adapter is
 *     the only place preset semantics live.
 *   · Adding a new scanner = write one adapter file + register it in
 *     ./adapters/index.ts. The tab, chart, and cards never change.
 *
 * This module is pure — no I/O, no React, no side effects. The Phase 4
 * hook (useSetupData) fetches raw data and passes it to the right
 * adapter via getSetupAdapter(key).
 */

// ── Input shapes (what an adapter receives) ─────────────────────────────

/** One weekly bar from km_equity_weekly. Adapter reads a 5-year window. */
export interface WeeklyBar {
  trade_date: string;   // ISO date of the week's last session
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  magic_rs?: number | null;
  magic_rs_zone?: string | null;
  /** Weekly-stamped stage (S1 / S1_CANDIDATE / S2_CANDIDATE / S2 / S3 / S4 / UNKNOWN).
   *  Falls back to daily-derived stage when km_equity_weekly lacks the column. */
  stage?: string | null;
}

/** The latest km_equity_eod row for the equity — the "today" snapshot. */
export interface LatestEodRow {
  trade_date: string;
  close: number;
  pct_chng: number | null;
  // Pivots (daily)
  pivot_pp: number | null;
  pivot_r1: number | null;
  pivot_r2: number | null;
  pivot_s1: number | null;
  pivot_s2: number | null;
  // Trend MAs
  ema_20: number | null;
  sma_50: number | null;
  sma_150: number | null;
  // 52-week envelope
  w52_high: number | null;
  w52_low: number | null;
  // Weinstein stage (daily)
  stage: string | null;
  // Relative strength
  magic_rs: number | null;
  magic_rs_zone: string | null;
  rs_percentile: number | null;
  // Volume / participation
  rvol: number | null;
  delivery_pct: number | null;
  accum_distrib: string | null;
  flow_type: string | null;
  // Flow-conviction columns (Wave 2 adapters — migration 094/095 rolling
  // metrics + standard indicator columns)
  rss_value: number | null;
  sniper_inst: number | null;
  delivery_surge_x: number | null;
  avg_amt_22d: number | null;
  // Distribution columns (Wave 3)
  volume_divergence_flag: string | null;
  // Stage-family + volume-drive columns (Wave 4)
  sma_200: number | null;
  dot_svd: boolean | null;
  dot_sbd: boolean | null;
  dot_syd: boolean | null;
}

/** The equity's master-table row — identity + exchange + industry. */
export interface EquityIdentity {
  id: number;
  symbol: string;
  company_name: string | null;
  exchange: string | null;   // 'NSE' | 'BSE'
  industry: string | null;
  isin: string | null;
  mcap_cr: number | null;
}

// ── Output shape (what an adapter returns — the shared SetupData) ───────

/** The compact fact bar rendered above the annotated chart. */
export interface SetupHeader {
  symbol: string;
  companyName: string | null;
  exchange: string | null;
  industry: string | null;
  close: number;
  pctChng: number | null;
  rsPercentile: number | null;
  /** Setup phase read at a glance — 'Setup' / 'Breakout' / 'Continuation'
   *  / 'Exhaustion' / 'Cold'. Per-preset semantics live in the adapter. */
  phase: string;
  /** Optional tone hint for the phase pill: bull / bear / neutral. */
  phaseTone: 'bull' | 'bear' | 'neutral';
}

/** The right-column Setup Summary — a small table of the ~6 levels users
 *  need to make a call. Any value can be null (missing data); the card
 *  renders `—` in that case. */
export interface KeyLevels {
  pivot: number | null;
  immediateResistance: number | null;
  majorResistance: number | null;
  immediateSupport: number | null;
  strongSupport: number | null;
  /** Weekly 50 EMA — the structural line the reference images all show. */
  ema50Weekly: number | null;
}

/** The 2–3-line "why am I looking at this" card. Phase 1 emits a
 *  deterministic narrative; Phase 2 upgrades to VaNi-generated. */
export interface CurrentSituation {
  /** One-word verdict shown as a pill: e.g. 'Constructive', 'Extended',
   *  'Wait for base'. */
  verdict: string;
  verdictTone: 'bull' | 'bear' | 'neutral';
  /** 2–3 sentences of narrative, plain text. */
  narrative: string;
}

/** Cycle-label overlays (labeled bands spanning weekly ranges — e.g.
 *  "Old Stage 2 Strong Uptrend", "Long Stage 1 Re-accumulation"). */
export interface CycleLabel {
  /** Inclusive weekly range the label spans. */
  from: string;   // ISO
  to: string;     // ISO
  label: string;
  tone: 'bull' | 'bear' | 'neutral';
}

/** Shaded entry zones on the chart, one per persona-entry. Overlaps
 *  between LT and Swing zones are expected. */
export interface EntryZoneAnnotation {
  priceLow: number;
  priceHigh: number;
  label: string;                            // "LT Entry 1", "Swing Entry 2", etc.
  persona: 'lt' | 'swing';
  tone: 'bull' | 'bear' | 'neutral';
}

/** Horizontal reference lines (key levels drawn on the chart). */
export interface HorizontalLine {
  price: number;
  label: string;
  tone: 'bull' | 'bear' | 'neutral';
}

export interface ChartAnnotations {
  cycleLabels: CycleLabel[];
  entryZones: EntryZoneAnnotation[];
  horizontalLines: HorizontalLine[];
}

/** One row in the persona entries card. Three entries per persona
 *  matches the reference images. */
export interface PersonaEntry {
  entryNo: 1 | 2 | 3;
  /** Target price for this entry — the value the user watches. */
  price: number | null;
  /** Short label — "Best historical" / "Early / higher-risk" / "Add-on". */
  label: string;
  /** One-liner explaining the entry trigger. */
  rationale: string;
}

export interface PersonaEntries {
  ltInvestor: PersonaEntry[];   // exactly 3
  swingTrader: PersonaEntry[];  // exactly 3
}

/** One row of the What-Confirms checklist. */
export interface WhatConfirmsItem {
  label: string;
  state: 'met' | 'pending' | 'failed';
  /** Short explanation shown on hover. */
  explain: string;
}

/** The full payload the ScannerArrivalView renders. */
export interface SetupData {
  setupKey: string;              // 'stage_2_leaders', 'waking_giants', …
  setupLabel: string;            // human-readable name, e.g. 'Stage 2 Leaders'
  header: SetupHeader;
  keyLevels: KeyLevels;
  currentSituation: CurrentSituation;
  chartAnnotations: ChartAnnotations;
  personas: PersonaEntries;
  whatConfirms: WhatConfirmsItem[];
  /** Optional house-voice one-liner (the green "Investor Tip" box in the
   *  reference images). Adapter may leave this undefined; the card
   *  suppresses the box when unset. */
  investorTip?: string;
  /** Optional lens metadata. Bullish presets keep the default
   *  Long-Term / Swing lens headings; bearish presets (Weakness
   *  Confluence, Distribution Warnings) supply Holder / Pressure lens
   *  headings instead. The view falls back to defaults when unset. */
  personaMeta?: {
    lt: LensMeta;
    swing: LensMeta;
  };
}

export interface LensMeta {
  heading: string;  // "Holder Lens"
  sub: string;      // "Weekly · exposure"
  intent: string;   // one-sentence italic intent line
}

// ── Adapter type + dispatch ─────────────────────────────────────────────

export type SetupAdapter = (
  weekly: WeeklyBar[],
  latest: LatestEodRow,
  identity: EquityIdentity,
) => SetupData;

/** Registry of preset key → adapter. Populated in ./adapters/index.ts so
 *  every entry is explicit and greppable (side-effect self-registration
 *  breaks tree-shaking and hides who owns what). */
export const SETUP_ADAPTERS: Record<string, SetupAdapter> = {};

export function getSetupAdapter(key: string): SetupAdapter | null {
  return SETUP_ADAPTERS[key] ?? null;
}

// ── Shared helpers usable by all adapters ───────────────────────────────

/** Rolling window from the END of the array (newest bars). Returns an
 *  empty array if `bars` is shorter than `n`. */
export function trailingWindow<T>(bars: T[], n: number): T[] {
  if (bars.length < n) return [];
  return bars.slice(bars.length - n);
}

/** Simple moving average of a numeric selector over the last `n` bars.
 *  Returns null when fewer than `n` bars are available. */
export function smaFromEnd<T>(bars: T[], n: number, pick: (b: T) => number | null | undefined): number | null {
  if (bars.length < n) return null;
  const window = bars.slice(bars.length - n);
  let sum = 0;
  for (const b of window) {
    const v = pick(b);
    if (v == null || !Number.isFinite(v)) return null;
    sum += v;
  }
  return sum / n;
}

/** Max of a numeric selector across the last `n` bars, EXCLUDING the
 *  final bar (so it reads "prior N closes / highs / …"). Returns null
 *  when fewer than `n+1` bars are available. */
export function priorMaxFromEnd<T>(bars: T[], n: number, pick: (b: T) => number | null | undefined): number | null {
  if (bars.length < n + 1) return null;
  const start = bars.length - 1 - n;
  const end = bars.length - 1;                // exclude the last bar
  let best: number | null = null;
  for (let i = start; i < end; i++) {
    const v = pick(bars[i]);
    if (v == null || !Number.isFinite(v)) continue;
    if (best == null || v > best) best = v;
  }
  return best;
}
