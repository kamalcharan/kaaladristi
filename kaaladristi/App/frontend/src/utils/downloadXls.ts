import * as XLSX from 'xlsx';
import type { ScanStock } from '@/types';

type Row = Record<string, string | number | boolean | null>;

function fmt(v: number | null | undefined, dp = 2): number | string {
  if (v == null) return '';
  return Math.round(v * 10 ** dp) / 10 ** dp;
}

function yesNo(v: boolean | null | undefined): string {
  if (v == null) return '';
  return v ? 'Yes' : '';
}

function baseRow(s: ScanStock): Row {
  return {
    Symbol:           s.symbol,
    Company:          s.company_name ?? '',
    Industry:         s.industry ?? '',
    Exchange:         s.exchange ?? '',
    Close:            fmt(s.close),
    'Open':           fmt(s.open, 1),
    'High':           fmt(s.high, 1),
    'Low':            fmt(s.low, 1),
    'MCap (Cr)':      s.mcap_cr != null ? fmt(s.mcap_cr, 0) : '',
    '% Chg':          fmt(s.pct_chng),
    RSI:              fmt(s.rsi_14),
    'Magic RS':       fmt(s.magic_rs),
    'RS Zone':        s.magic_rs_zone ?? '',
    'Flow Type':      s.flow_type ?? '',
    RVOL:             fmt(s.rvol),
    'Smart Money':    fmt(s.sniper_inst),
    'Accum/Distrib':  s.accum_distrib ?? '',
    'RSS Value':      fmt(s.rss_value),
    'SMA 150':        fmt(s.sma_150, 1),
    'EMA 20':         fmt(s.ema_20, 1),
    'ATR 14':         fmt(s.atr_14, 1),
    '52W High':       fmt(s.w52_high, 1),
    '% Below 52W H':  fmt(s.pctBelow52wHigh),
    'Reward (ATR×)':  fmt(s.rewardPct),
    'SVD (5d)':       yesNo(s.has_recent_svd),
    'SBD (5d)':       yesNo(s.has_recent_sbd),
    'SYD (5d)':       yesNo(s.has_recent_syd),
    'VaNi Opp':       yesNo(s.vaniOpportunity),
  };
}

function convictionFlowRow(s: ScanStock): Row {
  return {
    ...baseRow(s),
    'Surge (×)':      fmt(s.delivery_surge_x, 2),
    '5D Avg (Cr)':    fmt(s.avg_amt_5d),
    '22D Avg (Cr)':   fmt(s.avg_amt_22d),
    'Today Deliv (Cr)': fmt(s.deliv_value_cr),
    'D% from EMA20':  fmt(s.d_pct),
    'Score(5D)':      fmt(s.ret_5d),
    'Score(22D)':     fmt(s.ret_22d),
    'Score(66D)':     fmt(s.ret_66d),
    '66D Avg (Cr)':   fmt(s.avg_amt_66d),
    'xAmt (5/22)':    fmt(s.xAmt, 3),
    'REL 5D N50':     fmt(s.rel_5d_n50),
    'REL 22D N50':    fmt(s.rel_22d_n50),
    'REL 66D N50':    fmt(s.rel_66d_n50),
    'REL 5D N500':    fmt(s.rel_5d_n500),
    'REL 22D N500':   fmt(s.rel_22d_n500),
    'REL 66D N500':   fmt(s.rel_66d_n500),
  };
}

/** A column appended after the base row. Scanner Studios build theirs from
 *  their descriptor (`studioXlsColumns`), which replaced the bespoke
 *  breakoutSurgeRow: the descriptor's slots are the export's columns, so a
 *  Studio cannot ship a card metric its XLS lacks. */
export interface XlsColumn {
  header: string;
  value: (s: ScanStock) => number | string | null | undefined;
  /** Decimal places for numeric values (default 2). */
  dp?: number;
}

export type ScanVariant = 'conviction_flow' | 'default';

export function downloadScanXls(
  stocks: ScanStock[],
  scanName: string,
  variant: ScanVariant = 'default',
  extraColumns: XlsColumn[] = [],
): void {
  const today = new Date().toISOString().slice(0, 10);
  const fileName = `${scanName.replace(/\s+/g, '_')}_${today}.xlsx`;

  const rows: Row[] = stocks.map((s) => {
    const row = variant === 'conviction_flow' ? convictionFlowRow(s) : baseRow(s);
    for (const c of extraColumns) {
      const v = c.value(s);
      row[c.header] = typeof v === 'number' ? fmt(v, c.dp ?? 2) : (v ?? '');
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths — symbol narrow, company wide, numbers medium
  const colWidths = Object.keys(rows[0] ?? {}).map((k) => ({
    wch: k === 'Company' ? 32 : k === 'Industry' ? 26 : k.length + 4,
  }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, scanName.slice(0, 31));
  XLSX.writeFile(wb, fileName);
}
