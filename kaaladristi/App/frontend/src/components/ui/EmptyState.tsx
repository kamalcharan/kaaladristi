import type { ReactNode } from 'react';
import { Card } from './Card';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

/**
 * "Never a blank state" fallback (Glass UX & Theme Standard §5.2/§7.3).
 * Built on the existing Card primitive with a dashed border, matching the
 * ad hoc `<Card rounded="xxl" className="py-12 text-center">` pattern
 * already used for error states across the app (e.g. ScanView.tsx) — same
 * shape, now named and reusable instead of copy-pasted per view.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card rounded="xxl" className="py-12 text-center" style={{ borderStyle: 'dashed' }}>
      {icon && <div className="mb-2 text-3xl opacity-70">{icon}</div>}
      <h4
        className="mb-1 text-[1.05rem] font-semibold text-kd-text-primary"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title}
      </h4>
      {description && (
        <p className="mb-3 text-[12.5px] text-kd-text-muted">{description}</p>
      )}
      {action}
    </Card>
  );
}
