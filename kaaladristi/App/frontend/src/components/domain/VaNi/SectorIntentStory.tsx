import {useState} from 'react';
import {Link} from 'react-router-dom';
import {SECTOR_FLOW_LABEL, SECTOR_FLOW_STYLE, sectorSessionDate} from '@/lib/sectorFlow';
import type {FlowSignal} from '@/components/domain/FlowIntensityMap';
import '@/styles/vaniStories.css';

export interface SectorIntentView {
 title:string; meaning:string; next:string; tone:string; matching_ids:number[];
 matches:number; unavailable:number; scope:string; date:string; period:number;
 examples:{id:number;name:string;state:string;fast:number|null;slow:number|null;relation:string;
  run:number;sessions:number;cells:{date:string;state:string}[]}[];
}
function State({state}:{state:string}) {
 const style=SECTOR_FLOW_STYLE[state.toUpperCase() as FlowSignal];
 return <span className="vani-flow-state" style={style?{color:style.color,background:style.bg,borderColor:style.border}:undefined}>{state}</span>;
}
export default function SectorIntentStory({view,intent}:{view:SectorIntentView;intent:string}) {
 const [selected,setSelected]=useState<{id:number;label:string}|null>(null);
 return <section className="vani-story" data-tone={view.tone} aria-label="Current-flow interpretation">
  <p className="vani-eyebrow">What stands out</p><h4>{view.title}</h4>
  <p className="vani-eyebrow">Why it matters</p><p>{view.meaning}</p>
  {view.examples.map(r=><article className="vani-flow-example" key={r.id}>
   <div className="vani-personal-heading"><strong>{r.name}</strong><State state={r.state}/></div>
   {intent==='sector.compare'?<div className="vani-score-pair" aria-label={`${r.name} score comparison`}>
    <span>Flow 5D<strong>{r.fast?.toFixed(1)??'Unavailable'}</strong></span>
    <span className="vani-score-relation">{r.relation.toLowerCase()}<small>underlying</small></span>
    <span>Flow 22D<strong>{r.slow?.toFixed(1)??'Unavailable'}</strong></span>
   </div>:intent==='sector.persistence'?<>
    <p>{r.run===r.sessions?'At least ':''}{r.run} consecutive entering observations within this window.</p>
    <p className="text-xs">Latest → oldest · recorded category sessions</p>
    <div className="vani-flow-strip" aria-label={`${r.name} entering-flow history`}>
     {r.cells.map(c=>{const style=SECTOR_FLOW_STYLE[c.state.toUpperCase() as FlowSignal];return <button type="button" key={c.date} onClick={()=>setSelected({id:r.id,label:`${sectorSessionDate(c.date)} · ${c.state}`})} title={`${sectorSessionDate(c.date)}: ${c.state}`} aria-label={`${sectorSessionDate(c.date)}: ${c.state}`} style={{background:style?.bg??'var(--border)'}}></button>})}
    </div><p aria-live="polite">{selected?.id===r.id?selected.label:'Tap a cell to read its date and condition.'}</p>
   </>:<p>{r.relation==='Unavailable'?'A complete score comparison is unavailable.':`Near-term flow is ${r.relation.toLowerCase()} its underlying baseline.`}</p>}
   <Link className="sector-question" to={`/sector-rotation/${r.id}?asof=${view.date}`}>Inspect sector evidence →</Link>
  </article>)}
  {intent==='sector.persistence'&&view.examples.length>0&&<><div className="flex flex-wrap gap-2">{Object.values(SECTOR_FLOW_LABEL).map(s=><State key={s} state={s}/>)}<State state="Unavailable"/></div><p>Colours use the same Flow Map rules. Missing sessions break the run. The window does not establish when a theme began.</p></>}
  <p>{view.examples.length} examples from {view.matches} matching baskets. {view.unavailable>0?`${view.unavailable} readings unavailable in this category.`:''}</p>
  <div className="vani-next"><p className="vani-eyebrow">Inspect next</p><p>{view.next}</p></div>
 </section>;
}

export function SectorLearningStory({taxonomy=false}:{taxonomy?:boolean}) {
 const cards=taxonomy?[
  ['NSE indices','Broad Market, Sectoral and Thematic are NSE-defined groups.'],
  ['Curated baskets','DristiQ administrators maintain these baskets around a research idea.'],
  ['Industry tags','Exchange-supplied stock classifications. An industry tag is different from index membership.'],
 ]:[
  ['1 · Read the condition','Entering, Fading, Outflow and Quiet describe different price-and-amount conditions. Missing data stays unavailable.'],
  ['2 · Compare the horizons','Flow 5D is near-term; Flow 22D is underlying. These are scores, not percentages or rupee amounts.'],
  ['3 · Follow the history','The 5/22/66-session controls change the history window. Repeated activity needs constituent evidence before a broad-strength conclusion.'],
 ];
 return <section className="vani-story" aria-label="Sector learning path"><p className="vani-eyebrow">{taxonomy?'Understand the groups':'Read → compare → inspect'}</p>
  {cards.map(([title,text])=><article key={title} className="vani-flow-example"><h4>{title}</h4><p>{text}</p></article>)}
  <p>{taxonomy?'A stock may belong to several baskets. Historical constituent views use currently recorded membership.':'Open a sector to inspect constituent participation. Current flow and longer-term leadership answer different questions.'}</p>
 </section>;
}
