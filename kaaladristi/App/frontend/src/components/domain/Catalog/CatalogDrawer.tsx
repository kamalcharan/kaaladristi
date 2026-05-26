import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import IndicatorsSection from './IndicatorsSection'
import WidgetsSection from './WidgetsSection'
import CatalogAstroSection from './CatalogAstroSection'

const TABS = [
  { id: 'indicators',  label: 'Indicators' },
  { id: 'widgets',     label: 'Widgets' },
  { id: 'astro_rules', label: 'Astro Rules' },
] as const

type DrawerTab = typeof TABS[number]['id']

interface CatalogDrawerProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: DrawerTab
}

export default function CatalogDrawer({ isOpen, onClose, initialTab = 'indicators' }: CatalogDrawerProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<DrawerTab>(initialTab)

  function handleFullCatalog() {
    navigate('/catalog')
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 190,
            background: 'transparent',
          }}
        />
      )}

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          right: isOpen ? 0 : -460,
          top: 0,
          bottom: 0,
          width: 440,
          background: 'var(--bg-card, #0d1117)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 200,
          transition: 'right 0.32s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px 0',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <span style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.01em',
            }}>
              Add to Framework
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={handleFullCatalog}
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: '#8b7af8',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 0',
                }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
              >
                Full Catalog →
              </button>
              <button
                onClick={onClose}
                style={{
                  width: 24, height: 24,
                  borderRadius: 5,
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = 'rgba(255,255,255,0.18)'
                  el.style.color = 'var(--text-primary)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = 'var(--border)'
                  el.style.color = 'var(--text-secondary)'
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Tab strip */}
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map(tab => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '7px 14px',
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    border: 'none',
                    borderBottom: isActive ? '2px solid #7c6af7' : '2px solid transparent',
                    background: 'transparent',
                    color: isActive ? '#8b7af8' : 'var(--text-muted)',
                    marginBottom: -1,
                    transition: 'color 0.15s',
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '20px 18px',
        }}>
          {activeTab === 'indicators'  && <IndicatorsSection />}
          {activeTab === 'widgets'     && <WidgetsSection />}
          {activeTab === 'astro_rules' && <CatalogAstroSection />}
        </div>
      </div>
    </>
  )
}
