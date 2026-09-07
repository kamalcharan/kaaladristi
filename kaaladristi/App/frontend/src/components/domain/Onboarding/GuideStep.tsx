/**
 * GuideStep — setup step 4, "How VaNi will guide you".
 *
 * The exit is a bookmark, not a plan: three ranked picks (one per "act on"
 * preset, the same fetch step 2 used), each with the app's own ☆ toggle.
 * "Show me three others" walks down the ranking. Under it, the persona's
 * four scanners as the checklist the How-to-use-DristiQ page will carry with
 * live Show-me tours once the user is inside. Skip is allowed.
 */
import { useState } from 'react'
import { useIsPhone } from '@/hooks/useMediaQuery'
import { useActsOnRows } from '@/hooks/useOnboardingScans'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import BookmarkToggle from '@/components/domain/BookmarkToggle'
import { Avatar, CardExchangeBadge } from '@/components/domain/ScanCardShell'
import { displaySymbol } from '@/lib/symbolUtils'
import { getPresetMeta } from '@/services/scanEngine'
import { ACTS_ON_IDS, ACTS_ON_PRESETS, PERSONAS, PERSONA_SCANNERS, type Persona } from '@/constants/personaConfig'
import type { ScanStock } from '@/types'
import { ActionIsland, GhostButton, MONO, PrimaryButton, Question, SectionLabel, fmtInr } from './ui'

function PickRow({ stock, presetName }: { stock: ScanStock; presetName: string }) {
  const d = stock.d_pct ?? stock.pct_chng
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12,
      background: 'var(--card)', border: '1px solid var(--border)', minWidth: 0 }}>
      <Avatar symbol={stock.symbol} isVani={!!stock.vaniOpportunity} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{displaySymbol(stock)}</span>
          <CardExchangeBadge exchange={stock.exchange} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {presetName}{stock.industry ? ` · ${stock.industry}` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right', fontFamily: MONO, flexShrink: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{fmtInr(stock.close)}</div>
        {d != null && (
          <div style={{ fontSize: 11, color: d >= 0 ? 'var(--bull)' : 'var(--bear)' }}>{d >= 0 ? '+' : ''}{d.toFixed(2)}%</div>
        )}
      </div>
      <BookmarkToggle equityId={stock.equity_id} size={20} />
    </div>
  )
}

export default function GuideStep({ persona, onContinue }: { persona: Persona; onContinue: () => void }) {
  const phone = useIsPhone()
  const data = useActsOnRows()
  const [offset, setOffset] = useState(0)
  const bookmarked = useBookmarkStore(s => s.bookmarkedIds)

  const picks = ACTS_ON_IDS.flatMap(k => {
    const s = data.rows[k][offset]
    return s ? [{ stock: s, presetName: getPresetMeta(ACTS_ON_PRESETS[k])?.name ?? ACTS_ON_PRESETS[k] }] : []
  })
  const seen = new Set<number>()
  const uniquePicks = picks.filter(p => (seen.has(p.stock.equity_id) ? false : (seen.add(p.stock.equity_id), true)))
  const maxDepth = Math.max(...ACTS_ON_IDS.map(k => data.rows[k].length), 1)
  const pickedCount = uniquePicks.filter(p => bookmarked.has(p.stock.equity_id)).length
  const anyBookmark = bookmarked.size > 0

  const scanners = PERSONA_SCANNERS[persona]
    .map(id => getPresetMeta(id))
    .filter((m): m is NonNullable<typeof m> => !!m)

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: phone ? '20px 14px 120px' : '36px 24px 120px',
        display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div>
          <SectionLabel>Step 4 of 6 · How VaNi will guide you</SectionLabel>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: phone ? 24 : 30, fontWeight: 300,
            letterSpacing: '-0.03em', color: 'var(--text-primary)', margin: 0 }}>
            Pick one name to watch this week.
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.55 }}>
            Tomorrow's Morning Brief opens with the name you pick. Bookmarks live under My Bookmarks, and you can change them any time.
          </p>
        </div>

        <section data-tour="onboarding-picks">
          <Question n={1} text="Today's three, one per setup type" />
          {uniquePicks.length === 0 ? (
            <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)', padding: '12px 0' }}>
              {data.loading ? 'Reading today\'s market…' : 'No live setups to show today — you can bookmark from any scanner once inside.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {uniquePicks.map(p => <PickRow key={p.stock.equity_id} stock={p.stock} presetName={p.presetName} />)}
            </div>
          )}
          {maxDepth > 1 && (
            <button type="button" onClick={() => setOffset(o => (o + 1 >= maxDepth ? 0 : o + 1))}
              style={{ marginTop: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontSize: 12, color: 'var(--accent)', fontFamily: 'inherit' }}>
              Show me three others →
            </button>
          )}
        </section>

        <section data-tour="onboarding-scanners">
          <Question n={2} text={`Your ${PERSONAS[persona].label.toLowerCase()} scanners`}
            sub="Once you're in, How to use DristiQ lists these with a live Show-me walk for each." />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {scanners.map((m, i) => (
              <div key={m.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px',
                borderRadius: 12, background: 'var(--card)', border: '1px solid var(--border)' }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>0{i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>{m.description}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <ActionIsland text={anyBookmark ? `${pickedCount || bookmarked.size} bookmarked — VaNi will pick it up tomorrow.` : 'Tap ☆ on one name, or continue without.'}>
        {anyBookmark ? (
          <PrimaryButton onClick={onContinue} style={{ padding: '8px 16px', fontSize: 12 }}>Continue →</PrimaryButton>
        ) : (
          <GhostButton onClick={onContinue} style={{ padding: '8px 14px', fontSize: 12 }}>Continue without</GhostButton>
        )}
      </ActionIsland>
    </div>
  )
}
