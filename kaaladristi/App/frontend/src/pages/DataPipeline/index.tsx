import { useState } from 'react';
import HealthGrid from './HealthGrid';
import JobQueue from './JobQueue';
import RunPanel from './RunPanel';

export interface CellSelection {
  dimension: string;
  tradeDate: string;
}

export default function DataPipelinePage() {
  const [selection, setSelection] = useState<CellSelection | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const onJobEnqueued = () => {
    // Flip key so Panel B switches to fast-poll immediately.
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="space-y-4">
      <header className="pb-2 border-b border-kd-border/30">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Data Pipeline v2</h1>
        <p className="text-xs text-muted mt-0.5">
          Ground-truth fill-rate monitoring & targeted fixes. Parallel to
          legacy <span className="mono">/settings → Data Pipeline</span>.
        </p>
      </header>

      <section>
        <h2 className="text-sm font-medium text-secondary mb-2">Health · 30 trading days</h2>
        <HealthGrid onCellSelect={setSelection} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <h2 className="text-sm font-medium text-secondary mb-2">Jobs</h2>
          <JobQueue refreshKey={refreshKey} />
        </div>
        <div>
          <h2 className="text-sm font-medium text-secondary mb-2">Run / Fix</h2>
          <RunPanel selection={selection} onEnqueued={onJobEnqueued} />
        </div>
      </section>
    </div>
  );
}
