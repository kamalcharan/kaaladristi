import { useNavigate } from 'react-router-dom'
import { SCAN_PRESETS } from '@/services/scanEngine'

// Icon map per preset id
const ICONS: Record<string, string> = {
  power_buy:            '▲',
  power_sell:           '▼',
  smart_money:          '◉',
  fresh_breakout:       '⊛',
  quiet_accumulation:   '◌',
  distribution_warning: '⊘',
  conviction_flow:      '⊙',
  breakout_surge:       '⇑',
  stage_2_leaders:      '②',
  stage_2_watch:        '◎',
  vani_opportunity:     '✦',
  stage_4_leaders:      '④',
  stage_3_watch:        '③',
  vani_exit_watch:      '✦',
}

// Color per preset
const ACCENT: Record<string, string> = {
  power_buy:            '#4ade80',
  power_sell:           '#f87171',
  smart_money:          '#2dd4bf',
  fresh_breakout:       '#7c6af7',
  quiet_accumulation:   '#c9a84c',
  distribution_warning: '#f87171',
  conviction_flow:      '#7c6af7',
  breakout_surge:       '#4ade80',
  stage_2_leaders:      '#f59e0b',
  stage_2_watch:        '#f59e0b',
  vani_opportunity:     '#7c6af7',
  stage_4_leaders:      '#f87171',
  stage_3_watch:        '#f97316',
  vani_exit_watch:      '#f87171',
}

const ACCENT_BG: Record<string, string> = {
  power_buy:            'rgba(74,222,128,0.06)',
  power_sell:           'rgba(248,113,113,0.06)',
  smart_money:          'rgba(45,212,191,0.06)',
  fresh_breakout:       'rgba(124,106,247,0.06)',
  quiet_accumulation:   'rgba(201,168,76,0.06)',
  distribution_warning: 'rgba(248,113,113,0.06)',
  conviction_flow:      'rgba(124,106,247,0.06)',
  breakout_surge:       'rgba(74,222,128,0.06)',
  stage_2_leaders:      'rgba(245,158,11,0.06)',
  stage_2_watch:        'rgba(245,158,11,0.06)',
  vani_opportunity:     'rgba(124,106,247,0.06)',
  stage_4_leaders:      'rgba(248,113,113,0.06)',
  stage_3_watch:        'rgba(249,115,22,0.06)',
  vani_exit_watch:      'rgba(248,113,113,0.06)',
}

// Tags per preset
const TAGS: Record<string, string[]> = {
  power_buy:            ['industry-aware', 'multi-signal'],
  power_sell:           ['industry-aware', 'multi-signal'],
  smart_money:          ['accumulation', 'institutional'],
  fresh_breakout:       ['momentum', 'volume-confirmed'],
  quiet_accumulation:   ['contrarian', 'under-radar'],
  distribution_warning: ['risk', 'exit-watch'],
  conviction_flow:      ['delivery', 'institutional'],
  breakout_surge:       ['momentum', 'high-rvol'],
  stage_2_leaders:      ['trend-following', 'stage2', 'golden-cross'],
  stage_2_watch:        ['stage2', 'pre-breakout'],
  vani_opportunity:     ['vani', 'alpha-edge', 'rs-top20pct'],
  stage_4_leaders:      ['stage4', 'death-cross', 'risk-watch'],
  stage_3_watch:        ['stage3', 'topping', 'early-warning'],
  vani_exit_watch:      ['vani', 'stage4', 'rs-bottom20pct'],
}

