import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import type { MarketSymbol } from '@/types';

const symbols: MarketSymbol[] = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX'];

export default function SymbolSwitcher() {
  const { selectedSymbol, setSymbol } = useAppStore();

  return (
    <div className="bg-slate-900/60 border border-white/10 p-1.5 rounded-2xl flex backdrop-blur-md shadow-2xl">
      {symbols.map((s) => (
        <button
          key={s}
          onClick={() => setSymbol(s)}
          className={cn(
            'px-6 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300',
            selectedSymbol === s
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'text-slate-500 hover:text-slate-300'
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
