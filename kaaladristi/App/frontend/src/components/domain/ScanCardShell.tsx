/**
 * ScanCardShell — shared card chrome for all scanner result cards.
 *
 * Exports:
 *   Avatar           — 42px circle with initials, gold when VaNi
 *   VaniBadge        — "VaNi Highlight" pill tag
 *   ScanCardWrapper  — outer card div (bg, border, flex row, avatar included)
 *   ScanSectionLabel — section divider headers ("✦ VaNi Highlight · N" / "All Results · N")
 *
 * Card body content (DataRows, price columns, evidence strips) stays
 * scan-specific — pass as children to ScanCardWrapper.
 */

import React from 'react';
import VaNiTrigger from './VaNiTrigger';
import type { VaNiEntity } from '@/stores/vaniStore';
import { useStockAskStore } from '@/stores/stockAskStore';

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_PALETTES = [
  { bg: '#1e3a5f', fg: '#7eb8f7' },
  { bg: '#1e3d2f', fg: '#6ecf9a' },
  { bg: '#3b2a1a', fg: '#d4a84b' },
  { bg: '#2d1e3e', fg: '#b07ef7' },
  { bg: '#2a1f1f', fg: '#e07070' },
  { bg: '#1a3040', fg: '#5ec8d8' },
];

export function avatarPalette(symbol: string, isVani: boolean) {
  if (isVani) return { bg: 'var(--gold)', fg: '#1a1410' };
  const idx = symbol.charCodeAt(0) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx];
}

export function Avatar({ symbol, isVani }: { symbol: string; isVani: boolean }) {
  const { bg, fg } = avatarPalette(symbol, isVani);
  return (
    <div style={{
      width: '42px',
      height: '42px',
      borderRadius: '50%',
      background: bg,
      color: fg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-mono)',
      fontSize: '13px',
      fontWeight: 700,
      letterSpacing: '0.02em',
      flexShrink: 0,
      border: isVani ? '1.5px solid var(--gold-soft)' : '1.5px solid var(--border)',
    }}>
      {symbol.slice(0, 2).toUpperCase()}
    </div>
  );
}

// ── Exchange badge ────────────────────────────────────────────────────────────

export function CardExchangeBadge({ exchange }: { exchange: string | null | undefined }) {
  if (!exchange) return null;
  const isNse = exchange === 'NSE';
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: '9px', padding: '2px 5px',
      borderRadius: '4px', letterSpacing: '0.1em', fontWeight: 600, flexShrink: 0,
      background: isNse ? 'rgba(6,182,212,0.12)' : 'rgba(251,191,36,0.12)',
      color: isNse ? '#06b6d4' : '#fbbf24',
      border: `1px solid ${isNse ? 'rgba(6,182,212,0.25)' : 'rgba(251,191,36,0.25)'}`,
    }}>
      {exchange}
    </span>
  );
}

// ── VaNi Highlight badge ────────────────────────────────────────────────────

export function VaniBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '1px 8px',
      background: 'var(--gold-bg)',
      border: '1px solid var(--border-gold)',
      borderRadius: '100px',
      fontFamily: 'var(--font-mono)',
      fontSize: '9px',
      fontWeight: 700,
      letterSpacing: '0.02em',
      color: 'var(--gold)',
      flexShrink: 0,
    }}>
      VaNi Highlight
    </span>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────

interface ScanCardWrapperProps {
  isVani: boolean;
  symbol: string;
  onClick?: () => void;
  children: React.ReactNode;
  /** When set, renders the ✦ Ask-VaNi trigger at the card's right edge. */
  vaniEntity?: VaNiEntity;
}

export function ScanCardWrapper({ isVani, symbol, onClick, children, vaniEntity }: ScanCardWrapperProps) {
  // Card whose "Ask VaNi" popover is open gets an indigo border, same
  // priority-over-gold convention as ScanTable.tsx's row highlight — stays
  // identifiable as the popover's subject through scrolling.
  const isAskActive = useStockAskStore((s) => !!vaniEntity && s.isOpenFor(vaniEntity));
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        background: isVani
          ? 'linear-gradient(135deg, rgba(212,168,75,0.06) 0%, var(--card) 55%)'
          : 'var(--card)',
        border: `1px solid ${isAskActive ? 'var(--border-indigo)' : 'var(--border)'}`,
        borderLeft: isAskActive ? '3px solid var(--indigo)' : isVani ? '3px solid var(--gold)' : '3px solid transparent',
        borderRadius: '12px',
        padding: '12px 16px 12px 14px',
        cursor: onClick ? 'pointer' : undefined,
        transition: 'border-color 0.15s',
      }}
    >
      <Avatar symbol={symbol} isVani={isVani} />
      {children}
      {vaniEntity && <VaNiTrigger entity={vaniEntity} />}
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

export function ScanSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '4px 0 8px',
      fontFamily: 'var(--font-mono)',
      fontSize: '10px',
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.08em',
      color: 'var(--text-faint)',
    }}>
      {children}
    </div>
  );
}
