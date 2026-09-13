import {useEffect,useRef,useState,type ReactNode} from 'react'
import {createPortal} from 'react-dom'
import VaNiBrand,{VaNiAvatar} from './VaNiBrand'
import {useScannerCompanionStore} from '@/stores/scannerCompanionStore'
import {useStockAskStore} from '@/stores/stockAskStore'
import '@/styles/sectorResearch.css'
export function ScannerVaNiLauncher(){const show=useScannerCompanionStore(s=>s.show);return <button className="sector-question inline-flex items-center gap-2" onClick={()=>{useStockAskStore.getState().close();show()}}><VaNiAvatar size={32}/>Ask VaNi</button>}
export default function ScannerCompanionShell({subtitle,children}:{subtitle:ReactNode;children:ReactNode}){
 const {open,pinned,close,pin,show}=useScannerCompanionStore()
 const entity=useStockAskStore(s=>s.entity)
 const stock=!!entity?.currentPresetId
 const [host,setHost]=useState<HTMLElement|null>(null)
 const [wide,setWide]=useState(()=>window.matchMedia('(min-width:1280px)').matches)
 const dialog=useRef<HTMLDialogElement>(null)
 useEffect(()=>{setHost(document.getElementById('scanner-vani-host'));const q=window.matchMedia('(min-width:1280px)');const change=()=>setWide(q.matches);q.addEventListener('change',change);return()=>q.removeEventListener('change',change)},[])
 useEffect(()=>{if(stock)show()},[stock,entity?.id,show])
 const docked=pinned&&wide&&!!host
 useEffect(()=>{if(host)host.classList.toggle('scanner-vani-host-open',open&&docked);return()=>host?.classList.remove('scanner-vani-host-open')},[host,open,docked])
 useEffect(()=>{if(!docked&&open&&!dialog.current?.open)dialog.current?.showModal();if(!open)dialog.current?.close()},[open,docked])
 useEffect(()=>()=>useScannerCompanionStore.getState().close(),[])
 const dismiss=()=>{useStockAskStore.getState().close();close()}
 const body=<section className="scanner-companion" role="region" aria-label="Scanner VaNi"><header className="p-4 border-b border-[var(--border)]"><VaNiBrand subtitle={subtitle}/><div className="flex gap-3 mt-3">{stock&&<button onClick={()=>useStockAskStore.getState().close()}>Back to scanner questions</button>}{wide&&<button aria-pressed={pinned} onClick={pin}>{pinned?'Unpin':'Pin beside results'}</button>}<button onClick={dismiss}>Close VaNi</button></div></header><div className="sector-vani-body"><div id="scanner-vani-stock" hidden={!stock}/><div hidden={stock}>{children}</div></div></section>
 return <>{!host&&<ScannerVaNiLauncher/>}{docked?(open&&createPortal(body,host!)):<dialog ref={dialog} className="scanner-vani-dialog" onCancel={dismiss}>{body}</dialog>}</>
}
