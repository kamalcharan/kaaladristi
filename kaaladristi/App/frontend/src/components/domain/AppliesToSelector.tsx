/**
 * AppliesToSelector — the /inference "Applies To" card + detail-panel widget,
 * extracted verbatim from views/InferenceView.tsx (2026-07-07) so the Rule
 * Inference modal reuses the SAME component instead of imitating it.
 * InferenceView imports from here; behavior there is unchanged.
 *
 * Items are injected by the caller — /inference feeds dc_lookup rows,
 * Rule Inference feeds sector-rotation indices (sectoral + curated),
 * broad indices, and dc_lookup commodities.
 */

import { useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Minimal item shape — dc_lookup rows and km_index_symbols rows both map to it. */
export interface AppliesToItem {
  code: string;
  label: string;
}

export interface ApplForm {
  stockMarket: boolean;                                     // broad equity toggle
  sectors:     { enabled: boolean; codes: string[] };       // specific sectors
  index:       { enabled: boolean; all: boolean; codes: string[] };
  commodity:   { enabled: boolean; all: boolean; codes: string[] };
}

export type ApplPanel = 'stockMarket' | 'sectors' | 'index' | 'commodity';

export const APPL_CARDS: { key: ApplPanel; label: string; sub: string }[] = [
  { key: 'stockMarket', label: 'Stock Market',  sub: 'Broad equity' },
  { key: 'sectors',     label: 'Sectors',        sub: 'Specific sectors' },
  { key: 'index',       label: 'Indexes',        sub: 'NSE / BSE indexes' },
  { key: 'commodity',   label: 'Commodities',    sub: 'MCX commodities' },
];

export const DEFAULT_APPL: ApplForm = {
  stockMarket: true,
  sectors:     { enabled: false, codes: [] },
  index:       { enabled: false, all: false, codes: [] },
  commodity:   { enabled: false, all: false, codes: [] },
};

/** Serialize the form into the dc_inference-shaped scope + JSONB pair. */
export function applToInput(appl: ApplForm): {
  applicability_scope: string[] | null;
  applicability: Record<string, unknown> | null;
} {
  const scope: string[] = [];
  const applicability: Record<string, unknown> = {};

  // Stock Market OR Sectors → equity scope
  if (appl.stockMarket || appl.sectors.enabled) {
    scope.push('equity');
    applicability.equity = {
      all_sectors: appl.stockMarket,
      sectors: appl.sectors.enabled ? appl.sectors.codes : [],
    };
  }
  if (appl.index.enabled) {
    scope.push('index');
    applicability.index = { all: appl.index.all, list: appl.index.codes };
  }
  if (appl.commodity.enabled) {
    scope.push('commodity');
    applicability.commodity = { all: appl.commodity.all, list: appl.commodity.codes };
  }

  return {
    applicability_scope: scope.length ? scope : null,
    applicability: Object.keys(applicability).length ? applicability : null,
  };
}

/** Inverse of applToInput — rebuild the form from a stored scope + JSONB pair
 * (used to prefill the Rule Inference form when editing an existing row). */
export function inputToAppl(
  scope: string[] | null | undefined,
  applicability: Record<string, unknown> | null | undefined,
): ApplForm {
  const scopes = Array.isArray(scope) ? scope : [];
  const a = (applicability ?? {}) as Record<string, Record<string, unknown>>;
  const eq  = a.equity ?? {};
  const idx = a.index ?? {};
  const com = a.commodity ?? {};
  const eqSectors  = Array.isArray(eq.sectors) ? (eq.sectors as string[]) : [];
  const idxCodes   = Array.isArray(idx.list) ? (idx.list as string[]) : [];
  const comCodes   = Array.isArray(com.list) ? (com.list as string[]) : [];
  if (scopes.length === 0) return { ...DEFAULT_APPL, sectors: { ...DEFAULT_APPL.sectors }, index: { ...DEFAULT_APPL.index }, commodity: { ...DEFAULT_APPL.commodity } };
  return {
    stockMarket: scopes.includes('equity') && eq.all_sectors !== false,
    sectors:     { enabled: eqSectors.length > 0, codes: eqSectors },
    index:       { enabled: scopes.includes('index'), all: !!idx.all, codes: idxCodes },
    commodity:   { enabled: scopes.includes('commodity'), all: !!com.all, codes: comCodes },
  };
}

export function isApplCardActive(appl: ApplForm, key: ApplPanel): boolean {
  if (key === 'stockMarket') return appl.stockMarket;
  if (key === 'sectors')     return appl.sectors.enabled;
  if (key === 'index')       return appl.index.enabled;
  return appl.commodity.enabled;
}

export function toggleApplCard(appl: ApplForm, key: ApplPanel): ApplForm {
  if (key === 'stockMarket') return { ...appl, stockMarket: !appl.stockMarket };
  if (key === 'sectors')     return { ...appl, sectors: { ...appl.sectors, enabled: !appl.sectors.enabled } };
  if (key === 'index')       return { ...appl, index: { ...appl.index, enabled: !appl.index.enabled } };
  return { ...appl, commodity: { ...appl.commodity, enabled: !appl.commodity.enabled } };
}

export function AppliesTo({
  appl, onChange, sectors, indexes, commodities,
}: {
  appl: ApplForm;
  onChange: (a: ApplForm) => void;
  sectors: AppliesToItem[];
  indexes: AppliesToItem[];
  commodities: AppliesToItem[];
}) {
  const [activePanel, setActivePanel] = useState<ApplPanel | null>(null);
  const [search, setSearch] = useState('');

  const handleCardClick = (key: ApplPanel) => {
    if (key === 'stockMarket') {
      // Stock Market has no children — just toggle
      onChange(toggleApplCard(appl, key));
    } else {
      const wasEnabled = isApplCardActive(appl, key);
      if (!wasEnabled) {
        // Enable + open panel
        onChange(toggleApplCard(appl, key));
        setActivePanel(key);
        setSearch('');
      } else if (activePanel === key) {
        // Already open — close panel
        setActivePanel(null);
      } else {
        // Enabled but panel closed — open it
        setActivePanel(key);
        setSearch('');
      }
    }
  };

  const handleDisable = (key: ApplPanel) => {
    onChange(toggleApplCard(appl, key));
    if (activePanel === key) setActivePanel(null);
  };

  // Items for the active detail panel
  const panelItems = activePanel === 'sectors' ? sectors
    : activePanel === 'index' ? indexes
    : activePanel === 'commodity' ? commodities : [];

  const panelSection = activePanel === 'sectors' ? appl.sectors
    : activePanel === 'index' ? appl.index
    : activePanel === 'commodity' ? appl.commodity : null;

  const filteredItems = panelItems.filter(it =>
    it.label.toLowerCase().includes(search.toLowerCase())
  );

  const panelLabel = APPL_CARDS.find(c => c.key === activePanel)?.label ?? '';

  const updateCodes = (code: string, checked: boolean) => {
    if (!activePanel || activePanel === 'stockMarket') return;
    if (activePanel === 'sectors') {
      const codes = checked ? [...appl.sectors.codes, code] : appl.sectors.codes.filter(c => c !== code);
      onChange({ ...appl, sectors: { ...appl.sectors, codes } });
    } else if (activePanel === 'index') {
      const codes = checked ? [...appl.index.codes, code] : appl.index.codes.filter(c => c !== code);
      onChange({ ...appl, index: { ...appl.index, codes } });
    } else {
      const codes = checked ? [...appl.commodity.codes, code] : appl.commodity.codes.filter(c => c !== code);
      onChange({ ...appl, commodity: { ...appl.commodity, codes } });
    }
  };

  const toggleAll = (checked: boolean) => {
    if (!activePanel || activePanel === 'stockMarket' || activePanel === 'sectors') return;
    if (activePanel === 'index') onChange({ ...appl, index: { ...appl.index, all: checked, codes: checked ? [] : appl.index.codes } });
    else onChange({ ...appl, commodity: { ...appl.commodity, all: checked, codes: checked ? [] : appl.commodity.codes } });
  };

  const selectedCodes = activePanel === 'sectors' ? appl.sectors.codes
    : activePanel === 'index' ? appl.index.codes
    : activePanel === 'commodity' ? appl.commodity.codes : [];

  const showAll = activePanel === 'index' ? appl.index.all
    : activePanel === 'commodity' ? appl.commodity.all : false;

  return (
    <div className="flex gap-3">
      {/* Left: toggle cards */}
      <div className="flex flex-col gap-2 min-w-[120px]">
        {APPL_CARDS.map(card => {
          const active = isApplCardActive(appl, card.key);
          const focused = activePanel === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => handleCardClick(card.key)}
              className={cn(
                'text-left px-3 py-2.5 rounded-xl border transition-all',
                active
                  ? focused
                    ? 'bg-accent-indigo/20 border-accent-indigo/50 ring-1 ring-accent-indigo/30'
                    : 'bg-accent-indigo/10 border-accent-indigo/30'
                  : 'bg-kd-elevated border-kd-border hover:border-kd-border-active'
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn('text-xs font-semibold', active ? 'text-accent-indigo' : 'text-muted')}>
                  {card.label}
                </span>
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  active ? 'bg-accent-indigo' : 'bg-[var(--text-muted)]/40'
                )} />
              </div>
              <p className="text-[10px] text-muted mt-0.5">{card.sub}</p>
            </button>
          );
        })}
      </div>

      {/* Right: detail panel */}
      {activePanel && activePanel !== 'stockMarket' && panelSection && (
        <div className="flex-1 p-3 bg-kd-elevated/50 border border-kd-border rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[var(--text-primary)]">{panelLabel}</span>
            <button
              type="button"
              onClick={() => handleDisable(activePanel)}
              className="text-[10px] text-risk-red hover:text-risk-red/80 transition-colors"
            >
              Remove
            </button>
          </div>

          {/* All toggle (for indexes + commodities) */}
          {activePanel !== 'sectors' && (
            <label className="flex items-center gap-2 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showAll}
                onChange={e => toggleAll(e.target.checked)}
                className="accent-accent-indigo w-3 h-3"
              />
              <span className="text-[11px] text-[var(--text-secondary)]">All {panelLabel}</span>
            </label>
          )}

          {/* Search + checklist (hidden when "All" is on) */}
          {!showAll && (
            <>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Search ${panelLabel.toLowerCase()}...`}
                  className="w-full pl-7 pr-3 py-1.5 bg-kd-elevated border border-kd-border rounded-lg text-[11px] text-[var(--text-primary)] placeholder:text-muted focus:outline-none focus:border-accent-indigo/60"
                />
              </div>
              <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1">
                {filteredItems.map(it => (
                  <label key={it.code} className="flex items-center gap-2 py-0.5 cursor-pointer hover:bg-kd-elevated/40 rounded px-1">
                    <input
                      type="checkbox"
                      checked={selectedCodes.includes(it.code)}
                      onChange={e => updateCodes(it.code, e.target.checked)}
                      className="accent-accent-indigo w-3 h-3"
                    />
                    <span className="text-[11px] text-[var(--text-secondary)]">{it.label}</span>
                  </label>
                ))}
                {filteredItems.length === 0 && (
                  <p className="text-[10px] text-muted py-2 text-center">No matches</p>
                )}
              </div>
              {selectedCodes.length > 0 && (
                <p className="text-[10px] text-accent-indigo mt-2">{selectedCodes.length} selected</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Stock Market selected — no children, just confirmation */}
      {activePanel === 'stockMarket' && (
        <div className="flex-1 flex items-center justify-center p-3 bg-kd-elevated/50 border border-kd-border rounded-xl">
          <p className="text-[11px] text-muted text-center">Applies broadly to the entire stock market</p>
        </div>
      )}
    </div>
  );
}
