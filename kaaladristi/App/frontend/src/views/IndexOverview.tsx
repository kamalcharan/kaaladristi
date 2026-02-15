import { useNavigate } from 'react-router-dom';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useDayRisk, useSnapshot } from '@/hooks';
import { cn, getRiskColor, getRiskHex } from '@/lib/utils';
import { Card } from '@/components/ui';
import { RiskGauge, PanchangStrip } from '@/components/domain';
import { getRegimeIntel } from '@/lib/regimeIntel';
import type { MarketSymbol } from '@/types';

const CORE_INDEXES: { symbol: MarketSymbol; name: string; shortName: string }[] = [
  { symbol: 'NIFTY',      name: 'NIFTY 50',     shortName: 'N50' },
  { symbol: 'BANKNIFTY',  name: 'BANK NIFTY',   shortName: 'BN' },
  { symbol: 'FINNIFTY',   name: 'FIN NIFTY',    shortName: 'FN' },
  { symbol: 'MIDCPNIFTY', name: 'MIDCAP NIFTY', shortName: 'MC' },
  { symbol: 'SENSEX',     name: 'SENSEX',        shortName: 'SX' },
];

function IndexCard({ symbol, name, shortName, date }: { symbol: MarketSymbol; name: string; shortName: string; date: string }) {
  const navigate = useNavigate();
  const { setSymbol } = useAppStore();
  const dayRisk = useDayRisk(date, symbol);

  const report = dayRisk.data;
  const loading = dayRisk.isLoading;

  const handleClick = () => {
    setSymbol(symbol);
    navigate(`/dashboard/${symbol}?date=${date}`);
  };

  if (loading) {
    return (
      <Card rounded="xxl" className="p-6 animate-pulse">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-slate-800/60" />
          <div className="flex-1">
            <div className="h-4 w-24 bg-slate-800/60 rounded-lg mb-1.5" />
            <div className="h-3 w-16 bg-slate-800/40 rounded-lg" />
          </div>
        </div>
        <div className="flex items-center justify-center py-6">
          <div className="w-20 h-20 rounded-full bg-slate-800/40" />
        </div>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card rounded="xxl" className="p-6 opacity-50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-slate-800/40 flex items-center justify-center text-xs font-bold text-slate-500">
            {shortName}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-400">{name}</p>
            <p className="text-[10px] text-muted">No data available</p>
          </div>
        </div>
      </Card>
    );
  }

  const intel = getRegimeIntel(report.regime);

  return (
    <Card
      rounded="xxl"
      className="p-6 cursor-pointer hover:border-white/10 hover:scale-[1.01] transition-all duration-300 group relative overflow-hidden"
    >
      <button onClick={handleClick} className="w-full text-left">
        {/* Subtle glow */}
        <div
          className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 -translate-y-1/2 translate-x-1/2 group-hover:opacity-20 transition-opacity"
          style={{ background: getRiskHex(report.riskScore) }}
        />

        {/* Header: icon + name + regime badge */}
        <div className="flex items-center gap-3 mb-4 relative z-10">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold',
            'bg-gradient-to-br from-indigo-600/20 to-violet-600/10 text-indigo-400'
          )}>
            {shortName}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{name}</p>
            <p className={cn('text-[10px] font-bold', intel.postureColor)}>
              {intel.posture} Posture
            </p>
          </div>
        </div>

        {/* Score gauge (compact) */}
        <div className="flex items-center gap-4 relative z-10 mb-4">
          <RiskGauge score={report.riskScore} size="mini" />
          <div className="flex-1">
            <p className={cn('text-2xl font-bold font-mono', getRiskColor(report.riskScore))}>
              {report.riskScore}
            </p>
            <p className="text-[10px] text-muted font-mono">Risk Score</p>
          </div>
        </div>

        {/* Risk bar */}
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-3 relative z-10">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${report.riskScore}%`, background: getRiskHex(report.riskScore) }}
          />
        </div>

        {/* Regime label */}
        <div className="flex items-center justify-between relative z-10">
          <span className="text-[10px] text-muted font-medium">{report.regime} Regime</span>
          <ArrowRight className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </div>
      </button>
    </Card>
  );
}

export default function IndexOverview() {
  const { selectedDate } = useAppStore();
  // Fetch panchang from any symbol's snapshot (panchang is date-based, not symbol-specific)
  const snapshot = useSnapshot(selectedDate, 'NIFTY');
  const panchang = snapshot.data?.panchang ?? null;

  const today = new Date().toISOString().split('T')[0];
  const displayDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <header>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">Market Overview</h1>
          {selectedDate === today && (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-emerald-400">Live</span>
            </div>
          )}
        </div>
        <p className="text-secondary text-sm">{displayDate}</p>
      </header>

      {/* Panchang Strip — visible to all users */}
      {panchang && <PanchangStrip panchang={panchang} />}

      {/* Index Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {CORE_INDEXES.map(idx => (
          <IndexCard
            key={idx.symbol}
            symbol={idx.symbol}
            name={idx.name}
            shortName={idx.shortName}
            date={selectedDate}
          />
        ))}
      </div>

      {/* Quick insight footer */}
      <Card rounded="xxl" className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-accent-indigo" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Select any index to view detailed risk analysis</p>
            <p className="text-[10px] text-muted mt-0.5">
              Includes regime interpretation, factor breakdown, 7-day outlook, and sector sensitivity
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
