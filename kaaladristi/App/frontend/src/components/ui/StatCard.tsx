import type { KeyboardEvent, ReactNode } from 'react';

export interface StatCardProps {
  value: ReactNode;
  label: string;
  accent?: 'success' | 'danger' | 'warning' | 'info';
  pct?: string;
  onClick?: () => void;
  active?: boolean;
}

const ACCENT_VAR: Record<NonNullable<StatCardProps['accent']>, string> = {
  success: 'var(--bull)',
  danger: 'var(--bear)',
  warning: 'var(--caution)',
  info: 'var(--accent-cyan)',
};

/**
 * KPI tile / clickable filter (Glass UX & Theme Standard §5.2). No existing
 * shared component to codify here — dashboards hand-roll their own metric
 * tiles today — so this follows the reference spec directly, using KD's
 * already-established numeric convention (font-mono, tabular-nums) and the
 * Phase 1 --label-* tokens for the caption.
 */
export function StatCard({ value, label, accent, pct, onClick, active }: StatCardProps) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  }

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className="w-full rounded-xl border px-4 py-3.5 text-left"
      style={{
        background: 'var(--kd-card)',
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        cursor: onClick ? 'pointer' : 'default',
        transition: `all .3s var(--ease)`,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '1.7rem',
          fontWeight: 600,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          color: accent ? ACCENT_VAR[accent] : 'var(--text-primary)',
        }}
      >
        {value}
        {pct && <span className="ml-1.5 text-[13px] font-normal opacity-70">{pct}</span>}
      </div>
      <div
        className="mt-1.5 uppercase"
        style={{
          fontSize: 'var(--label-font-size)',
          fontWeight: 'var(--label-font-weight)',
          letterSpacing: 'var(--label-letter-spacing)',
          color: 'var(--text-muted)',
        }}
      >
        {label}
      </div>
    </div>
  );
}
