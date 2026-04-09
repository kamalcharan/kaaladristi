import { useEffect, useState } from 'react';
import { Sun, Moon, Sparkles, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePanchang, usePanchangInsight } from '@/hooks';
import type { DailyPanchang } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toSeconds(t: string): number {
  const [h, m, s = '0'] = t.split(':');
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

function getISTTime(): string {
  return new Date().toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function dayProgress(sunrise: string, sunset: string, now: string): number {
  const sr = toSeconds(sunrise), ss = toSeconds(sunset), cur = toSeconds(now);
  if (cur <= sr) return 0;
  if (cur >= ss) return 100;
  return Math.round(((cur - sr) / (ss - sr)) * 100);
}

function timeUntil(endSec: number, nowSec: number): string {
  const diff = endSec - nowSec;
  if (diff <= 0) return '';
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function resolveEndSec(endTime: string, nextDay: boolean): { sec: number; nextDay: boolean } {
  const sec = toSeconds(endTime);
  // If the DB flagged this as next-day, add 24h so isPast is never true today
  return { sec: nextDay ? sec + 86400 : sec, nextDay };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border', className)}>
      {children}
    </span>
  );
}

function Row({
  label,
  value,
  endTime,
  endNextDay,
  nowSec,
}: {
  label: string;
  value: string | null | undefined;
  endTime?: string | null;
  endNextDay?: boolean | null;
  nowSec?: number;
}) {
  if (!value) return null;

  let isPast = false;
  let remaining: string | null = null;
  let nextDay = false;
  let displayEnd = '';

  if (endTime && nowSec !== undefined) {
    const resolved = resolveEndSec(endTime, !!endNextDay);
    nextDay = resolved.nextDay;
    isPast = resolved.sec <= nowSec;
    displayEnd = endTime.slice(0, 5) + (nextDay ? ' +1' : '');
    if (!isPast) remaining = timeUntil(resolved.sec, nowSec);
  }

  return (
    <div className="flex items-baseline justify-between gap-2 py-1 border-b border-kd-border last:border-b-0">
      <span className="text-[10px] uppercase tracking-widest text-muted font-bold shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={cn('text-[12px] font-medium text-right truncate', isPast ? 'text-muted line-through' : 'text-[var(--text-primary)]')}>
          {value}
        </span>
        {endTime && (
          <span
            className={cn('text-[9px] font-mono shrink-0', isPast ? 'text-risk-amber' : 'text-muted')}
            title={`Changes at ${endTime} IST${nextDay ? ' (next day)' : ''}`}
          >
            {isPast ? 'changed' : `until ${displayEnd}${remaining ? ` (${remaining})` : ''}`}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Content ───────────────────────────────────────────────────────────────────

function PanchangContent({ p, istTime }: { p: DailyPanchang; istTime: string }) {
  const nowSec = toSeconds(istTime);
  const paksha = p.paksha === 'shukla' ? 'Shukla' : 'Krishna';

  const progress = p.sunrise_ist && p.sunset_ist
    ? dayProgress(p.sunrise_ist, p.sunset_ist, istTime)
    : null;

  const specialEvents: { label: string; cls: string }[] = [];
  if (p.is_purnima)   specialEvents.push({ label: 'Purnima',  cls: 'bg-risk-amber/10 border-risk-amber/30 text-risk-amber' });
  if (p.is_amavasya)  specialEvents.push({ label: 'Amavasya', cls: 'bg-accent-violet/10 border-accent-violet/30 text-accent-violet' });
  if (p.is_ekadashi)  specialEvents.push({ label: 'Ekadashi', cls: 'bg-accent-indigo/10 border-accent-indigo/30 text-accent-indigo' });
  if (p.is_sankranti) specialEvents.push({ label: 'Sankranti', cls: 'bg-risk-red/10 border-risk-red/30 text-risk-red' });
  if (p.dlnl_match)   specialEvents.push({ label: 'DL=NL', cls: 'bg-risk-green/10 border-risk-green/30 text-risk-green' });

  return (
    <div className="space-y-0">
      {/* Sunrise → Live clock → Sunset */}
      <div className="mb-3 pb-2.5 border-b border-kd-border space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-risk-amber">
            <Sun className="w-3 h-3" />
            <span className="mono font-medium">{p.sunrise_ist ?? '—'}</span>
          </div>

          {/* Ticking clock */}
          <div className="flex items-center gap-1 text-[11px]">
            <Clock className="w-2.5 h-2.5 text-muted" />
            <span className="mono font-semibold text-[var(--text-secondary)] tabular-nums">{istTime}</span>
            <span className="text-[9px] text-muted font-bold">IST</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-accent-indigo">
            <span className="mono font-medium">{p.sunset_ist ?? '—'}</span>
            <Moon className="w-3 h-3" />
          </div>
        </div>

        {/* Day progress bar */}
        {progress !== null && (
          <div className="relative h-1 bg-kd-elevated rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-risk-amber to-accent-indigo"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-[9px] text-muted">{paksha} Paksha</span>
          {progress !== null && (
            <span className="text-[9px] text-muted mono">{progress}% of day</span>
          )}
        </div>
      </div>

      <Row label="Vara" value={`${p.vara}${p.vara_lord ? ` · ${p.vara_lord}` : ''}`} />
      <Row
        label="Tithi"
        value={`${p.tithi_num}. ${p.tithi_name}${p.tithi_lord ? ` · ${p.tithi_lord}` : ''}`}
        endTime={p.tithi_end_ist}
        endNextDay={p.tithi_end_next_day}
        nowSec={nowSec}
      />
      <Row
        label="Nakshatra"
        value={`${p.nakshatra_name}${p.nakshatra_pada ? ` Pada ${p.nakshatra_pada}` : ''}${p.nakshatra_lord ? ` · ${p.nakshatra_lord}` : ''}`}
        endTime={p.nakshatra_end_ist}
        endNextDay={p.nakshatra_end_next_day}
        nowSec={nowSec}
      />

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

// ── Card ──────────────────────────────────────────────────────────────────────

export default function PanchangamCard({ date }: { date: string }) {
  const { data, isLoading, isError } = usePanchang(date);
  const { data: aiData, isLoading: aiLoading } = usePanchangInsight(date);

  // Live IST clock — ticks every second
  const [istTime, setIstTime] = useState(getISTTime);
  useEffect(() => {
    const id = setInterval(() => setIstTime(getISTTime()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🪐</span>
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Panchangam</h3>
        <span className="ml-auto text-[10px] text-muted mono">{date}</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-5 bg-kd-elevated rounded animate-pulse" />
          ))}
        </div>
      ) : isError || !data ? (
        <p className="text-[11px] text-muted text-center py-4">
          {isError ? 'Failed to load panchang data' : `No panchang data for ${date}`}
        </p>
      ) : (
        <PanchangContent p={data} istTime={istTime} />
      )}

      {/* AI Insight */}
      {(aiLoading || aiData?.insight) && (
        <div className="mt-3 pt-3 border-t border-kd-border">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3 h-3 text-accent-indigo" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-accent-indigo">AI Insight</span>
          </div>
          {aiLoading ? (
            <div className="space-y-1.5">
              <div className="h-3 bg-kd-elevated rounded animate-pulse w-full" />
              <div className="h-3 bg-kd-elevated rounded animate-pulse w-4/5" />
            </div>
          ) : (
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{aiData?.insight}</p>
          )}
        </div>
      )}
    </div>
  );
}
