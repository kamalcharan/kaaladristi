import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchAstroFamilies } from '@/services/astroEvents';
export default function OverlayExplainPopover({ tag, anchorX, anchorY, onClose, focusRuleId, focusRuleLabel, coincident }: {
    tag: string;
    anchorX: number;
    anchorY: number;
    onClose: () => void;
    focusRuleId?: number | null;
    focusRuleLabel?: string;
    coincident?: {
        ruleId: number;
        label: string;
    }[];
}) {
    const ref = useRef<HTMLDivElement>(null);
    const { data } = useQuery({ queryKey: ['astro', 'families', false], queryFn: () => fetchAstroFamilies() });
    const family = data?.find(f => f.rule_id === focusRuleId || f.id === tag);
    useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === 'Escape')
        onClose(); }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close); }, [onClose]);
    return <div ref={ref} role="dialog" aria-label="Event details" style={{ position: 'fixed', left: Math.max(8, Math.min(anchorX, window.innerWidth - 348)), top: Math.max(8, Math.min(anchorY, window.innerHeight - 300)), width: 'min(340px,calc(100vw - 16px))', maxHeight: '70vh', overflowY: 'auto', padding: 18, zIndex: 500, background: 'var(--card)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 12 }}>
 <button onClick={onClose} aria-label="Close event details" style={{ float: 'right' }}>×</button>
 <strong>{focusRuleLabel ?? family?.name ?? 'Planetary event'}</strong>
 <p>{family?.description ?? 'This chart marker uses the published planetary calendar.'}</p>
 <p>Dates include weekends and holidays. A daily-sample bracket is not an exact event time.</p>
 {coincident?.map(e => <p key={e.ruleId}>{e.label}</p>)}
 <Link to={`/almanac${family ? '?family=' + family.id : ''}`} onClick={onClose}>View dates and calculation →</Link>
 </div>;
}
