import { useVaniAnalytics } from '@/hooks/useVaniAnalytics';
import { trackVani } from '@/lib/vaniAnalytics';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { STRUCTURE_INTENTS, STRUCTURE_FOLLOWUPS, STRUCTURE_INTENT_VERSION, type StructureIntentId, type ExplanationDepth } from '@/config/marketStructureIntents';
import { useMarketStructureReading } from '@/hooks/useMarketStructureReading';
import { useMarketStructureStore, showStructureEvidence } from '@/stores/marketStructureStore';
import { useAuthStore } from '@/stores/authStore';
import { trackEvent } from '@/lib/analytics';
import { markGuideWalked } from '@/services/guideProgress';
import VaNiFeedback from './VaNiFeedback';

interface ReadingResponse {
  response: string | null; error?: string; facts?: string[]; log_id?: string;
  cached: boolean; context_changed?: boolean; pending?: boolean; date?: string; roc_date?: string;
}
const API = import.meta.env.VITE_PIPELINE_API_URL?.trim() || '';
const lesson = [
  { title: 'Start with participation', text: 'Read the percentage above each moving average. Compare the horizons before interpreting the composite score.', section: 'participation' as const },
  { title: 'Then compare momentum', text: 'Check two relationships: ROC 13 against zero, and ROC 13 against its five-session signal. Positive can still be fading.', section: 'momentum' as const },
  { title: 'Keep interpretation separate', text: 'Fear and Greed label the research framework. Neither threshold establishes a reversal. Compare sector evidence next.', section: 'framework' as const },
];

