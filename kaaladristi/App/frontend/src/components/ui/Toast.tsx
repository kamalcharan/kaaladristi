import { useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, message: string, duration = 3500) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  return { toasts, toast, dismiss };
}

// ── Single Toast ──────────────────────────────────────────────────────────────

const TOAST_META: Record<ToastType, {
  icon: React.ElementType;
  border: string;
  iconColor: string;
  bg: string;
}> = {
  success: {
    icon: CheckCircle2,
    border: 'border-l-risk-green',
    iconColor: 'text-risk-green',
    bg: 'bg-[#0f172a]/95',
  },
  error: {
    icon: XCircle,
    border: 'border-l-risk-red',
    iconColor: 'text-risk-red',
    bg: 'bg-[#0f172a]/95',
  },
  info: {
    icon: Info,
    border: 'border-l-accent-indigo',
    iconColor: 'text-accent-indigo',
    bg: 'bg-[#0f172a]/95',
  },
};

function SingleToast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const { icon: Icon, border, iconColor, bg } = TOAST_META[item.type];

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3.5 rounded-xl border border-white/8 border-l-4 shadow-xl shadow-black/40 min-w-[280px] max-w-sm backdrop-blur-xl',
        bg,
        border,
      )}
      style={{ animation: 'kaala-toast-in 0.2s ease-out' }}
    >
      <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', iconColor)} />
      <p className="text-sm text-slate-200 flex-1 leading-snug">{item.message}</p>
      <button
        onClick={() => onDismiss(item.id)}
        className="text-slate-600 hover:text-slate-300 transition-colors shrink-0 mt-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Container ─────────────────────────────────────────────────────────────────

export function ToastContainer({ toasts, onDismiss }: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[300] flex flex-col gap-2.5 items-end">
      {toasts.map(t => (
        <SingleToast key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
