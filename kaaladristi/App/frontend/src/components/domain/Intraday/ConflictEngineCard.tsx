/**
 * ConflictEngineCard — display the resolveConflict() verdict.
 */

import type { ConflictResult } from '@/services/conflictEngine';

interface Props { result: ConflictResult; }

const COLOR_VAR: Record<ConflictResult['color'], string> = {
  red:   'var(--risk-red)',
  green: 'var(--risk-green)',
  amber: 'var(--risk-amber)',
  teal:  'var(--accent-teal, #40B8C8)',
  dim:   'var(--text-muted)',
};

export default function ConflictEngineCard({ result }: Props) {
  const color = COLOR_VAR[result.color];
  return (
    <div style={{
      border: `1px solid ${color}40`,
      borderRadius: 4,
      padding: 12,
      background: `${color}0C`,
    }}>
      <div style={{
        fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
        color: 'var(--text-faint)', letterSpacing: '0.12em',
        textTransform: 'uppercase', marginBottom: 6,
      }}>Conflict Engine</div>

      {/* Verdict pill */}
      <div style={{
        textAlign: 'center',
        padding: '8px 6px',
        background: `${color}18`,
        border: `1px solid ${color}50`,
        borderRadius: 3,
      }}>
        <div style={{
          fontFamily: 'var(--font-mono, monospace)', fontSize: 13,
          fontWeight: 700, color, letterSpacing: '0.05em',
        }}>{result.label}</div>
        <div style={{
          fontFamily: 'var(--font-mono, monospace)', fontSize: 10,
          color: 'var(--text-primary)', marginTop: 4, fontWeight: 600,
        }}>{result.action}</div>
      </div>

      {/* Rule */}
      <div style={{
        marginTop: 8,
        fontFamily: 'var(--font-mono, monospace)', fontSize: 10,
        color: 'var(--text-muted)', lineHeight: 1.4,
      }}>{result.rule}</div>

      {/* Stats / bonus */}
      {(result.stats || result.bonus) && (
        <div style={{
          marginTop: 4,
          display: 'flex', gap: 8, flexWrap: 'wrap',
          fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
        }}>
          {result.stats && (
            <span style={{
              color: 'var(--text-faint)',
            }}>✓ {result.stats}</span>
          )}
          {result.bonus && (
            <span style={{
              color: 'var(--accent-gold, #C9A84C)', fontWeight: 700,
            }}>{result.bonus}</span>
          )}
        </div>
      )}
    </div>
  );
}
