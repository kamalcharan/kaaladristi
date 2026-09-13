import type {LeadershipRow} from '@/services/sectorLeadership';
export type LeadershipQuestion='why'|'breadth'|'persistence'|'flow';
const alignment=(v:boolean|null)=>v==null?'unavailable':v?'aligned':'not aligned';

export function horizonStory(row:LeadershipRow,depth='brief'):string {
 const c=row.current,f=row.flow;
 const missing=c.weekly==null||c.monthly==null||!f||f.state==='Unavailable'||f.score_5d==null||f.score_22d==null;
 if(missing) return 'There is not enough evidence to compare the two horizons. A missing weekly, monthly or flow reading is unavailable, not a sign of weakness.';
 const aligned=c.weekly&&c.monthly;
 const strong=f.score_5d!>0&&f.score_5d!>=f.score_22d!;
 const headline=aligned
   ? strong?'The two horizons agree: recent flow is positive and at least as strong as its 22-session baseline, while completed weekly and monthly readings are aligned.'
     : 'The horizons give a mixed picture: weekly and monthly readings remain aligned, but current flow does not confirm that strength.'
   : strong?'Short-term flow is strong, but completed weekly and monthly readings do not both support longer-term strength.'
     : 'There is no joint confirmation across the two horizons: weekly and monthly readings do not both align, and current flow does not confirm strength.';
 const qualification=f.state==='Fading'?'Flow is still positive, but below its 22-session baseline.':f.state==='Outflow'?'The current flow classification is Outflow.':f.state==='Quiet'?'The current flow classification is Quiet.':'';
 const coverage=row.status==='Limited coverage'?'Stock coverage is limited, so broad support is not established.':row.status==='Unavailable'?'The longer-term classification is unavailable.':'';
 if(depth==='brief') return [headline,qualification,coverage].filter(Boolean).join(' ');
 const meaning='Short-term flow describes recent price and trading activity. Longer-term strength uses completed weekly and monthly relative-strength readings. Flow 22D is a short-term baseline, not the longer-term trend. Agreement does not predict continuation; disagreement does not prove a reversal.';
 if(depth==='simple') return [headline,qualification,meaning,coverage].filter(Boolean).join('\n\n');
 return [headline,qualification,`Flow 5D: ${f.score_5d!.toFixed(1)}; Flow 22D: ${f.score_22d!.toFixed(1)}. Weekly: ${alignment(c.weekly)}; monthly: ${alignment(c.monthly)}. Longer-term group: ${row.status}.`,meaning,coverage,'Inspect stock support and the completed-week history before treating agreement as broad or persistent.'].filter(Boolean).join('\n\n');
}

export function leadershipStory(row:LeadershipRow,question:LeadershipQuestion,depth='brief'):string {
 if(question==='flow') return horizonStory(row,depth);
 const c=row.current;
 const support=c.leaders==null?'Stage 2 stock support is unavailable.':`${c.leaders} of ${c.eligible} classified stocks are Stage 2 Leaders.`;
 const headline=question==='breadth'?support:question==='persistence'
   ? row.known_samples===0?'Persistence cannot be assessed because the completed-week observations are unavailable.':`Weekly and monthly agreement has lasted ${row.aligned_streak} completed weeks in the current observed run. Agreement appeared in ${row.aligned_samples} of ${row.known_samples} known observations across this window; that total is not a continuous run.`
   : `The longer-term group is ${row.status}. Completed weekly readings are ${alignment(c.weekly)} and monthly readings are ${alignment(c.monthly)}. ${support}`;
 const meaning=question==='breadth'?'Stage 2 describes a stock’s longer-term trend classification. It is different from stocks rising today or showing positive recent flow.':question==='persistence'?'An uninterrupted run and scattered periods of strength tell different stories. Missing observations cannot establish agreement.':'The weekly and monthly readings compare this index with its benchmark. Stock support and persistence determine whether agreement is broad and sustained.';
 if(depth==='brief') return headline;
 if(depth==='simple') return `${headline}

${meaning}`;
 return `${headline}

${meaning}

Classified coverage: ${c.eligible} of ${c.total} constituents. Weekly close: ${c.weekly_date??'unavailable'}; monthly close: ${c.monthly_date??'unavailable'}. Inspect the completed readings and interruptions in the selected history. This describes observed strength, not a forecast.`;
}
