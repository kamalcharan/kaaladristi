import {useEffect,useState,type ReactNode} from 'react'
import {createPortal} from 'react-dom'
import VaNiBrand from './VaNiBrand'
import {useStockAskStore} from '@/stores/stockAskStore'
import '@/styles/sectorResearch.css'

/** The same persistent companion arrangement used by sector research. */
export default function ScannerCompanionShell({subtitle,children}:{subtitle:ReactNode;children:ReactNode}) {
  const entity=useStockAskStore(s=>s.entity)
  const stock=!!entity?.currentPresetId
  const [host,setHost]=useState<HTMLElement|null>(null)
  useEffect(()=>{setHost(document.getElementById('scanner-vani-host'))},[])
  const body=<aside className="scanner-companion" role="region" aria-label="Scanner VaNi">
    <header className="p-4 border-b border-[var(--border)]"><VaNiBrand size={48} subtitle={subtitle}/></header>
    <div className="sector-vani-body">
      {stock&&<button className="sector-question" onClick={()=>useStockAskStore.getState().close()}>Back to scanner questions</button>}
      <div id="scanner-vani-stock" hidden={!stock}/>
      <div hidden={stock}>{children}</div>
    </div>
  </aside>
  return host?createPortal(body,host):body
}
