import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import VaNiBrand from './VaNiBrand'
import '@/styles/sectorResearch.css'

/** Keep the scanner's original state and actions while placing VaNi beside it. */
export default function ScannerCompanionShell({subtitle,children}:{subtitle:ReactNode;children:ReactNode}) {
  const [host,setHost]=useState<HTMLElement|null>(null)
  useEffect(()=>{setHost(document.getElementById('scanner-vani-host'))},[])
  const companion=<aside className="scanner-companion" role="region" aria-label="Scanner VaNi">
    <header className="p-4 border-b border-[var(--border)]"><VaNiBrand size={48} subtitle={subtitle}/></header>
    <div className="sector-vani-body">{children}</div>
  </aside>
  return host?createPortal(companion,host):companion
}
