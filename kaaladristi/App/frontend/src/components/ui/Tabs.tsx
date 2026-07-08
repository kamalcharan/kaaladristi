import type { ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'pill';
}

/**
 * Tabs primitive (Glass UX & Theme Standard §5.2). The "underline" variant
 * codifies the pattern already hand-rolled in SectorRotationPage.tsx (gold
 * active color, 2px bottom border, -1px overlap) instead of copy-pasting it
 * per view. "pill" is new — no existing KD convention to preserve there.
 *
 * Keyboard: native button Enter/Space activation only — no roving-tabindex
 * arrow-key navigation yet, kept out to stay scoped for this pass.
 */
export function Tabs({ tabs, activeId, onChange, variant = 'underline' }: TabsProps) {
  if (variant === 'pill') {
    return (
      <div role="tablist" className="flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const isActive = t.id === activeId;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(t.id)}
              className="rounded-full px-3.5 py-1.5 text-xs font-semibold"
              style={{
                background: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? 'var(--card)' : 'var(--text-muted)',
                border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                transition: `all .25s var(--ease)`,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="tablist" className="flex gap-0.5 border-b border-[var(--border)]">
      {tabs.map((t) => {
        const isActive = t.id === activeId;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className="-mb-px px-4 py-2 text-[13px] font-semibold"
            style={{
              fontFamily: 'var(--font-mono)',
              color: isActive ? 'var(--gold-soft)' : 'var(--text-muted)',
              borderBottom: `2px solid ${isActive ? 'var(--gold-soft)' : 'transparent'}`,
              transition: `all .25s var(--ease)`,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
