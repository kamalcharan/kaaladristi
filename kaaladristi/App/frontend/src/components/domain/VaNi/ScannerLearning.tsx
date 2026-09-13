import {useId} from 'react'
import './scannerLearning.css'

type Picture = 'breakout' | 'coil' | 'scores' | 'activity' | 'relative' | 'rsi' | 'outcomes'
/** Schematic teaching diagrams: no live values, proprietary formula or projected path. */
function Diagram({kind,label}:{kind:Picture;label:string}) {
  const titleId=useId()
  return <svg viewBox={kind==='coil'?'0 0 300 220':'0 0 300 140'} role="img" aria-labelledby={titleId} className="vani-learning-diagram">
    <title id={titleId}>{label}</title>
    {kind==='breakout'&&<>
      <rect x="16" y="54" width="208" height="54" rx="8" className="learning-fill"/>
      <path d="M16 54H282" className="learning-guide"/>
      <text x="18" y="43">Range boundary</text>
      <path d="M22 91L46 72L68 96L91 67L115 89L142 70L166 95L191 77L214 87L249 30" className="learning-line"/>
      <circle cx="249" cy="30" r="5" className="learning-dot"/>
      <text x="184" y="16">Close above</text><text x="38" y="128">Inside the range</text>
    </>}
    {kind==='coil'&&<>
      <text x="15" y="17">COIL · range tightens</text>
      <path d="M15 33L278 65M15 99L278 72" className="learning-guide"/>
      <path d="M20 84L48 39L78 91L111 49L144 82L179 59L212 75L247 65L275 69" className="learning-line"/>
      <path d="M15 111H285" className="learning-guide"/>
      <text x="15" y="131">BURST · upside</text>
      <text x="165" y="131">SHATTER · downside</text>
      <path d="M20 183L42 174L62 184L85 154L121 143" className="learning-line learning-burst"/>
      <circle cx="121" cy="143" r="4" className="learning-burst-dot"/>
      <path d="M173 151L194 159L214 149L239 181L274 193" className="learning-line learning-shatter"/>
      <circle cx="274" cy="193" r="4" className="learning-shatter-dot"/>
      <text x="15" y="216">Two possible directions—not a forecast</text>
    </>}
    {(kind==='scores'||kind==='activity')&&<>
      <text x="16" y="24">{kind==='scores'?'Recent · 5D':'Current activity'}</text>
      <rect x="16" y="34" width="221" height="22" rx="6" className="learning-dot"/>
      <text x="16" y="85">{kind==='scores'?'Broader · 22D':'Usual activity'}</text>
      <rect x="16" y="95" width="136" height="22" rx="6" className="learning-muted-fill"/>
    </>}
    {kind==='relative'&&<>
      <path d="M20 108L70 92L120 96L170 63L230 39L276 24" className="learning-line"/>
      <path d="M20 108L70 105L120 86L170 87L230 66L276 63" className="learning-guide"/>
      <text x="20" y="24">Stock</text><text x="163" y="126">NIFTY 500</text>
    </>}
    {kind==='rsi'&&<>
      <text x="16" y="26">Low reading</text><text x="202" y="26">High reading</text>
      <rect x="16" y="53" width="268" height="18" rx="9" className="learning-fill"/>
      <path d="M96 46V80M204 46V80" className="learning-guide"/>
      <circle cx="231" cy="62" r="7" className="learning-dot"/>
      <text x="16" y="103">0</text><text x="86" y="103">30</text><text x="194" y="103">70</text><text x="261" y="103">100</text>
      <text x="16" y="129">Position on a scale, not a prediction</text>
    </>}
    {kind==='outcomes'&&<>
      <path d="M30 65H269" className="learning-guide"/>
      {[35,143,260].map(x=><circle key={x} cx={x} cy="65" r="7" className="learning-dot"/>)}
      <text x="16" y="37">Setup</text><text x="116" y="37">Event</text><text x="211" y="37">Review</text>
      <text x="16" y="111">Read what happened after the event</text>
    </>}
  </svg>
}

