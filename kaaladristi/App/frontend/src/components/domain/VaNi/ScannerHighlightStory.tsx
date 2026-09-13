import type {ScanStock} from '@/types'
import {displaySymbol} from '@/lib/symbolUtils'
import {trackEvent} from '@/lib/analytics'

export default function ScannerHighlightStory({stocks,date}:{stocks:ScanStock[];date:string|null}) {
 const highlighted=stocks.filter(s=>s.vaniOpportunity)
 return <div className="vani-evidence-sections" data-highlight-story>
  <section><h3 className="font-semibold">VaNi highlights · {highlighted.length} of {stocks.length}</h3>
   <p className="text-sm leading-6">{highlighted.length ? 'The table is filtered to database-marked VaNi highlights. Your other filters still apply.' : 'No stocks carry a VaNi highlight in this scan.'}</p>
   <p className="text-xs text-muted">{date} · Counts cover the full scan for the selected exchange.</p>
  </section>
  <section><h4 className="font-semibold">Understand the highlighted stocks</h4><p className="text-sm leading-6">The highlight comes from the recorded scanner result. Volume, distance from the yearly high and relative strength help you inspect it; these readings do not independently establish why the database flagged it.</p></section>
  {highlighted.slice(0,3).map(stock=><section key={stock.equity_id}>
   <a className="vani-evidence-value" href={`/chart/equity/${stock.equity_id}?setup=breakout_surge`} onClick={()=>trackEvent('scanner_highlight_stock_opened',{preset_id:'breakout_surge',equity_id:stock.equity_id,data_date:date})}>{displaySymbol(stock)}</a>
   <div className="flex flex-wrap gap-2 mt-2 text-sm">
    <mark className="vani-evidence-value">{stock.rvol==null?'Volume unavailable':`${stock.rvol.toFixed(1)}× usual volume`}</mark>
    <mark className="vani-evidence-value">{stock.w52_high && stock.close<=stock.w52_high ? `${((1-stock.close/stock.w52_high)*100).toFixed(1)}% below yearly high`:'Yearly-high comparison unavailable'}</mark>
    <mark className="vani-evidence-value">MagicRS {stock.magic_rs==null?'unavailable':stock.magic_rs.toFixed(1)}</mark>
   </div>
  </section>)}
  {highlighted.length>3 && <p className="text-xs text-muted">Three examples shown here. Use the table’s row mascot to inspect any highlighted stock.</p>}
 </div>
}
