/**
 * PersonaEntries — the LT Investor / Swing Trader two-column card.
 *
 * Renders SetupData.personas as-is. Zero preset logic. Same layout serves
 * every adapter (each defines its own entry rules, but the shape is fixed
 * at 3 entries per persona per the POA).
 *
 * See: docs/claude/scanner-story-page-poa.md · Phase 3.
 */

import type { PersonaEntries, PersonaEntry } from '@/services/thesis/setupAdapter';

interface Props {
  personas: PersonaEntries;
}

export default function PersonaEntriesCard({ personas }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <PersonaColumn
        title="Long-Term Investor"
        accent="text-accent-indigo"
        entries={personas.ltInvestor}
        personaKey="lt"
      />
      <PersonaColumn
        title="Swing Trader"
        accent="text-risk-amber"
        entries={personas.swingTrader}
        personaKey="swing"
      />
    </div>
  );
}

function PersonaColumn({
  title, accent, entries, personaKey,
}: {
  title: string;
  accent: string;
  entries: PersonaEntry[];
  personaKey: 'lt' | 'swing';
}) {
  return (
    <div className="rounded-xl border border-kd-border bg-kd-elevated/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[11px] font-bold uppercase tracking-wider ${accent}`}>{title}</span>
      </div>
      <div className="space-y-3">
        {entries.map((e) => (
          <EntryRow key={`${personaKey}-${e.entryNo}`} entry={e} personaKey={personaKey} />
        ))}
      </div>
    </div>
  );
}

function EntryRow({ entry, personaKey }: { entry: PersonaEntry; personaKey: 'lt' | 'swing' }) {
  const badgeClass = personaKey === 'lt'
    ? 'bg-accent-indigo/15 text-accent-indigo border-accent-indigo/40'
    : 'bg-risk-amber/15 text-risk-amber border-risk-amber/40';
  return (
    <div className="border-t border-kd-border pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${badgeClass}`}>
            {personaKey === 'lt' ? 'LT' : 'SW'} · Entry {entry.entryNo}
          </span>
          <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
            {entry.label}
          </span>
        </div>
        <span className="text-sm font-mono font-bold text-[var(--text-primary)] shrink-0">
          {entry.price == null || !Number.isFinite(entry.price) ? '—' : `₹${entry.price.toFixed(2)}`}
        </span>
      </div>
      <p className="text-[11px] text-muted leading-relaxed">{entry.rationale}</p>
    </div>
  );
}
