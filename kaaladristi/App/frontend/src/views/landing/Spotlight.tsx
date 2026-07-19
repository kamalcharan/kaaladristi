// "Today on DristiQ" proof band — the landing page's live product evidence.
// Renders the depersonalized spotlight payload from /api/landing/spotlight:
//   · equity mode — today's highest-confluence chart, identity masked
//     ("revealed inside" is the signup hook)
//   · index mode  — NIFTY 500 market structure (the conservative regime state)
// Copy is deliberately neutral: no regime adjectives, no stock names, no
// directional language (owner decision 2026-07-19). Candle colors come from
// the app's CSS vars (--bull/--bear) so no new color literals enter the
// theme ratchet; everything else uses landing C tokens.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createChart, CandlestickSeries, ColorType, type IChartApi } from 'lightweight-charts';
import { C, MONO } from './tokens';
import { FadeUp, SectionHeader } from './shared';
import { storeSpotlightIntent } from '@/services/spotlight';

const PIPELINE_API = (import.meta.env.VITE_PIPELINE_API_URL?.trim() || '');

interface SpotlightBar { t: string; o: number | null; h: number | null; l: number | null; c: number | null }
interface SpotlightPayload {
  trade_date: string;
  mode: 'equity' | 'index';
  index_name?: string;
  bars: SpotlightBar[];
  scan_counts: { id: string; label: string; count: number }[];
}

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function Spotlight() {
  const navigate = useNavigate();
  const [data, setData] = useState<SpotlightPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const chartHost = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    let dead = false;
    fetch(`${PIPELINE_API}/api/landing/spotlight`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => { if (!dead) setData(j as SpotlightPayload); })
      .catch(() => { if (!dead) setFailed(true); });
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    if (!data || !chartHost.current) return;

    const bull = cssVar('--bull', C.g1);
    const bear = cssVar('--bear', C.ink3);

    const chart = createChart(chartHost.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: C.bg1 },
        textColor: C.ink3,
        fontFamily: MONO,
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: C.rs },
        horzLines: { color: C.rs },
      },
      rightPriceScale: { borderColor: C.rule },
      timeScale: { borderColor: C.rule, rightOffset: 4 },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: bull,
      downColor: bear,
      wickUpColor: bull,
      wickDownColor: bear,
      borderVisible: false,
    });

    series.setData(
      data.bars
        .filter((b) => b.o != null && b.h != null && b.l != null && b.c != null)
        .map((b) => ({ time: b.t, open: b.o!, high: b.h!, low: b.l!, close: b.c! })),
    );
    chart.timeScale().fitContent();
    chartRef.current = chart;

    return () => { chart.remove(); chartRef.current = null; };
  }, [data]);

  // Public page: on fetch failure the section collapses silently — a broken
  // proof band is worse than no proof band.
  if (failed) return null;

  const isEquity = data?.mode === 'equity';
  const title = isEquity
    ? <>Today&rsquo;s highest-<em style={{ color: C.g1, fontStyle: 'italic' }}>confluence</em> chart.</>
    : <>Today&rsquo;s market <em style={{ color: C.g1, fontStyle: 'italic' }}>structure</em>.</>;
  // Side-neutral by design: the pick may be the day's strongest-confluence
  // stock OR its weakest laggard (regime decides server-side) — the copy
  // never says which. The counts strip carries the observational facts.
  const lede = isEquity
    ? 'One NSE equity stands out across today’s scanner conditions more than any other. No name here — the identity is revealed inside.'
    : `${data?.index_name ?? 'NIFTY 500'} — the broad market as it closed. Refreshed every trading evening after the data pipeline completes.`;

  const seeInside = () => {
    storeSpotlightIntent();
    navigate('/login');
  };

  return (
    <section id="today" style={{ position: 'relative', padding: '110px 0 90px' }}>
      <SectionHeader
        idx="§ LIVE"
        label="Today on DristiQ"
        title={title}
        lede={lede}
      />

      <div className="dq-wrap" style={{ marginTop: 48 }}>
        <FadeUp>
          <div className="dq-glass" style={{ borderRadius: 10, overflow: 'hidden' }}>
            {/* Card header strip */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, flexWrap: 'wrap', padding: '14px 18px',
              borderBottom: `1px solid ${C.rule}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: C.g1,
                  boxShadow: `0 0 8px ${C.glow}`, display: 'inline-block',
                }} />
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: C.ink2 }}>
                  {isEquity ? 'NSE Equity · Daily' : `${data?.index_name ?? 'NIFTY 500'} · Daily`}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                {isEquity && (
                  <span style={{
                    fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase',
                    color: C.g1, border: `1px solid ${C.rule}`, background: C.rs,
                    padding: '4px 10px', borderRadius: 3,
                  }}>
                    Identity revealed inside
                  </span>
                )}
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', color: C.ink3 }}>
                  {data ? `AS OF ${data.trade_date}` : 'LOADING'}
                </span>
              </div>
            </div>

            {/* Chart */}
            <div ref={chartHost} style={{ width: '100%', height: 340, background: C.bg1 }}>
              {!data && (
                <div style={{
                  height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: MONO, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: C.ink4,
                }}>
                  Reading today&rsquo;s tape…
                </div>
              )}
            </div>

            {/* Scan counts + CTA footer */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 16, flexWrap: 'wrap', padding: '14px 18px',
              borderTop: `1px solid ${C.rule}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                {(data?.scan_counts ?? []).map((s) => (
                  <span key={s.id} style={{ fontFamily: MONO, fontSize: 11, color: C.ink3, letterSpacing: '.06em' }}>
                    {s.label} · <span style={{ color: C.g1 }}>{s.count}</span> met conditions today
                  </span>
                ))}
              </div>
              <button onClick={seeInside} className="dq-btn" style={{ padding: '9px 18px', fontSize: 12 }}>
                Login to view <span className="dq-arrow">→</span>
              </button>
            </div>
          </div>
        </FadeUp>

        <FadeUp delay={120}>
          <p style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', lineHeight: 1.7,
            color: C.ink4, marginTop: 14, maxWidth: '72ch',
          }}>
            Pattern research data, refreshed daily from NSE end-of-day feeds. Selection reflects
            scanner condition counts only — not a recommendation, target, or solicitation to trade.
          </p>
        </FadeUp>
      </div>
    </section>
  );
}
