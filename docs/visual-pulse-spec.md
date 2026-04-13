# Visual Pulse — UX Challenge Spec

**Goal:** A trader glances at the screen and makes a go/no-go decision in 4-5 seconds.
No chart reading. No number parsing. Pure visual intuition.

---

## Design Principle

Every technical indicator is mapped to a **real-world metaphor** that humans
process instantly. Numbers become shapes. Trends become motion. Conviction becomes density.

The visual language replaces the traditional chart-reading skill. A trader who
can't read RSI divergences can still see "signal tower has 1 bar" and know it's weak.

---

## Visual Language

| Indicator | Data Source | Metaphor | Visual |
|---|---|---|---|
| **RSI** | `rsi_14` | Cell signal tower | 1-5 bars. Everyone knows weak vs strong signal. RSI 20→1 bar, RSI 80→5 bars |
| **MagicRS** | `magic_rs`, `magic_rs_zone` | Ocean wave | Rising wave = outperforming NIFTY 500. Sinking = drowning. Height = strength |
| **Order Flow** | `flow_type`, `vacuum_flag`, `accum_distrib` | River current | Blue rushing = fresh longs. Draining = liquidation. Dry riverbed = vacuum |
| **Sniper Dragon** | `sniper_inst`, `sniper_hot` | Sonar/Radar | Big blip = institutional. Lightning = hot money. Scattered dots = retail only |
| **RVOL/TVOL** | `rvol`, `tvol` | Crowd/Stadium | Packed = high conviction. Empty seats = nobody backing this move |
| **SuperTrend** | `supertrend_dir` | Wind flag | Flag direction = trend. Strong wind = clear trend. Calm = choppy |
| **DOT Signals** | `dot_svd`, `dot_sbd`, `dot_syd` | Stacked traffic lights | 3 lights for 3 timeframes. All green = go. Mixed = caution |
| **DC Inference** | `dc_inference` | Sky/Celestial | Sun = astro favorable. Eclipse = danger. Stars aligned = strong support |
| **Breadth** | `km_market_breadth` | Forest/Ecosystem | Green forest = broad participation. Dying trees = narrow, fragile market |

---

## Composition

All metaphors sit together as a **landscape scene** or **dashboard strip** on the
index chart page, below the price header. The trader sees:

```
Sky (astro) + Wind (trend) + Wave (RS) + River (flow) + Signal tower (RSI) + Stadium (volume) + Sonar (who)
```

One cohesive visual scene — not 7 separate widgets.

---

## Data Availability

All data exists in `km_index_eod` / `km_equity_eod` and `dc_inference`.
Frontend currently fetches most columns but only displays a few.

**Already fetched by frontend (`indicatorData.ts`):**
- rsi_14, rsi_9, mfi_14
- supertrend, supertrend_dir
- magic_rs, magic_rs_zone, magic_rs_sma144, magic_ma
- sniper_inst, sniper_hot, sniper_rsi
- rvol, tvol
- dot_svd, dot_sbd, dot_syd
- rss_value, rss_rsi
- chartink_score and details

**NOT yet fetched (need to add to INDICATOR_COLS in `indicatorData.ts`):**
- `flow_type` — order flow classification
- `vacuum_flag` — vacuum move detection
- `accum_distrib` — accumulation/distribution

**Separate data sources (already have hooks):**
- `dc_inference` — via `useOutlookInferences()` hook
- `km_market_breadth` — via `useMarketBreadth()` hook

---

## Milestones

### VP-1: RSI Signal Tower

- **Component**: `<RsiSignalTower rsi={56.5} />`
- **Mapping**: RSI 0-20→1 bar, 20-40→2 bars, 40-60→3 bars, 60-80→4 bars, 80-100→5 bars
- **Color**: Bars fill green (oversold recovery) → amber (neutral) → red (overbought)
- **Animation**: Bars pulse/glow when RSI crosses key levels (30, 50, 70)
- **Data source**: `km_index_eod.rsi_14` (already fetched in `indicatorData.ts`)
- **Placement**: ChartView.tsx, below price stats header, as part of the Visual Pulse strip
- **Iteration**: Try multiple bar styles (rounded, sharp, gradient) until one feels right

### VP-2: MagicRS Wave

- **Component**: `<MagicRsWave value={12.5} zone="Strong Bull" />`
- **Mapping**: `magic_rs` value → wave height. Positive = wave above waterline, negative = below
- **Color**: zone → wave color: Strong Bull=emerald, Mild Bull=teal, Neutral=gray,
  Mild Bear=amber, Strong Bear=red
- **Animation**: Wave undulates gently. Height shifts with value. Zone change = color morph
- **Data source**: `km_index_eod.magic_rs`, `magic_rs_zone`
- **Context**: Wave above waterline = stock/index outperforming NIFTY 500 (broad market).
  The higher the wave, the stronger the relative strength. Below waterline = lagging.
  MagicRS uses 144-period RS ratio vs benchmark, with 60-period MA as signal line.

### VP-3: Order Flow River

- **Component**: `<OrderFlowRiver flowType="FRESH_LONGS" vacuum="NONE" accumDistrib="NONE" rvol={1.8} />`
- **Mapping**: `flow_type` → river direction + color:
  - FRESH_LONGS → blue river flowing right (money entering)
  - SHORT_COVERING → light blue, gentler flow
  - FRESH_SHORTS → red river flowing left (money exiting)
  - LONG_LIQUIDATION → orange, draining
  - MIXED → gray, swirling eddies
  - LOW_VOLUME → dry riverbed, cracked earth
