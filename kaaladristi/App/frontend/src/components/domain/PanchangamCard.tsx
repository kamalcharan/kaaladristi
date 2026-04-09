import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePanchang } from '@/hooks';
import type { DailyPanchang } from '@/types';

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border', className)}>
      {children}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-2 py-1 border-b border-kd-border last:border-b-0">
      <span className="text-[10px] uppercase tracking-widest text-muted font-bold shrink-0">{label}</span>
      <span className="text-[12px] text-[var(--text-primary)] font-medium text-right">{value}</span>
    </div>
  );
}

function PanchangContent({ p }: { p: DailyPanchang }) {
  const paksha = p.paksha === 'shukla' ? 'Shukla' : 'Krishna';
  const specialEvents: { label: string; cls: string }[] = [];
  if (p.is_purnima)   specialEvents.push({ label: 'Purnima',  cls: 'bg-risk-amber/10 border-risk-amber/30 text-risk-amber' });
  if (p.is_amavasya)  specialEvents.push({ label: 'Amavasya', cls: 'bg-accent-violet/10 border-accent-violet/30 text-accent-violet' });
  if (p.is_ekadashi)  specialEvents.push({ label: 'Ekadashi', cls: 'bg-accent-indigo/10 border-accent-indigo/30 text-accent-indigo' });
  if (p.is_sankranti) specialEvents.push({ label: 'Sankranti', cls: 'bg-risk-red/10 border-risk-red/30 text-risk-red' });
  if (p.dlnl_match)   specialEvents.push({ label: 'DL=NL', cls: 'bg-risk-green/10 border-risk-green/30 text-risk-green' });

  return (
    <div className="space-y-0">
      {/* Sunrise / Sunset */}
      <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-kd-border">
        <div className="flex items-center gap-1.5 text-[11px] text-risk-amber">
          <Sun className="w-3 h-3" />
          <span className="mono font-medium">{p.sunrise_ist ?? '—'}</span>
        </div>
        <div className="text-[10px] text-muted font-medium">{paksha} Paksha</div>
        <div className="flex items-center gap-1.5 text-[11px] text-accent-indigo">
          <span className="mono font-medium">{p.sunset_ist ?? '—'}</span>
          <Moon className="w-3 h-3" />
        </div>
      </div>

      <Row label="Vara"      value={`${p.vara}${p.vara_lord ? ` · ${p.vara_lord}` : ''}`} />
      <Row label="Tithi"     value={`${p.tithi_num}. ${p.tithi_name}${p.tithi_lord ? ` · ${p.tithi_lord}` : ''}`} />
      <Row label="Nakshatra" value={`${p.nakshatra_name}${p.nakshatra_pada ? ` Pada ${p.nakshatra_pada}` : ''}${p.nakshatra_lord ? ` · ${p.nakshatra_lord}` : ''}`} />
      <Row label="Yoga"      value={p.yoga_name ?? null} />
      <Row label="Karana"    value={p.karana_name ?? null} />
      <Row label="Moon"      value={p.moon_sign_name ?? null} />
      <Row label="Sun"       value={p.sun_sign_name ?? null} />

      {specialEvents.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2.5">
          {specialEvents.map(e => (
            <Badge key={e.label} className={e.cls}>{e.label}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PanchangamCard({ date }: { date: string }) {
  const { data, isLoading, isError } = usePanchang(date);

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🪐</span>
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Panchangam</h3>
        <span className="ml-auto text-[10px] text-muted mono">{date}</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-5 bg-kd-elevated rounded animate-pulse" />
          ))}
        </div>
      ) : isError || !data ? (
        <p className="text-[11px] text-muted text-center py-4">
          {isError ? 'Failed to load panchang data' : `No panchang data for ${date}`}
        </p>
      ) : (
        <PanchangContent p={data} />
      )}
    </div>
  );
}
