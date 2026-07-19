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
  /** In-flight toggle intentions (equityId → desired membership). Lets a
   *  concurrent load() reconcile without clobbering an optimistic toggle. */
  optimistic: Map<number, boolean>;
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
  optimistic: new Map(),
  isLoading: false,
  error: null,
  hasLoaded: false,

  load: async () => {
    const userId = useAuthStore.getState().profile?.id;
    if (!userId) return;
    if (get().isLoading) return; // dedupe the ~N concurrent calls from N toggle mounts
    set({ isLoading: true, error: null });
    try {
      const rows = await fetchBookmarks(userId);
      const ids = new Set(rows.map((r) => r.equity_id));
      // Re-apply any in-flight optimistic toggles so a late load() doesn't
      // clobber a bookmark the user just clicked (the reset-on-first-click bug).
      get().optimistic.forEach((want, id) => (want ? ids.add(id) : ids.delete(id)));
      set({ bookmarks: rows, bookmarkedIds: ids, isLoading: false, hasLoaded: true });
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Failed to load bookmarks' });
    }
  },

  toggle: async (equityId: number) => {
    const userId = useAuthStore.getState().profile?.id;
    if (!userId) return;

    const want = !get().bookmarkedIds.has(equityId);

    // Optimistic flip + record the intention (survives a concurrent load()).
    set((s) => {
      const nextIds = new Set(s.bookmarkedIds);
      want ? nextIds.add(equityId) : nextIds.delete(equityId);
      const opt = new Map(s.optimistic).set(equityId, want);
      return {
        bookmarkedIds: nextIds,
        optimistic: opt,
        bookmarks: want ? s.bookmarks : s.bookmarks.filter((b) => b.equity_id !== equityId),
      };
    });

    // Clear this id's intention and hard-assert final membership (guards against
    // any load() that resolved in between).
    const settle = (finalWant: boolean, extra?: Partial<BookmarkState>) =>
      set((s) => {
        const opt = new Map(s.optimistic);
        opt.delete(equityId);
        const nextIds = new Set(s.bookmarkedIds);
        finalWant ? nextIds.add(equityId) : nextIds.delete(equityId);
        return { optimistic: opt, bookmarkedIds: nextIds, ...extra };
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
