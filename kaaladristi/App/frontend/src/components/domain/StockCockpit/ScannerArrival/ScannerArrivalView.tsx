/**
 * ScannerArrivalView — editorial Story View shell.
 *
 * Renders inside ChartView's Chart & Replay tab when the URL carries
 * ?setup=<preset>. Layout matches the owner-approved editorial mock
 * (Solara reference deck):
 *
 *   ┌────────────────────────────────────────────────────────────┐
 *   │  MASTHEAD  · Setup crumb · Company name · Phase pill · Thesis line
 *   ├────────────────────────────────────────────────────────────┤
 *   │  CHART HERO — cycle bands · candles · EMA · key levels · markers
 *   ├────────────────────────────────────────────────────────────┤
 *   │  CURRENT SITUATION   │  LT (LENS)   │  SWING (LENS)         │
 *   ├────────────────────────────────────────────────────────────┤
 *   │  WHAT CONFIRMS · 6-item mixed structural / dynamic
 *   ├────────────────────────────────────────────────────────────┤
 *   │  EDITOR'S NOTE (italic tip)
 *   └────────────────────────────────────────────────────────────┘
 *
 * SEBI voice:
 *   · Personas are READING LENSES, not order-placers.
 *   · Levels are ZONES of setup activation, not entry orders.
 *   · No verbs like "add", "buy", "trade" in user-facing copy.
 *   · No SIZE column. No stops. No targets.
 *
 * See: docs/claude/scanner-story-page-poa.md
 */

import { Loader2 } from 'lucide-react';
import { useSetupData } from '@/hooks/useSetupData';
import EditorialWeeklyChart from './EditorialWeeklyChart';
import type { PersonaEntry, WhatConfirmsItem } from '@/services/thesis/setupAdapter';

interface Props {
  equityId: number;
  setupKey: string;
}

// Scoped editorial palette — inherits Kāla-Drishti CSS vars where they map,
// falls back to warm-editorial anchors when the app tokens don't cover it.
const T = {
  ground:  'var(--card)',
  ground2: 'var(--surface-2)',
  ink:     'var(--text-primary)',
  ink2:    'var(--text-secondary)',
  ink3:    'var(--text-muted)',
  rule:    'var(--border)',
  gold:    'var(--gold-soft)',
  bull:    'var(--risk-green)',
  bear:    'var(--risk-red)',
  lt:      'var(--accent-indigo)',
  sw:      'var(--risk-amber)',
  pending: 'var(--risk-amber)',
};

const SERIF = { fontFamily: "Fraunces, Georgia, serif" } as React.CSSProperties;
const SANS  = { fontFamily: "Inter, system-ui, sans-serif" } as React.CSSProperties;
const MONO  = { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontVariantNumeric: 'tabular-nums' } as React.CSSProperties;

