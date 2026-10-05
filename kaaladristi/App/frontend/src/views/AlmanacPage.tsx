import { Link } from 'react-router-dom';
import EventWorkspace from '@/components/astro/EventWorkspace';
export default function AlmanacPage(){return <><nav className="ae-workspace" aria-label="Astro"><strong>Calendar</strong> · <Link to="/astro/study">Event Study →</Link></nav><EventWorkspace mode="almanac"/></>}
