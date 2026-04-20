import type { ConvictionFlowStock } from '@/types';

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt2(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toFixed(2);
}

function fmtCr(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toFixed(2) + ' Cr';
}

function fmtSurge(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toFixed(2) + '×';
}

function fmtDPct(n: number | null | undefined): string {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function dPctColor(n: number): string {
  if (n > 2)  return 'var(--bull)';
  if (n < -2) return 'var(--bear)';
  return 'var(--text-secondary)';
}

// ── Column header ─────────────────────────────────────────────────────────────

const TH_STYLE: React.CSSProperties = {
  padding: '8px 12px',
  fontFamily: 'var(--font-mono)',
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.07em',
  color: 'var(--text-faint)',
  textAlign: 'right' as const,
  whiteSpace: 'nowrap' as const,
  borderBottom: '1px solid var(--border)',
};

const TH_LEFT: React.CSSProperties = { ...TH_STYLE, textAlign: 'left' };

// ── Row ───────────────────────────────────────────────────────────────────────

function FlowRow({ stock, isVani }: { stock: ConvictionFlowStock; isVani: boolean }) {
  const rowStyle: React.CSSProperties = {
    borderLeft: isVani ? '2px solid var(--gold)' : '2px solid transparent',
    background: isVani ? 'var(--gold-bg)' : 'transparent',
    transition: 'background 0.15s',
  };
  const TD: React.CSSProperties = {
    padding: '9px 12px',
    fontSize: '13px',
    textAlign: 'right',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
    color: 'var(--text-secondary)',
  };
  const TD_LEFT: React.CSSProperties = { ...TD, textAlign: 'left' };

  return (
    <tr style={rowStyle}>
      {/* Symbol */}
      <td style={TD_LEFT}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isVani && (
            <span style={{ color: 'var(--gold)', fontSize: '10px', lineHeight: 1 }}>✦</span>
          )}
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            fontWeight: 600,
            color: isVani ? 'var(--gold)' : 'var(--text-primary)',
          }}>
            {stock.symbol}
          </span>
        </div>
      </td>
      {/* Close */}
      <td style={{ ...TD, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
        {fmt2(stock.close)}
      </td>
      {/* D% */}
      <td style={{ ...TD, color: dPctColor(stock.d_pct), fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
        {fmtDPct(stock.d_pct)}
      </td>
      {/* Avg Amt 5D */}
      <td style={{ ...TD, fontFamily: 'var(--font-mono)' }}>
        {fmtCr(stock.avg_amt_5d)}
      </td>
      {/* Avg Amt 22D */}
      <td style={{ ...TD, fontFamily: 'var(--font-mono)' }}>
        {fmtCr(stock.avg_amt_22d)}
      </td>
      {/* Today Delivery */}
      <td style={{ ...TD, fontFamily: 'var(--font-mono)' }}>
        {fmtCr(stock.deliv_value_cr)}
      </td>
      {/* Surge */}
      <td style={{
        ...TD,
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        color: stock.delivery_surge_x >= 2 ? 'var(--gold)' : 'var(--text-primary)',
      }}>
        {fmtSurge(stock.delivery_surge_x)}
      </td>
    </tr>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '8px 12px 6px',
      fontFamily: 'var(--font-mono)',
      fontSize: '10px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--text-faint)',
      borderBottom: '1px solid var(--border)',
    }}>
      {children}
    </div>
  );
}

// ── Table shell ───────────────────────────────────────────────────────────────

function TableShell({ stocks, isVani }: { stocks: ConvictionFlowStock[]; isVani: boolean }) {
  if (stocks.length === 0) return null;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={TH_LEFT}>Symbol</th>
            <th style={TH_STYLE}>Close</th>
            <th style={TH_STYLE}>D%</th>
            <th style={TH_STYLE}>Avg Amt 5D</th>
            <th style={TH_STYLE}>Avg Amt 22D</th>
            <th style={TH_STYLE}>Today Delivery</th>
            <th style={TH_STYLE}>Surge (X)</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((s) => (
            <FlowRow key={s.equity_id} stock={s} isVani={isVani} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ConvictionFlowTable({ stocks }: { stocks: ConvictionFlowStock[] }) {
  const vani = stocks.filter((s) => s.is_vani_opportunity);
  const rest  = stocks.filter((s) => !s.is_vani_opportunity);

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      overflow: 'hidden',
    }}>
      {/* VaNi Opportunity section */}
      {vani.length > 0 && (
        <>
          <SectionLabel>
            <span style={{ color: 'var(--gold)', marginRight: '6px' }}>✦</span>
            VaNi Opportunity · {vani.length} stock{vani.length !== 1 ? 's' : ''}
            <span style={{ marginLeft: '8px', fontWeight: 400, color: 'var(--text-faint)' }}>
              surge &gt; 2× · price near EMA20 · avg 22D &gt; 2 Cr
            </span>
          </SectionLabel>
          <TableShell stocks={vani} isVani />
          {rest.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)' }} />
          )}
        </>
      )}

      {/* All remaining results */}
      {rest.length > 0 && (
        <>
          <SectionLabel>
            All Results · {stocks.length} stock{stocks.length !== 1 ? 's' : ''} · sorted by Surge ↓
          </SectionLabel>
          <TableShell stocks={rest} isVani={false} />
        </>
      )}

      {stocks.length === 0 && (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
          No stocks match Conviction Flow criteria today.
        </div>
      )}
    </div>
  );
}
