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


/** Calm progress treatment; animation lives on the halo, never on VaNi's face. */
export function VaNiConsulting() {
  return <div role="status" className="vani-consulting">
    <span className="vani-consulting-avatar"><VaNiAvatar size={48} /></span>
    <div><p className="text-sm font-medium">Consulting VaNi…</p><p className="text-xs text-muted mt-1">Reading the selected evidence</p></div>
  </div>;
}

export function VaNiDepthSelector({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  const styles=[['brief','Concise','The takeaway'],['simple','Explain simply','What it means'],['detailed','Go deeper','Evidence and limits']];
  return <fieldset className="vani-depth"><legend>Explanation style</legend>
    <div>{styles.map(([id,label,hint])=><button type="button" key={id} aria-label={label} aria-pressed={value===id} onClick={()=>onChange(id)}><span>{label}</span><small>{hint}</small></button>)}</div>
  </fieldset>;
}
