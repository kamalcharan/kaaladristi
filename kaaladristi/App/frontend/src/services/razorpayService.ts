import { useAuthStore } from '@/stores/authStore'

const PIPELINE_URL = (import.meta.env.VITE_PIPELINE_API_URL as string) || ''
const RAZORPAY_KEY_ID = (import.meta.env.VITE_RAZORPAY_KEY_ID as string) || ''

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any)['Razorpay']) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Razorpay'))
    document.head.appendChild(script)
  })
}

export interface UserInfo {
  name?:  string | null
  email?: string | null
  phone?: string | null
}

// ── Trial (one-time order) ──────────────────────────────────────────

export async function startTrialCheckout(
  user_id: string,
  user: UserInfo,
  onSuccess: () => void,
  onDismiss?: () => void,
): Promise<void> {
  const res = await fetch(`${PIPELINE_URL}/api/payments/create-trial-order`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body:    JSON.stringify({ user_id }),
  })
  if (!res.ok) throw new Error(`Order creation failed: ${await res.text()}`)
  const order = await res.json()

  await loadRazorpayScript()
  const RzpCtor = (window as any)['Razorpay'] as new (o: any) => { open(): void }
  const rzp = new RzpCtor({
    key:         RAZORPAY_KEY_ID,
    order_id:    order.order_id,
    amount:      order.amount,
    currency:    order.currency,
    name:        'DristiQ',
    description: 'Trial — 3 days full access',
    prefill:     { name: user.name ?? '', email: user.email ?? '' },
    theme:       { color: '#8b5cf6' },
    handler()   { onSuccess() },
    modal:       { ondismiss() { onDismiss?.() } },
  })
  rzp.open()
}

// ── Quarterly / Annual (subscription) ──────────────────────────────

export async function startSubscriptionCheckout(
  tier: 'quarterly' | 'annual',
  user_id: string,
  user: UserInfo,
  onSuccess: () => void,
  onDismiss?: () => void,
): Promise<void> {
  const res = await fetch(`${PIPELINE_URL}/api/payments/create-subscription`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body:    JSON.stringify({ tier, user_id }),
  })
  if (!res.ok) throw new Error(`Subscription creation failed: ${await res.text()}`)
  const { subscription_id } = await res.json()

  await loadRazorpayScript()
  const RzpCtor = (window as any)['Razorpay'] as new (o: any) => { open(): void }
  const rzp = new RzpCtor({
    key:             RAZORPAY_KEY_ID,
    subscription_id: subscription_id,
    name:            'DristiQ',
    description:     tier === 'quarterly' ? 'Quarterly — ₹1,999 / 90 days' : 'Annual — ₹4,999 / year',
    prefill:         { name: user.name ?? '', email: user.email ?? '' },
    theme:           { color: '#8b5cf6' },
    handler()        { onSuccess() },
    modal:           { ondismiss() { onDismiss?.() } },
  })
  rzp.open()
}
