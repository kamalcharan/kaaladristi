// Synthetic fixture only; not registered in the product router.
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyBookmarksPanel from '../../../src/components/domain/MyBookmarksPanel';
import PersonalStoryCards from '../../../src/components/domain/PersonalStoryCards';
import '../../../src/components/workspace/workspaceToday.css';
import { useBookmarkStore } from '../../../src/stores/bookmarkStore';
import { personalStory } from '../../../src/services/bookmarkStories';
import { initTheme, useThemeStore } from '../../../src/stores/themeStore';
import '../../../src/styles/globals.css';
initTheme();
useThemeStore.getState().setMode(new URLSearchParams(location.search).get('mode') === 'dark' ? 'dark' : 'light');
const bookmark = { id: 'fixture', equity_id: 39248, symbol: 'JGCHEM', company_name: 'J.G. Chemicals', industry: 'Chemicals', exchange: 'NSE', created_at: '2026-09-10T10:00:00Z', entry_date: '2026-09-11', entry_price: 587, entry_qty: null };
useBookmarkStore.setState({ bookmarks: [bookmark], hasLoaded: true, isLoading: false, load: async () => {} });
const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
const rows = [
  { trade_date: '2026-09-17', close: 588, magic_rs: 40, magic_rs_chg_5d: 1, score_5d: 0, score_22d: 38, prev_week_close: 592.05, pct_wtd: -0.68 },
  { trade_date: '2026-09-18', close: 612.4, magic_rs: 37.22, magic_rs_chg_5d: -3.29, score_5d: 0, score_22d: 38, prev_week_close: 592.05, pct_wtd: 3.44, dot_sbd: true, dot_svd: true },
];
const params = new URLSearchParams(location.search);
client.setQueryData(['bookmark-stories', '39248'], new Map([[39248, personalStory(rows, params.has('stale') ? '2026-09-19' : '2026-09-18')]]));
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/bookmarks']}><div style={{ padding: 16 }}><p>Synthetic card review fixture</p>{params.has('today') ? <div className="workspace-today"><section className="wt-bookmarks"><PersonalStoryCards compact/></section></div> : <MyBookmarksPanel/>}</div></MemoryRouter></QueryClientProvider>);
