/**
 * DataCoverageCards — admin-only panel on the Study → Data tab.
 *
 * Three cards, in the order that matters, because they answer different
 * questions and a single "quality score" would hide which one is wrong:
 *
 *   Coverage    — history we never ingested (listing vs our first bar, and
 *                 sessions the exchange traded that we hold no bar for)
 *   Depth       — history we hold but never enriched (per-column first date)
 *   Defects     — bars we hold that are wrong rather than absent
 */

import { useQuery } from '@tanstack/react-query';
import { Database, Layers, AlertTriangle } from 'lucide-react';
import { fetchDataCoverage, fetchColumnDepth } from '@/services/dataTab';
import { getLabel } from '@/config/fieldConfig';
import { prettifyKey } from '@/config/dataColumns';

const STALE = 5 * 60 * 1000;

/** The columns whose depth actually gates something downstream. Showing all
 *  145 first-dates is a wall; these are the ones that decide whether a stock
 *  is usable — ema_20 above all, because every scanner drops null-ema_20 rows,
 *  so it caps scanner history no matter how deep the prices go. */
const DEPTH_COLUMNS = [
  'close', 'volume', 'ema_20', 'sma_50', 'sma_150', 'sma_200',
  'rsi_14', 'atr_14', 'magic_rs', 'delivery_pct', 'stage', 'score_5d',
];

/** Columns a scanner will not run without. "Usable from" is the latest of
 *  their first dates — the chain is only as deep as its shallowest link. */
const SCANNER_CRITICAL = ['ema_20', 'sma_150', 'magic_rs', 'stage'];

function label(col: string): string {
  const l = getLabel(col);
  return l === col ? prettifyKey(col) : l;
}

function Card({ icon, title, children }: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-kd-card border border-kd-border p-3">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[11px] font-serif font-semibold text-primary tracking-wide">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: 'bull' | 'bear' | 'muted' }) {
  const color =
    tone === 'bull' ? 'var(--bull)' : tone === 'bear' ? 'var(--bear)' : 'var(--text-secondary)';
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-[10px] font-mono text-muted">{k}</span>
      <span className="text-[10px] font-mono tabular-nums" style={{ color }}>{v}</span>
    </div>
  );
}

export default function DataCoverageCards({ equityId }: { equityId: number }) {
  const { data: cov } = useQuery({
    queryKey: ['data-coverage', equityId],
    queryFn: () => fetchDataCoverage(equityId),
    enabled: !!equityId,
    staleTime: STALE,
  });
  const { data: depth } = useQuery({
    queryKey: ['data-depth', equityId],
    queryFn: () => fetchColumnDepth(equityId, DEPTH_COLUMNS),
    enabled: !!equityId,
    staleTime: STALE,
  });

  if (!cov) return null;

  const completePct =
    cov.expectedBars != null && cov.expectedBars > 0
      ? (cov.actualBars / cov.expectedBars) * 100
      : null;

  const byCol = new Map((depth ?? []).map((d) => [d.column, d]));
  const usableFrom = SCANNER_CRITICAL
    .map((c) => byCol.get(c)?.firstDate)
    .filter((d): d is string => !!d)
    .sort()
    .pop() ?? null;
  const missingCritical = SCANNER_CRITICAL.filter((c) => !byCol.get(c)?.firstDate);

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card icon={<Database className="w-3.5 h-3.5 text-accent-indigo" />} title="Coverage">
        <Row k="Exchange" v={cov.exchange ?? '—'} />
        <Row k="Listed" v={cov.listingDate ?? 'unknown'} tone={cov.listingDate ? undefined : 'muted'} />
        <Row k="Our data from" v={cov.firstTradeDate ?? '—'} />
        <Row k="Through" v={cov.lastTradeDate ?? '—'} />
        {/* Null, not zero, when listing_date is absent — 63% of BSE rows.
            "Unknown" is the honest answer; "0 years missing" is a claim. */}
        <Row
          k="Missing before start"
          v={cov.yearsMissingAtStart == null
            ? 'unknown — no listing date'
            : cov.yearsMissingAtStart === 0 ? 'none' : `${cov.yearsMissingAtStart} yr`}
          tone={cov.yearsMissingAtStart == null ? 'muted'
              : cov.yearsMissingAtStart > 1 ? 'bear' : 'bull'}
        />
        <Row
          k="Sessions held"
          v={cov.expectedBars == null
            ? `${cov.actualBars.toLocaleString()}`
            : `${cov.actualBars.toLocaleString()} / ${cov.expectedBars.toLocaleString()}`}
        />
        {completePct != null && (
          <Row
            k="Complete"
            v={`${completePct.toFixed(1)}%`}
            tone={completePct >= 99 ? 'bull' : completePct >= 95 ? undefined : 'bear'}
          />
        )}
        {cov.deeperTwin && (
          <p className="mt-2 text-[9px] font-mono text-muted leading-relaxed">
            {cov.deeperTwin.exchange} twin {cov.deeperTwin.symbol} holds history from{' '}
            {cov.deeperTwin.firstTradeDate} — deeper than this listing.
          </p>
        )}
      </Card>

      <Card icon={<Layers className="w-3.5 h-3.5 text-accent-indigo" />} title="Enrichment depth">
        {!depth && <p className="text-[10px] font-mono text-muted">Reading…</p>}
        {depth && depth.map((d) => (
          <Row
            key={d.column}
            k={label(d.column)}
            v={d.firstDate ?? 'never'}
            tone={d.firstDate ? undefined : 'bear'}
          />
        ))}
        {depth && (
          <p className="mt-2 pt-2 border-t border-kd-border text-[9px] font-mono leading-relaxed"
             style={{ color: 'var(--text-secondary)' }}>
            {missingCritical.length > 0
              ? `Not scanner-usable — ${missingCritical.map(label).join(', ')} never populated.`
              : usableFrom
              ? <>Scanner-usable from <strong>{usableFrom}</strong>. Prices go back to {cov.firstTradeDate}.</>
              : 'Scanner usability unknown.'}
          </p>
        )}
      </Card>

      <DefectsCard equityId={equityId} />
    </div>
  );
}

