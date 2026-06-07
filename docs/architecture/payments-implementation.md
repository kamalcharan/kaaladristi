# Payments Implementation Spec
**Status:** Ready to implement  
**Last updated:** June 2026  
**Reference:** Sprint 3 — Pricing/Payments closure

---

## Plan & Price Registry

| Tier | Type | Razorpay ID | Amount | Duration |
|------|------|-------------|--------|----------|
| trial | One-time QR/order | `qr_SwiVP7FJQ64O2G` | ₹199 | 3 days |
| quarterly | Subscription | `plan_SwiRT8DxobH8uv` | ₹1,999 | 90 days auto-renew |
| annual | Subscription | `plan_SwiS7MUxm5MbTj` | ₹4,999 | 365 days auto-renew |

All prices GST-inclusive. GST breakup handled by Razorpay dashboard — no code needed.

---

## Database Changes

### Migration 092 — km_config + subscription_id

```sql
-- km_config table for platform-level key-value config
CREATE TABLE km_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Razorpay plan IDs (test values — swap for production)
INSERT INTO km_config (key, value) VALUES
  ('razorpay_plan_quarterly', 'plan_SwiRT8DxobH8uv'),
  ('razorpay_plan_annual',    'plan_SwiS7MUxm5MbTj'),
  ('razorpay_trial_qr',       'qr_SwiVP7FJQ64O2G'),
  ('price_trial_paise',       '19900'),
  ('price_quarterly_paise',   '199900'),
  ('price_annual_paise',      '499900');

-- Add subscription tracking to user_subscriptions
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id      TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add expires_at to km_profiles for fast lookup (denormalised)
ALTER TABLE km_profiles
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
```

---

## Backend Changes (pipeline2_api.py)

### 1. Load km_config at startup

Add after existing env var reads:

```python
def _load_config() -> dict:
    """Load km_config table into a dict at startup."""
    try:
        conn = _conn(3000)
        with conn.cursor() as cur:
            cur.execute("SELECT key, value FROM km_config")
            rows = cur.fetchall()
        conn.close()
        return {r[0]: r[1] for r in rows}
    except Exception as e:
        log.warning(f"km_config load failed: {e}")
        return {}

_KM_CONFIG: dict = _load_config()
```

### 2. Replace create-order endpoint

Remove existing `POST /api/payments/create-order`.  
Replace with two endpoints:

```python
@app.post('/api/payments/create-subscription')
def payments_create_subscription(
    req: CreateSubscriptionRequest,  # tier: str, user_id: str
    caller_id: str = Depends(_get_current_user_id),
):
    """Creates a Razorpay subscription for quarterly or annual tier."""
    if caller_id != req.user_id:
        raise HTTPException(status_code=403, detail='Forbidden')
    if req.tier not in ('quarterly', 'annual'):
        raise HTTPException(status_code=400, detail='Use create-trial-order for trial tier')
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=503, detail='Payment gateway not configured')

    plan_key = f'razorpay_plan_{req.tier}'
    plan_id  = _KM_CONFIG.get(plan_key)
    if not plan_id:
        raise HTTPException(status_code=503, detail=f'Plan not configured: {plan_key}')

    try:
        import razorpay as _rzp
        client = _rzp.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        sub = client.subscription.create({
            'plan_id':         plan_id,
            'total_count':     12,  # max renewal cycles
            'quantity':        1,
            'notes':           {'tier': req.tier, 'user_id': req.user_id},
        })
        return {'subscription_id': sub['id'], 'tier': req.tier}
    except ImportError:
        raise HTTPException(status_code=503, detail='razorpay SDK not installed')
    except Exception as exc:
        log.error(f'create_subscription error: {exc}')
        raise HTTPException(status_code=500, detail=str(exc))


@app.post('/api/payments/create-trial-order')
def payments_create_trial_order(
    req: CreateOrderRequest,  # user_id: str (tier always = 'trial')
    caller_id: str = Depends(_get_current_user_id),
):
    """Creates a one-time Razorpay order for trial tier."""
    if caller_id != req.user_id:
        raise HTTPException(status_code=403, detail='Forbidden')
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=503, detail='Payment gateway not configured')

    amount = int(_KM_CONFIG.get('price_trial_paise', '19900'))

    try:
        import razorpay as _rzp
        client = _rzp.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        order = client.order.create({
            'amount':   amount,
            'currency': 'INR',
            'notes':    {'tier': 'trial', 'user_id': req.user_id},
        })
        return {'order_id': order['id'], 'amount': order['amount'], 'currency': order['currency']}
    except ImportError:
        raise HTTPException(status_code=503, detail='razorpay SDK not installed')
    except Exception as exc:
        log.error(f'create_trial_order error: {exc}')
        raise HTTPException(status_code=500, detail=str(exc))
```

