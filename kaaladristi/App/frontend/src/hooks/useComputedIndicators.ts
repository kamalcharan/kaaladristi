import { useState, useEffect } from 'react';
import { computeIndicators } from '@/lib/computeIndicators';
import type { KmIndexEod } from '@/types';

/**
 * Reusable hook that ensures indicator columns are populated.
 *
 * If the rows already have indicators (sma_8 != null on latest row),
 * they are returned as-is. Otherwise, computeIndicators() runs on the
 * client to fill them in on the fly.
 *
 * This hook is data-source agnostic — works with km_index_eod,
 * km_index_15m, or any future table sharing the KmIndexEod shape.
 *
 * @param rows  Raw rows from Supabase (may have null indicator cols)
 * @returns     { data, isComputing }
 */
export function useComputedIndicators(rows: KmIndexEod[] | undefined) {
  const [data, setData] = useState<KmIndexEod[]>([]);
  const [isComputing, setIsComputing] = useState(false);

  useEffect(() => {
    if (!rows || rows.length === 0) {
      setData([]);
      setIsComputing(false);
      return;
    }

    // Check if indicators are already populated (sma_8 on latest row)
    const latest = rows[rows.length - 1];
    if (latest.sma_8 != null) {
      setData(rows);
      setIsComputing(false);
      return;
    }

    // Indicators not in DB — compute on the fly
    setIsComputing(true);

    // setTimeout lets the "Computing..." UI render before the heavy compute
    const timer = setTimeout(() => {
      const result = computeIndicators(rows);
      setData(result);
      setIsComputing(false);
    }, 50);

    return () => clearTimeout(timer);
  }, [rows]);

  return { data, isComputing };
}
