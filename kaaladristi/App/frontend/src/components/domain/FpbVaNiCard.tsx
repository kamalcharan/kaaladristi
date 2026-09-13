import React, { useState } from 'react'
import ScannerCompanionShell from './VaNi/ScannerCompanionShell'
import {VaNiConsulting} from './VaNi/VaNiBrand'
import {
  useFpbRecentOutcomes,
  useFpbWhyWatchCoil,
  useFpbCoilingIndustries,
  useFpbConfluenceOutlook,
  useFpbNewCoils,
} from '@/hooks/useDashboardExtras'

/**
 * FpbVaNiCard — the VaNi companion card for Flower Pot Burst.
 *
 * Flower Pot is deliberately NOT a Studio preset (gap audit §5: its
 * three-phase layout is not to be unified), and ScannerStudio's
 * ScannerVaNiCard is the Studio's own — it posts a facts payload through
 * useVaNiAsk for the seven `scanner.*` intents. The five `fpb.*` intents are
 * plain GET endpoints returning {insight, ai}, so this renders the same card
 * against that simpler contract rather than widening the Studio card to
 * serve two transports.
 *
 * Markup and tokens intentionally mirror ScannerVaNiCard so a reader moving
 * here from Breakout Surge meets the same object.
 */

type FpbIntentKey =
  | 'new_coils' | 'recent_outcomes' | 'why_watch_coil' | 'coiling_industries' | 'confluence_outlook'

const QUESTIONS: { key: FpbIntentKey; question: string }[] = [
  { key: 'new_coils', question: 'What is newly coiling today?' },
  { key: 'recent_outcomes', question: 'How are active coils performing?' },
  { key: 'why_watch_coil', question: 'Why does tightness matter?' },
  { key: 'coiling_industries', question: 'Which industries are coiling?' },
  { key: 'confluence_outlook', question: 'Which coils have the strongest setup?' },
]

export default function FpbVaNiCard() {
  const [intent, setIntent] = useState<FpbIntentKey | null>(null)

  // All five run unconditionally (rules of hooks); `enabled` keeps the fetch
  // to the selected question, so opening the page costs no LLM calls.
  const newCoils = useFpbNewCoils(intent === 'new_coils')
  const outcomes = useFpbRecentOutcomes(intent === 'recent_outcomes')
  const tightness = useFpbWhyWatchCoil(intent === 'why_watch_coil')
  const industries = useFpbCoilingIndustries(intent === 'coiling_industries')
  const confluence = useFpbConfluenceOutlook(intent === 'confluence_outlook')

  const byIntent = {
    new_coils: newCoils,
    recent_outcomes: outcomes,
    why_watch_coil: tightness,
    coiling_industries: industries,
    confluence_outlook: confluence,
  } as const

  const active = intent ? byIntent[intent] : null
  const insight = active?.data?.insight ?? null

  const pillStyle: React.CSSProperties = {
    border: '1px solid var(--border-indigo)', color: 'var(--indigo)', background: 'transparent',
    borderRadius: 10, padding: '11px 12px', fontSize: 12.5, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'var(--font-body)', maxWidth: '100%', textAlign: 'left',
  }
  const activePillStyle: React.CSSProperties = { ...pillStyle, background: 'var(--indigo-bg)', fontWeight: 700 }

  return (
    <ScannerCompanionShell subtitle="Flower Pot Burst · Coil research">
      <p className="text-sm text-muted">Explore forming coils and inspect how recent setups performed.</p>
      <details open><summary>Explore scanner questions</summary>
        <div className="scanner-questions">
          {QUESTIONS.map((q) => (
            <button
              key={q.key}
              aria-pressed={intent===q.key}
              onClick={() => setIntent((p) => (p === q.key ? null : q.key))}
              style={intent === q.key ? activePillStyle : pillStyle}
            >
              {q.question}
            </button>
          ))}
        </div>
      </details>
        {intent && <h3 className="font-semibold text-sm">{QUESTIONS.find(q=>q.key===intent)?.question}</h3>}
        {!intent && (
          <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>
            Pick a question above — VaNi answers in a couple of lines.
          </p>
        )}
        {intent && (
          active?.isPending || active?.isFetching ? (
            <VaNiConsulting/>
          ) : active?.isError ? (<div role="alert">VaNi could not prepare this explanation. <button className="sector-question" onClick={()=>active.refetch()}>Try again</button></div>) : insight ? (
            <p className="text-sm text-[var(--text-primary)] leading-7 whitespace-pre-line">
              {insight}
            </p>
          ) : (
            <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: 0 }}>
              VaNi has nothing to report for this question today.
            </p>
          )
        )}
    </ScannerCompanionShell>
  )
}
