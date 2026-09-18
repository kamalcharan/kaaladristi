import {SCANNER_INTRODUCTIONS} from '@/constants/scannerIntroductions'
import ScannerIntroduction from './ScannerIntroduction'
import {useEffect,useState,type ReactNode} from 'react'
import {createPortal} from 'react-dom'
import VaNiBrand from './VaNiBrand'
import {useStockAskStore} from '@/stores/stockAskStore'
import {useVaNiPanelOpen} from '@/stores/vaniPanelStore'
import '@/styles/sectorResearch.css'

/** The same persistent companion arrangement used by sector research. */
export default function ScannerCompanionShell({subtitle,children,presetId,activeQuestion=false,portal=true}:{portal?:boolean;subtitle:ReactNode;children:ReactNode;presetId?:string;activeQuestion?:boolean}) {
  const [host,setHost]=useState<HTMLElement|null>(null)
  const open=useVaNiPanelOpen()
  useEffect(()=>{if(presetId && SCANNER_INTRODUCTIONS[presetId])useStockAskStore.getState().close()},[presetId])
  useEffect(()=>{setHost(portal?document.getElementById('scanner-vani-host'):null)},[portal,presetId,open])
  // Suppressing this here, not only in Layout: the scanner companions are
  // PORTALLED into the dock, and a shell that finds no host falls back to
  // rendering inline — so hiding the column alone would move the panel into
  // the results column instead of freeing the width. Every route that mounts
  // this starts with /scanner, which is exactly where Layout puts the rail.
  if(!open)return null
  const body=<aside className="scanner-companion" role="region" aria-label="Scanner VaNi">
    <header className="p-4 border-b border-[var(--border)]"><VaNiBrand size={48} subtitle={subtitle}/></header>
    <div className="sector-vani-body">
      <div>{presetId&&<ScannerIntroduction key={presetId} presetId={presetId} activeQuestion={activeQuestion}/>} {children}</div>
    </div>
  </aside>
  return portal&&host?createPortal(body,host):body
}
