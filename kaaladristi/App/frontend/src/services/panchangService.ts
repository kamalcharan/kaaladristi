import { from } from './postgrest';
import {
  type MarketImpact,
  SIGNAL_LABELS,
  impactToColor,
  SIGNAL_CLASSES,
  IMPACT_OPTIONS,
} from '@/constants/signalScale';

const PIPELINE_API = (import.meta.env.VITE_PIPELINE_API_URL?.trim() || '');

// Re-export so callers can use the canonical scale directly
export type { MarketImpact };
export { SIGNAL_LABELS, impactToColor, SIGNAL_CLASSES, IMPACT_OPTIONS };

export interface PanchangNote {
  id: number;
  trade_date: string;
  calendar_label: MarketImpact;
  scope: PanchangScope;
  scope_value: string | null;
  annotation: string | null;
  sort_order: number;
}

export interface PanchangRow {
  trade_date: string;
  weekday: string;
  tithi: string;
  tithi_end_time: string | null;
  moon_rashi: string;
  moon_rashi_next: string | null;
  moon_rashi_change_time: string | null;
  nakshatra: string;
  nakshatra_end_time: string | null;
  nakshatra_next: string | null;
  nakshatra_change_time: string | null;
  nak_lord: string;
  net_signal: string | null;
  net_score: number | null;
  turning_date: boolean | null;
  notes: PanchangNote[];
}

export type PanchangScope = 'market' | 'sector' | 'commodity' | 'planet' | 'currency';

export const SCOPE_OPTIONS: { value: PanchangScope; label: string }[] = [
  { value: 'market',    label: 'Market'    },
  { value: 'sector',    label: 'Sector'    },
  { value: 'commodity', label: 'Commodity' },
  { value: 'planet',    label: 'Planet'    },
  { value: 'currency',  label: 'Currency'  },
];

// ── Sector list from DB ────────────────────────────────────────────────────────

export async function fetchSectors(): Promise<string[]> {
  const { data, error } = await from('km_industry_eod')
    .select('industry')
    .order('industry', { ascending: true })
    .execute();
  if (error) throw new Error(`[fetchSectors] ${error.message}`);
  // deduplicate
  const rows = (data ?? []) as { industry: string }[];
  return [...new Set(rows.map(r => r.industry))].filter(Boolean).sort();
}

// ── API functions ──────────────────────────────────────────────────────────────

export async function fetchPanchangCalendar(year: number, month: number): Promise<PanchangRow[]> {
  const res = await fetch(`${PIPELINE_API}/api/panchang/calendar?year=${year}&month=${month}`);
  if (!res.ok) throw new Error(`[panchang/calendar] HTTP ${res.status}`);
  return res.json();
}

export interface NotePayload {
  trade_date: string;
  calendar_label: MarketImpact;
  scope: PanchangScope;
  scope_value?: string | null;
  annotation?: string | null;
  sort_order?: number;
}

export async function createPanchangNote(payload: NotePayload): Promise<{ id: number }> {
  const res = await fetch(`${PIPELINE_API}/api/panchang/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`[create panchang note] HTTP ${res.status}`);
  return res.json();
}

export async function updatePanchangNote(id: number, payload: NotePayload): Promise<void> {
  const res = await fetch(`${PIPELINE_API}/api/panchang/notes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`[update panchang note] HTTP ${res.status}`);
}

export async function deletePanchangNote(id: number): Promise<void> {
  const res = await fetch(`${PIPELINE_API}/api/panchang/notes/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`[delete panchang note] HTTP ${res.status}`);
}

export interface GenerateResult {
  upserted: number;
  errors: string[];
}

export async function generatePanchangMonth(year: number, month: number): Promise<GenerateResult> {
  const res = await fetch(
    `${PIPELINE_API}/api/panchang/generate?year=${year}&month=${month}`,
    { method: 'POST' },
  );
  if (!res.ok) throw new Error(`[panchang/generate] HTTP ${res.status}`);
  return res.json();
}
