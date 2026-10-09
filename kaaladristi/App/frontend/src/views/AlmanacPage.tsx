import { Link } from 'react-router-dom';
import EventWorkspace from '@/components/astro/EventWorkspace';
export default function AlmanacPage(){return <><nav className="ae-workspace" aria-label="Astro"><strong>Calendar</strong> · <Link to="/chart/index/1?tab=chart&astro=1&name=NIFTY%2050">Study in ChartView →</Link></nav><EventWorkspace mode="almanac"/></>}
