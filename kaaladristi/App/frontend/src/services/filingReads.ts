/**
 * Filing reads for a page of events — the verdict the reader gave
 * (`km_filing_reads`) and any second opinion an admin asked for
 * (`km_filing_read_checks`, migration 233).
 *
 * Two `in(event_id, …)` reads over PostgREST for the ids on the current page
 * (50 at most), joined in the browser by event id. Never a table scan: the
 * reads table holds one row per material event and grows several times a day.
 *
 * Since migration 238 every filing gets a row with a tier: routine (settled
 * by its exchange label, model 'rule', no model call), high, or low. Filings
 * before FILING_READ_FROM that were never read are `skipped`, "not analysed".
 * An event with no row at all has simply not been queued yet.
 */

import { from } from './postgrest';
import type { CheckBackend, ReadImpact, ReadMagnitude, ReadStatus, ReadTier } from '@/constants/filingReads';

export interface FilingRead {
  eventId: number;
  status: ReadStatus;
  attempts: number;
  lastError: string | null;
  triageReason: string | null;
  impact: ReadImpact | null;
  magnitude: ReadMagnitude | null;
  headline: string | null;
  reasoning: string | null;
  evidenceQuote: string | null;
  confidence: number | null;
  amountValue: number | null;
  amountUnit: string | null;
  role: string | null;
  model: string | null;
  readSource: string | null;
  pagesRead: number | null;
  pageCount: number | null;
  finishedAt: string | null;
  /** Migration 238 — null until it is applied. */
  tier: ReadTier | null;
  touches: string | null;
  companyView: string | null;
  timeframe: string | null;
  watchNext: string | null;
}

export interface FilingReadCheck {
  eventId: number;
  backend: CheckBackend;
  status: 'pending' | 'running' | 'done' | 'failed';
  lastError: string | null;
  impact: ReadImpact | null;
  magnitude: ReadMagnitude | null;
  headline: string | null;
  reasoning: string | null;
  evidenceQuote: string | null;
  confidence: number | null;
  model: string | null;
  costUsd: number | null;
  finishedAt: string | null;
}

export interface FilingReadsResult {
  reads: Map<number, FilingRead>;
  /** Every check on an event, keyed by event id (one per backend at most). */
  checks: Map<number, FilingReadCheck[]>;
  failed: boolean;
}

const READ_COLS =
  'event_id,status,attempts,last_error,triage_reason,impact,magnitude,headline,reasoning,evidence_quote,' +
  'confidence,amount_value,amount_unit,role,model,read_source,pages_read,page_count,finished_at';
// Migration 238's columns, asked for separately so a database without them
// still shows every verdict (the select falls back to READ_COLS).
const READ_COLS_V2 = READ_COLS + ',tier,touches,company_view,timeframe,watch_next';
const CHECK_COLS =
  'event_id,backend,status,last_error,impact,magnitude,headline,reasoning,evidence_quote,confidence,model,' +
  'cost_usd,finished_at';

const num = (v: unknown): number | null => (v == null || v === '' ? null : Number(v));
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

export async function fetchFilingReads(eventIds: number[]): Promise<FilingReadsResult> {
  const ids = Array.from(new Set(eventIds)).filter((n) => Number.isFinite(n));
  const reads = new Map<number, FilingRead>();
  const checks = new Map<number, FilingReadCheck[]>();
  if (!ids.length) return { reads, checks, failed: false };

  const [r0, c] = await Promise.all([
    from('km_filing_reads').select(READ_COLS_V2).in('event_id', ids).execute(),
    from('km_filing_read_checks').select(CHECK_COLS).in('event_id', ids).execute(),
  ]);
  const r = r0.error ? await from('km_filing_reads').select(READ_COLS).in('event_id', ids).execute() : r0;

  // The reads table is the one that matters; a missing checks table (233 not
  // yet applied) must not blank the verdict column.
  if (r.error || !r.data) return { reads, checks, failed: true };

  for (const row of r.data as Record<string, unknown>[]) {
    const eventId = Number(row.event_id);
    reads.set(eventId, {
      eventId,
      status: (row.status as ReadStatus) ?? 'pending',
      attempts: Number(row.attempts ?? 0),
      lastError: str(row.last_error),
      triageReason: str(row.triage_reason),
      impact: (row.impact as ReadImpact) ?? null,
      magnitude: (row.magnitude as ReadMagnitude) ?? null,
      headline: str(row.headline),
      reasoning: str(row.reasoning),
      evidenceQuote: str(row.evidence_quote),
      confidence: num(row.confidence),
      amountValue: num(row.amount_value),
      amountUnit: str(row.amount_unit),
      role: str(row.role),
      model: str(row.model),
      readSource: str(row.read_source),
      pagesRead: num(row.pages_read),
      pageCount: num(row.page_count),
      finishedAt: str(row.finished_at),
      tier: (str(row.tier) as ReadTier | null),
      touches: str(row.touches),
      companyView: str(row.company_view),
      timeframe: str(row.timeframe),
      watchNext: str(row.watch_next),
    });
  }

  if (!c.error && c.data) {
    for (const row of c.data as Record<string, unknown>[]) {
      const eventId = Number(row.event_id);
      const list = checks.get(eventId) ?? [];
      list.push({
        eventId,
        backend: (row.backend as CheckBackend) ?? 'anthropic',
        status: (row.status as FilingReadCheck['status']) ?? 'pending',
        lastError: str(row.last_error),
        impact: (row.impact as ReadImpact) ?? null,
        magnitude: (row.magnitude as ReadMagnitude) ?? null,
        headline: str(row.headline),
        reasoning: str(row.reasoning),
        evidenceQuote: str(row.evidence_quote),
        confidence: num(row.confidence),
        model: str(row.model),
        costUsd: num(row.cost_usd),
        finishedAt: str(row.finished_at),
      });
      checks.set(eventId, list);
    }
  }

  return { reads, checks, failed: false };
}
