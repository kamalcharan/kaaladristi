import {ScannerStory,ScannerSignalCards} from './ScannerLearning'
import {useEffect,useState} from 'react'
import {SCANNER_INTRODUCTIONS,SCANNER_INTRODUCTION_VERSION} from '@/constants/scannerIntroductions'
/** Static, versioned introduction; never selects a filter or invokes the model. */
export default function ScannerIntroduction({presetId,activeQuestion=false}:{presetId:string;activeQuestion?:boolean}) {
 const copy=SCANNER_INTRODUCTIONS[presetId]
 const [open,setOpen]=useState(!activeQuestion)
 useEffect(()=>{setOpen(!activeQuestion)},[presetId,activeQuestion])
 if(!copy)return null
 const illustrated=presetId==='breakout_surge'||presetId==='flower_pot_burst'
 return <details open={open} onToggle={e=>setOpen(e.currentTarget.open)} data-scanner-introduction={presetId} data-content-version={SCANNER_INTRODUCTION_VERSION} className="mb-4">
 <summary className="sector-question font-semibold">Explain {copy.name}</summary>
 {illustrated&&<ScannerStory presetId={presetId as 'breakout_surge'|'flower_pot_burst'}/>}
 <div className="vani-evidence-sections">
 {!illustrated&&<section><h3 className="text-sm font-semibold mb-2">What this scanner finds</h3><p className="text-sm leading-6">{copy.story}</p></section>}
 <section><h3 className="text-sm font-semibold mb-2">How to read the results</h3><p className="text-sm leading-6">{copy.read}</p></section>
 <p className="vani-evidence-caution text-sm leading-6">{copy.caution}</p>
 </div>
 <details className="mt-3"><summary>Understand the signals</summary>{illustrated?<ScannerSignalCards presetId={presetId as 'breakout_surge'|'flower_pot_burst'}/>:<div className="vani-evidence-sections">{copy.signals.map(signal=><section key={signal.title}><h4><mark className="vani-evidence-value">{signal.title}</mark></h4><p className="text-sm leading-6">{signal.text}</p></section>)}</div>}</details>
 </details>
}
