import { PageHeader } from '@/components/ui';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import MyBookmarksPanel from '@/components/domain/MyBookmarksPanel';

/**
 * Deep-link route for My Bookmarks (/bookmarks). The primary entry point is
 * the "My Bookmarks" tab on the Workspace page — this route reuses the same
 * MyBookmarksPanel content for direct navigation / sharable links.
 */
export default function MyBookmarksPage() {
  const { bookmarks } = useBookmarkStore();

  return (
    <div>
      <PageHeader
        eyebrow="Personal"
        title="My"
        titleEm="Bookmarks"
        meta={`${bookmarks.length} saved stock${bookmarks.length !== 1 ? 's' : ''}`}
      />
      <div className="p-6">
        <MyBookmarksPanel />
      </div>
    </div>
  );
}
