import { useDashboardPings, type DashboardPing } from '@/hooks/useDashboardPings';
import Kicker from './Kicker';
import Sparkline from './Sparkline';

// ── Helpers ───────────────────────────────────────────────────────────────────

function tierColor(tier: DashboardPing['tier']): string {
  return tier === 'opportunity' ? 'var(--gold)' : 'var(--indigo)';
}

function tierBorderColor(tier: DashboardPing['tier']): string {
  return tier === 'opportunity' ? 'var(--border-gold)' : 'var(--border-indigo)';
}

function tierGlowBg(tier: DashboardPing['tier']): string {
  return tier === 'opportunity'
    ? 'linear-gradient(180deg, rgba(212,168,75,0.04) 0%, var(--card) 100%)'
    : 'linear-gradient(180deg, rgba(129,140,248,0.04) 0%, var(--card) 100%)';
}

// ── Single ping card ──────────────────────────────────────────────────────────

function PingCard({ ping }: { ping: DashboardPing }) {
  const color = tierColor(ping.tier);

  return (
    <div
      style={{
        background: tierGlowBg(ping.tier),
        border: `1px solid ${tierBorderColor(ping.tier)}`,
        borderRadius: 14,
        padding: '20px 22px',
        display: 'grid',
        gridTemplateColumns: '28px 1fr 120px 72px',
        gap: 18,
        alignItems: 'center',
        cursor: 'default',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Orb */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background:
            ping.tier === 'opportunity'
              ? 'radial-gradient(circle at 30% 30%, var(--gold-soft), #a17524)'
              : 'radial-gradient(circle at 30% 30%, var(--indigo-strong), #4f46e5)',
          boxShadow:
            ping.tier === 'opportunity'
              ? '0 0 14px rgba(212,168,75,0.4)'
              : '0 0 14px rgba(129,140,248,0.35)',
          flexShrink: 0,
        }}
      />

      {/* Body */}
      <div style={{ minWidth: 0 }}>
        <div style={{ marginBottom: 6 }}>
          <Kicker label={ping.kicker} tag={ping.kickerTag} tier={ping.tier} />
        </div>

        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 17,
            fontWeight: 500,
            color: 'var(--text-primary)',
            lineHeight: 1.35,
            letterSpacing: '-0.005em',
            marginBottom: 4,
          }}
        >
          <strong style={{ color, fontWeight: 600 }}>{ping.headline}</strong>
          {' '}
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
            {ping.subHeadline}
          </span>
        </div>

        {/* Trail */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            color: 'var(--text-muted)',
          }}
        >
          {ping.trail.map((t, i) => (
            <span key={i}>
              {i > 0 && <span style={{ color: 'var(--text-faint)', marginRight: 10 }}>·</span>}
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Sparkline */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <Sparkline values={ping.sparkValues} color={color} width={110} height={44} />
      </div>

      {/* Score */}
      <div style={{ textAlign: 'right' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 24,
            fontWeight: 500,
            color: 'var(--text-primary)',
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {ping.score}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--text-faint)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginTop: 3,
          }}
        >
          {ping.scoreLbl}
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyPings() {
  return (
    <div
      style={{
        padding: '32px 24px',
        textAlign: 'center',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 16,
          color: 'var(--text-faint)',
          marginBottom: 6,
        }}
      >
        Nothing stands out today.
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-faint)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        Market data loading or no signals above threshold.
      </div>
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
        marginBottom: 12,
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 500,
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
        }}
      >
        What stands out{' '}
        <em style={{ color: 'var(--gold)', fontStyle: 'italic', fontWeight: 400 }}>today</em>
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9.5,
          letterSpacing: '0.16em',
          color: 'var(--text-faint)',
          textTransform: 'uppercase',
        }}
      >
        VaNi&apos;s read
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface PingsColumnProps {
  date: string;
}

export default function PingsColumn({ date }: PingsColumnProps) {
  const { pings, isLoading } = useDashboardPings(date);

  return (
    <div>
      <SectionLabel />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isLoading && (
          <>
            {[1, 2, 3].map(i => (
              <div
                key={i}
                style={{
                  height: 96,
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  opacity: 0.5,
                }}
              />
            ))}
          </>
        )}

        {!isLoading && pings.length === 0 && <EmptyPings />}

        {!isLoading && pings.map(ping => <PingCard key={ping.id} ping={ping} />)}
      </div>
    </div>
  );
}
