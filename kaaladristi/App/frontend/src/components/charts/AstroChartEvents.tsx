import {useEffect,useState} from 'react';
import type {IChartApi,Time} from 'lightweight-charts';
import type {AstroBand} from '@/services/astroOverlayService';
import type {IndicatorRow} from '@/services/indicatorData';
import {eventCoordinate} from '@/services/astroCoordinates';
import {shiftStudyDate} from '@/services/astroStudy';

/** Compact event lanes. Date clicks open the fixed named-event panel, never a popup. */
export default function AstroChartEvents({chart,container,bands,data,selectedEventKey,onFocus,onDateSelect}:{chart:IChartApi;container:HTMLDivElement;bands:AstroBand[];data:IndicatorRow[];selectedEventKey?:string;onFocus?:(band:AstroBand)=>void;onDateSelect?:(date:string)=>void}){
  const [,redraw]=useState(0);
  useEffect(()=>{const bump=()=>redraw(n=>n+1);chart.timeScale().subscribeVisibleLogicalRangeChange(bump);const observer=new ResizeObserver(bump);observer.observe(container);return()=>{observer.disconnect();chart.timeScale().unsubscribeVisibleLogicalRangeChange(bump)}},[chart,container]);
  const width=container.clientWidth,height=container.clientHeight;
  const coordinate=(date:string)=>eventCoordinate(date,data,d=>chart.timeScale().timeToCoordinate(d as Time));
  const lanes=[...new Set(bands.map(b=>b.groupTag))].sort();
  const active=bands.find(b=>b.eventKey===selectedEventKey);
  const start=active?(active.isPoint?shiftStudyDate(active.from,-2):active.from):null;
  const end=active?(active.isPoint?shiftStudyDate(active.from,2):active.to):null;
  const x0=start?coordinate(start):null,x1=end?coordinate(end):null;
  const activeX=active?coordinate(active.from):null;
  return <div aria-label="Named astro events" style={{position:'absolute',inset:0,height,pointerEvents:'none',zIndex:12,overflow:'hidden'}}>
    {bands.map(b=>{
      const x=coordinate(b.from),end=coordinate(b.to);
      if(x==null || end==null || end<0 || x>width-75)return null;
      const left=Math.max(0,x),lane=lanes.indexOf(b.groupTag);
      return <button key={b.eventKey??b.ruleCode+b.from} aria-label={`${b.displayName} · ${b.from}${b.isPoint?'':` → ${b.to}`}`} aria-pressed={b.eventKey===selectedEventKey} onClick={()=>onDateSelect?onDateSelect(b.from):onFocus?.(b)} style={{position:'absolute',left,top:32+lane*6,width:b.isPoint?5:Math.max(5,Math.min(width-75,end)-left),height:5,border:0,borderRadius:2,background:b.color,opacity:b.eventKey===selectedEventKey?1:0.65,pointerEvents:'auto'}}/>;
    })}
    {active && x0!=null && x1!=null && <div data-testid="astro-selected-band" style={{position:'absolute',left:Math.max(0,x0),top:32,width:Math.max(4,Math.min(width-75,x1)-Math.max(0,x0)),height:Math.max(0,height-62),background:`color-mix(in srgb, ${active.color} 12%, transparent)`,borderLeft:`1px solid ${active.color}`,borderRight:`1px solid ${active.color}`}}/>}
    {active && activeX!=null && <button onClick={()=>onFocus?.(active)} style={{position:'absolute',left:Math.max(0,Math.min(width-300,activeX)),top:4,maxWidth:290,pointerEvents:'auto',background:'var(--card)',color:active.color,border:'1px solid var(--border)',borderRadius:5,padding:'3px 6px',fontSize:11}}>{active.displayName} · {active.from}</button>}
  </div>;
}
