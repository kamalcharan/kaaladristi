import {useId} from 'react'
import './scannerLearning.css'

type Picture = 'delivery' | 'confluence' | 'volume-event' | 'breakdown' | 'week-up' | 'week-down' | 'month-up' | 'month-down' | 'scores-down' | 'breakout' | 'coil' | 'scores' | 'activity' | 'relative' | 'rsi' | 'outcomes'
/** Schematic teaching diagrams: no live values, proprietary formula or projected path. */
function Diagram({kind,label}:{kind:Picture;label:string}) {
  const titleId=useId()
  return <svg viewBox={kind==='coil'?'0 0 300 220':'0 0 300 140'} role="img" aria-labelledby={titleId} className="vani-learning-diagram">
    <title id={titleId}>{label}</title>
    {kind==='delivery'&&<>
      <text x="16" y="20">Recent delivery · 5D</text><rect x="16" y="30" width="226" height="23" rx="6" className="learning-dot"/>
      <text x="16" y="78">Broader baseline · 22D</text><rect x="16" y="88" width="124" height="23" rx="6" className="learning-muted-fill"/>
      <text x="16" y="135">Delivery value, not Flow scores</text>
    </>}
    {kind==='confluence'&&<>
      <rect x="12" y="20" width="122" height="76" rx="10" className="learning-fill"/><rect x="166" y="20" width="122" height="76" rx="10" className="learning-fill"/>
      <text x="28" y="49">Industry</text><text x="28" y="71">context</text><text x="181" y="49">Stock</text><text x="181" y="71">conditions</text>
      <path d="M136 58H164" className="learning-guide"/><text x="15" y="128">Read both together</text>
    </>}
    {kind==='volume-event'&&<>
      <text x="16" y="20">An unusually active session</text>
      {[34,47,39,50,104,43].map((h,i)=><rect key={i} x={18+i*45} y={128-h} width="26" height={h} rx="4" className={i===4?'learning-dot':'learning-muted-fill'}/>)}
    </>}
    {kind==='breakout'&&<>
      <rect x="16" y="54" width="208" height="54" rx="8" className="learning-fill"/>
      <path d="M16 54H282" className="learning-guide"/>
      <text x="18" y="43">Range boundary</text>
      <path d="M22 91L46 72L68 96L91 67L115 89L142 70L166 95L191 77L214 87L249 30" className="learning-line"/>
      <circle cx="249" cy="30" r="5" className="learning-dot"/>
      <text x="184" y="16">Close above</text><text x="38" y="128">Inside the range</text>
    </>}
    {kind==='breakdown'&&<>
      <rect x="16" y="28" width="208" height="54" rx="8" className="learning-fill"/>
      <path d="M16 82H282" className="learning-guide"/>
      <text x="18" y="18">Inside the range</text>
      <path d="M22 47L46 68L68 42L91 73L115 49L142 68L166 43L191 64L214 51L249 111" className="learning-line learning-shatter"/>
      <circle cx="249" cy="111" r="5" className="learning-shatter-dot"/>
      <text x="18" y="103">Range floor</text><text x="184" y="135">Close below</text>
    </>}
    {(kind.startsWith('week-')||kind.startsWith('month-'))&&<>
      <text x="16" y="18">{kind.startsWith('week-')?'Previous week’s close':'Previous month’s close'}</text>
      <path d="M16 72H284" className="learning-guide"/>
      <circle cx="24" cy="72" r="4" className="learning-dot"/>
      <path d={kind.endsWith('-up')?'M24 72L63 89L104 65L146 76L191 48L258 35':'M24 72L63 49L104 78L146 63L191 91L258 108'} className={kind.endsWith('-up')?'learning-line learning-burst':'learning-line learning-shatter'}/>
      <circle cx="258" cy={kind.endsWith('-up')?35:108} r="5" className={kind.endsWith('-up')?'learning-burst-dot':'learning-shatter-dot'}/>
      <text x="153" y={kind.endsWith('-up')?57:132}>{kind.endsWith('-up')?'Latest close above':'Latest close below'}</text>
      <text x="16" y="132">Reference close</text>
    </>}
    {kind==='scores-down'&&<>
      <text x="16" y="24">Recent · 5D</text><text x="261" y="24">0</text>
      <path d="M278 30V122" className="learning-guide"/>
      <rect x="54" y="34" width="224" height="22" rx="6" className="learning-shatter-dot"/>
      <text x="16" y="85">Broader · 22D</text>
      <rect x="145" y="95" width="133" height="22" rx="6" className="learning-muted-fill"/>
      <text x="16" y="137">Example: recent score is more negative</text>
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

const stories:Record<string,{picture:Picture;title:string;label:string;story:string}> = {
 conviction_flow:{picture:'delivery',title:'Delivery activity · recent versus broader',label:'Illustrative recent delivery activity above its broader baseline. Not live values or research scores.',story:'Delivery participation is elevated across the recent window, while this scanner also checks proximity to the short-term price average. More delivery activity does not determine the next price move.'},
 power_buy:{picture:'confluence',title:'Stock strength meets industry context',label:'Industry context and stock conditions considered together, not a checklist of guaranteed confirmations.',story:'A stock’s qualifying strength conditions sit within a leading or rotating-in industry. The combination provides context; different stocks can qualify through different combinations.'},
 volume_drive:{picture:'volume-event',title:'An event worth inspecting',label:'Illustrative activity bars with one elevated session. No forecast is shown.',story:'A recorded volume-drive or accumulation-bar event brings the stock into view. Inspect delivery participation and the price candle to understand that activity.'},
 breakout_surge:{picture:'breakout',title:'Daily breakout · close above the range',label:'Daily closing observation above a recent range boundary. No future path is shown.',story:'The daily close is above the recent range. Inspect activity and relative strength to understand the observation.'},
 breakdown_watch:{picture:'breakdown',title:'Daily breakdown · close below the floor',label:'Daily closing observation below a recent range floor. No future path is shown.',story:'The daily close is below the recent range floor. Inspect activity and relative strength to understand the weakness; continued declines are not established.'},
 flower_pot_burst:{picture:'coil',title:'One coil, two possible directions',label:'A narrowing COIL with separate upside BURST and downside SHATTER examples. Neither outcome is guaranteed.',story:'A COIL is a quiet, tightening setup. An upside expansion is a BURST; a downside expansion is a SHATTER. The coil alone does not tell you which will happen.'},
}
for(const period of ['week','month'] as const)for(const up of [true,false]){
 const id=`${period==='week'?'weekly':'monthly'}_${up?'movers':'decliners'}`
 stories[id]={picture:`${period}-${up?'up':'down'}`,title:`${period==='week'?'Weekly':'Monthly'} comparison · previous closing level`,label:`Latest close ${up?'above':'below'} the previous ${period}’s close. This is a closing-price comparison, not a break of the period’s high or low.`,story:`The latest close is ${up?'above':'below'} the previous ${period}’s closing price. The path can include rises and falls; this comparison does not require a breakout or breakdown of that ${period}’s range.`}
}
export function ScannerStory({presetId}:{presetId:string}) {
 const copy=stories[presetId]
 if(!copy)return null
 return <figure className="vani-learning-story">
   <div className="vani-learning-eyebrow">{copy.title}</div>
   <Diagram kind={copy.picture} label={copy.label}/>
   <figcaption>Illustrative example—not live data.</figcaption>
   <p>{copy.story}</p>
 </figure>
}
export function ScannerSignalCards({presetId}:{presetId:string}) {
 const down=presetId==='breakdown_watch'||presetId.endsWith('_decliners')
 const period=presetId.startsWith('weekly_')?'week':presetId.startsWith('monthly_')?'month':null
 const scoreCard=down?{...scores,picture:'scores-down' as Picture,meaning:'A more negative recent score can show greater weakness in the recent reading than in the broader baseline. Check the actual values; appearing in this scan does not require this score relationship.'}:scores
 const rsiCard={...rsi,meaning:'Above 70 is a high reading; below 30 is a low reading. Compare it with the reference level, trading activity and relative strength.',limit:'A high reading does not guarantee a reversal; a low reading does not establish a bottom. RSI is supporting context, not an admission rule for this scan.'}
 const reference:Signal|null=period?{title:period==='week'?'WTD / previous week’s close':'MTD / previous month’s close',subtitle:'The reference behind this scan',picture:`${period}-${down?'down':'up'}` as Picture,look:`The latest close compared with the previous ${period}’s closing price.`,meaning:`${down?'Below':'Above'} that closing reference is what this scan identifies. The path within the current ${period} may include both rises and falls.`,limit:`This is not a comparison with the previous ${period}’s high or low, and does not mean every day moved in the same direction.`}:null
 const signals=presetId==='flower_pot_burst'?[coil,activity,relative,outcomes]:reference?[reference,scoreCard,relative,rsiCard]:[scoreCard,activity,relative,rsiCard]
 return <div className="vani-learning-signals"><p className="text-xs text-muted">Open a signal to connect the table reading with its meaning. Examples are illustrative, not live readings.</p>{signals.map(signal=><details key={signal.title} className="vani-learning-signal">
   <summary><span className="vani-evidence-value">{signal.title}</span><span className="vani-learning-subtitle">{signal.subtitle}</span></summary>
   <div className="vani-learning-signal-body"><Diagram kind={signal.picture} label={`Illustrative example: ${signal.subtitle}`}/>
     <dl><dt>What am I looking at?</dt><dd>{signal.look}</dd><dt>How does it help?</dt><dd>{signal.meaning}</dd><dt>What should I not conclude?</dt><dd className="vani-evidence-caution">{signal.limit}</dd></dl>
   </div>
 </details>)}</div>
}
