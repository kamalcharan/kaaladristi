/**
 * adminUsers — Users admin page service (migration 140)
 * ======================================================
 * All calls hit /api/admin/users/* on the pipeline API with the caller's
 * JWT; the backend re-checks the caller's PROFILE role in the DB, so the
 * frontend gate is presentation only.
 */

import { useAuthStore } from '@/stores/authStore'

const PIPELINE_URL = (import.meta.env.VITE_PIPELINE_API_URL as string) || ''

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const ADMIN_TIERS = ['free', 'trial', 'quarterly', 'annual', 'beta'] as const
export type AdminTier = (typeof ADMIN_TIERS)[number]

export interface AdminUser {
  id: string
  email: string
  created_at: string
  display_name: string | null
  full_name: string | null
  role: 'user' | 'admin' | null
  tier: AdminTier | null
  onboarded: boolean | null
  is_suspended: boolean
  sub_tier: AdminTier | null
  sub_started_at: string | null
  sub_expires_at: string | null
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PIPELINE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { msg = (await res.json()).detail ?? msg } catch { /* keep status */ }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const data = await req<{ users: AdminUser[] }>('/api/admin/users')
  return Array.isArray(data.users) ? data.users : []
}

export function suspendUser(userId: string, suspended: boolean) {
  return req(`/api/admin/users/${userId}/suspend`, {
    method: 'POST', body: JSON.stringify({ suspended }),
  })
}

export function reassignPlan(userId: string, tier: AdminTier, expiresAt: string | null) {
  return req(`/api/admin/users/${userId}/plan`, {
    method: 'POST', body: JSON.stringify({ tier, expires_at: expiresAt }),
  })
}

export function extendSubscription(userId: string, expiresAt: string) {
  return req(`/api/admin/users/${userId}/extend`, {
    method: 'POST', body: JSON.stringify({ expires_at: expiresAt }),
  })
}

export function deleteUser(userId: string, confirmEmail: string) {
  return req(`/api/admin/users/${userId}/delete`, {
    method: 'POST', body: JSON.stringify({ confirm_email: confirmEmail }),
  })
}
