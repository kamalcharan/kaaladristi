import ScannerResponseCard from './VaNi/ScannerResponseCard'
import {revealVaniReading} from '@/lib/vaniNavigation'
import React, { useEffect } from 'react'
import {useSearchParams} from 'react-router-dom'
import type {FpbGroup} from '@/hooks/useDashboardExtras'
import {trackEvent} from '@/lib/analytics'
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

export default function FpbVaNiCard({symbols=[], onCohort, sessionDate}:{symbols?:string[]; sessionDate?:string; onCohort?:(group:FpbGroup|null)=>void}) {
  const [params, setParams] = useSearchParams()
  const selected = params.get('fpb_intent')
  const intent = QUESTIONS.some(q=>q.key===selected) ? selected as FpbIntentKey : null
  const setIntent = (key:FpbIntentKey) => {
    const next=new URLSearchParams(params); next.set('fpb_intent',key); next.delete('fpb_group'); next.delete('fpb_asof'); setParams(next)
    trackEvent('scanner_intent_selected',{preset_id:'flower_pot_burst',intent:key})
  }

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
  const data=active?.data
  const groupKey=params.get('fpb_group')
  const group=data?.groups?.find(g=>g.key===groupKey)
  const stale=!!groupKey && !!data && (params.get('fpb_asof')!==data.date || (!!sessionDate && !group?.releases && data.date!==sessionDate))
  useEffect(()=>{onCohort?.(!stale && group && !group.releases ? group : null)},[group,stale,onCohort])
  const linkFor=(key:string)=>{
    const next=new URLSearchParams(params); next.set('fpb_group',key); next.set('fpb_asof',data?.date??''); return `?${next.toString()}#fpb-results`
  }

  const pillStyle: React.CSSProperties = {
    border: '1px solid var(--border-indigo)', color: 'var(--indigo)', background: 'transparent',
    borderRadius: 10, padding: '11px 12px', fontSize: 12.5, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'var(--font-body)', maxWidth: '100%', textAlign: 'left',
  }
  const activePillStyle: React.CSSProperties = { ...pillStyle, background: 'var(--indigo-bg)', fontWeight: 700 }

  return (
    <ScannerCompanionShell presetId="flower_pot_burst" activeQuestion={!!intent} subtitle="Flower Pot Burst · Coil research">
      <p className="text-sm text-muted">Explore forming coils and inspect how recent setups performed.</p>
        {intent && <h3 className="font-semibold text-sm">{QUESTIONS.find(q=>q.key===intent)?.question}</h3>}
        {!intent && (
          <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>
            Explore forming coils, participation and outcomes below.
          </p>
        )}
        {intent && (
          active?.isPending || active?.isFetching ? (
            <VaNiConsulting/>
          ) : active?.isError ? (<div role="alert">VaNi could not prepare this explanation. <button className="sector-question" onClick={()=>active.refetch()}>Try again</button></div>) : insight ? (
            <>
            <ScannerResponseCard response={insight} symbols={symbols} date={data?.date} title={QUESTIONS.find(q=>q.key===intent)?.question}/>
            <div className="vani-followups">{data?.groups?.map(g=><a className="sector-question" style={{display:'block',marginTop:8}} key={g.key} href={linkFor(g.key)} onClick={e=>{e.preventDefault(); const url=new URL(e.currentTarget.href); setParams(url.searchParams); trackEvent('scanner_results_opened',{preset_id:'flower_pot_burst',intent,group:g.key}); requestAnimationFrame(()=>document.getElementById(g.releases?'fpb-outcomes':'fpb-results')?.scrollIntoView({behavior:'smooth',block:'start'}))}}>{g.label} · <strong>{g.releases?.length??g.equity_ids.length}</strong> →</a>)}</div>
            {groupKey && data && !group && <p role="alert">This result group is unavailable. Select a current result above.</p>}
            {stale && <p role="alert">This saved view belongs to a different session. Historical Flower Pot results are unavailable here. Choose a current result above to update the link.</p>}
            {!stale && group?.releases && <div id="fpb-outcomes" className="vani-followups"><h4>{group.label}</h4><p className="text-xs text-muted">Current recorded statuses for releases in the last 180 days; this is not a historical status snapshot.</p>{group.releases.length===0?<p>No releases in this period.</p>:group.releases.map(r=><a className="sector-question" style={{display:'block',marginTop:8}} key={`${r.equity_id}-${r.release_date}`} href={`/chart/equity/${r.equity_id}`}><strong>{r.symbol}</strong> · {r.release_date} · {r.status.replaceAll('_',' ').toLowerCase()}</a>)}</div>}
            </>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>
              VaNi has nothing to report for this intent today.
            </p>
          )
        )}
      <nav className="vani-followups" onClick={revealVaniReading}><p>Continue your research</p>
        <div className="scanner-questions">
          {QUESTIONS.filter(q=>q.key!==intent).map((q) => (
            <button
              key={q.key}
              aria-pressed={intent===q.key}
              onClick={() => setIntent(q.key)}
              style={intent === q.key ? activePillStyle : pillStyle}
            >
              {q.question}
            </button>
          ))}
        </div>
      </nav>
    </ScannerCompanionShell>
  )
}
