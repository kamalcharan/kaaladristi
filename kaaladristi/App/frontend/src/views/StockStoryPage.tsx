import ChartView from './ChartView';
import { useParams } from 'react-router-dom';

/** Separate preview destination; shares the existing cockpit's data and widgets. */
export default function StockStoryPage() {
  const { id } = useParams();
  return <ChartView key={id} storyPreview />;
}
