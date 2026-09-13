import type {ScanStock} from '@/types'
import {displaySymbol} from '@/lib/symbolUtils'
import {trackEvent} from '@/lib/analytics'
import {computeHighlightExplainFacts} from '@/services/breakoutSurgeInsights'
import {Highlight} from './SectorEvidence'
import './scannerHighlight.css'

const number=(value:number|null,suffix='')=>value==null?'Unavailable':`${value.toFixed(1)}${suffix}`
export default function ScannerHighlightStory({stocks,date,response}:{stocks:ScanStock[];date:string|null;response:string}) {
 const selected=stocks.filter(s=>s.vaniOpportunity)
 const facts=computeHighlightExplainFacts(stocks),r=facts.readings
 const symbols=selected.map(displaySymbol)
 const examples=[...selected].sort((a,b)=>(b.rvol??-Infinity)-(a.rvol??-Infinity)).slice(0,2)
 const distance=facts.avgPctOf52wHigh==null?null:100-facts.avgPctOf52wHigh
 return <div className="vani-highlight-story" data-highlight-story>
  <section className="vani-highlight-overview" aria-label="Highlighted stocks">
   <div className="vani-highlight-eyebrow">VaNi highlights <span>{date}</span></div>
   <h3><mark className="vani-highlight-count">{selected.length}</mark><span>highlighted out of <mark className="vani-evidence-value">{stocks.length}</mark> stocks</span></h3>
   <p className="vani-highlight-scope">Full scan · selected exchange. Table filters may narrow this list.</p>
  </section>
  <section className="vani-highlight-reading" aria-label="VaNi’s reading">
   <h4>VaNi’s reading</h4>
   {response.split(/\n+/).filter(Boolean).map((text,i)=><p key={i}><Highlight text={text} symbols={symbols}/></p>)}
  </section>
  {selected.length>0 && <>
   <section aria-label="The evidence behind the story"><h4>The evidence behind the story</h4>
    <div className="vani-highlight-metrics">
     <div><span>Average activity</span><mark className="vani-evidence-value">{number(facts.avgRvol,'×')}</mark><small>{r.rvol_available} of {selected.length} readings · usual volume = 1×</small></div>
     <div><span>{distance!=null && distance<0?'Average above recorded yearly high':'Average below yearly high'}</span><mark className="vani-evidence-value">{number(distance==null?null:Math.abs(distance),'%')}</mark><small>{r.high_available} of {selected.length} readings</small></div>
    </div>
    <p><Highlight text={r.rs_available?`${r.positive_rs} of ${r.rs_available} stocks with a MagicRS reading are above zero. Relative strength adds context to their own price move.`:'Relative-strength readings are unavailable for this group.'} symbols={[]}/></p>
   </section>
   <section className="vani-highlight-caution" aria-label="Keep in perspective"><h4>Keep in perspective</h4>
    <p><Highlight text={r.rsi_available?`${r.high_rsi} of ${r.rsi_available} RSI readings are 70 or higher. A high reading can accompany momentum; it does not predict a reversal.`:'RSI readings are unavailable; momentum context is incomplete.'} symbols={[]}/></p>
    <p><Highlight text={r.score_pair_available?`${r.recent_score_below} of ${r.score_pair_available} stocks have a 5D score below their 22D score. This compares recent and broader readings, not the change since yesterday.`:'Paired 5D and 22D readings are unavailable.'} symbols={[]}/></p>
   </section>
   <section aria-label="Look closer"><h4>Look closer</h4><p className="vani-highlight-scope">Up to two examples, ordered by relative volume.</p>
    {examples.map(stock=><a className="vani-highlight-stock" key={stock.equity_id} href={`/chart/equity/${stock.equity_id}?setup=breakout_surge`} onClick={()=>trackEvent('scanner_highlight_stock_opened',{preset_id:'breakout_surge',equity_id:stock.equity_id,data_date:date})}>
     <strong className="vani-evidence-stock">{displaySymbol(stock)}</strong>
     <span><mark className="vani-evidence-value">{number(stock.rvol??null,'×')}</mark> usual volume · MagicRS <mark className="vani-evidence-value">{number(stock.magic_rs??null)}</mark></span>
     <span className="vani-highlight-link">Inspect stock →</span>
    </a>)}
   </section>
  </>}
 </div>
}
