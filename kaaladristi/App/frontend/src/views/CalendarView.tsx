import { useState, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, LayoutGrid, AlignLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import {
  fetchMonthEvents, fetchMonthSignals, fetchKeyEvents,
  createCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
} from '@/services/astroCalendar';
import type { AstroCalendarEvent, AstroDailySignal, AstroCalendarPayload, SignalItem } from '@/services/astroCalendar';
import { SIGNAL_CLASSES as ASTRO_SIGNAL_CLASSES, SIGNAL_LABELS as ASTRO_SIGNAL_LABELS, impactToColor, IMPACT_OPTIONS } from '@/constants/signalScale';
import {
  MONTH_ABBR, MONTH_FULL, DAY_ABBR,
  getDaysInMonth, getFirstWeekdayOffset, toIso, todayIso, fmtDate,
} from '@/lib/dateUtils';

// ── Bias meta ─────────────────────────────────────────────────────────────────

const BIAS: Record<string, { fill: string; border: string; label: string }> = {
  strong_bullish: { fill: 'rgba(110,207,154,0.85)', border: 'var(--bull)',    label: 'Strong Uptrend'   },
  bullish:        { fill: 'rgba(110,207,154,0.55)', border: 'var(--bull)',    label: 'Positive'         },
  mild_bullish:   { fill: 'rgba(110,207,154,0.28)', border: 'var(--bull)',    label: 'Mild Uptrend'     },
  neutral:        { fill: 'rgba(255,255,255,0.04)', border: 'transparent',   label: 'Neutral'          },
  turning:        { fill: 'rgba(212,168,75,0.45)',  border: 'var(--gold)',   label: 'Turning'          },
  mild_bearish:   { fill: 'rgba(200,130,50,0.28)',  border: 'var(--caution)',label: 'Mild Downtrend'   },
  bearish:        { fill: 'rgba(217,100,80,0.55)',  border: 'var(--caution)',label: 'Negative'         },
  strong_bearish: { fill: 'rgba(217,80,68,0.80)',   border: 'var(--bear)',   label: 'Strong Downtrend' },
  closed:         { fill: 'rgba(46,42,34,0.35)',    border: 'transparent',   label: 'Closed'           },
};

const OUTCOME_MAP: Record<string, { label: string; color: string }> = {
  strong_bullish: { label: 'High +ve',   color: 'var(--bull)' },
  bullish:        { label: 'Positive',   color: 'var(--bull)' },
  mild_bullish:   { label: 'Mod. +ve',   color: 'var(--bull)' },
  turning:        { label: 'Inflection', color: 'var(--gold)' },
  neutral:        { label: 'Neutral',    color: 'var(--text-faint)' },
  mild_bearish:   { label: 'Mod. -ve',   color: 'var(--bear)' },
  bearish:        { label: 'Negative',   color: 'var(--bear)' },
  strong_bearish: { label: 'High -ve',   color: 'var(--bear)' },
};

function getBias(signal: AstroDailySignal | undefined, isWeekend: boolean) {
  if (isWeekend) return BIAS.closed;
  const key = signal?.net_signal?.toLowerCase() ?? 'neutral';
  return BIAS[key] ?? BIAS.neutral;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getActiveEventsForDay(dayIso: string, events: AstroCalendarEvent[]): AstroCalendarEvent[] {
  return events.filter(e => {
    const end = e.end_date ?? e.start_date;
    return dayIso >= e.start_date && dayIso <= end;
  });
}

// ── Day cell ──────────────────────────────────────────────────────────────────

interface DayCellProps {
  dayIso: string;
  dayNum: number;
  weekday: string;
  events: AstroCalendarEvent[];
  signal?: AstroDailySignal;
  isToday: boolean;
  isWeekend: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  onEditEvent?: (ev: AstroCalendarEvent) => void;
}

function DayCell({ dayNum, weekday, events, signal, isToday, isWeekend, isSelected, onClick, onEditEvent }: DayCellProps) {
  const bias    = getBias(signal, isWeekend);
  const turning = signal?.turning_date ?? false;
  const isMajor = events.some(e =>
    e.market_impact === 'strong_bullish' ||
    e.market_impact === 'strong_bearish' ||
    e.market_impact === 'turning'
  );
  const topEvent = events.find(e => !e.is_transit) ?? events[0];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
      style={{
        position: 'relative',
        padding: '9px 9px 8px',
        minHeight: 100,
        textAlign: 'left',
        background: isSelected ? 'rgba(212,168,75,0.06)' : isToday ? 'rgba(212,168,75,0.04)' : 'transparent',
        border: isSelected
          ? '1px solid var(--gold)'
          : isToday
          ? '1px solid rgba(212,168,75,0.5)'
          : '1px solid var(--border)',
        cursor: 'pointer',
        borderRadius: 8,
        opacity: isWeekend ? 0.5 : 1,
        width: '100%',
        transition: 'border-color 0.15s',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 17,
            color: isToday ? 'var(--gold)' : 'var(--text-primary)',
            lineHeight: 1,
          }}>
            {dayNum}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 8,
            color: 'var(--text-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            {weekday}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {turning && <span style={{ color: 'var(--gold)', fontSize: 9 }} title="Turning date">◈</span>}
          {isMajor && <span style={{ color: 'var(--gold)', fontSize: 9 }} title="Major event">★</span>}
          {isToday && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 7,
              color: 'var(--gold)',
              padding: '1px 3px',
              border: '1px solid rgba(212,168,75,0.45)',
              letterSpacing: '0.18em',
            }}>
              NOW
            </span>
          )}
        </div>
      </div>

      {/* 3 segments */}
      {isWeekend ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', height: 30,
          background: 'repeating-linear-gradient(45deg, rgba(46,42,34,0.18) 0 6px, transparent 6px 12px)',
          border: '1px solid var(--border)',
          borderRadius: 4,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-faint)', letterSpacing: '0.22em' }}>
            CLOSED
          </span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, height: 30 }}>
          {(['AM', 'MID', 'CLOSE'] as const).map(lbl => (
            <div
              key={lbl}
              style={{
                background: bias.fill,
                borderBottom: bias.border !== 'transparent' ? `2px solid ${bias.border}` : '2px solid rgba(255,255,255,0.06)',
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 7,
                color: 'rgba(255,255,255,0.35)',
                fontWeight: 700,
                letterSpacing: '0.06em',
              }}>
                {lbl}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Bias label */}
      {!isWeekend && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 8.5,
          color: bias.border !== 'transparent' ? bias.border : 'var(--text-faint)',
          textAlign: 'center',
          marginTop: 3,
          letterSpacing: '0.04em',
        }}>
          {bias.label}
        </div>
      )}

      {/* Nak-vara rule count badge */}
      {!isWeekend && signal && signal.signals.length > 0 && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 8,
          color: 'var(--text-faint)',
          textAlign: 'center',
          marginTop: 2,
          letterSpacing: '0.06em',
        }}>
          {signal.signals.length} nak-vara rule{signal.signals.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Top event name + optional admin edit */}
      {topEvent && !isWeekend && (
        <div style={{ marginTop: 5, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 3 }}>
          <div style={{
            fontSize: 9.5,
            color: isMajor ? 'var(--gold)' : 'var(--text-faint)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.3,
            flex: 1,
          }}>
            {topEvent.display_name}
            {events.length > 1 ? ` +${events.length - 1}` : ''}
          </div>
          {onEditEvent && (
            <button
              onClick={e => { e.stopPropagation(); onEditEvent(topEvent); }}
              title="Edit event"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--gold)', fontSize: 10, padding: '0 1px',
                lineHeight: 1, flexShrink: 0, opacity: 0.7,
              }}
            >
              ✎
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Bias legend ───────────────────────────────────────────────────────────────

function BiasLegend() {
  const items = [
    { key: 'strong_bullish', label: 'Strong Bull' },
    { key: 'bullish',        label: 'Bullish'     },
    { key: 'mild_bullish',   label: 'Mild Bull'   },
    { key: 'neutral',        label: 'Neutral'     },
    { key: 'turning',        label: 'Turning'     },
    { key: 'mild_bearish',   label: 'Mild Bear'   },
    { key: 'bearish',        label: 'Bearish'     },
    { key: 'strong_bearish', label: 'Strong Bear' },
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', alignItems: 'center', marginTop: 16 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        Legend
      </span>
      {items.map(({ key, label }) => {
        const b = BIAS[key];
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 14,
              height: 10,
              background: b.fill,
              borderBottom: `2px solid ${b.border !== 'transparent' ? b.border : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 2,
            }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.1em' }}>
              {label}
            </span>
          </div>
        );
      })}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--gold)', fontSize: 11 }}>◈</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.1em' }}>Turning date</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--gold)', fontSize: 11 }}>★</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.1em' }}>Major event</span>
      </div>
    </div>
  );
}

// ── Month summary strip ───────────────────────────────────────────────────────

function MonthSummary({
  events,
  signals,
  keyEvents,
}: {
  events: AstroCalendarEvent[];
  signals: AstroDailySignal[];
  keyEvents: AstroCalendarEvent[];
}) {
  const posCount    = signals.filter(s => s.net_score > 0).length;
  const cautionCount = signals.filter(s => s.net_signal === 'turning').length;
  const peakCount   = signals.filter(s => s.net_signal === 'strong_bullish' || s.net_signal === 'strong_bearish').length;

  return (
    <div className="glass-card rounded-2xl p-5 mb-6">
      <div className="flex flex-wrap items-start gap-6">
        {/* Stats */}
        <div className="flex gap-4">
          <Stat value={posCount}      label="Bullish Days"  color="text-emerald-400" />
          <Stat value={cautionCount}  label="Turning Days"  color="text-risk-amber" />
          <Stat value={peakCount}     label="Peak Days"     color="text-accent-gold" />
          <Stat value={events.length} label="Total Events"  color="text-accent-indigo" />
        </div>

        {/* Key events */}
        {keyEvents.length > 0 && (
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted mb-2">Key Events</p>
            <div className="flex flex-wrap gap-2">
              {keyEvents.map(e => {
                const c = ASTRO_SIGNAL_CLASSES[impactToColor(e.market_impact)];
                return (
                  <div key={e.id} className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px]', c.bg, c.border)}>
                    <span className={cn('font-bold', c.text)}>{fmtDate(e.start_date)}</span>
                    <span className="text-[var(--text-secondary)]">{e.display_name}</span>
                    {e.market_impact === 'turning' && <span className="text-risk-amber">◈</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <p className={cn('text-2xl font-bold mono', color)}>{value}</p>
      <p className="text-[10px] text-muted uppercase tracking-wide">{label}</p>
    </div>
  );
}

// ── Day Inspector ─────────────────────────────────────────────────────────────

function CountPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 3,
      padding: '3px 7px',
      border: `1px solid ${color}40`,
      borderRadius: 4,
      background: `${color}10`,
    }}>
      <span style={{ fontSize: 8, color }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color }}>{value}</span>
    </div>
  );
}

function EventGroup({ label, items, onEdit }: {
  label: string;
  items: AstroCalendarEvent[];
  onEdit?: (ev: AstroCalendarEvent) => void;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '0.2em',
        color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8,
      }}>
        {label} ({items.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(ev => {
          const col = impactColor(ev.market_impact);
          const desc = ev.narrative ?? ev.inference ?? null;
          return (
            <div key={ev.id} style={{ borderLeft: `2px solid ${col}`, paddingLeft: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 7, marginBottom: 2 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 8.5,
                    color: col, letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>
                    {ev.market_impact.replace(/_/g, ' ')}
                  </span>
                  {ev.end_date && ev.end_date !== ev.start_date && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-faint)' }}>
                      → {ev.end_date.slice(5)}
                    </span>
                  )}
                </div>
                {onEdit && (
                  <button
                    onClick={() => onEdit(ev)}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: 8.5,
                      color: 'var(--gold)', background: 'transparent',
                      border: '1px solid rgba(212,168,75,0.3)', borderRadius: 4,
                      padding: '1px 7px', cursor: 'pointer', letterSpacing: '0.12em',
                      textTransform: 'uppercase', flexShrink: 0,
                    }}
                  >
                    Edit
                  </button>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: desc ? 4 : 0 }}>
                {ev.display_name}
              </div>
              {desc && (
                <div style={{ fontSize: 10.5, color: 'var(--text-faint)', lineHeight: 1.5 }}>
                  {desc}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayInspector({
  dayIso, signal, events, isToday, isAdmin, onClose, onRefresh,
}: {
  dayIso: string;
  signal?: AstroDailySignal;
  events: AstroCalendarEvent[];
  isToday: boolean;
  isAdmin?: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}) {
  const [editing, setEditing] = useState<AstroCalendarEvent | null>(null);

  const parts = dayIso.split('-').map(Number);
  const [, m, d] = parts;
  const dow = new Date(dayIso).getDay();
  const weekdayFull = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dow];
  const isWeekend = dow === 0 || dow === 6;
  const bias = getBias(signal, isWeekend);
  const turning = signal?.turning_date ?? false;
  const score = signal?.net_score ?? null;
  const transits = events.filter(e => e.is_transit);
  const discrete = events.filter(e => !e.is_transit);

  const handleSave = async (payload: AstroCalendarPayload) => {
    if (!editing) return;
    await updateCalendarEvent(editing.id, payload);
    setEditing(null);
    onRefresh?.();
  };

  return (
    <div style={{
      position: 'sticky', top: 80,
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        padding: '16px 18px 12px',
        borderBottom: '1px solid var(--border)',
        background: isToday ? 'rgba(212,168,75,0.04)' : 'transparent',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: 'var(--text-faint)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4,
          }}>
            {MONTH_FULL[m - 1]} · {weekdayFull}
          </div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 44,
            color: isToday ? 'var(--gold)' : 'var(--text-primary)', lineHeight: 1,
          }}>
            {d}
          </div>
          {isToday && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--gold)',
              letterSpacing: '0.2em', border: '1px solid rgba(212,168,75,0.4)',
              padding: '1px 5px', marginTop: 5, display: 'inline-block',
            }}>
              TODAY
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: '0 4px', lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {/* Signal block */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        {signal && !isWeekend ? (
          <>
            <div style={{
              background: bias.fill,
              borderLeft: `3px solid ${bias.border !== 'transparent' ? bias.border : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '0 6px 6px 0',
              padding: '10px 14px', marginBottom: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: bias.border !== 'transparent' ? bias.border : 'var(--text-faint)',
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                }}>
                  {bias.label}
                </span>
                {score !== null && (
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: 22,
                    color: bias.border !== 'transparent' ? bias.border : 'var(--text-secondary)', lineHeight: 1,
                  }}>
                    {score > 0 ? `+${score}` : score}
                  </span>
                )}
              </div>
              {turning && (
                <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--gold)', letterSpacing: '0.12em' }}>
                  ◈ TURNING DATE
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {signal.strong_bullish_count  > 0 && <CountPill label="▲▲" value={signal.strong_bullish_count}  color="var(--bull)" />}
              {signal.bullish_count         > 0 && <CountPill label="▲"  value={signal.bullish_count}         color="var(--bull)" />}
              {signal.minor_bullish_count   > 0 && <CountPill label="△"  value={signal.minor_bullish_count}   color="var(--bull)" />}
              {signal.neutral_count         > 0 && <CountPill label="·"  value={signal.neutral_count}         color="var(--text-faint)" />}
              {signal.minor_bearish_count   > 0 && <CountPill label="▽"  value={signal.minor_bearish_count}   color="var(--caution)" />}
              {signal.bearish_count         > 0 && <CountPill label="▼"  value={signal.bearish_count}         color="var(--caution)" />}
              {signal.strong_bearish_count  > 0 && <CountPill label="▼▼" value={signal.strong_bearish_count}  color="var(--bear)" />}
            </div>
          </>
        ) : (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)', fontStyle: 'italic' }}>
            {isWeekend ? 'Market closed' : 'No signal data'}
          </div>
        )}
      </div>

      {/* Nak-vara rules */}
      {signal && signal.signals.length > 0 && (
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '0.2em',
            color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8,
          }}>
            Nak-Vara Rules · {signal.signals.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {signal.signals.map((s: SignalItem) => {
              const om = OUTCOME_MAP[s.outcome] ?? { label: s.outcome, color: 'var(--text-faint)' };
              return (
                <div key={s.rule_id} style={{ borderLeft: `2px solid ${om.color}40`, paddingLeft: 10 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 3 }}>
                    {s.rule_name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: om.color,
                      background: `${om.color}18`,
                      border: `1px solid ${om.color}40`,
                      borderRadius: 3, padding: '1px 5px',
                    }}>
                      {om.label}
                    </span>
                    {s.confidence != null && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-faint)', letterSpacing: '0.06em' }}>
                        {s.confidence.toFixed(0)}% conf
                      </span>
                    )}
                    {s.probability_label && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-faint)', letterSpacing: '0.06em' }}>
                        · {s.probability_label}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Events list */}
      <div style={{ padding: '14px 18px', maxHeight: 440, overflowY: 'auto' }}>
        {events.length === 0 ? (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
            No events this day
          </div>
        ) : (
          <>
            {discrete.length > 0 && <EventGroup label="Events" items={discrete} onEdit={isAdmin ? setEditing : undefined} />}
            {transits.length > 0 && <EventGroup label="Active Transits" items={transits} onEdit={isAdmin ? setEditing : undefined} />}
          </>
        )}
      </div>

      {editing && (
        <ItemModal
          item={editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ── Timeline View ─────────────────────────────────────────────────────────────

interface HoverState {
  id:     number;
  cx:     number; // clientX
  cy:     number; // clientY
}

function clampDay(iso: string, monthPrefix: string, numDays: number): number {
  if (iso.slice(0, 7) < monthPrefix) return 1;
  if (iso.slice(0, 7) > monthPrefix) return numDays;
  return parseInt(iso.split('-')[2], 10);
}

function assignWeekTracks(
  items: { event: AstroCalendarEvent; cs: number; ce: number }[],
): { event: AstroCalendarEvent; cs: number; ce: number; track: number }[] {
  const trackEnds: number[] = [];
  return items.map(item => {
    let t = trackEnds.findIndex(e => e < item.cs);
    if (t === -1) t = trackEnds.length;
    trackEnds[t] = item.ce;
    return { ...item, track: t };
  });
}

function TimelineView({ events, year, month }: { events: AstroCalendarEvent[]; year: number; month: number }) {
  const numDays     = getDaysInMonth(year, month);
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const [hovered, setHovered] = useState<HoverState | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build weekly bands: [1-7], [8-14], [15-21], [22-28], [29-end]
  const weeks = useMemo(() => {
    const ws = [];
    for (let d = 1; d <= numDays; d += 7) ws.push({ wStart: d, wEnd: Math.min(d + 6, numDays) });
    return ws;
  }, [numDays]);

  // Pre-compute event day-range once
  const eventDays = useMemo(() => new Map(
    events.map(e => [e.id, {
      sd: clampDay(e.start_date, monthPrefix, numDays),
      ed: clampDay(e.end_date ?? e.start_date, monthPrefix, numDays),
    }])
  ), [events, monthPrefix, numDays]);

  // Build week rows with greedy-packed tracks
  const weekRows = useMemo(() => weeks.map(({ wStart, wEnd }) => {
    const wDays = wEnd - wStart + 1;
    const all = events
      .map(e => {
        const { sd, ed } = eventDays.get(e.id)!;
        return { event: e, cs: Math.max(wStart, sd), ce: Math.min(wEnd, ed) };
      })
      .filter(i => i.cs <= i.ce)
      .sort((a, b) => a.cs - b.cs);

    // Multi-day → horizontal track bars
    const multiItems = assignWeekTracks(all.filter(i => i.cs < i.ce));
    const numT = Math.max(1, multiItems.reduce((m, i) => Math.max(m, i.track + 1), 0));

    // Single-day → stacked column bars grouped by day
    const singleDayMap = new Map<number, AstroCalendarEvent[]>();
    for (const { event, cs, ce } of all) {
      if (cs === ce) {
        if (!singleDayMap.has(cs)) singleDayMap.set(cs, []);
        singleDayMap.get(cs)!.push(event);
      }
    }

    return { wStart, wEnd, wDays, multiItems, singleDayMap, numT, hasEvents: all.length > 0 };
  }), [weeks, events, eventDays]);

  const todayStr = todayIso();
  const todayDay = todayStr.startsWith(monthPrefix)
    ? parseInt(todayStr.split('-')[2], 10) : null;

  const BAR_H = 30;
  const PAD   = 5;

  // Find hovered event details
  const hoveredEvent = hovered ? events.find(e => e.id === hovered.id) ?? null : null;

  function onEnter(e: AstroCalendarEvent, ev: React.MouseEvent) {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setHovered({ id: e.id, cx: ev.clientX, cy: ev.clientY });
  }
  function onLeave() {
    hideTimer.current = setTimeout(() => setHovered(null), 120);
  }

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-6">
      <p className="text-[10px] text-muted uppercase tracking-widest font-bold mb-5">
        Market Sentiment Timeline · {MONTH_FULL[month - 1]} {year}
      </p>

      <div className="space-y-3">
        {weekRows.map(({ wStart, wEnd, wDays, multiItems, singleDayMap, numT, hasEvents }) => {
          const rowH = PAD + numT * (BAR_H + PAD);
          return (
            <div key={wStart} className="flex items-stretch gap-0">
              {/* Week label */}
              <div className="w-[72px] shrink-0 flex flex-col items-end justify-center pr-3 border-r border-kd-border/50">
                <span className="text-[12px] font-mono font-bold text-[var(--text-secondary)]">
                  {wStart}–{wEnd}
                </span>
                <span className="text-[9px] uppercase tracking-widest text-muted mt-0.5">
                  {MONTH_ABBR[month - 1]}
                </span>
              </div>

              {/* Bar area */}
              <div className="flex-1 pl-3 flex flex-col gap-1">
                {/* Day number ruler */}
                <div className="relative h-4">
                  {Array.from({ length: wDays }, (_, i) => {
                    const d = wStart + i;
                    const dow = new Date(year, month - 1, d).getDay();
                    const isWeekend = dow === 0 || dow === 6;
                    return (
                      <span
                        key={d}
                        className={cn(
                          'absolute text-[9px] font-mono -translate-x-1/2',
                          isWeekend ? 'text-muted' : 'text-[var(--text-secondary)]',
                        )}
                        style={{ left: `${((i + 0.5) / wDays) * 100}%` }}
                      >
                        {d}
                      </span>
                    );
                  })}
                </div>

                {/* Track band */}
                <div
                  className="relative rounded-lg bg-kd-elevated/50 border border-kd-border/40"
                  style={{ height: rowH }}
                >
                  {/* Day separator lines */}
                  {Array.from({ length: wDays - 1 }, (_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-l border-white/[0.04] pointer-events-none"
                      style={{ left: `${((i + 1) / wDays) * 100}%` }}
                    />
                  ))}

                  {/* Weekend tint */}
                  {Array.from({ length: wDays }, (_, i) => {
                    const dow = new Date(year, month - 1, wStart + i).getDay();
                    if (dow !== 0 && dow !== 6) return null;
                    return (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 bg-white/[0.018] pointer-events-none"
                        style={{ left: `${(i / wDays) * 100}%`, width: `${(1 / wDays) * 100}%` }}
                      />
                    );
                  })}

                  {/* Today line */}
                  {todayDay !== null && todayDay >= wStart && todayDay <= wEnd && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-indigo-400/50 z-10 pointer-events-none"
                      style={{ left: `${((todayDay - wStart + 0.5) / wDays) * 100}%` }}
                    />
                  )}

                  {/* Multi-day horizontal bars */}
                  {multiItems.map(({ event, cs, ce, track }) => {
                    const leftPct  = ((cs - wStart) / wDays) * 100;
                    const widthPct = ((ce - cs + 1) / wDays) * 100;
                    const c = ASTRO_SIGNAL_CLASSES[impactToColor(event.market_impact)];
                    return (
                      <div
                        key={`${event.id}-w${wStart}`}
                        className={cn(
                          'absolute flex items-center px-2.5 rounded cursor-pointer',
                          'border transition-all duration-150 overflow-hidden',
                          c.bg, c.border,
                          hovered?.id === event.id && 'brightness-125 ring-1 ring-white/30 z-20',
                        )}
                        style={{
                          left:   `${leftPct}%`,
                          width:  `max(${widthPct}%, 18px)`,
                          top:    PAD + track * (BAR_H + PAD),
                          height: BAR_H,
                        }}
                        onMouseEnter={ev => onEnter(event, ev)}
                        onMouseLeave={onLeave}
                      >
                        <span className={cn('text-[11px] font-medium truncate leading-tight', c.text)}>
                          {event.inference ?? event.display_name}
                        </span>
                      </div>
                    );
                  })}

                  {/* Single-day stacked bar columns */}
                  {Array.from(singleDayMap.entries()).map(([day, dayEvents]) => {
                    const leftPct = ((day - wStart) / wDays) * 100;
                    const colW    = (1 / wDays) * 100;
                    return (
                      <div
                        key={`col-${day}`}
                        className="absolute flex flex-col"
                        style={{
                          left:   `calc(${leftPct}% + 1px)`,
                          width:  `calc(${colW}% - 2px)`,
                          top:    PAD,
                          bottom: PAD,
                          gap:    1,
                        }}
                      >
                        {dayEvents.map(event => {
                          const c = ASTRO_SIGNAL_CLASSES[impactToColor(event.market_impact)];
                          return (
                            <div
                              key={event.id}
                              className={cn(
                                'flex-1 rounded-sm cursor-pointer transition-all',
                                c.bg,
                                hovered?.id === event.id && 'brightness-125 ring-1 ring-inset ring-white/30 z-20',
                              )}
                              title={ASTRO_SIGNAL_LABELS[event.market_impact] ?? event.market_impact}
                              onMouseEnter={ev => onEnter(event, ev)}
                              onMouseLeave={onLeave}
                            />
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* Empty state */}
                  {!hasEvents && (
                    <span className="absolute inset-0 flex items-center px-3 text-[11px] text-muted">
                      No events
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tooltip — fixed to viewport */}
      {hovered && hoveredEvent && (() => {
        const c = ASTRO_SIGNAL_CLASSES[impactToColor(hoveredEvent.market_impact)];
        const label = ASTRO_SIGNAL_LABELS[hoveredEvent.market_impact] ?? hoveredEvent.market_impact;
        const tooltipW = 300;
        const left = Math.min(hovered.cx + 14, window.innerWidth - tooltipW - 16);
        const top  = hovered.cy - 10;
        return (
          <div
            className={cn(
              'fixed z-[9999] pointer-events-none rounded-xl border shadow-2xl',
              'bg-kd-surface border backdrop-blur-sm', c.border,
            )}
            style={{ left, top, width: tooltipW }}
            onMouseEnter={() => { if (hideTimer.current) clearTimeout(hideTimer.current); }}
            onMouseLeave={onLeave}
          >
            <div className="p-3.5">
              <span className={cn('inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border mb-2', c.bg, c.text, c.border)}>
                {label}
              </span>
              <p className="text-[12px] text-[var(--text-primary)] leading-relaxed mb-2.5">
                {hoveredEvent.inference ?? hoveredEvent.display_name}
              </p>
              <div className="pt-2 border-t border-kd-border">
                <span className="text-[10px] font-mono text-muted">
                  {fmtDate(hoveredEvent.start_date)}
                  {hoveredEvent.end_date && hoveredEvent.end_date !== hoveredEvent.start_date
                    ? ` → ${fmtDate(hoveredEvent.end_date)}` : ''}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Impact legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-6 pt-4 border-t border-kd-border">
        <span className="text-[10px] uppercase tracking-widest font-bold text-muted self-center">Legend</span>
        {Object.entries(ASTRO_SIGNAL_LABELS).map(([key, label]) => {
          const c = ASTRO_SIGNAL_CLASSES[impactToColor(key)];
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className={cn('w-3 h-3 rounded-sm border', c.bg, c.border)} />
              <span className="text-[11px] text-[var(--text-secondary)]">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Admin shared styles ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  padding: '8px 10px',
  fontFamily: 'var(--font-sans)',
  fontSize: 12.5,
  borderRadius: 6,
  outline: 'none',
};

const btnStyle: React.CSSProperties = {
  padding: '7px 14px',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)',
  background: 'transparent',
  cursor: 'pointer',
  borderRadius: 6,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-mono)',
  fontSize: 9.5,
  letterSpacing: '0.18em',
  color: 'var(--text-faint)',
  textTransform: 'uppercase' as const,
  marginBottom: 5,
};

function impactColor(impact: string): string {
  if (['strong_bullish', 'bullish', 'mild_bullish'].includes(impact)) return 'var(--bull)';
  if (impact === 'turning')                                            return 'var(--gold)';
  if (['strong_bearish', 'bearish'].includes(impact))                 return 'var(--bear)';
  if (impact === 'mild_bearish')                                       return 'var(--caution)';
  return 'var(--text-faint)';
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({ message, onConfirm, onCancel }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(7,7,12,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onCancel}
    >
      <div
        style={{ maxWidth: 400, width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}
        onClick={e => e.stopPropagation()}
      >
        <p style={{ color: 'var(--text-primary)', fontSize: 14, marginBottom: 20 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnStyle}>Cancel</button>
          <button onClick={onConfirm} style={{ ...btnStyle, background: 'var(--bear)', color: '#fff', borderColor: 'var(--bear)' }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Item modal (create / edit) ────────────────────────────────────────────────

function ItemModal({ item, onSave, onCancel }: {
  item: AstroCalendarEvent | null;
  onSave: (p: AstroCalendarPayload) => Promise<void>;
  onCancel: () => void;
}) {
  const blank: AstroCalendarPayload = {
    display_name: '', start_date: todayIso(), end_date: null,
    market_impact: 'neutral', is_transit: false,
    narrative: '', notes: '', inference: '',
  };
  const [form, setForm] = useState<AstroCalendarPayload>(
    item
      ? { display_name: item.display_name, start_date: item.start_date, end_date: item.end_date,
          market_impact: item.market_impact, is_transit: item.is_transit,
          narrative: item.narrative ?? '', notes: item.notes ?? '', inference: item.inference ?? '' }
      : blank
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = <K extends keyof AstroCalendarPayload>(k: K, v: AstroCalendarPayload[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.display_name.trim()) { setErr('Name is required'); return; }
    if (!form.start_date)          { setErr('Start date is required'); return; }
    setSaving(true);
    setErr(null);
    try {
      await onSave(form);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(7,7,12,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onCancel}
    >
      <div
        style={{ maxWidth: 740, width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em', color: 'var(--gold)', textTransform: 'uppercase' }}>
            {item ? 'Edit Event' : 'New Event'}
          </span>
          <button onClick={onCancel} style={{ ...btnStyle, border: 'none', padding: '4px 8px' }}>× Close</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', display: 'grid', gap: 14 }}>
          {err && <div style={{ color: 'var(--bear)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{err}</div>}

          <div>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} value={form.display_name} onChange={e => set('display_name', e.target.value)} placeholder="e.g. Jupiter in Punarvasu" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input type="date" style={inputStyle} value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>End Date (optional)</label>
              <input type="date" style={inputStyle} value={form.end_date ?? ''} onChange={e => set('end_date', e.target.value || null)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Market Impact</label>
              <select style={inputStyle} value={form.market_impact} onChange={e => set('market_impact', e.target.value)}>
                {IMPACT_OPTIONS.map(o => (
                  <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                {([false, true] as const).map(v => (
                  <button
                    key={String(v)}
                    onClick={() => set('is_transit', v)}
                    style={{
                      flex: 1, padding: '8px', fontFamily: 'var(--font-mono)', fontSize: 10,
                      letterSpacing: '0.12em', textTransform: 'uppercase',
                      background: form.is_transit === v ? 'rgba(212,168,75,0.12)' : 'transparent',
                      border: '1px solid var(--border)',
                      color: form.is_transit === v ? 'var(--gold)' : 'var(--text-faint)',
                      cursor: 'pointer', borderRadius: 6,
                    }}
                  >
                    {v ? 'Transit' : 'Event'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Inference (short)</label>
            <input style={inputStyle} value={form.inference ?? ''} onChange={e => set('inference', e.target.value)} placeholder="One-line short label" />
          </div>

          <div>
            <label style={labelStyle}>Narrative · VaNi</label>
            <textarea
              rows={5}
              style={{ ...inputStyle, resize: 'vertical' }}
              value={form.narrative ?? ''}
              onChange={e => set('narrative', e.target.value)}
              placeholder="Full interpretation shown in inspector panel"
            />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <button onClick={onCancel} style={btnStyle}>Cancel</button>
            <button
              onClick={save}
              disabled={saving}
              style={{ ...btnStyle, background: 'var(--gold)', color: '#1a1410', fontWeight: 600, borderColor: 'var(--gold)', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving…' : item ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Admin section ─────────────────────────────────────────────────────────────

function AdminSection({ events, year, month, onRefresh }: {
  events: AstroCalendarEvent[];
  year: number;
  month: number;
  onRefresh: () => void;
}) {
  const [tab,     setTab]     = useState<'all' | 'events' | 'transits'>('all');
  const [q,       setQ]       = useState('');
  const [editing, setEditing] = useState<AstroCalendarEvent | 'new' | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return events
      .filter(e => {
        if (tab === 'events'   && e.is_transit)  return false;
        if (tab === 'transits' && !e.is_transit) return false;
        if (q) return e.display_name.toLowerCase().includes(q.toLowerCase());
        return true;
      })
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [events, tab, q]);

  const save = async (payload: AstroCalendarPayload) => {
    if (editing === 'new') {
      await createCalendarEvent(payload);
    } else if (editing && typeof editing !== 'string') {
      await updateCalendarEvent(editing.id, payload);
    }
    setEditing(null);
    onRefresh();
  };

  const confirmDelete = async () => {
    if (deleting == null) return;
    await deleteCalendarEvent(deleting);
    setDeleting(null);
    onRefresh();
  };

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, marginTop: 16, overflow: 'hidden' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em', color: 'var(--gold)', textTransform: 'uppercase' }}>
            ◇ Registry · Admin · {events.length} rows
          </span>
          <div style={{ display: 'flex', gap: 3 }}>
            {(['all', 'events', 'transits'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: 9.5,
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                  background: tab === t ? 'rgba(212,168,75,0.12)' : 'transparent',
                  border: '1px solid var(--border)',
                  color: tab === t ? 'var(--gold)' : 'var(--text-faint)',
                  cursor: 'pointer', borderRadius: 6,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Filter…"
            style={{ ...inputStyle, width: 180, padding: '6px 10px', fontSize: 12 }}
          />
          <button
            onClick={() => setEditing('new')}
            style={{ ...btnStyle, background: 'var(--gold)', color: '#1a1410', fontWeight: 600, borderColor: 'var(--gold)' }}
          >
            + New
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '80px 1fr 140px 130px 1fr 90px',
          gap: 12, padding: '10px 20px',
          fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.16em',
          color: 'var(--text-faint)', textTransform: 'uppercase',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>Type</div>
        <div>Name</div>
        <div>Dates</div>
        <div>Impact</div>
        <div>Narrative</div>
        <div style={{ textAlign: 'right' }}>Actions</div>
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: 11, fontStyle: 'italic' }}>
          No records match
        </div>
      ) : (
        filtered.map(ev => (
          <div
            key={ev.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 140px 130px 1fr 90px',
              gap: 12, padding: '12px 20px', alignItems: 'center',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 6px',
                border: `1px solid ${ev.is_transit ? 'var(--border-indigo)' : 'rgba(212,168,75,0.3)'}`,
                color: ev.is_transit ? 'var(--indigo)' : 'var(--gold)',
                textTransform: 'uppercase', letterSpacing: '0.1em', borderRadius: 4,
                display: 'inline-block',
              }}
            >
              {ev.is_transit ? 'Transit' : 'Event'}
            </span>

            <span style={{ fontSize: 12.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ev.display_name}
            </span>

            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>
              {ev.start_date}
              {ev.end_date && ev.end_date !== ev.start_date ? ` → ${ev.end_date.slice(5)}` : ''}
            </span>

            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: impactColor(ev.market_impact), textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {ev.market_impact.replace(/_/g, ' ')}
            </span>

            <span style={{ fontSize: 11, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ev.narrative ?? ev.inference ?? '—'}
            </span>

            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditing(ev)} style={{ ...btnStyle, fontSize: 10, padding: '4px 8px' }}>Edit</button>
              <button
                onClick={() => setDeleting(ev.id)}
                style={{ ...btnStyle, fontSize: 10, padding: '4px 8px', color: 'var(--bear)', borderColor: 'rgba(200,60,60,0.3)' }}
              >
                Del
              </button>
            </div>
          </div>
        ))
      )}

      {editing != null && (
        <ItemModal
          item={editing === 'new' ? null : editing}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}
      {deleting != null && (
        <ConfirmDialog
          message={`Delete this event? This cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function DCCalendarView() {
  const today = todayIso();
  const [year,  setYear]  = useState(2026);
  const [month, setMonth] = useState(4);
  const [view,  setView]  = useState<'calendar' | 'timeline' | 'admin'>('calendar');
  const [picked, setPicked] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<AstroCalendarEvent | null>(null);
  const { isAdmin } = useAuthStore();
  const queryClient = useQueryClient();

  const eventsKey = ['astro_calendar_events', year, month];

  const { data: events = [], isLoading: eventsLoading, isError: eventsError, error: eventsErr } = useQuery({
    queryKey: eventsKey,
    queryFn:  () => fetchMonthEvents(year, month),
    staleTime: 60_000,
  });

  const { data: signals = [], isLoading: signalsLoading, isError: signalsError } = useQuery({
    queryKey: ['astro_daily_signals', year, month],
    queryFn:  () => fetchMonthSignals(year, month),
    staleTime: 60_000,
  });

  const { data: keyEvents = [] } = useQuery({
    queryKey: ['astro_key_events', year, month],
    queryFn:  () => fetchKeyEvents(year, month),
    staleTime: 60_000,
  });

  const refreshEvents = () => queryClient.invalidateQueries({ queryKey: eventsKey });

  const handleCellEditSave = async (payload: AstroCalendarPayload) => {
    if (!editingEvent) return;
    await updateCalendarEvent(editingEvent.id, payload);
    setEditingEvent(null);
    refreshEvents();
  };

  const isLoading = eventsLoading || signalsLoading;
  const isError   = eventsError || signalsError;

  const signalMap = useMemo(() => new Map(
    signals.map(s => [s.trade_date, s])
  ), [signals]);

  // Calendar grid: 7 cols, up to 6 rows
  const offset   = getFirstWeekdayOffset(year, month);
  const numDays  = getDaysInMonth(year, month);
  const totalCells = Math.ceil((offset + numDays) / 7) * 7;

  const cells = useMemo(() => Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - offset + 1;
    if (dayNum < 1 || dayNum > numDays) return null;
    const iso = toIso(year, month, dayNum);
    const dow = new Date(year, month - 1, dayNum).getDay();
    return {
      dayNum,
      iso,
      weekday: DAY_ABBR[i % 7],
      events:  getActiveEventsForDay(iso, events),
      signal:  signalMap.get(iso),
      isToday: iso === today,
      isWeekend: dow === 0 || dow === 6,
    };
  }), [offset, numDays, totalCells, year, month, events, signalMap, today]);

  const pickedCell = picked ? (cells.find(c => c?.iso === picked) ?? null) : null;

  const prevMonth = () => { setPicked(null); if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { setPicked(null); if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <ErrorBoundary>
      <div className="animate-fade-in">

        {/* Page header */}
        <header className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)] mb-1">
                Planetary Intelligence
              </h1>
              <p className="text-secondary font-medium">
                Astrological event calendar for Indian equity markets
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* View toggle */}
              <div className="flex bg-kd-elevated border border-kd-border rounded-xl p-1 gap-1">
                <button
                  onClick={() => setView('calendar')}
                  title="Calendar view"
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                    view === 'calendar' ? 'bg-accent-indigo/20 text-accent-indigo' : 'text-muted hover:text-[var(--text-secondary)]',
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setView('timeline')}
                  title="Timeline view"
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                    view === 'timeline' ? 'bg-accent-indigo/20 text-accent-indigo' : 'text-muted hover:text-[var(--text-secondary)]',
                  )}
                >
                  <AlignLeft className="w-4 h-4" />
                </button>
              </div>

              {/* Admin tab — only for admins */}
              {isAdmin && (
                <button
                  onClick={() => setView(v => v === 'admin' ? 'calendar' : 'admin')}
                  style={{
                    padding: '7px 14px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: view === 'admin' ? 'rgba(212,168,75,0.12)' : 'transparent',
                    color: view === 'admin' ? 'var(--gold)' : 'var(--text-faint)',
                    cursor: 'pointer',
                  }}
                >
                  ◇ Admin
                </button>
              )}

              {/* Month navigator */}
              <button
                onClick={prevMonth}
                className="w-9 h-9 rounded-xl border border-kd-border flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-kd-elevated transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-center min-w-[140px]">
                <p className="text-xl font-bold text-[var(--text-primary)]">{MONTH_FULL[month - 1]}</p>
                <p className="text-xs text-muted mono">{year}</p>
              </div>
              <button
                onClick={nextMonth}
                className="w-9 h-9 rounded-xl border border-kd-border flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-kd-elevated transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-32 gap-3">
            <Loader2 className="w-5 h-5 text-accent-indigo animate-spin" />
            <span className="text-sm text-muted">Loading planetary data...</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <AlertCircle className="w-8 h-8 text-risk-red mb-4" />
            <p className="text-sm text-muted">{eventsErr instanceof Error ? eventsErr.message : 'Failed to load'}</p>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            {events.length > 0 && (
              <MonthSummary events={events} signals={signals} keyEvents={keyEvents} />
            )}

            {view === 'admin' ? (
              <AdminSection
                events={events}
                year={year}
                month={month}
                onRefresh={refreshEvents}
              />
            ) : view === 'calendar' ? (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: picked ? 'minmax(0, 1fr) 310px' : '1fr',
                  gap: 16,
                  alignItems: 'start',
                }}>
                  {/* Left: calendar */}
                  <div>
                    <div className="glass-card rounded-3xl p-5">
                      {/* Day headers */}
                      <div className="grid grid-cols-7 mb-3">
                        {DAY_ABBR.map(d => (
                          <div key={d} className="text-center text-[11px] uppercase tracking-widest font-bold text-muted py-2">
                            {d}
                          </div>
                        ))}
                      </div>

                      {/* Day cells */}
                      <div className="grid grid-cols-7 gap-2">
                        {cells.map((cell, i) =>
                          cell ? (
                            <DayCell
                              key={cell.iso}
                              dayIso={cell.iso}
                              dayNum={cell.dayNum}
                              weekday={cell.weekday}
                              events={cell.events}
                              signal={cell.signal}
                              isToday={cell.isToday}
                              isWeekend={cell.isWeekend}
                              isSelected={picked === cell.iso}
                              onClick={() => setPicked(p => p === cell.iso ? null : cell.iso)}
                              onEditEvent={isAdmin ? setEditingEvent : undefined}
                            />
                          ) : (
                            <div key={`empty-${i}`} className="min-h-[130px]" />
                          )
                        )}
                      </div>
                    </div>

                    {/* Legend */}
                    <BiasLegend />

                    {/* Footer */}
                    <p className="text-[10px] text-muted text-right mt-4 mono">
                      DristiQ · {events.length} events · {MONTH_FULL[month - 1]} {year}
                    </p>
                  </div>

                  {/* Right: inspector */}
                  {picked && pickedCell && (
                    <DayInspector
                      dayIso={picked}
                      signal={pickedCell.signal}
                      events={pickedCell.events}
                      isToday={pickedCell.isToday}
                      isAdmin={isAdmin}
                      onClose={() => setPicked(null)}
                      onRefresh={refreshEvents}
                    />
                  )}
                </div>
              </>
            ) : (
              <TimelineView events={events} year={year} month={month} />
            )}

          </>
        )}
      </div>

      {/* Top-level edit modal — triggered from day cell ✎ button */}
      {editingEvent && (
        <ItemModal
          item={editingEvent}
          onSave={handleCellEditSave}
          onCancel={() => setEditingEvent(null)}
        />
      )}
    </ErrorBoundary>
  );
}
