/**
 * CockpitOverlayStrip — active overlay pills above the Study chart.
 *
 * The cockpit drew the user's framework overlays but never SHOWED which ones
 * were active (owner 2026-07-07) — My Space has its pill strip fused into
 * WorkspaceCanvas. This is the compact cockpit equivalent, driven by the same
 * frameworkStore: dot = overlay color (dimmed when hidden; click to toggle
 * visibility), × removes, astro rules group into one pill per rule family,
 * + Overlay opens the shared drawer. Same store → both surfaces stay in sync.
 */

import { useFrameworkStore } from '@/stores/frameworkStore';
import { INDICATOR_DEFAULT_COLORS } from '@/constants/catalogItems';
import type { ChartOverlay } from '@/types/framework';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };

function groupKeyOf(catalogItemId: string): string {
  if (catalogItemId.startsWith('astro_rule:')) {
    const code = catalogItemId.replace('astro_rule:', '');
    return `astro:${code.split('-')[0]}`;
  }
  return catalogItemId;
}

function labelOf(o: ChartOverlay): string {
  if (o.label) return o.label;
  const id = o.catalog_item_id.replace('astro_rule:', '');
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function colorOf(o: ChartOverlay): string {
  return o.color ?? INDICATOR_DEFAULT_COLORS[o.catalog_item_id] ?? '#7c6af7';
}

export default function CockpitOverlayStrip({ onAdd }: { onAdd: () => void }) {
  const framework = useFrameworkStore((s) => s.framework);
  const removeOverlay = useFrameworkStore((s) => s.removeOverlay);
  const toggleOverlayVisibility = useFrameworkStore((s) => s.toggleOverlayVisibility);

  const overlays = framework?.chart_overlays ?? [];

  // Group astro rules into one pill per rule family (Mercury's 11 sub-rules
  // would otherwise flood the strip); indicator lines stay individual.
  const groups = new Map<string, ChartOverlay[]>();
  for (const o of overlays) {
    const k = groupKeyOf(o.catalog_item_id);
    const arr = groups.get(k);
    if (arr) arr.push(o);
    else groups.set(k, [o]);
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap mb-2 px-1">
      {Array.from(groups.entries()).map(([key, members]) => {
        const first = members[0];
        const anyVisible = members.some((o) => o.visible);
        const color = colorOf(first);
        const isGroup = members.length > 1;
        return (
          <span
            key={key}
            className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-full border border-kd-border bg-kd-elevated"
            style={{ opacity: anyVisible ? 1 : 0.45 }}
          >
            <button
              title={anyVisible ? 'Hide on chart' : 'Show on chart'}
              onClick={() => members.forEach((o) => o.visible === anyVisible && toggleOverlayVisibility(o.catalog_item_id))}
              className="w-2.5 h-2.5 rounded-full shrink-0 cursor-pointer border-0 p-0"
              style={{ background: color }}
            />
            <span style={{ ...MONO }} className="text-[10px] font-semibold text-[var(--text-secondary)] whitespace-nowrap">
              {labelOf(first)}
              {isGroup && <span className="text-muted"> · {members.length}</span>}
            </span>
            <button
              title={isGroup ? 'Remove all rules in this group' : 'Remove overlay'}
              onClick={() => members.forEach((o) => removeOverlay(o.catalog_item_id))}
              className="text-[10px] text-muted hover:text-[var(--text-primary)] px-1 cursor-pointer bg-transparent border-0"
            >
              ×
            </button>
          </span>
        );
      })}

      <button
        onClick={onAdd}
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold text-accent-indigo bg-accent-indigo/10 border border-accent-indigo/30 hover:bg-accent-indigo/20 transition-all"
        style={MONO}
      >
        + Overlay
      </button>
    </div>
  );
}
