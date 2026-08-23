/**
 * WhatConfirms — the ✓/○/✗ checklist card.
 *
 * Renders SetupData.whatConfirms as-is. Adapter defines which criteria
 * appear and whether each is met/pending/failed; this card just draws
 * them. Same layout serves every adapter.
 *
 * See: docs/claude/scanner-story-page-poa.md · Phase 3.
 */

import { Check, X, Circle } from 'lucide-react';
import type { WhatConfirmsItem } from '@/services/thesis/setupAdapter';

interface Props {
  items: WhatConfirmsItem[];
}

const STATE_META: Record<WhatConfirmsItem['state'], { icon: typeof Check; color: string; ring: string }> = {
  met:     { icon: Check,  color: 'text-risk-green', ring: 'border-risk-green/40' },
  pending: { icon: Circle, color: 'text-muted',      ring: 'border-kd-border' },
  failed:  { icon: X,      color: 'text-risk-red',   ring: 'border-risk-red/40' },
};

export default function WhatConfirms({ items }: Props) {
  const met     = items.filter((i) => i.state === 'met').length;
  const pending = items.filter((i) => i.state === 'pending').length;
  const failed  = items.filter((i) => i.state === 'failed').length;

  return (
    <div className="rounded-xl border border-kd-border bg-kd-elevated/10 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
          What Confirms This?
        </span>
        <span className="text-[10px] font-mono text-muted">
          <span className="text-risk-green">{met}</span> ·
          <span className="text-muted"> {pending}</span> ·
          <span className="text-risk-red"> {failed}</span>
          <span className="text-muted"> / {items.length}</span>
        </span>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <ConfirmRow key={i} item={item} />
        ))}
      </div>
    </div>
  );
}

function ConfirmRow({ item }: { item: WhatConfirmsItem }) {
  const meta = STATE_META[item.state];
  const Icon = meta.icon;
  return (
    <div
      className={`flex items-start gap-2 text-xs border ${meta.ring} rounded-lg px-2.5 py-2 bg-kd-bg/40`}
      title={item.explain}
    >
      <span className={`shrink-0 mt-0.5 ${meta.color}`}>
        <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
      </span>
      <div className="min-w-0">
        <p className="text-[var(--text-primary)] leading-tight">{item.label}</p>
        <p className="text-[10px] text-muted leading-snug mt-0.5">{item.explain}</p>
      </div>
    </div>
  );
}
