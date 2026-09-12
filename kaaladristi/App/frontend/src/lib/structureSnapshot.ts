import type { MarketBreadthDay, BreadthRocDay } from '@/types';

export function structureSnapshot(breadth: MarketBreadthDay[], roc: BreadthRocDay[]) {
  // Exact IEEE-754 bytes match Python's struct.pack('>d'): no rounding drift.
  const numeric = (v: unknown) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return '_';
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(0, v);
    return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
  };
  const encode = (rows: object[], fields: string[]) => rows.map(row => fields.map(k => {
    const v = (row as Record<string, unknown>)[k];
    return k === 'trade_date' ? String(v).slice(0, 10) : numeric(v);
  }).join(',')).join(';');
  return encode(breadth, ['trade_date', 'pct_above_20', 'pct_above_50', 'pct_above_150', 'breadth_score', 'stock_count'])
    + '|' + encode(roc, ['trade_date', 'roc_13', 'roc_55', 'sma_breadth', 'stock_count']);
}
