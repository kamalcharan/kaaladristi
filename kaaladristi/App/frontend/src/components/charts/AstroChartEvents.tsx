import {useEffect,useState} from 'react';
import type {IChartApi,Time} from 'lightweight-charts';
import type {AstroBand} from '@/services/astroOverlayService';
import type {IndicatorRow} from '@/services/indicatorData';
import {eventCoordinate} from '@/services/astroCoordinates';
import {shiftStudyDate} from '@/services/astroStudy';

const shortDate=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'Asia/Kolkata'});

/** Names and selected study context over the existing astro overlay renderer. */
export default function AstroChartEvents({chart,container,bands,data,onSelect}:{chart:IChartApi;container:HTMLDivElement;bands:AstroBand[];data:IndicatorRow[];onSelect?:(band:AstroBand,x:number,y:number)=>void}){
  const [,redraw]=useState(0),[selected,setSelected]=useState<AstroBand|null>(null),[expanded,setExpanded]=useState<AstroBand[]>([]);
  useEffect(()=>{const bump=()=>redraw(n=>n+1);chart.timeScale().subscribeVisibleLogicalRangeChange(bump);const observer=new ResizeObserver(bump);observer.observe(container);return()=>{observer.disconnect();chart.timeScale().unsubscribeVisibleLogicalRangeChange(bump)}},[chart,container]);
  const width=container.clientWidth,height=container.clientHeight;
  const coordinate=(date:string)=>eventCoordinate(date,data,d=>chart.timeScale().timeToCoordinate(d as Time));
  const visible=bands.map(b=>{const x=coordinate(b.from),end=coordinate(b.to);if(x==null)return null;const left=b.isPoint?x:Math.max(0,x);if((end??x)<0 || left>width-75)return null;return {b,x:left}}).filter((v):v is NonNullable<typeof v>=>v!==null).sort((a,b)=>a.x-b.x);
  const groups:{x:number;events:AstroBand[]}[]=[];
  for(const item of visible){const previous=groups.at(-1);if(previous && item.x-previous.x<160)previous.events.push(item.b);else groups.push({x:item.x,events:[item.b]})}
  const active=selected && bands.some(b=>b.eventKey===selected.eventKey && b.ruleCode===selected.ruleCode && b.from===selected.from)?selected:null;
  const start=active?(active.isPoint?shiftStudyDate(active.from,-2):active.from):null;
  const end=active?(active.isPoint?shiftStudyDate(active.from,2):active.to):null;
  const x0=start?coordinate(start):null,x1=end?coordinate(end):null;
  const pick=(b:AstroBand)=>{setSelected(b);setExpanded([])};
  return <div aria-label="Named astro events" style={{position:'absolute',inset:0,height,pointerEvents:'none',zIndex:12,overflow:'hidden'}}>
    {active && x0!=null && x1!=null && <div data-testid="astro-selected-band" style={{position:'absolute',left:Math.max(0,x0),top:45,width:Math.max(4,Math.min(width-75,x1)-Math.max(0,x0)),height:Math.max(0,height-75),background:`color-mix(in srgb, ${active.color} 14%, transparent)`,borderLeft:`1px solid ${active.color}`,borderRight:`1px solid ${active.color}`}}/>}
    {groups.map((g,i)=><button key={g.events.map(b=>b.eventKey??b.ruleCode+b.from).join('|')} title={g.events.map(b=>`${b.displayName} · ${b.from}${b.isPoint?'':` – ${b.to}`}`).join('\n')} onClick={()=>g.events.length===1?pick(g.events[0]):setExpanded(g.events)} style={{position:'absolute',left:Math.max(0,Math.min(width-235,g.x)),top:4+(i%2)*22,maxWidth:225,pointerEvents:'auto',background:'var(--card)',color:g.events.length===1?g.events[0].color:'var(--text-primary)',border:'1px solid var(--border)',borderRadius:5,padding:'2px 6px',fontSize:11,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{g.events.length===1?`${g.events[0].groupTag.startsWith('mercury')?'☿':'♀'} ${g.events[0].displayName} · ${shortDate(g.events[0].from)}`:`${g.events.length} astro events · ${shortDate(g.events[0].from)}`}</button>)}
    {(active || expanded.length>0) && <section aria-label="Selected astro event" style={{position:'absolute',right:78,top:53,width:Math.min(320,width-85),maxHeight:180,overflow:'auto',pointerEvents:'auto',background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,padding:10,color:'var(--text-primary)',fontSize:12}}>
      <button aria-label="Close astro selection" style={{float:'right'}} onClick={()=>{setSelected(null);setExpanded([])}}>×</button>
      {expanded.length>0?expanded.map(b=><button key={b.eventKey??b.ruleCode+b.from} onClick={()=>pick(b)} style={{display:'block',textAlign:'left',width:'100%',padding:5}}>{b.displayName} · {b.from}{!b.isPoint && ` – ${b.to}`}</button>):active && <><strong>{active.displayName}</strong><p>{active.startTs??active.from}{!active.isPoint && ` → ${active.endTs??active.to}`}</p><p>{active.isPoint?`Study window: ${start} – ${end}. ±2 calendar days; not event duration.`:'Shading shows the actual event period.'}</p><p>Inspect price and the technical-event icons below these candles for confirmation or contradiction.</p><button onClick={e=>{const r=e.currentTarget.getBoundingClientRect();onSelect?.(active,r.left,r.bottom)}}>Event details</button></>}
    </section>}
  </div>;
}
