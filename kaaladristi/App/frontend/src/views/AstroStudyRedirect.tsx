import { Navigate, useSearchParams } from 'react-router-dom';

/** Compatibility for saved links. ChartView owns every chart and indicator. */
export default function AstroStudyRedirect() {
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  const requested = Number(next.get('index'));
  const index = Number.isInteger(requested) && requested > 0 ? requested : 1;
  next.delete('index');
  if (index === 1 && !next.has('name')) next.set('name','NIFTY 50');
  next.set('tab', 'chart');
  next.set('astro', '1');
  return <Navigate replace to={`/chart/index/${index}?${next}`} />;
}
