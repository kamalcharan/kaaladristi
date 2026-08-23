import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, BarChart3, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { fetchIndicatorDataById, fetchEquityEodById, fetchEquityTimeframeById, resampleRows, type EquityTimeframe } from '@/services/indicatorData';
import TradingChart from '@/components/charts/TradingChart';
import VaNiInsight from '@/components/domain/VaNiInsight';
import { useInstrumentInsight } from '@/hooks';
import StatStrip from '@/components/domain/StockCockpit/StatStrip';
import VerdictHero from '@/components/domain/StockCockpit/VerdictHero';
import ThesisTab from '@/components/domain/StockCockpit/ThesisTab';
import type { ThesisBar } from '@/services/thesis';
import StoryMode from '@/components/domain/StockCockpit/StoryMode';
import ScannerArrivalView from '@/components/domain/StockCockpit/ScannerArrival/ScannerArrivalView';
import { buildStoryEvents, KIND_COLORS, type StoryEvent } from '@/services/storyEvents';
import { fetchSectorSeries } from '@/services/sectorSeries';
import DeliveryVsTraded from '@/components/domain/StockCockpit/DeliveryVsTraded';
import SectorMembershipCard from '@/components/domain/StockCockpit/SectorMembershipCard';
import CockpitIndicatorPanels from '@/components/domain/StockCockpit/CockpitIndicatorPanels';
import BigMoneyCard from '@/components/domain/StockCockpit/BigMoneyCard';
import CockpitOverlayStrip from '@/components/domain/StockCockpit/CockpitOverlayStrip';
import { detectBigMoneyDays } from '@/services/bigMoney';
import { useFrameworkStore } from '@/stores/frameworkStore';
import { useAuthStore } from '@/stores/authStore';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import CatalogDrawer from '@/components/domain/Catalog/CatalogDrawer';
import { useAstroOverlayBands } from '@/hooks/useAstroOverlayBands';
import MercuryStoryRibbon from '@/components/domain/MercuryStoryRibbon';
import OverlayExplainPopover from '@/components/domain/VaNi/OverlayExplainPopover';
import type { AstroBand } from '@/services/astroOverlayService';
import type { ChartOverlay } from '@/types/framework';

const NO_OVERLAYS: ChartOverlay[] = [];
import { Skeleton, ErrorBoundary } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { TimeRange } from '@/types';

// Visual Pulse imports (shared — index + equity)
import { useVisualPulse } from '@/hooks/useVisualPulse';
import { useEquityVisualPulse } from '@/hooks/useEquityVisualPulse';
import { useScanPresence } from '@/hooks/useScanPresence';
import { useSetupData } from '@/hooks/useSetupData';
import { useIndexBreadth, useConstituentDetails } from '@/hooks/useSectorRotation';
import { useIndexConstituents } from '@/hooks/useMasterData';
import { computeMoveQuality } from '@/services/moveQuality';
import MoveQualityCard from '@/components/domain/MoveQualityCard';
import { usePipelineStatus } from '@/hooks/usePipelineStatus';
import {
  computePulseSnapshot,
  computeCorrHistory,
  computeDots,
  type TradingStyle,
  type PulseSnapshot,
  type PulseBar,
  type CorrelationState,
  type DotSignals,
} from '@/services/visualPulseEngine';

// Equity-specific pulse components
import PumpDumpBanner, { scanBarsForManipulation } from '@/components/domain/VisualPulse/equity/PumpDumpBanner';
import ScanPresenceCard from '@/components/domain/VisualPulse/equity/ScanPresenceCard';
import BookmarkToggle from '@/components/domain/BookmarkToggle';
import IndustryContextCard from '@/components/domain/VisualPulse/equity/IndustryContextCard';
import MultiTimeframePills from '@/components/domain/VisualPulse/equity/MultiTimeframePills';
import StockFlowHeatmap from '@/components/domain/StockFlowHeatmap';
// Pulse verdict/evidence cards + timeline player pulled into Study (the full
// workbench). Study now carries the same signal widgets as Pulse, driven by a
// scrubber, so it can stand alone when Pulse mode is retired.
// Correlation is intentionally not rendered on equity Study (owner 2026-07-09);
// it returns for indexes later.
import { OrderFlowCard, SmartMoneyCard, DivergenceCard } from '@/components/domain/VisualPulse';
import type { SmartMoneyBar } from '@/components/domain/VisualPulse/SmartMoneyCard';
import TimelineSlider from '@/components/domain/VisualPulse/TimelineSlider';
import MagicRsSubchart from '@/components/domain/VisualPulse/MagicRsSubchart';
import RotationGraph, { type RotationPoint } from '@/components/domain/RotationGraph';
import SignalFlipCard from '@/components/domain/StockCockpit/SignalFlipCard';
import SignalLineChart from '@/components/domain/StockCockpit/SignalLineChart';
// Index-native evidence (Breadth chapter) — reused from the sector page.
import MarketBreadthChart from '@/components/domain/MarketBreadthChart';
import BreadthRocChart from '@/components/domain/BreadthRocChart';

const TIME_RANGES: TimeRange[] = ['1M', '3M', '6M', '1Y', '5Y', 'MAX'];

/** Compute Magic RS change over N bars */
function rsChangeLookback(bars: PulseBar[], idx: number, lookback: number): number | null {
  if (idx < lookback) return null;
  const current = bars[idx]?.magic_rs;
  const prior = bars[idx - lookback]?.magic_rs;
  if (current == null || prior == null) return null;
  return current - prior;
}

// ── Pulse card helpers (mirrored from EquityVisualPulsePage so Study reads
//    identically; kept local so Study stands alone once Pulse is retired) ──
function buildSmHistory(bars: PulseBar[], dotsHistory: DotSignals[]): SmartMoneyBar[] {
  return bars.map((b, i) => ({
    sm: b.sniper_inst ?? 0,
    fm: b.sniper_hot ?? 0,
    isSVD: dotsHistory[i]?.isSVD ?? false,
    isSBD: dotsHistory[i]?.isSBD ?? false,
    isSYD: dotsHistory[i]?.isSYD ?? false,
  }));
}

function buildRssHistory(bars: PulseBar[]): number[] {
  return bars.map((b) => b.rss_value ?? 0);
}

function buildFlowNarrative(snap: PulseSnapshot): string {
  const parts: string[] = [];
  const ft = snap.bar.flow_type;
  const rvol = snap.bar.rvol ?? 0;
  if (ft === 'FRESH_LONGS') parts.push('Fresh capital entering.');
  else if (ft === 'SHORT_COVERING') parts.push('Shorts unwinding — watch for confirmation.');
  else if (ft === 'FRESH_SHORTS') parts.push('Selling pressure building.');
  else if (ft === 'LONG_LIQUIDATION') parts.push('Longs exiting — exhaustion watch.');
  else if (ft === 'LOW_VOLUME') parts.push('Volume absent.');
  else parts.push('Mixed flow signals.');
  if (rvol > 2) parts.push(`High conviction volume (RVOL ${rvol.toFixed(1)}x).`);
  else if (rvol < 0.5) parts.push('Thin volume — signals unreliable.');
  if (snap.rss.zone === 'OVERBOUGHT') parts.push('RSS overbought — momentum stretched.');
  else if (snap.rss.zone === 'OVERSOLD') parts.push('RSS at floor — reversal watch.');
  else if (snap.rss.spreadRepaired) parts.push('Structural spread positive.');
  return parts.join(' ');
}

