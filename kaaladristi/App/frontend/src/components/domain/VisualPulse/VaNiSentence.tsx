import React from 'react';
import type { CorrelationState } from '@/services/visualPulseEngine';

interface VaNiSentenceProps {
  narrative: string | null;
  corrState: CorrelationState;
  date: string;
  isFading?: boolean;
}

export default function VaNiSentence({ narrative, corrState, date, isFading }: VaNiSentenceProps) {
  const isOffline = !narrative;

  return (
    <div style={{
      padding: '12px 14px',
      background: isOffline
        ? 'color-mix(in srgb, var(--text-muted) 4%, var(--kd-surface))'
        : 'color-mix(in srgb, var(--accent-violet) 6%, var(--kd-surface))',
      border: `1px solid ${isOffline
        ? 'color-mix(in srgb, var(--text-muted) 15%, transparent)'
        : 'color-mix(in srgb, var(--accent-violet) 20%, transparent)'}`,
      borderRadius: 10,
      opacity: isFading ? 0.2 : 1,
      transition: 'opacity 0.3s ease',
    }}>
      <div style={{
        fontSize: isOffline ? 10 : 12,
        fontStyle: 'italic',
        color: isOffline ? 'var(--text-muted)' : 'var(--text-secondary)',
        lineHeight: 1.65,
      }}>
        {isOffline ? 'VaNi is offline' : narrative}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 8,
      }}>
        <span style={{
          fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--text-muted)', letterSpacing: 1,
        }}>{date}</span>
        <span style={{
          padding: '2px 8px', borderRadius: 8,
          fontSize: 8, fontFamily: 'var(--font-mono, monospace)', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: 1,
          background: `color-mix(in srgb, ${corrState.color} 15%, transparent)`,
          border: `1px solid color-mix(in srgb, ${corrState.color} 40%, transparent)`,
          color: corrState.color,
        }}>
          {corrState.state}
        </span>
      </div>
    </div>
  );
}
