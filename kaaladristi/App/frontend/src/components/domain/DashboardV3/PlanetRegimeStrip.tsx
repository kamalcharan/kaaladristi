/**
 * PlanetRegimeStrip — the four-planet market engine, live
 * ========================================================
 * Planet-story packaging (session 2026-07-06): one glance answers
 * "what season is it?" per the Finastro hierarchy — Saturn sets the
 * structure, Jupiter the trend, Mars the momentum, Mercury the noise.
 *
 * Entirely data-driven from km_rule_transits (the almanac windows built in
 * migrations 127-130): each planet's current sign (Journey rules) and
 * motion (Motion rules), plus the next 90 days of engine events from the
 * future windows already generated to 2030. Zero LLM, zero new backend.
 * Cells click through to the rule's detail page (Almanac/Patterns tabs).
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { from } from '@/services/postgrest';

// ── Engine rule codes (migrations 127-130) ──────────────────────────────────

const JOURNEY: Record<string, string> = {
  Mercury: 'TRN-MER-MAN-TRN', Mars: 'TRN-MAR-MAN-TRN',
  Jupiter: 'TRN-JUP-MAN-TRN', Saturn: 'TRN-SAT-MAN-TRN',
};
const MOTION: Record<string, string> = {
  Mercury: 'TR-MER-RET', Mars: 'TR-MAR-RET',
  Jupiter: 'TR-JUP-RET', Saturn: 'TR-SAT-RET',
};
const PLANETS = ['Saturn', 'Jupiter', 'Mars', 'Mercury'] as const;   // hierarchy order
const ROLES: Record<string, string> = {
  Saturn: 'Structure', Jupiter: 'Trend', Mars: 'Momentum', Mercury: 'Signal',
};
const GLYPHS: Record<string, string> = {
  Saturn: '♄', Jupiter: '♃', Mars: '♂', Mercury: '☿',
};

// Vedic dignity by Sanskrit sign name (km_planetary_positions vocabulary)
const EXALTED: Record<string, string> = {
  Mercury: 'Kanya', Mars: 'Makara', Jupiter: 'Karka', Saturn: 'Tula',
};
const DEBILITATED: Record<string, string> = {
  Mercury: 'Meena', Mars: 'Karka', Jupiter: 'Makara', Saturn: 'Mesha',
};
const OWN: Record<string, string[]> = {
  Mercury: ['Mithuna', 'Kanya'], Mars: ['Mesha', 'Vrishchika'],
  Jupiter: ['Dhanu', 'Meena'], Saturn: ['Makara', 'Kumbha'],
};

function dignity(planet: string, sign: string | null): { label: string; color: string } | null {
  if (!sign) return null;
  if (EXALTED[planet] === sign) return { label: '✦ exalted', color: 'var(--risk-green)' };
  if (DEBILITATED[planet] === sign) return { label: '▽ debilitated', color: 'var(--risk-red)' };
  if (OWN[planet]?.includes(sign)) return { label: 'own sign', color: 'var(--gold)' };
  return null;
}

// ── Data ─────────────────────────────────────────────────────────────────────

interface TransitWindow {
  rule_id: number;
  start_date: string;
  end_date: string;
  conditions_snapshot: { sign?: string } | null;
}

interface RegimeData {
  planets: Record<string, {
    sign: string | null; signDaysLeft: number | null;
    retro: boolean; motionDaysLeft: number | null;
    journeyRuleId: number | null; motionRuleId: number | null;
  }>;
  upcoming: { days: number; label: string; ruleId: number }[];
}

const ALL_CODES = [...Object.values(JOURNEY), ...Object.values(MOTION)];

async function fetchRegime(): Promise<RegimeData> {
  const { data: ruleRows, error: rErr } = await from('km_astro_rule_master')
    .select('id,rule_code').in('rule_code', ALL_CODES).execute();
  if (rErr) throw new Error(rErr.message);
  const idByCode = new Map((ruleRows as { id: number; rule_code: string }[]).map(r => [r.rule_code, r.id]));
  const codeById = new Map((ruleRows as { id: number; rule_code: string }[]).map(r => [r.id, r.rule_code]));

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

  const { data: winRows, error: wErr } = await from('km_rule_transits')
    .select('rule_id,start_date,end_date,conditions_snapshot')
    .in('rule_id', [...idByCode.values()])
    .gte('end_date', today)
    .lte('start_date', horizon)
    .order('start_date', { ascending: true })
    .limit(200)
    .execute();
  if (wErr) throw new Error(wErr.message);
  const windows = (winRows as TransitWindow[]) ?? [];

  const dayDiff = (d: string) =>
    Math.round((new Date(d + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000);

  const planets: RegimeData['planets'] = {};
  const upcoming: RegimeData['upcoming'] = [];

  for (const planet of PLANETS) {
    const jId = idByCode.get(JOURNEY[planet]) ?? null;
    const mId = idByCode.get(MOTION[planet]) ?? null;
    const p = {
      sign: null as string | null, signDaysLeft: null as number | null,
      retro: false, motionDaysLeft: null as number | null,
      journeyRuleId: jId, motionRuleId: mId,
    };
    for (const w of windows) {
      const code = codeById.get(w.rule_id);
      const active = w.start_date <= today && w.end_date >= today;
      if (code === JOURNEY[planet]) {
        if (active) {
          p.sign = w.conditions_snapshot?.sign ?? null;
          p.signDaysLeft = dayDiff(w.end_date);
        } else if (w.start_date > today && jId != null) {
          upcoming.push({
            days: dayDiff(w.start_date),
            label: `${planet} enters ${w.conditions_snapshot?.sign ?? '…'}`,
            ruleId: jId,
          });
        }
      }
      if (code === MOTION[planet] && mId != null) {
        if (active) {
          p.retro = true;
          p.motionDaysLeft = dayDiff(w.end_date);
          upcoming.push({ days: dayDiff(w.end_date), label: `${planet} stations direct`, ruleId: mId });
        } else if (w.start_date > today) {
          upcoming.push({ days: dayDiff(w.start_date), label: `${planet} retrograde begins`, ruleId: mId });
        }
      }
    }
    planets[planet] = p;
  }

  upcoming.sort((a, b) => a.days - b.days);
  return { planets, upcoming: upcoming.slice(0, 6) };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PlanetRegimeStrip() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['planet-regime'],
    queryFn: fetchRegime,
    staleTime: 60 * 60 * 1000,   // windows change on ephemeris timescales
    retry: 1,
  });

  const cells = useMemo(() => {
    if (!data) return [];
    return PLANETS.map(planet => ({ planet, ...data.planets[planet] }));
  }, [data]);

  if (isLoading || !data) return null;                       // strip is optional chrome
  if (cells.every(c => !c.sign && !c.retro)) return null;    // no almanac windows loaded

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '10px 14px', marginBottom: 16,
    }}>
      {/* Planet cells */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          paddingRight: 10, borderRight: '1px solid var(--border)', flexShrink: 0,
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: 'var(--gold)',
          }}>
            Sky Regime
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-faint)', marginTop: 2 }}>
            structure · trend · momentum · signal
          </span>
        </div>

        {cells.map(c => {
          const dig = dignity(c.planet, c.sign);
          return (
            <button
              key={c.planet}
              onClick={() => c.journeyRuleId && navigate(`/rules/${c.journeyRuleId}`)}
              title={`${c.planet} — ${ROLES[c.planet]} layer. Click for the almanac & patterns.`}
              style={{
                flex: '1 1 150px', minWidth: 150, textAlign: 'left', cursor: 'pointer',
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 8, padding: '7px 10px', transition: 'border-color .15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--gold)' }}>{GLYPHS[c.planet]}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                  color: 'var(--text-primary)',
                }}>
                  {c.planet}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: 'var(--text-faint)', marginLeft: 'auto',
                }}>
                  {ROLES[c.planet]}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {c.sign ?? '—'}
                </span>
                {dig && (
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: dig.color }}>
                    {dig.label}
                  </span>
                )}
                {c.retro ? (
                  <span style={{
                    fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--risk-amber)',
                  }}>
                    ◉ retro{c.motionDaysLeft != null ? ` · ${c.motionDaysLeft}d left` : ''}
                  </span>
                ) : (
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-faint)' }}>
                    direct
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Coming up — next 90 days from future windows */}
      {data.upcoming.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--text-faint)', flexShrink: 0,
          }}>
            Coming up
          </span>
          {data.upcoming.map((u, i) => (
            <button
              key={`${u.label}-${i}`}
              onClick={() => navigate(`/rules/${u.ruleId}`)}
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 100, padding: '2px 9px', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)',
              }}
            >
              <span style={{ color: 'var(--gold)' }}>in {u.days}d</span> · {u.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
