import React, { useEffect, useRef, useState } from 'react';
import type { ScanStock } from '@/types';
import { Avatar, ScanCardWrapper, VaniBadge, ScanSectionLabel, CardExchangeBadge } from './ScanCardShell';
import BookmarkToggle from './BookmarkToggle';
import VaNiTrigger from './VaNiTrigger';
import { displaySymbol } from '@/lib/symbolUtils';
import { getColor } from '@/config/fieldConfig';
import { DOT_LABELS, zoneLabel, flowLabel } from '@/constants/signalScale';
import { useIsPhone } from '@/hooks/useMediaQuery';
import { levelValue, type StudioDescriptor, type StudioLevel } from '@/config/scannerStudio';

/**
 * Scanner Studio cards — the "Option B+E" design frozen 2026-09-07
 * (docs/claude/scanner-gap-audit-2026-09-06.md §9; canvas "Scanner Studio
 * Cards", page Main). Three fixed rows on every Studio:
 *
 *   1. Signal band — VaNi, relative-strength band, order flow, SVD/SBD/SYD
 *      dots, RSI state. The qualitative read, in D39 vocabulary only.
 *   2. Ledger — identity on the left, four slots in fixed positions in the
 *      middle (the scan's own metric first and largest · level · level ·
 *      RVOL), price on the right. Same slot, same meaning on every scanner.
 *   3. Score 5D against Score 22D as two bars, so "accelerating" is visible
 *      rather than computed.
 *
 * The slots come from the descriptor (`cardHero`, `cardLevels`); nothing
 * here knows which preset it is rendering. On a phone the ledger becomes a
 * 2×2 grid and the identity row carries the avatar and the ✦ trigger itself
 * (ScanCardWrapper `bare`).
 */

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtPrice(n: number | null | undefined): string {
  if (n == null) return '—';
  return n >= 1000
    ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n.toFixed(2);
}

function fmtSignedPct(n: number | null | undefined): string {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function fmtCount(n: number | null | undefined): string {
  if (n == null) return '—';
  return Math.round(n).toString();
}

function fmtRvol(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toFixed(1) + '×';
}

function fmtScore(n: number | null | undefined): string {
  if (n == null) return '—';
  return Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1);
}

