import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import { fetchBookmarkStories } from '@/services/bookmarkStories';
import { displaySymbol, navName } from '@/lib/symbolUtils';
import { useScanPresenceForMany } from '@/hooks/useScanPresence';
import PersonalEventDigest from './PersonalEventDigest';
import './personalStoryCards.css';

const fmt = (v: number | null | undefined) => typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : 'Unavailable';
const signed = (v: number | null | undefined) => typeof v === 'number' && Number.isFinite(v) ? `${v > 0 ? '+' : ''}${fmt(v)}` : 'Unavailable';
export default function PersonalStoryCards({ positions = false, compact = false }: { positions?: boolean; compact?: boolean }) {
  const { bookmarks, isLoading, error, clearPosition } = useBookmarkStore();
  const items = useMemo(() => positions ? bookmarks.filter(b => b.entry_price != null) : bookmarks, [bookmarks, positions]);
  const ids = useMemo(() => items.map(b => b.equity_id).sort((a,b) => a-b), [items]);
  const stories = useQuery({ queryKey: ['bookmark-stories', ids.join(',')], queryFn: () => fetchBookmarkStories(ids), enabled: ids.length > 0, staleTime: 180000 });
  const scans = useScanPresenceForMany(compact ? [] : ids);
  if (isLoading && !items.length) return <p>Loading saved stocks…</p>;
  if (error) return <p role="alert">Saved stocks could not be loaded: {error}</p>;
  if (!items.length) return <p>{positions ? 'No positions yet. Open a stock’s My position tools to record an entry.' : 'No bookmarks yet. Save a stock from its chart or scanner row.'}</p>;
  return <div className={`personal-stories ${compact ? 'ps-compact' : ''}`}>
    <p className="ps-coverage">{compact ? 'Latest market session only · up to 4 saved stocks with recorded events first.' : 'Recent events · up to 5 available sessions. Counts are observations, not a stock score.'} □ Price · ◇ RS · ○ Participation</p>
    {stories.isError && <p role="alert">Event data could not be loaded. <button onClick={() => stories.refetch()}>Retry</button></p>}
    <div className="ps-grid">{(compact ? [...items].sort((a,b) => Number(stories.data?.get(b.equity_id)?.events.some(e => e.date === stories.data?.get(b.equity_id)?.expectedDate && e.date >= b.created_at.slice(0,10)) ?? false) - Number(stories.data?.get(a.equity_id)?.events.some(e => e.date === stories.data?.get(a.equity_id)?.expectedDate && e.date >= a.created_at.slice(0,10)) ?? false)).slice(0,4) : items).map(b => {
      const story = stories.data?.get(b.equity_id);
      const row = story?.latest;
      const name = displaySymbol({ symbol: b.symbol, company_name: b.company_name });
      const url = `/chart/equity/${b.equity_id}?name=${encodeURIComponent(navName(b))}`;
      const anchor = positions ? b.entry_date : b.created_at?.slice(0,10);
      const events = story?.events.filter(e => (!anchor || e.date >= anchor) && (!compact || e.date === story.expectedDate)) ?? [];
      const change = row && b.entry_price && b.entry_price > 0 ? (row.close / b.entry_price - 1) * 100 : null;
      const ref = row?.prev_week_close;
      const distance = row && ref != null && ref > 0 ? (row.close / ref - 1) * 100 : null;
      const matches = scans.matchedByEquity.get(b.equity_id) ?? [];
      return <article className="ps-card" key={b.id}>
        <header><div><span className="ps-eyebrow">{positions ? 'Holding · entry' : 'Watching · saved'} {anchor ?? 'date not recorded'}</span><h3><Link to={url}>{name}</Link></h3><p>{b.company_name} · {b.exchange ?? 'Exchange unavailable'}</p></div><div className="ps-price">{row ? `₹${fmt(row.close)}` : '—'}<small>As of {row?.trade_date ?? 'unavailable'}</small></div></header>
        {story && row?.trade_date !== story.expectedDate && <p className="ps-warning">Older stock data · latest market session {story.expectedDate}</p>}
        {positions && <div className="ps-holding"><div><small>My entry</small><strong>₹{fmt(b.entry_price)}</strong></div><div><small>Since entry</small><strong className={change == null ? '' : change >= 0 ? 'ps-positive' : 'ps-negative'}>{change == null ? 'Unavailable' : `${signed(change)}%`}</strong></div><div><small>Quantity</small><strong>{b.entry_qty == null ? 'Not added' : fmt(b.entry_qty)}</strong></div></div>}
        <div className="ps-events"><small>{story ? compact ? `Session ${story.expectedDate}` : `${story.fromDate} → ${row?.trade_date}` : 'Recent events'}</small>
          {stories.isPending ? <p>Loading observations…</p> : !story ? <p>Event coverage unavailable.</p> : !events.length ? <p>No supported events recorded in this window{anchor ? ' after your saved date or entry' : ''}.</p> : <PersonalEventDigest events={events} compact={compact}/>}

        </div>
        <div className="ps-evidence"><span>MagicRS <b>{signed(row?.magic_rs)}</b></span><span>5D RS change <b>{signed(row?.magic_rs_chg_5d)}{row?.magic_rs_chg_5d != null ? ' pts' : ''}</b></span><span>Flow 5D / 22D <b>{fmt(row?.score_5d)} / {fmt(row?.score_22d)}</b></span></div>
        {!compact && <div className="ps-reference"><small>MARKET REFERENCE · not a personal stop or target</small><div>Previous week close {ref != null ? `₹${fmt(ref)}` : 'unavailable'}{distance != null && <> · {distance === 0 ? 'At reference' : `${fmt(Math.abs(distance))}% ${distance > 0 ? 'above' : 'below'}`}</>}</div></div>}
        <footer>{!compact && <span>{b.industry ?? 'Industry unavailable'}<br/>{scans.isLoading ? 'Checking scanner matches…' : matches.length ? matches.map(m => m.name).join(' · ') : 'No current scanner match'}</span>}<Link to={url}>{positions ? 'Review holding story →' : 'Review story →'}</Link></footer>
        {positions && <details className="ps-manage"><summary>Manage position</summary><Link to={`${url}&tab=thesis`}>Entry and position tools →</Link><button onClick={async () => { if (window.confirm(`Clear the recorded position for ${name}? The bookmark will remain.`)) { try { await clearPosition(b.equity_id); } catch { window.alert('Position could not be cleared. Please retry.'); } } }}>Clear position · keep bookmark</button></details>}
      </article>;
    })}</div>
  </div>;
}
