import { useState } from 'react';
import { useConfluenceTimeline } from '@/hooks';
import { Loader2, AlertCircle } from 'lucide-react';
import type { ConfluenceTimelineEntry } from '@/types';

// ── Period config ─────────────────────────────────────────────────────────────

const PERIODS = [
  { label: '30D', days: 22 },
  { label: '60D', days: 44 },
  { label: '90D', days: 66 },
] as const;
type PeriodLabel = typeof PERIODS[number]['label'];

// ── Color functions ───────────────────────────────────────────────────────────

function nakvarColor(outcome: string | null): string {
  if (outcome === 'bullish') return '#22c55e';
  if (outcome === 'bearish') return '#ef4444';
  return '#334155'; // dark grey = none
}

function breadthColor(score: number | null): string {
  if (score == null) return '#1e293b';
  if (score > 55) return '#22c55e';
  if (score > 35) return '#f59e0b';
  return '#ef4444';
}

function rocColor(roc: number | null): string {
  if (roc == null) return '#1e293b';
  if (roc > 1)  return '#22c55e';
  if (roc > 0)  return '#14b8a6';
  if (roc > -1) return '#f97316';
  return '#ef4444';
}

function niftyColor(ret: number | null): string {
  if (ret == null) return '#1e293b';
  const abs = Math.abs(ret);
  if (ret > 0) {
    return abs > 1 ? '#16a34a' : abs > 0.5 ? '#22c55e' : '#86efac';
  }
  return abs > 1 ? '#b91c1c' : abs > 0.5 ? '#ef4444' : '#fca5a5';
}

// ── Date formatter ────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtColDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${+day}${MONTHS[+m - 1]}`;
}

// ── Row definitions ───────────────────────────────────────────────────────────

interface RowDef {
  label:    string;
  sub:      string;
  colorFn:  (entry: ConfluenceTimelineEntry) => string;
  tipValue: (entry: ConfluenceTimelineEntry) => string;
}

const ROWS: RowDef[] = [
  {
    label:    'Nak-Vara',
    sub:      'bullish / bearish / —',
    colorFn:  e => nakvarColor(e.nakvar_outcome),
    tipValue: e => e.nakvar_outcome ?? '—',
  },
  {
    label:    'Breadth',
    sub:      '>55 green · 35–55 amber · <35 red',
    colorFn:  e => breadthColor(e.breadth_score),
    tipValue: e => e.breadth_score != null ? e.breadth_score.toFixed(1) : '—',
  },
  {
    label:    'ROC',
    sub:      '>1 green · 0–1 teal · -1–0 orange · <-1 red',
    colorFn:  e => rocColor(e.roc_13),
    tipValue: e => e.roc_13 != null ? (e.roc_13 >= 0 ? `+${e.roc_13.toFixed(4)}` : e.roc_13.toFixed(4)) : '—',
  },
  {
    label:    'Nifty Return',
    sub:      'green > 0 · red < 0 (intensity = magnitude)',
    colorFn:  e => niftyColor(e.nifty_return),
    tipValue: e => e.nifty_return != null ? `${e.nifty_return >= 0 ? '+' : ''}${e.nifty_return.toFixed(2)}%` : '—',
  },
];

// ── Dot ───────────────────────────────────────────────────────────────────────

const DOT = 28;
const GAP = 4;
const COL = DOT + GAP;
const LABEL_W = 110;
const HEADER_H = 52;
const ROW_H = DOT + 6;

