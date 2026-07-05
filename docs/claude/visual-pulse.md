# Visual Pulse — UX Challenge Spec (CLAUDE.md copy)

> Moved verbatim from CLAUDE.md. Detailed per-milestone spec: docs/visual-pulse-spec.md

## Visual Pulse — UX Challenge Spec
**Goal:** A trader glances at the screen and makes a go/no-go decision in 4-5 seconds.
No chart reading. No number parsing. Pure visual intuition.

### Design Principle

Every technical indicator is mapped to a **real-world metaphor** that humans
process instantly. Numbers become shapes. Trends become motion. Conviction becomes density.

### Visual Language

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

### Composition

All metaphors sit together as a **landscape scene** or **dashboard strip** on the
index chart page, below the price header. The trader sees:

```
Sky (astro) + Wind (trend) + Wave (RS) + River (flow) + Signal tower (RSI) + Stadium (volume) + Sonar (who)
```

One cohesive visual scene — not 7 separate widgets.

### Data Availability

All data exists in `km_index_eod` / `km_equity_eod` and `dc_inference`.
Frontend currently fetches most columns but only displays a few.
Missing from frontend fetch: `flow_type`, `vacuum_flag`, `accum_distrib`.

### Milestones

| # | Milestone | Scope | Status |
|---|---|---|---|
| VP-1 | **Prototype: RSI Signal Tower** | Single SVG component. Map RSI 0-100 to 1-5 animated bars. Test on chart page. Get the visual language right. | Todo |
| VP-2 | **MagicRS Wave** | Animated wave SVG. Height from magic_rs value. Color from zone. | Todo |
| VP-3 | **Order Flow River** | Flow direction + intensity from flow_type + RVOL. Vacuum = dry. | Todo |
| VP-4 | **Sniper Sonar** | Radar pings for inst/hot/retail presence. Size = magnitude. | Todo |
| VP-5 | **DOT Traffic Lights** | 3 stacked circles. SVD/SBD/SYD mapped to green/amber/red. | Todo |
| VP-6 | **Volume Stadium** | Crowd density visualization from RVOL/TVOL. | Todo |
| VP-7 | **DC Sky** | Celestial backdrop from dc_inference. Sun/clouds/eclipse. | Todo |
| VP-8 | **Compose Scene** | Arrange all metaphors into one cohesive visual strip. | Todo |
| VP-9 | **Index Heatmap** | Constituent grid below the scene. MagicRS zone + change% per stock. | Todo |
| VP-10 | **VaNi Narration** | AI reads the visual state and generates 1-line summary for accessibility. | Todo |

### Iteration Rule

VP-1 (RSI Signal Tower) must go through **multiple design iterations** until the
visual language feels right. Only then proceed to VP-2. Once one metaphor works,
the pattern applies to all others.

Detailed spec for each milestone: see `docs/visual-pulse-spec.md`

### Iteration Rule

VP-1 (RSI Signal Tower) must go through **multiple design iterations** until the
visual language feels right. Only then proceed to VP-2. Once one metaphor works,
the pattern applies to all others.

---
