export const MONTH_ABBR  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const MONTH_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const DAY_ABBR    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']; // Mon-first

/** Format ISO date string → DD-MMM-YYYY (e.g. 04-Apr-2026) */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}-${MONTH_ABBR[+m - 1]}-${y}`;
}

/** Format ISO date string → DD-MMM (e.g. 04-Apr) */
export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [, m, d] = iso.split('-');
  return `${d}-${MONTH_ABBR[+m - 1]}`;
}

/** Build ISO date string from parts */
export function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Number of days in a given month */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * First day-of-week offset for the 1st of the month.
 * Returns 0 for Monday, 6 for Sunday (Mon-first grid).
 */
export function getFirstWeekdayOffset(year: number, month: number): number {
  const jsDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  return jsDay === 0 ? 6 : jsDay - 1;
}

/** Today as ISO string */
export function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}
