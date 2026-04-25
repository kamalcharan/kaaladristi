import { useQuery } from '@tanstack/react-query';
import { from } from '@/services/postgrest';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TickerConfig {
  name: string;
  label: string;
  isVix: boolean;
}

interface TickerData {
  trade_date: string;
  close: number;
  pct_chng: number | null;
  prev_close: number | null;
  rsi_14: number | null;
  magic_rs: number | null;
  magic_ma: number | null;
  magic_rs_zone: string | null;
}

// ── Config ────────────────────────────────────────────────────────────────────

const TICKERS: TickerConfig[] = [
  { name: 'NIFTY 50',   label: 'NIFTY 50',   isVix: false },
  { name: 'NIFTY BANK', label: 'NIFTY BANK', isVix: false },
  { name: 'NIFTY 500',  label: 'NIFTY 500',  isVix: false },
  { name: 'India VIX',  label: 'INDIA VIX',  isVix: true  },
];

// ── Data fetch — one query per index for reliability ──────────────────────────

async function fetchTickerData(date: string): Promise<Record<string, TickerData>> {
  // 1. Resolve symbol IDs
  const { data: symbols } = await from('km_index_symbols')
    .select('id,name')
    .in('name', TICKERS.map(t => t.name))
    .execute();

  if (!symbols || symbols.length === 0) return {};

  type SymRow = { id: number; name: string };
  const idMap: Record<string, number> = {};
  for (const s of symbols as SymRow[]) idMap[s.name] = s.id;

  // 2. Fetch most-recent row per index separately (avoids cross-index ordering issues)
  const result: Record<string, TickerData> = {};

  await Promise.all(
    TICKERS.map(async ticker => {
      const id = idMap[ticker.name];
      if (!id) return;

      const { data: rows } = await from('km_index_eod')
        .select('trade_date,close,prev_close,pct_chng,rsi_14,magic_rs,magic_ma,magic_rs_zone')
        .eq('index_id', id)
        .lte('trade_date', date)
        .order('trade_date', { ascending: false })
        .limit(1)
        .execute();

      const row = (rows as TickerData[] | null)?.[0];
      if (row) result[ticker.name] = row;
    }),
  );

  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(val: number): string {
  return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function changeColor(pct: number | null, isVix: boolean): string {
  if (pct == null) return 'var(--text-faint)';
  const positive = isVix ? pct < 0 : pct > 0;
  const negative = isVix ? pct > 0 : pct < 0;
  if (positive) return '#22c55e';
  if (negative) return '#ef4444';
  return 'var(--text-faint)';
}

function rsiColor(rsi: number | null): string {
  if (rsi == null) return 'var(--text-faint)';
  if (rsi >= 70) return '#ef4444';
  if (rsi >= 60) return '#f59e0b';
  if (rsi >= 40) return '#22c55e';
  if (rsi >= 30) return '#f59e0b';
  return '#ef4444';
}

function deriveZone(magic_rs: number | null, magic_ma: number | null): string | null {
  if (magic_rs == null || magic_ma == null) return null;
  const diff = Math.abs(magic_rs - magic_ma);
  const THRESHOLD = 6.0;
  if (magic_rs > magic_ma) {
    if (diff > THRESHOLD * 1.5) return 'Strong Bull';
    if (diff > THRESHOLD)       return 'Mild Bull';
    return 'Neutral';
  } else {
    if (diff > THRESHOLD * 1.5) return 'Strong Bear';
    if (diff > THRESHOLD)       return 'Mild Bear';
    return 'Neutral';
  }
}

function zoneColor(zone: string | null): string {
  switch (zone) {
    case 'Strong Bull': return '#22c55e';
    case 'Mild Bull':   return '#86efac';
    case 'Neutral':     return 'var(--text-faint)';
    case 'Mild Bear':   return '#fca5a5';
    case 'Strong Bear': return '#ef4444';
    default:            return 'var(--text-faint)';
  }
}

function zoneShort(zone: string | null): string {
  switch (zone) {
    case 'Strong Bull': return 'S.Bull';
    case 'Mild Bull':   return 'M.Bull';
    case 'Neutral':     return 'Neut';
    case 'Mild Bear':   return 'M.Bear';
    case 'Strong Bear': return 'S.Bear';
    default:            return '—';
  }
}

// ── Single card ───────────────────────────────────────────────────────────────

function Card({ ticker, data }: { ticker: TickerConfig; data?: TickerData }) {
  const pct   = data?.pct_chng ?? null;
  const close = data?.close ?? null;
  const rsi   = data?.rsi_14 ?? null;
  const zone  = data?.magic_rs_zone ?? deriveZone(data?.magic_rs ?? null, data?.magic_ma ?? null);
  const changeClr = changeColor(pct, ticker.isVix);

  // Compute pct from prev_close if pct_chng is null
  const displayPct = pct ?? (
    close != null && data?.prev_close != null && data.prev_close !== 0
      ? ((close - data.prev_close) / data.prev_close) * 100
      : null
  );

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '10px 14px 8px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minWidth: 0,
      flex: 1,
    }}>
      {/* Label */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: '0.14em',
        color: 'var(--text-faint)',
        textTransform: 'uppercase',
      }}>
        {ticker.label}
      </span>

      {/* Close */}
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 20,
        fontWeight: 500,
        letterSpacing: '-0.02em',
        lineHeight: 1.1,
        color: close != null ? 'var(--text-primary)' : 'var(--text-faint)',
      }}>
        {close != null ? fmt(close) : '—'}
      </span>

      {/* Change */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 600,
        color: changeClr,
      }}>
        {displayPct != null
          ? `${displayPct > 0 ? '▲' : displayPct < 0 ? '▼' : '—'} ${Math.abs(displayPct).toFixed(2)}%`
          : '—'}
      </span>

      {/* RSI + MagicRS zone — hide for VIX */}
      {!ticker.isVix && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--text-faint)',
            letterSpacing: '0.08em',
          }}>
            RSI{' '}
            <span style={{ color: rsiColor(rsi), fontWeight: 600 }}>
              {rsi != null ? rsi.toFixed(0) : '—'}
            </span>
          </span>
          <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 10 }}>│</span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: zoneColor(zone),
            letterSpacing: '0.06em',
          }}>
            ● {zoneShort(zone)}
            {data?.magic_rs != null && (
              <span style={{ color: 'var(--text-faint)', marginLeft: 3 }}>
                {data.magic_rs > 0 ? '+' : ''}{data.magic_rs.toFixed(1)}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Trade date — clearly visible so stale data is obvious */}
      {data?.trade_date && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 8,
          color: 'var(--text-faint)',
          letterSpacing: '0.08em',
          marginTop: 2,
        }}>
          {new Date(data.trade_date + 'T00:00:00Z').toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', timeZone: 'UTC',
          })}
        </span>
      )}
    </div>
  );
}

// ── Rail ──────────────────────────────────────────────────────────────────────

export default function TickerRail({ date }: { date: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ticker_rail', date],
    queryFn: () => fetchTickerData(date),
    staleTime: 5 * 60 * 1000,
    enabled: !!date,
  });

  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
      {TICKERS.map(ticker => (
        <Card
          key={ticker.name}
          ticker={ticker}
          data={isLoading ? undefined : data?.[ticker.name]}
        />
      ))}
    </div>
  );
}