function fmtMcap(n: number | null | undefined): string | null {
  if (n == null || n <= 0) return null;
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`;
}

function fmtLevel(lvl: StudioLevel, v: number | null | undefined): string {
  if (lvl.kind === 'price') return fmtPrice(v);
  if (lvl.kind === 'count') return fmtCount(v);
  return fmtSignedPct(v);
}

// ── Colors ────────────────────────────────────────────────────────────────────

function pctColor(n: number | null | undefined, threshold = 1.5): string {
  if (n == null) return 'var(--text-secondary)';
  if (n > threshold) return 'var(--bull)';
  if (n < -threshold) return 'var(--bear)';
  return 'var(--text-secondary)';
}

function levelColor(lvl: StudioLevel, v: number | null | undefined): string {
  if (!lvl.colorKey || v == null) return 'var(--text-primary)';
  return getColor(lvl.colorKey, v);
}

// Same pill palette StockCard uses for its signal pills, so a Leading pill
// reads the same on a Studio card as on a generic one.
function pillStyle(color: string): React.CSSProperties {
  const bull = color === 'var(--bull)';
  const bear = color === 'var(--bear)';
  return {
    display: 'inline-flex', alignItems: 'center',
    padding: '3px 8px',
    fontFamily: 'var(--font-mono)', fontSize: '10.5px',
    borderRadius: '5px', fontWeight: 500,
    whiteSpace: 'nowrap' as const,
    background: bull ? 'var(--bull-bg)' : bear ? 'var(--bear-bg)' : 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
    color: bull ? 'var(--bull)' : bear ? 'var(--bear)' : 'var(--text-muted)',
    border: `1px solid ${bull ? 'var(--bull-dim)' : bear ? 'var(--bear-dim)' : 'var(--border)'}`,
  };
}

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '9px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: 'var(--text-faint)',
  whiteSpace: 'nowrap' as const,
};

// ── Atoms ─────────────────────────────────────────────────────────────────────

function DotTag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, color, whiteSpace: 'nowrap' as const }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

/** One ledger slot: label above value. The hero is the first slot, larger
 *  and bolder; every other slot is the same size so nothing competes. */
function Cell({ label, value, color, hero = false, first = false }: {
  label: string; value: string; color?: string; hero?: boolean; first?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column' as const, gap: '3px', minWidth: 0,
      padding: first ? '0 14px 0 0' : '0 14px',
      borderLeft: first ? 'none' : '1px solid var(--border)',
    }}>
      <span style={LABEL_STYLE}>{label}</span>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: hero ? '22px' : '14px',
        fontWeight: hero ? 700 : 500,
        lineHeight: 1.1,
        color: color ?? 'var(--text-primary)',
        whiteSpace: 'nowrap' as const,
      }}>
        {value}
      </span>
    </div>
  );
}

function ScoreBar({ label, value, max, color }: { label: string; value: number | null | undefined; max: number; color: string }) {
  const pct = value == null ? 0 : Math.max(6, Math.min(100, Math.round((100 * value) / max)));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ ...LABEL_STYLE, width: '64px', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: '6px', background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)', borderRadius: '3px', position: 'relative' }}>
        {value != null && (
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: color, borderRadius: '3px' }} />
        )}
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', width: '44px', textAlign: 'right' as const, flexShrink: 0 }}>
        {fmtScore(value)}
      </span>
    </div>
  );
}

// ── Rows ──────────────────────────────────────────────────────────────────────

/** Row 1 — the qualitative read. Every pill is a label the app already
 *  shows elsewhere (ZONE_LABELS / FLOW_LABELS / DOT_LABELS), so no new
 *  vocabulary is introduced here. */
function SignalBand({ stock, descriptor }: { stock: ScanStock; descriptor: StudioDescriptor }) {
  const zone = stock.magic_rs_zone ? zoneLabel(stock.magic_rs_zone) : null;
  const zoneColor = getColor('magic_rs', stock.magic_rs, stock);
  const flow = stock.flow_type ? flowLabel(stock.flow_type) : null;
  const flowColor = getColor('flow_type', stock.flow_type);
  const rsi = stock.rsi_14;
  // The descriptor's own RSI gate, read the other way round: a strength scan
  // filters out the extended names, so failing that gate is "overbought";
  // on the caution side the mirror is "oversold".
  const rsiNote = rsi != null && !descriptor.rsiQuick.test(stock)
    ? (descriptor.side === 'strength' ? 'overbought' : 'oversold')
    : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' as const }}>
      {stock.vaniOpportunity && <VaniBadge />}
      {zone && <span style={pillStyle(zoneColor)}>{zone.label}</span>}
      {flow && <span style={pillStyle(flowColor)}>{flow.label}</span>}
      {stock.has_recent_svd && <DotTag label="SVD" color={DOT_LABELS.SVD.color} />}
      {stock.has_recent_sbd && <DotTag label="SBD" color={DOT_LABELS.SBD.color} />}
      {stock.has_recent_syd && <DotTag label="SYD" color={DOT_LABELS.SYD.color} />}
      {rsi != null && (
        <span style={pillStyle(rsiNote ? getColor('rsi_14', rsi) : 'var(--text-muted)')}>
          RSI {rsi.toFixed(0)}{rsiNote ? ` · ${rsiNote}` : ''}
        </span>
      )}
    </div>
  );
}

function Identity({ stock, wrap }: { stock: ScanStock; wrap: boolean }) {
  const isVani = stock.vaniOpportunity;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexWrap: wrap ? 'wrap' as const : 'nowrap' as const }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, letterSpacing: '-0.01em',
        color: isVani ? 'var(--gold)' : 'var(--text-primary)', flexShrink: 0,
      }}>
        {displaySymbol(stock)}
      </span>
      <CardExchangeBadge exchange={stock.exchange} />
      {stock.company_name && (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, minWidth: 0 }}>
          {stock.company_name}
        </span>
      )}
    </div>
  );
}

function IndustryLine({ stock }: { stock: ScanStock }) {
  const parts = [stock.industry, fmtMcap(stock.mcap_cr)].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, minWidth: 0 }}>
      {parts.join(' · ')}
    </span>
  );
}

function PriceRail({ stock, inline = false }: { stock: ScanStock; inline?: boolean }) {
  const dPct = stock.d_pct ?? stock.pct_chng;
  return (
    <span style={{
      display: 'flex',
      flexDirection: inline ? 'row' as const : 'column' as const,
      alignItems: inline ? 'baseline' : 'flex-end',
      gap: inline ? '8px' : '4px',
      flexShrink: 0,
      minWidth: inline ? undefined : '92px',
      marginLeft: 'auto',
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: inline ? '14px' : '15px', fontWeight: 500, color: 'var(--text-primary)' }}>
        ₹{fmtPrice(stock.close)}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: pctColor(dPct) }}>
        {fmtSignedPct(dPct)}
      </span>
    </span>
  );
}

/** Row 3 — both scores drawn against the larger of the two, so the eye
 *  reads "5D ahead of 22D" (accelerating) without arithmetic. Hidden when
 *  neither score exists rather than drawing two empty tracks. */
function ScoreBars({ stock }: { stock: ScanStock }) {
  const s5 = stock.score_5d ?? null;
  const s22 = stock.score_22d ?? null;
  if (s5 == null && s22 == null) return null;
  const max = Math.max(s5 ?? 0, s22 ?? 0, 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '4px' }}>
      <ScoreBar label="Score 5D" value={s5} max={max} color="var(--gold)" />
      <ScoreBar label="Score 22D" value={s22} max={max} color="color-mix(in srgb, var(--gold) 45%, transparent)" />
    </div>
  );
}

function BookmarkStar({ stock }: { stock: ScanStock }) {
  // BookmarkToggle stops propagation itself; the span is here so the
  // click target is not the card even in the padding around the icon.
  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', flexShrink: 0 }}>
      <BookmarkToggle equityId={stock.equity_id} size={14} />
    </span>
  );
}

/** Width of the ledger's container, so the four slots can drop to a 2×2
 *  grid deliberately (hero beside RVOL, levels beneath — the phone order)
 *  instead of flex-wrapping mid-row with a stray divider. At 1280px with
 *  both sidebars open the results column is ~730px, which is where this
 *  fires; on a wide desktop the ledger stays a single line. */
function useNarrow(ref: React.RefObject<HTMLDivElement | null>, below: number): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < below));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, below]);
  return narrow;
}

// ── Card ──────────────────────────────────────────────────────────────────────

function StudioCard({ stock, descriptor, onClick }: { stock: ScanStock; descriptor: StudioDescriptor; onClick?: () => void }) {
  const phone = useIsPhone();
  const ledgerRef = useRef<HTMLDivElement>(null);
  const narrow = useNarrow(ledgerRef, 420);
  const isVani = stock.vaniOpportunity;
  const vaniEntity = { type: 'equity' as const, id: stock.equity_id, symbol: displaySymbol(stock), pageContext: `Scanner / ${descriptor.displayName}` };

  const hero = descriptor.cardHero;
  const heroV = levelValue(hero, stock);
  const [l1, l2] = descriptor.cardLevels;
  const l1V = levelValue(l1, stock);
  const l2V = levelValue(l2, stock);

  const heroCell = <Cell label={hero.label} value={fmtLevel(hero, heroV)} color={levelColor(hero, heroV)} hero first />;
  const l1Cell = (first = false) => <Cell label={l1.label} value={fmtLevel(l1, l1V)} color={levelColor(l1, l1V)} first={first} />;
  const l2Cell = <Cell label={l2.label} value={fmtLevel(l2, l2V)} color={levelColor(l2, l2V)} />;
  const rvolCell = <Cell label="RVOL" value={fmtRvol(stock.rvol)} color={getColor('rvol', stock.rvol)} />;

  if (phone) {
    return (
      <ScanCardWrapper isVani={isVani} symbol={stock.symbol} onClick={onClick} vaniEntity={vaniEntity} bare>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' as const, gap: '9px' }}>
          {/* Identity row carries the avatar, the star and the ✦ trigger —
              the wrapper is bare on a phone so the ledger below gets the
              full card width. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <Avatar symbol={stock.symbol} isVani={isVani} />
            <div style={{ flex: 1, minWidth: 0 }}><Identity stock={stock} wrap={false} /></div>
            <BookmarkStar stock={stock} />
            <VaNiTrigger entity={vaniEntity} />
          </div>
          <SignalBand stock={stock} descriptor={descriptor} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', minWidth: 0 }}>
            <IndustryLine stock={stock} />
            <PriceRail stock={stock} inline />
          </div>
          {/* 2×2: hero beside RVOL, the two levels beneath — the two numbers
              that decide the glance stay on the first line. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px 0' }}>
            {heroCell}
            {rvolCell}
            {l1Cell(true)}
            {l2Cell}
          </div>
          <ScoreBars stock={stock} />
        </div>
      </ScanCardWrapper>
    );
  }

  return (
    <ScanCardWrapper isVani={isVani} symbol={stock.symbol} onClick={onClick} vaniEntity={vaniEntity}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' as const, gap: '9px' }}>
        <SignalBand stock={stock} descriptor={descriptor} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '4px', minWidth: '140px', width: '236px', flexShrink: 1 }}>
            <Identity stock={stock} wrap={false} />
            <IndustryLine stock={stock} />
          </div>
          <div
            ref={ledgerRef}
            style={narrow
              ? { flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, max-content))', gap: '10px 0', justifyContent: 'start' }
              : { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}
          >
            {narrow ? <>{heroCell}{rvolCell}{l1Cell(true)}{l2Cell}</> : <>{heroCell}{l1Cell()}{l2Cell}{rvolCell}</>}
          </div>
          <PriceRail stock={stock} />
        </div>
        <ScoreBars stock={stock} />
      </div>
      <BookmarkStar stock={stock} />
    </ScanCardWrapper>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function BreakoutSurgeCards({ stocks, descriptor, onRowClick }: { stocks: ScanStock[]; descriptor: StudioDescriptor; onRowClick?: (s: ScanStock) => void }) {
  const vani = stocks.filter((s) => s.vaniOpportunity);
  const rest = stocks.filter((s) => !s.vaniOpportunity);

  if (stocks.length === 0) {
    return (
      <div style={{
        padding: '48px 24px', textAlign: 'center',
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: '12px', color: 'var(--text-muted)', fontSize: '14px',
      }}>
        {`No stocks match ${descriptor.displayName} criteria today.`}
      </div>
    );
  }

  const render = (s: ScanStock) => (
    <StudioCard descriptor={descriptor} key={s.equity_id} stock={s} onClick={onRowClick ? () => onRowClick(s) : undefined} />
  );

  return (
    <div data-qa="studio-cards">
      {vani.length > 0 && (
        <>
          {/* No rule text here: each Studio has its own vani_rule, and the
              old line quoted Breakout Surge's thresholds on every preset. */}
          <ScanSectionLabel>
            <span style={{ color: 'var(--gold)', marginRight: '6px' }}>✦</span>
            VaNi Highlight · {vani.length} stock{vani.length !== 1 ? 's' : ''}
          </ScanSectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px', marginBottom: '24px' }}>
            {vani.map(render)}
          </div>
        </>
      )}

      {rest.length > 0 && (
        <>
          <ScanSectionLabel>
            All Results · {stocks.length} stock{stocks.length !== 1 ? 's' : ''}
          </ScanSectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
            {rest.map(render)}
          </div>
        </>
      )}
    </div>
  );
}
