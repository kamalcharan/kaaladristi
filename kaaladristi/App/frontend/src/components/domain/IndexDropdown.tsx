import { useState, useRef, useEffect } from 'react'
import type { UserFramework } from '@/types/framework'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { fetchActiveIndices, type IndexOption } from '@/services/indexPickerService'

function IndexDropdown({
  anchorX, anchorY, framework: fw, onClose,
}: {
  anchorX: number; anchorY: number
  framework: UserFramework
  onClose: () => void
}) {
  const [indices, setIndices] = useState<IndexOption[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const { switchPrimaryIndex } = useFrameworkStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchActiveIndices().then(data => { setIndices(data); setLoading(false) })
  }, [])

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [onClose])

  const activeIds = new Set(
    fw.blocks.filter(b => b.type === 'chart').map(b => b.catalog_item_id)
  )

  const filtered = indices.filter(idx =>
    idx.display_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', top: anchorY + 6, left: anchorX,
        width: 280, maxHeight: 340, zIndex: 600,
        background: 'var(--bg)',
        border: '1px solid rgba(255,255,255,.1)',
        borderRadius: 10,
        boxShadow: '0 12px 40px rgba(0,0,0,.7)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Search */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,.07)', flexShrink: 0 }}>
        <input
          autoFocus
          type="text"
          placeholder="Search indices…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '6px 10px', borderRadius: 6,
            border: '1px solid rgba(255,255,255,.1)',
            background: 'rgba(255,255,255,.04)',
            color: 'rgba(255,255,255,.8)', fontSize: 12,
            outline: 'none', fontFamily: 'inherit',
          }}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {loading ? (
          <div style={{ padding: '20px 0', textAlign: 'center',
            fontSize: 11, color: 'rgba(255,255,255,.25)',
            fontFamily: 'var(--font-mono, monospace)' }}>
            loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center',
            fontSize: 12, color: 'rgba(255,255,255,.2)' }}>
            No results
          </div>
        ) : filtered.map(idx => {
          const added = activeIds.has(`chart:${idx.id}`)
          return (
            <button
              key={idx.id}
              onClick={() => { if (!added) { switchPrimaryIndex({ symbol: idx.symbol, id: idx.id, type: 'index' }); onClose() } }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '7px 12px', border: 'none',
                background: 'transparent', textAlign: 'left', cursor: added ? 'default' : 'pointer',
                opacity: added ? 0.45 : 1,
              }}
              onMouseEnter={e => { if (!added) (e.currentTarget as HTMLElement).style.background = 'var(--accent-glow)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{idx.display_name}</span>
              {added
                ? <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono,monospace)' }}>✓</span>
                : <span style={{ fontSize: 16, color: 'var(--accent-dim)' }}>+</span>
              }
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default IndexDropdown