- **Vacuum overlay**: `vacuum_flag` = VACUUM_UP/DOWN → river appears dry despite price moving
  (fake move on no volume). Visual: translucent/ghost river
- **Accumulation/Distribution**: `accum_distrib` = ACCUMULATION → river widening/deepening;
  DISTRIBUTION → river narrowing/thinning
- **Intensity**: `rvol` scales the flow speed/width. RVOL 2.0 = rushing. RVOL 0.5 = trickle
- **Data source**: `km_index_eod.flow_type`, `vacuum_flag`, `accum_distrib`, `rvol`
  (flow_type/vacuum/accum_distrib NOT yet fetched in frontend — add to INDICATOR_COLS)

### VP-4: Sniper Sonar

- **Component**: `<SniperSonar inst={85} hot={42} />`
- **Mapping**: Radar screen with concentric circles.
  - `sniper_inst` → large pulsing blip. Size proportional to value. "The elephants"
  - `sniper_hot` → fast flickering blip. "The lightning"
  - Absence of both → scattered small dots = retail noise only
- **Data source**: `km_index_eod.sniper_inst`, `sniper_hot` (already fetched)
- **Context**: Sniper Dragon detects WHO is in the trade. Institutional presence = big
  conviction. Hot money = aggressive but can vanish. Retail only = weak move.

### VP-5: DOT Traffic Lights

- **Component**: `<DotTrafficLights svd={true} sbd={false} syd={true} />`
- **Mapping**: 3 stacked circles (top=short, mid=medium, bottom=long term)
  - `dot_svd` (Solid Violet Dot) → short-term. true=green, false=red
  - `dot_sbd` (Solid Blue Dot) → medium-term. true=green, false=red
  - `dot_syd` (Solid Yellow Dot) → long-term. true=green, false=red
  - All 3 green = all timeframes aligned. All 3 red = full bearish. Mixed = caution
- **Data source**: `km_index_eod.dot_svd`, `dot_sbd`, `dot_syd` (already fetched)

### VP-6: Volume Stadium

- **Component**: `<VolumeStadium rvol={2.1} tvol={1.5} />`
- **Mapping**: Stadium fill level from RVOL/TVOL.
  - RVOL < 0.8 → nearly empty (low conviction)
  - RVOL 0.8-1.2 → normal attendance
  - RVOL 1.2-2.0 → packed stands
  - RVOL > 2.0 → overflowing, standing room only
  - TVOL adds color: high TVOL = crowd is loud/active; low TVOL = seated/quiet
- **Data source**: `km_index_eod.rvol`, `tvol` (already fetched but not displayed)

### VP-7: DC Sky

- **Component**: `<DcSky inferences={[...]} />`
- **Mapping**: Active DC inferences for today → celestial backdrop
  - market_impact "Bullish" → clear sky, sun
  - market_impact "Bearish" → storm clouds, eclipse
  - market_impact "Neutral" → overcast
  - Multiple inferences → combine (e.g. 2 bullish + 1 bearish = partly cloudy)
  - confidence level → intensity of the sky effect
- **Data source**: `dc_inference` table filtered for today's date
  (already available via `useOutlookInferences` hook)

### VP-8: Compose Scene

- All VP-1 through VP-7 components arranged as a **horizontal strip** below the
  price header on ChartView.tsx.
- Visual reads left-to-right as a scene:
  ```
  Sky → Wind → Wave → River → Tower → Stadium → Sonar
  ```
- Consistent height (~120px). Responsive. Dark theme matching existing UI.
- Each component is independent — gracefully hides if data is null.

### VP-9: Index Heatmap

- **Component**: `<IndexHeatmap indexId={1} />`
- **Grid of constituent stocks** sized by weight (or equal if no weight), colored by:
  - MagicRS zone → border/glow color (strong=green, weak=red)
  - Daily change% → fill color (green positive, red negative)
- **Data source**: `km_index_constituents` + `km_equity_eod` (latest row per equity)
  + `km_equity_symbols` (symbol, company_name, industry)
- **Interaction**: Hover shows stock name + change% + MagicRS zone + flow_type

### VP-10: VaNi Narration

- New VaNi skill: `index_weather` in `ai_prompts.py`
- Reads the current state of all VP indicators for the index and generates a
  **1-line accessibility summary**: "Strong institutional buying into a favorable
  astro window — all timeframes aligned, volume confirms."
- Displayed as a subtle text line below the Visual Pulse strip.
- Endpoint: `GET /api/ai/index-weather?index_id=N`

---

## Iteration Rule

VP-1 (RSI Signal Tower) must go through **multiple design iterations** until the
visual language feels right. Only then proceed to VP-2. Once one metaphor works,
the pattern applies to all others.

---

## Technical Notes

- All indicators are computed in PostgreSQL via SQL RPC functions (migrations 014, 022, 023, 025, 026)
- Daily pipeline calls `compute_all_pending_indicators()` → `compute_all_magic_rs()` → `compute_all_flow_intelligence()`
- Frontend fetches via PostgREST from `km_index_eod` / `km_equity_eod`
- Components should be pure SVG or Canvas for smooth animation
- Theme must match existing dark theme (CSS vars: `--bg-primary`, `--text-primary`, etc.)
