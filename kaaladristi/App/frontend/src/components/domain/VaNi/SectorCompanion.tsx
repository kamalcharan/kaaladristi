import SectorPersonalConnections from './SectorPersonalConnections';
import LeadershipCompanion from './LeadershipCompanion';
import { fetchSectorPulseContext, sectorPulseRows, type SectorIndexRow } from '@/services/sectorRotation';
import { SectorPulseContent } from '@/components/domain/DashboardV3/SectorPulse';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { useSectorResearchStore } from '@/stores/sectorResearchStore';
import { useAuthStore } from '@/stores/authStore';
import { sectorSessionDate, sectorSignal, SECTOR_FLOW_LABEL } from '@/lib/sectorFlow';
import VaNiFeedback from './VaNiFeedback';
import '@/styles/sectorResearch.css';

const API = import.meta.env.VITE_PIPELINE_API_URL?.trim() || '';
const intents = {
  'sector.overview': 'What’s happening here?',
  'sector.read': 'Explain this flow', 'sector.compare': 'Why do Flow 5D and Flow 22D differ?',
  'sector.persistence': 'Has this flow persisted?', 'sector.participation': 'Is participation broad or concentrated?',
  'sector.learn': 'Help me read this page', 'sector.taxonomy': 'Indices, curated baskets and industries',
} as const;
type Intent = keyof typeof intents;
interface Response {
  response?: string; error?: string; pending?: boolean; context_changed?: boolean; log_id?: string;
  facts?: string[]; snapshot?: string; date?: string;
  period?: number; history?: SectorIndexRow[]; rows?: SectorIndexRow[]; index_count?: number;
}
async function ask(body: object): Promise<Response> {
  const res = await fetch(`${API}/api/vani/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('VaNi is unavailable. Your research data remains accessible.');
  const data = await res.json();
  return data;
}
export default function SectorCompanion() {
  const mode=useSectorResearchStore(s=>s.mode);
  const {pathname}=useLocation();
  return mode==='leadership' && pathname==='/sector-rotation' ? <LeadershipCompanion/> : <CurrentSectorCompanion/>;
}
function CurrentSectorCompanion() {
  const { pathname } = useLocation();
  const context = useSectorResearchStore();
  const user = useAuthStore(s => s.profile?.id);
  const indexId = Number(pathname.match(/^\/sector-rotation\/(\d+)/)?.[1]) || undefined;
  const [intent, setIntent] = useState<Intent>(indexId ? 'sector.learn' : 'sector.overview');
  const [depth, setDepth] = useState('brief');
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const [cycle, setCycle] = useState(0);
  const [presented, setPresented] = useState('');
  const overview = !indexId && intent === 'sector.overview';
  const staticIntent = intent === 'sector.learn' || intent === 'sector.taxonomy';
  const selected = { date: overview ? undefined : context.date, entity_type: 'index', entity_id: indexId,
    sector_category: overview ? 'overall' : context.category, sector_period: overview ? 22 : context.period };
  const identity = JSON.stringify([pathname, overview ? 'overall' : [context.date, context.category, context.period]]);
  const evidence = useQuery({
    queryKey: ['sector-vani-context', identity], enabled: context.scope === pathname && !!context.date,
    staleTime: 60_000, retry: false,
    queryFn: async () => { const r: Response = overview ? await fetchSectorPulseContext() : await ask({ ...selected, intent_id: 'sector.context' }); if (r.error) throw new Error(r.error); return r; },
  });
  const reading = useQuery({
    queryKey: ['vani', 'sector', 1, user, intent, depth, staticIntent ? 'static' : evidence.data?.snapshot],
    enabled: staticIntent || (!!evidence.data?.snapshot && context.scope === pathname),
    staleTime: 30 * 60_000, retry: false,
    refetchInterval: query => query.state.data?.pending ? 1500 : false,
    queryFn: () => ask({ ...selected, intent_id: intent, explanation_depth: depth, sector_snapshot: evidence.data?.snapshot }),
  });
  const key = JSON.stringify([identity, intent, depth, cycle, evidence.data?.snapshot]);
  useEffect(() => { const timer = window.setTimeout(() => setPresented(key), 450); return () => window.clearTimeout(timer); }, [key]);
  useEffect(() => { setIntent(indexId ? 'sector.learn' : 'sector.overview'); setDepth('brief'); }, [pathname, indexId]);
  useEffect(() => {
    const el = dialog.current;
    if (open && el && !el.open) el.showModal();
    if (!open && el?.open) el.close();
  }, [open]);
  const choose = (id: Intent) => { setIntent(id); setCycle(c => c + 1); if (!indexId && id !== 'sector.overview' && window.matchMedia('(max-width: 1279px)').matches) setOpen(true); };
  const loading = key !== presented || reading.isFetching || reading.data?.pending || (!staticIntent && evidence.isFetching);
  const issue = reading.error?.message || reading.data?.error || (!staticIntent && evidence.error?.message);
  const retry = async () => {
    setCycle(c => c + 1);
    if (reading.data?.context_changed || evidence.isError) await evidence.refetch();
    else await reading.refetch();
  };
  const body = <div className="sector-vani-body">
    {!overview && <>
    <p className="text-xs text-muted">Discover activity → check persistence → inspect participation → save an observation.</p>
    <div className="flex flex-wrap gap-2" aria-label="Sector questions">{Object.entries(intents).filter(([id]) => indexId ? id !== 'sector.overview' : id !== 'sector.participation').map(([id, label]) =>
      <button key={id} aria-pressed={intent === id} onClick={() => choose(id as Intent)} className="sector-question">{label}</button>)}</div>
    {!staticIntent && <div className="flex flex-wrap gap-2">{['brief','simple','detailed'].map(d => <button className="sector-question" key={d} aria-pressed={depth === d} onClick={() => setDepth(d)}>{d === 'brief' ? 'Concise' : d === 'simple' ? 'Explain simply' : 'Go deeper'}</button>)}</div>}
    </>}
    <h3 className="text-sm font-medium">{intents[intent]}</h3>
    {overview && <p className="text-xs text-muted">Overall sector flow · Sectoral + Curated · same coverage as Discovery</p>}
    {overview && evidence.data?.rows && <SectorPulseContent key={evidence.data.snapshot} embedded data={sectorPulseRows({ rows: evidence.data.rows, history: evidence.data.history ?? [] })} />}
    {loading ? <div role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Consulting VaNi…</div>
      : issue ? <div role="status"><p className="text-sm">{issue}</p><button className="sector-question mt-2" onClick={retry}>Try again</button></div>
      : !staticIntent && !evidence.data ? <p className="text-sm">Select an available session to read its evidence.</p>
      : <p className="text-sm leading-7 whitespace-pre-wrap">{reading.data?.response}</p>}
    {!loading && !issue && reading.data?.log_id && <VaNiFeedback key={reading.data.log_id} logId={reading.data.log_id} />}
    {!overview && evidence.data && <details><summary className="cursor-pointer text-sm">Inspect the evidence</summary>
      {indexId && <div className="h-44 mt-3" role="img" aria-label="Selected index Flow 5D and Flow 22D history"><ResponsiveContainer width="100%" height="100%"><LineChart data={evidence.data.history}>
        <XAxis dataKey="trade_date" tickFormatter={sectorSessionDate} tick={{ fontSize: 9 }} minTickGap={40} /><YAxis width={35} tick={{fontSize:9}} />
        <Tooltip labelFormatter={v => sectorSessionDate(String(v))} contentStyle={{ background:'var(--card)',borderColor:'var(--border)' }} />
        <Line dataKey="score_5d" name="Flow 5D" stroke="var(--accent)" dot={false}/><Line dataKey="score_22d" name="Flow 22D" stroke="var(--text-primary)" strokeDasharray="4 3" dot={false}/>
      </LineChart></ResponsiveContainer></div>}
      {evidence.data.facts?.map((fact,i)=><p key={i} className="text-xs leading-6 mt-2 text-muted">{fact}</p>)}
    </details>}
    {evidence.data?.rows && <SectorPersonalConnections sourceKey={evidence.data.snapshot} date={evidence.data.date} sectors={evidence.data.rows.map(r=>{const signal=sectorSignal(r);return {id:r.index_id,name:r.name,reading:signal?SECTOR_FLOW_LABEL[signal]:'Unavailable'}})}/>}
    {overview && <details><summary className="text-xs cursor-pointer min-h-11">Explore another question</summary>    <div className="flex flex-wrap gap-2" aria-label="Sector questions">{Object.entries(intents).filter(([id]) => indexId ? id !== 'sector.overview' : id !== 'sector.participation').map(([id, label]) =>
      <button key={id} aria-pressed={intent === id} onClick={() => choose(id as Intent)} className="sector-question">{label}</button>)}</div></details>}
  </div>;
  return <aside className="sector-vani" aria-label="VaNi Sector Rotation companion">
    <header className="p-4 border-b border-[var(--border)]"><h2 className="text-lg font-serif">VaNi · वाणी</h2><p className="text-xs text-muted">Sector research · {(overview ? evidence.data?.date : context.date) ? sectorSessionDate((overview ? evidence.data?.date : context.date)!) : 'Select a session'}</p>
      <button ref={launcher} className={`${overview ? 'hidden' : 'sector-vani-launch'} sector-question mt-3`} onClick={() => { setOpen(true); setCycle(c=>c+1); }}>Help me read this page</button></header>
    <div className={overview ? "sector-vani-overview" : "sector-vani-desktop"}>{body}</div>
    <dialog ref={dialog} className="sector-vani-dialog" onCancel={() => setOpen(false)} onClose={() => { setOpen(false); launcher.current?.focus(); }}>
      <header className="flex items-center justify-between p-4 border-b border-[var(--border)]"><h2 className="font-medium">VaNi · Sector research</h2><button autoFocus className="sector-question" onClick={() => setOpen(false)}>Close</button></header>{open && body}
    </dialog>
  </aside>;
}
