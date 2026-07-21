/**
 * bookmarkStore — "My Bookmarks" state.
 *
 * Holds the bookmarked list (for the My Bookmarks tab) plus a Set of
 * equity_ids (for O(1) icon-state lookup on scanner rows / the equity
 * chart page). Reads the current user from authStore internally so
 * callers just pass an equity_id, not a user_id.
 */

import { create } from 'zustand';
import { useAuthStore } from '@/stores/authStore';
import { fetchBookmarks, addBookmark, removeBookmark, setPosition as apiSetPosition, type BookmarkRow, type PositionEntry } from '@/services/bookmarks';

interface BookmarkState {
  bookmarks: BookmarkRow[];
  bookmarkedIds: Set<number>;
  /** Last toggle outcome per equityId, timestamped. A load() that STARTED
   *  before this timestamp fetched a snapshot that predates the toggle, so
   *  its answer for this id is stale even if it resolves LATER — clearing
   *  the entry the moment toggle() settles (the previous approach) doesn't
   *  cover that ordering: a load() already in flight when the user clicks
   *  can still resolve after settle() and clobber the fresh bookmark with
   *  pre-click data. Keeping the entry (never cleared) and comparing
   *  timestamps instead of presence/absence closes that gap. */
  confirmed: Map<number, { want: boolean; at: number }>;
  isLoading: boolean;
  error: string | null;
  hasLoaded: boolean;

  load: () => Promise<void>;
  toggle: (equityId: number) => Promise<void>;
  isBookmarked: (equityId: number) => boolean;
  /** Set/replace a position (a bookmark with an entry). Creates the bookmark
   *  if needed and upserts the row into the list. */
  setPosition: (equityId: number, entry: PositionEntry) => Promise<void>;
  /** Clear a position back to a plain watchlist bookmark. */
  clearPosition: (equityId: number) => Promise<void>;
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: [],
  bookmarkedIds: new Set(),
  confirmed: new Map(),
  isLoading: false,
  error: null,
  hasLoaded: false,

  load: async () => {
    const userId = useAuthStore.getState().profile?.id;
    if (!userId) return;
    if (get().isLoading) return; // dedupe the ~N concurrent calls from N toggle mounts
    const startedAt = Date.now();
    set({ isLoading: true, error: null });
    try {
      const rows = await fetchBookmarks(userId);
      const ids = new Set(rows.map((r) => r.equity_id));
      // A toggle confirmed AFTER this fetch started is fresher than the
      // snapshot we just fetched, regardless of which one RESOLVED first —
      // keep the confirmed answer for those ids instead of the server's.
      get().confirmed.forEach(({ want, at }, id) => {
        if (at >= startedAt) (want ? ids.add(id) : ids.delete(id));
      });
      set({ bookmarks: rows, bookmarkedIds: ids, isLoading: false, hasLoaded: true });
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Failed to load bookmarks' });
    }
  },

  toggle: async (equityId: number) => {
    const userId = useAuthStore.getState().profile?.id;
    if (!userId) return;

    const want = !get().bookmarkedIds.has(equityId);

    // Optimistic flip — reconciled/rolled back below.
    set((s) => {
      const nextIds = new Set(s.bookmarkedIds);
      want ? nextIds.add(equityId) : nextIds.delete(equityId);
      return {
        bookmarkedIds: nextIds,
        bookmarks: want ? s.bookmarks : s.bookmarks.filter((b) => b.equity_id !== equityId),
      };
    });

    // Record the outcome with a timestamp (never cleared — see `confirmed`
    // doc) and hard-assert final membership, regardless of any load() that
    // resolved (or is still resolving) around the same time.
    const settle = (finalWant: boolean, extra?: Partial<BookmarkState>) =>
      set((s) => {
        const confirmed = new Map(s.confirmed).set(equityId, { want: finalWant, at: Date.now() });
        const nextIds = new Set(s.bookmarkedIds);
        finalWant ? nextIds.add(equityId) : nextIds.delete(equityId);
        return { confirmed, bookmarkedIds: nextIds, ...extra };
      });

    try {
      if (want) {
        const row = await addBookmark(userId, equityId);
        set((s) => ({ bookmarks: [row, ...s.bookmarks.filter((b) => b.equity_id !== equityId)] }));
        settle(true);
      } else {
        await removeBookmark(userId, equityId);
        settle(false);
      }
    } catch (e) {
      // Roll back to the pre-click state.
      settle(!want, { error: e instanceof Error ? e.message : 'Failed to update bookmark' });
    }
  },

  isBookmarked: (equityId: number) => get().bookmarkedIds.has(equityId),

  setPosition: async (equityId: number, entry: PositionEntry) => {
    const userId = useAuthStore.getState().profile?.id;
    if (!userId) return;
    try {
      const row = await apiSetPosition(userId, equityId, entry);
      set((s) => {
        const nextIds = new Set(s.bookmarkedIds);
        nextIds.add(equityId);
        return {
          bookmarkedIds: nextIds,
          bookmarks: [row, ...s.bookmarks.filter((b) => b.equity_id !== equityId)],
        };
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to save position' });
    }
  },

  clearPosition: async (equityId: number) => {
    const userId = useAuthStore.getState().profile?.id;
    if (!userId) return;
    // Optimistic: strip the entry fields on the existing row.
    set((s) => ({
      bookmarks: s.bookmarks.map((b) =>
        b.equity_id === equityId ? { ...b, entry_price: null, entry_date: null, entry_qty: null } : b,
      ),
    }));
    try {
      await apiSetPosition(userId, equityId, { entry_price: null, entry_date: null, entry_qty: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to clear position' });
    }
  },
}));
