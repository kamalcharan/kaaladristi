import { useState } from 'react';
import { useIndustryRotation, useIndustryStocks } from '@/hooks';
import type { IndustryRotationItem } from '@/types';

// ── Stock drawer (lazy-loaded when chip expands) ───────────────────────────────

function StockDrawer({ industry, tradeDate }: { industry: string; tradeDate: string }) {
  const { data = [], isLoading } = useIndustryStocks(industry, tradeDate);

  if (isLoading) {
    return (
      <div style={{ padding: '8px 0', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}>
        loading…
      </div>
    );
  }
  if (data.length === 0) {
    return (
      <div style={{ padding: '8px 0', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}>
        no data
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 6 }}>
      {/* Column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 40px 44px',
          gap: 4,
          paddingBottom: 4,
          borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-faint)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        <span>Symbol</span>
        <span style={{ textAlign: 'right' }}>RS</span>
        <span style={{ textAlign: 'right' }}>Chg</span>
      </div>

      {data.slice(0, 5).map(stock => {
        const rsColor =
          stock.magic_rs_zone === 'strong_bull' ? 'var(--bull)' :
          stock.magic_rs_zone === 'strong_bear' ? 'var(--bear)' :
          'var(--text-secondary)';
        const chgColor =
          stock.pct_chng != null && stock.pct_chng > 0 ? 'var(--bull)' :
          stock.pct_chng != null && stock.pct_chng < 0 ? 'var(--bear)' :
          'var(--text-faint)';

        return (
          <div
            key={stock.equity_id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 40px 44px',
              gap: 4,
              alignItems: 'center',
              padding: '3px 0',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
            }}
          >
            <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {stock.symbol}
            </span>
            <span style={{ color: rsColor, textAlign: 'right' }}>
              {stock.magic_rs != null ? stock.magic_rs.toFixed(1) : '—'}
            </span>
            <span style={{ color: chgColor, textAlign: 'right' }}>
              {stock.pct_chng != null
                ? `${stock.pct_chng > 0 ? '+' : ''}${stock.pct_chng.toFixed(1)}%`
                : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Industry chip ──────────────────────────────────────────────────────────────

interface ChipProps {
  item: IndustryRotationItem;
  tradeDate: string;
  accentColor: string;
  badge?: string;
}

function IndustryChip({ item, tradeDate, accentColor, badge }: ChipProps) {
  const [open, setOpen] = useState(false);

  // RS bar: avg_magic_rs roughly 0–200; 100 = neutral benchmark
  const rsBarPct = Math.min(100, Math.max(0, ((item.avg_magic_rs ?? 100) / 200) * 100));

  return (
    <div
      style={{
        border: `1px solid ${open ? accentColor : 'var(--border)'}`,
        borderRadius: 8,
        padding: '8px 10px',
        cursor: 'pointer',
        background: open ? 'rgba(255,255,255,0.02)' : 'transparent',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onClick={() => setOpen(v => !v)}
    >
      {/* Name row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 12,
            color: 'var(--text-primary)',
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '68%',
          }}
        >
          {item.industry}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {badge && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: accentColor }}>
              {badge}
            </span>
          )}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)' }}>
            {item.stock_count}
          </span>
        </div>
      </div>

      {/* RS bar */}
      <div style={{ height: 2, background: 'var(--border)', borderRadius: 1, overflow: 'hidden' }}>
        <div style={{ width: `${rsBarPct}%`, height: '100%', background: accentColor, borderRadius: 1 }} />
      </div>

      {/* RS label */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)', marginTop: 3 }}>
        RS {item.avg_magic_rs?.toFixed(1) ?? '—'}
      </div>

      {/* Inline stock drawer */}
      {open && <StockDrawer industry={item.industry} tradeDate={tradeDate} />}
    </div>
  );
}

// ── Lane ──────────────────────────────────────────────────────────────────────

interface LaneProps {
  label: string;
  accentColor: string;
  items: IndustryRotationItem[];
  tradeDate: string;
  badgeFor?: (item: IndustryRotationItem) => string | undefined;
}

function Lane({ label, accentColor, items, tradeDate, badgeFor }: LaneProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 8,
          borderBottom: `1px solid var(--border)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)' }}>
          {items.length}
        </span>
      </div>

      {/* Chips */}
      {items.length === 0 ? (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-faint)',
            fontStyle: 'italic',
            padding: '8px 0',
          }}
        >
          none today
        </div>
      ) : (
        items.map(item => (
          <IndustryChip
            key={item.industry}
            item={item}
            tradeDate={tradeDate}
            accentColor={accentColor}
            badge={badgeFor?.(item)}
          />
        ))
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SectorRotationFlow() {
  const rotation = useIndustryRotation();
  const rotatingIn  = rotation.data?.rotatingIn  ?? [];
  const leading     = rotation.data?.leading     ?? [];
  const rotatingOut = rotation.data?.rotatingOut ?? [];
  const tradeDate   = rotation.data?.latestDate  ?? '';

  if (rotation.isLoading) {
    return (
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '16px 18px',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                height: 180,
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 8,
                border: '1px solid var(--border)',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '18px 20px',
        marginBottom: 16,
      }}
    >
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontStyle: 'italic',
            color: 'var(--text-primary)',
          }}
        >
          Sector Rotation
        </span>
        {tradeDate && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.12em' }}>
            {tradeDate}
          </span>
        )}
      </div>

      {/* 3-lane grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <Lane
          label="Leading"
          accentColor="var(--gold)"
          items={leading}
          tradeDate={tradeDate}
        />
        <Lane
          label="Rotating In"
          accentColor="var(--bull)"
          items={rotatingIn}
          tradeDate={tradeDate}
          badgeFor={item => item.rank_change > 0 ? `+${item.rank_change}` : undefined}
        />
        <Lane
          label="Rotating Out"
          accentColor="var(--bear)"
          items={rotatingOut}
          tradeDate={tradeDate}
          badgeFor={item => item.rank_change < 0 ? `${item.rank_change}` : undefined}
        />
      </div>
    </div>
  );
}