### 3. Replace verify endpoint with webhook handler

Remove existing `POST /api/payments/verify`.  
Replace with:

```python
@app.post('/api/payments/webhook')
async def payments_webhook(request: Request):
    """
    Handles Razorpay webhook events.
    Events handled:
      - payment.captured         → trial tier activation (one-time order)
      - subscription.charged     → quarterly/annual renewal
      - subscription.halted      → payment failed, downgrade to free
      - subscription.cancelled   → user cancelled, downgrade to free
    
    Webhook secret must be set in Razorpay dashboard and stored as
    RAZORPAY_WEBHOOK_SECRET in .env
    """
    import hmac as _hmac, hashlib as _hashlib

    WEBHOOK_SECRET = os.environ.get('RAZORPAY_WEBHOOK_SECRET', '')
    body_bytes = await request.body()

    # Verify webhook signature
    if WEBHOOK_SECRET:
        sig = request.headers.get('x-razorpay-signature', '')
        expected = _hmac.new(
            WEBHOOK_SECRET.encode(), body_bytes, _hashlib.sha256
        ).hexdigest()
        if not _hmac.compare_digest(expected, sig):
            raise HTTPException(status_code=400, detail='Invalid webhook signature')

    payload = json.loads(body_bytes)
    event   = payload.get('event')
    entity  = payload.get('payload', {})

    try:
        if event == 'payment.captured':
            # Trial one-time order
            payment = entity.get('payment', {}).get('entity', {})
            notes   = payment.get('notes', {})
            tier    = notes.get('tier', 'trial')
            user_id = notes.get('user_id')
            if user_id and tier == 'trial':
                _activate_tier(user_id, tier, days=3, payment_id=payment.get('id'))

        elif event == 'subscription.charged':
            sub     = entity.get('subscription', {}).get('entity', {})
            payment = entity.get('payment', {}).get('entity', {})
            notes   = sub.get('notes', {})
            tier    = notes.get('tier')
            user_id = notes.get('user_id')
            days    = 90 if tier == 'quarterly' else 365
            if user_id and tier:
                _activate_tier(
                    user_id, tier, days=days,
                    subscription_id=sub.get('id'),
                    payment_id=payment.get('id')
                )

        elif event in ('subscription.halted', 'subscription.cancelled'):
            sub     = entity.get('subscription', {}).get('entity', {})
            notes   = sub.get('notes', {})
            user_id = notes.get('user_id')
            if user_id:
                _deactivate_tier(user_id, sub.get('id'))

    except Exception as exc:
        log.error(f'webhook handler error: {event} {exc}')
        # Always return 200 to Razorpay — never let webhook retry loop
    
    return {'ok': True}


def _activate_tier(
    user_id: str, tier: str, days: int,
    subscription_id: str = None, payment_id: str = None
):
    from datetime import timedelta
    expires_at = datetime.utcnow() + timedelta(days=days)
    conn = _conn(5000)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE km_profiles 
                   SET tier = %s, expires_at = %s, updated_at = now() 
                   WHERE id = %s::uuid""",
                (tier, expires_at, user_id)
            )
            cur.execute(
                """INSERT INTO user_subscriptions 
                   (user_id, tier, started_at, expires_at, 
                    razorpay_subscription_id, razorpay_payment_id, status)
                   VALUES (%s::uuid, %s, now(), %s, %s, %s, 'active')""",
                (user_id, tier, expires_at, subscription_id, payment_id)
            )
        conn.commit()
        log.info(f"tier activated: user={user_id} tier={tier} expires={expires_at}")
    finally:
        conn.close()


def _deactivate_tier(user_id: str, subscription_id: str = None):
    conn = _conn(5000)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE km_profiles 
                   SET tier = 'free', expires_at = null, updated_at = now() 
                   WHERE id = %s::uuid""",
                (user_id,)
            )
            if subscription_id:
                cur.execute(
                    """UPDATE user_subscriptions SET status = 'cancelled'
                       WHERE razorpay_subscription_id = %s""",
                    (subscription_id,)
                )
        conn.commit()
        log.info(f"tier deactivated: user={user_id}")
    finally:
        conn.close()
```

