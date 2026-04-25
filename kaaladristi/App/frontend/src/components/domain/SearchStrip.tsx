/**
 * SearchStrip — Global instrument search with autocomplete
 * ==========================================================
 * Searches km_index_symbols and km_equity_symbols.
 * Dropdown shows matching results as user types (min 2 chars).
 * Selection navigates to the appropriate chart page:
 *   Index  → /chart/index/:id?name=...
 *   Equity → /chart/equity/:id?name=...
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X, TrendingUp, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { from } from '@/services/postgrest';

// ── Types ──────────────────────────────────────────────────────

interface SearchItem {
  id: number;
  type: 'index' | 'equity';
  name: string;          // display name (index name or company_name)
  symbol: string;        // ticker / index name
  isin: string | null;   // ISIN code (equities only)
  exchange: string | null;
  industry: string | null;
}

// ── Data fetching ──────────────────────────────────────────────

async function fetchSearchIndex(): Promise<SearchItem[]> {
  const [indexRes, equityRes] = await Promise.all([
    from('km_index_symbols')
      .select('id,name,category')
      .is('is_active', 'true')
      .order('name', { ascending: true })
      .limit(200)
      .execute(),

    from('km_equity_symbols')
      .select('id,symbol,company_name,exchange,industry,isin')
      .is('is_active', 'true')
      .order('symbol', { ascending: true })
      .limit(8000)
      .execute(),
  ]);

  if (indexRes.error && equityRes.error) {
    throw new Error(indexRes.error.message || 'Search index fetch failed');
  }

  const items: SearchItem[] = [];

  // Indices
  for (const r of (indexRes.data ?? []) as { id: number; name: string; category: string | null }[]) {
    items.push({
      id: r.id,
      type: 'index',
      name: r.name,
      symbol: r.name,
      isin: null,
      exchange: null,
      industry: r.category,
    });
  }

  // Equities — deduplicate by ISIN (prefer NSE over BSE)
  // Pass 1: index all by ISIN, prefer NSE
  type EqRow = { id: number; symbol: string; company_name: string | null; exchange: string | null; industry: string | null; isin: string | null };
  const allEquities = (equityRes.data ?? []) as EqRow[];
  const isinMap = new Map<string, EqRow>(); // ISIN → preferred row
  const noIsin: EqRow[] = [];

  for (const r of allEquities) {
    if (!r.isin) {
      noIsin.push(r);
      continue;
    }
    const existing = isinMap.get(r.isin);
    if (!existing) {
      isinMap.set(r.isin, r);
    } else if (r.exchange === 'NSE' && existing.exchange !== 'NSE') {
      isinMap.set(r.isin, r); // NSE preferred
    }
  }

  // Pass 2: build search items from deduplicated set
  for (const r of [...isinMap.values(), ...noIsin]) {
    items.push({
      id: r.id,
      type: 'equity',
      name: r.company_name ?? r.symbol,
      symbol: r.symbol,
      isin: r.isin,
      exchange: r.exchange,
      industry: r.industry,
    });
  }

  return items;
}

// ── Search logic ───────────────────────────────────────────────

function matchScore(item: SearchItem, query: string): number {
  const q = query.toLowerCase();
  const sym = item.symbol.toLowerCase();
  const name = item.name.toLowerCase();
  const isin = item.isin?.toLowerCase() ?? '';

  // Exact ISIN match → highest
  if (isin && isin === q) return 100;
  // Exact symbol match
  if (sym === q) return 100;
  // ISIN starts with query (e.g. "INE009" matches INE009A01021)
  if (isin && isin.startsWith(q)) return 95;
  // Symbol starts with query
  if (sym.startsWith(q)) return 90;
  // Name starts with query
  if (name.startsWith(q)) return 80;
  // Symbol contains query
  if (sym.includes(q)) return 60;
  // Name contains query
  if (name.includes(q)) return 50;
  // ISIN contains query
  if (isin && isin.includes(q)) return 45;
  // Industry match
  if (item.industry?.toLowerCase().includes(q)) return 30;

  return 0;
}

// ── Component ──────────────────────────────────────────────────

export default function SearchStrip() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch search index (cached 10 min)
  const { data: searchIndex, isLoading, isError } = useQuery({
    queryKey: ['search-index'],
    queryFn: fetchSearchIndex,
    staleTime: 10 * 60 * 1000,
  });

  // Filter results
  const results = useMemo(() => {
    if (!searchIndex || query.length < 2) return [];

    const scored = searchIndex
      .map((item) => ({ item, score: matchScore(item, query) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => {
        // Indices first if query looks like an index name
        if (a.item.type !== b.item.type) {
          if (a.item.type === 'index') return -1;
          if (b.item.type === 'index') return 1;
        }
        return b.score - a.score;
      });

    return scored.slice(0, 12).map((r) => r.item);
  }, [searchIndex, query]);

  // Reset selection on results change
  useEffect(() => {
    setSelectedIdx(0);
  }, [results]);

  // Navigate to selected item
  const navigateTo = useCallback((item: SearchItem) => {
    const displayName = /^\d+$/.test(item.symbol) ? item.name : item.symbol;
    if (item.type === 'index') {
      navigate(`/chart/index/${item.id}?name=${encodeURIComponent(item.name)}`);
    } else {
      navigate(`/chart/equity/${item.id}?name=${encodeURIComponent(displayName)}`);
    }
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  }, [navigate]);

  // Keyboard handling
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      e.preventDefault();
      navigateTo(results[selectedIdx]);
    } else if (e.key === 'Escape') {
      setQuery('');
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }, [results, selectedIdx, navigateTo]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Global keyboard shortcut: Ctrl+K or / to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search pill — matches .search in dashboard-LOCKED.html */}
      <div className="relative flex items-center">
        <Search
          className="absolute left-[14px] pointer-events-none"
          style={{ width: '14px', height: '14px', color: 'var(--text-faint)' }}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search index or stock · ⌘K"
          style={{
            width: '100%',
            paddingLeft: '38px',
            paddingRight: query ? '32px' : '14px',
            paddingTop: '8px',
            paddingBottom: '8px',
            fontSize: '13px',
            color: 'var(--text-faint)',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            borderRadius: '100px',
            outline: 'none',
            transition: 'border-color 0.18s',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-indigo)'; if (query.length >= 2) setIsOpen(true); }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setIsOpen(false); }}
            className="absolute right-2 text-muted hover:text-primary transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Loading hint */}
      {isOpen && query.length >= 2 && isLoading && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-kd-card border border-kd-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 px-4 py-4 text-center">
          <p className="text-xs text-muted">Loading search index…</p>
        </div>
      )}

      {/* Error hint */}
      {isOpen && query.length >= 2 && isError && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-kd-card border border-kd-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 px-4 py-4 text-center">
          <p className="text-xs" style={{ color: 'var(--risk-red)' }}>Search unavailable — check connection</p>
        </div>
      )}

      {/* Dropdown results */}
      {isOpen && !isLoading && !isError && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-kd-card border border-kd-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 max-h-[400px] overflow-y-auto">
          {results.map((item, i) => (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => navigateTo(item)}
              onMouseEnter={() => setSelectedIdx(i)}
              className={cn(
                'w-full text-left px-3 py-2 flex items-center gap-3 transition-colors',
                i === selectedIdx
                  ? 'bg-accent-indigo/10'
                  : 'hover:bg-kd-elevated/60',
              )}
            >
              {/* Type icon */}
              <div className={cn(
                'w-6 h-6 rounded-md flex items-center justify-center shrink-0',
                item.type === 'index'
                  ? 'bg-accent-cyan/10 text-accent-cyan'
                  : 'bg-accent-violet/10 text-accent-violet',
              )}>
                {item.type === 'index'
                  ? <TrendingUp className="w-3 h-3" />
                  : <BarChart3 className="w-3 h-3" />
                }
              </div>

              {/* Name + metadata */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono text-primary truncate">
                    {/^\d+$/.test(item.symbol) ? item.name : item.symbol}
                  </span>
                  <span className={cn(
                    'text-[8px] font-bold px-1 py-0.5 rounded border shrink-0',
                    item.type === 'index'
                      ? 'text-accent-cyan border-accent-cyan/30 bg-accent-cyan/5'
                      : item.exchange === 'NSE'
                      ? 'text-accent-cyan border-accent-cyan/30 bg-accent-cyan/5'
                      : 'text-risk-amber border-risk-amber/30 bg-risk-amber/5',
                  )}>
                    {item.type === 'index' ? 'INDEX' : item.exchange ?? 'EQ'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {item.type === 'equity' && !/^\d+$/.test(item.symbol) && (
                    <span className="text-[10px] text-muted truncate">{item.name}</span>
                  )}
                  {item.industry && (
                    <span className="text-[10px] text-muted truncate">{item.industry}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results hint */}
      {isOpen && !isLoading && !isError && query.length >= 2 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-kd-card border border-kd-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 px-4 py-6 text-center">
          <p className="text-xs text-muted">No matches for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
