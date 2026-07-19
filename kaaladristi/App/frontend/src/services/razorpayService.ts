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

// Identifiers from the Razorpay handler response, threaded to onSuccess so a
// timed-out poll can hand them to /api/payments/reconcile.
export interface CheckoutRefs {
  order_id?:        string
  subscription_id?: string
  payment_id?:      string
}

export type ReconcileStatus = 'activated' | 'already_active' | 'pending'

/** Ask the server to verify the payment directly with Razorpay and activate
 *  the tier if money was captured. Used when the post-checkout poll times out
 *  (webhook slow/missed). Server never trusts the client for the payment fact. */
export async function reconcilePayment(
  user_id: string,
  refs: CheckoutRefs,
): Promise<{ status: ReconcileStatus; tier: string | null }> {
  const res = await fetch(`${PIPELINE_URL}/api/payments/reconcile`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body:    JSON.stringify({
      user_id,
      order_id:        refs.order_id,
      subscription_id: refs.subscription_id,
    }),
  })
  if (!res.ok) throw new Error(`Reconcile failed: ${await res.text()}`)
  return res.json()
}

// ── One-time order checkout (trial + annual — no subscriptions) ─────

type OrderTier = 'trial' | 'annual'

const ORDER_DESC: Record<OrderTier, string> = {
  trial:  'Trial — 14 days full access',
  annual: 'Annual — 1 year full access',
}

export async function startOrderCheckout(
  tier: OrderTier,
  user_id: string,
  user: UserInfo,
  onSuccess: (refs: CheckoutRefs) => void,
  onDismiss?: () => void,
): Promise<void> {
  const res = await fetch(`${PIPELINE_URL}/api/payments/create-order`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body:    JSON.stringify({ user_id, tier }),
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
    description: ORDER_DESC[tier],
    prefill:     { name: user.name ?? '', email: user.email ?? '' },
    theme:       { color: '#8b5cf6' },
    handler(resp: any) {
      onSuccess({ order_id: order.order_id, payment_id: resp?.razorpay_payment_id })
    },
    modal:       { ondismiss() { onDismiss?.() } },
  })
  rzp.open()
}

/** @deprecated use startOrderCheckout('trial', …) */
export const startTrialCheckout = (
  user_id: string, user: UserInfo,
  onSuccess: (refs: CheckoutRefs) => void, onDismiss?: () => void,
) => startOrderCheckout('trial', user_id, user, onSuccess, onDismiss)
