import { getCatalogItem } from '@/constants/catalogItems'
import { PAID_TIERS } from '@/constants/frameworkConstants'
import { useAuthStore } from '@/stores/authStore'
import { useFrameworkStore } from '@/stores/frameworkStore'

export interface AddResult {
  success: boolean
  reason?: 'unknown_item' | 'tier_gate' | 'already_active'
}

export function useAddToFramework() {
  const { addBlock, addOverlay, isBlockActive, isOverlayActive } = useFrameworkStore()
  const { profile } = useAuthStore()

  function addToFramework(
    catalogItemId: string,
    config?: Record<string, unknown>,
  ): AddResult {
    const item = getCatalogItem(catalogItemId)
    if (!item) return { success: false, reason: 'unknown_item' }

    // Tier gate — callers check reason: 'tier_gate' and render the upgrade prompt
    // profile.tier undefined → treated as 'free' (no paid access)
    if (item.tier_required === 'paid' && !PAID_TIERS.includes(profile?.tier as never)) {
      return { success: false, reason: 'tier_gate' }
    }

    // Already active — idempotent no-op with explicit signal to caller
    const active = item.placement === 'chart_overlay'
      ? isOverlayActive(catalogItemId)
      : isBlockActive(catalogItemId)
    if (active) return { success: false, reason: 'already_active' }

    // Route by placement — never hardcode placement logic in components
    if (item.placement === 'chart_overlay') {
      addOverlay(item)
    } else {
      addBlock(item, config)
    }

    return { success: true }
  }

  return { addToFramework, isBlockActive, isOverlayActive }
}
