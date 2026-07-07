import { useQuery } from '@tanstack/react-query';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RuleSignal {
  rule_id: number;
  rule_code: string;
  rule_name: string;
  rule_type: string;
  outcome: string;
  probability_label: string | null;
  strength: number;
  confidence_score: number | null;
  total_occurrences: number | null;
}

import GlossaryTerm from '@/components/ui/GlossaryTerm';

interface PanchangFull {
  vara: string;
  nakshatra_name: string;
  tithi_name: string;
  paksha: string;
  is_trading_day: boolean;
  signals: RuleSignal[];
  summary: {
    total_signals: number;
    bullish: number;
    bearish: number;
    turning: number;
    neutral: number;
    avg_confidence: number | null;
  };
}

// ── Display mapping ───────────────────────────────────────────────────────────

const OUTCOME_LABEL: Record<string, string> = {
  strong_bullish: 'High Positive',
  bullish:        'Positive',
  mild_bullish:   'Moderate Positive',
  neutral:        'Mixed Signals',
  turning:        'Inflection',
  mild_bearish:   'Moderate Negative',
  bearish:        'Negative',
  strong_bearish: 'High Negative',
  volatile:       'Mixed',
};

const OUTCOME_COLOR: Record<string, string> = {
  strong_bullish: 'var(--bull)',
  bullish:        'var(--bull)',
  mild_bullish:   'var(--bull)',
  neutral:        '#94a3b8',
  turning:        'var(--caution)',
  mild_bearish:   'var(--bear)',
  bearish:        'var(--bear)',
  strong_bearish: 'var(--bear)',
  volatile:       'var(--caution)',
};

const RULE_TYPE_ORDER: Record<string, number> = {
  nakshatra_vara:      0,
  compound:            1,
  tithi_alone:         2,
  planet_transit:      3,
  planet_state:        4,
  planet_conjunction:  5,
  vedh:                6,
  eclipse:             7,
};

function ruleTypeOrder(rt: string): number {
  return RULE_TYPE_ORDER[rt] ?? 99;
}

function ruleTypeLabel(rt: string): string {
  const map: Record<string, string> = {
    nakshatra_vara:     'Nak-Vara',
    compound:           'Compound',
    tithi_alone:        'Tithi',
    planet_transit:     'Transit',
    planet_state:       'Planet State',
    planet_conjunction: 'Conjunction',
    vedh:               'Vedh',
    eclipse:            'Eclipse',
  };
  return map[rt] ?? rt;
}

// ── Data fetch ────────────────────────────────────────────────────────────────

const PIPELINE_API = (import.meta.env.VITE_PIPELINE_API_URL as string | undefined)?.trim() ?? '';

async function fetchPanchangFull(date: string): Promise<PanchangFull | null> {
  const res = await fetch(`${PIPELINE_API}/api/panchang/daily?date=${encodeURIComponent(date)}`);
  if (!res.ok) return null;
  return res.json() as Promise<PanchangFull>;
}

// ── Signal row ────────────────────────────────────────────────────────────────

function SignalRow({ sig }: { sig: RuleSignal }) {
  const color = OUTCOME_COLOR[sig.outcome] ?? '#94a3b8';
  const label = OUTCOME_LABEL[sig.outcome] ?? sig.outcome;
  const confPct = sig.confidence_score != null ? Math.round(sig.confidence_score) : null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto auto',
        alignItems: 'center',
        gap: 10,
        padding: '7px 16px',
        borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 4%, transparent)',
      }}
    >
      {/* Name */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 11,
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {sig.rule_name}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-faint)',
          letterSpacing: '0.08em',
          marginTop: 1,
        }}>
          {ruleTypeLabel(sig.rule_type)}
          {sig.total_occurrences != null && ` · ${sig.total_occurrences} hist`}
        </div>
      </div>

      {/* Outcome badge */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color,
        background: `${color}18`,
        border: `1px solid ${color}40`,
        borderRadius: 4,
        padding: '2px 6px',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>

      {/* Confidence */}
      <div style={{ textAlign: 'right', minWidth: 36 }}>
        {confPct != null ? (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 600,
            color: confPct >= 60 ? 'var(--bull)' : confPct >= 40 ? 'var(--caution)' : '#94a3b8',
          }}>
            {confPct}%
          </span>
        ) : (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)' }}>—</span>
        )}
      </div>

      {/* Strength dots */}
      <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{
            width: 4, height: 4, borderRadius: '50%',
            background: i <= Math.min(sig.strength, 5)
              ? color
              : 'color-mix(in srgb, var(--text-primary) 10%, transparent)',
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{
      padding: '5px 16px 3px',
      fontFamily: 'var(--font-mono)',
      fontSize: 8,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: 'var(--gold)',
      background: 'var(--gold-bg)',
      borderBottom: '1px solid color-mix(in srgb, var(--gold) 12%, transparent)',
    }}>
      <GlossaryTerm term={label} />
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export default function NakVaraSignals({ date }: { date: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['panchang_full', date],
    queryFn: () => fetchPanchangFull(date),
    staleTime: 5 * 60 * 1000,
    enabled: !!date,
  });

  const signals = data?.signals ?? [];
  const summary = data?.summary;

  // Sort: nak-vara first, then by rule_type order, then by strength desc
  const sorted = [...signals].sort((a, b) => {
    const typeOrd = ruleTypeOrder(a.rule_type) - ruleTypeOrder(b.rule_type);
    if (typeOrd !== 0) return typeOrd;
    return b.strength - a.strength;
  });

  // Group into nak-vara vs other
  const nakVara = sorted.filter(s => s.rule_type === 'nakshatra_vara');
  const others  = sorted.filter(s => s.rule_type !== 'nakshatra_vara');

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '11px 16px 9px',
        borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)',
      }}>
        <div>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
          }}>
            Rule Signals
          </span>
          {data && (
            <span style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 11,
              color: 'var(--text-secondary)',
              marginLeft: 8,
            }}>
              {data.vara} · {data.nakshatra_name}
            </span>
          )}
        </div>

        {summary && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {summary.bullish > 0 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bull)' }}>
                {summary.bullish}▲
              </span>
            )}
            {summary.bearish > 0 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bear)' }}>
                {summary.bearish}▼
              </span>
            )}
            {summary.turning > 0 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--caution)' }}>
                {summary.turning}◈
              </span>
            )}
            {summary.avg_confidence != null && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)' }}>
                avg {summary.avg_confidence}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      {isLoading && (
        <div style={{ padding: '20px 16px', textAlign: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.1em' }}>
            LOADING…
          </span>
        </div>
      )}

      {isError && (
        <div style={{ padding: '20px 16px', textAlign: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bear)', letterSpacing: '0.1em' }}>
            SIGNAL DATA UNAVAILABLE
          </span>
        </div>
      )}

      {!isLoading && !isError && signals.length === 0 && (
        <div style={{ padding: '20px 16px', textAlign: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.1em' }}>
            NO SIGNALS FOR THIS DATE
          </span>
        </div>
      )}

      {!isLoading && !isError && nakVara.length > 0 && (
        <>
          <SectionDivider label="Nakshatra-Vara" />
          {nakVara.map(s => <SignalRow key={s.rule_id} sig={s} />)}
        </>
      )}

      {!isLoading && !isError && others.length > 0 && (
        <>
          <SectionDivider label="Other Rules" />
          {others.map(s => <SignalRow key={s.rule_id} sig={s} />)}
        </>
      )}
    </div>
  );
}