export default function ScannerArrivalView({ equityId, setupKey }: Props) {
  const { data, weekly, isLoading, error } = useSetupData(equityId, setupKey);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 0', border: `1px solid ${T.rule}`, borderRadius: 4, background: T.ground,
      }}>
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: T.gold }} />
        <span style={{ ...SANS, marginLeft: 8, fontSize: 12, color: T.ink3 }}>
          Reading this setup…
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        border: `1px solid ${T.bear}55`, background: `${T.bear}18`, borderRadius: 4, padding: '14px 16px',
      }}>
        <p style={{ ...SANS, fontSize: 12, fontWeight: 600, color: T.bear, marginBottom: 4 }}>
          Couldn't build the setup view for this stock.
        </p>
        <p style={{ ...SANS, fontSize: 11, color: T.ink2, lineHeight: 1.4 }}>
          {error?.message ?? 'No data returned. Fresh listings and unknown setups sometimes surface this — refreshing later usually resolves it.'}
        </p>
      </div>
    );
  }

  const h = data.header;
  const cs = data.currentSituation;
  const kl = data.keyLevels;
  const pctChng = h.pctChng ?? 0;
  const phaseColor = h.phaseTone === 'bull' ? T.bull : h.phaseTone === 'bear' ? T.bear : T.ink2;
  const bandsN = data.chartAnnotations.cycleLabels.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '4px 0 16px' }}>

      {/* ── MASTHEAD ───────────────────────────────────────────── */}
      <header style={{
        display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 32,
        paddingBottom: 20, borderBottom: `1px solid ${T.rule}`,
      }}>
        <div>
          <div style={{ ...SANS, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.gold, fontWeight: 600, marginBottom: 10 }}>
            Setup Read · {data.setupLabel}
          </div>
          <h1 style={{
            ...SERIF, fontSize: 40, fontWeight: 500, lineHeight: 1.02,
            fontVariationSettings: '"opsz" 88', letterSpacing: '-0.02em', marginBottom: 8, color: T.ink,
          }}>
            {h.companyName ?? h.symbol}
          </h1>
          <div style={{ ...SANS, color: T.ink2, fontSize: 13 }}>
            <span style={MONO}>{h.exchange ?? '—'} · {h.symbol}</span>
            {h.industry && <><span style={{ color: T.ink3, margin: '0 8px' }}>·</span><span>{h.industry}</span></>}
            {h.rsPercentile != null && (
              <><span style={{ color: T.ink3, margin: '0 8px' }}>·</span><span style={MONO}>RS %ile {h.rsPercentile.toFixed(0)}</span></>
            )}
          </div>
        </div>
        <div style={{ alignSelf: 'end' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'baseline', gap: 8,
            padding: '6px 12px', border: `1px solid ${phaseColor}66`,
            background: `${phaseColor}14`, borderRadius: 3, color: phaseColor,
            ...SANS, fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12,
          }}>
            {h.phase}
            <span style={{ ...SANS, color: T.ink2, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'none', fontSize: 11 }}>
              · <span style={MONO}>₹{h.close.toFixed(2)}</span>
              &nbsp;· <span style={{ color: pctChng >= 0 ? T.bull : T.bear, ...MONO }}>
                {pctChng >= 0 ? '+' : ''}{pctChng.toFixed(2)}%
              </span>
            </span>
          </span>
          <p style={{
            ...SERIF, fontWeight: 400, fontSize: 17, lineHeight: 1.4, color: T.ink,
            fontVariationSettings: '"opsz" 24', maxWidth: '44ch',
          }}>
            <span style={{ fontStyle: 'italic', color: T.gold }}>{cs.verdict}</span>
            {' — '}{cs.narrative}
          </p>
        </div>
      </header>

      {/* ── CHART HERO ─────────────────────────────────────────── */}
      <EditorialWeeklyChart
        bars={weekly}
        annotations={data.chartAnnotations}
        personas={data.personas}
      />

      {/* ── SETUP GRID · 3 columns ─────────────────────────────── */}
      <section style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr 1fr', gap: 20 }}>
        {/* Current situation */}
        <Card>
          <CardHead title="Current Situation" eyebrow="Where we are" />
          <p style={{ ...SERIF, fontSize: 14, lineHeight: 1.5, color: T.ink, fontVariationSettings: '"opsz" 16' }}>
            {cs.narrative}
          </p>
          <KvGrid>
            <Kv label="Close"                value={fmtRs(h.close)} />
            <Kv label="Pivot"                value={fmtRs(kl.pivot)} />
            <Kv label="Immediate Resistance" value={fmtRs(kl.immediateResistance)} tone="bear" />
            <Kv label="Major Resistance"     value={fmtRs(kl.majorResistance)} tone="bear" />
            <Kv label="Immediate Support"    value={fmtRs(kl.immediateSupport)} tone="bull" />
            <Kv label="50-wk EMA"            value={fmtRs(kl.ema50Weekly)} />
          </KvGrid>
        </Card>

        {/* LT lens */}
        <PersonaCard
          persona="lt"
          heading="Long-Term Lens"
          sub="Weekly · patient"
          intent="Reads pullbacks into structure as the primary reference. Zones observed here have historically been where accumulation prevails."
          entries={data.personas.ltInvestor}
        />

        {/* Swing lens */}
        <PersonaCard
          persona="sw"
          heading="Swing Lens"
          sub="Daily · reactive"
          intent="Reads daily strength and reaction to near-term pivots. Zones are closer to the last bar and more time-sensitive."
          entries={data.personas.swingTrader}
        />
      </section>

      {/* ── WHAT CONFIRMS ──────────────────────────────────────── */}
      <WhatConfirmsSection items={data.whatConfirms} />

      {/* ── EDITOR'S NOTE ──────────────────────────────────────── */}
      {(data.investorTip || bandsN > 0) && (
        <footer style={{
          border: `1px solid ${T.rule}`, borderLeft: `3px solid ${T.gold}`,
          background: `linear-gradient(90deg, ${T.gold}0a, transparent 60%)`,
          padding: '16px 20px 18px', borderRadius: '0 4px 4px 0',
        }}>
          <div style={{ ...SANS, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: T.gold, fontWeight: 600, marginBottom: 6 }}>
            ✎ Editor's Note
          </div>
          <p style={{
            ...SERIF, fontVariationSettings: '"opsz" 20',
            fontSize: 14, lineHeight: 1.55, fontStyle: 'italic', color: T.ink, maxWidth: '90ch',
          }}>
            {data.investorTip ??
              `${bandsN} cycle regime${bandsN === 1 ? '' : 's'} detected on the weekly chart. Read the current regime and its confirmations before acting on the persona zones.`}
          </p>
        </footer>
      )}

    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <article style={{
      background: T.ground, border: `1px solid ${T.rule}`, borderRadius: 4,
      padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {children}
    </article>
  );
}