/** Bars we hold that are wrong rather than missing. A fill-rate never shows
 *  these: the column is populated, the value is just not usable. */
function DefectsCard({ equityId }: { equityId: number }) {
  const { data: raw } = useQuery({
    queryKey: ['data-defect-rows', equityId],
    queryFn: async () => {
      const { from } = await import('@/services/postgrest');
      const { data } = await from('km_equity_eod')
        .select('trade_date,volume,close,prev_close,stage')
        .eq('equity_id', equityId)
        .order('trade_date', { ascending: true })
        .limit(20000)
        .execute();
      return (data ?? []) as Record<string, any>[];
    },
    enabled: !!equityId,
    staleTime: STALE,
  });

  if (!raw) return null;

  // Weinstein stage needs sma_200, so the first ~200 bars of ANY stock are
  // legitimately UNKNOWN. Counting those as a defect would put a red number on
  // every deep stock on day one — RELIANCE and INDUSINDBK each show exactly 199,
  // all of them inside the warm-up, none after. A card that cries wolf gets
  // ignored, so only UNKNOWN bars PAST the warm-up count.
  const STAGE_WARMUP_BARS = 200;
  let zeroVol = 0, unknownStage = 0, unknownWarmup = 0, cliffs = 0;
  raw.forEach((r, i) => {
    if (Number(r.volume) === 0) zeroVol += 1;
    if (r.stage === 'UNKNOWN') {
      if (i < STAGE_WARMUP_BARS) unknownWarmup += 1;
      else unknownStage += 1;
    }
    // The same test adjust_close_cliffs uses: a single-day move outside
    // 0.55x-1.80x is impossible under NSE's +/-20% band, so it is a corporate
    // action the raw feed never adjusted for.
    const c = Number(r.close), p = Number(r.prev_close);
    if (p > 0 && c > 0) {
      const ratio = c / p;
      if (ratio < 0.55 || ratio > 1.8) cliffs += 1;
    }
  });
  const total = raw.length;
  const pct = (n: number) => (total ? `${n} (${((n / total) * 100).toFixed(1)}%)` : String(n));

  return (
    <Card icon={<AlertTriangle className="w-3.5 h-3.5 text-risk-amber" />} title="Defects">
      <Row k="Bars scanned" v={total.toLocaleString()} />
      <Row k="No-trade sessions" v={pct(zeroVol)} tone={zeroVol ? 'bear' : 'bull'} />
      <Row
        k="Stage UNKNOWN"
        v={unknownStage === 0 && unknownWarmup > 0
          ? `none (${unknownWarmup} in warm-up)`
          : pct(unknownStage)}
        tone={unknownStage ? 'bear' : 'bull'}
      />
      <Row k="Unadjusted cliffs" v={String(cliffs)} tone={cliffs ? 'bear' : 'bull'} />
      {cliffs > 0 && (
        <p className="mt-2 text-[9px] font-mono text-muted leading-relaxed">
          Single-day moves outside 0.55x–1.80x. Impossible under the price band, so these are
          splits or bonuses the feed never adjusted — km_corporate_actions is empty.
        </p>
      )}
    </Card>
  );
}
