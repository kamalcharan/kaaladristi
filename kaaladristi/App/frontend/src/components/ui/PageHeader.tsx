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
 * Glass page-title header for every app page (Glass UX & Theme Standard
 * §5.3) — eyebrow/title/meta/actions in one place instead of a bespoke
 * inline <h1> block per view.
 *
 * NOT sticky: Layout.tsx already owns the one sticky glass boundary in
 * this app (its topbar — search + VaNi button, sticky top-0 z-40, wrapping
 * every routed page). A second sticky element here would compete for the
 * same top:0 slot and overlap it. This renders as a normal in-flow block
 * directly below that topbar.
 */
export function PageHeader({ eyebrow, title, titleEm, meta, actions, lead }: PageHeaderProps) {
  return (
    <header
      className="relative flex flex-wrap items-end gap-4 bg-[var(--kd-card)] px-8 py-5 backdrop-blur-[10px]"
    >
      {/* Gold-thread underline (Glass UX standard §5.5) — a brand-hued
          gradient hairline instead of a flat border, so every page header
          carries a hint of the theme instead of reading monochrome. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{ background: 'linear-gradient(90deg, var(--border), var(--accent-dim) 30%, var(--gold-bg) 60%, var(--border))' }}
      />
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
      {/* min-w-0 + max-w-full so the cluster can shrink inside the wrapping
          header; overflow-x-auto is the last resort for a single action wider
          than the page (measured 453px against a 390px phone on
          /astro-calendar, silently clipped and unreachable). */}
      {actions && (
        <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center gap-2 overflow-x-auto">
          {actions}
        </div>
      )}
    </header>
  );
}