interface Signal {title:string;subtitle:string;picture:Picture;look:string;meaning:string;limit:string}
const scores:Signal={title:'5D / 22D',subtitle:'Recent versus broader strength',picture:'scores',look:'Two research scores describing the recent picture and a broader baseline.',meaning:'A higher recent reading shows a difference between the horizons. Similar readings tell a different story from a wide gap.',limit:'This is not a change since yesterday, a price return or identified investor inflows.'}
const activity:Signal={title:'Trading activity',subtitle:'Current versus usual participation',picture:'activity',look:'Activity compared with its usual level; use RVOL where it is displayed.',meaning:'A price move accompanied by unusually active trading has different context from a quiet move.',limit:'Activity does not identify buyers or sellers, or guarantee follow-through.'}
const relative:Signal={title:'MagicRS',subtitle:'Strength relative to NIFTY 500',picture:'relative',look:'The displayed relative-strength reading and zone against NIFTY 500.',meaning:'A rising stock can still lag the benchmark. Relative leadership and the stock’s own price direction answer different questions.',limit:'The lines illustrate comparison only; they are not the MagicRS calculation or a forecast.'}
const rsi:Signal={title:'RSI',subtitle:'Context for recent price momentum',picture:'rsi',look:'Where the RSI reading sits on its 0–100 scale.',meaning:'Above 70 is a high reading; below 30 is a low reading. Read it alongside the breakout level, activity and relative strength.',limit:'A high reading does not guarantee a reversal or confirm a breakout. RSI is not an admission rule for this scan.'}
const coil:Signal={title:'COIL / BURST / SHATTER',subtitle:'Know which phase you are viewing',picture:'coil',look:'A COIL has a narrowing range. BURST is an upside expansion; SHATTER is a downside expansion.',meaning:'COIL describes a forming setup. BURST and SHATTER describe observed events in opposite directions. Check which phase the stock is in.',limit:'Neither direction is guaranteed. A coil can remain unresolved, and either event can fail to follow through.'}
const outcomes:Signal={title:'Tracked outcomes',subtitle:'Study what happened next',picture:'outcomes',look:'The recorded setup, BURST or SHATTER date, and subsequent observations.',meaning:'Keep forming coils, upside BURST events and downside SHATTER events separate when comparing follow-through.',limit:'Earlier outcomes do not establish what a current coil will do. Check the dates and available observations.'}

export function ScannerStory({presetId}:{presetId:'breakout_surge'|'flower_pot_burst'}) {
 const breakout=presetId==='breakout_surge'
 return <figure className="vani-learning-story">
   <div className="vani-learning-eyebrow">{breakout?'A move beyond the range':'One coil, two possible directions'}</div>
   <Diagram kind={breakout?'breakout':'coil'} label={breakout?'Example price moves within a range and ends at a close above the boundary; no future path is shown.':'A narrowing COIL with separate upside BURST and downside SHATTER examples. Neither outcome is guaranteed.'}/>
   <figcaption>Illustrative example—not live data.</figcaption>
   <p>{breakout?'Price has moved beyond its recent range. Inspect activity and relative strength to understand the observation.':'A COIL is a quiet, tightening setup. An upside expansion is a BURST; a downside expansion is a SHATTER. The coil alone does not tell you which will happen.'}</p>
 </figure>
}
export function ScannerSignalCards({presetId}:{presetId:'breakout_surge'|'flower_pot_burst'}) {
 const signals=presetId==='breakout_surge'?[scores,activity,relative,rsi]:[coil,activity,relative,outcomes]
 return <div className="vani-learning-signals"><p className="text-xs text-muted">Open a signal to connect the table reading with its meaning. Examples are illustrative, not live readings.</p>{signals.map(signal=><details key={signal.title} className="vani-learning-signal">
   <summary><span className="vani-evidence-value">{signal.title}</span><span className="vani-learning-subtitle">{signal.subtitle}</span></summary>
   <div className="vani-learning-signal-body"><Diagram kind={signal.picture} label={`Illustrative example: ${signal.subtitle}`}/>
     <dl><dt>What am I looking at?</dt><dd>{signal.look}</dd><dt>How does it help?</dt><dd>{signal.meaning}</dd><dt>What should I not conclude?</dt><dd className="vani-evidence-caution">{signal.limit}</dd></dl>
   </div>
 </details>)}</div>
}
