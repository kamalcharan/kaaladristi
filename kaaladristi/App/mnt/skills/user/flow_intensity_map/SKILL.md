# FlowIntensityMap Skill

## Purpose
Day-by-day flow intensity heatmap.
Rows = entities (stocks or indices).
Columns = trading days (count depends on mode).
Cell color = signal strength.
SEBI-safe: no directional recommendations.

## Two Modes

### Mode 1: constituent
Used when: showing stocks inside one index (IndexDetailPage Tab 4)
Rows: stock symbols (constituents of selected index)
Columns: last 22 trading days (fixed)
Color rule: percentile of surge within each stock's OWN history
  surge = value_cr / (avg_amt_66d / 22) per stock per day
  Percentile buckets (per-row, not global):
    >= p80 → dark green  (#166534)
    >= p60 → light green (var(--risk-green))
    >= p40 → amber       (var(--risk-amber))
    >= p20 → pink        (#f87171)
    <  p20 → red         (var(--risk-red))
    null   → #1e293b
Cell top border: var(--risk-green) if d1 >= 0, 
                 var(--risk-red) if d1 < 0
Toggle: Surge× | ₹ Cr
Tooltip: date, symbol, ₹ Cr amt, surge×, 1D%

### Mode 2: index
Used when: showing all indices in sector tab 
           (SectorRotationPage Heat view)
Rows: index names (all active indices in selected category)
Columns: last N days where N = selected window (5 | 22 | 66)
Color rule: composite 4-state signal per index per day:
  STRONG:   avg_amt_5d > avg_amt_22d AND ret_5d > 1.5
            → #166534 dark green
  MODERATE: avg_amt_5d > avg_amt_22d AND ret_5d >= 0.5
            → var(--risk-green) light green
  WEAK:     everything else
            → var(--risk-amber) amber
  LOW FLOW: avg_amt_5d < avg_amt_22d AND ret_5d < 0
            → var(--risk-red) red
Cell top border: var(--risk-green) if ret_5d >= 0,
                 var(--risk-red) if ret_5d < 0
Toggle: 5D | 22D | 66D (changes number of columns)
Cell content (text inside cell):
  Line 1: index name truncated 12 chars, mono 10px
  Line 2: ret_5d with sign + % colored green/red
Tooltip: index name, avg_amt_5d, avg_amt_22d,
         ret_5d, ret_22d, signal state label

## Props Interface

interface FlowIntensityMapProps {
  mode: 'constituent' | 'index'
  rows: string[]
  dates: string[]
  cells: Record<string, CellData[]>
  title?: string
  subtitle?: string
  surgeToggle?: 'sx' | 'amt'         // constituent only
  dayWindow?: 5 | 22 | 66            // index only
  onDayWindowChange?: (d: 5|22|66) => void
}

interface CellData {
  d1: number       // 1D price % (sign → border color)
  amt: number      // ₹ Cr traded value
  sx?: number      // surge× vs 66D baseline (constituent)
  amt_5d?: number  // avg_amt_5d (index mode)
  amt_22d?: number // avg_amt_22d (index mode)
  ret_5d?: number  // 5D return % (index mode)
}

## Component Rules
- Pure render — zero data fetching inside component
- CSS grid — not recharts, not any charting library
- Reuse: Tooltip.tsx, Card component
- No new color tokens except #166534 and #f87171

## Data Services (separate files, not in component)

constituent mode:
  fetchConstituentFlowMap(indexId: number, days: number = 22)
  Source: km_index_constituents + km_equity_eod
  Hook: useConstituentFlowMap(indexId)

index mode:
  fetchIndexFlowMap(category: string, days: 5|22|66)
  Source: km_index_symbols + km_index_eod
  Hook: useIndexFlowMap(category, days)

Both in:
  services/sectorRotation.ts
  hooks/useSectorRotation.ts

## SEBI Safety Rules
- Forbidden: "hot", "accumulation", "buy", "sell",
             "bullish", "bearish"
- Signal labels: "Strong Flow", "Moderate Flow", 
                 "Weak Flow", "Low Flow"
- Border = price direction (factual only)
- Footer: "Cell color reflects flow relative to baseline.
           Edge indicates price direction for that session."
- Tooltip field names: "Traded Value", "vs 66D Avg", 
                       "Flow Signal"

## Reuse Sites
1. IndexDetailPage Tab 4 — constituent mode (Sprint 10)
2. SectorRotationPage Heat toggle — index mode (Sprint 10)
3. CustomIndex detail — constituent mode (Sprint 12)
4. Visual Pulse peer view — constituent mode (Post-MVP)

## Color Reference
dark green : #166534           strong / high flow
light green: var(--risk-green) moderate / above average
amber      : var(--risk-amber) weak / mixed / normal
pink       : #f87171           below average
red        : var(--risk-red)   low flow signal
dark       : #1e293b           no data / null

## Dependencies
- Tooltip.tsx (src/components/ui/Tooltip.tsx)
- Card (src/components/ui)
- CSS grid only
- No third-party chart libraries
