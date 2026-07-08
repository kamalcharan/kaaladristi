import type { ReactNode } from 'react';

export interface PageHeaderProps {
  /** Small-caps uppercase section label above the title, e.g. "SETTINGS". */
  eyebrow?: string;
  title: ReactNode;
  /** Emphasized trailing portion of the title, rendered in gold italic. */
  titleEm?: string;
  /** Count / description line below the title. */
  meta?: ReactNode;
  /** Buttons or controls, right-aligned. */
  actions?: ReactNode;
  /** Short lead sentence, rendered before meta on the same line. */
  lead?: ReactNode;
}

/**
 * Mandatory sticky glass header for every app page (Glass UX & Theme
 * Standard §5.3). Pair with a `.page`/`.body` wrapper — no padding on the
 * page container, all padding on the body below this header.
 */
export function PageHeader({ eyebrow, title, titleEm, meta, actions, lead }: PageHeaderProps) {
  return (
    <header
      className="sticky top-0 z-20 flex flex-wrap items-end gap-4 border-b border-[var(--border)] bg-[var(--kd-card)] px-8 py-5 backdrop-blur-[10px]"
    >
      <div>
        {eyebrow && (
          <div
            className="mb-1 uppercase text-kd-text-muted"
            style={{
              fontSize: 'var(--label-font-size)',
              fontWeight: 'var(--label-font-weight)',
              letterSpacing: 'var(--label-letter-spacing)',
              fontFamily: 'var(--label-font-family)',
            }}
          >
            {eyebrow}
          </div>
        )}
        <h1
          className="text-[26px] font-semibold tracking-[-0.02em] text-kd-text-primary"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {title}
          {titleEm && <em className="ml-1 text-kd-gold">{titleEm}</em>}
        </h1>
        {(lead || meta) && (
          <p className="mt-1 text-[12.5px] text-kd-text-faint">
            {lead}
            {lead && meta ? ' — ' : null}
            {meta}
          </p>
        )}
      </div>
      {actions && (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}
