import { useState, useEffect } from 'react'
import { fetchActiveIndices, type IndexOption } from '@/services/indexPickerService'
import { useFrameworkStore } from '@/stores/frameworkStore'

interface Props {
  onClose: () => void
}

export default function InstrumentPickerModal({ onClose }: Props) {
  const [indices, setIndices]   = useState<IndexOption[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const { addChartBlock, framework } = useFrameworkStore()

  useEffect(() => {
    fetchActiveIndices().then(data => {
      setIndices(data)
      setLoading(false)
    })
  }, [])

  const activeIds = new Set(
    framework?.blocks.filter(b => b.type === 'chart').map(b => b.catalog_item_id) ?? []
  )

  const filtered = indices.filter(idx =>
    idx.display_name.toLowerCase().includes(search.toLowerCase()) ||
    idx.symbol.toLowerCase().includes(search.toLowerCase())
  )

  function handleSelect(idx: IndexOption) {
    addChartBlock({ symbol: idx.symbol, id: idx.id, type: 'index' })
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', zIndex: 501,
        transform: 'translate(-50%,-50%)',
        width: 420, maxHeight: '70vh',
        background: 'rgba(9,12,16,.98)',
        border: '1px solid rgba(255,255,255,.1)',
        borderRadius: 14,
        boxShadow: '0 24px 64px rgba(0,0,0,.7)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 18px 12px',
          borderBottom: '1px solid rgba(255,255,255,.07)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              Add Index Chart
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>
              Select an index to add as a chart block
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 7, border: 'none',
              background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.4)',
              cursor: 'pointer', fontSize: 13, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 18px', flexShrink: 0 }}>
          <input
            autoFocus
            type="text"
            placeholder="Search indices…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 12px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,.1)',
              background: 'rgba(255,255,255,.04)',
              color: 'rgba(255,255,255,.8)', fontSize: 12,
              outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 10px' }}>
          {loading ? (
            <div style={{
              textAlign: 'center', padding: '32px 0',
              fontSize: 12, color: 'rgba(255,255,255,.25)',
              fontFamily: 'var(--font-mono, monospace)',
            }}>
              loading…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '32px 0',
              fontSize: 12, color: 'rgba(255,255,255,.25)',
            }}>
              No indices found
            </div>
          ) : (
            filtered.map(idx => {
              const alreadyAdded = activeIds.has(`chart:${idx.id}`)
              return (
                <button
                  key={idx.id}
                  onClick={() => !alreadyAdded && handleSelect(idx)}
                  disabled={alreadyAdded}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    border: 'none', background: 'transparent', textAlign: 'left',
                    cursor: alreadyAdded ? 'default' : 'pointer',
                    opacity: alreadyAdded ? 0.4 : 1,
                    transition: 'background .12s',
                  }}
                  onMouseEnter={e => {
                    if (!alreadyAdded)
                      (e.currentTarget as HTMLElement).style.background = 'rgba(124,106,247,.08)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {idx.display_name}
                    </div>
                    <div style={{
                      fontSize: 10, color: 'rgba(255,255,255,.3)',
                      fontFamily: 'var(--font-mono, monospace)', marginTop: 2,
                    }}>
                      {idx.symbol}
                    </div>
                  </div>
                  {alreadyAdded ? (
                    <span style={{
                      fontSize: 10, color: '#7c6af7',
                      fontFamily: 'var(--font-mono, monospace)',
                    }}>
                      ✓ added
                    </span>
                  ) : (
                    <span style={{ fontSize: 18, color: 'rgba(124,106,247,.5)' }}>+</span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
