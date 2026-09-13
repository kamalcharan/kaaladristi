import {useState} from 'react';
import {useVaNiStore} from '@/stores/vaniStore';
import {BREAKOUT_BETA_QUESTIONS,breakoutStory,type BreakoutQuestion} from '@/lib/breakoutBeta';
import {useVaniAnalytics} from '@/hooks/useVaniAnalytics';
import {trackVani} from '@/lib/vaniAnalytics';
import VaNiBrand,{VaNiConsulting,VaNiDepthSelector} from './VaNiBrand';
import SectorEvidence from './SectorEvidence';
import '@/styles/sectorResearch.css';
export default function BreakoutBetaCompanion({docked=false}:{docked?:boolean}) {
 const {scanContext,open,close}=useVaNiStore();
 const e=scanContext?.presetId==='breakout_surge'?scanContext.breakoutBeta:undefined;
 const [question,setQuestion]=useState<BreakoutQuestion>('read'),[depth,setDepth]=useState('brief');
 const [rated,setRated]=useState('');
 const key=JSON.stringify([e,question,depth]);
 const ctx={page:'breakout_surge_beta',mode:'chat' as const,intent_id:`breakout.beta.${question}`};
 const analytics=useVaniAnalytics(ctx,{key,ready:!!e,failed:false},docked||open);
 if(!docked&&!open) return null;
 return <aside {...analytics} aria-label="VaNi Breakout Surge beta companion" className="ph-no-capture sector-vani p-4 space-y-4" style={docked?{maxHeight:'calc(100dvh - 110px)',overflowY:'auto'}:{position:'fixed',right:8,top:64,bottom:8,zIndex:400,width:380,maxWidth:'calc(100vw - 16px)',overflowY:'auto'}}>
  <VaNiBrand subtitle={<>Breakout Surge · Beta · {e?.date??'Checking session'}</>} trailing={!docked?<button onClick={close} aria-label="Close VaNi">✕</button>:undefined}/>
  <p className="text-xs text-muted">Understand the scan → inspect a stock → check the evidence.</p>
  <div aria-label="Breakout Surge questions" className="flex flex-col gap-2">{Object.entries(BREAKOUT_BETA_QUESTIONS).map(([id,label])=><button key={id} className="sector-question text-left" aria-pressed={question===id} onClick={()=>{setQuestion(id as BreakoutQuestion);trackVani('intent_selected',{...ctx,intent_id:`breakout.beta.${id}`,source:'manual'});}}>{label}</button>)}</div>
  <VaNiDepthSelector value={depth} onChange={setDepth}/>
  {!e?<VaNiConsulting/>:<><p className="text-xs text-muted">{scanContext?.exchange} · {scanContext?.timeframe} · current filtered results</p><h3 className="text-sm font-medium">{BREAKOUT_BETA_QUESTIONS[question]}</h3><p className="text-sm leading-7 whitespace-pre-wrap">{breakoutStory(e,question,depth)}</p>
   <details data-vani-detail="evidence"><summary className="cursor-pointer text-sm">Inspect the evidence</summary><SectorEvidence symbols={e.examples.map(s=>s.symbol)} sections={[
    {title:'Coverage',items:[`${e.total} displayed stocks. RVOL available for ${e.volumeKnown}; both flow scores for ${e.flowKnown}; RSI for ${e.rsiKnown}; breakout-level distance for ${e.levelKnown}.`]},
    {title:'First displayed stocks',items:e.examples.map(s=>`${s.symbol}: RVOL ${s.rvol??'unavailable'}; RSI ${s.rsi??'unavailable'}; distance above breakout ${s.above==null?'unavailable':s.above+'%'}; Flow 5D ${s.flow5??'unavailable'}, Flow 22D ${s.flow22??'unavailable'}.`)},
    {title:'What this reading cannot establish',items:['A scan match or VaNi highlight is not a trade recommendation. Daily flow does not establish weekly/monthly agreement. Market breadth and sector Greed/Fear are not supplied by these scan rows.']}
   ]}/></details>
   <div className="flex flex-wrap gap-2" aria-label="Beta feedback"><span className="text-xs text-muted w-full">Was this explanation useful?</span>{(['helpful','not_helpful'] as const).map(rating=><button className="sector-question" key={rating} aria-pressed={rated===key+rating} onClick={()=>{setRated(key+rating);trackVani('feedback_submitted',{...ctx,rating});}}>{rating==='helpful'?'Helpful':'Needs clarity'}</button>)}</div>
  </>}
 </aside>;
}
