import type { ReactNode } from 'react';
import VaNiPanelToggle from './VaNiPanelToggle';

/** VaNi's product-independent identity. The transparent master works on every theme. */
export function VaNiAvatar({ size = 44 }: { size?: number }) {
  return <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--border)]"
    style={{ width: size, height: size, background: 'var(--card-soft)' }}>
    <img src="/assets/vani/vani-mascot-transparent.png" alt="" style={{ width: size - 4, height: size - 4, objectFit: 'contain' }} />
  </span>;
}

/** `collapsible` defaults to true because every companion header renders this
 *  component — that is what makes the collapse ONE implementation rather than
 *  six. Pass false where the header already owns a dismissal (the mobile
 *  sector dialog has its own Close, and two of them read as a bug). An
 *  explicit `trailing` still wins: it is the caller's slot. */
export default function VaNiBrand({ subtitle, size = 44, trailing, collapsible = true }: { subtitle?: ReactNode; size?: number; trailing?: ReactNode; collapsible?: boolean }) {
  return <div className="flex min-w-0 items-center gap-3">
    <VaNiAvatar size={size} />
    <div className="min-w-0 flex-1">
      <h2 className="font-serif text-lg leading-tight text-[var(--text-primary)]">VaNi <span className="text-[var(--text-secondary)]">· वाणी</span></h2>
      {subtitle && <p className="mt-1 text-xs text-[var(--text-secondary)]">{subtitle}</p>}
    </div>
    {trailing ?? (collapsible ? <VaNiPanelToggle /> : null)}
  </div>;
}


/** Calm progress treatment; animation lives on the halo, never on VaNi's face. */
export function VaNiConsulting() {
  return <div role="status" className="vani-consulting">
    <span className="vani-consulting-avatar"><VaNiAvatar size={48} /></span>
    <div><p className="text-sm font-medium">Consulting VaNi…</p><p className="text-xs text-muted mt-1">Reading the selected evidence</p></div>
  </div>;
}
