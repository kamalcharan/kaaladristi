/**
 * TechnicalCards — Grid of technical indicator cards.
 *
 * Displays IB30 status, Order Flow, Chartink Rules, and Confluence Score.
 * Mirrors the LuckyPop indicator's tech table sections.
 *
 * Currently shows placeholder state for indicators that need a backend
 * data source. Cards that CAN be populated from existing snapshot data
 * (like signal classification) are filled in.
 */

import { BarChart3, Activity, Gauge, Layers, Zap, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui';
import type { SnapshotSignals } from '@/types';
import type { LucideIcon } from 'lucide-react';

interface TechnicalCardsProps {
  signals: SnapshotSignals | null;
}

interface TechCardProps {
  title: string;
  icon: LucideIcon;
  status: string;
  statusColor: string;
  rows: { label: string; value: string; color?: string }[];
  available: boolean;
}

function TechCard({ title, icon: Icon, status, statusColor, rows, available }: TechCardProps) {
  return (
    <Card className={cn('p-4', !available && 'opacity-60')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-900/60 border border-kd-border">
            <Icon className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <span className="text-[11px] font-bold text-white uppercase tracking-wide">{title}</span>
        </div>
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md', statusColor)}>
          {status}
        </span>
      </div>

      {/* Rows */}
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-[10px] text-muted">{row.label}</span>
            <span className={cn('text-[11px] font-bold mono', row.color || 'text-slate-400')}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Unavailable indicator */}
      {!available && (
        <div className="mt-2 pt-2 border-t border-dashed border-white/5">
          <p className="text-[9px] text-slate-600 text-center">Awaiting data source</p>
        </div>
      )}
    </Card>
  );
}

export default function TechnicalCards({ signals }: TechnicalCardsProps) {
  // Signal classification from backend
  const classification = signals?.classification ?? '—';
  const netScore = signals?.net_score ?? 0;
  const firedCount = signals?.fired_count ?? 0;
  const totalRules = signals?.total_rules ?? 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Signal Classification — has real data */}
      <TechCard
        title="Signal Engine"
        icon={Radio}
        status={classification}
        statusColor={
          netScore > 0 ? 'bg-risk-green/10 text-risk-green' :
          netScore < 0 ? 'bg-risk-red/10 text-risk-red' :
          'bg-slate-800 text-slate-400'
        }
        rows={[
          { label: 'Net Score', value: String(netScore), color: netScore > 0 ? 'text-risk-green' : netScore < 0 ? 'text-risk-red' : 'text-slate-400' },
          { label: 'Rules Fired', value: `${firedCount} / ${totalRules}` },
          { label: 'Classification', value: classification },
        ]}
        available={!!signals}
      />

      {/* IB30 Status — needs backend */}
      <TechCard
        title="IB30 Status"
        icon={BarChart3}
        status="—"
        statusColor="bg-slate-800 text-slate-500"
        rows={[
          { label: 'IB30 High', value: '—' },
          { label: 'IB30 Low', value: '—' },
          { label: 'IS30 Signal', value: '—' },
        ]}
        available={false}
      />

      {/* Order Flow — needs backend */}
      <TechCard
        title="Order Flow"
        icon={Activity}
        status="—"
        statusColor="bg-slate-800 text-slate-500"
        rows={[
          { label: 'Delta', value: '—' },
          { label: 'Flow Type', value: '—' },
          { label: 'Absorption', value: '—' },
        ]}
        available={false}
      />

      {/* Chartink Rules — needs backend */}
      <TechCard
        title="Chartink Rules"
        icon={Layers}
        status="—"
        statusColor="bg-slate-800 text-slate-500"
        rows={[
          { label: 'R1: EMD', value: '—' },
          { label: 'R2: Correction', value: '—' },
          { label: 'R3: VMAC', value: '—' },
        ]}
        available={false}
      />

      {/* Confluence Score — partially available */}
      <TechCard
        title="Confluence"
        icon={Gauge}
        status={signals ? `${Math.min(10, Math.round((firedCount / Math.max(totalRules, 1)) * 10))}/10` : '—'}
        statusColor={
          signals && firedCount > totalRules * 0.6 ? 'bg-risk-green/10 text-risk-green' :
          signals && firedCount > totalRules * 0.3 ? 'bg-risk-amber/10 text-risk-amber' :
          'bg-slate-800 text-slate-500'
        }
        rows={[
          { label: 'Astro Signals', value: signals ? `${firedCount} active` : '—', color: signals ? 'text-accent-indigo' : undefined },
          { label: 'Tech Signals', value: '—' },
          { label: 'Combined', value: '—' },
        ]}
        available={!!signals}
      />

      {/* RSI Divergence — needs backend */}
      <TechCard
        title="RSI Divergence"
        icon={Zap}
        status="—"
        statusColor="bg-slate-800 text-slate-500"
        rows={[
          { label: 'Type', value: '—' },
          { label: 'Bars Since', value: '—' },
          { label: 'Freshness', value: '—' },
        ]}
        available={false}
      />
    </div>
  );
}
