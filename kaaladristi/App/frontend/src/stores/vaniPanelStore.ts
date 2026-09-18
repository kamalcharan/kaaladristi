import { create } from 'zustand'
import {
  VANI_PANEL_DEFAULT,
  VANI_PANEL_STORAGE_KEY,
  isVaNiPanelMode,
  type VaNiPanelMode,
} from '@/constants/vaniPanel'

// localStorage throws in a private window with site data blocked, and the QA
// harness renders with storage stubbed — a companion that cannot read its
// preference must still render, on the default.
function readMode(): VaNiPanelMode {
  try {
    const stored = localStorage.getItem(VANI_PANEL_STORAGE_KEY)
    return isVaNiPanelMode(stored) ? stored : VANI_PANEL_DEFAULT
  } catch {
    return VANI_PANEL_DEFAULT
  }
}

function writeMode(mode: VaNiPanelMode): void {
  try {
    localStorage.setItem(VANI_PANEL_STORAGE_KEY, mode)
  } catch {
    /* preference is session-only when storage is unavailable */
  }
}

interface VaNiPanelState {
  mode: VaNiPanelMode
  setMode: (mode: VaNiPanelMode) => void
  toggle: () => void
}

export const useVaNiPanelStore = create<VaNiPanelState>((set, get) => ({
  mode: readMode(),
  setMode: (mode) => { writeMode(mode); set({ mode }) },
  toggle: () => get().setMode(get().mode === 'open' ? 'closed' : 'open'),
}))

/**
 * The single predicate for "is the companion showing". Never compare `mode` to
 * a string at a call site — the same reason `isBlockActive()` exists rather
 * than every component reading `blocks[]`.
 */
export const useVaNiPanelOpen = (): boolean =>
  useVaNiPanelStore(state => state.mode === 'open')
