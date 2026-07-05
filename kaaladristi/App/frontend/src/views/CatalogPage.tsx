import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import IndicatorsSection from '@/components/domain/Catalog/IndicatorsSection'
import WidgetsSection from '@/components/domain/Catalog/WidgetsSection'
import ScannersSection from '@/components/domain/Catalog/ScannersSection'
import CatalogAstroSection from '@/components/domain/Catalog/CatalogAstroSection'
import DeepDivePanel from '@/components/domain/Catalog/DeepDivePanel'
import CatalogActionIsland from '@/components/domain/Catalog/CatalogActionIsland'
import type { DeepDiveItem } from '@/components/domain/Catalog/DeepDivePanel'

const CATALOG_SECTIONS = [
  // 'master_frameworks' removed pre-launch (was a comingSoon dead tab) —
  // returns post-launch as a real template gallery backed by FRAMEWORK_TEMPLATES.
  { id: 'astro_rules',       label: 'Astro Rules',       comingSoon: false },
  { id: 'indicators',        label: 'Chart Indicators',  comingSoon: false },
  { id: 'widgets',           label: 'Intelligence Widgets', comingSoon: false },
  { id: 'scanners',          label: 'Scanners',          comingSoon: false },
] as const

type CatalogSection = typeof CATALOG_SECTIONS[number]['id']

const SUBNAV_COLLAPSED_KEY = 'catalog_subnav_collapsed'

export default function CatalogPage() {
  const [active, setActive]     = useState<CatalogSection>('astro_rules')
  const [selected, setSelected] = useState<DeepDiveItem | null>(null)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SUBNAV_COLLAPSED_KEY) === 'true' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem(SUBNAV_COLLAPSED_KEY, String(collapsed)) } catch {}
  }, [collapsed])

  return (
    <div className="flex-1 flex overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* Left subnav */}
      <div
        style={{
          width: collapsed ? 44 : 200,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          padding: collapsed ? '24px 6px' : '24px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          transition: 'width 0.2s ease',
          overflow: 'hidden',
        }}
      >
        {/* Header row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          marginBottom: 10,
          minWidth: 0,
        }}>
          {!collapsed && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-faint)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              paddingLeft: 10,
            }}>
              Catalog
            </span>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-faint)',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {CATALOG_SECTIONS.map(section => {
          const isActive = active === section.id
          return (
            <button
              key={section.id}
              onClick={() => { setActive(section.id); setSelected(null) }}
              title={collapsed ? section.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                textAlign: 'left',
                padding: collapsed ? '8px 10px' : '8px 10px',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
                borderLeft: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                background: isActive ? 'var(--gold-bg)' : 'transparent',
                color: isActive ? 'var(--gold-soft)' : 'var(--text-muted)',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
                }
              }}
            >
              {!collapsed && (
                <>
                  {section.label}
                  {section.comingSoon && (
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: 9,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-faint)',
                      letterSpacing: '0.06em',
                      background: 'rgba(255,255,255,0.04)',
                      padding: '1px 5px',
                      borderRadius: 3,
                      flexShrink: 0,
                    }}>
                      soon
                    </span>
                  )}
                </>
              )}
              {collapsed && (
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'inherit' }}>
                  {section.label.slice(0, 2).toUpperCase()}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Right content area */}
      <div className="flex-1 overflow-auto" style={{ padding: 32 }}>
        {active === 'astro_rules'    && <CatalogAstroSection onSelect={setSelected} />}
        {active === 'indicators'     && <IndicatorsSection   onSelect={setSelected} />}
        {active === 'widgets'        && <WidgetsSection      onSelect={setSelected} />}
        {active === 'scanners'       && <ScannersSection />}
      </div>

      {/* Deep dive panel — fixed slide-in, rendered at page level */}
      <DeepDivePanel item={selected} onClose={() => setSelected(null)} />

      {/* Floating action island — appears once items are in the framework */}
      <CatalogActionIsland />

    </div>
  )
}
