import ChartView from './ChartView';
import { Navigate, useLocation, useParams } from 'react-router-dom';

/** Canonical equity page; shares the cockpit's data and widgets. */
export default function StockStoryPage() {
  const { id } = useParams();
  return <ChartView key={id} storyPreview />;
}

/** Preserve saved preview links, including setup, tab, name and hash. */
export function StockStoryRedirect() {
  const { id } = useParams();
  const { search, hash } = useLocation();
  return <Navigate replace to={`/chart/equity/${id}${search}${hash}`} />;
}
