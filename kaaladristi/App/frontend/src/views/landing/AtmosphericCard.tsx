import { useState, useEffect } from 'react';
import { C, SERIF, MONO, SANS, formatPaksha, todayIST } from './tokens';
import { fmtDate } from '@/lib/dateUtils';
import { fetchPanchang } from '@/services/panchang';
import type { DailyPanchang } from '@/types';

// ── Atmosphere model ──────────────────────────────────────────────────────
export interface Atmo {
  label: string; score: number; color: string; note: string;
  tithi: string; nakshatra: string; yoga: string;
}

function deriveAtmo(p: DailyPanchang): Atmo {
  const tithi = p.paksha ? `${p.tithi_name} — ${formatPaksha(p.paksha)}` : p.tithi_name;
  const nakshatra = p.nakshatra_name;
  const yoga = p.yoga_name ?? '—';

  if (p.is_amavasya) return { label:'VOLATILE', score:87, color:'#ff9d4a', tithi, nakshatra, yoga,
    note:'Historical whipsaw cluster across 8Y of NIFTY / BANKNIFTY data.' };
  if (p.is_purnima) return { label:'HEIGHTENED', score:75, color:C.ink1, tithi, nakshatra, yoga,
    note:'Pūrṇimā window. Elevated reversal signatures historically correlated.' };
  if (p.is_ekadashi) return { label:'CALM', score:35, color:C.g1, tithi, nakshatra, yoga,
    note:'Ekādaśī window. Historically associated with consolidating conditions.' };

  const t = p.tithi_num || 0;
  const dist = Math.min(Math.abs(t - 15), Math.abs(t - 30), t);
  const score = Math.max(22, Math.min(92, Math.round(100 - (dist / 7.5) * 70)));

  if (score >= 62) return { label:'CHARGED', score, color:C.ink1, tithi, nakshatra, yoga,
    note:`${nakshatra} Nakṣatra historically clusters with elevated reversal signatures on NIFTY — ${score}th percentile attention.` };
  return { label:'CALM', score: Math.min(score, 42), color:C.g1, tithi, nakshatra, yoga,
    note:'Low historical volatility cluster. Trending continuations more common.' };
}

// ── Hook ──────────────────────────────────────────────────────────────────
export function useTodayAtmo(): { atmo: Atmo | null; loading: boolean } {
  const [atmo, setAtmo] = useState<Atmo | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchPanchang(todayIST())
      .then(p => { if (p) setAtmo(deriveAtmo(p)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  return { atmo, loading };
}

// ── Card component ────────────────────────────────────────────────────────
export function AtmosphericCard({ atmo, loading }: { atmo: Atmo | null; loading: boolean }) {
  const now = new Date();
  const dateStr = fmtDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const timeStr = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Asia/Kolkata' }) + ' IST';
  const color = atmo?.color ?? C.ink4;

  return (
    <div style={{
      position:'absolute', left:'-10%', bottom:'-6%', width:300,
      background:'rgba(10,10,18,0.9)', border:`1px solid ${C.rule}`,
      backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
      padding:'18px 20px', fontSize:12,
      boxShadow:`0 20px 60px rgba(0,0,0,0.5),0 0 30px rgba(226,185,111,0.08)`,
    }} className="dq-atmo-card">

      {/* Header row */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:12 }}>
        <span style={{ fontFamily:MONO, fontSize:9, letterSpacing:'.24em', color:C.ink3 }}>ATMOSPHERIC READING</span>
        <span style={{ fontFamily:MONO, fontSize:9, letterSpacing:'.14em', color: loading ? C.ink4 : color }}>
          {loading ? '○ —' : '● LIVE'}
        </span>
      </div>

      {/* Label */}
      <div style={{ fontFamily:SERIF, fontSize:28, color:C.ink1, lineHeight:1, marginBottom:4, letterSpacing:'-0.02em' }}>
        {loading ? '—' : atmo?.label}
      </div>
      <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:'.14em', color:C.ink3, marginBottom:14 }}>
        today · {dateStr} · {timeStr}
      </div>

      <hr style={{ border:0, height:1, background:C.rs, margin:'0 0 14px' }}/>

      {/* Data grid */}
      {loading || !atmo ? (
        <div style={{ color:C.ink4, fontSize:12, fontStyle:'italic', fontFamily:SANS }}>Loading panchāngam…</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:'6px 14px', fontSize:11.5, fontFamily:SANS }}>
          <span style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:'.14em', color:C.ink3 }}>TITHI</span>
          <span style={{ color:C.ink1 }}>{atmo.tithi}</span>
          <span style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:'.14em', color:C.ink3 }}>NAKṢ.</span>
          <span style={{ color:C.ink1 }}>{atmo.nakshatra}</span>
          <span style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:'.14em', color:C.ink3 }}>YOGA</span>
          <span style={{ color:C.ink1 }}>{atmo.yoga}</span>
        </div>
      )}

      <hr style={{ border:0, height:1, background:C.rs, margin:'14px 0' }}/>

      {/* Attention bar */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
        <span style={{ fontFamily:MONO, fontSize:9, letterSpacing:'.14em', color:C.ink3 }}>ATTN</span>
        <div style={{ flex:1, height:4, background:'color-mix(in srgb, var(--text-primary) 5%, transparent)', position:'relative' }}>
          <div style={{
            position:'absolute', left:0, top:0, bottom:0,
            width: loading || !atmo ? '0%' : `${atmo.score}%`,
            background: `linear-gradient(90deg,${C.g3},${loading||!atmo?C.g3:color})`,
            transition:'width .6s ease',
          }}/>
        </div>
        <span style={{ fontFamily:MONO, fontSize:11, color: loading||!atmo ? C.ink4 : color }}>
          {loading||!atmo ? '—' : atmo.score}
        </span>
      </div>

      {/* Note */}
      {atmo && (
        <p style={{ margin:0, fontSize:11.5, color:C.ink2, lineHeight:1.5, fontStyle:'italic', fontFamily:SANS }}>
          {atmo.note}
        </p>
      )}
    </div>
  );
}
