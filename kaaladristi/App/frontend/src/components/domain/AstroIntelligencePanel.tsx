import MajorTransitBanner from '@/components/astro/MajorTransitBanner';
import MinorTransitBar from '@/components/astro/MinorTransitBar';
import DailyEventStrip from '@/components/astro/DailyEventStrip';

interface AstroIntelligencePanelProps {
  date: string;
}

export default function AstroIntelligencePanel({ date }: AstroIntelligencePanelProps) {
  return (
    <div className="glass-card rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Astro Intelligence</h3>
        <span className="text-[10px] text-muted">Planetary · Transits · Outlook</span>
      </div>

      {/* Layer 1 — Major transits (> 30 days): full progress banner */}
      <MajorTransitBanner />

      {/* Layer 2 — Minor transits (1-30 days): compact chips, hidden when none active */}
      <MinorTransitBar />

      {/* Divider before 7-day strip */}
      <div className="border-t border-kd-border" />

      {/* Layer 3 — 7-day outlook: day-level events only, dots + hover tooltips */}
      <DailyEventStrip selectedDate={date} />
    </div>
  );
}
