/**
 * PanchangSidebar — read-only panchang summary table.
 *
 * Source: km_daily_panchang via /api/panchang/daily (props.panchang).
 * No fetch here — the parent already has it.
 */

import { yogaFavorability, elementOfSign } from '@/services/intradayTime';
import type { PanchangDailyResponse } from '@/hooks/useIntraday';

interface Props { panchang: PanchangDailyResponse | null; }

interface Row { label: string; value: string; color?: string; }

const ROW_COLOR: Record<string, string> = {
  green: 'var(--risk-green)',
  red:   'var(--risk-red)',
  amber: 'var(--risk-amber)',
  teal:  'var(--accent-cyan)',
  gold:  'var(--gold)',
  dim:   'var(--text-muted)',
};

function makeRows(p: PanchangDailyResponse): Row[] {
  const yogaFav = yogaFavorability(p.yoga_name);
  const yogaTone =
    yogaFav === 'favorable' ? 'green' :
    yogaFav === 'avoid'     ? 'red'   : 'dim';

  const moonElem = elementOfSign(p.moon_sign_name);

  return [
    {
      label: 'Tithi',
      value: `${p.tithi_base_name ?? p.tithi_name} (${p.paksha})`,
      color: 'dim',
    },
    {
      label: 'Yoga',
      value: p.yoga_name ?? '—',
      color: yogaTone,
    },
    {
      label: 'Nakshatra',
      value: p.nakshatra_lord
        ? `${p.nakshatra_name} · ${p.nakshatra_lord}`
        : p.nakshatra_name,
      color: 'dim',
    },
    {
      label: 'Moon',
      value: moonElem
        ? `${p.moon_sign_name} (${moonElem})`
        : (p.moon_sign_name ?? '—'),
      color: 'teal',
    },
    {
      label: 'Vara',
      value: `${p.vara} · ${p.vara_lord}`,
      color: 'dim',
    },
  ];
}

export default function PanchangSidebar({ panchang }: Props) {
  if (!panchang) {
    return (
      <div style={{
        border: '1px dashed var(--kd-border)', borderRadius: 4,
        padding: '10px 12px',
        fontFamily: 'var(--font-mono, monospace)', fontSize: 10,
        color: 'var(--text-faint)',
      }}>Panchang loading…</div>
    );
  }

  const rows = makeRows(panchang);
  const specials: string[] = [];
  if (panchang.is_ekadashi)  specials.push('Ekadashi');
  if (panchang.is_purnima)   specials.push('Purnima');
  if (panchang.is_amavasya)  specials.push('Amavasya');
  if (panchang.dlnl_match)   specials.push('DL=NL');

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
      }}>Panchang</div>

      {rows.map((r, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between',
          padding: '3px 0',
          borderBottom: i < rows.length - 1 ? '1px solid color-mix(in srgb, var(--text-primary) 4%, transparent)' : 'none',
          fontFamily: 'var(--font-mono, monospace)', fontSize: 10,
        }}>
          <span style={{ color: 'var(--text-faint)' }}>{r.label}</span>
          <span style={{
            color: r.color ? ROW_COLOR[r.color] : 'var(--text-primary)',
            fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginLeft: 8, textAlign: 'right',
          }}>{r.value}</span>
        </div>
      ))}

      {specials.length > 0 && (
        <div style={{
          marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap',
        }}>
          {specials.map(s => (
            <span key={s} style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 2,
              fontFamily: 'var(--font-mono, monospace)', fontWeight: 700,
              background: 'var(--gold-bg)',
              color: 'var(--gold)',
              border: '1px solid color-mix(in srgb, var(--gold) 40%, transparent)',
            }}>{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}
