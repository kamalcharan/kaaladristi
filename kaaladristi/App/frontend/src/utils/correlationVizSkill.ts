export type CorrelationShape = 'ZONE_CONFLUENCE' | 'EVENT_OVERLAP' | 'EVENT_IN_STATE' | 'THRESHOLD_CROSS'

export interface VisualisationOption {
  id:          'grid' | 'timeline' | 'distribution' | 'table'
  label:       string
  icon:        string
  recommended: boolean
}

export function recommendVisualisations(
  shape: CorrelationShape,
  n_instances: number,
  has_duration_variance: boolean,
): VisualisationOption[] {
  const options: VisualisationOption[] = []

  // Grid is rank 1 when n >= 20, otherwise Table is rank 1
  if (n_instances >= 20) {
    options.push({ id: 'grid',         label: 'Instance Grid', icon: '⊞', recommended: true })
    if (shape === 'ZONE_CONFLUENCE' && has_duration_variance) {
      options.push({ id: 'timeline',   label: 'Timeline',      icon: '▬', recommended: false })
    }
    options.push({ id: 'distribution', label: 'Distribution',  icon: '▦', recommended: false })
    options.push({ id: 'table',        label: 'Table',         icon: '☰', recommended: false })
  } else {
    options.push({ id: 'table',        label: 'Table',         icon: '☰', recommended: true })
    options.push({ id: 'grid',         label: 'Instance Grid', icon: '⊞', recommended: false })
    if (shape === 'ZONE_CONFLUENCE' && has_duration_variance) {
      options.push({ id: 'timeline',   label: 'Timeline',      icon: '▬', recommended: false })
    }
    options.push({ id: 'distribution', label: 'Distribution',  icon: '▦', recommended: false })
  }

  return options
}
