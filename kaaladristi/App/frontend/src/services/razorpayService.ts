import { useAuthStore } from '@/stores/authStore'

const PIPELINE_URL = (import.meta.env.VITE_PIPELINE_API_URL as string) || ''
const RAZORPAY_KEY_ID = (import.meta.env.VITE_RAZORPAY_KEY_ID as string) || ''

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Load Razorpay checkout.js once
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as Record<string, unknown>)['Razorpay']) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'))
    document.head.appendChild(script)
  })
}

export interface RazorpayOrder {
  order_id: string
  amount:   number   // paise
  currency: string
}

export async function createOrder(tier: string, user_id: string): Promise<RazorpayOrder> {
  const res = await fetch(`${PIPELINE_URL}/api/payments/create-order`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body:    JSON.stringify({ tier, user_id }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Order creation failed: ${err}`)
  }
  return res.json()
}

export interface UserInfo {
  name?:  string | null
  email?: string | null
  phone?: string | null
}

export async function openCheckout(
  order: RazorpayOrder,
  user: UserInfo,
  onSuccess: (paymentId: string, orderId: string, signature: string) => void,
  onDismiss?: () => void,
): Promise<void> {
  await loadRazorpayScript()

  const RazorpayConstructor = (window as unknown as Record<string, unknown>)['Razorpay'] as new (opts: unknown) => { open(): void }

  const rzp = new RazorpayConstructor({
    key:         RAZORPAY_KEY_ID,
    order_id:    order.order_id,
    amount:      order.amount,
    currency:    order.currency,
    name:        'Kāla-Drishti',
    description: 'Market Intelligence Platform',
    prefill: {
      name:    user.name  ?? '',
      email:   user.email ?? '',
      contact: user.phone ?? '',
    },
    theme: { color: '#8b5cf6' },
    handler(response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) {
      onSuccess(response.razorpay_payment_id, response.razorpay_order_id, response.razorpay_signature)
    },
    modal: {
      ondismiss() { onDismiss?.() },
    },
  })
  rzp.open()
}

export async function verifyPayment(
  razorpay_payment_id: string,
  razorpay_order_id:   string,
  razorpay_signature:  string,
): Promise<{ tier: string }> {
  const res = await fetch(`${PIPELINE_URL}/api/payments/verify`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body:    JSON.stringify({ razorpay_payment_id, razorpay_order_id, razorpay_signature }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Payment verification failed: ${err}`)
  }
  return res.json()
}
