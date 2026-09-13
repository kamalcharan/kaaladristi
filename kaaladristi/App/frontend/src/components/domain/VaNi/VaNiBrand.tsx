import type { ReactNode } from 'react';

/** VaNi's product-independent identity. The transparent master works on every theme. */
export function VaNiAvatar({ size = 44 }: { size?: number }) {
  return <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--border)]"
    style={{ width: size, height: size, background: 'var(--card-soft)' }}>
    <img src="/assets/vani/vani-mascot-transparent.png" alt="" style={{ width: size - 4, height: size - 4, objectFit: 'contain' }} />
  </span>;
}

export default function VaNiBrand({ subtitle, size = 44, trailing }: { subtitle?: ReactNode; size?: number; trailing?: ReactNode }) {
  return <div className="flex min-w-0 items-center gap-3">
    <VaNiAvatar size={size} />
    <div className="min-w-0 flex-1">
      <h2 className="font-serif text-lg leading-tight text-[var(--text-primary)]">VaNi <span className="text-[var(--text-secondary)]">· वाणी</span></h2>
      {subtitle && <p className="mt-1 text-xs text-[var(--text-secondary)]">{subtitle}</p>}
    </div>
    {trailing}
  </div>;
}
