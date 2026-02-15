import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpandableSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export default function ExpandableSection({ title, children, defaultOpen = false }: ExpandableSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-kd-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 group"
      >
        <span className="text-xs font-bold uppercase tracking-widest text-muted group-hover:text-slate-300 transition-colors">
          {title}
        </span>
        <ChevronRight className={cn(
          'w-4 h-4 text-muted transition-transform duration-200',
          open && 'rotate-90'
        )} />
      </button>
      {open && (
        <div className="pb-6 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}
