import type {MouseEvent} from 'react'

/** Follow an intent without leaving the user below the newly rendered reading. */
export function revealVaniReading(event:MouseEvent<HTMLElement>) {
 if(!(event.target instanceof Element) || !event.target.closest('button'))return
 const panel=event.currentTarget.closest<HTMLElement>('dialog,aside')
 if(!panel)return
 requestAnimationFrame(()=>{
  if(panel.scrollHeight>panel.clientHeight)panel.scrollTo({top:0,behavior:'smooth'})
  else panel.scrollIntoView({block:'start',behavior:'smooth'})
 })
}
