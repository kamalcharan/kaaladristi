/**
 * Filing READ vocabulary — km_filing_reads (migration 229) and the admin's
 * second opinion, km_filing_read_checks (migration 233).
 *
 * Constants-first: every label and colour a filing verdict renders with lives
 * here. The DB CHECK constraints are the source of truth for the keys.
 *
 * ⚠ A verdict is the filing's impact on the COMPANY as the document states
 * it — never a price forecast. The labels say "for the company" on purpose.
 */

export type ReadImpact = 'positive' | 'negative' | 'neutral' | 'unclear';
export type ReadMagnitude = 'major' | 'notable' | 'minor' | 'unknown';
/** km_filing_reads.status — the row's own clock. */
export type ReadStatus = 'pending' | 'reading' | 'done' | 'failed' | 'unreadable' | 'skipped';
export type CheckBackend = 'anthropic' | 'local';

export const IMPACT_LABELS: Record<ReadImpact, { label: string; color: string }> = {
  positive: { label: 'Positive', color: 'text-risk-green' },
  negative: { label: 'Negative', color: 'text-risk-red' },
  neutral:  { label: 'Neutral',  color: 'text-muted' },
  unclear:  { label: 'Unclear',  color: 'text-risk-amber' },
};

export const MAGNITUDE_LABELS: Record<ReadMagnitude, string> = {
  major: 'major', notable: 'notable', minor: 'minor', unknown: 'size unknown',
};

/**
 * Owner's four states (2026-09-29): planned (to run) · running · failed
 * (Restart) · outcome. `unreadable` and `skipped` are two kinds of "will not
 * run" and are named as such rather than folded into failed — a skipped row
 * was LOOKED AT and judged not worth a read; a failed one was not read.
 */
export const READ_STATUS_LABELS: Record<ReadStatus, { label: string; color: string; restartable: boolean }> = {
  pending:    { label: 'Planned',    color: 'text-muted',       restartable: false },
  reading:    { label: 'Reading…',   color: 'text-[var(--accent)]', restartable: false },
  done:       { label: 'Read',       color: 'text-primary',     restartable: false },
  failed:     { label: 'Failed',     color: 'text-risk-red',    restartable: true },
  unreadable: { label: 'Unreadable', color: 'text-risk-amber',  restartable: true },
  skipped:    { label: 'Not read',   color: 'text-muted',       restartable: true },
};

export const BACKEND_LABELS: Record<CheckBackend, string> = {
  anthropic: 'Haiku',
  local: 'Qwen',
};

/** Which backend a stored `model` label came from (mirrors lib/filing_checks.py). */
export function backendOfModel(model: string | null | undefined): CheckBackend {
  return (model ?? '').startsWith('local:') ? 'local' : 'anthropic';
}

/** The backend that would give a SECOND opinion on a read by `model`. */
export function otherBackend(model: string | null | undefined): CheckBackend {
  return backendOfModel(model) === 'local' ? 'anthropic' : 'local';
}
