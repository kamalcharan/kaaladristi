// DristiQ landing page design tokens — pixel-perfect to reference

export const C = {
  bg0: '#07070c', bg1: '#0a0a12', bg2: '#0d0d1a',
  ink1: '#f4ecd6', ink2: '#d9cfb6', ink3: '#8a8372', ink4: '#50493c',
  g1: '#e2b96f', g2: '#c9a84c', g3: '#8a6f28',
  glow: 'rgba(226,185,111,.28)',
  rule: 'rgba(226,185,111,.18)',
  rs: 'rgba(226,185,111,.08)', // rule-soft
} as const;

export const SERIF = "'Cormorant Garamond','Playfair Display',serif";
export const MONO  = "'JetBrains Mono','Geist Mono',ui-monospace,monospace";
export const SANS  = "'DM Sans','Inter',system-ui,sans-serif";

export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function formatPaksha(paksha: string): string {
  const p = paksha.toLowerCase();
  if (p.includes('shukla') || p === 's') return 'Śukla Pakṣa';
  if (p.includes('krishna') || p.includes('krsna') || p === 'k') return 'Kṛṣṇa Pakṣa';
  return paksha;
}
