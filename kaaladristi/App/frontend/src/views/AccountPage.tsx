/**
 * AccountPage — /account
 * Tabs: Profile | Security | Plan & Billing
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, CreditCard, Palette } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { updateProfile, changePassword } from '@/services/auth'
import { fmtDate } from '@/lib/dateUtils'
import { PageHeader, Tabs } from '@/components/ui'
import ThemeSettings from '@/components/domain/ThemeSettings'

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'appearance' | 'security' | 'billing'

// ── Plan helpers ─────────────────────────────────────────────────────────────

const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  trial: 'Trial',
  quarterly: 'Quarterly',
  annual: 'Annual',
  beta: 'Beta',
}

const TIER_FEATURES: Record<string, string[]> = {
  free: [
    'Market overview & dashboards',
    'Nifty 50 chart with basic indicators',
    'Astro calendar (last 7 days)',
    'Community access',
  ],
  trial: [
    'Full dashboard access',
    'All technical indicators',
    'Astro rule engine (read-only)',
    'Visual Pulse for 5 indices',
  ],
  quarterly: [
    'All indicators & scanners',
    'Full astro rule engine with backtesting',
    'Visual Pulse — unlimited indices',
    'Workspace with 10 custom blocks',
  ],
  annual: [
    'Everything, unlimited — all scanners & indicators',
    'Workspace — unlimited blocks & overlays',
    'Priority VaNi AI analysis',
    'Early access to new features',
  ],
  beta: [
    'Full platform access — all features',
    'Beta features & experimental tools',
    'Direct feedback channel',
    'Lifetime access (no expiry)',
  ],
}

function formatDate(iso: string): string {
  return fmtDate(iso.slice(0, 10))
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusMessage({ type, text }: { type: 'success' | 'error'; text: string }) {
  const isSuccess = type === 'success'
  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: '8px',
        fontSize: '13px',
        marginTop: '12px',
        background: isSuccess ? 'var(--bull-bg)' : 'var(--bear-bg)',
        border: `1px solid ${isSuccess ? 'var(--bull-dim)' : 'var(--bear-dim)'}`,
        color: isSuccess ? 'var(--bull)' : 'var(--bear)',
      }}
    >
      {text}
    </div>
  )
}

function FormField({
  label,
  value,
  onChange,
  type = 'text',
  readOnly = false,
  placeholder = '',
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  type?: string
  readOnly?: boolean
  placeholder?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label
        style={{
          fontSize: '11px',
          fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--text-faint)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={type}
          value={value}
          readOnly={readOnly}
          placeholder={placeholder}
          onChange={e => onChange?.(e.target.value)}
          style={{
            width: '100%',
            padding: '9px 12px',
            borderRadius: '8px',
            background: readOnly ? 'transparent' : 'var(--card)',
            border: '1px solid var(--border)',
            color: readOnly ? 'var(--text-faint)' : 'var(--text-primary)',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
            cursor: readOnly ? 'not-allowed' : 'text',
            opacity: readOnly ? 0.6 : 1,
          }}
        />
        {readOnly && (
          <span
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '10px',
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--text-faint)',
              letterSpacing: '0.06em',
            }}
          >
            locked
          </span>
        )}
      </div>
    </div>
  )
}

// ── Profile Tab ───────────────────────────────────────────────────────────────

function ProfileTab() {
  const { profile, refreshProfile } = useAuthStore()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setStatus(null)
    try {
      await updateProfile({ display_name: displayName, phone })
      await refreshProfile()
      setStatus({ type: 'success', text: 'Profile updated successfully.' })
    } catch (err) {
      setStatus({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update profile.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '440px' }}>
      <FormField label="Full Name" value={profile?.full_name ?? ''} readOnly />
      <FormField label="Email" value={profile?.email ?? ''} readOnly />
      <FormField
        label="Display Name"
        value={displayName}
        onChange={setDisplayName}
        placeholder="How you appear in the app"
      />
      <FormField
        label="Phone"
        value={phone}
        onChange={setPhone}
        placeholder="+91 98765 43210"
      />

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          alignSelf: 'flex-start',
          padding: '9px 20px',
          borderRadius: '8px',
          background: 'var(--accent-solid)',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          border: 'none',
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>

      {status && <StatusMessage type={status.type} text={status.text} />}
    </div>
  )
}

// ── Appearance Tab ────────────────────────────────────────────────────────────

function AppearanceTab() {
  return (
    <div
      style={{
        maxWidth: 380,
        padding: '20px',
        borderRadius: '12px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <ThemeSettings />
    </div>
  )
}

// ── Security Tab ──────────────────────────────────────────────────────────────

function SecurityTab() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleChange = async () => {
    if (next !== confirm) {
      setStatus({ type: 'error', text: 'New password and confirmation do not match.' })
      return
    }
    if (next.length < 6) {
      setStatus({ type: 'error', text: 'New password must be at least 6 characters.' })
      return
    }
    setSaving(true)
    setStatus(null)
    try {
      const msg = await changePassword(current, next)
      setStatus({ type: 'success', text: msg })
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      setStatus({ type: 'error', text: err instanceof Error ? err.message : 'Failed to change password.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '440px' }}>
      <FormField
        label="Current Password"
        value={current}
        onChange={setCurrent}
        type="password"
        placeholder="Enter current password"
      />
      <FormField
        label="New Password"
        value={next}
        onChange={setNext}
        type="password"
        placeholder="At least 6 characters"
      />
      <FormField
        label="Confirm New Password"
        value={confirm}
        onChange={setConfirm}
        type="password"
        placeholder="Repeat new password"
      />

      <button
        onClick={handleChange}
        disabled={saving || !current || !next || !confirm}
        style={{
          alignSelf: 'flex-start',
          padding: '9px 20px',
          borderRadius: '8px',
          background: 'var(--accent-solid)',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          border: 'none',
          cursor: saving || !current || !next || !confirm ? 'not-allowed' : 'pointer',
          opacity: saving || !current || !next || !confirm ? 0.5 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {saving ? 'Updating…' : 'Change Password'}
      </button>

      {status && <StatusMessage type={status.type} text={status.text} />}
    </div>
  )
}

// ── Plan & Billing Tab ────────────────────────────────────────────────────────

function BillingTab() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const tier = profile?.tier ?? 'free'
  const tierLabel = TIER_LABELS[tier] ?? tier
  const features = TIER_FEATURES[tier] ?? TIER_FEATURES['free']
  const expiresAt = profile?.expires_at
  const isPaid = tier !== 'free'
  const isBetaOrLifetime = tier === 'beta'

  const days = expiresAt && !isBetaOrLifetime ? daysUntil(expiresAt) : null
  const isExpired = days !== null && days <= 0
  const isNearExpiry = days !== null && days > 0 && days <= 14

  // Tier badge color
  const tierColor =
    tier === 'annual' ? 'var(--gold)' :
    tier === 'beta'   ? 'var(--indigo)' :
    tier === 'quarterly' ? 'var(--bull)' :
    tier === 'trial'  ? 'var(--caution)' :
    'var(--text-faint)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '480px' }}>
      {/* Current plan card */}
      <div
        style={{
          padding: '20px',
          borderRadius: '12px',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--text-faint)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '4px',
              }}
            >
              Current Plan
            </div>
            <div
              style={{
                fontSize: '22px',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                color: tierColor,
              }}
            >
              {tierLabel}
            </div>
          </div>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: `color-mix(in srgb, ${tierColor} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${tierColor} 30%, transparent)`,
              color: tierColor,
            }}
          >
            {tierLabel}
          </span>
        </div>

        {/* Expiry info */}
        {isPaid && (
          <div
            style={{
              fontSize: '13px',
              color: isExpired ? 'var(--bear)' : isNearExpiry ? 'var(--caution)' : 'var(--text-muted)',
              marginBottom: '8px',
            }}
          >
            {isBetaOrLifetime
              ? 'No expiry — lifetime access'
              : expiresAt
              ? isExpired
                ? `Expired on ${formatDate(expiresAt)}`
                : `Valid until ${formatDate(expiresAt)}${isNearExpiry ? ` · ${days} days left` : ''}`
              : 'No expiry date recorded'}
          </div>
        )}

        {/* Expiry warnings */}
        {isExpired && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'var(--bear-bg)',
              border: '1px solid var(--bear-dim)',
              color: 'var(--bear)',
              fontSize: '13px',
              marginBottom: '12px',
            }}
          >
            Your plan has expired. Renew to restore full access.
          </div>
        )}
        {isNearExpiry && !isExpired && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'var(--caution-bg)',
              border: '1px solid var(--caution-dim)',
              color: 'var(--caution)',
              fontSize: '13px',
              marginBottom: '12px',
            }}
          >
            Your plan expires soon. Renew to avoid interruption.
          </div>
        )}

        {/* CTA */}
        {!isPaid && (
          <button
            onClick={() => navigate('/pricing')}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              background: 'var(--accent-solid)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Upgrade Plan
          </button>
        )}
        {isPaid && (isExpired || isNearExpiry) && (
          <button
            onClick={() => navigate('/pricing')}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              background: isExpired ? 'var(--bear)' : 'var(--caution)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {isExpired ? 'Renew Now' : 'Renew'}
          </button>
        )}
      </div>

      {/* Features */}
      <div>
        <div
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--text-faint)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '12px',
          }}
        >
          What's included
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {features.map(f => (
            <li
              key={f}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontSize: '13px',
                color: 'var(--text-muted)',
              }}
            >
              <span style={{ color: 'var(--bull)', flexShrink: 0, marginTop: '1px' }}>✓</span>
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; Icon: typeof User }[] = [
  { id: 'profile',    label: 'Profile',        Icon: User },
  { id: 'appearance', label: 'Appearance',     Icon: Palette },
  { id: 'security',   label: 'Security',       Icon: Lock },
  { id: 'billing',    label: 'Plan & Billing', Icon: CreditCard },
]

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  return (
    <div style={{ minHeight: '100%' }}>
      <PageHeader
        eyebrow="Account"
        title="Account"
        meta="Manage your profile, security, and subscription."
      />
      <div style={{ padding: '32px' }}>
        <div style={{ marginBottom: '32px' }}>
          <Tabs
            tabs={TABS.map(({ id, label, Icon }) => ({
              id,
              label: (
                <span className="flex items-center gap-2">
                  <Icon size={14} />
                  {label}
                </span>
              ),
            }))}
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as Tab)}
          />
        </div>

        {activeTab === 'profile'    && <ProfileTab />}
        {activeTab === 'appearance' && <AppearanceTab />}
        {activeTab === 'security'   && <SecurityTab />}
        {activeTab === 'billing'    && <BillingTab />}
      </div>
    </div>
  )
}
