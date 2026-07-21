// Mercury story ribbon — one compact line above the chart naming the current
// chapter and (within the tier's forward horizon) what comes next.
// POA-astro-layer §Phase A. Orientation language only — no verdicts.
//   ☿ direct in Cancer · combust (glare) until 24 Jul · next: enters Leo 6 Aug
// The "next:" tail is horizon-clamped (§Phase C); a lock chip marks that more
// exists beyond the horizon for free/quarterly users.

import { useQuery } from '@tanstack/react-query'
import { fetchMercuryStory, type MercuryEvent } from '@/services/mercuryStory'
import { useAstroHorizon } from '@/hooks/useAstroHorizon'
import { ASTRO_GROUP_OVERLAYS } from '@/constants/astroGroupOverlays'

const MERCURY_COLOR =
  ASTRO_GROUP_OVERLAYS.find(g => g.tag === 'Mercury')?.color ?? 'var(--accent)'

function fmtD(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function MercuryStoryRibbon() {
  const { cutoffIso, fullQuarter } = useAstroHorizon()

  const { data: story } = useQuery({
    queryKey: ['mercury-story'],
    queryFn: fetchMercuryStory,
    staleTime: 30 * 60_000,
    retry: 1,
  })

  if (!story) return null

  const visible: MercuryEvent[] = story.upcoming.filter(e => e.date <= cutoffIso)
  const lockedCount = story.upcoming.length - visible.length
  const next = visible.slice(0, 2)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      padding: '4px 10px', marginBottom: 6,
      borderRadius: 6,
      border: `1px solid color-mix(in srgb, ${MERCURY_COLOR} 18%, transparent)`,
      background: `color-mix(in srgb, ${MERCURY_COLOR} 5%, transparent)`,
      fontSize: 11, fontFamily: 'var(--font-mono, monospace)',
      color: 'var(--text-secondary)',
    }}>
      <span style={{ fontSize: 13, lineHeight: 1 }}>☿</span>
      <span>
        {story.motion} {story.sign ? `in ${story.sign}` : ''}
        {story.combustUntil && (
          <span style={{ color: 'var(--caution)' }}>
            {' '}· combust{story.combustStage ? ` (${story.combustStage})` : ''} until {fmtD(story.combustUntil)}
          </span>
        )}
      </span>
      {next.length > 0 && (
        <span style={{ color: 'var(--text-muted)' }}>
          · next:{' '}
          {next.map((e, i) => (
            <span key={`${e.date}-${e.label}`}>
              {i > 0 && ' · '}
              <span style={{ color: e.watchDay ? 'var(--accent)' : 'var(--text-secondary)' }}>
                {e.label} {fmtD(e.date)}{e.watchDay ? ' ◈' : ''}
              </span>
            </span>
          ))}
        </span>
      )}
      {!fullQuarter && lockedCount > 0 && (
        <span
          title={`${lockedCount} more event${lockedCount > 1 ? 's' : ''} this quarter — annual plan sees 90 days ahead`}
          style={{
            marginLeft: 'auto', fontSize: 10,
            color: 'color-mix(in srgb, var(--text-primary) 40%, transparent)',
            whiteSpace: 'nowrap', cursor: 'default',
          }}
        >
          🔒 +{lockedCount} this quarter
        </span>
      )}
    </div>
  )
}
