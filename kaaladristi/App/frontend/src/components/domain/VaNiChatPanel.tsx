import MarketStructureCompanion from './VaNi/MarketStructureCompanion';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, ChevronRight, MessageCircle, RotateCcw, Search, ArrowRight } from 'lucide-react';
import VaNiMessage, { VaNiThinking } from './VaNi/VaNiMessage';
import VaNiAutorunBrief from './VaNi/VaNiAutorunBrief';
import VaNiIntentButton from './VaNi/VaNiIntentButton';
import VaNiIntentTray from './VaNi/VaNiIntentTray';
import type { ChatMessage } from './VaNi/types';
import { cn } from '@/lib/utils';
import { usePageContext } from '@/hooks/usePageContext';
import { getIntentsForPage, getEquityIntents, getAutorunIntent } from '@/config/vaniIntents';
import { useVaNiAsk } from '@/hooks/useVaNiChat';
import { useVaNiStore } from '@/stores/vaniStore';
import type { VaNiEntity } from '@/stores/vaniStore';
import { useAuthStore } from '@/stores/authStore';
import { usePipelineStatus } from '@/hooks/usePipelineStatus';
import type { VaNiAskResponse } from '@/hooks/useVaNiChat';
import { from } from '@/services/postgrest';
import { displaySymbol } from '@/lib/symbolUtils';
import { fmtDateLong } from '@/lib/dateUtils';
import type { VaNiPage } from '@/config/vaniIntents';

const pipelineUrl =
  (import.meta.env.VITE_PIPELINE_API_URL as string) ?? '';

// Human-facing header label per page — the raw enum ('index_vp') is an
// internal routing key and must never render verbatim (was leaking "vp").
const PAGE_DISPLAY_LABELS: Partial<Record<VaNiPage, string>> = {
  dashboard: 'Dashboard',
  equity_vp: 'Stock Chart',
  index_vp: 'Index Chart',
  industry_transition: 'Industry Transition',
  scanner: 'Scanner',
  manipulation_watch: 'Manipulation Watch',
  astro_calendar: 'Astro Calendar',
};

/** Resolve free text against the equity master (symbol first, then company
 *  name). Used ONLY for the canned not-in-this-scan reply — the typed text
 *  never reaches the LLM. Prefers NSE listings for dual-listed stocks. */
async function resolveEquity(q: string): Promise<{ id: number; symbol: string } | null> {
  const attempts: Array<[string, string]> = [
    ['symbol', q],
    ['symbol', `${q}*`],
    ['company_name', `*${q}*`],
  ];
  for (const [col, pattern] of attempts) {
    try {
      const { data } = await from('km_equity_symbols')
        .select('id,symbol,company_name,exchange')
        .ilike(col, pattern)
        .is('is_active', 'true')
        .limit(10)
        .execute();
      const rows = (data ?? []) as Array<{ id: number; symbol: string; company_name: string | null; exchange: string | null }>;
      if (rows.length) {
        const best = rows.find((r) => r.exchange === 'NSE') ?? rows[0];
        return { id: best.id, symbol: displaySymbol(best) };
      }
    } catch {
      /* try next pattern */
    }
  }
  return null;
}

export default function VaNiChatPanel(props: { docked?: boolean } = {}) {
  const { page } = usePageContext();
  return page === 'market_structure' ? <MarketStructureCompanion /> : <ExistingVaNiChatPanel {...props} />;
}

