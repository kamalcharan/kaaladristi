import {useAuthStore} from '@/stores/authStore'
import {DEFAULT_PERSONA,PERSONAS,PERSONA_CATEGORY_DEFAULTS,recommendedScanners} from '@/constants/personaConfig'
export function useResearchProfile(){
 const profile=useAuthStore(s=>s.profile)
 const persona=profile?.persona??DEFAULT_PERSONA
 return {persona,label:PERSONAS[persona].label,recommended:recommendedScanners(persona),defaults:PERSONA_CATEGORY_DEFAULTS[persona]}
}
