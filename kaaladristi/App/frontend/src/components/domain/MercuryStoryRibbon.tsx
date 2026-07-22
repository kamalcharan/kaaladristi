// Mercury story ribbon — one compact line above the chart naming Mercury's
// current chapter. POA-astro-layer §Phase A. Orientation language only — no
// verdicts.
//   ☿ direct in Cancer · combust (glare) until 24 Jul
// This ribbon owns "what's Mercury doing right now" only — "what's coming"
// lives on the Almanac (/almanac), linked via the "full calendar →"
// affordance (simplified 2026-07-23: dropped the horizon-clamped "next:"
// event tail + lock chip that used to live here, now the Almanac's job).
//
// Click the ribbon body → the SAME 'index.astro_now' VaNi intent the header
// "Ask VaNi" button lists on this page (owner 2026-07-22: "local page-level
// VaNi and global VaNi both coordinate to show the same intents required in
// the page" — one system, not a bespoke popover). Answered deterministically
// server-side (lib/astro_narration.py, no LLM) and cached in km_vani_cache.

import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { fetchMercuryStory } from '@/services/mercuryStory'
import { ASTRO_GROUP_OVERLAYS } from '@/constants/astroGroupOverlays'
import { useVaNiStore } from '@/stores/vaniStore'

const MERCURY_COLOR =
  ASTRO_GROUP_OVERLAYS.find(g => g.tag === 'Mercury')?.color ?? 'var(--accent)'

function fmtD(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function MercuryStoryRibbon({ overlay = false }: { overlay?: boolean }) {
  const openWithIntent = useVaNiStore(s => s.openWithIntent)
  const navigate = useNavigate()

  const { data: story } = useQuery({
    queryKey: ['mercury-story'],
    queryFn: fetchMercuryStory,
    staleTime: 30 * 60_000,
    retry: 1,
  })

  if (!story) return null

  const today = new Date().toISOString().slice(0, 10)
  // Readiness (owner's core use: advance notice — "event is coming, be
  // ready"; not bull or bear). Zone = watch-day ±2 sessions.
  const zone = story.watchZone && story.watchZone.until >= today ? story.watchZone : null

  return (
    <div
      onClick={() => openWithIntent('index.astro_now')}
      title="Ask VaNi — What's Mercury doing right now?"
      style={{
      display: 'flex', alignItems: 'center', gap: 8,
      flexWrap: overlay ? 'nowrap' : 'wrap',
      padding: '4px 10px',
      borderRadius: 6, cursor: 'pointer',
      border: `1px solid color-mix(in srgb, ${MERCURY_COLOR} 18%, transparent)`,
      background: overlay
        ? 'color-mix(in srgb, var(--card) 88%, transparent)'
        : `color-mix(in srgb, ${MERCURY_COLOR} 5%, transparent)`,
      fontSize: 11, fontFamily: 'var(--font-mono, monospace)',
      color: 'var(--text-secondary)',
      ...(overlay
        ? {
            position: 'absolute' as const, top: 6, left: '50%',
            transform: 'translateX(-50%)', zIndex: 15,
            whiteSpace: 'nowrap' as const,
            maxWidth: 'calc(100% - 90px)', overflow: 'hidden',
          }
        : { marginBottom: 6 }),
    }}>
      <span style={{ fontSize: 13, lineHeight: 1 }}>☿</span>
      {zone && (
        <span
          title="Watch window — trend changes have historically clustered within ±2 days of this event; the previous day's high/low is the reference level"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '1px 7px', borderRadius: 4,
            background: 'color-mix(in srgb, var(--accent) 18%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent) 45%, transparent)',
            color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.04em',
          }}
        >
          ◈ WATCH ±2d · {zone.label} {fmtD(zone.date)} · prev-day H/L in focus
        </span>
      )}
      <span>
        {story.motion} {story.sign ? `in ${story.sign}` : ''}
        {story.combustUntil && (
          <span style={{ color: 'var(--caution)' }}>
            {' '}· combust{story.combustStage ? ` (${story.combustStage})` : ''} until {fmtD(story.combustUntil)}
          </span>
        )}
      </span>
      <span
        onClick={e => { e.stopPropagation(); navigate('/almanac') }}
        title="See the full Mercury calendar"
        style={{
          marginLeft: 'auto', fontSize: 10, whiteSpace: 'nowrap',
          color: MERCURY_COLOR,
        }}
      >
        ◈ full calendar →
      </span>
      {/* Visible affordance — no hidden gesture required */}
      <span style={{ fontSize: 9, color: 'color-mix(in srgb, var(--text-primary) 32%, transparent)', whiteSpace: 'nowrap' }}>
        ✦ ask VaNi ▸
      </span>
    </div>
  )
}
