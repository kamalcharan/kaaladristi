import { useMemo } from 'react';
import { useIndexBreadth } from '@/hooks/useSectorRotation';
import { DristiQLoader } from '@/components/ui';
import RotationGraph, { type RotationPoint } from './RotationGraph';

/**
 * BreadthRotation — feeds an index's breadth into RotationGraph (breadth variant):
 * level = breadth participation score (centred at 50 = neutral), momentum = its
 * ROC-13. Same per-index breadth the Sector Rotation page uses, so the whole
 * Today breadth section (rotation + charts) moves with one index selector.
 */
interface BreadthRotationProps {
  indexId: number | null;
  title?: string;
}

export default function BreadthRotation({ indexId, title = 'How breadth is moving' }: BreadthRotationProps) {
  const { data, isLoading } = useIndexBreadth(indexId, 66);

  const points = useMemo<RotationPoint[]>(() => {
    if (!data) return [];
    const rocByDate = new Map<string, number | null>(data.roc.map(r => [r.trade_date, r.roc_13]));
    return data.data.map(d => ({
      date: d.trade_date,
      level: d.breadth_score,
      momentum: rocByDate.get(d.trade_date) ?? null,
    }));
  }, [data]);

  if (isLoading && !data) {
    return (
      <div className="glass-card rounded-2xl p-4">
        <h3 className="text-[13px] font-bold text-[var(--text-primary)] mb-1">{title}</h3>
        <DristiQLoader message="Reading breadth…" />
      </div>
    );
  }

  return <RotationGraph points={points} variant="breadth" title={title} levelCenter={50} autoPlay playSeconds={7} />;
}
