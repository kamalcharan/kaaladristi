import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

export default function DatePicker() {
  const { selectedDate, setDate } = useAppStore();

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="flex items-center gap-1.5 bg-slate-900/60 border border-white/10 rounded-2xl p-1.5 backdrop-blur-md shadow-2xl">
      <button
        onClick={() => shiftDate(-1)}
        className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all"
        aria-label="Previous day"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <input
        type="date"
        value={selectedDate}
        onChange={(e) => e.target.value && setDate(e.target.value)}
        className="bg-transparent text-[11px] font-bold font-mono text-slate-200 tracking-wider px-3 py-2 rounded-xl outline-none border-none appearance-none [color-scheme:dark] cursor-pointer hover:bg-white/5 transition-colors"
      />

      <button
        onClick={() => shiftDate(1)}
        className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all"
        aria-label="Next day"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
