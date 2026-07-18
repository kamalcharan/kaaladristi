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
  isLoading: false,
  error: null,
  hasLoaded: false,

  load: async () => {
    const userId = useAuthStore.getState().profile?.id;
    if (!userId) return;
    set({ isLoading: true, error: null });
    try {
      const rows = await fetchBookmarks(userId);
      set({
        bookmarks: rows,
        bookmarkedIds: new Set(rows.map((r) => r.equity_id)),
        isLoading: false,
        hasLoaded: true,
      });
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Failed to load bookmarks' });
    }
  },

  toggle: async (equityId: number) => {
    const userId = useAuthStore.getState().profile?.id;
    if (!userId) return;

    const wasBookmarked = get().bookmarkedIds.has(equityId);

    // Optimistic update — icon flips immediately, reconciled/rolled back below.
    set((s) => {
      const nextIds = new Set(s.bookmarkedIds);
      if (wasBookmarked) nextIds.delete(equityId);
      else nextIds.add(equityId);
      return {
        bookmarkedIds: nextIds,
        bookmarks: wasBookmarked
          ? s.bookmarks.filter((b) => b.equity_id !== equityId)
          : s.bookmarks,
      };
    });

    try {
      if (wasBookmarked) {
        await removeBookmark(userId, equityId);
      } else {
        const row = await addBookmark(userId, equityId);
        set((s) => ({ bookmarks: [row, ...s.bookmarks.filter((b) => b.equity_id !== equityId)] }));
      }
    } catch (e) {
      // Roll back the optimistic flip on failure.
      set((s) => {
        const nextIds = new Set(s.bookmarkedIds);
        if (wasBookmarked) nextIds.add(equityId);
        else nextIds.delete(equityId);
        return { bookmarkedIds: nextIds, error: e instanceof Error ? e.message : 'Failed to update bookmark' };
      });
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
