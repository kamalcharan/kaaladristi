import type {VaNiAskRequest} from '@/hooks/useVaNiChat'
import {Highlight} from './SectorEvidence'
import './scannerHighlight.css'

const headings:Record<string,[string,string]>={
 'scanner.new_since_yesterday':['New since the previous session','new arrivals'],
 'scanner.momentum_gap':['Momentum across horizons','matching stocks'],
 'scanner.leading_industry':['Industry participation','stocks in this industry'],
 'scanner.sector_leading':['Stocks in leading industries','matching stocks'],
 'scanner.rs_flip':['Relative-strength transitions','stocks changed zone'],
 'scanner.is_unusual':['This session in context','scan matches'],
 'scanner.why_highlighted':['VaNi highlights','highlighted stocks'],
 'scanner.why_highlighted_weakness':['VaNi highlights','highlighted stocks'],
 'scanner.why_highlighted_gl':['VaNi highlights','highlighted stocks'],
}
const metrics:Record<string,string>={avg_gap:'Average 5D / 22D gap',avg_count:'Average scan matches',lookback_days:'Prior sessions compared',avg_rvol:'Average relative volume',avg_magic_rs:'Average MagicRS',total_count:'Total scan matches',avg_pct_from_gl:'Average distance from Golden Line (%)',avg_days_above:'Average sessions above Golden Line'}
const display=(n:number)=>Number.isInteger(n)?String(n):n.toFixed(1)
export default function ScannerResponseCard({response,request,symbols=[],date,title}:{response:string;request?:VaNiAskRequest;symbols?:string[];date?:string|null;title?:string}) {
 const facts=(Object.entries(request??{}).find(([key,value])=>key.endsWith('_facts')&&value&&typeof value==='object')?.[1]??{}) as Record<string,unknown>
 const [heading,noun]=headings[request?.intent_id??'']??[title??'Session insight','stocks']
 const count=facts.count??facts.today_count
 const hasCount=typeof count==='number'&&Number.isFinite(count)
 const period=request?.data_date??date
 const names=[...symbols,...(typeof facts.name==='string'&&facts.name?[facts.name]:[])]
 const lines=response.split(/\n+/).map(line=>line.trim()).filter(Boolean)
 const caution=lines.filter(line=>/^(this is not investment advice|dristiq is a data correlation platform|research and education\.)/i.test(line))
 const reading=lines.filter(line=>!caution.includes(line))
 const values=Object.entries(metrics).filter(([key])=>typeof facts[key]==='number'&&Number.isFinite(facts[key]))
 return <div className="vani-highlight-story" data-scanner-response={request?.intent_id??'fpb'}>
  {(hasCount||period||title) && <section className="vani-highlight-overview" aria-label={heading}>
   <div className="vani-highlight-eyebrow">{heading}{period&&<span>{period}</span>}</div>
   {hasCount && <h3><mark className="vani-highlight-count">{display(count)}</mark><span>{noun}</span></h3>}
   {typeof facts.prior_date==='string'&&<p>Compared with <mark className="vani-evidence-value">{facts.prior_date}</mark></p>}
   {typeof facts.name==='string'&&facts.name&&<p><strong className="vani-evidence-stock">{facts.name}</strong></p>}
   {request&&<p className="vani-highlight-scope">Scan-wide result for the selected exchange. Table filters may narrow the displayed stocks.</p>}
  </section>}
  <section className="vani-highlight-reading" aria-label="VaNi’s reading"><h4>VaNi’s reading</h4>
   {reading.map((line,i)=>/^[•*-]\s+/.test(line)?<ul className="vani-response-bullets" key={i}><li><Highlight text={line.replace(/^[•*-]\s+/,'')} symbols={names}/></li></ul>:<p key={i}><Highlight text={line} symbols={names}/></p>)}
  </section>
  {values.length>0&&<section aria-label="At a glance"><h4>At a glance</h4><div className="vani-highlight-metrics">{values.map(([key,label])=><div key={key}><span>{label}</span><mark className="vani-evidence-value">{display(facts[key] as number)}{key==='avg_rvol'?'×':''}</mark></div>)}</div></section>}
  {caution.length>0&&<section className="vani-highlight-caution" aria-label="Research context">{caution.map((line,i)=><p key={i}><Highlight text={line} symbols={names}/></p>)}</section>}
 </div>
}
