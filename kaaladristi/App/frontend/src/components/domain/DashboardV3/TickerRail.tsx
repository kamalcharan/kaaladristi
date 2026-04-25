import { useQuery } from '@tanstack/react-query';
import { from } from '@/services/postgrest';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TickerCard {
  name: string;
  label: string;       // display label
  isVix: boolean;      // VIX shows differently — no % sign, red=good
}

interface TickerData {
  close: number;
  prev_close: number | null;
  pct_chng: number | null;
}

// ── Config ────────────────────────────────────────────────────────────────────

const TICKERS: TickerCard[] = [
  { name: 'NIFTY 50',   label: 'NIFTY 50',    isVix: false },
  { name: 'NIFTY BANK', label: 'NIFTY BANK',  isVix: false },
  { name: 'NIFTY 500',  label: 'NIFTY 500',   isVix: false },
  { name: 'India VIX',  label: 'INDIA VIX',   isVix: true  },
];

// ── Data fetch ────────────────────────────────────────────────────────────────

async function fetchTickerData(date: string): Promise<Record<string, TickerData>> {
  // Resolve index IDs first (cached by react-query key including date)
  const { data: symbols } = await from('km_index_symbols')
    .select('id,name')
    .in('name', TICKERS.map(t => t.name))
    .execute();

  if (!symbols || symbols.length === 0) return {};

  type SymRow = { id: number; name: string };
  const idMap: Record<string, number> = {};
  for (const s of symbols as SymRow[]) idMap[s.name] = s.id;

  // Fetch latest EOD row on or before date for each index
  const ids = Object.values(idMap);
  const { data: rows } = await from('km_index_eod')
    .select('index_id,trade_date,close,prev_close,pct_chng')
    .in('index_id', ids)
    .lte('trade_date', date)
    .order('trade_date', { ascending: false })
    .limit(ids.length * 2)   // 2 rows per index for safety
    .execute();

  type EodRow = { index_id: number; trade_date: string; close: number; prev_close: number | null; pct_chng: number | null };
  const eodRows = (rows ?? []) as EodRow[];

  // Keep only the most-recent row per index_id
  const seen = new Set<number>();
  const result: Record<string, TickerData> = {};
  const reverseIdMap: Record<number, string> = {};
  for (const [name, id] of Object.entries(idMap)) reverseIdMap[id] = name;

  for (const r of eodRows) {
    if (seen.has(r.index_id)) continue;
    seen.add(r.index_id);
    const name = reverseIdMap[r.index_id];
    if (name) {
      result[name] = { close: r.close, prev_close: r.prev_close, pct_chng: r.pct_chng };
    }
  }

  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(val: number, decimals = 2): string {
  return val.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function changeColor(pct: number | null, isVix: boolean): string {
  if (pct == null) return 'var(--text-faint)';
  // VIX: rising is negative for market
  const positive = isVix ? pct < 0 : pct > 0;
  const negative = isVix ? pct > 0 : pct < 0;
  if (positive) return '#22c55e';
  if (negative) return '#ef4444';
  return 'var(--text-faint)';
}

function arrow(pct: number | null): string {
  if (pct == null) return '';
  if (pct > 0) return '▲';
  if (pct < 0) return '▼';
  return '—';
}

// ── Single card ───────────────────────────────────────────────────────────────

function Card({ ticker, data }: { ticker: TickerCard; data?: TickerData }) {
  const pct = data?.pct_chng ?? null;
  const close = data?.close ?? null;
  const color = changeColor(pct, ticker.isVix);

  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        minWidth: 0,
        flex: 1,
      }}
    >
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

      {/* Value */}
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 20,
        fontWeight: 500,
        letterSpacing: '-0.02em',
        lineHeight: 1.1,
        color: close != null ? 'var(--text-primary)' : 'var(--text-faint)',
      }}>
        {close != null ? fmt(close, ticker.isVix ? 2 : 2) : '—'}
      </span>

      {/* Change */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 600,
          color,
        }}>
          {pct != null ? `${arrow(pct)} ${Math.abs(pct).toFixed(2)}%` : '—'}
        </span>
      </div>
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
