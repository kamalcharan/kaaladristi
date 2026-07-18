/**
 * positionStore — Phase 2a positions (stocks you HOLD, vs bookmarks you WATCH).
 *
 * v0 persistence is LOCAL (localStorage, per user) so the whole Thesis-tab
 * position cockpit is usable now without waiting on the server table + endpoint.
 * The shape mirrors the planned `km_user_positions` row, so swapping this for a
 * PostgREST/FastAPI-backed store later is a drop-in (same Position fields, same
 * store API). One position per stock for v0.
 */

import { create } from 'zustand'

export interface Position {
  equityId: number
  entryPrice: number
  entryDate: string   // YYYY-MM-DD
  qty: number | null
  addedAt: string     // ISO
}

interface PositionState {
  userId: string | null
  positions: Record<number, Position>
  load: (userId: string) => void
  upsert: (p: Omit<Position, 'addedAt'>) => void
  remove: (equityId: number) => void
  get: (equityId: number) => Position | null
}

const keyFor = (userId: string) => `kd_positions_${userId}`

function read(userId: string): Record<number, Position> {
  try {
    const raw = localStorage.getItem(keyFor(userId))
    return raw ? (JSON.parse(raw) as Record<number, Position>) : {}
  } catch {
    return {}
  }
}

function write(userId: string, positions: Record<number, Position>): void {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(positions))
  } catch {
    /* quota / private mode — positions stay in-memory for the session */
  }
}

export const usePositionStore = create<PositionState>((set, getState) => ({
  userId: null,
  positions: {},

  load: (userId) => {
    if (getState().userId === userId && Object.keys(getState().positions).length) return
    set({ userId, positions: read(userId) })
  },

  upsert: (p) => {
    const { userId, positions } = getState()
    if (!userId) return
    const next = { ...positions, [p.equityId]: { ...p, addedAt: new Date().toISOString() } }
    write(userId, next)
    set({ positions: next })
  },

  remove: (equityId) => {
    const { userId, positions } = getState()
    if (!userId) return
    const next = { ...positions }
    delete next[equityId]
    write(userId, next)
    set({ positions: next })
  },

  get: (equityId) => getState().positions[equityId] ?? null,
}))
