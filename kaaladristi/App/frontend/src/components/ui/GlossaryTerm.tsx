import type { ReactNode } from 'react';
import { Tooltip } from '@/components/ui/Tooltip';
import { glossaryLookup } from '@/constants/panchangGlossary';

/**
 * Renders a term with a dotted-underline + hover definition when it exists in
 * the panchang glossary, and as plain text otherwise — so callers can wrap
 * label props unconditionally (e.g. every PanchangamCard row) without
 * special-casing unknown labels.
 */
export default function GlossaryTerm({
  term,
  children,
  position = 'top',
}: {
  term: string;
  /** Optional custom rendering of the label; defaults to the term itself. */
  children?: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const definition = glossaryLookup(term);
  const content = children ?? term;

  if (!definition) return <>{content}</>;

  return (
    <Tooltip content={definition} position={position} maxWidth={260}>
      <span style={{ borderBottom: '1px dotted currentColor', cursor: 'help', paddingBottom: 1 }}>
        {content}
      </span>
    </Tooltip>
  );
}
