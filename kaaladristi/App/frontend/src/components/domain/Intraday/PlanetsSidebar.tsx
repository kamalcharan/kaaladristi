/**
 * PlanetsSidebar — 9-graha table for the active trade date.
 *
 * Display order is canonical Vedic: Sun · Moon · Mars · Mercury ·
 * Jupiter · Venus · Saturn · Rahu · Ketu. Only renders planets
 * actually present in km_planetary_positions for the date —
 * DristiQ does not ingest Herschel or Pluto.
 */

import { usePlanetaryPositions, type PlanetaryPosition } from '@/hooks/usePlanetaryPositions';

interface Props { date: string | null; }

const ORDER = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

const SYMBOL: Record<string, string> = {
  Sun: '☉', Moon: '☽', Mars: '♂', Mercury: '☿',
  Jupiter: '♃', Venus: '♀', Saturn: '♄',
  Rahu: '☊', Ketu: '☋',
};

interface Status { label: string; tone: 'green' | 'red' | 'amber' | 'gold' | 'dim'; }

function statusFor(p: PlanetaryPosition): Status {
  // Composite single-line status. Priority: combust > retrograde > direct.
  if (p.combust) return { label: 'Combust', tone: 'red' };
  if (p.retrograde) return { label: '℞ Retro', tone: 'amber' };
  return { label: 'Direct', tone: 'dim' };
}

const TONE_VAR: Record<Status['tone'], string> = {
  green: 'var(--risk-green)',
  red:   'var(--risk-red)',
  amber: 'var(--risk-amber)',
  gold:  'var(--gold)',
  dim:   'var(--text-muted)',
};

export default function PlanetsSidebar({ date }: Props) {
  const { positions, isLoading } = usePlanetaryPositions(date);

  // Index by name for fast lookup, preserve canonical order
  const byName = new Map(positions.map(p => [p.planet, p]));
  const ordered = ORDER
    .map(name => byName.get(name))
    .filter((p): p is PlanetaryPosition => !!p);

  return (
    <div style={{
      border: '1px solid var(--kd-border)', borderRadius: 4,
      padding: 12,
      background: 'var(--panel-recess)',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
        color: 'var(--text-faint)', letterSpacing: '0.12em',
        textTransform: 'uppercase', marginBottom: 6,
      }}>Planets</div>

      {isLoading && positions.length === 0 ? (
        <div style={{
          fontFamily: 'var(--font-mono, monospace)', fontSize: 10,
          color: 'var(--text-faint)',
        }}>Loading…</div>
      ) : ordered.length === 0 ? (
        <div style={{
          fontFamily: 'var(--font-mono, monospace)', fontSize: 10,
          color: 'var(--text-faint)',
        }}>No planetary data for this date.</div>
      ) : ordered.map((p, i) => {
        const status = statusFor(p);
        return (
          <div key={p.planet} style={{
            display: 'grid',
            gridTemplateColumns: '14px 60px 1fr auto',
            alignItems: 'baseline', gap: 6,
            padding: '3px 0',
            borderBottom: i < ordered.length - 1 ? '1px solid color-mix(in srgb, var(--text-primary) 4%, transparent)' : 'none',
            fontFamily: 'var(--font-mono, monospace)', fontSize: 10,
          }}>
            <span style={{
              color: 'var(--text-muted)', fontSize: 11,
              textAlign: 'center',
            }}>{SYMBOL[p.planet] ?? '·'}</span>
            <span style={{ color: 'var(--text-faint)' }}>{p.planet}</span>
            <span style={{
              color: 'var(--text-primary)', fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{p.sign_name ?? '—'}</span>
            <span style={{
              color: TONE_VAR[status.tone], fontSize: 9, fontWeight: 700,
            }}>{status.label}</span>
          </div>
        );
      })}
    </div>
  );
}
