import SectorHorizonComparison from './SectorHorizonComparison';
import SectorEvidence, {type EvidenceSection} from './SectorEvidence';
import SectorIntentStory, {SectorLearningStory, type SectorIntentView} from './SectorIntentStory';
import { useVaniAnalytics } from '@/hooks/useVaniAnalytics';
import { trackVani } from '@/lib/vaniAnalytics';
import SectorPersonalConnections from './SectorPersonalConnections';
import LeadershipCompanion from './LeadershipCompanion';
import SectorDetailLeadershipCompanion from './SectorDetailLeadershipCompanion';
import { fetchSectorPulseContext, sectorPulseRows, SECTOR_TAB_LABELS, type SectorIndexRow } from '@/services/sectorRotation';
import { SectorPulseContent } from '@/components/domain/DashboardV3/SectorPulse';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { useSectorResearchStore } from '@/stores/sectorResearchStore';
import { useAuthStore } from '@/stores/authStore';
import { sectorSessionDate, sectorSignal, SECTOR_FLOW_LABEL } from '@/lib/sectorFlow';
import VaNiFeedback from './VaNiFeedback';
import VaNiBrand, {VaNiConsulting, VaNiDepthSelector} from './VaNiBrand';
import '@/styles/sectorResearch.css';

const API = import.meta.env.VITE_PIPELINE_API_URL?.trim() || '';
const intents = {
  'sector.overview': 'What’s happening here?',
  'sector.entering': 'Where is flow entering?', 'sector.fading': 'Where is flow fading?', 'sector.leaving': 'Where is flow leaving?',
  'sector.read': 'What does short-term activity show?',
  'sector.horizons': 'Do short-term flow and longer-term strength agree?', 'sector.compare': 'Why do Flow 5D and Flow 22D differ?',
  'sector.persistence': 'Has this flow persisted?', 'sector.participation': 'Is participation broad or concentrated?',
  'sector.learn': 'Help me read this page', 'sector.taxonomy': 'Indices, curated baskets and industries',
} as const;
// Main-page launch scope. Other implementations remain available for later review.
// TODO: leaving, read, compare, learn and taxonomy as separate main-page intents.
const MAIN_INTENTS = new Set(['sector.overview','sector.entering','sector.fading','sector.persistence']);
type Intent = keyof typeof intents;
const detailLabels:Partial<Record<Intent,string>>={'sector.persistence':'Has short-term strength persisted?','sector.participation':'Which stocks support the short-term move?'};
interface Response {
  breadth_zone?: {zone:string};
  response?: string; error?: string; pending?: boolean; context_changed?: boolean; log_id?: string;
  evidence_sections?: EvidenceSection[]; constituents?: {symbol:string}[];
  facts?: string[]; snapshot?: string; date?: string;
  intent_views?: Record<string,SectorIntentView>;
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
  if (mode === 'leadership' && /^\/sector-rotation\/\d+$/.test(pathname)) return <SectorDetailLeadershipCompanion/>;
  return mode==='leadership' && pathname==='/sector-rotation' ? <LeadershipCompanion/> : <CurrentSectorCompanion/>;
}
function CurrentSectorCompanion() {
  const { pathname } = useLocation();
  const context = useSectorResearchStore();
  const user = useAuthStore(s => s.profile?.id);
  const indexId = Number(pathname.match(/^\/sector-rotation\/(\d+)/)?.[1]) || undefined;
  const [intent, setIntent] = useState<Intent>(indexId ? 'sector.read' : 'sector.overview');
  const [depth, setDepth] = useState('brief');
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const [cycle, setCycle] = useState(0);
  const [presented, setPresented] = useState('');
  const horizons = !!indexId && intent === 'sector.horizons';
  const overview = !indexId && intent === 'sector.overview';
  const staticIntent = intent === 'sector.learn' || intent === 'sector.taxonomy';
  const selected = { date: overview ? undefined : context.date, entity_type: 'index', entity_id: indexId,
    sector_category: overview ? 'overall' : context.category, sector_period: overview ? 22 : context.period };
  const identity = JSON.stringify([pathname, overview ? 'overall' : [context.date, context.category, context.period]]);
  const evidence = useQuery({
    queryKey: ['sector-vani-context', 8, identity], enabled: context.scope === pathname && !!context.date,
    staleTime: 60_000, retry: false,
    queryFn: async () => { const r: Response = overview ? await fetchSectorPulseContext() : await ask({ ...selected, intent_id: 'sector.context' }); if (r.error) throw new Error(r.error); return r; },
  });
  const reading = useQuery({
    queryKey: ['vani', 'sector', 8, user, intent, depth, staticIntent ? 'static' : evidence.data?.snapshot],
    enabled: !horizons && (staticIntent || (!!evidence.data?.snapshot && context.scope === pathname)),
    staleTime: 30 * 60_000, retry: false,
    refetchInterval: query => query.state.data?.pending ? 1500 : false,
    queryFn: () => ask({ ...selected, intent_id: intent, explanation_depth: depth, sector_snapshot: evidence.data?.snapshot }),
  });
  const key = JSON.stringify([identity, intent, depth, cycle, evidence.data?.snapshot]);
  useEffect(() => { const timer = window.setTimeout(() => setPresented(key), 450); return () => window.clearTimeout(timer); }, [key]);
  useEffect(() => { setIntent(indexId ? 'sector.read' : 'sector.overview'); setDepth('brief'); }, [pathname, indexId]);
  useEffect(() => {
    const el = dialog.current;
    if (open && el && !el.open) el.showModal();
    if (!open && el?.open) el.close();
  }, [open]);
  const choose = (id: Intent) => { trackVani('intent_selected',{...analyticsContext,intent_id:id,source:'manual'}); setIntent(id); setCycle(c => c + 1); if(id==='sector.overview')setOpen(false); if (!indexId && id !== 'sector.overview' && window.matchMedia('(max-width: 1279px)').matches) setOpen(true); };
  const loading = key !== presented || reading.isFetching || reading.data?.pending || (!staticIntent && evidence.isFetching);
  const issue = reading.error?.message || reading.data?.error || (!staticIntent && evidence.error?.message);
  const analyticsContext={page:indexId ? 'sector_detail' : 'sector_rotation',mode:'current_flow' as const,intent_id:intent,period:selected.sector_period};
  const analytics=useVaniAnalytics(analyticsContext,{key:JSON.stringify([identity,intent,depth,cycle,user]),ready:!loading&&!!reading.data?.response&&!issue&&!reading.data?.context_changed,failed:!loading&&!!(issue||reading.data?.context_changed)},true);
  const retry = async () => {
    trackVani('retry',analyticsContext);
    setCycle(c => c + 1);
    if (reading.data?.context_changed || evidence.isError) await evidence.refetch();
    else await reading.refetch();
  };
  const story=!indexId&&!overview ? evidence.data?.intent_views?.[intent] : undefined;
  const personalRows=story ? (evidence.data?.rows??[]).filter(r=>story.matching_ids.includes(r.index_id)) : evidence.data?.rows??[];
  const listingFollowup=!indexId&&!overview;
  const body = <div className="sector-vani-body">
    {!overview && <>
    <p className="text-xs text-muted">{indexId ? "Short term: 5/22-session flow and recent participation. Longer term: completed weekly/monthly strength." : "Discover activity → check persistence → inspect participation → save an observation."}</p>
    <details open={indexId ? true : undefined} data-vani-detail={indexId ? undefined : "intents"}><summary className="sector-question cursor-pointer">Questions about current flow</summary><div className="flex flex-wrap gap-2 pt-2" aria-label="Sector questions">{Object.entries(intents).filter(([id]) => indexId ? ['sector.read','sector.horizons','sector.persistence','sector.participation'].includes(id) : MAIN_INTENTS.has(id)).map(([id, label]) =>
      <button key={id} aria-pressed={intent === id} onClick={() => choose(id as Intent)} className="sector-question">{indexId ? detailLabels[id as Intent]??label : label}</button>)}</div></details>
    {!staticIntent && <VaNiDepthSelector value={depth} onChange={setDepth} />}
    </>}
    <h3 className="text-sm font-medium">{indexId ? detailLabels[intent]??intents[intent] : intents[intent]}</h3>
    {overview && <p className="text-xs text-muted">Overall sector flow · Sectoral + Curated · same coverage as Discovery</p>}
    {overview && evidence.data?.rows && <SectorPulseContent key={evidence.data.snapshot} embedded data={sectorPulseRows({ rows: evidence.data.rows, history: evidence.data.history ?? [] })} />}
    {listingFollowup&&<p className="text-xs text-muted">{SECTOR_TAB_LABELS[context.category]} · selected closing session · {context.period}-session window. Overall flow is available in “What’s happening here?”.</p>}
    {listingFollowup&&staticIntent&&<SectorLearningStory taxonomy={intent==='sector.taxonomy'}/>}
    {listingFollowup&&!staticIntent&&!evidence.isFetching&&!evidence.error&&story&&<SectorIntentStory key={`${intent}-${evidence.data?.snapshot}`} view={story} intent={intent}/>}
    {listingFollowup&&!staticIntent&&!evidence.isFetching&&evidence.data&&!story&&<p role="status">This reading is temporarily unavailable. Please refresh and try again.</p>}
    {loading ? <VaNiConsulting />
      : issue ? <div role="status"><p className="text-sm">{issue}</p><button className="sector-question mt-2" onClick={retry}>Try again</button></div>
      : !staticIntent && !evidence.data ? <p className="text-sm">Select an available session to read its evidence.</p>
      : horizons ? <SectorHorizonComparison indexId={indexId!} category={context.category} date={context.date} months={context.months??6} depth={depth} greed={evidence.data?.breadth_zone?.zone==='Greed'} />
      : listingFollowup ? <details key={`${intent}-${depth}`} data-vani-detail="explanation" className="vani-explanation"><summary>VaNi explanation</summary><p className="text-sm leading-7 whitespace-pre-wrap">{reading.data?.response}</p>{reading.data?.log_id&&<VaNiFeedback analyticsContext={analyticsContext} key={reading.data.log_id} logId={reading.data.log_id}/>}</details>
      : <p className="text-sm leading-7 whitespace-pre-wrap">{reading.data?.response}</p>}
    {!listingFollowup && !loading && !issue && reading.data?.log_id && <VaNiFeedback analyticsContext={analyticsContext} key={reading.data.log_id} logId={reading.data.log_id} />}
    {!!indexId && evidence.data && <details data-vani-detail="evidence"><summary className="cursor-pointer text-sm">Inspect the evidence</summary>
      {indexId && <div className="h-44 mt-3" role="img" aria-label="Selected index Flow 5D and Flow 22D history"><ResponsiveContainer width="100%" height="100%"><LineChart data={evidence.data.history}>
        <XAxis dataKey="trade_date" tickFormatter={sectorSessionDate} tick={{ fontSize: 9 }} minTickGap={40} /><YAxis width={35} tick={{fontSize:9}} />
        <Tooltip labelFormatter={v => sectorSessionDate(String(v))} contentStyle={{ background:'var(--card)',borderColor:'var(--border)' }} />
        <Line dataKey="score_5d" name="Flow 5D" stroke="var(--accent)" dot={false}/><Line dataKey="score_22d" name="Flow 22D" stroke="var(--text-primary)" strokeDasharray="4 3" dot={false}/>
      </LineChart></ResponsiveContainer></div>}
      <SectorEvidence sections={evidence.data.evidence_sections ?? [{title:"Selected evidence",items:evidence.data.facts ?? []}]} symbols={evidence.data.constituents?.map(r=>r.symbol) ?? []} />
    </details>}
    {(indexId||overview||staticIntent||story)&&evidence.data?.rows && <SectorPersonalConnections sourceKey={evidence.data.snapshot} date={evidence.data.date} sectors={personalRows.map(r=>{const signal=sectorSignal(r);return {id:r.index_id,name:r.name,reading:signal?SECTOR_FLOW_LABEL[signal]:'Unavailable'}})}/>}
    {overview && <details data-vani-detail="intents"><summary className="text-xs cursor-pointer min-h-11">Explore another question</summary>    <div className="flex flex-wrap gap-2" aria-label="Sector questions">{Object.entries(intents).filter(([id]) => indexId ? ['sector.read','sector.horizons','sector.persistence','sector.participation'].includes(id) : MAIN_INTENTS.has(id)).map(([id, label]) =>
      <button key={id} aria-pressed={intent === id} onClick={() => choose(id as Intent)} className="sector-question">{indexId ? detailLabels[id as Intent]??label : label}</button>)}</div></details>}
  </div>;
  return <aside {...analytics} className="ph-no-capture sector-vani" aria-label="VaNi Sector Rotation companion">
    <header className="p-4 border-b border-[var(--border)]"><VaNiBrand subtitle={<>Sector research · {(overview ? evidence.data?.date : context.date) ? sectorSessionDate((overview ? evidence.data?.date : context.date)!) : 'Select a session'}</>} />
      <button ref={launcher} className={`${overview ? 'hidden' : 'sector-vani-launch'} sector-question mt-3`} onClick={() => { setOpen(true); setCycle(c=>c+1); }}>Help me read this page</button></header>
    <div className={overview ? "sector-vani-overview" : "sector-vani-desktop"}>{body}</div>
    <dialog ref={dialog} className="sector-vani-dialog" onCancel={() => setOpen(false)} onClose={() => { setOpen(false); launcher.current?.focus(); }}>
      <header className="flex items-center justify-between p-4 border-b border-[var(--border)]"><VaNiBrand size={36} subtitle="Sector research" /><button autoFocus className="sector-question" onClick={() => setOpen(false)}>Close</button></header>{open && body}
    </dialog>
  </aside>;
}
