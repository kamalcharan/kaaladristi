export interface EvidenceSection {title:string;items:string[]}

/** Highlight plain text only; stock names and model evidence never become HTML. */
function Highlight({text,symbols}:{text:string;symbols:string[]}) {
  const names=new Set(symbols.filter(Boolean));
  const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const alternatives=[...names].sort((a,b)=>b.length-a.length).map(escape);
  const pattern=new RegExp(`(${alternatives.length?alternatives.join('|')+'|':''}\\b\\d+(?:\\.\\d+)?%?)`,'g');
  return <>{text.split(pattern).map((part,i)=>names.has(part)?<strong key={i} className="vani-evidence-stock">{part}</strong>:/^\d+(?:\.\d+)?%?$/.test(part)?<mark key={i} className="vani-evidence-value">{part}</mark>:part)}</>;
}

export default function SectorEvidence({sections,symbols}:{sections:EvidenceSection[];symbols:string[]}) {
  return <div className="vani-evidence-sections">{sections.filter(s=>s.items.length).map(section=><section key={section.title} aria-label={section.title}>
    <h4>{section.title}</h4>
    <ul>{section.items.map((item,i)=><li key={i} className={item.startsWith('Greed adds caution')?'vani-evidence-caution':undefined}><Highlight text={item} symbols={symbols}/></li>)}</ul>
  </section>)}</div>;
}
