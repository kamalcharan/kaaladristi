import React from 'react';

interface VaNiHeaderProps {
  date: string;
  barPosition: string;  // e.g. "Candle 45 / 60" or "NOW"
  isThinking?: boolean;
}

export default function VaNiHeader({ date, barPosition, isThinking }: VaNiHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-violet))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontFamily: 'var(--font-serif, serif)', fontWeight: 700,
        color: '#fff',
      }}>V</div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 13, fontFamily: 'var(--font-serif, serif)', fontWeight: 700,
          color: 'var(--text-primary)',
        }}>
          VaNi &middot; <span style={{ fontWeight: 400 }}>\u0935\u093E\u0923\u0940</span>
        </div>
        <div style={{
          fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
          letterSpacing: 1, color: 'var(--text-muted)',
          opacity: isThinking ? undefined : 1,
          animation: isThinking ? 'vani-pulse 1.2s ease infinite' : undefined,
        }}>
          {isThinking ? 'Analysing...' : `${date} \u00B7 ${barPosition}`}
        </div>
      </div>
    </div>
  );
}