function buildSmNarrative(snap: PulseSnapshot): string {
  const parts: string[] = [];
  const sm = snap.sm;
  if (sm.smTrending) parts.push('Smart money trending higher.');
  else if (sm.smExiting) parts.push('Smart money declining — falling flow risk.');
  else parts.push('Smart money flat.');
  if (sm.hasSVD5) parts.push('Volume Drive signal in last 5 bars — institutional volume confirmed.');
  if (sm.hasSYD) parts.push('Falling flow signal present — caution.');
  if (sm.pumpSignal) parts.push('Smart declining while fast rising — pump signature.');
  if (sm.relationship === 'Aligned') parts.push('Both layers aligned.');
  else if (sm.relationship === 'Diverging') parts.push('Layers diverging — elevated risk.');
  return parts.join(' ');
}

/**
 * Generic chart page with Visual Pulse intelligence panel.
 * Routes:
 *   /chart/index/:id?name=NIFTY%2050
 *   /chart/equity/:id?name=RELIANCE
 */
export default function ChartView() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [range, setRange] = useState<TimeRange>('1Y');
  const [tf, setTf] = useState<EquityTimeframe>('daily');
  const [isFull, setIsFull] = useState(false);
  const [selectedStyle] = useState<TradingStyle>('Balanced');
  // Timeline scrubber (the Player, pulled in from Pulse). null = pin to latest bar.
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Study Layer contract (POA Phase 1.5): the cockpit chart honors the SAME
  // framework overlays as the My Space chart — what you turn on in Catalog
  // follows you everywhere. The framework store is normally hydrated by the
  // Workspace page; a user landing directly on the cockpit would otherwise
  // see zero overlays, so load it here too.
  const { framework, loadFramework } = useFrameworkStore();
  const { profile } = useAuthStore();
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const bookmarksHasLoaded = useBookmarkStore((s) => s.hasLoaded);
  const loadBookmarks = useBookmarkStore((s) => s.load);
  useEffect(() => {
    if (!framework && profile?.id) loadFramework(profile.id);
  }, [framework, profile?.id, loadFramework]);
  useEffect(() => {
    if (!bookmarksHasLoaded) loadBookmarks();
  }, [bookmarksHasLoaded, loadBookmarks]);
  const frameworkOverlays = framework?.chart_overlays ?? NO_OVERLAYS;
  // Astro is INDEX-ONLY (owner 2026-07-22): the evidence layer is measured
  // against NIFTY — on a stock chart the bands are noise, so equity charts
  // get no astro bands/ribbon even when the user's framework has the overlay.
  const astroBands = useAstroOverlayBands(type === 'index' ? frameworkOverlays : NO_OVERLAYS);
  // Right-click on an astro band → the full deterministic read (same popover
  // My Space uses; was never wired on Study — owner feedback 2026-07-22).
  const [zoneExplain, setZoneExplain] = useState<{
    tag: string; ruleId: number; ruleLabel: string; x: number; y: number;
    coincident?: { ruleId: number; label: string }[];
  } | null>(null);
  const handleZoneClick = (band: AstroBand, clientX: number, clientY: number, coincident?: AstroBand[]) => {
    const others = new Map<number, string>();
    for (const b of coincident ?? []) {
      if (b.ruleId !== band.ruleId) others.set(b.ruleId, b.displayName);
    }
    setZoneExplain({
      tag: band.groupTag, ruleId: band.ruleId, ruleLabel: band.displayName,
      x: clientX, y: clientY,
      coincident: [...others.entries()].map(([ruleId, label]) => ({ ruleId, label })),
    });
  };
  const [overlayDrawerOpen, setOverlayDrawerOpen] = useState(false);
  // Study reorg (2026-07-12): decision-band prose collapsed by default;
  // Member-Of pills demoted to a closed accordion.
  const [readExpanded, setReadExpanded] = useState(false);
  // Stock DeepDive tabs: Analysis | Chart & Replay | Thesis. Deep-linkable via
  // ?tab= so bookmarks / positions / scanners can land straight on Thesis.
  const tabParam = searchParams.get('tab');
  const [dvTab, setDvTab] = useState<'analysis' | 'chart' | 'thesis'>(
    tabParam === 'thesis' ? 'thesis' : tabParam === 'chart' ? 'chart' : 'analysis',
  );
  // Scanner arrival — when the URL carries ?setup=<preset> the user came
  // from a scanner (e.g. Stage 2 Leaders). We land on Chart & Replay tab
  // and default the mode to Story View (static annotated setup). Story Play
  // (existing animated replay) is the other mode of the segmented toggle.
  // See: docs/claude/scanner-story-page-poa.md
  const setupParam = searchParams.get('setup');
  const [storyMode, setStoryMode] = useState<'view' | 'play'>(setupParam ? 'view' : 'play');
  // If landing with ?setup= but no explicit ?tab=, land on Chart & Replay so
  // the Story View / Story Play toggle is where the user sees it.
  useEffect(() => {
    if (setupParam && !tabParam && dvTab !== 'chart') setDvTab('chart');
  }, [setupParam, tabParam, dvTab]);
  // User controls the timeframe — no forced snapping. Story View's cycle
  // bands + editorial layer come from setupData (weekly-computed) and
  // render via the overlay regardless of the chart's active tf.
  const [membershipOpen, setMembershipOpen] = useState(false);
  // Add-position from the chart hero (equity only). Switches to the Thesis tab
  // and pops its "I hold this" form.
  const [wantPositionForm, setWantPositionForm] = useState(false);

  const numId = Number(id);
  const rawName = searchParams.get('name') ?? `${type} #${id}`;
  const isIndex = type === 'index';
  const isEquity = type === 'equity';

  // Fetch setup annotations once at ChartView level so BOTH branches of the
  // toggle can render them: Story View's SVG chart AND Story Play's
  // TradingChart. React Query dedupes by (equityId, setupKey) so the second
  // consumer inside ScannerArrivalView costs nothing.
  const setupDataForPlay = useSetupData(
    isEquity && setupParam ? numId : null,
    isEquity && setupParam ? setupParam : null,
  );
  const setupLevelsForPlay = useMemo(() => {
    if (!setupDataForPlay.data) return [];
    return setupDataForPlay.data.chartAnnotations.horizontalLines.map((l) => ({
      price: l.price, label: l.label, tone: l.tone,
    }));
  }, [setupDataForPlay.data]);
  const setupEntriesForPlay = useMemo(() => {
    if (!setupDataForPlay.data) return [];
    // All entries render as thin dotted price lines. Native axis labels
    // stay off (AnnotationOverlay renders editorial callout pills).
    const out: Array<{ price: number; label: string; persona: 'lt' | 'swing'; n: number; axisLabel?: boolean }> = [];
    for (const e of setupDataForPlay.data.personas.ltInvestor) {
      if (e.price == null || !Number.isFinite(e.price)) continue;
      out.push({ price: e.price, label: e.label, persona: 'lt', n: e.entryNo, axisLabel: false });
    }
    for (const e of setupDataForPlay.data.personas.swingTrader) {
      if (e.price == null || !Number.isFinite(e.price)) continue;
      out.push({ price: e.price, label: e.label, persona: 'swing', n: e.entryNo, axisLabel: false });
    }
    return out;
  }, [setupDataForPlay.data]);

  /** Editorial overlay bundle for TradingChart — the SAME data both
   *  Story View and Story Play chart use. Adding a new preset or a new
   *  overlay layer only touches this one derivation.
   *
   *  bigMoney and storyPins are computed later once the underlying
   *  daily-event arrays exist in scope; those layers are added to this
   *  bundle in setupOverlayFull below. */
  const setupOverlayCore = useMemo(() => {
    if (!setupDataForPlay.data) return undefined;
    const d = setupDataForPlay.data;
    const cycleBands = d.chartAnnotations.cycleLabels.map((c) => ({
      from: c.from, to: c.to, label: c.label, tone: c.tone,
    }));
    const short = (label: string) => ({
      'Structural breakout zone': 'Breakout',
      'Structural pivot zone':    'Pivot / EMA',
      'Continuation zone':        'Continuation',
      'Break-of-pivot zone':      'Break of R1',
      'Mid-range zone':           'Mid-range',
      'Support-test zone':        'Support test',
    } as Record<string, string>)[label] ?? label;
    const callouts: Array<{ persona: 'lt' | 'swing'; n: number; price: number; labelShort: string }> = [];
    for (const e of d.personas.ltInvestor) {
      if (e.price != null && Number.isFinite(e.price)) {
        callouts.push({ persona: 'lt', n: e.entryNo, price: e.price, labelShort: short(e.label) });
      }
    }
    for (const e of d.personas.swingTrader) {
      if (e.price != null && Number.isFinite(e.price)) {
        callouts.push({ persona: 'swing', n: e.entryNo, price: e.price, labelShort: short(e.label) });
      }
    }
    return { cycleBands, callouts };
  }, [setupDataForPlay.data]);

  // ── Chart data (full history for TradingChart) ──
  // dateKey: the main chart page is commonly left open through a session —
  // same fix as hooks/useScan.ts, so a day change refetches automatically.
  const { latestDataDate: chartDateKey } = usePipelineStatus();
  const { data: rows = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['chart', type, numId, range, tf, chartDateKey ?? 'unknown'],
    queryFn: () =>
      isEquity
        ? (tf === 'daily' ? fetchEquityEodById(numId, range) : fetchEquityTimeframeById(numId, tf))
        // Index W/M: no aggregate tables exist — resample full daily history
        // client-side (indices carry no delivery data, so nothing is lost)
        : (tf === 'daily'
            ? fetchIndicatorDataById(numId, range)
            : fetchIndicatorDataById(numId, 'MAX').then((r) => resampleRows(r, tf))),
    staleTime: 120_000,
    enabled: !!numId && (isIndex || isEquity),
  });

  // ── Visual Pulse data — index uses useVisualPulse, equity uses useEquityVisualPulse ──
  const indexPulse = useVisualPulse(isIndex ? numId : null);
  const equityPulse = useEquityVisualPulse(isEquity ? numId : null);
  const scanPresence = useScanPresence(isEquity ? numId : null);

  // Index breadth — the cockpit's 4th verdict pillar for indices (% of
  // constituents participating). Equities read Liquidity instead.
  const { data: indexBreadth, isLoading: breadthLoading } = useIndexBreadth(isIndex ? numId : null, 66);
  const breadthPct = useMemo(
    () => (isIndex ? indexBreadth?.data?.at(-1)?.breadth_score ?? null : null),
    [isIndex, indexBreadth],
  );
  // Breadth-over-time → the index story's thermometer (the index-native analog
  // of a stock's sector thermometer). percentile = breadth score; "broad" (top
  // band) when participation is in the upper third.
  const breadthByDate = useMemo(() => {
    if (!isIndex || !indexBreadth?.data) return undefined;
    const m = new Map<string, { percentile: number; leading: boolean }>();
    for (const d of indexBreadth.data) {
      if (d.breadth_score == null) continue;
      m.set(d.trade_date, { percentile: d.breadth_score, leading: d.breadth_score >= 66 });
    }
    return m.size > 0 ? m : undefined;
  }, [isIndex, indexBreadth]);

  // VaNi narrative for the Decision Band (slim read, not the full panel).
  const { data: aiData, isLoading: aiLoading } = useInstrumentInsight(numId, type ?? 'index');

  // Unify pulse bars + dc inferences for shared signal computation
  const pulseBars: PulseBar[] = isIndex ? indexPulse.bars : (equityPulse.bars as PulseBar[]);
  const dcInferences = isIndex ? indexPulse.dcInferences : equityPulse.dcInferences;

  // Resolve display name — for BSE numeric symbols, prefer company_name from metadata
  const name = useMemo(() => {
    if (isEquity && equityPulse.meta) {
      const sym = equityPulse.meta.symbol;
      const co = equityPulse.meta.company_name;
      // If the URL name is numeric (BSE code) or matches the raw symbol, show company name
      if (/^\d+$/.test(rawName) && co) return co;
      // If symbol is numeric, show company_name + symbol
      if (/^\d+$/.test(sym) && co) return co;
    }
    return rawName;
  }, [isEquity, equityPulse.meta, rawName]);

  // Stats from latest row
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  const prev = rows.length > 1 ? rows[rows.length - 2] : null;
  const currentClose = latest?.close ?? 0;
  const prevClose = prev?.close ?? currentClose;
  const change = currentClose - prevClose;
  const changePct = prevClose ? (change / prevClose) * 100 : 0;
  const isPositive = change >= 0;

  // Index move-quality (Phase 2b) — the compact anti-trap verdict for the
  // cockpit, reusing the SAME constituent data the sector page fetches (the
  // full card lives on /sector-rotation/:id; here it's a summary chip).
  const idxConstituents = useIndexConstituents(isIndex ? numId : undefined);
  const idxEquityIds = useMemo(
    () => (idxConstituents.data ?? []).map((c) => c.equity_id),
    [idxConstituents.data],
  );
  const { data: idxConstDetails } = useConstituentDetails(idxEquityIds, isIndex ? (latest?.trade_date ?? '') : '');
  const indexMoveQuality = useMemo(
    () => (isIndex ? computeMoveQuality(idxConstDetails, indexBreadth?.data?.at(-1)?.pct_above_20 ?? null) : null),
    [isIndex, idxConstDetails, indexBreadth],
  );

  const last252 = rows.slice(-252);
  const high52w = last252.length > 0 ? Math.max(...last252.map(r => r.high)) : 0;
  const low52w = last252.length > 0 ? Math.min(...last252.map(r => r.low)) : 0;

  const errorMsg = error instanceof Error ? error.message : '';

  // ── Pulse computations (Study workbench) — the scrubber drives snapshot +
  //     every card. activeIndex === null pins to the latest bar. ──
  const effectiveIdx = activeIndex ?? (pulseBars.length > 0 ? pulseBars.length - 1 : 0);

  const dotsHistory: DotSignals[] = useMemo(
    () => pulseBars.map((b, i) => computeDots(b, i > 0 ? pulseBars[i - 1] : null)),
    [pulseBars],
  );

  const corrHistory: CorrelationState[] = useMemo(() => {
    if (pulseBars.length === 0) return [];
    return computeCorrHistory(pulseBars, dcInferences, selectedStyle);
  }, [pulseBars, dcInferences, selectedStyle]);

  const snapshot: PulseSnapshot | null = useMemo(() => {
    if (pulseBars.length === 0) return null;
    return computePulseSnapshot(pulseBars, effectiveIdx, dcInferences, selectedStyle);
  }, [pulseBars, effectiveIdx, dcInferences, selectedStyle]);

  // Card history slices (last N up to the scrubbed bar) — same windows as Pulse
  const smHistory: SmartMoneyBar[] = useMemo(() => {
    const start = Math.max(0, effectiveIdx - 29);
    return buildSmHistory(pulseBars.slice(start, effectiveIdx + 1), dotsHistory.slice(start, effectiveIdx + 1));
  }, [pulseBars, effectiveIdx, dotsHistory]);

  const rssHistory: number[] = useMemo(() => {
    const start = Math.max(0, effectiveIdx - 19);
    return buildRssHistory(pulseBars.slice(start, effectiveIdx + 1));
  }, [pulseBars, effectiveIdx]);

  const priceHistory = useMemo(() => {
    const start = Math.max(0, effectiveIdx - 19);
    return pulseBars.slice(start, effectiveIdx + 1).map((b) => b.close);
  }, [pulseBars, effectiveIdx]);

  const rsiHistory = useMemo(() => {
    const start = Math.max(0, effectiveIdx - 19);
    return pulseBars.slice(start, effectiveIdx + 1).map((b) => b.rsi_14 ?? 50);
  }, [pulseBars, effectiveIdx]);

  const flowNarrative = snapshot ? buildFlowNarrative(snapshot) : '';
  const smNarrative = snapshot ? buildSmNarrative(snapshot) : '';

  // Magic RS widget data (same shape EquityVisualPulsePage builds)
  const magicRsData = useMemo(
    () => pulseBars.map((b) => ({ trade_date: b.trade_date, magic_rs: b.magic_rs, magic_ma: b.magic_ma, magic_rs_zone: b.magic_rs_zone })),
    [pulseBars],
  );
  // Magic RS is a pipeline column vs CNX500 — null for many BSE/thin stocks.
  const hasRsData = useMemo(() => pulseBars.some((b) => b.magic_rs != null), [pulseBars]);

  // ── Equity-specific computations ──
  const rsChange1d = useMemo(() => rsChangeLookback(pulseBars, effectiveIdx, 1), [pulseBars, effectiveIdx]);
  const rsChange5d = useMemo(() => rsChangeLookback(pulseBars, effectiveIdx, 5), [pulseBars, effectiveIdx]);
  const rsChange20d = useMemo(() => rsChangeLookback(pulseBars, effectiveIdx, 20), [pulseBars, effectiveIdx]);

  // RS-Rotation (daily): level = Magic RS, momentum = its 5-bar change.
  const rotationPoints = useMemo<RotationPoint[]>(
    () => pulseBars.map((b, i) => ({
      date: b.trade_date,
      level: b.magic_rs ?? null,
      momentum: rsChangeLookback(pulseBars, i, 5),
    })),
    [pulseBars],
  );

  // Scan all bars for pump/dump signals (not just current bar)
  const pumpDumpResult = useMemo(() => {
    if (!isEquity || pulseBars.length === 0) return null;
    return scanBarsForManipulation(pulseBars, 30);
  }, [isEquity, pulseBars]);


  // Big Money days (Phase 3) — daily equity bars only
  const bigMoneyEvents = useMemo(
    () => (isEquity && tf === 'daily' ? detectBigMoneyDays(rows) : []),
    [isEquity, tf, rows],
  );
  const bigMoneyChartLines = useMemo(
    () => bigMoneyEvents.map((ev) => ({
      trade_date: ev.trade_date,
      price: ev.low,
      label: `₹${ev.delivCr >= 100 ? ev.delivCr.toFixed(0) : ev.delivCr.toFixed(1)} Cr`,
      color: ev.direction === 'entry' ? '#22c55e' : ev.direction === 'exit' ? '#ef4444' : '#d4a84b',
    })),
    [bigMoneyEvents],
  );

  // ── Story mode (Chart & Replay) — timed price-vs-signal events ──
  const [storyOpen, setStoryOpen] = useState(false);
  const bigMoneyDates = useMemo(() => new Set(bigMoneyEvents.map((e) => e.trade_date)), [bigMoneyEvents]);
  const { data: sectorByDate } = useQuery({
    queryKey: ['sector-series', equityPulse.meta?.industry],
    queryFn: () => fetchSectorSeries(equityPulse.meta?.industry ?? null),
    enabled: isEquity && !!equityPulse.meta?.industry,
    staleTime: 300_000,
  });
  // Story works for equities AND indices on the daily timeframe. Indices carry
  // score/magic_rs/flow columns (conviction · magic-RS flip · flow flip fire);
  // equity-only signals (stage/scan/big-money/sector) simply don't trigger when
  // their columns are absent.
  const storyEvents = useMemo(
    () => ((isEquity || isIndex) && tf === 'daily' ? buildStoryEvents(rows, bigMoneyDates, sectorByDate) : []),
    [isEquity, isIndex, tf, rows, bigMoneyDates, sectorByDate],
  );

  /** Full editorial overlay bundle passed to TradingChart. Combines the
   *  setup-derived layers (cycle bands + callouts, from setupOverlayCore)
   *  with the daily-event layers (Big Money badges + storyEvent pins).
   *  Same object drives Story View and Story Play — the toggle only
   *  controls what sits BELOW the chart, never what's on it. */
  const setupOverlayFull = useMemo(() => {
    if (!setupOverlayCore) return undefined;
    // Anchor each callout at the LAST bar whose range touched the zone
    // price — the reference-deck grammar (breakout callout points at the
    // breakout bar, support-test callout at the last test). Falls back
    // to the last bar when price never touched the zone in view.
    const anchorFor = (price: number): string | undefined => {
      for (let i = rows.length - 1; i >= 0; i--) {
        const r = rows[i];
        if (r.low <= price && price <= r.high) return r.trade_date;
      }
      return rows[rows.length - 1]?.trade_date;
    };
    const callouts = setupOverlayCore.callouts.map((c) => ({
      ...c,
      anchorDate: anchorFor(c.price),
    }));
    const bigMoney = bigMoneyChartLines.map((b) => ({
      trade_date: b.trade_date,
      price: b.price,
      amountCr: Number(b.label.match(/([0-9.]+)/)?.[1] ?? 0),
      count: 1,
    }));
    const storyPins: Array<{
      trade_date: string;
      kind: 'flow' | 'conviction' | 'stage' | 'magic_rs' | 'big_money' | 'rs_breakaway' | 'fpb' | 'scan' | 'sector';
      title: string;
      tone: 'bull' | 'bear' | 'neutral';
      price: number;
    }> = storyEvents.map((e) => ({
      trade_date: e.date,
      kind: e.kind,
      title: e.title,
      tone: e.tone,
      // storyEvents don't carry price; use the bar's close on that date
      price: rows.find((r) => r.trade_date === e.date)?.close ?? 0,
    })).filter((p) => p.price > 0);
    return { ...setupOverlayCore, callouts, bigMoney, storyPins };
  }, [setupOverlayCore, bigMoneyChartLines, storyEvents, rows]);
  // Latest Clean Breakaway/Breakdown within the rotation's plotted window —
  // storyEvents is indexed against `rows`, rotationPoints against `pulseBars`;
  // join by date (same pattern used for the story/playhead bridge below).
  const latestBreakaway = useMemo(() => {
    if (rotationPoints.length === 0) return null;
    const windowDates = new Set(rotationPoints.slice(-22).map((p) => p.date));
    const hits = storyEvents.filter((e) => e.kind === 'rs_breakaway' && windowDates.has(e.date));
    if (hits.length === 0) return null;
    const latest = hits[hits.length - 1];
    return { date: latest.date, title: latest.title, detail: latest.detail, tone: latest.tone as 'bull' | 'bear' };
  }, [storyEvents, rotationPoints]);
  // Events are indexed against `rows` (the chart's data) but the playhead
  // indexes `pulseBars` — different arrays. Bridge them by DATE, not index.
  const eventDates = useMemo(() => new Set(storyEvents.map((e) => e.date)), [storyEvents]);
  const playheadDate = pulseBars[effectiveIdx]?.trade_date ?? null;
  const storyBubble = useMemo(() => {
    // Equities gate the bubble to the Chart & Replay tab; indices have no tab
    // strip (single chart-centric view) so the bubble is always live there.
    if ((isEquity && dvTab !== 'chart') || !playheadDate) return null;
    let best: StoryEvent | null = null;
    for (const e of storyEvents) {
      if (e.date === playheadDate && (!best || e.priority > best.priority)) best = e;
    }
    return best ? { date: best.date, tone: best.tone, color: KIND_COLORS[best.kind], title: best.title, detail: best.detail, reactionPct: best.reactionPct } : null;
  }, [storyEvents, playheadDate, dvTab, isEquity]);

  // Replay playback — walk the playhead forward, dwelling on event bars so the
  // on-candle bubble is readable, then gliding to the next.
  const [playing, setPlaying] = useState(false);
  const playIdxRef = useRef(effectiveIdx);
  useEffect(() => { playIdxRef.current = effectiveIdx; }, [effectiveIdx]);
  useEffect(() => {
    if (!playing || pulseBars.length === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      if (cancelled) return;
      const cur = playIdxRef.current;
      if (cur >= pulseBars.length - 1) { setPlaying(false); return; }
      const next = cur + 1;
      playIdxRef.current = next;
      setActiveIndex(next);
      const isEvent = eventDates.has(pulseBars[next]?.trade_date ?? '');
      timer = setTimeout(loop, isEvent ? 2200 : 380);
    };
    timer = setTimeout(loop, 380);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [playing, pulseBars, eventDates, setActiveIndex]);

  // Chart block, extracted so the decision-first layout can place it in its own
  // tier (equity: beside Magic RS / RSI / Divergence; index: full width).
  const chartArea = (
    <>
      <div
        className={cn('glass-card rounded-2xl p-3', isFull && 'fixed inset-2 z-[300] overflow-auto')}
        style={isFull ? { background: 'var(--kd-bg, #0b0f17)' } : undefined}
      >
        {!isLoading && !isError && rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mb-3 px-1">
            <div className="flex items-center gap-0.5 mr-2 p-0.5 rounded-lg border border-kd-border bg-kd-elevated">
              {(['daily', 'weekly', 'monthly'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTf(t)}
                  className={cn(
                    'px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all',
                    tf === t ? 'bg-accent-indigo/25 text-accent-indigo' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
                  )}
                >
                  {t === 'daily' ? 'D' : t === 'weekly' ? 'W' : 'M'}
                </button>
              ))}
            </div>
            {tf === 'daily' ? (
              TIME_RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200',
                    range === r
                      ? 'bg-accent-indigo/20 text-accent-indigo border border-accent-indigo/30'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-kd-elevated',
                  )}
                >
                  {r}
                </button>
              ))
            ) : (
              <span className="text-[9px] text-muted font-mono px-1">full history · {tf} bars</span>
            )}
            <button
              onClick={() => setIsFull((f) => !f)}
              title={isFull ? 'Exit fullscreen' : 'Fullscreen chart'}
              className="ml-auto px-2.5 py-1 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-kd-elevated border border-kd-border transition-all"
            >
              {isFull ? '✕' : '⛶'}
            </button>
          </div>
        )}

        {!isLoading && !isError && rows.length > 0 && (
          <CockpitOverlayStrip onAdd={() => setOverlayDrawerOpen(true)} />
        )}

        {isLoading ? (
          <div className="space-y-4 p-2">
            <Skeleton className="h-[400px] w-full rounded-2xl" />
            <Skeleton className="h-[100px] w-full rounded-2xl" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-risk-red/10 border border-risk-red/30 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-risk-red" />
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Failed to Load</p>
            <p className="text-xs text-secondary max-w-md mb-3">{errorMsg || 'Unexpected error.'}</p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent-indigo/20 border border-accent-indigo/40 rounded-xl text-xs font-medium text-accent-indigo hover:bg-accent-indigo/30 transition-all"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="w-8 h-8 text-[var(--text-muted)] mb-3" />
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">No Price Data</p>
            <p className="text-xs text-secondary">
              <span className="text-[var(--text-primary)] font-medium">{name}</span> has no EOD data.
            </p>
          </div>
        ) : (
          <>
            {isIndex && <MercuryStoryRibbon />}
            <TradingChart
              data={rows}
              workspaceMode
              height={isFull ? Math.max(700, window.innerHeight - 120) : 480}
              highlightDate={activeIndex != null && pulseBars[effectiveIdx] ? pulseBars[effectiveIdx].trade_date : null}
              overlays={frameworkOverlays}
              astroBands={astroBands}
              bigMoneyEvents={bigMoneyChartLines}
              setupLevels={setupLevelsForPlay}
              setupEntries={setupEntriesForPlay}
              overlay={setupOverlayFull}
              benchmarkIndexId={isIndex && id ? Number(id) : null}
              benchmarkName={isIndex ? name : null}
              storyBubble={storyBubble}
              onZoneClick={handleZoneClick}
            />
            {zoneExplain && (
              <OverlayExplainPopover
                tag={zoneExplain.tag}
                focusRuleId={zoneExplain.ruleId}
                focusRuleLabel={zoneExplain.ruleLabel}
                coincident={zoneExplain.coincident}
                anchorX={zoneExplain.x}
                anchorY={zoneExplain.y}
                onClose={() => setZoneExplain(null)}
              />
            )}
          </>
        )}
      </div>
      {rows.length > 0 && (
        <p className="text-[9px] text-muted mt-1 text-right mono">
          {rows.length} days &middot; {rows[0].trade_date} to {rows[rows.length - 1].trade_date}
        </p>
      )}
    </>
  );

  // ── Chart & Replay tab (SHARED — equity + index) ──────────────────────────
  // ChartView is the one cockpit universe: story controls, the chart with its
  // on-candle bubble + VaNi robot, the Magic RS / indicators / divergence side
  // column, and the timeline scrubber. Both instrument types flow through this
  // single block — no per-type duplication.
  const replayTab = (
    <>
      {storyEvents.length > 0 && (
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => {
              if (!playing) {
                // Start the story at the first signal event in the window.
                const pbIdx = new Map(pulseBars.map((b, i) => [b.trade_date, i]));
                const firstEv = storyEvents.find((e) => pbIdx.has(e.date));
                const startIdx = firstEv ? (pbIdx.get(firstEv.date) as number) : 0;
                setActiveIndex(startIdx);
                playIdxRef.current = startIdx;
              }
              setPlaying((p) => !p);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-glow)] transition-colors"
          >
            {playing ? '❚❚ Pause' : '▷ Play story'}
          </button>
          <button
            onClick={() => setStoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-kd-border text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors"
          >
            ⤢ Story mode
          </button>
          <span className="text-[11px] text-muted font-mono">
            {storyEvents.length} signal events · price × data story
          </span>
        </div>
      )}
      <div id="study-chart" style={{ scrollMarginTop: 118 }} className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-3 mb-3">
        <div className="min-w-0">{chartArea}</div>
        <div className="flex flex-col gap-3 min-w-0">
          {snapshot && (hasRsData ? (
            <SignalFlipCard
              title="Magic RS"
              minHeight={180}
              widget={<MagicRsSubchart data={magicRsData} activeIndex={effectiveIdx} benchmarkLabel="NIFTY 500" />}
              chart={
                <SignalLineChart
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  data={pulseBars as any}
                  series={[
                    { key: 'magic_rs', color: 'var(--gold, #d4a84b)', label: 'Magic RS' },
                    { key: 'magic_ma', color: 'var(--text-faint, #64748b)', label: 'MA', dashed: true },
                  ]}
                  refLines={[{ y: 0 }]}
                />
              }
            />
          ) : (
            <div className="rounded-lg bg-kd-card border border-kd-border p-3">
              <div className="text-[11px] font-serif font-semibold text-primary mb-1">Magic RS</div>
              <div className="text-[10px] text-muted leading-snug">Not computed (RS vs NIFTY 500 needs a benchmark series — absent for many BSE/thin names).</div>
            </div>
          ))}
          {!isLoading && !isError && rows.length > 0 && tf === 'daily' && (
            <CockpitIndicatorPanels rows={rows} />
          )}
          {snapshot && (
            <DivergenceCard
              divergence={snapshot.divergence}
              rsiHistory={rsiHistory}
              priceHistory={priceHistory}
            />
          )}
        </div>
      </div>
      {pulseBars.length > 0 && (
        <div className="mt-1">
          <TimelineSlider
            total={pulseBars.length}
            activeIndex={effectiveIdx}
            bars={pulseBars}
            corrHistory={corrHistory}
            onChange={setActiveIndex}
          />
        </div>
      )}
    </>
  );

  return (
    <ErrorBoundary>
      <div className="animate-fade-in">
        {/* ═══ Hero — exact-replica 2-column top (Stock DeepDive): identity ·
            price · stat pills · VaNi read (left) and the verdict card (right,
            equity). Replaces the old sticky command bar. ═══ */}
        <div className="mb-4">
          {/* Back · type badge · bookmark */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 text-xs text-muted hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <span className={cn(
              'text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border',
              isIndex
                ? 'text-accent-cyan border-accent-cyan/30 bg-accent-cyan/8'
                : 'text-accent-violet border-accent-violet/30 bg-accent-violet/8',
            )}>
              {isIndex ? 'INDEX' : 'EQUITY'}
            </span>
            {isEquity && <BookmarkToggle equityId={numId} size={16} />}
            {/* Add / show position — equity only (positions are equity-scoped) */}
            {isEquity && !isLoading && rows.length > 0 && (() => {
              const bmRow = bookmarks.find((b) => b.equity_id === numId);
              const pos = bmRow?.entry_price != null ? bmRow : null;
              if (pos) {
                const pnl = currentClose && pos.entry_price ? ((currentClose - pos.entry_price) / pos.entry_price) * 100 : null;
                return (
                  <button
                    onClick={() => setDvTab('thesis')}
                    title="View your position thesis"
                    className={cn(
                      'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border transition-colors',
                      pnl != null && pnl < 0
                        ? 'text-risk-red border-risk-red/40 bg-risk-red/10'
                        : 'text-risk-green border-risk-green/40 bg-risk-green/10',
                    )}
                  >
                    ● POSITION{pnl != null ? ` ${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}%` : ''}
                  </button>
                );
              }
              return (
                <button
                  onClick={() => { setWantPositionForm(true); setDvTab('thesis'); }}
                  title="Add a position — track entry, P&L and thesis health"
                  className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border border-kd-border text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
                >
                  ＋ Position
                </button>
              );
            })()}
          </div>

          <div className={cn('grid gap-4 items-start', 'grid-cols-1 lg:grid-cols-[1.35fr_1fr]')}>
            {/* LEFT — identity · price · stats · read */}
            <div className="min-w-0 flex flex-col gap-3">
              <div>
                <h1 className="inline text-2xl font-bold tracking-tight text-[var(--text-primary)]">{name}</h1>
                {isEquity && equityPulse.meta?.industry && (
                  <span className="ml-2 text-xs text-muted">NSE · {equityPulse.meta.industry}</span>
                )}
              </div>

              {!isLoading && latest && (() => {
                const r5 = (latest as { ret_5d?: number | null }).ret_5d ?? null;
                const chg = r5 ?? changePct;
                const pos = chg >= 0;
                return (
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-3xl font-bold mono text-[var(--text-primary)]">
                      {currentClose.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className={cn('flex items-center gap-1 text-sm font-bold mono', pos ? 'text-risk-green' : 'text-risk-red')}>
                      {pos ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {pos ? '+' : ''}{chg.toFixed(2)}%
                      <span className="text-muted font-normal ml-1">/ {r5 != null ? '5D' : '1D'}</span>
                    </span>
                  </div>
                );
              })()}

              {!isLoading && latest && (
                <div className="flex flex-wrap gap-2 text-xs items-center">
                  <StatPill label="H/L" value={`${fmt(latest.high)} / ${fmt(latest.low)}`} />
                  <StatPill label="52W" value={`${fmt(low52w)} – ${fmt(high52w)}`} />
                  {latest.rsi_14 != null && <StatPill label="RSI" value={latest.rsi_14.toFixed(1)} />}
                  {latest.magic_rs_zone && <StatPill label="RS" value={latest.magic_rs_zone} />}
                  {isEquity && equityPulse.meta && !equityPulse.meta.is_active && (
                    <span className="text-[10px] font-mono text-risk-amber bg-risk-amber/10 px-1.5 py-0.5 rounded">
                      Inactive — last traded {latest.trade_date}
                    </span>
                  )}
                  {isEquity && (() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const daysSince = Math.round((new Date(todayStr).getTime() - new Date(latest.trade_date).getTime()) / 86400000);
                    return daysSince > 1 && equityPulse.meta?.is_active ? (
                      <span className="text-[10px] font-mono text-muted">Last updated: {latest.trade_date} ({daysSince}d ago)</span>
                    ) : null;
                  })()}
                </div>
              )}

              {/* VaNi Read — now in the hero's left column */}
              {!isLoading && !isError && rows.length > 0 && (aiLoading || aiData?.insight) && (
                <div id="study-read" style={{ scrollMarginTop: 118 }}>
                  {!isEquity && snapshot?.corrState.tagline && (
                    <div className="text-[11px] mb-1.5" style={{ color: snapshot.corrState.color }}>
                      ● <span className="font-semibold">{snapshot.corrState.state}</span>
                      <span className="text-muted"> — {snapshot.corrState.tagline}</span>
                    </div>
                  )}
                  <div className="relative overflow-hidden" style={!readExpanded ? { maxHeight: 130 } : undefined}>
                    <VaNiInsight insight={aiData?.insight} isLoading={aiLoading} highlightChips className="mt-0" />
                    {!readExpanded && !aiLoading && (
                      <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none" style={{ background: 'linear-gradient(transparent, var(--bg))' }} />
                    )}
                  </div>
                  {!aiLoading && aiData?.insight && (
                    <button
                      onClick={() => setReadExpanded((e) => !e)}
                      className="mt-1 text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      {readExpanded ? '▴ Collapse' : '▾ Read full VaNi analysis'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT — verdict card (equity + index; index swaps Liquidity→Breadth) */}
            {!isLoading && latest && (
              <div className="min-w-0">
                <VerdictHero
                  latest={latest}
                  snapshot={snapshot}
                  mode={isIndex ? 'index' : 'equity'}
                  breadthPct={breadthPct}
                />
              </div>
            )}
          </div>

        </div>

        {/* ═══ Tabs — Analysis · Chart & Replay · Data · Results (Stock DeepDive
            Slice 3). SHARED by equity + index. Data/Results are placeholders. ═══ */}
        {(isEquity || isIndex) && !isLoading && rows.length > 0 && (
          <div className="flex items-center gap-1 mb-3 border-b border-kd-border">
            {([['analysis', 'Analysis'], ['chart', 'Chart & Replay'], ['thesis', 'Thesis']] as const)
              .filter(([id]) => id !== 'thesis' || isEquity)
              .map(([id, label]) => (
              <button
                key={id}
                onClick={() => setDvTab(id)}
                className={cn(
                  'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  dvTab === id
                    ? 'border-[var(--accent)] text-[var(--text-primary)]'
                    : 'border-transparent text-muted hover:text-[var(--text-primary)]',
                )}
              >
                {label}
              </button>
            ))}
            <span className="px-3 py-2 text-sm text-[var(--text-faint)] cursor-default">Data · soon</span>
            <span className="px-3 py-2 text-sm text-[var(--text-faint)] cursor-default">Results · soon</span>
          </div>
        )}

        {/* ═══ ANALYSIS TAB ═══ Sections gate by CAPABILITY, not by a hard
            equity/index fork: Strength is shared (RS reads the common magic_rs
            columns); the industry/scan/membership right column + Money Flow +
            the Order/Smart/Big/Delivery grid are equity-only; Breadth is
            index-native. ═══ */}

        {/* Pump/Dump Banner — equity only */}
        {isEquity && dvTab === 'analysis' && pumpDumpResult && (
          <div className="mb-2">
            <PumpDumpBanner result={pumpDumpResult} />
          </div>
        )}

        {/* ═══ Chapter: Strength — SHARED (equity + index). RS pills + rotation
            quadrant read the shared magic_rs columns; the right-column context
            (industry / scan presence / index membership) is equity-only; the
            detailed snapshot (StatStrip) closes the chapter for both. ═══ */}
        {dvTab === 'analysis' && !isLoading && latest && (
          <section id="study-strength" style={{ scrollMarginTop: 118 }} className="mb-3">
            <SectionLabel>Strength</SectionLabel>
            {hasRsData && (
              <div className="mb-2">
                <MultiTimeframePills
                  rsChange1d={rsChange1d}
                  rsChange5d={rsChange5d}
                  rsChange20d={rsChange20d}
                  currentRs={pulseBars[effectiveIdx]?.magic_rs ?? null}
                  benchmarkLabel="NIFTY 500"
                />
              </div>
            )}
            {/* 2fr/1fr + a STACKED right column (industry + scan presence +
                membership) for equities so the tall quadrant doesn't leave a
                blank column (owner QA 2026-07-12); indices drop the right
                column (no per-stock context) and let the quadrant run full. */}
            <div className={cn('grid grid-cols-1 gap-3', isEquity && 'lg:grid-cols-[2fr_1fr]')}>
              <div className="min-w-0">
                {tf === 'daily' && hasRsData ? (
                  <RotationGraph points={rotationPoints} benchmark="NIFTY 500" autoPlay playSeconds={7} breakaway={latestBreakaway} />
                ) : (
                  <div className="glass-card rounded-xl p-3 text-[10px] text-muted">
                    RS-Rotation is available on the daily timeframe{hasRsData ? '' : ' (RS not computed here)'}.
                  </div>
                )}
              </div>
              {isEquity && (
                <div className="min-w-0 flex flex-col gap-3">
                  <IndustryContextCard
                    industry={equityPulse.meta?.industry ?? null}
                    context={equityPulse.industryContext}
                  />
                  <ScanPresenceCard stock={scanPresence.stock} matchedScans={scanPresence.matchedScans} />
                  <div className="glass-card rounded-xl">
                    <button
                      onClick={() => setMembershipOpen((o) => !o)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                    >
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                        Index membership
                      </span>
                      <span className="text-[10px] text-[var(--text-faint)]">{membershipOpen ? '▴' : '▾'}</span>
                    </button>
                    {membershipOpen && (
                      <div className="px-1 pb-1">
                        <SectorMembershipCard equityId={numId} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* Momentum & Returns evidence — the detailed snapshot (StatStrip,
                reused) closes the Strength chapter for both types. */}
            <div className="mt-3">
              <StatStrip
                latest={latest}
                mcapCr={equityPulse.meta?.mcap_cr ?? scanPresence.stock?.mcap_cr ?? null}
                isEquity={isEquity}
              />
            </div>
          </section>
        )}

        {/* ═══ Chapter: Breadth — INDEX only (index-native: % of constituents
            participating). Reuses the market-breadth chart + ROC. Deliberately
            NOT volume — km_index_eod volume has a scale discontinuity. ═══ */}
        {isIndex && dvTab === 'analysis' && !isLoading && (
          <section id="study-breadth" style={{ scrollMarginTop: 118 }} className="mb-3">
            <SectionLabel>Breadth</SectionLabel>
            {indexMoveQuality && (
              <div className="mb-2">
                <MoveQualityCard mq={indexMoveQuality} compact />
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
              <MarketBreadthChart
                data={indexBreadth?.data}
                isLoading={breadthLoading}
                zoneMode={indexBreadth?.zoneMode}
                percentileRank={indexBreadth?.percentileRank ?? undefined}
                stockCount={indexBreadth?.stockCount}
              />
              <BreadthRocChart
                data={indexBreadth?.roc}
                isLoading={breadthLoading}
                rocBadge={indexBreadth?.rocBadge}
              />
            </div>
          </section>
        )}

        {/* ═══ Chapter: Money Flow — EQUITY only ("is real money entering?") ═══ */}
        {isEquity && dvTab === 'analysis' && !isLoading && !isError && rows.length > 0 && (
          <section id="study-flow" style={{ scrollMarginTop: 118 }} className="mb-3">
            <SectionLabel>Money Flow</SectionLabel>
            {tf === 'daily' ? (
              <StockFlowHeatmap label={name} rows={rows} />
            ) : (
              <div className="glass-card rounded-xl p-3 text-[10px] text-muted">
                Flow heatmap is available on the daily timeframe.
              </div>
            )}
          </section>
        )}

        {/* Order Flow · Smart Money · Big Money / Delivery — EQUITY only */}
        {isEquity && dvTab === 'analysis' && snapshot && (
          <div className="grid grid-cols-1 lg:grid-cols-[37fr_38fr_25fr] gap-3 mb-3">
            <OrderFlowCard
              bar={snapshot.bar}
              rss={snapshot.rss}
              rssHistory={rssHistory}
              narrative={flowNarrative}
            />
            <SignalFlipCard
              title="Smart Money"
              widget={
                <SmartMoneyCard
                  smHistory={smHistory}
                  sm={snapshot.sm}
                  dots={[snapshot.dots]}
                  narrative={smNarrative}
                />
              }
              chart={
                <SignalLineChart
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  data={pulseBars as any}
                  series={[
                    { key: 'sniper_inst', color: 'var(--accent-indigo, #6366f1)', label: 'Institution' },
                    { key: 'sniper_hot', color: 'var(--caution, #f59e0b)', label: 'Hot Money' },
                  ]}
                  refLines={[{ y: 35 }]}
                  domain={[0, 50]}
                />
              }
            />
            <div className="lg:row-span-2">
              <BigMoneyCard events={bigMoneyEvents} />
            </div>
            <div className="lg:col-span-2">
              <DeliveryVsTraded rows={rows} />
            </div>
          </div>
        )}

        {/* ═══ RESERVED CHAPTERS (Study reorg 2026-07-12) — #study-fundamentals,
            #study-events — render nothing until their data pipelines land. ═══ */}

        {/* ═══ CHART & REPLAY TAB — SHARED (equity + index) ═══
            When ?setup=<preset> is present, a segmented Story View / Story Play
            toggle is shown at the top. Story View = static annotated setup
            (ScannerArrivalView); Story Play = existing animated replay chart.
            See: docs/claude/scanner-story-page-poa.md */}
        {dvTab === 'chart' && (
          <>
            {isEquity && setupParam && (
              <StoryModeToggle mode={storyMode} onChange={setStoryMode} />
            )}
            {/* Chart + right-column indicators are ALWAYS the same TradingChart
                (via replayTab) — Story View and Story Play differ only in what
                sits BELOW: editorial sidebar cards vs the replay scrubber. */}
            {replayTab}
            {isEquity && setupParam && storyMode === 'view' && (
              <div className="mt-4">
                <ScannerArrivalView equityId={numId} setupKey={setupParam} />
              </div>
            )}
          </>
        )}

        {/* ═══ THESIS TAB — equity only (Phase 2a). The verification cockpit:
            adapts to position / watchlist / cold. Deep-linked via ?tab=thesis. ═══ */}
        {isEquity && dvTab === 'thesis' && !isLoading && rows.length > 0 && (
          <ThesisTab
            bars={rows as unknown as ThesisBar[]}
            equityId={numId}
            name={name}
            currentClose={currentClose}
            autoOpenForm={wantPositionForm}
            onAutoOpened={() => setWantPositionForm(false)}
          />
        )}

      </div>

      {/* Overlay picker — the same Workspace-launched drawer (z-200) */}
      <CatalogDrawer
        isOpen={overlayDrawerOpen}
        onClose={() => setOverlayDrawerOpen(false)}
        context="overlay"
      />

      {/* Focused single-view story replay (equity + index) */}
      {(isEquity || isIndex) && (
        <StoryMode
          open={storyOpen}
          onClose={() => setStoryOpen(false)}
          bars={rows}
          name={name}
          latest={latest ?? null}
          snapshot={snapshot}
          bigMoneyDates={bigMoneyDates}
          sectorByDate={sectorByDate}
          breadthByDate={breadthByDate}
          mode={isIndex ? 'index' : 'equity'}
          breadthPct={breadthPct}
          overlays={frameworkOverlays}
          astroBands={astroBands}
        />
      )}
    </ErrorBoundary>
  );
}

// ── Helpers ─────────────────────────────────────────────────────

/** Segmented toggle for the Chart & Replay tab when the user arrives
 *  from a scanner (?setup=<preset>). Story View = static annotated setup;
 *  Story Play = animated timeline replay. Same tab, two lenses on the same
 *  story arc. See: docs/claude/scanner-story-page-poa.md */
function StoryModeToggle({ mode, onChange }: { mode: 'view' | 'play'; onChange: (m: 'view' | 'play') => void }) {
  const btn = (m: 'view' | 'play', label: string, hint: string) => {
    const active = mode === m;
    return (
      <button
        key={m}
        onClick={() => onChange(m)}
        title={hint}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
          active
            ? 'bg-[var(--accent-glow)] text-[var(--accent)] border border-[var(--accent)]'
            : 'text-muted hover:text-[var(--text-primary)] border border-transparent'
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div className="inline-flex items-center gap-1 p-1 mb-3 rounded-lg border border-kd-border bg-kd-elevated/30">
      {btn('view', '☰ Story View', 'Static annotated setup — key levels, entry zones, what confirms')}
      {btn('play', '▷ Story Play', 'Animated replay — watch price × signals unfold over time')}
    </div>
  );
}

/** Chapter label — small-caps eyebrow + fading hairline (Study reorg). */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[9px] font-mono font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)] whitespace-nowrap">
        {children}
      </span>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--border), transparent)' }} />
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-1.5 bg-kd-elevated border border-kd-border rounded-xl">
      <span className="text-muted">{label}: </span>
      <span className="text-[var(--text-secondary)] mono font-medium">{value}</span>
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


