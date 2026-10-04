import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useFrameworkStore } from '@/stores/frameworkStore';
import { useAstroHorizon } from '@/hooks/useAstroHorizon';
import { astroToday, astroDate, boundary, fetchAstroEvents, fetchAstroFamilies, publishAstroFamily, eventCatalogItem, type AstroFamily } from '@/services/astroEvents';
import './eventWorkspace.css';
export default function EventWorkspace({ mode = 'manage' }: {
    mode?: 'manage' | 'catalog' | 'almanac';
}) {
    const admin = mode === 'manage';
    const allowed = useAuthStore(s => s.profile?.role === 'admin');
    const qc = useQueryClient();
    const [planet, setPlanet] = useState('Mercury'), [search, setSearch] = useState(''), [publication, setPublication] = useState('all'), [chosen, setChosen] = useState<string | null>(null), [tab, setTab] = useState('overview');
    const params = useParams();
    const [url] = useSearchParams();
    const profile = useAuthStore(s => s.profile);
    const today = astroToday();
    const [year, setYear] = useState(Number(today.slice(0, 4)));
    const horizon = useAstroHorizon();
    const fw = useFrameworkStore();
    useEffect(() => { if (!admin && !fw.framework && profile?.id)
        fw.loadFramework(profile.id); }, [admin, fw.framework, profile?.id, fw.loadFramework]);
    const fq = useQuery({ queryKey: ['astro', 'families', admin], queryFn: () => fetchAstroFamilies(admin), enabled: !admin || allowed });
    const end = admin ? `${year}-12-31` : [`${year}-12-31`, horizon.cutoffIso].sort()[0];
    const start = `${year}-01-01`;
    const eq = useQuery({ queryKey: ['astro', 'events', admin, start, end], queryFn: () => fetchAstroEvents(start, end, admin), enabled: (!admin || allowed) && start <= end });
    const legacy: Record<string, string> = { '197': 'mercury-sign', '198': 'mercury-motion', '102': 'mercury-visibility', '238': 'mercury-motion', '199': 'venus-motion', '200': 'venus-motion', '221': 'venus-motion', '112': 'mercury-venus-conjunction', '113': 'mercury-venus-conjunction', '123': 'mercury-venus-conjunction' };
    const linked = url.get('family') ?? (params.id ? legacy[params.id] : undefined);
    useEffect(() => { const f = fq.data?.find(f => f.id === linked || String(f.rule_id) === params.id); if (f) {
        setChosen(f.id);
        setPlanet(f.planets[0]);
    } }, [linked, params.id, fq.data]);
    const mutation = useMutation({ mutationFn: ({ id, on }: {
            id: string;
            on: boolean;
        }) => publishAstroFamily(id, on), onSuccess: () => { qc.invalidateQueries({ queryKey: ['astro'] }); qc.invalidateQueries({ queryKey: ['astro-bands'] }); qc.invalidateQueries({ queryKey: ['vani'] }); } });
    const families = fq.data ?? [];
    const rows = families.filter(f => f.planets.includes(planet) && `${f.name} ${f.description}`.toLowerCase().includes(search.toLowerCase()) && (publication === 'all' || f.catalog_visible === (publication === 'shown')));
    const selected = rows.find(f => f.id === chosen) ?? rows[0];
    const events = useMemo(() => (eq.data ?? []).filter(e => e.family_id === selected?.id), [eq.data, selected?.id]);
    const current = events.find(e => e.start_date <= today && e.end_date >= today) ?? events.find(e => e.start_date > today) ?? events.at(-1);
    const switcher = (f: AstroFamily) => <button className="ae-switch" role="switch" aria-label={`Show ${f.planets.join(' and ')} ${f.name} in Catalog`} aria-checked={f.catalog_visible} disabled={mutation.isPending} onClick={() => mutation.mutate({ id: f.id, on: !f.catalog_visible })}>{f.catalog_visible ? 'Shown' : 'Hidden'}</button>;
    if (admin && !allowed)
        return <div className="ae-workspace"><h2>Administrator access required</h2></div>;
    return <section className="ae-workspace"><header><div><small className="ae-eyebrow">{admin ? 'Administration · Rule Engine' : 'Astro · Mercury & Venus'}</small><h1>{admin ? 'Manage what users follow.' : mode === 'catalog' ? 'Choose what to follow.' : 'Your planetary calendar.'}</h1><p>{admin ? 'Simple events. One publication control.' : mode === 'catalog' ? 'Add published events to your index charts.' : 'The same events and dates used by your chart overlays.'}</p></div>{admin && <span className="ae-count">{families.filter(f => f.catalog_visible).length} of {families.length} published</span>}</header>
 {params.id && !linked && !fq.data?.some(f => String(f.rule_id) === params.id) && <p role="status">This legacy rule is archived. Manage the published Mercury and Venus events below.</p>}
 <div className="ae-planets" role="tablist" aria-label="Planet">{['Mercury', 'Venus'].map(p => <button key={p} role="tab" aria-selected={planet === p} className={planet === p ? 'selected' : ''} onClick={() => { setPlanet(p); setChosen(null); }}>{p === 'Mercury' ? '☿' : '♀'} {p}</button>)}</div>
 <div className="ae-tools"><input aria-label="Search events" value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${planet} events…`}/>{admin && <select aria-label="Catalog publication" value={publication} onChange={e => setPublication(e.target.value)}><option value="all">Catalog: all</option><option value="shown">Shown</option><option value="hidden">Hidden</option></select>}<label>Dates <select aria-label="Event year" value={year} onChange={e => setYear(Number(e.target.value))}>{Array.from({ length: 41 }, (_, i) => 1990 + i).map(y => <option key={y}>{y}</option>)}</select></label></div>
 {(fq.isPending || eq.isFetching) && <p role="status">Loading canonical events…</p>}{(fq.isError || eq.isError) && <div role="alert" className="ae-error">Event data could not be loaded. <button onClick={() => { fq.refetch(); eq.refetch(); }}>Retry</button></div>}{mutation.isError && <p role="alert" className="ae-error">{mutation.error.message}</p>}
 {!admin && fw.framework?.chart_overlays.some(o => o.config?.retired) && <p>Some saved overlays are retired. They remain switched off; you can remove them from your chart’s overlay controls.</p>}
 <div className="ae-layout"><div className="ae-card"><div className="ae-tablehead"><span>Event</span><span>Current / next</span><span>{admin ? 'Show in Catalog' : 'Chart overlay'}</span></div>{rows.map(f => <div className={`ae-row ${selected?.id === f.id ? 'selected' : ''}`} key={f.id}><button className="ae-event" onClick={() => { setChosen(f.id); setTab('overview'); }}><small>{f.planets.join(' + ')}</small><strong>{f.name}</strong><span>{f.description}</span></button><div className="ae-when"><strong>{f.ongoing ? 'Ongoing' : f.next_date ? 'Upcoming' : 'No upcoming date'}</strong><small>{f.next_date ? `Next · ${astroDate(f.next_date)}` : 'Outside recorded coverage'}</small></div>{admin ? switcher(f) : <button onClick={() => fw.isOverlayActive(`astro_event:${f.id}`) ? fw.removeOverlay(`astro_event:${f.id}`) : fw.addOverlay(eventCatalogItem(f))} disabled={!fw.framework}>{fw.isOverlayActive(`astro_event:${f.id}`) ? '✓ Remove' : '+ Overlay'}</button>}</div>)}{!fq.isPending && !rows.length && <p className="ae-empty">No published events match these filters.</p>}<footer>Conjunction is shared by both planets. One item, one publication setting.</footer></div>
 {selected && <aside className="ae-card ae-detail"><small className="ae-eyebrow">{selected.planets.join(' + ')}</small><h2>{selected.name}</h2><p>{selected.description}</p><div className="ae-subtabs">{['overview', 'dates', 'calculation'].map(t => <button key={t} className={tab === t ? 'selected' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
 {tab === 'overview' && <>{current ? <div className="ae-callout"><strong>{current.display_name}</strong>{Boolean(current.details?.sign) && <p>{String(current.details.sign)} · Lord: {String(current.details.sign_lord ?? 'Not recorded')}</p>}<p>{current.bracket_start_date ? `${astroDate(current.bracket_start_date)} – ${astroDate(current.bracket_end_date)} · daily-sample bracket` : boundary(current, 'start')}</p>{current.shape === 'period' && <p>Until {boundary(current, 'end')}</p>}{current.details?.contra_directional === true && <small>Mercury direct · Venus retrograde</small>}</div> : <p>No occurrence in the selected date range.</p>}<dl><dt>Previous completed</dt><dd>{astroDate(selected.previous_date)}</dd><dt>Recorded coverage</dt><dd>{astroDate(selected.first_date)} – {astroDate(selected.last_date)}</dd><dt>Calendar</dt><dd>IST · weekends and holidays included</dd></dl><small>Future market observations are available after their trading session. An event alone does not establish market direction.</small></>}
 {tab === 'dates' && <div className="ae-dates">{events.map(e => <article key={e.event_key}><strong>{e.display_name}</strong><p>{boundary(e, 'start')}{e.shape === 'period' ? ` → ${boundary(e, 'end')}` : ''}</p>{e.bracket_start_date && <small>Bracket: {astroDate(e.bracket_start_date)} – {astroDate(e.bracket_end_date)}</small>}</article>)}{!events.length && <p>No recorded events in this range.</p>}</div>}
 {tab === 'calculation' && <><p>Calculated records are read-only here. Changing publication does not change their dates.</p>{[...new Set(events.map(e => `${e.calculation_method ?? 'Recorded source'} · ${e.source}`))].map(m => <p className="ae-callout" key={m}>{m}</p>)}<small>{selected.id === 'mercury-visibility' ? 'Mercury source provenance may include historical almanac overrides.' : 'Visibility, angular combustion and station events are separate identities.'}</small><details><summary>Record details</summary><pre>{JSON.stringify(current?.details ?? {}, null, 2)}</pre></details></>}
 {admin && <div className="ae-publish"><span>Show in Catalog<small>Also available in Almanac and overlays.</small></span>{switcher(selected)}</div>}</aside>}</div>{!admin && <p className="ae-footnote">Future coverage follows your plan’s calendar horizon. Publication is managed in Rule Engine.</p>}
 </section>;
}
