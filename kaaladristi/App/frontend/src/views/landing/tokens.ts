// DristiQ landing page design tokens — aligned to the product's Vikuna Black
// theme (config/theme/themes/kaaladristi.ts, dark mode) so landing → login →
// app is one continuous surface: amber/antique-gold accents on deep blue-slate.

export const C = {
  bg0: '#0d0f14', bg1: '#13161d', bg2: '#1c2030',
  ink1: '#e8e6e0', ink2: '#b7bcc9', ink3: '#7a8099', ink4: '#3a3f52',
  g1: '#f5a623', g2: '#c9a24b', g3: '#8a7433',
  glow: 'rgba(245,166,35,.25)',
  rule: 'rgba(245,166,35,.16)',
  rs: 'rgba(245,166,35,.07)', // rule-soft
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
