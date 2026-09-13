import {useState} from 'react'
import {ACTS_ON_IDS,ACTS_ON_OPTIONS,HOLD_HORIZON_IDS,HOLD_HORIZON_OPTIONS,type PersonaAnswers} from '@/constants/personaConfig'
import {Chip,Question} from './ui'
import {useActsOnRows} from '@/hooks/useOnboardingScans'
import ActsOnPicker from './ActsOnPicker'
function Examples({onChange}:{onChange:(patch:PersonaAnswers)=>void}){const rows=useActsOnRows();return <ActsOnPicker data={rows} value={null} onPick={k=>onChange({acts_on:k})}/>}
export default function PreferenceQuestions({answers,onChange,showExamplesInitially=false}:{answers:PersonaAnswers;onChange:(patch:PersonaAnswers)=>void;showExamplesInitially?:boolean}){
 const [examples,setExamples]=useState(showExamplesInitially)
 return <>
 <section><Question n={1} text="How long do you usually hold a stock?"/>
 <div className="flex flex-wrap gap-2">{HOLD_HORIZON_IDS.map(h=><Chip key={h} active={answers.hold_horizon===h} onClick={()=>onChange({hold_horizon:h})}>{HOLD_HORIZON_OPTIONS[h].label}</Chip>)}<Chip active={!answers.hold_horizon} onClick={()=>onChange({hold_horizon:null})}>Still exploring</Chip></div></section>
 <section><Question n={2} text="What would you like DristiQ to help you find?" sub="Choose a starting point. Every scanner remains available."/>
 <div className="flex flex-col gap-2">{ACTS_ON_IDS.map(k=><Chip key={k} active={answers.acts_on===k} onClick={()=>onChange({acts_on:k})}><span className="block text-left">{ACTS_ON_OPTIONS[k].label}<span className="block text-xs mt-1 font-normal">{ACTS_ON_OPTIONS[k].hint}</span></span></Chip>)}<Chip active={!answers.acts_on} onClick={()=>onChange({acts_on:null})}>Help me explore</Chip></div>
 <button type="button" className="sector-question mt-3" onClick={()=>setExamples(!examples)}>{examples?'Hide examples':'See live examples (optional)'}</button>{examples&&<Examples onChange={onChange}/>}</section>
 </>
}
