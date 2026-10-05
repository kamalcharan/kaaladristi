import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchAstroFamilies } from '@/services/astroEvents';
import { useVaNiStore } from '@/stores/vaniStore';
/** Uses the same published families as the calendar and overlay selector. */
export default function AstroEventRibbon({ overlay = false }: {
    overlay?: boolean;
}) {
    const open = useVaNiStore(s => s.openWithIntent);
    const { data } = useQuery({ queryKey: ['astro', 'families', false], queryFn: () => fetchAstroFamilies(), staleTime: 60000 });
    if (!data?.length)
        return null;
    const planets = [...new Set(data.flatMap(f => f.planets))].join(' · ');
    return <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '6px 10px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, ...(overlay ? { position: 'absolute', top: 6, left: 8, right: 8, zIndex: 15 } as const : { marginBottom: 6 }) }}>
   <span>{planets}</span><button onClick={() => open('index.astro_now')}>Ask VaNi about these events</button><Link to="/almanac">Calendar →</Link><span className="text-muted">Select a date, then a named event in the panel beside the chart</span>
 </div>;
}
