/**
 * IntradayPage — DristiQ Intraday Cockpit
 * ========================================
 * Cycle 2 — page shell, chart reuse, sidebar placeholders.
 *
 * Cycle 3 will add: TopStrip 9-cell, AlertStrip, PanchangBand,
 *                   Rahu/Abhijit live pills.
 * Cycle 4 will add: ConflictEngine card, ConfluenceDial.
 * Cycle 5 will add: Panchang/Planets sidebar tables, 4 indicator panels,
 *                   LP placeholder.
 *
 * Spec: docs/dristiq/intraday_page_spec.md
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useVisualPulse } from '@/hooks/useVisualPulse';
import { useLastTradingDate } from '@/hooks/useLastTradingDate';
import { useIntraday } from '@/hooks/useIntraday';
import { from } from '@/services/postgrest';
import { useQuery } from '@tanstack/react-query';
import {
  computePulseSnapshot,
  computeCorrHistory,
  computeDots,
  type DotSignals,
  type CorrelationState,
} from '@/services/visualPulseEngine';
import {
  VisualPulseChart,
  AstroStrip,
  TimelineSlider,
  VaNiHeader,
  VaNiSentence,
} from '@/components/domain/VisualPulse';
import IntradayHeader from './IntradayHeader';
import MarketClosedBanner from './MarketClosedBanner';

// ── Helpers ──────────────────────────────────────────────────────────

function todayIstIso(): string {
  const ist = new Date(Date.now() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().slice(0, 10);
}

interface IndexMeta { id: number; name: string; }

async function fetchIndexMeta(id: number): Promise<IndexMeta | null> {
  const { data, error } = await from('km_index_symbols')
    .select('id,name')
    .eq('id', id)
    .limit(1)
    .execute();
  if (error || !data || data.length === 0) return null;
  return data[0] as IndexMeta;
}

// ── Sidebar placeholder card ────────────────────────────────────────

function PlaceholderCard({ title, cycle }: { title: string; cycle: string }) {
  return (
    <div style={{
      border: '1px dashed var(--kd-border)',
      borderRadius: 4,
      padding: '10px 12px',
      background: 'var(--kd-panel, rgba(255,255,255,0.02))',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
        color: 'var(--text-faint)', letterSpacing: '0.12em',
        textTransform: 'uppercase', marginBottom: 4,
      }}>{title}</div>
      <div style={{
        fontFamily: 'var(--font-mono, monospace)', fontSize: 10,
        color: 'var(--text-muted)',
      }}>arrives in {cycle}</div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────

export default function IntradayPage() {
  const { indexId } = useParams<{ indexId: string }>();
  const numId = indexId ? parseInt(indexId, 10) : null;

  // Resolve calendar date and trading date
  const today = todayIstIso();
  const { lastTradingDate, isHoliday } = useLastTradingDate(today);

  // Index metadata (name)
  const metaQuery = useQuery({
    queryKey: ['index-meta', numId],
    queryFn: () => fetchIndexMeta(numId!),
    enabled: !!numId,
    staleTime: 60 * 60 * 1000,
  });
  const indexName = metaQuery.data?.name ?? `Index ${numId ?? '?'}`;

  // Bars + DC inferences (reuse existing VP infrastructure)
  const { bars, dcInferences, isLoading, error } = useVisualPulse(numId);

  // Panchang + plan score for the resolved trading date
  const { panchang, planScore } = useIntraday(lastTradingDate);

  // Local UI state
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isFading, setIsFading] = useState(false);

  // Default to latest bar when data loads
  const effectiveIdx = activeIndex ?? (bars.length > 0 ? bars.length - 1 : 0);

  // Pre-compute dots for all bars (so TimelineSlider can render coloured cells)
  const dotsHistory: DotSignals[] = useMemo(() => {
    return bars.map((b, i) => computeDots(b, i > 0 ? bars[i - 1] : null));
  }, [bars]);

  // Correlation history — use Balanced style for Cycle 2 (style toggle is Cycle 5)
  const corrHistory: CorrelationState[] = useMemo(() => {
    if (bars.length === 0) return [];
    return computeCorrHistory(bars, dcInferences, 'Balanced');
  }, [bars, dcInferences]);

  // Snapshot for VaNiSentence corrState
  const snapshot = useMemo(() => {
    if (bars.length === 0) return null;
    return computePulseSnapshot(bars, effectiveIdx, dcInferences, 'Balanced');
  }, [bars, effectiveIdx, dcInferences]);

  // Slider change with fade
  const handleSliderChange = useCallback((idx: number) => {
    setIsFading(true);
    setTimeout(() => {
      setActiveIndex(idx);
      setIsFading(false);
    }, 180);
  }, []);

  // Reset activeIndex when bars change (e.g. switching index)
  useEffect(() => { setActiveIndex(null); }, [numId]);

  // ── Loading / Error / Empty ──
  if (!numId) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono, monospace)', fontSize: 12,
      }}>Invalid index ID</div>
    );
  }

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono, monospace)', fontSize: 12,
      }}>Loading Intraday...</div>
    );
  }

  if (error || bars.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono, monospace)', fontSize: 12,
      }}>{error ? `Error: ${error.message}` : 'No data available'}</div>
    );
  }

  const bar = snapshot?.bar ?? bars[effectiveIdx];
  const isNow = effectiveIdx === bars.length - 1;
  const lastClose = bar?.close ?? null;
  const pctChng = bar && bar.open
    ? ((bar.close - bar.open) / bar.open) * 100
    : null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateRows: 'auto auto 1fr 58px',
      height: '100%',
      overflow: 'hidden',
      background: 'var(--kd-bg)',
    }}>
      {/* Header bar */}
      <IntradayHeader
        symbolName={indexName}
        lastClose={lastClose}
        pctChng={pctChng}
        tradeDate={lastTradingDate}
        isHoliday={isHoliday}
      />

      {/* Holiday banner (only when isHoliday) */}
      {isHoliday
        ? <MarketClosedBanner fallbackDate={lastTradingDate} />
        : <div />}

      {/* Body — chart left, sidebar right */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        minHeight: 0, overflow: 'hidden',
      }}>
        {/* Left pane — chart + astro strip */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          padding: '12px 16px', overflow: 'hidden',
          borderRight: '1px solid var(--kd-border)',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
            color: 'var(--text-faint)', letterSpacing: '0.1em',
            marginBottom: 6,
          }}>
            {indexName} · {bars.length} BARS · Bar {effectiveIdx + 1} {isNow ? '(NOW)' : ''}
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            <VisualPulseChart
              bars={bars}
              activeIndex={effectiveIdx}
              corrHistory={corrHistory}
              dotsHistory={dotsHistory}
            />
          </div>

          <AstroStrip dcInferences={dcInferences} activeDate={bar.trade_date} />

          {/* INTRADAY: when km_index_15m is populated, swap VisualPulseChart
              for an intraday 5-min chart and TimelineSlider semantics shift
              from "scrub days" to "scrub today's bars". */}
        </div>

        {/* Right sidebar — VaNi + placeholders */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* VaNi */}
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--kd-border)' }}>
            <VaNiHeader
              date={bar.trade_date}
              barPosition={isNow ? 'NOW' : `Bar ${effectiveIdx + 1} / ${bars.length}`}
              isThinking={isFading}
            />
          </div>

          <div style={{
            flex: 1, overflowY: 'auto', padding: '10px 14px',
            display: 'flex', flexDirection: 'column', gap: 10,
            opacity: isFading ? 0.3 : 1,
            transition: 'opacity 0.15s ease',
          }}>
            {snapshot && (
              <VaNiSentence
                narrative={null}
                corrState={snapshot.corrState}
                date={bar.trade_date}
                isFading={isFading}
              />
            )}

            {/* Placeholders — populated in later cycles */}
            <PlaceholderCard title="Confluence Score"        cycle="Cycle 4" />
            <PlaceholderCard title="Conflict Engine"         cycle="Cycle 4" />
            <PlaceholderCard title="Panchang"                cycle="Cycle 5" />
            <PlaceholderCard title="Planets"                 cycle="Cycle 5" />
            <PlaceholderCard title="LP + FIN Bridge"         cycle="Cycle 5 (LP webhook pending)" />

            {/* Cycle 1 sanity strip — proves data layer is wired */}
            {planScore && (
              <div style={{
                marginTop: 4, padding: '6px 8px',
                background: 'var(--kd-panel, rgba(255,255,255,0.02))',
                border: '1px solid var(--kd-border)', borderRadius: 4,
                fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
                color: 'var(--text-muted)', letterSpacing: '0.05em',
              }}>
                plan_score={planScore.plan_score.toFixed(2)} ·
                {' '}rules={planScore.contributing_rules} ·
                {' '}calibrated={planScore.is_calibrated ? 'yes' : 'no'}
              </div>
            )}
            {panchang && (
              <div style={{
                padding: '6px 8px',
                background: 'var(--kd-panel, rgba(255,255,255,0.02))',
                border: '1px solid var(--kd-border)', borderRadius: 4,
                fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
                color: 'var(--text-muted)', letterSpacing: '0.05em',
              }}>
                vara={panchang.vara} · yoga={panchang.yoga_name ?? '—'} ·
                {' '}rahu={panchang.rahu_kala_start ?? '—'}–{panchang.rahu_kala_end ?? '—'} ·
                {' '}abh={panchang.abhijit_start ?? '—'}–{panchang.abhijit_end ?? '—'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom — TimelineSlider */}
      <TimelineSlider
        total={bars.length}
        activeIndex={effectiveIdx}
        bars={bars}
        corrHistory={corrHistory}
        onChange={handleSliderChange}
      />
      {/* INTRADAY: TimelineSlider semantics change to scrub today's 5-min bars */}
    </div>
  );
}
