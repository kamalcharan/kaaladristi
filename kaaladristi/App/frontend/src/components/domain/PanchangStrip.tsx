import type { SnapshotPanchang } from '@/types';
import { cn } from '@/lib/utils';

interface PanchangStripProps {
  panchang: SnapshotPanchang;
}

interface CellProps {
  label: string;
  value: string | null;
  sub?: string | null;
  highlight?: boolean;
  tooltip?: string;
}

function Cell({ label, value, sub, highlight, tooltip }: CellProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center px-4 py-3 rounded-xl border border-kd-border bg-kd-card/50 min-w-[100px] relative group',
        highlight && 'border-accent-gold/40 bg-accent-gold/5'
      )}
      title={tooltip}
    >
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted mb-1.5">{label}</span>
      <span className={cn(
        'text-sm font-bold font-mono',
        highlight ? 'text-accent-gold' : 'text-slate-200'
      )}>
        {value || '—'}
      </span>
      {sub && (
        <span className="text-[9px] text-muted mt-0.5">{sub}</span>
      )}
      {highlight && (
        <div className="absolute inset-0 rounded-xl ring-1 ring-accent-gold/20 animate-pulse-live pointer-events-none" />
      )}
    </div>
  );
}

export default function PanchangStrip({ panchang }: PanchangStripProps) {
  const tithiSub = panchang.paksha ? `${panchang.paksha} Paksha` : null;

  const specialDay = panchang.is_purnima ? 'Purnima' : panchang.is_amavasya ? 'Amavasya' : panchang.is_ekadashi ? 'Ekadashi' : null;

  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
      <Cell
        label="Tithi"
        value={panchang.tithi_name}
        sub={tithiSub}
        tooltip="Lunar day — indicates market sentiment cycles"
      />
      <Cell
        label="Nakshatra"
        value={panchang.nakshatra_name}
        sub={panchang.nakshatra_pada ? `Pada ${panchang.nakshatra_pada}` : null}
        tooltip="Moon's stellar mansion — maps to sector sensitivity"
      />
      <Cell
        label="Yoga"
        value={panchang.yoga_name}
        tooltip="Sun-Moon angular relationship — indicates auspiciousness"
      />
      <Cell
        label="Vara"
        value={panchang.vara}
        tooltip="Day of week ruler — determines day lord for DLNL matching"
      />
      <Cell
        label="DLNL"
        value={panchang.dlnl_match ? 'Match' : 'No Match'}
        highlight={panchang.dlnl_match}
        tooltip="Day Lord = Nakshatra Lord — historically bullish when matched"
      />
      <Cell
        label="Sunrise"
        value={panchang.sunrise}
        tooltip="Sunrise time — marks the start of the Vedic day"
      />
      <Cell
        label="Special"
        value={panchang.is_sankranti ? 'Sankranti' : specialDay}
        sub={panchang.is_sankranti ? 'Sign change' : null}
        highlight={panchang.is_sankranti}
        tooltip="Special panchang events — Sankranti, Purnima, Amavasya, Ekadashi"
      />
    </div>
  );
}