function CardHead({ title, eyebrow }: { title: string; eyebrow: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
      paddingBottom: 10, borderBottom: `1px solid ${T.rule}`,
    }}>
      <h3 style={{
        ...SERIF, fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em',
        fontVariationSettings: '"opsz" 32', color: T.ink,
        display: 'inline-flex', alignItems: 'center', gap: 8,
      }}>
        {title}
      </h3>
      <span style={{ ...SANS, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.ink3, fontWeight: 600 }}>
        {eyebrow}
      </span>
    </div>
  );
}

function KvGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px',
      paddingTop: 12, marginTop: 4, borderTop: `1px solid ${T.rule}`,
    }}>
      {children}
    </dl>
  );
}

function Kv({ label, value, tone }: { label: string; value: string; tone?: 'bull' | 'bear' }) {
  const color = tone === 'bull' ? T.bull : tone === 'bear' ? T.bear : T.ink;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <dt style={{ ...SANS, fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.ink3, fontWeight: 600 }}>
        {label}
      </dt>
      <dd style={{ ...MONO, fontSize: 13, fontWeight: 500, color }}>
        {value}
      </dd>
    </div>
  );
}

function PersonaCard({
  persona, heading, sub, intent, entries,
}: {
  persona: 'lt' | 'sw';
  heading: string;
  sub: string;
  intent: string;
  entries: PersonaEntry[];
}) {
  const color = persona === 'lt' ? T.lt : T.sw;
  return (
    <article style={{
      background: T.ground, border: `1px solid ${T.rule}`, borderRadius: 4,
      padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
        paddingBottom: 10, borderBottom: `1px solid ${T.rule}`,
      }}>
        <h3 style={{
          ...SERIF, fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em',
          fontVariationSettings: '"opsz" 32', color: T.ink,
          display: 'inline-flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: color, boxShadow: `0 0 0 3px ${color}22`,
          }} />
          {heading}
        </h3>
        <span style={{ ...SANS, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.ink3, fontWeight: 600 }}>
          {sub}
        </span>
      </div>
      <p style={{
        ...SERIF, fontSize: 13, lineHeight: 1.5, color: T.ink2, fontStyle: 'italic',
        fontVariationSettings: '"opsz" 24',
      }}>
        {intent}
      </p>
      <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0, padding: 0, margin: 0 }}>
        {entries.map((e, i) => (
          <li
            key={e.entryNo}
            style={{
              display: 'grid', gridTemplateColumns: '28px 1fr auto',
              alignItems: 'baseline', gap: 12,
              padding: '12px 0',
              borderBottom: i === entries.length - 1 ? 'none' : `1px solid ${T.rule}`,
            }}
          >
            <span style={{
              ...SERIF, fontWeight: 600, fontSize: 20, fontVariationSettings: '"opsz" 48',
              color, lineHeight: 1, letterSpacing: '-0.02em',
            }}>
              {e.entryNo}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ ...SANS, fontSize: 13, color: T.ink, fontWeight: 500 }}>{e.label}</span>
              <span style={{ ...SANS, fontSize: 11, color: T.ink3, lineHeight: 1.35 }}>
                {sebiSafeRationale(e.rationale)}
              </span>
            </div>
            <span style={{ textAlign: 'right' }}>
              <span style={{ ...MONO, fontSize: 14, fontWeight: 600, color: T.ink }}>
                {fmtRs(e.price)}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}