interface TooltipState {
  x: number;
  y: number;
  entry: ConfluenceTimelineEntry;
  rowIdx: number;
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10 }}>
      {[
        { color: '#22c55e', label: 'Nak-Vara: Bullish' },
        { color: '#ef4444', label: 'Nak-Vara: Bearish' },
        { color: '#334155', label: 'Nak-Vara: None' },
        { color: '#f59e0b', label: 'Breadth: Moderate' },
        { color: '#14b8a6', label: 'ROC: Positive (0–1)' },
        { color: '#f97316', label: 'ROC: Negative (-1–0)' },
        { color: '#86efac', label: 'Nifty: Small gain' },
        { color: '#fca5a5', label: 'Nifty: Small loss' },
      ].map(({ color, label }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#475569' }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ConfluenceDotGrid() {
  const [period, setPeriod] = useState<PeriodLabel>('30D');
  const days = PERIODS.find(p => p.label === period)!.days;
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const { data = [], isLoading, isError } = useConfluenceTimeline(days);

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '13px 18px 11px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            Day-by-Day Signal Grid
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            Nak-Vara · Breadth · ROC · NIFTY 50 return — each column = one trading day
          </div>
        </div>

        {/* Period toggle */}
        <div style={{
          display: 'flex',
          gap: 2,
          padding: '3px',
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
        }}>
          {PERIODS.map(p => (
            <button
              key={p.label}
              onClick={() => setPeriod(p.label)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: 5,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: period === p.label ? '#818cf8' : 'transparent',
                color: period === p.label ? '#fff' : '#94a3b8',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 18px 16px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 0', color: '#475569' }}>
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#818cf8' }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12 }}>Loading timeline…</span>
          </div>
        ) : isError ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 0', color: '#ef4444' }}>
            <AlertCircle className="w-4 h-4" />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12 }}>Failed to load — backend may be offline</span>
          </div>
        ) : data.length === 0 ? (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#475569', padding: '24px 0', textAlign: 'center' }}>
            No timeline data available
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* Grid */}
            <div style={{ display: 'flex' }}>

              {/* Fixed left labels column */}
              <div style={{ width: LABEL_W, flexShrink: 0 }}>
                {/* Spacer for date header */}
                <div style={{ height: HEADER_H }} />
                {ROWS.map(row => (
                  <div
                    key={row.label}
                    style={{
                      height: ROW_H,
                      display: 'flex',
                      alignItems: 'center',
                      paddingRight: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {row.label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Scrollable grid area */}
              <div style={{ overflowX: 'auto', flex: 1 }}>
                <div style={{ minWidth: data.length * COL, width: 'max-content' }}>

                  {/* Date headers — rotated 45° */}
                  <div style={{ display: 'flex', height: HEADER_H, alignItems: 'flex-end', paddingBottom: 4 }}>
                    {data.map(entry => (
                      <div
                        key={entry.trade_date}
                        style={{ width: COL, flexShrink: 0, display: 'flex', justifyContent: 'center' }}
                      >
                        <div style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          color: '#64748b',
                          transform: 'rotate(-45deg)',
                          transformOrigin: 'bottom center',
                          whiteSpace: 'nowrap',
                          lineHeight: 1,
                        }}>
                          {fmtColDate(entry.trade_date)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Dot rows */}
                  {ROWS.map((row, rowIdx) => (
                    <div key={row.label} style={{ display: 'flex', marginBottom: GAP }}>
                      {data.map(entry => {
                        const color = row.colorFn(entry);
                        return (
                          <div
                            key={entry.trade_date}
                            style={{ width: COL, flexShrink: 0, display: 'flex', justifyContent: 'center' }}
                            onMouseEnter={e => {
                              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                              setTooltip({
                                x: rect.left + rect.width / 2,
                                y: rect.top - 8,
                                entry,
                                rowIdx,
                              });
                            }}
                            onMouseLeave={() => setTooltip(null)}
                          >
                            <div style={{
                              width: DOT,
                              height: DOT,
                              borderRadius: 6,
                              background: color,
                              cursor: 'default',
                              transition: 'transform 0.1s, opacity 0.1s',
                            }}
                              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.15)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tooltip (portal-like, absolute positioned) */}
            {tooltip && (
              <div
                style={{
                  position: 'fixed',
                  left: tooltip.x,
                  top: tooltip.y,
                  transform: 'translate(-50%, -100%)',
                  zIndex: 9999,
                  background: '#0f172a',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  pointerEvents: 'none',
                  minWidth: 160,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}
              >
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>
                  {tooltip.entry.trade_date}
                </div>
                {ROWS.map((row, i) => (
                  <div key={row.label} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 2,
                    opacity: tooltip.rowIdx === i ? 1 : 0.55,
                  }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: '#64748b' }}>{row.label}</span>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      fontWeight: tooltip.rowIdx === i ? 700 : 400,
                      color: row.colorFn(tooltip.entry),
                    }}>
                      {row.tipValue(tooltip.entry)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Legend />
      </div>
    </div>
  );
}
