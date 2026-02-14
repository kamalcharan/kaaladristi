import { useState, useMemo } from 'react';
import { Settings, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { usePlanets, useSectors, useSectorLords } from '@/hooks/useMasterData';
import { Skeleton } from '@/components/ui';

// Planet color mapping for visual distinction
const planetColors: Record<number, string> = {
  1: 'bg-red-500/15 text-red-400 border-red-500/30',        // Mars
  2: 'bg-pink-500/15 text-pink-400 border-pink-500/30',      // Venus
  3: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', // Mercury
  4: 'bg-slate-500/15 text-slate-300 border-slate-500/30',    // Saturn
  5: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', // Jupiter
  6: 'bg-orange-500/15 text-orange-400 border-orange-500/30', // Sun
  7: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30', // Rahu
  8: 'bg-amber-500/15 text-amber-400 border-amber-500/30',   // Ketu
  9: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',       // Moon
  10: 'bg-sky-500/15 text-sky-400 border-sky-500/30',         // Uranus
  11: 'bg-teal-500/15 text-teal-400 border-teal-500/30',      // Neptune
  12: 'bg-violet-500/15 text-violet-400 border-violet-500/30', // Pluto
};

type SortField = 'sector' | 'planet';
type SortDir = 'asc' | 'desc';

export default function SettingsView() {
  const { data: planets, isLoading: loadingPlanets } = usePlanets();
  const { data: sectors, isLoading: loadingSectors } = useSectors();
  const { data: sectorLords, isLoading: loadingLords } = useSectorLords();

  const [search, setSearch] = useState('');
  const [filterPlanet, setFilterPlanet] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>('planet');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const isLoading = loadingPlanets || loadingSectors || loadingLords;

  // Build lookup maps
  const planetMap = useMemo(() => {
    const m = new Map<number, string>();
    planets?.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [planets]);

  const sectorMap = useMemo(() => {
    const m = new Map<number, string>();
    sectors?.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [sectors]);

  // Join sector_lords with names, apply filters + sort
  const rows = useMemo(() => {
    if (!sectorLords) return [];

    const joined = sectorLords.map((sl) => ({
      sectorId: sl.sector_id,
      planetId: sl.planet_id,
      sector: sectorMap.get(sl.sector_id) ?? `Sector #${sl.sector_id}`,
      planet: planetMap.get(sl.planet_id) ?? `Planet #${sl.planet_id}`,
    }));

    // Filter
    const filtered = joined.filter((r) => {
      if (filterPlanet !== null && r.planetId !== filterPlanet) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.sector.toLowerCase().includes(q) || r.planet.toLowerCase().includes(q);
      }
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      const aVal = sortField === 'sector' ? a.sector : a.planet;
      const bVal = sortField === 'sector' ? b.sector : b.planet;
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [sectorLords, sectorMap, planetMap, search, filterPlanet, sortField, sortDir]);

  // Group by planet for summary stats
  const planetStats = useMemo(() => {
    if (!sectorLords || !planets) return [];
    const counts = new Map<number, number>();
    sectorLords.forEach((sl) => counts.set(sl.planet_id, (counts.get(sl.planet_id) || 0) + 1));
    return planets
      .map((p) => ({ ...p, count: counts.get(p.id) || 0 }))
      .filter((p) => p.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [sectorLords, planets]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3.5 h-3.5 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5" />
      : <ChevronDown className="w-3.5 h-3.5" />;
  };

  return (
    <div className="animate-fade-in">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Settings</h1>
        <p className="text-secondary font-medium">Master data reference tables</p>
      </header>

      {/* Sector Lords Section */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-5 h-5 text-accent-indigo" />
          <h2 className="text-xl font-semibold">Sector Lords</h2>
          <span className="text-xs text-muted ml-auto">
            {isLoading ? '...' : `${sectorLords?.length ?? 0} mappings across ${planetStats.length} planets`}
          </span>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Planet filter chips */}
            <div className="flex flex-wrap gap-2 mb-5">
              <button
                onClick={() => setFilterPlanet(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  filterPlanet === null
                    ? 'bg-accent-indigo/20 text-accent-indigo border-accent-indigo/40'
                    : 'bg-kd-elevated border-kd-border text-secondary hover:text-[var(--text-primary)]'
                }`}
              >
                All ({sectorLords?.length})
              </button>
              {planetStats.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setFilterPlanet(filterPlanet === p.id ? null : p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    filterPlanet === p.id
                      ? planetColors[p.id] || 'bg-accent-indigo/20 text-accent-indigo border-accent-indigo/40'
                      : 'bg-kd-elevated border-kd-border text-secondary hover:text-[var(--text-primary)]'
                  }`}
                >
                  {p.name} ({p.count})
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative mb-5">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sectors or planets..."
                className="w-full pl-10 pr-4 py-3 bg-kd-elevated border border-kd-border rounded-xl text-sm text-[var(--text-primary)] placeholder:text-muted focus:outline-none focus:border-accent-indigo transition-all"
              />
            </div>

            {/* Table */}
            <div className="bg-kd-card border border-kd-border rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr_200px] gap-4 px-5 py-3 bg-kd-elevated/50 border-b border-kd-border">
                <button
                  onClick={() => toggleSort('sector')}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-secondary uppercase tracking-wider hover:text-[var(--text-primary)] transition-colors text-left"
                >
                  Sector <SortIcon field="sector" />
                </button>
                <button
                  onClick={() => toggleSort('planet')}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-secondary uppercase tracking-wider hover:text-[var(--text-primary)] transition-colors text-left"
                >
                  Ruling Planet <SortIcon field="planet" />
                </button>
              </div>

              {/* Rows */}
              <div className="max-h-[560px] overflow-y-auto scrollbar-thin">
                {rows.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-muted">
                    No matches found
                  </div>
                ) : (
                  rows.map((r, i) => (
                    <div
                      key={`${r.sectorId}-${r.planetId}`}
                      className={`grid grid-cols-[1fr_200px] gap-4 px-5 py-3 text-sm ${
                        i % 2 === 0 ? '' : 'bg-kd-elevated/20'
                      } hover:bg-kd-elevated/40 transition-colors`}
                    >
                      <span className="text-[var(--text-primary)]">{r.sector}</span>
                      <span className={`inline-flex items-center gap-2`}>
                        <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium border ${planetColors[r.planetId] || 'bg-kd-elevated text-secondary border-kd-border'}`}>
                          {r.planet}
                        </span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <p className="mt-3 text-[11px] text-muted">
              Showing {rows.length} of {sectorLords?.length} mappings
            </p>
          </>
        )}
      </section>
    </div>
  );
}
