import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSectorResearchStore } from '@/stores/sectorResearchStore';
import { useLeadership, type LeadershipRow } from '@/services/sectorLeadership';
import { sectorSessionDate } from '@/lib/sectorFlow';
import { trackVani } from '@/lib/vaniAnalytics';
import VaNiBrand, {VaNiConsulting} from './VaNiBrand';

type Question = 'why' | 'breadth' | 'persistence' | 'flow';
const questions: Record<Question, string> = {
  why: 'What is this sector’s longer-term picture?',
  breadth: 'Is strength broad across its stocks?',
  persistence: 'Is strength persisting or weakening?',
  flow: 'Does current flow confirm it?',
};
const pct = (v: number | null | undefined) => v == null ? 'unavailable' : `${v.toFixed(0)}%`;
function reading(row: LeadershipRow, question: Question): string {
  const c = row.current;
  if (question === 'breadth') return `${c.leaders ?? 'Unavailable'} of ${c.eligible} classified stocks are Stage 2 Leaders (${pct(c.leaders_pct)}). Coverage is ${c.eligible} of ${c.total} constituents. This describes participation; it does not establish that every stock is strong.`;
  if (question === 'persistence') return `${row.status}. Weekly and monthly readings have agreed for ${row.aligned_streak} completed observations in the current run, and for ${row.aligned_samples} of ${row.known_samples} known observations in this window. Inspect interruptions in the history before treating the run as stable.`;
  if (question === 'flow') return `The longer-term classification is ${row.status}. Current flow is ${row.flow?.state ?? 'unavailable'}; Flow 5D is ${row.flow?.score_5d?.toFixed(1) ?? 'unavailable'} and Flow 22D is ${row.flow?.score_22d?.toFixed(1) ?? 'unavailable'}. Flow and weekly/monthly alignment measure different things, so disagreement calls for closer inspection.`;
  return `${row.name} is classified as ${row.status} in the selected longer-term window. Weekly alignment: ${c.weekly == null ? 'unavailable' : c.weekly ? 'yes' : 'no'}; monthly alignment: ${c.monthly == null ? 'unavailable' : c.monthly ? 'yes' : 'no'}. ${c.leaders ?? 'Unavailable'} of ${c.eligible} classified constituents are Stage 2 Leaders. The current aligned run spans ${row.aligned_streak} completed observations. These are observations, not a forecast.`;
}
export default function SectorDetailLeadershipCompanion() {
  const { pathname } = useLocation();
  const c = useSectorResearchStore();
  const indexId = Number(pathname.match(/\/sector-rotation\/(\d+)/)?.[1]);
  const [question, setQuestion] = useState<Question>('why');
  const evidence = useLeadership(c.category, c.date, c.months ?? 6);
  const row = useMemo(() => evidence.data?.rows.find(r => r.index_id === indexId), [evidence.data, indexId]);
  return <aside className="ph-no-capture sector-vani p-4 space-y-3 xl:max-h-[calc(100dvh-110px)] xl:overflow-y-auto" aria-label="VaNi sector detail companion">
    <VaNiBrand subtitle={<>{row?.name ?? 'Sector research'} · {c.months ?? 6} months · {c.date ? sectorSessionDate(c.date) : 'Select a session'}</>} />
    <div className="flex flex-col gap-2" aria-label="Questions about this sector">
      {(Object.entries(questions) as [Question,string][]).map(([id,label]) => <button key={id} className="sector-question text-left" aria-pressed={question === id} onClick={() => { setQuestion(id); trackVani('intent_selected', {page:'sector_detail',mode:'longer_term',intent_id:`sector.detail.${id}`,months:c.months ?? 6,source:'manual'}); }}>{label}</button>)}
    </div>
    {evidence.isLoading && <VaNiConsulting />}
    {evidence.error && <p role="alert">{evidence.error.message}</p>}
    {!evidence.isLoading && !evidence.error && !row && <p role="status">A longer-term snapshot for this sector and date is unavailable.</p>}
    {row && <section className="vani-story" aria-label="Sector interpretation"><p className="vani-eyebrow">{questions[question]}</p><p>{reading(row, question)}</p><details data-vani-detail="evidence"><summary>Inspect the evidence</summary><p className="text-xs leading-6">Selected session: {sectorSessionDate(evidence.data!.date)}. Status: {row.status}. Classified coverage: {row.current.eligible} of {row.current.total}. Current flow: {row.flow?.state ?? 'unavailable'}.</p></details></section>}
  </aside>;
}