const TAG_COLOR: Record<string, { color: string; border: string }> = {
  'industry-aware':    { color: '#2dd4bf', border: 'rgba(45,212,191,0.3)' },
  'multi-signal':      { color: '#7c6af7', border: 'rgba(124,106,247,0.3)' },
  'accumulation':      { color: '#c9a84c', border: 'rgba(201,168,76,0.3)' },
  'institutional':     { color: '#2dd4bf', border: 'rgba(45,212,191,0.3)' },
  'momentum':          { color: '#4ade80', border: 'rgba(74,222,128,0.3)' },
  'volume-confirmed':  { color: '#7c6af7', border: 'rgba(124,106,247,0.3)' },
  'contrarian':        { color: '#c9a84c', border: 'rgba(201,168,76,0.3)' },
  'under-radar':       { color: '#6b7280', border: 'rgba(107,114,128,0.3)' },
  'risk':              { color: '#f87171', border: 'rgba(248,113,113,0.3)' },
  'exit-watch':        { color: '#f87171', border: 'rgba(248,113,113,0.3)' },
  'delivery':          { color: '#c9a84c', border: 'rgba(201,168,76,0.3)' },
  'high-rvol':         { color: '#4ade80', border: 'rgba(74,222,128,0.3)' },
  'trend-following':   { color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  'stage2':            { color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  'golden-cross':      { color: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
  'pre-breakout':      { color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  'vani':              { color: '#7c6af7', border: 'rgba(124,106,247,0.3)' },
  'alpha-edge':        { color: '#7c6af7', border: 'rgba(124,106,247,0.3)' },
  'rs-top20pct':       { color: '#2dd4bf', border: 'rgba(45,212,191,0.3)' },
  'stage4':            { color: '#f87171', border: 'rgba(248,113,113,0.3)' },
  'death-cross':       { color: '#f87171', border: 'rgba(248,113,113,0.3)' },
  'risk-watch':        { color: '#f87171', border: 'rgba(248,113,113,0.3)' },
  'stage3':            { color: '#f97316', border: 'rgba(249,115,22,0.3)' },
  'topping':           { color: '#f97316', border: 'rgba(249,115,22,0.3)' },
  'early-warning':     { color: '#f97316', border: 'rgba(249,115,22,0.3)' },
  'rs-bottom20pct':    { color: '#f87171', border: 'rgba(248,113,113,0.3)' },
}

export default function ScannersSection() {
  const navigate = useNavigate()

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 300,
          color: 'var(--text-primary)',
          letterSpacing: '-0.03em',
          marginBottom: 6,
        }}>
          Scan<em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>ners</em>
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Nine pre-built market scans. All logic runs in TypeScript — no backend needed.
          Click any scanner to open it with full results.
        </p>
      </div>

      {/* Scanner list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SCAN_PRESETS.map(preset => {
          const icon   = ICONS[preset.id] ?? '◌'
          const accent = ACCENT[preset.id] ?? '#6b7280'
          const bg     = ACCENT_BG[preset.id] ?? 'color-mix(in srgb, var(--text-primary) 2%, transparent)'
          const tags   = TAGS[preset.id] ?? []

          return (
            <div
              key={preset.id}
              onClick={() => navigate(`/scanner/${preset.id}`)}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                background: 'color-mix(in srgb, var(--text-primary) 2%, transparent)',
                padding: '16px 18px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'color-mix(in srgb, var(--text-primary) 14%, transparent)'
                el.style.background = 'color-mix(in srgb, var(--text-primary) 4%, transparent)'
                el.style.transform = 'translateX(3px)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'var(--border)'
                el.style.background = 'color-mix(in srgb, var(--text-primary) 2%, transparent)'
                el.style.transform = ''
              }}
            >
              {/* Icon */}
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: bg,
                border: `1px solid ${accent}33`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                color: accent,
                fontFamily: 'var(--font-display)',
                flexShrink: 0,
              }}>
                {icon}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  marginBottom: 3,
                }}>
                  {preset.name}
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.45,
                  marginBottom: 8,
                }}>
                  {preset.tooltip ?? preset.description}
                </div>

                {/* Tags */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {tags.map(tag => {
                    const tc = TAG_COLOR[tag] ?? { color: '#6b7280', border: 'rgba(107,114,128,0.3)' }
                    return (
                      <span
                        key={tag}
                        style={{
                          fontSize: 9,
                          fontFamily: 'var(--font-mono, monospace)',
                          padding: '2px 7px',
                          borderRadius: 3,
                          border: `1px solid ${tc.border}`,
                          color: tc.color,
                        }}
                      >
                        {tag}
                      </span>
                    )
                  })}
                  <span style={{
                    fontSize: 9,
                    fontFamily: 'var(--font-mono, monospace)',
                    padding: '2px 7px',
                    borderRadius: 3,
                    border: '1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)',
                    color: 'var(--text-muted)',
                  }}>
                    {preset.universe === 'NSE_ONLY' ? 'NSE only' : 'NSE + BSE'}
                  </span>
                </div>
              </div>

              {/* Right: limit + chevron */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 13,
                  color: 'var(--text-primary)',
                }}>
                  top {preset.limit}
                </div>
                <div style={{
                  fontSize: 9,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono, monospace)',
                  marginTop: 2,
                  marginBottom: 10,
                }}>
                  results
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono, monospace)',
                }}>
                  Open →
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer note */}
      <div style={{
        marginTop: 24,
        padding: '14px 18px',
        borderRadius: 10,
        border: '1px dashed color-mix(in srgb, var(--text-primary) 8%, transparent)',
        fontSize: 12,
        color: 'var(--text-muted)',
        lineHeight: 1.6,
      }}>
        Scanner results update on each run — data is fetched live from{' '}
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11 }}>km_equity_eod</span>{' '}
        and{' '}
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11 }}>km_industry_eod</span>.
        All logic runs in the browser via{' '}
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11 }}>scanEngine.ts</span>.
      </div>
    </div>
  )
}
