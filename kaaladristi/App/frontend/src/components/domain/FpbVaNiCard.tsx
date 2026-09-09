import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  useFpbRecentOutcomes,
  useFpbWhyWatchCoil,
  useFpbCoilingIndustries,
  useFpbConfluenceOutlook,
} from '@/hooks/useDashboardExtras'

/**
 * FpbVaNiCard — the VaNi companion card for Flower Pot Burst.
 *
 * Flower Pot is deliberately NOT a Studio preset (gap audit §5: its
 * three-phase layout is not to be unified), and ScannerStudio's
 * ScannerVaNiCard is the Studio's own — it posts a facts payload through
 * useVaNiAsk for the seven `scanner.*` intents. The four `fpb.*` intents are
 * plain GET endpoints returning {insight, ai}, so this renders the same card
 * against that simpler contract rather than widening the Studio card to
 * serve two transports.
 *
 * Markup and tokens intentionally mirror ScannerVaNiCard so a reader moving
 * here from Breakout Surge meets the same object.
 */

type FpbIntentKey = 'recent_outcomes' | 'why_watch_coil' | 'coiling_industries' | 'confluence_outlook'

const QUESTIONS: { key: FpbIntentKey; question: string }[] = [
  { key: 'recent_outcomes', question: 'How are active coils performing?' },
  { key: 'why_watch_coil', question: 'Why does tightness matter?' },
  { key: 'coiling_industries', question: 'Which industries are coiling?' },
  { key: 'confluence_outlook', question: 'Which coils have the strongest setup?' },
]

export default function FpbVaNiCard() {
  const [intent, setIntent] = useState<FpbIntentKey | null>(null)

  // All four run unconditionally (rules of hooks); `enabled` keeps the fetch
  // to the selected question, so opening the page costs no LLM calls.
  const outcomes = useFpbRecentOutcomes(intent === 'recent_outcomes')
  const tightness = useFpbWhyWatchCoil(intent === 'why_watch_coil')
  const industries = useFpbCoilingIndustries(intent === 'coiling_industries')
  const confluence = useFpbConfluenceOutlook(intent === 'confluence_outlook')

  const byIntent = {
    recent_outcomes: outcomes,
    why_watch_coil: tightness,
    coiling_industries: industries,
    confluence_outlook: confluence,
  } as const

  const active = intent ? byIntent[intent] : null
  const insight = active?.data?.insight ?? null

  const pillStyle: React.CSSProperties = {
    border: '1px solid var(--border-indigo)', color: 'var(--indigo)', background: 'transparent',
    borderRadius: 100, padding: '8px 14px', fontSize: 12.5, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'var(--font-body)', maxWidth: '100%', textAlign: 'left',
  }
  const activePillStyle: React.CSSProperties = { ...pillStyle, background: 'var(--indigo-bg)', fontWeight: 700 }

  return (
    <div
      className="rounded-lg overflow-hidden border border-accent-indigo/20 bg-[var(--kd-card)]"
      style={{ marginBottom: 18 }}
    >
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-indigo/[0.13] border-b border-accent-indigo/25">
        <span className="w-[15px] h-[15px] rounded-[4px] bg-accent-indigo flex items-center justify-center shrink-0">
          <span className="text-white text-[8px] leading-none select-none">✦</span>
        </span>
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-accent-indigo">VaNi</span>
        <span className="text-[8px] text-accent-indigo/60 tracking-wide">वाणी</span>
      </div>
      <div className="px-3 py-2.5">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: intent ? 10 : 0 }}>
          {QUESTIONS.map((q) => (
            <button
              key={q.key}
              onClick={() => setIntent((p) => (p === q.key ? null : q.key))}
              style={intent === q.key ? activePillStyle : pillStyle}
            >
              {q.question}
            </button>
          ))}
        </div>
        {!intent && (
          <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>
            Pick a question above — VaNi answers in a couple of lines.
          </p>
        )}
        {intent && (
          active?.isPending || active?.isFetching ? (
            <div className="flex items-center gap-1.5 text-muted">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[10px]">Consulting VaNi…</span>
            </div>
          ) : insight ? (
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
              {insight}
            </p>
          ) : (
            <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: 0 }}>
              VaNi has nothing to report for this question today.
            </p>
          )
        )}
      </div>
    </div>
  )
}
