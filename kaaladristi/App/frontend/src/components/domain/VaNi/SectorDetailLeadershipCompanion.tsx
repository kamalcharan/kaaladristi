import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSectorResearchStore } from '@/stores/sectorResearchStore';
import { useLeadership } from '@/services/sectorLeadership';
import { sectorSessionDate } from '@/lib/sectorFlow';
import { trackVani } from '@/lib/vaniAnalytics';
import {leadershipStory} from '@/lib/sectorHorizonStory';
import VaNiBrand, {VaNiConsulting, VaNiDepthSelector} from './VaNiBrand';

type Question = 'why' | 'breadth' | 'persistence' | 'flow';
const questions: Record<Question, string> = {
  why: 'What supports longer-term strength?',
  breadth: 'Which stocks support the longer-term trend?',
  persistence: 'Has longer-term strength persisted?',
  flow: 'Does short-term flow agree with the longer-term view?',
};
export default function SectorDetailLeadershipCompanion() {
  const { pathname } = useLocation();
  const c = useSectorResearchStore();
  const indexId = Number(pathname.match(/\/sector-rotation\/(\d+)/)?.[1]);
  const [depth,setDepth]=useState('brief');
  const [question, setQuestion] = useState<Question>('why');
  const evidence = useLeadership(c.category, c.date, c.months ?? 6);
  const row = useMemo(() => evidence.data?.rows.find(r => r.index_id === indexId), [evidence.data, indexId]);
  return <aside className="ph-no-capture sector-vani p-4 space-y-3 xl:max-h-[calc(100dvh-110px)] xl:overflow-y-auto" aria-label="VaNi sector detail companion">
    <VaNiBrand subtitle={<>{row?.name ?? 'Sector research'} · {c.months ?? 6} months · {c.date ? sectorSessionDate(c.date) : 'Select a session'}</>} />
    <p className="text-xs text-muted">Longer term: completed weekly/monthly agreement, stock support and persistence. Compare recent flow separately.</p>
    <div className="flex flex-col gap-2" aria-label="Questions about this sector">
      {(Object.entries(questions) as [Question,string][]).map(([id,label]) => <button key={id} className="sector-question text-left" aria-pressed={question === id} onClick={() => { setQuestion(id); trackVani('intent_selected', {page:'sector_detail',mode:'longer_term',intent_id:`sector.detail.${id}`,months:c.months ?? 6,source:'manual'}); }}>{label}</button>)}
    </div>
    <VaNiDepthSelector value={depth} onChange={setDepth}/>
    {evidence.isLoading && <VaNiConsulting />}
    {evidence.error && <p role="alert">{evidence.error.message}</p>}
    {!evidence.isLoading && !evidence.error && !row && <p role="status">A longer-term snapshot for this sector and date is unavailable.</p>}
    {row && <section className="vani-story" aria-label="Sector interpretation"><p className="vani-eyebrow">{questions[question]}</p><p className="whitespace-pre-wrap">{leadershipStory(row, question,depth)}</p><details data-vani-detail="evidence"><summary>Inspect the evidence</summary><p className="text-xs leading-6">Selected session: {sectorSessionDate(evidence.data!.date)}. Status: {row.status}. Classified coverage: {row.current.eligible} of {row.current.total}. Current flow: {row.flow?.state ?? 'unavailable'}.</p></details></section>}
  </aside>;
}