function WhatConfirmsSection({ items }: { items: WhatConfirmsItem[] }) {
  const met = items.filter((i) => i.state === 'met').length;
  const pending = items.filter((i) => i.state === 'pending').length;
  return (
    <section style={{
      background: T.ground, border: `1px solid ${T.rule}`, borderRadius: 4, padding: '18px 22px 20px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        paddingBottom: 14, marginBottom: 16, borderBottom: `1px solid ${T.rule}`,
      }}>
        <h3 style={{ ...SERIF, fontSize: 20, fontWeight: 500, fontVariationSettings: '"opsz" 32', color: T.ink }}>
          What Confirms This Setup
        </h3>
        <span style={{ ...SANS, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.ink3, fontWeight: 600 }}>
          <span style={{ ...MONO, color: T.bull }}>{met}</span> of {items.length} met
          {pending > 0 && <>&nbsp;·&nbsp; <span style={{ color: T.pending }}>{pending} pending</span></>}
        </span>
      </div>
      <ol style={{
        listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px 32px', padding: 0, margin: 0,
      }}>
        {items.map((it, i) => {
          const isMet = it.state === 'met';
          const isPending = it.state === 'pending';
          const isFail = it.state === 'failed';
          const gc = isMet ? T.bull : isPending ? T.pending : T.bear;
          const glyph = isMet ? '✓' : isPending ? '○' : '✗';
          return (
            <li key={i} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 10, alignItems: 'start' }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, lineHeight: 1,
                background: `${gc}22`, color: gc, border: `1px solid ${gc}55`,
                marginTop: 2,
              }}>
                {glyph}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ ...SERIF, fontSize: 13, fontWeight: 500, color: T.ink, fontVariationSettings: '"opsz" 18' }}>
                  {it.label}
                  <span style={{
                    ...SANS, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: isFail ? T.bear : isPending ? T.pending : T.ink3, fontWeight: 600, marginLeft: 8,
                  }}>
                    · {isFail ? 'not met' : isPending ? 'pending' : 'structural'}
                  </span>
                </span>
                <span style={{ ...SANS, fontSize: 11, color: T.ink3, lineHeight: 1.4 }}>
                  {it.explain}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ── formatting + copy helpers ─────────────────────────────────────────────

function fmtRs(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return '₹' + v.toFixed(v >= 100 ? 0 : 2);
}

/**
 * Rewrite adapter rationales into SEBI-observational voice.
 * Adapters wrote them once with words like "entry" / "trigger" / "add" —
 * this pass swaps them for "zone" / "condition" / "reference" without
 * touching the adapter. Cheap and centralized.
 */
function sebiSafeRationale(text: string): string {
  return text
    .replace(/\bentry\b/gi, 'zone')
    .replace(/\btrigger\b/gi, 'condition')
    .replace(/\bstop\b/gi, 'reference')
    .replace(/\badd(-on)?\b/gi, 'continuation')
    .replace(/\bscale into\b/gi, 'observe')
    .replace(/\bposition\b/gi, 'exposure');
}
