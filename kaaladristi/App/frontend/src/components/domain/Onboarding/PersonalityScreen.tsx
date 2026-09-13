import {type Persona,type PersonaAnswers} from '@/constants/personaConfig'
import type {ScanStock} from '@/types'
import ReadingStrip from './ReadingStrip'
import PreferenceQuestions from './PreferenceQuestions'
import {ActionIsland,PrimaryButton,SectionLabel} from './ui'
export interface PersonalityState {answers:PersonaAnswers;override:Persona|null;stock:ScanStock|null}
export default function PersonalityScreen({state,onChange,onContinue,saving,error}:{state:PersonalityState;onChange:(s:PersonalityState)=>void;onContinue:()=>void;saving?:boolean;error?:string|null}){
 return <div className="fixed inset-0 overflow-y-auto" style={{background:'var(--bg)'}}><div className="max-w-3xl mx-auto p-6 pb-32 flex flex-col gap-7">
 <SectionLabel>Step 2 of 6 · Your starting preferences</SectionLabel><h1 className="text-2xl">Let’s find a useful place to start.</h1>
 <PreferenceQuestions answers={state.answers} onChange={patch=>onChange({...state,answers:{...state.answers,...patch},override:null})}/>
 <ReadingStrip answers={state.answers} override={state.override} onOverride={override=>onChange({...state,override})}/>
 {error&&<p role="alert">{error}</p>}</div><ActionIsland text="You can change these preferences later."><PrimaryButton disabled={saving} onClick={onContinue}>{saving?'Saving preferences…':'Continue →'}</PrimaryButton></ActionIsland></div>
}