export default function MarketStructureCompanion() {
  const data = useMarketStructureReading();
  const queryClient = useQueryClient();
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [search, setSearch] = useSearchParams();
  useEffect(() => { if (search.get('guide') === 'market_structure') { setStep(0); setMobileExpanded(true); showStructureEvidence('participation'); setSearch({}, { replace: true }); } }, [search, setSearch]);
  const section = useMarketStructureStore(s => s.section);
  const userId = useAuthStore(s => s.profile?.id);
  const [intent, setIntent] = useState<StructureIntentId>('structure.read');
  const [depth, setDepth] = useState<ExplanationDepth>('brief');
  const [presentationCycle, setPresentationCycle] = useState(0);
  const [presentedKey, setPresentedKey] = useState<string | null>(null);
  const [step, setStep] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const guideKey = `vani:structure:guide:v1:${userId ?? 'guest'}`;
  useEffect(() => { try { setDismissed(localStorage.getItem(guideKey) === 'done'); } catch { setDismissed(false); } }, [guideKey]);
  const definition = STRUCTURE_INTENTS[intent];
  const isLive = definition.kind === 'live';
  const presentationKey = JSON.stringify([intent, depth, userId, section, presentationCycle,
    isLive ? data.snapshot : 'static', isLive ? data.period : 0, isLive ? data.selectedDate : null]);
  // A short presentation interval also covers instant browser-cache answers.
  // It never invalidates the query cache or triggers another LLM request.
  useEffect(() => {
    const timer = window.setTimeout(() => setPresentedKey(presentationKey), 450);
    return () => window.clearTimeout(timer);
  }, [presentationKey]);
  const ready = !data.isLoading && !data.isError && !!(data.breadth.length || data.roc.length);
  const reading = useQuery<ReadingResponse>({
    queryKey: ['vani', 'structure', STRUCTURE_INTENT_VERSION, userId, intent, depth, isLive ? data.snapshot : 'static', isLive ? data.period : 0, isLive ? data.selectedDate : null],
    enabled: section !== 'historical' && (!isLive || ready),
    staleTime: 30 * 60 * 1000, retry: false,
    refetchInterval: query => query.state.data?.pending ? 1500 : false,
    queryFn: async () => {
      const response = await fetch(`${API}/api/vani/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent_id: intent, date: data.selectedDate ?? undefined,
          structure_period: data.period, structure_snapshot: data.snapshot, explanation_depth: depth }),
      });
      if (!response.ok) throw new Error('The explanation is unavailable. Your charts remain available.');
      return response.json();
    },
  });
  const choose = (id: StructureIntentId) => { setPresentationCycle(n => n + 1); setIntent(id); setDepth('brief'); trackVani('intent_selected', {...analyticsContext,intent_id:id,source:'manual'}); };
  const endGuide = () => { void markGuideWalked('market_structure'); trackEvent('market_structure_guide_closed', { step }); setStep(null); setDismissed(true); try { localStorage.setItem(guideKey, 'done'); } catch { /* preference only */ } };
  const guideTo = (n: number) => { setStep(n); showStructureEvidence(lesson[n].section); };
  const target = definition.section;
  const issue = reading.data?.error || (reading.isError ? 'The explanation is unavailable. Your charts remain available.' : null);
  const retryReading = async () => {
    trackVani('retry',analyticsContext);
    setPresentationCycle(n => n + 1);
    if (reading.data?.context_changed) {
      await data.refresh();
      await queryClient.invalidateQueries({ queryKey: ['vani', 'structure'] });
    } else await reading.refetch();
  };
  const consulting = presentedKey !== presentationKey || reading.isFetching || reading.data?.pending;
  const analyticsContext={page:'market_structure',mode:'market_structure' as const,intent_id:intent,period:data.period};
  const analytics=useVaniAnalytics(analyticsContext,{key:JSON.stringify([intent,depth,userId,section,presentationCycle,data.period,data.selectedDate]),ready:section!=='historical'&&!consulting&&!!reading.data?.response&&!issue&&!reading.data?.context_changed&&(!isLive||ready),failed:section!=='historical'&&!consulting&&!!(issue||reading.data?.context_changed||(isLive&&data.isError))},true);
  const loader = <div role="status" aria-live="polite" className="flex items-center gap-2 py-3 text-xs text-muted"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none text-accent-indigo" /><span>Consulting VaNi…</span></div>;

  return <aside {...analytics} aria-label="VaNi Market Structure companion" className="ph-no-capture w-full lg:w-[var(--vani-w)] shrink-0 self-start lg:sticky rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden" style={{ top: 'calc(var(--topbar-h) + 1rem)' }}>
    <div className="p-4 border-b border-[var(--border)]"><h2 className="text-lg font-serif text-[var(--text-primary)]">VaNi · वाणी</h2>
      <p className="text-xs text-[var(--text-secondary)]">Market Structure · All NSE · {data.period}-session window</p>
      <p className="text-[11px] text-muted mt-1">Breadth: {data.breadthDate ?? 'unavailable'} · ROC: {data.rocDate ?? 'unavailable'}</p>
      <p className="text-[11px] text-muted mt-1">Dates identify the source market sessions. Readings use closing data, not live prices.</p>
      <button className="lg:hidden text-sm text-accent-indigo mt-3" aria-expanded={mobileExpanded} onClick={() => { if (!mobileExpanded) setPresentationCycle(n => n + 1); setMobileExpanded(!mobileExpanded); }}>{mobileExpanded ? 'Close explanation' : 'Help me read this page'}</button>
    </div>
    <div className={`p-4 space-y-4 lg:max-h-[calc(100vh-220px)] overflow-y-auto ${mobileExpanded ? 'block' : 'hidden'} lg:block`}>
      {section === 'historical' ? <div className="text-sm text-[var(--text-secondary)]"><h3 className="font-medium mb-2">Historical Confluence</h3><p>This tab studies historical co-occurrence, not the current market reading. Check the sample size, date range and outcome definition. A historical frequency is not a forecast.</p><button className="mt-3 text-accent-indigo" onClick={() => showStructureEvidence('participation')}>Return to today’s structure →</button></div> : <>
      {(!dismissed || step !== null) && <div className="rounded-xl p-3 border border-[var(--border)] bg-[var(--bg)]">
        {step === null ? <><h3 className="text-sm font-medium">Learn to read this page</h3><p className="text-xs text-muted mt-1">Participation → momentum → interpretation. Three short steps, on the actual charts.</p><div className="flex gap-4 mt-3"><button className="text-xs text-accent-indigo" onClick={() => guideTo(0)}>Walk me through</button><button className="text-xs text-muted" onClick={endGuide}>Skip for now</button></div></> : <><p className="text-xs text-accent-indigo">Step {step + 1} of 3</p><h3 className="text-sm font-medium mt-1">{lesson[step].title}</h3><p className="text-xs text-[var(--text-secondary)] mt-2">{lesson[step].text}</p><div className="flex gap-4 mt-3"><button className="text-xs text-accent-indigo" onClick={() => step < 2 ? guideTo(step + 1) : endGuide()}>{step < 2 ? 'Next →' : 'Finish'}</button><button className="text-xs text-muted" onClick={endGuide}>Close walkthrough</button></div></>}
      </div>}
      {dismissed && step === null && <button className="text-xs text-accent-indigo" onClick={() => guideTo(0)}>Help me read this page</button>}
      <div><p className="text-xs font-medium text-[var(--text-primary)] mb-2">{definition.label}</p>
        {isLive && <div className="flex flex-wrap gap-2 mb-3" aria-label="Explanation depth">{(['brief', 'simple', 'detailed'] as const).map(d => <button key={d} aria-pressed={depth === d} onClick={() => setDepth(d)} className={`px-2 py-1 rounded border text-[11px] ${depth === d ? 'border-accent-indigo text-accent-indigo' : 'border-[var(--border)] text-muted'}`}>{d === 'brief' ? 'Concise' : d === 'simple' ? 'Explain simply' : 'Go deeper'}</button>)}</div>}
        {data.isLoading && isLive ? loader : !ready && isLive ? <p role="status" className="text-xs text-muted">Market readings are unavailable. The educational questions below remain available.</p> : consulting ? loader : issue ? <div role="status"><p className="text-xs text-muted">{issue}</p><button className="text-xs text-accent-indigo mt-2" onClick={retryReading}>Try again</button></div> : <p className="text-sm leading-7 whitespace-pre-wrap text-[var(--text-secondary)]">{reading.data?.response}</p>}
        {!consulting && reading.data?.log_id && <VaNiFeedback analyticsContext={analyticsContext} key={reading.data.log_id} logId={reading.data.log_id} />}
      </div>
      {ready && <details data-vani-detail="evidence" className="border border-[var(--border)] rounded-xl p-3"><summary className="text-xs cursor-pointer">Show the evidence</summary>
        {target === 'momentum' ? <div className="h-40 mt-3" role="img" aria-label="ROC 13 and its signal over the selected period"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.roc}><XAxis dataKey="trade_date" hide /><YAxis width={40} tick={{ fontSize: 9, fill: 'var(--text-muted)' }} /><Tooltip contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)' }} /><ReferenceLine y={0} stroke="var(--text-muted)" /><Line name="ROC 13" dataKey="roc_13" stroke="var(--accent)" dot={false} /><Line name="Signal (5)" dataKey="sma_breadth" stroke="var(--text-primary)" dot={false} /></LineChart></ResponsiveContainer></div> : <dl className="text-xs mt-3 space-y-2">{(['pct_above_20', 'pct_above_50', 'pct_above_150'] as const).map((k, i) => <div key={k} className="flex justify-between"><dt>Above {[20, 50, 150][i]} EMA</dt><dd>{data.breadth.at(-1)?.[k]?.toFixed(1) ?? '—'}%</dd></div>)}</dl>}
        {reading.data?.facts?.map((fact, i) => <p key={i} className="text-[11px] text-muted mt-2">{fact}</p>)}
        <button className="text-xs text-accent-indigo mt-3" onClick={() => showStructureEvidence(target)}>Show me on the page →</button>
      </details>}
      <div><p className="text-[10px] text-muted uppercase tracking-wide mb-2">Continue your research</p>{STRUCTURE_FOLLOWUPS[intent].filter(id => ready || STRUCTURE_INTENTS[id].kind === 'static').map(id => <button key={id} className="text-left w-full p-3 mb-2 rounded-xl border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:border-accent-indigo" onClick={() => choose(id)}>{STRUCTURE_INTENTS[id].label} →</button>)}{!ready && <button className="text-xs text-accent-indigo" onClick={() => choose('structure.ema')}>Understand participation</button>}</div>
      {intent === 'structure.next' && <Link className="text-sm text-accent-indigo" to={`/sector-rotation?from=market-structure&asof=${data.breadthDate ?? ""}&period=${data.period}`}>Explore Sector Rotation →</Link>}
      <p className="text-[10px] text-muted">Research and education. No buy/sell recommendations.</p>
      </>}
    </div>
  </aside>;
}
