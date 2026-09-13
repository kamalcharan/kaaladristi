import {SCANNER_INTRODUCTIONS} from '@/constants/scannerIntroductions'
import ScannerIntroduction from './ScannerIntroduction'
import {useEffect,useState,type ReactNode} from 'react'
import {createPortal} from 'react-dom'
import VaNiBrand from './VaNiBrand'
import {useStockAskStore} from '@/stores/stockAskStore'
import '@/styles/sectorResearch.css'

/** The same persistent companion arrangement used by sector research. */
export default function ScannerCompanionShell({subtitle,children,presetId,activeQuestion=false}:{subtitle:ReactNode;children:ReactNode;presetId?:string;activeQuestion?:boolean}) {
  const [host,setHost]=useState<HTMLElement|null>(null)
  useEffect(()=>{if(presetId && SCANNER_INTRODUCTIONS[presetId])useStockAskStore.getState().close()},[presetId])
  useEffect(()=>{setHost(document.getElementById('scanner-vani-host'))},[])
  const body=<aside className="scanner-companion" role="region" aria-label="Scanner VaNi">
    <header className="p-4 border-b border-[var(--border)]"><VaNiBrand size={48} subtitle={subtitle}/></header>
    <div className="sector-vani-body">
      <div>{presetId&&<ScannerIntroduction key={presetId} presetId={presetId} activeQuestion={activeQuestion}/>} {children}</div>
    </div>
  </aside>
  return host?createPortal(body,host):body
}
