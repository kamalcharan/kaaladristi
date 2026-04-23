const PIPELINE_API = (import.meta.env.VITE_PIPELINE_API_URL?.trim() || 'http://localhost:8101');

export interface PanchangNote {
  id: number;
  trade_date: string;
  calendar_label: PanchangCalendarLabel;
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
  nakshatra_next: string | null;
  nakshatra_change_time: string | null;
  nak_lord: string;
  net_signal: string | null;
  net_score: number | null;
  turning_date: boolean | null;
  notes: PanchangNote[];
}

export type PanchangScope = 'market' | 'sector' | 'commodity' | 'planet' | 'currency';
export type PanchangCalendarLabel =
  | 'POSITIVE'
  | 'NEGATIVE'
  | 'VOLATILE'
  | 'MAJOR_POSITIVE'
  | 'SUDDEN_SPURT';

export const CALENDAR_LABEL_OPTIONS: { value: PanchangCalendarLabel; label: string }[] = [
  { value: 'POSITIVE',      label: 'Positive'       },
  { value: 'NEGATIVE',      label: 'Negative'       },
  { value: 'VOLATILE',      label: 'Volatile'       },
  { value: 'MAJOR_POSITIVE',label: 'Major Positive' },
  { value: 'SUDDEN_SPURT',  label: 'Sudden Spurt'   },
];

export const SCOPE_OPTIONS: { value: PanchangScope; label: string }[] = [
  { value: 'market',    label: 'Market'    },
  { value: 'sector',    label: 'Sector'    },
  { value: 'commodity', label: 'Commodity' },
  { value: 'planet',    label: 'Planet'    },
  { value: 'currency',  label: 'Currency'  },
];

export const LABEL_COLOR: Record<PanchangCalendarLabel, string> = {
  POSITIVE:       'text-risk-green',
  NEGATIVE:       'text-risk-red',
  VOLATILE:       'text-risk-amber',
  MAJOR_POSITIVE: 'text-risk-green',
  SUDDEN_SPURT:   'text-risk-amber',
};

export const LABEL_BG: Record<PanchangCalendarLabel, string> = {
  POSITIVE:       'bg-risk-green/10 border-risk-green/30',
  NEGATIVE:       'bg-risk-red/10 border-risk-red/30',
  VOLATILE:       'bg-risk-amber/10 border-risk-amber/30',
  MAJOR_POSITIVE: 'bg-risk-green/20 border-risk-green/40',
  SUDDEN_SPURT:   'bg-risk-amber/20 border-risk-amber/40',
};

export async function fetchPanchangCalendar(year: number, month: number): Promise<PanchangRow[]> {
  const res = await fetch(`${PIPELINE_API}/api/panchang/calendar?year=${year}&month=${month}`);
  if (!res.ok) throw new Error(`[panchang/calendar] HTTP ${res.status}`);
  return res.json();
}

export interface NotePayload {
  trade_date: string;
  calendar_label: PanchangCalendarLabel;
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
