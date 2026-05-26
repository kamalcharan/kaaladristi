import { useState } from 'react'
import MasterFrameworksSection from '@/components/domain/Catalog/MasterFrameworksSection'
import IndicatorsSection from '@/components/domain/Catalog/IndicatorsSection'
import WidgetsSection from '@/components/domain/Catalog/WidgetsSection'
import CatalogAstroSection from '@/components/domain/Catalog/CatalogAstroSection'
import ScannersSection from '@/components/domain/Catalog/ScannersSection'
import DeepDivePanel from '@/components/domain/Catalog/DeepDivePanel'
import CatalogActionIsland from '@/components/domain/Catalog/CatalogActionIsland'
import type { DeepDiveItem } from '@/components/domain/Catalog/DeepDivePanel'

const CATALOG_SECTIONS = [
  { id: 'master_frameworks', label: 'Master Frameworks' },
  { id: 'astro_rules',       label: 'Astro Rules' },
  { id: 'indicators',        label: 'Indicators' },
  { id: 'widgets',           label: 'Widgets' },
  { id: 'scanners',          label: 'Scanners' },
] as const

type CatalogSection = typeof CATALOG_SECTIONS[number]['id']

export default function CatalogPage() {
  const [active, setActive] = useState<CatalogSection>('master_frameworks')
  const [selected, setSelected] = useState<DeepDiveItem | null>(null)

  return (
    <div className="flex-1 flex overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* Left subnav */}
      <div
        style={{
          width: 200,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          padding: '24px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-faint)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            paddingLeft: 10,
            marginBottom: 10,
          }}
        >
          Catalog
        </div>

        {CATALOG_SECTIONS.map(section => {
          const isActive = active === section.id
          return (
            <button
              key={section.id}
              onClick={() => { setActive(section.id); setSelected(null) }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
                background: isActive ? 'var(--gold-bg)' : 'transparent',
                color: isActive ? 'var(--gold-soft)' : 'var(--text-muted)',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
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
              {section.label}
            </button>
          )
        })}
      </div>

      {/* Right content area */}
      <div className="flex-1 overflow-auto" style={{ padding: 32 }}>
        {active === 'master_frameworks' && <MasterFrameworksSection />}
        {active === 'astro_rules'       && <CatalogAstroSection onSelect={setSelected} />}
        {active === 'indicators'        && <IndicatorsSection onSelect={setSelected} />}
        {active === 'widgets'           && <WidgetsSection    onSelect={setSelected} />}
        {active === 'scanners'          && <ScannersSection />}
      </div>

      {/* Deep dive panel — fixed slide-in, rendered at page level */}
      <DeepDivePanel item={selected} onClose={() => setSelected(null)} />

      {/* Floating action island — appears once items are in the framework */}
      <CatalogActionIsland />

    </div>
  )
}
