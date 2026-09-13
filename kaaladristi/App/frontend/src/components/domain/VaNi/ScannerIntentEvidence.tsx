import type {VaNiAskRequest} from '@/hooks/useVaNiChat';
import SectorEvidence from './SectorEvidence';
const labels:Record<string,string>={avg_gap:'Average flow-score gap',score_5d:'Flow 5D',score_22d:'Flow 22D',rvol:'Relative volume',avg_rvol:'Average relative volume',magic_rs:'MagicRS',avg_magic_rs:'Average MagicRS',pct_of_52w_high:'Percent of 52-week high',avg_pct_of_52w_high:'Average percent of 52-week high',prior_date:'Previous session',today_count:'Session matches',avg_count:'Average matches',lookback_days:'History sessions',count:'Stock count',total_count:'Total stocks',name:'Industry',gap:'Flow-score gap',from_zone:'Previous RS zone',to_zone:'Selected-session RS zone'};
const label=(key:string)=>labels[key]??key.replaceAll('_',' ');
const scalar=(value:unknown)=>value==null?'Unavailable':typeof value==='number'?Number.isInteger(value)?String(value):value.toFixed(2):String(value);
export default function ScannerIntentEvidence({request}:{request:VaNiAskRequest}) {
 const sections:{title:string;items:string[]}[]=[],symbols:string[]=[];
 for(const [key,value] of Object.entries(request)) {
  if(!key.endsWith('_facts')||!value||typeof value!=='object')continue;
  const summary:string[]=[];
  for(const [field,item] of Object.entries(value)) {
   if(Array.isArray(item)) {
    sections.push({title:field==='examples'?'Example stocks':label(field),items:item.map(row=>{if(row.symbol)symbols.push(row.symbol);return Object.entries(row).map(([k,v])=>k==='symbol'?String(v):`${label(k)}: ${scalar(v)}`).join(' · ')})});
   } else if(item&&typeof item==='object') summary.push(`${label(field)}: ${Object.entries(item).map(([k,v])=>`${label(k)}: ${scalar(v)}`).join(' · ')}`);
   else summary.push(`${label(field)}: ${scalar(item)}`);
  }
  sections.unshift({title:'Observed facts',items:summary});
 }
 return <SectorEvidence sections={sections} symbols={symbols}/>;
}
