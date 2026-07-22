// The deterministic "what does this mean" read for a rule — plain-language
// paragraphs + fine-print stat lines, generated from km_rule_evidence with NO
// LLM (services/ruleInterpretation.ts). This is the right-click interpretation
// surface; the hover tooltip carries only the one-line summary.

import { useQuery } from '@tanstack/react-query'
import { fetchEvidence } from '@/pages/RuleEngine/ruleService'
import { buildRuleRead, patternLines } from '@/services/ruleInterpretation'

export default function RuleEvidenceRead({ ruleId }: { ruleId: number | null }) {
  const { data: evidenceRows } = useQuery({
    queryKey: ['rule-engine', 'evidence'],
    queryFn: fetchEvidence,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  if (ruleId == null) return null
  const ev = (evidenceRows ?? []).find(e => e.rule_id === ruleId)
  if (!ev) return null

  const read = buildRuleRead(ev)
  const stats = patternLines(ev)

  return (
    <div style={{ marginTop: 10 }}>
      {/* Role chip — readiness framing, never direction */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
        <span style={{
          fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
          padding: '2px 7px', borderRadius: 4,
          fontFamily: 'var(--font-mono,monospace)',
          background: read.role === 'watch'
            ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
            : 'color-mix(in srgb, var(--text-primary) 7%, transparent)',
          color: read.role === 'watch' ? 'var(--accent)' : 'var(--text-muted)',
        }}>
          {read.role === 'watch' ? '◈ watch days' : 'orientation'}
        </span>
      </div>

      {/* The read */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {read.paragraphs.map((para, i) => (
          <p key={i} style={{
            fontSize: 11.5, lineHeight: 1.55, margin: 0,
            color: i === read.paragraphs.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}>
            {para}
          </p>
        ))}
      </div>

      {/* Fine print — the numbers behind the read */}
      {stats.length > 0 && (
        <div style={{
          marginTop: 9, paddingTop: 7,
          borderTop: '1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)',
          fontSize: 9.5, lineHeight: 1.6,
          fontFamily: 'var(--font-mono,monospace)',
          color: 'color-mix(in srgb, var(--text-primary) 45%, transparent)',
        }}>
          {stats.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  )
}
