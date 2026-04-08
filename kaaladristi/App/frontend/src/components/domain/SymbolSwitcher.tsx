import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import type { MarketSymbol } from '@/types';

const symbols: MarketSymbol[] = ['NIFTY', 'BANKNIFTY', 'NIFTYIT', 'NIFTYFMCG'];

export default function SymbolSwitcher() {
  const { selectedSymbol, setSymbol } = useAppStore();

  return (
    <div className="bg-kd-card border border-kd-border p-1.5 rounded-2xl flex backdrop-blur-md shadow-2xl">
      {symbols.map((s) => (
        <button
          key={s}
          onClick={() => setSymbol(s)}
          className={cn(
            'px-6 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300',
            selectedSymbol === s
              ? 'bg-accent-indigo text-[var(--text-primary)] shadow-lg shadow-[color-mix(in_srgb,var(--accent-indigo)_20%,transparent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
