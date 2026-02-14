import { Calendar } from 'lucide-react';

export default function CalendarView() {
  return (
    <div className="animate-fade-in">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Risk Calendar</h1>
        <p className="text-secondary font-medium">7-day forward-looking planetary risk view</p>
      </header>
      <div className="glass-card rounded-4xl p-16 flex flex-col items-center justify-center text-center">
        <Calendar className="w-16 h-16 text-slate-600 mb-6" />
        <p className="text-lg font-semibold text-slate-400 mb-2">Calendar view coming in Sprint 2</p>
        <p className="text-sm text-muted">Will show ephemeris data and daily risk scores for the week</p>
      </div>
    </div>
  );
}