function ExistingVaNiChatPanel({ docked = false }: { docked?: boolean } = {}) {
  const {
    open, entity: storeEntity, close, clearEntity,
    scanContext, pendingIntentId, consumePendingIntent,
  } = useVaNiStore();
  const { page, entityType, entityId } = usePageContext();
  const { isAdmin } = useAuthStore();
  const { latestDataDate, latestDataDateFormatted, isPendingToday, status: pipelineStatus } = usePipelineStatus();
  const askMutation = useVaNiAsk();
  const navigate = useNavigate();

  // Auto-detect entity from URL on chart/pulse pages
  const urlEntity: VaNiEntity | null = (entityType && entityId) ? {
    type: entityType === 'stock' ? 'equity' : 'index',
    id: Number(entityId),
    symbol: new URLSearchParams(window.location.search).get('name') || `#${entityId}`,
    pageContext: page === 'equity_vp' ? 'Equity Chart' : page === 'index_vp' ? 'Index Chart' : undefined,
  } : null;

  const entity = storeEntity || urlEntity;

  // The opening brief runs only in the DOCKED pane. The overlay drawer is
  // opened deliberately, with a question already in mind — firing an
  // unrequested LLM read there would answer something nobody asked. Docked,
  // the pane is on screen before the user has decided anything, so landing
  // on a reading of the day beats landing on a menu.
  const autorunIntent = docked ? getAutorunIntent(page) : null;

  // Scanner intents need the published scan context (preset + visible rows);
  // hide them until a results view has published one.
  const pageIntents = getIntentsForPage(page, !!autorunIntent).filter(
    (i) => !i.intentId.startsWith('scanner.') || !!scanContext,
  );
  const equityIntents = entity ? getEquityIntents(entity.symbol) : [];
  // "Read today's results" is only accurate when the confirmed pipeline date
  // IS today — it usually isn't (EOD data lands after close). Name the actual
  // date instead of assuming "today", the same way the freshness pill does.
  const dateLabel = latestDataDateFormatted || (latestDataDate ? fmtDateLong(latestDataDate) : 'today');
  const labelFor = (i: { intentId: string; label: string }) =>
    i.intentId === 'scanner.read_results' ? `Read ${dateLabel} results` : i.label;
  const allIntents = [
    ...equityIntents.map(i => ({ intentId: i.intentId, label: labelFor(i) })),
    ...pageIntents.map(i => ({ intentId: i.intentId, label: labelFor(i) })),
  ];

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeIntentId, setActiveIntentId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset messages when entity changes
  const prevEntityRef = useRef(entity?.id);
  useEffect(() => {
    if (entity?.id !== prevEntityRef.current) {
      setMessages([]);
      prevEntityRef.current = entity?.id;
    }
  }, [entity?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, askMutation.isPending]);

  const askedIntents = new Set(messages.filter(m => m.type === 'intent').map(m => m.intentId));
  const remainingIntents = allIntents.filter(i => !askedIntents.has(i.intentId));

  const handleAsk = (intentId: string, label: string, overrideEntity?: VaNiEntity) => {
    if (askMutation.isPending) return;

    // Empty result set → answer deterministically, never via the LLM.
    // Narrating emptiness wastes a call, and while the pipeline is still
    // processing an empty scan means "data not loaded yet", not "no stocks
    // qualify" — VaNi must not present the first as the second.
    if (intentId === 'scanner.read_results' && scanContext && scanContext.rows.length === 0) {
      const dataInFlux = isPendingToday || pipelineStatus === 'delayed' || pipelineStatus === 'stale';
      setMessages(prev => [...prev,
        { id: `q-${Date.now()}`, type: 'intent', intentId, text: label, timestamp: Date.now() },
        {
          id: `r-${Date.now()}`,
          type: 'response',
          intentId,
          text: dataInFlux
            ? `Today's data is still processing, so ${scanContext.presetName} has no results to read yet — an empty list right now means "data not loaded", not "no stocks qualify". Fresh data usually lands by ~6:30 PM IST on trading days; ask again once the data pill shows current.`
            : `As of the ${latestDataDateFormatted || latestDataDate} close, no stocks meet ${scanContext.presetName}'s conditions. That can be normal — some conditions only line up a few days a month.`,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    setMessages(prev => [...prev, {
      id: `q-${Date.now()}`,
      type: 'intent',
      intentId,
      text: label,
      timestamp: Date.now(),
    }]);
    setActiveIntentId(intentId);

    const askEntity = overrideEntity ?? entity;
    // `date` (ISO) drives real backend date lookups for equity/dashboard
    // intents — must stay YYYY-MM-DD. `dataDateDisplay` is scanner-only and
    // display-only: it's echoed verbatim into VaNi's "As of the {date}
    // close…" opener, so it must already read naturally, not as "2026-07-20".
    const dateIso = latestDataDate || new Date().toISOString().slice(0, 10);
    const dataDateDisplay = latestDataDateFormatted || fmtDateLong(dateIso);
    askMutation.mutate(
      {
        intent_id: intentId,
        date: dateIso,
        ...(askEntity && intentId.startsWith('equity.') ? {
          entity_type: askEntity.type,
          entity_id: askEntity.id,
          page_context: askEntity.pageContext,
        } : {}),
        ...(intentId.startsWith('scanner.') && scanContext ? {
          preset_id: scanContext.presetId,
          data_date: dataDateDisplay,
          timeframe: scanContext.timeframe,
          exchange: scanContext.exchange,
          ...(intentId === 'scanner.read_results' ? {
            total_count: scanContext.totalCount,
            rows: scanContext.rows.map((r) => ({
              symbol: r.symbol,
              industry: r.industry,
              zone: r.zone,
              flow: r.flow,
              rsi: r.rsi,
              rvol: r.rvol,
              pct_chng: r.pctChng,
              surge: r.surge,
              vani: r.vani,
            })),
            ...(scanContext.cohortStats ? {
              cohort_stats: {
                vani_highlight_count: scanContext.cohortStats.vaniHighlightCount,
                accelerating_pct: scanContext.cohortStats.acceleratingPct,
                real_volume_pct: scanContext.cohortStats.realVolumePct,
                leading_industry: scanContext.cohortStats.leadingIndustry,
                leading_industry_count: scanContext.cohortStats.leadingIndustryCount,
              },
            } : {}),
          } : {}),
        } : {}),
      },
      {
        onSuccess: (data: VaNiAskResponse) => {
          setMessages(prev => [...prev, {
            id: `r-${Date.now()}`,
            type: 'response',
            intentId,
            text: data.response
              || (data.error ? `VaNi: ${data.error}` : 'VaNi could not generate a response right now.'),
            cached: data.cached,
            logId: data.log_id ?? undefined,
            timestamp: Date.now(),
          }]);
          setActiveIntentId(null);
        },
        onError: () => {
          setMessages(prev => [...prev, {
            id: `e-${Date.now()}`,
            type: 'response',
            intentId,
            text: 'Connection to VaNi failed. Please check if the pipeline API is running.',
            timestamp: Date.now(),
          }]);
          setActiveIntentId(null);
        },
      },
    );
  };

  // Auto-fire a pre-selected intent (e.g. the "✦ VaNi explains" link beside
  // a scanner heading opens the panel with this intent pending). Guarded so
  // repeat clicks / StrictMode replays never fire the same intent twice —
  // if it's already in the conversation, consuming the pending id is enough.
  useEffect(() => {
    if (!open || !pendingIntentId || askMutation.isPending) return;
    const id = consumePendingIntent();
    if (!id || askedIntents.has(id)) return;
    const def = allIntents.find((i) => i.intentId === id);
    handleAsk(id, def?.label ?? 'VaNi explains');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingIntentId]);

  // ── Gated stock lookup (scanner pages only) ──────────────────────────────
  // Free text is a SEARCH box, not a chat box: it resolves to a stock and,
  // only if that stock is in the current results, fires a canned intent.
  // Text never reaches the LLM.
  const [showAllIntents, setShowAllIntents] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupText, setLookupText] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);

  const pushLocal = (entries: Array<Omit<ChatMessage, 'timestamp'>>) => {
    setMessages(prev => [...prev, ...entries.map(e => ({ ...e, timestamp: Date.now() }))]);
  };

  const handleStockLookup = async () => {
    const q = lookupText.trim();
    if (!q || !scanContext || lookupBusy) return;
    setLookupText('');
    setLookupOpen(false);

    // Membership check first — LLM is invoked ONLY for stocks in this scan.
    const norm = q.toUpperCase();
    const hit = scanContext.rows.find(
      (r) => r.symbol.toUpperCase() === norm
        || (r.company ?? '').toUpperCase().includes(norm),
    );
    if (hit) {
      handleAsk('equity.why_in_context', `Tell me about ${hit.symbol}`, {
        type: 'equity',
        id: hit.equityId,
        symbol: hit.symbol,
        pageContext: `Scanner / ${scanContext.presetName}`,
      });
      return;
    }

    // Not in this scan → canned reply + deep link. No LLM call.
    setLookupBusy(true);
    pushLocal([{ id: `q-${Date.now()}`, type: 'intent', text: `Tell me about ${q}` }]);
    try {
      const match = await resolveEquity(q);
      if (match) {
        pushLocal([{
          id: `r-${Date.now()}`,
          type: 'response',
          text: `${match.symbol} isn't part of today's ${scanContext.presetName} results, so VaNi can't read it in this scan's context. You can explore it on its stock dashboard.`,
          link: { href: `/chart/equity/${match.id}?name=${encodeURIComponent(match.symbol)}`, label: `Open ${match.symbol} dashboard` },
        }]);
      } else {
        pushLocal([{
          id: `r-${Date.now()}`,
          type: 'response',
          text: `VaNi couldn't find a stock matching "${q}". Try the exact NSE symbol or a distinctive part of the company name.`,
        }]);
      }
    } finally {
      setLookupBusy(false);
    }
  };

  const showStockLookup = page === 'scanner' && !!scanContext;

  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const lastMessage = messages[messages.length - 1];
  // Docked with a brief above it, the question list moves OUT of the scroll
  // area into a pinned tray (VaNiIntentTray) — the brief is taller than the
  // pane, so an inline list sat below the fold. The three inline surfaces
  // (empty state, follow-up, "all answered") are then redundant and are
  // suppressed rather than rendered twice.
  const useTray = docked && !!autorunIntent;
  const showFollowUp = !useTray && lastMessage?.type === 'response'
    && !askMutation.isPending && remainingIntents.length > 0;

  // The raw page enum ('index_vp', 'astro_calendar', …) is an internal
  // routing key, not display text — page.replace('_',' ') alone would leak
  // "vp" straight into the header ("index vp context"). Found while wiring
  // My Space into this same panel (owner 2026-07-22).
  const pageLabel = PAGE_DISPLAY_LABELS[page] ?? page.replace(/_/g, ' ');
  const headerSubtext = entity
    ? `${entity.symbol} · ${pageLabel}`
    // Docked, the intent page key is not the page the user is on — 'dashboard'
    // reads as "DASHBOARD CONTEXT" on a screen titled Workspace. Say what VaNi
    // is doing; the question count belongs over the list, not in the masthead.
    : docked
      ? 'Reading this page'
      : `${pageLabel} context · ${allIntents.length} questions`;

  const IntentButton = ({ intentId, label, variant }: { intentId: string; label: string; variant: 'primary' | 'secondary' }) => (
    <VaNiIntentButton
      label={label}
      variant={variant}
      disabled={askMutation.isPending}
      onClick={() => handleAsk(intentId, label)}
    />
  );

  // The ONLY text input in the panel — appears solely inside the scanner
  // stock-lookup flow. It's a search box (symbol/company resolution), never
  // an open chat: the typed text is resolved locally and only membership-
  // confirmed stocks trigger a canned intent.
  const StockLookupAffordance = ({ variant }: { variant: 'primary' | 'secondary' }) => (
    <div>
      {!lookupOpen ? (
        <VaNiIntentButton
          label="Want to know about a stock in this scan?"
          variant={variant}
          disabled={askMutation.isPending || lookupBusy}
          icon={<Search className="w-3 h-3 text-[var(--accent-indigo)]" />}
          onClick={() => setLookupOpen(true)}
        />
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg)]/70 border-2 border-[var(--accent-indigo)]/40">
          <Search className="w-3.5 h-3.5 shrink-0 text-[var(--accent-indigo)]/60" />
          <input
            autoFocus
            value={lookupText}
            onChange={(e) => setLookupText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleStockLookup();
              if (e.key === 'Escape') { setLookupOpen(false); setLookupText(''); }
            }}
            placeholder="tell me about RELIANCE…"
            className="flex-1 bg-transparent text-xs text-white/85 placeholder:text-white/25 outline-none min-w-0"
          />
          <button
            onClick={handleStockLookup}
            disabled={!lookupText.trim()}
            className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-[var(--accent-indigo)]/25 hover:bg-[var(--accent-indigo)]/40 text-[var(--accent-indigo)] disabled:opacity-30 transition-colors"
          >
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* No scrim when docked — it would dim the workspace being worked in. */}
      {!docked && open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[3px] z-[200]"
          onClick={close}
        />
      )}

      <div
        className={cn(
          'flex flex-col',
          // Docked, the pane is a surface of THIS app and must use its tokens.
          // The overlay's literal below is a purple-black belonging to no theme
          // here; docked it read as a foreign panel bolted onto the page.
          docked ? 'bg-[var(--card)]' : 'bg-[#0c0a1a]',
          docked
            // Docked: a card in the page's own content row, sharing its gutter
            // and radius, sticky under the topbar. Not fixed and not
            // full-height — spanning the topbar row is what made the screen
            // look like two applications stitched together.
            ? 'sticky self-start shrink-0 w-[var(--vani-w)] rounded-2xl border border-[var(--border)] overflow-hidden'
            : cn(
                'fixed top-0 h-full z-[201] right-0',
                'border-l-2 border-[var(--accent-indigo)]/30',
                'shadow-[−8px_0_30px_rgba(99,102,241,0.15)]',
                'transition-transform duration-300 ease-out',
                'w-full sm:w-[420px] lg:w-[400px]',
                open ? 'translate-x-0' : 'translate-x-full',
              ),
        )}
        style={
          docked
            ? {
                top: 'calc(var(--topbar-h) + 1rem)',
                height: 'calc(100vh - var(--topbar-h) - 3rem)',
              }
            : undefined
        }
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--accent-indigo)]/20 shrink-0 bg-[var(--bg)]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-violet)] flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
            <span className="text-white text-sm font-serif font-bold">V</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-serif font-bold text-white leading-tight">
              VaNi <span className="font-normal text-[var(--accent-indigo)]/70">&middot; वाणी</span>
            </div>
            <div className="text-[10px] font-mono text-[var(--accent-indigo)]/50 tracking-wide uppercase mt-0.5">
              {headerSubtext}
            </div>
          </div>
          {(messages.length > 0 || entity) && (
            <button
              onClick={() => { setMessages([]); clearEntity(); }}
              title="Reset conversation"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:bg-white/10 hover:text-[var(--accent-indigo)] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Docked, there is nothing to close to — the column stays. */}
          {!docked && (
            <button
              onClick={close}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:bg-white/10 hover:text-white/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Entity banner */}
        {entity && (
          <div className="px-5 py-2 bg-[var(--accent-indigo)]/8 border-b border-[var(--accent-indigo)]/15">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold font-mono text-[var(--accent-indigo)]">
                {entity.symbol}
              </span>
              {entity.pageContext && (
                <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider">
                  {entity.pageContext}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Chat area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* Opening brief — stays pinned above the conversation: it is the
                day's context, not the first turn of a chat. */}
            {autorunIntent && (
              <VaNiAutorunBrief
                intentId={autorunIntent.intentId}
                calendarDate={todayIso}
                dataDate={latestDataDate}
                isAdmin={isAdmin}
              />
            )}

            {/* Empty state */}
            {messages.length === 0 && !useTray && (
              <div className="py-2">
                {docked ? (
                  // Docked, the pane is on screen all day: a 150px centred hero
                  // asking "what would you like to know?" is a prompt to work,
                  // not information. A quiet label over the list does the job.
                  <div className="flex items-center gap-2 mb-2.5 px-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">
                      {autorunIntent ? 'Go deeper' : 'Ask about this page'}
                    </span>
                    {autorunIntent && <div className="flex-1 h-px bg-[var(--accent-indigo)]/10" />}
                  </div>
                ) : (
                  <div className="text-center mb-6">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--accent-indigo)]/20 to-[var(--accent-violet)]/20 flex items-center justify-center border border-[var(--accent-indigo)]/20">
                      <Sparkles className="w-6 h-6 text-[var(--accent-indigo)]" />
                    </div>
                    <p className="text-sm font-medium text-white/80 mb-1">
                      {entity ? `Ask about ${entity.symbol}` : 'What would you like to know?'}
                    </p>
                    <p className="text-[11px] text-white/30 max-w-[260px] mx-auto leading-relaxed">
                      {entity
                        ? `VaNi will analyse ${entity.symbol}'s signals and context.`
                        : 'VaNi reads the live data on this page and answers your questions.'}
                    </p>
                  </div>
                )}
                <div className={docked ? 'space-y-1' : 'space-y-2'}>
                  {/* Eight equally-loud slabs is a menu wall, not a companion.
                      Docked shows the first four and keeps the rest a click
                      away, so the list has a top. */}
                  {(docked && !showAllIntents ? allIntents.slice(0, 4) : allIntents).map(intent => (
                    <IntentButton
                      key={intent.intentId}
                      intentId={intent.intentId}
                      label={intent.label}
                      variant={docked ? 'secondary' : 'primary'}
                    />
                  ))}
                  {docked && !showAllIntents && allIntents.length > 4 && (
                    <button
                      onClick={() => setShowAllIntents(true)}
                      className="w-full text-left px-4 py-2 text-[11px] text-[var(--accent-indigo)]/70 hover:text-[var(--accent-indigo)] transition-colors"
                    >
                      {allIntents.length - 4} more questions
                    </button>
                  )}
                  {showStockLookup && <StockLookupAffordance variant={docked ? 'secondary' : 'primary'} />}
                </div>
              </div>
            )}

          {/* Messages */}
          {messages.map(msg => (
            <VaNiMessage
              key={msg.id}
              message={msg}
              isAdmin={isAdmin}
              onClearCache={(m) => setMessages(prev => prev.filter(
                x => x.id !== m.id && !(x.type === 'intent' && x.intentId === m.intentId),
              ))}
              onFollowLink={(href) => { close(); navigate(href); }}
            />
          ))}

          {/* Thinking */}
          {askMutation.isPending && <VaNiThinking />}

          {/* Follow-up */}
          {showFollowUp && (
            <div className="pt-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-[var(--accent-indigo)]/10" />
                <span className="text-[9px] font-mono text-[var(--accent-indigo)]/40 uppercase tracking-widest px-2">
                  also ask
                </span>
                <div className="flex-1 h-px bg-[var(--accent-indigo)]/10" />
              </div>
              <div className="space-y-1.5">
                {remainingIntents.map(intent => (
                  <IntentButton
                    key={intent.intentId}
                    intentId={intent.intentId}
                    label={intent.label}
                    variant="secondary"
                  />
                ))}
                {showStockLookup && <StockLookupAffordance variant="secondary" />}
              </div>
            </div>
          )}

          {/* All done */}
          {!useTray && messages.length > 0 && remainingIntents.length === 0 && !askMutation.isPending && (
            <div className="pt-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-[var(--accent-indigo)]/10" />
                <span className="text-[9px] font-mono text-[var(--accent-indigo)]/30 uppercase tracking-widest px-2">
                  all answered
                </span>
                <div className="flex-1 h-px bg-[var(--accent-indigo)]/10" />
              </div>
              {showStockLookup && (
                <div className="mt-3">
                  <StockLookupAffordance variant="secondary" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pinned questions — docked only, see useTray above. */}
        {useTray && (
          <VaNiIntentTray
            intents={remainingIntents}
            disabled={askMutation.isPending}
            onAsk={handleAsk}
            heading={messages.length === 0 ? 'Go deeper' : 'Also ask'}
            footer={showStockLookup ? <StockLookupAffordance variant="secondary" /> : undefined}
          />
        )}
      </div>
    </>
  );
}