### 4. Add RAZORPAY_WEBHOOK_SECRET to .env

```
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_from_razorpay_dashboard
```

Configure webhook URL in Razorpay dashboard:
`https://your-domain/api/payments/webhook`
Events to enable: `payment.captured`, `subscription.charged`, 
`subscription.halted`, `subscription.cancelled`

---

## Frontend Changes (razorpayService.ts)

Replace entire file with:

```typescript
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
```

---

## Frontend Changes (auth.ts — getProfile fix)

In `getProfile()`, after fetching `km_profiles`, add a second query to get latest active subscription:

```typescript
// After fetching profile, get latest subscription expires_at
const subRes = await postgrest
  .from('user_subscriptions')
  .select('expires_at, status')
  .eq('user_id', profile.id)
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(1)
  .single()

if (subRes.data) {
  profile.expires_at = subRes.data.expires_at
}
```

---

## Frontend Changes (InlineGate.tsx)

Replace the "Try for 3 days" button handler:

```typescript
// Trial button
onClick={async () => {
  const profile = useAuthStore.getState().profile
  await startTrialCheckout(
    profile.id,
    { name: profile.full_name, email: profile.email },
    () => {
      // Webhook will activate tier — poll profile until tier changes
      pollProfileUntilUpgraded()
    }
  )
}}

// Quarterly button  
onClick={async () => {
  const profile = useAuthStore.getState().profile
  await startSubscriptionCheckout(
    'quarterly', profile.id,
    { name: profile.full_name, email: profile.email },
    () => pollProfileUntilUpgraded()
  )
}}

// Annual button
onClick={async () => {
  const profile = useAuthStore.getState().profile
  await startSubscriptionCheckout(
    'annual', profile.id,
    { name: profile.full_name, email: profile.email },
    () => pollProfileUntilUpgraded()
  )
}}
```

Add `pollProfileUntilUpgraded()` helper — polls `refreshProfile()` every 2 seconds 
for up to 30 seconds until `profile.tier` changes from `free`. 
Shows "Activating your plan..." spinner during poll.
Redirects to `/workspace` on success.

---

## Implementation Order for Claude Code

1. Run migration 092 (km_config + schema changes)
2. Update `pipeline2_api.py` — add `_load_config()`, replace endpoints, add webhook handler
3. Add `RAZORPAY_WEBHOOK_SECRET` to `.env`
4. Replace `razorpayService.ts`
5. Fix `getProfile()` in `auth.ts`
6. Update `InlineGate.tsx` — new button handlers + poll helper
7. Configure webhook URL in Razorpay dashboard

---

## Testing Checklist

- [ ] Trial: click "Try 3 days" → Razorpay modal opens → pay with test card → 
      webhook fires → tier upgrades to `trial` → gate disappears
- [ ] Quarterly: click "Quarterly" → subscription modal → pay → webhook fires → 
      tier = `quarterly`
- [ ] Annual: same as quarterly
- [ ] Subscription renewal: simulate via Razorpay test dashboard
- [ ] Subscription cancel: tier downgrades to `free`
- [ ] `expires_at` appears correctly in profile after activation
- [ ] Days remaining bar in InlineGate shows correct value

---

## Notes

- Webhook is the single source of truth for tier activation — 
  frontend never directly upgrades tier
- `pollProfileUntilUpgraded()` bridges the async gap between 
  payment success and webhook processing
- Test webhook locally using Razorpay CLI or ngrok
- Swap plan IDs in km_config (not in code) when going to production
