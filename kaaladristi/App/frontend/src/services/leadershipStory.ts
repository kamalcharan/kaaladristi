import type {LeadershipRow} from './sectorLeadership';

/** Observational interpretation only: no new score, forecast or inferred transition. */
export function leadershipStory(rows:LeadershipRow[],intent:string) {
 const ordered=[...rows].sort((a,b)=>b.aligned_streak-a.aligned_streak||a.name.localeCompare(b.name));
 const running=ordered.filter(r=>r.status==='Running broadly');
 const building=ordered.filter(r=>r.status==='Building');
 const cooling=ordered.filter(r=>r.status==='Cooling');
 let focus:LeadershipRow|undefined;
 let title='There is not enough evidence for this reading.';
 let meaning='Missing observations should not be treated as weak performance.';
 let next='Check coverage and completed-period dates in the table.';
 let tone='neutral';
 const kind=intent.split('.').at(-1);
 if(!rows.length) return {title:'No baskets are available in this reading.',meaning:'There is no sector evidence to interpret for this selection.',next:'Choose another category or available session.',tone};
 if(kind==='learn') {
  focus=building[0]??running[0]??ordered[0];
  title='Agreement is the starting point, not the whole story.';
  meaning='Weekly and monthly agreement describes relative strength. Persistence and constituent support tell you how well that condition is established. Recent flow answers a different question.';
  next=`Use ${focus.name} to compare agreement, support and current flow.`;
 } else if(kind==='flow') {
  focus=running.find(r=>['Fading','Outflow'].includes(r.flow?.state??''))??cooling.find(r=>['Strong','Building'].includes(r.flow?.state??''));
  if(focus) {
   const intact=focus.status==='Running broadly';tone='amber';
   title=intact?'Longer-term structure is holding; recent flow is softer.':'Recent flow is active, while longer-term agreement is weaker.';
   meaning=`${focus.name} has ${focus.status.toLowerCase()} structure and ${focus.flow?.state.toLowerCase()} current flow. Different horizons can disagree; one does not cancel the other.`;
   next='Compare constituent flow with the sector before treating the recent activity as broad participation.';
  } else {title='No opposing readings in the combinations checked.';meaning='No Running broadly basket has Fading/Outflow, and no Cooling basket has Strong/Building flow. This does not prove every horizon agrees.';next='Compare another basket’s current flow with its longer-term structure.';}
 } else if(kind==='building') {
  focus=building[0];tone='amber';
  if(focus) {
   const c=focus.current;const gaps=[];
   if(focus.aligned_streak<8) gaps.push('a longer uninterrupted agreement run');
   if(c.leaders_pct!=null&&c.leaders_pct<60) gaps.push('a broader share of Stage 2 Leaders');
   if(c.leaders_pct==null) gaps.push('enough classified constituents to assess support');
   title='Agreement is present; the supporting evidence is still incomplete.';
   meaning=`${focus.name} has weekly/monthly agreement, but still needs ${gaps.join(' and ')||'the remaining persistence and support requirements'} to meet Running broadly criteria. This does not establish when its strength first appeared.`;
   next='Inspect what is holding the classification back: agreement history or constituent support.';
  } else {title='No baskets are currently classified as Building.';meaning='Other groups describe the evidence in this selection; an empty Building group is not a forecast.';next='Compare the other longer-term groups in the table.';}
 } else if(kind==='cooling') {
  focus=cooling[0];tone='amber';
  if(focus) {title='Longer-term agreement is no longer intact.';meaning=`${focus.name} has lost weekly/monthly agreement after recent agreement. This identifies a change in structure, not the cause or a prediction of decline.`;next='Inspect the weekly and monthly readings to see which part is no longer aligned.';}
  else {title='No baskets are currently classified as Cooling.';meaning='This does not mean every basket is strong; some may be unaligned or lack sufficient history.';next='Check the remaining groups and their coverage.';}
 } else if(kind==='persistence') {
  focus=ordered.find(r=>r.alignment_history.some(s=>s.weekly===true&&s.monthly===true));
  if(focus) {
   const history=focus.alignment_history;
   const gap=history.some(s=>s.weekly==null||s.monthly==null);
   const broken=history.some(s=>s.weekly!=null&&s.monthly!=null&&!(s.weekly&&s.monthly));
   title=gap?'Gaps limit what the history can establish.':broken?'Agreement has not been continuous throughout this window.':'Agreement holds across the displayed weekly observations.';
   meaning=`${focus.name}: ${gap?'missing readings interrupt the observed run; they are not evidence of weakness.':broken?'aligned and non-aligned observations both occur. A current run is different from total time spent aligned.':'the displayed observations agree, but this does not establish the original start of the theme.'}`;
   next='Inspect the agreement history and its dates, including interruptions.';
  } else {title='No jointly aligned weekly observations in this window.';meaning='Unavailable history and observed non-alignment must be distinguished.';next='Inspect coverage or choose a longer history window.';}
 } else if(kind==='support') {
  focus=ordered.find(r=>r.current.leaders_pct!=null&&r.current.leaders_pct<60)??ordered[0];
  const c=focus.current;const limited=c.eligible<5||!c.total||c.eligible/c.total<.8;
  title=limited?'Coverage limits a broad-support conclusion.':c.leaders_pct!=null&&c.leaders_pct>=60?'Constituent support is visible beyond index agreement.':'Index agreement does not establish broad constituent support.';
  meaning=`${focus.name}: ${limited?'too few constituents are classified to draw a broad-support conclusion.':c.leaders_pct!=null&&c.leaders_pct>=60?'the Stage 2 Leaders share meets the support threshold. Persistence and current flow still need separate consideration.':'the measured Stage 2 Leaders share is below the threshold. This is an observed shortfall, not missing data.'}`;
  next='Inspect the constituents, including Watch stocks and unclassified members.';
 } else if(running.length) {
  focus=running[0];tone='green';title='Sustained agreement has constituent support.';
  meaning=`${focus.name} meets the persistence and broad-support checks. Its current flow remains a separate reading, so recent softness need not mean the longer-term structure has failed.`;
  next='Compare its current flow with participation across the constituents.';
 } else if(building.length) {
  focus=building[0];tone='amber';title='Agreement exists, but broad leadership is not yet established.';
  meaning='Some baskets have weekly/monthly agreement, but none meets all Running broadly requirements. Inspect whether persistence or constituent support is the missing condition.';
  next=`Start with ${focus.name} and inspect the condition it has not met.`;
 } else if(cooling.length) {
  focus=cooling[0];tone='amber';title='Recent agreement has weakened in part of this selection.';
  meaning='Cooling baskets have lost weekly/monthly agreement. No basket here currently meets the Running broadly or Building criteria.';
  next='Inspect which horizon has lost agreement and compare constituent participation.';
 }
 if(kind==='leadership'&&!running.length&&!building.length&&!cooling.length&&ordered.some(r=>r.status==='Not aligned')) {
  title='Weekly and monthly agreement is not established.';
  meaning='The observed unaligned baskets do not meet the longer-term agreement criteria. Keep any unavailable readings separate from those measured conditions.';
  next='Inspect the weekly and monthly readings before comparing current flow.';
 }
 return {title,meaning,next,tone,focus};
}
