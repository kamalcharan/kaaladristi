import { useAstroTransits } from '@/hooks';
import type { AstroTransit } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function impactToColor(impact: string): string {
  if (impact.includes('major_positive') || impact === 'bullish') return 'var(--bull)';
  if (impact.includes('major_negative') || impact === 'bearish') return 'var(--bear)';
  if (impact.includes('positive'))  return 'var(--bull)';
  if (impact.includes('negative'))  return 'var(--bear)';
  if (impact.includes('volatile') || impact === 'cautious') return 'var(--caution)';
  if (impact === 'mixed')           return 'var(--indigo)';
  return 'var(--text-faint)';
}

function isMajor(impact: string): boolean {
  return impact.startsWith('major_') || impact === 'bullish' || impact === 'bearish';
}

function formatDateRange(start: string, end: string | null): string {
  const fmt = (iso: string) => {
    const [, m, d] = iso.split('-').map(Number);
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1];
    return `${d} ${mon}`;
  };
  if (!end || end === start) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}

// ── Transit row ───────────────────────────────────────────────────────────────

function TransitRow({ transit, isLast }: { transit: AstroTransit; isLast: boolean }) {
  const color  = impactToColor(transit.market_impact);
  const major  = isMajor(transit.market_impact);
  const impact = transit.market_impact.replace(/_/g, ' ');

  return (
    <div
      style={{
        padding: '12px 16px',
        display: 'grid',
        gridTemplateColumns: '20px 1fr',
        gap: 12,
        alignItems: 'flex-start',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
      }}
    >
      {/* Dot */}
      <div style={{ paddingTop: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div
          style={{
            width: major ? 9 : 6,
            height: major ? 9 : 6,
            borderRadius: '50%',
            background: color,
            boxShadow: major ? `0 0 8px ${color}` : 'none',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 7.5,
            letterSpacing: '0.1em',
            color: 'var(--text-faint)',
            textTransform: 'uppercase',
          }}
        >
          {major ? 'MAJ' : 'min'}
        </span>
      </div>

      {/* Body */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 14,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            {transit.display_name}
          </span>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.12em',
            color: color,
            textTransform: 'uppercase',
            marginBottom: transit.inference ? 5 : 0,
          }}
        >
          {impact} · {formatDateRange(transit.start_date, transit.end_date)}
        </div>
        {transit.inference && (
          <p
            style={{
              margin: 0,
              fontSize: 11.5,
              color: 'var(--text-muted)',
              lineHeight: 1.45,
            }}
          >
            {transit.inference}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface CurrentSkyRailProps {
  date: string;
}

export default function CurrentSkyRail({ date }: CurrentSkyRailProps) {
  const toDate = shiftDate(date, 14);
  const { data: transits = [], isLoading } = useAstroTransits(date, toDate);

  return (
    <div
      className="rounded-xl flex flex-col"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        height: '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px 10px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}
        >
          Current Sky
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.14em',
            color: 'var(--bull)',
            padding: '2px 7px',
            background: 'var(--bull-bg)',
            borderRadius: 4,
            textTransform: 'uppercase',
          }}
        >
          Live
        </span>
      </div>

      {/* Transit list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading && (
          <div style={{ padding: '20px 16px' }}>
            {[1, 2, 3].map(i => (
              <div
                key={i}
                style={{
                  height: 56,
                  background: 'var(--card-soft)',
                  borderRadius: 8,
                  marginBottom: 8,
                  opacity: 0.5,
                }}
              />
            ))}
          </div>
        )}
        {!isLoading && transits.length === 0 && (
          <div
            style={{
              padding: '24px 16px',
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 13,
              color: 'var(--text-faint)',
              textAlign: 'center',
            }}
          >
            No active transits in window.
          </div>
        )}
        {!isLoading &&
          transits.map((t, i) => (
            <TransitRow key={t.id} transit={t} isLast={i === transits.length - 1} />
          ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--border)',
          fontFamily: 'var(--font-mono)',
          fontSize: 8.5,
          letterSpacing: '0.18em',
          color: 'var(--text-faint)',
          textTransform: 'uppercase',
        }}
      >
        Lahiri Ayanāṃśa · {transits.length} tracked
      </div>
    </div>
  );
}
