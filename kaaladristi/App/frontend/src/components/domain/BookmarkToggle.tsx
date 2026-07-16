import { useEffect } from 'react';
import { Star } from 'lucide-react';
import { useBookmarkStore } from '@/stores/bookmarkStore';

/** ☆/★ toggle for a single equity — shared between scanner rows/cards and the equity chart page. */
export default function BookmarkToggle({
  equityId,
  size = 14,
  className,
  style,
}: {
  equityId: number;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { bookmarkedIds, hasLoaded, load, toggle } = useBookmarkStore();

  useEffect(() => {
    if (!hasLoaded) load();
  }, [hasLoaded, load]);

  const active = bookmarkedIds.has(equityId);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggle(equityId);
      }}
      title={active ? 'Remove bookmark' : 'Add bookmark'}
      className={className}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, background: 'transparent', border: 'none', padding: 0,
        cursor: 'pointer', lineHeight: 0,
        ...style,
      }}
    >
      <Star
        width={size}
        height={size}
        style={{ color: active ? 'var(--gold)' : 'var(--text-faint)', fill: active ? 'var(--gold)' : 'none' }}
      />
    </button>
  );
}
