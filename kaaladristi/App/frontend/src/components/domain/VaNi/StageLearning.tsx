import {useId} from 'react'
import {SCANNER_INTRODUCTIONS} from '@/constants/scannerIntroductions'
import './scannerLearning.css'
const stages=[
 {name:'Stage 1 · Base',text:'Price moves in a range as the longer trend flattens. Study whether a base is forming; direction remains unresolved.'},
 {name:'Stage 2 · Advance',text:'An upward trend develops. Study whether price structure and relative strength support the advance.'},
 {name:'Stage 3 · Transition',text:'The advance loses clarity and price may move sideways. Watch whether strength returns or weakness develops.'},
 {name:'Stage 4 · Decline',text:'A downward trend is established. Study weakness and any evidence of stabilization without assuming a bottom.'},
]
export default function StageLearning({presetId}:{presetId:string}){
 const title=useId()
 const focus=presetId==='stage_2_leaders'?1:presetId==='stage_3_watch'?2:presetId==='stage_4_leaders'?3:null
 return <div data-stage-learning={presetId}>
 <figure className="vani-learning-story"><div className="vani-learning-eyebrow">Understand the four stages</div>
 <svg viewBox="0 0 320 150" role="img" aria-labelledby={title} className="vani-learning-diagram"><title id={title}>Illustration of a base, advance, transition and decline. These are observed conditions, not a guaranteed sequence.</title>
 {[0,1,2,3].map(i=><g key={i}><rect x={8+i*78} y="18" width="72" height="110" rx="8" opacity={focus===i?1:0.12} className={focus===i?'learning-fill':'learning-muted-fill'}/><text x={35+i*78} y="145">{i+1}</text></g>)}
 <path d="M15 104L29 95L43 107L57 97L72 103L91 92L107 79L122 84L139 57L157 36L174 41L189 30L204 43L218 34L236 49L252 70L268 61L285 89L305 110" className="learning-line"/>
 </svg><figcaption>Illustrative example · no live data or predicted path.</figcaption>
 <p>A stock can build a base, advance, lose direction or decline. Recognizing the condition helps you put its other signals in context. The stages need not unfold neatly or last the same length of time.</p></figure>
 <div className="vani-evidence-sections">{stages.map((stage,i)=><section key={stage.name} aria-current={focus===i?'step':undefined}><h3><mark className="vani-evidence-value">{stage.name}</mark>{focus===i?' · This scanner’s focus':''}</h3><p className="text-sm leading-6">{stage.text}</p></section>)}
 <section><h3 className="font-semibold">Where {SCANNER_INTRODUCTIONS[presetId].name} fits</h3><p className="text-sm leading-6">{SCANNER_INTRODUCTIONS[presetId].story}</p></section></div>
 </div>
}
