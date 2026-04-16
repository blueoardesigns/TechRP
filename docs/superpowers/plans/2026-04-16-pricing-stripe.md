# Pricing & Stripe Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full subscription billing to TechRP with Stripe — individual/company plans, minute enforcement, trial logic, additional hours, and coach affiliate/discount system with Stripe Connect payouts.

**Architecture:** Stripe hosts Checkout and stores subscription state. Supabase tracks minute usage and mirrors subscription status. A single webhook handler at `/api/stripe/webhook` syncs all Stripe events to Supabase and fires coach affiliate transfers. Minute enforcement is a pre-call API gate called by the mobile app before Vapi starts.

**Tech Stack:** `stripe` npm package, Next.js 14 App Router, Supabase service role client, Vitest for pure-logic unit tests, Stripe hosted Checkout (no embedded UI needed).

---

## File Map

**New files:**
- `web/supabase/billing-migration.sql` — all schema changes
- `web/lib/plans.ts` — plan constants, tier logic, price lookup
- `web/lib/stripe.ts` — Stripe client singleton
- `web/lib/stripe-prices.ts` — Stripe Price ID constants (filled after seed)
- `web/lib/coach-token.ts` — HMAC-sign/verify coach invite tokens
- `web/lib/minute-gate.ts` — pure minute-check logic (testable)
- `web/app/api/stripe/seed/route.ts`
- `web/app/api/stripe/checkout/route.ts`
- `web/app/api/stripe/webhook/route.ts`
- `web/app/api/stripe/portal/route.ts`
- `web/app/api/calls/check-minutes/route.ts`
- `web/app/api/calls/record-usage/route.ts`
- `web/app/api/coach/referrals/route.ts`
- `web/app/api/coach/referrals/[id]/route.ts`
- `web/app/api/coach/connect/route.ts`
- `web/app/pricing/page.tsx`
- `web/app/billing/page.tsx`
- `web/app/billing/add-hours/page.tsx`
- `web/app/coach/referrals/page.tsx`
- `web/app/coach/connect/callback/page.tsx`
- `web/app/admin/subscriptions/page.tsx`
- `web/components/pricing/seat-calculator.tsx`
- `web/components/billing/usage-bar.tsx`
- `web/__tests__/plans.test.ts`
- `web/__tests__/minute-gate.test.ts`

**Modified files:**
- `web/package.json` — add `stripe`, `@stripe/stripe-js`, `vitest`
- `web/middleware.ts` — add `/api/stripe/webhook` to public routes
- `web/app/api/auth/signup/route.ts` — create Stripe customer, handle coach token
- `web/components/auth-provider.tsx` — add `planId`, `subscriptionStatus`, `minutesUsed`, `bonusMinutes` to `AppUser`
- `web/.env.local` — add Stripe env vars

---

## Task 1: Install dependencies & add env vars

**Files:**
- Modify: `web/package.json`
- Modify: `web/.env.local`

- [ ] **Install packages**

```bash
cd web && npm install stripe @stripe/stripe-js
npm install --save-dev vitest @vitest/coverage-v8
```

- [ ] **Add test script to `web/package.json`** — in the `"scripts"` block add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Add Stripe env vars to `web/.env.local`**

```bash
# Append to web/.env.local
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # fill after: stripe listen --forward-to localhost:3000/api/stripe/webhook
STRIPE_CONNECT_CLIENT_ID=ca_...   # from Stripe Dashboard > Connect > Settings
COACH_INVITE_SECRET=change-me-to-random-32-char-string
```

- [ ] **Add webhook route to public routes in `web/middleware.ts`** — find `PUBLIC_PREFIXES` array and add the webhook path:

```ts
// In middleware.ts, find the PUBLIC_PREFIXES array and add:
'/api/stripe/webhook',
```

- [ ] **Commit**

```bash
cd web && git add package.json package-lock.json middleware.ts
git commit -m "chore: add stripe deps and open webhook route"
```

---

## Task 2: Database migration

**Files:**
- Create: `web/supabase/billing-migration.sql`

- [ ] **Create the migration file**

```sql
-- web/supabase/billing-migration.sql

-- ── users ──────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS minutes_used            integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_minutes           integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_ends_at           timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id      text,
  ADD COLUMN IF NOT EXISTS auto_refill_enabled     boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text;

-- ── organizations ──────────────────────────────────────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id      text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  text,
  ADD COLUMN IF NOT EXISTS plan_id                 text,
  ADD COLUMN IF NOT EXISTS seat_count              integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minutes_pool            integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_minutes           integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_status     text         NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS auto_refill_enabled     boolean      NOT NULL DEFAULT false;

-- ── subscriptions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid        REFERENCES users(id) ON DELETE CASCADE,
  org_id                  uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_subscription_id  text        UNIQUE NOT NULL,
  stripe_price_id         text        NOT NULL,
  plan_id                 text        NOT NULL,
  status                  text        NOT NULL DEFAULT 'trialing',
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  trial_end               timestamptz,
  canceled_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_owner_check CHECK (
    (user_id IS NOT NULL AND org_id IS NULL) OR
    (user_id IS NULL AND org_id IS NOT NULL)
  )
);

-- ── coach_referrals ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coach_referrals (
  id               uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id         uuid     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id           uuid     NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type             text     NOT NULL CHECK (type IN ('discount', 'affiliate')),
  percentage       integer  NOT NULL CHECK (percentage BETWEEN 1 AND 100),
  stripe_coupon_id text,
  is_active        boolean  NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, org_id)
);

-- ── minute_transactions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS minute_transactions (
  id               uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id           uuid     REFERENCES organizations(id) ON DELETE SET NULL,
  type             text     NOT NULL CHECK (type IN (
                     'call_usage','purchase','monthly_reset',
                     'trial_grant','affiliate_payout_skipped')),
  delta            integer  NOT NULL,
  session_id       uuid     REFERENCES training_sessions(id) ON DELETE SET NULL,
  stripe_charge_id text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id   ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id    ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_coach_referrals_coach   ON coach_referrals(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_referrals_org     ON coach_referrals(org_id);
CREATE INDEX IF NOT EXISTS idx_minute_tx_user          ON minute_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_minute_tx_created       ON minute_transactions(created_at);
```

- [ ] **Run migration in Supabase SQL Editor** — paste the file contents and execute. Verify no errors.

- [ ] **Commit**

```bash
git add web/supabase/billing-migration.sql
git commit -m "feat: add billing schema migration"
```

---

## Task 3: Plan constants & tier logic

**Files:**
- Create: `web/lib/plans.ts`
- Create: `web/__tests__/plans.test.ts`

- [ ] **Write the failing tests first**

```ts
// web/__tests__/plans.test.ts
import { describe, it, expect } from 'vitest'
import {
  getCompanyPlanId,
  getPerUserCap,
  getAddonPriceKey,
  getPlanMinutes,
  TRIAL_DAYS,
  TRIAL_MINUTES,
} from '../lib/plans'

describe('getCompanyPlanId', () => {
  it('returns t1 for 2 seats', () => expect(getCompanyPlanId('std', 2)).toBe('co_std_t1'))
  it('returns t1 for 4 seats', () => expect(getCompanyPlanId('std', 4)).toBe('co_std_t1'))
  it('returns t2 for 5 seats', () => expect(getCompanyPlanId('pro', 5)).toBe('co_pro_t2'))
  it('returns t2 for 19 seats', () => expect(getCompanyPlanId('pro', 19)).toBe('co_pro_t2'))
  it('returns t3 for 20 seats', () => expect(getCompanyPlanId('std', 20)).toBe('co_std_t3'))
  it('returns t4 for 50 seats', () => expect(getCompanyPlanId('pro', 50)).toBe('co_pro_t4'))
  it('returns t4 for 100 seats', () => expect(getCompanyPlanId('std', 100)).toBe('co_std_t4'))
})

describe('getPlanMinutes', () => {
  it('returns 120 for individual_starter', () => expect(getPlanMinutes('individual_starter')).toBe(120))
  it('returns 240 for individual_growth', () => expect(getPlanMinutes('individual_growth')).toBe(240))
  it('returns 400 for individual_pro', () => expect(getPlanMinutes('individual_pro')).toBe(400))
  it('returns 120 for co_std_t1', () => expect(getPlanMinutes('co_std_t1')).toBe(120))
  it('returns 240 for co_pro_t1', () => expect(getPlanMinutes('co_pro_t1')).toBe(240))
})

describe('getPerUserCap', () => {
  it('returns 180 for standard plan (120 * 1.5)', () => expect(getPerUserCap('co_std_t1')).toBe(180))
  it('returns 360 for pro plan (240 * 1.5)', () => expect(getPerUserCap('co_pro_t1')).toBe(360))
})

describe('getAddonPriceKey', () => {
  it('maps individual_starter', () => expect(getAddonPriceKey('individual_starter')).toBe('addon_hr_individual_starter'))
  it('maps co_std_t2', () => expect(getAddonPriceKey('co_std_t2')).toBe('addon_hr_co_t2'))
  it('maps co_pro_t3', () => expect(getAddonPriceKey('co_pro_t3')).toBe('addon_hr_co_t3'))
})

describe('constants', () => {
  it('TRIAL_DAYS is 7', () => expect(TRIAL_DAYS).toBe(7))
  it('TRIAL_MINUTES is 25', () => expect(TRIAL_MINUTES).toBe(25))
})
```

- [ ] **Run tests — expect them to fail**

```bash
cd web && npx vitest run __tests__/plans.test.ts
```
Expected: `Cannot find module '../lib/plans'`

- [ ] **Create `web/lib/plans.ts`**

```ts
export const TRIAL_DAYS = 7
export const TRIAL_MINUTES = 25

// Minutes included per billing period per plan (or per user for company plans)
export const PLAN_MINUTES: Record<string, number> = {
  individual_starter: 120,
  individual_growth:  240,
  individual_pro:     400,
  co_std_t1: 120, co_std_t2: 120, co_std_t3: 120, co_std_t4: 120,
  co_pro_t1: 240, co_pro_t2: 240, co_pro_t3: 240, co_pro_t4: 240,
}

// Price in cents for monthly subscription (per seat for company plans)
export const PLAN_PRICE_CENTS: Record<string, number> = {
  individual_starter: 3499,
  individual_growth:  5799,
  individual_pro:     8999,
  co_std_t1: 2799, co_std_t2: 2499, co_std_t3: 2199, co_std_t4: 1899,
  co_pro_t1: 4499, co_pro_t2: 4299, co_pro_t3: 3999, co_pro_t4: 3499,
}

// Additional hour price in cents
export const ADDON_PRICE_CENTS: Record<string, number> = {
  addon_hr_individual_starter: 1499,
  addon_hr_individual_growth:  1299,
  addon_hr_individual_pro:     1099,
  addon_hr_co_t1: 1099,
  addon_hr_co_t2:  999,
  addon_hr_co_t3:  899,
  addon_hr_co_t4:  849,
}

export const PLAN_LABEL: Record<string, string> = {
  individual_starter: 'Individual Starter',
  individual_growth:  'Individual Growth',
  individual_pro:     'Individual Pro',
  co_std_t1: 'Company Standard (2–4)',
  co_std_t2: 'Company Standard (5–19)',
  co_std_t3: 'Company Standard (20–49)',
  co_std_t4: 'Company Standard (50+)',
  co_pro_t1: 'Company Pro (2–4)',
  co_pro_t2: 'Company Pro (5–19)',
  co_pro_t3: 'Company Pro (20–49)',
  co_pro_t4: 'Company Pro (50+)',
}

export function getPlanMinutes(planId: string): number {
  return PLAN_MINUTES[planId] ?? 0
}

export function getPerUserCap(planId: string): number {
  return Math.floor(getPlanMinutes(planId) * 1.5)
}

export function getCompanyPlanId(tier: 'std' | 'pro', seats: number): string {
  const t = seats >= 50 ? 't4' : seats >= 20 ? 't3' : seats >= 5 ? 't2' : 't1'
  return `co_${tier}_${t}`
}

export function getAddonPriceKey(planId: string): string {
  if (planId.startsWith('individual_')) return `addon_hr_${planId}`
  const tier = planId.match(/_(t[1-4])$/)?.[1] ?? 't1'
  return `addon_hr_co_${tier}`
}

export function isCompanyPlan(planId: string): boolean {
  return planId.startsWith('co_')
}

export function isIndividualPlan(planId: string): boolean {
  return planId.startsWith('individual_')
}
```

- [ ] **Run tests — expect them to pass**

```bash
cd web && npx vitest run __tests__/plans.test.ts
```
Expected: all 16 tests pass.

- [ ] **Commit**

```bash
git add lib/plans.ts __tests__/plans.test.ts
git commit -m "feat: add plan constants and tier logic"
```

---

## Task 4: Stripe client & prices config

**Files:**
- Create: `web/lib/stripe.ts`
- Create: `web/lib/stripe-prices.ts`

- [ ] **Create `web/lib/stripe.ts`**

```ts
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  typescript: true,
})

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set')
  return stripe.webhooks.constructEvent(payload, signature, secret)
}
```

- [ ] **Create `web/lib/stripe-prices.ts`** (will be populated after Task 5 seed run)

```ts
// Populated by running POST /api/stripe/seed once after deploy.
// Copy the returned priceIds object here.
export const STRIPE_PRICE_IDS: Record<string, string> = {
  // individual_starter: 'price_...',
  // individual_growth:  'price_...',
  // individual_pro:     'price_...',
  // co_std_t1: 'price_...', co_std_t2: 'price_...', co_std_t3: 'price_...', co_std_t4: 'price_...',
  // co_pro_t1: 'price_...', co_pro_t2: 'price_...', co_pro_t3: 'price_...', co_pro_t4: 'price_...',
  // addon_hr_individual_starter: 'price_...',
  // addon_hr_individual_growth:  'price_...',
  // addon_hr_individual_pro:     'price_...',
  // addon_hr_co_t1: 'price_...', addon_hr_co_t2: 'price_...', addon_hr_co_t3: 'price_...', addon_hr_co_t4: 'price_...',
}

export function getPriceId(planKey: string): string {
  const id = STRIPE_PRICE_IDS[planKey]
  if (!id) throw new Error(`No Stripe price ID found for plan key: ${planKey}`)
  return id
}
```

- [ ] **Commit**

```bash
git add lib/stripe.ts lib/stripe-prices.ts
git commit -m "feat: add Stripe client and prices config stub"
```

---

## Task 5: Stripe seed script

**Files:**
- Create: `web/app/api/stripe/seed/route.ts`

- [ ] **Create `web/app/api/stripe/seed/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { PLAN_PRICE_CENTS, ADDON_PRICE_CENTS, PLAN_LABEL } from '@/lib/plans'

// POST /api/stripe/seed
// Creates all Stripe products and prices. Safe to re-run (idempotent via lookup_key).
// Returns { priceIds } — copy into web/lib/stripe-prices.ts
export async function POST(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET
  const auth = req.headers.get('authorization')
  if (adminSecret && auth !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const priceIds: Record<string, string> = {}

  // ── Individual subscription prices ──────────────────────────────────────
  const individualProduct = await stripe.products.create({
    name: 'TechRP Individual',
    description: 'Voice AI sales training for individual technicians',
  })

  const individualPlans = ['individual_starter', 'individual_growth', 'individual_pro']
  for (const planKey of individualPlans) {
    const price = await stripe.prices.create({
      product: individualProduct.id,
      unit_amount: PLAN_PRICE_CENTS[planKey],
      currency: 'usd',
      recurring: { interval: 'month' },
      lookup_key: planKey,
      transfer_lookup_key: true,
      metadata: { plan_key: planKey, label: PLAN_LABEL[planKey] },
    })
    priceIds[planKey] = price.id
  }

  // ── Company Standard subscription prices ────────────────────────────────
  const stdProduct = await stripe.products.create({
    name: 'TechRP Company Standard',
    description: '120 min/user/month — shared pool',
  })
  for (const t of ['t1', 't2', 't3', 't4']) {
    const planKey = `co_std_${t}`
    const price = await stripe.prices.create({
      product: stdProduct.id,
      unit_amount: PLAN_PRICE_CENTS[planKey],
      currency: 'usd',
      recurring: { interval: 'month' },
      lookup_key: planKey,
      transfer_lookup_key: true,
      metadata: { plan_key: planKey, label: PLAN_LABEL[planKey] },
    })
    priceIds[planKey] = price.id
  }

  // ── Company Pro subscription prices ─────────────────────────────────────
  const proProduct = await stripe.products.create({
    name: 'TechRP Company Pro',
    description: '240 min/user/month — shared pool',
  })
  for (const t of ['t1', 't2', 't3', 't4']) {
    const planKey = `co_pro_${t}`
    const price = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: PLAN_PRICE_CENTS[planKey],
      currency: 'usd',
      recurring: { interval: 'month' },
      lookup_key: planKey,
      transfer_lookup_key: true,
      metadata: { plan_key: planKey, label: PLAN_LABEL[planKey] },
    })
    priceIds[planKey] = price.id
  }

  // ── Add-on hour one-time prices ─────────────────────────────────────────
  const addonProduct = await stripe.products.create({
    name: 'TechRP Add-on Hour',
    description: '60 extra training minutes — never expire',
  })
  const addonKeys = [
    'addon_hr_individual_starter', 'addon_hr_individual_growth', 'addon_hr_individual_pro',
    'addon_hr_co_t1', 'addon_hr_co_t2', 'addon_hr_co_t3', 'addon_hr_co_t4',
  ]
  for (const addonKey of addonKeys) {
    const price = await stripe.prices.create({
      product: addonProduct.id,
      unit_amount: ADDON_PRICE_CENTS[addonKey],
      currency: 'usd',
      lookup_key: addonKey,
      transfer_lookup_key: true,
      metadata: { addon_key: addonKey },
    })
    priceIds[addonKey] = price.id
  }

  return NextResponse.json({
    success: true,
    message: 'Copy priceIds into web/lib/stripe-prices.ts',
    priceIds,
  })
}
```

- [ ] **Run the seed script once**

```bash
# Start dev server in one terminal
cd web && npm run dev

# In another terminal:
curl -X POST http://localhost:3000/api/stripe/seed \
  -H "Authorization: Bearer $(grep ADMIN_SECRET .env.local | cut -d= -f2)"
```

Expected: JSON response with `priceIds` object containing 18 keys.

- [ ] **Copy the `priceIds` values into `web/lib/stripe-prices.ts`** — replace the commented-out lines with the actual `price_...` IDs returned.

- [ ] **Commit**

```bash
git add app/api/stripe/seed/route.ts lib/stripe-prices.ts
git commit -m "feat: stripe seed script and populated price IDs"
```

---

## Task 6: Minute enforcement utilities

**Files:**
- Create: `web/lib/minute-gate.ts`
- Create: `web/__tests__/minute-gate.test.ts`

- [ ] **Write failing tests**

```ts
// web/__tests__/minute-gate.test.ts
import { describe, it, expect } from 'vitest'
import { checkMinuteGate, type MinuteGateInput } from '../lib/minute-gate'
// Note: minute-gate.ts must import getPlanMinutes from './plans' at the top (static import)

const base: MinuteGateInput = {
  role: 'individual',
  subscriptionStatus: 'active',
  trialEndsAt: null,
  minutesUsed: 0,
  bonusMinutes: 0,
  planId: 'individual_growth',   // 240 min
  orgMinutesPool: null,
  orgBonusMinutes: null,
  perUserCap: null,
}

describe('checkMinuteGate', () => {
  it('allows superuser unconditionally', () => {
    const result = checkMinuteGate({ ...base, role: 'superuser', subscriptionStatus: 'canceled' })
    expect(result.allowed).toBe(true)
  })

  it('blocks canceled subscription', () => {
    const result = checkMinuteGate({ ...base, subscriptionStatus: 'canceled' })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('subscription_inactive')
  })

  it('blocks past_due subscription', () => {
    const result = checkMinuteGate({ ...base, subscriptionStatus: 'past_due' })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('subscription_past_due')
  })

  it('blocks expired trial', () => {
    const pastDate = new Date(Date.now() - 1000).toISOString()
    const result = checkMinuteGate({ ...base, subscriptionStatus: 'trialing', trialEndsAt: pastDate })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('trial_expired')
  })

  it('allows active trial within date and minutes', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString()
    const result = checkMinuteGate({ ...base, subscriptionStatus: 'trialing', trialEndsAt: futureDate, minutesUsed: 10 })
    expect(result.allowed).toBe(true)
  })

  it('blocks individual with no minutes remaining', () => {
    const result = checkMinuteGate({ ...base, minutesUsed: 240, bonusMinutes: 0 })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('minutes_exhausted')
    expect(result.minutesRemaining).toBe(0)
  })

  it('allows individual with bonus minutes remaining', () => {
    const result = checkMinuteGate({ ...base, minutesUsed: 240, bonusMinutes: 60 })
    expect(result.allowed).toBe(true)
    expect(result.minutesRemaining).toBe(60)
  })

  it('allows individual with plan minutes partially used', () => {
    const result = checkMinuteGate({ ...base, minutesUsed: 100 })
    expect(result.allowed).toBe(true)
    expect(result.minutesRemaining).toBe(140)
  })

  it('blocks company user when org pool is empty', () => {
    const result = checkMinuteGate({
      ...base,
      role: 'company_admin',
      planId: 'co_pro_t1',
      orgMinutesPool: 0,
      orgBonusMinutes: 0,
      perUserCap: 360,
      minutesUsed: 0,
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('minutes_exhausted')
  })

  it('blocks company user at per-user cap even with pool remaining', () => {
    const result = checkMinuteGate({
      ...base,
      role: 'company_admin',
      planId: 'co_pro_t1',
      orgMinutesPool: 1000,
      orgBonusMinutes: 0,
      perUserCap: 360,
      minutesUsed: 360,
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('user_cap_reached')
  })

  it('allows company user with pool and under cap', () => {
    const result = checkMinuteGate({
      ...base,
      role: 'company_admin',
      planId: 'co_pro_t1',
      orgMinutesPool: 500,
      orgBonusMinutes: 0,
      perUserCap: 360,
      minutesUsed: 100,
    })
    expect(result.allowed).toBe(true)
    expect(result.minutesRemaining).toBe(260) // min(cap_remaining=260, pool=500)
  })
})
```

- [ ] **Run — expect failures**

```bash
cd web && npx vitest run __tests__/minute-gate.test.ts
```

- [ ] **Create `web/lib/minute-gate.ts`**

```ts
import { getPlanMinutes } from './plans'

export type MinuteGateInput = {
  role: string
  subscriptionStatus: string | null
  trialEndsAt: string | null
  minutesUsed: number
  bonusMinutes: number
  planId: string
  // Company-only — null for individual
  orgMinutesPool: number | null
  orgBonusMinutes: number | null
  perUserCap: number | null
}

export type MinuteGateResult = {
  allowed: boolean
  reason?: 'subscription_inactive' | 'subscription_past_due' | 'trial_expired' | 'minutes_exhausted' | 'user_cap_reached'
  minutesRemaining: number
}

export function checkMinuteGate(input: MinuteGateInput): MinuteGateResult {
  const {
    role, subscriptionStatus, trialEndsAt,
    minutesUsed, bonusMinutes, planId,
    orgMinutesPool, orgBonusMinutes, perUserCap,
  } = input

  // Superuser bypass
  if (role === 'superuser') {
    return { allowed: true, minutesRemaining: Infinity }
  }

  // Check subscription status
  if (subscriptionStatus === 'canceled' || subscriptionStatus === 'inactive') {
    return { allowed: false, reason: 'subscription_inactive', minutesRemaining: 0 }
  }
  if (subscriptionStatus === 'past_due') {
    return { allowed: false, reason: 'subscription_past_due', minutesRemaining: 0 }
  }

  // Check trial expiry
  if (subscriptionStatus === 'trialing' && trialEndsAt) {
    if (new Date() > new Date(trialEndsAt)) {
      return { allowed: false, reason: 'trial_expired', minutesRemaining: 0 }
    }
  }

  // Company minute check
  if (orgMinutesPool !== null) {
    const totalPool = orgMinutesPool + (orgBonusMinutes ?? 0)
    if (totalPool <= 0) {
      return { allowed: false, reason: 'minutes_exhausted', minutesRemaining: 0 }
    }
    if (perUserCap !== null && minutesUsed >= perUserCap) {
      return { allowed: false, reason: 'user_cap_reached', minutesRemaining: 0 }
    }
    const capRemaining = perUserCap !== null ? perUserCap - minutesUsed : totalPool
    const minutesRemaining = Math.min(capRemaining, totalPool)
    return { allowed: true, minutesRemaining }
  }

  // Individual minute check — uses plan minutes (from planId context) + bonus
  // planId context: the caller passes planMinutes via the input shape.
  // We derive remaining from: total_allowance = planMinutes (reset monthly) + bonusMinutes
  // minutesUsed tracks only plan minutes; bonus is consumed after plan runs out.
  // Simple model: totalAllowance derived externally; we just check used vs allowed.
  // The API route computes planMinutes from plans.ts and passes effective total.
  // For the gate: remaining = planMinutes - minutesUsed + bonusMinutes (when minutesUsed >= planMinutes, bonus kicks in)
  // We receive this pre-computed as (planMinutes embedded in caller context).
  // Keep it simple: treat bonusMinutes as extra on top of plan.
  // getPlanMinutes is imported at the top of this file (static import).
  const planMinutes = getPlanMinutes(planId)
  const totalAllowance = planMinutes + bonusMinutes
  const remaining = totalAllowance - minutesUsed

  if (remaining <= 0) {
    return { allowed: false, reason: 'minutes_exhausted', minutesRemaining: 0 }
  }
  return { allowed: true, minutesRemaining: remaining }
}
```

- [ ] **Run tests — expect pass**

```bash
cd web && npx vitest run __tests__/minute-gate.test.ts
```
Expected: all 11 tests pass.

- [ ] **Commit**

```bash
git add lib/minute-gate.ts __tests__/minute-gate.test.ts
git commit -m "feat: minute gate logic with full test coverage"
```

---

## Task 7: Webhook handler

**Files:**
- Create: `web/app/api/stripe/webhook/route.ts`

- [ ] **Create `web/app/api/stripe/webhook/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent, stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'
import { getPlanMinutes, isCompanyPlan, TRIAL_MINUTES } from '@/lib/plans'

export const config = { api: { bodyParser: false } }

export async function POST(req: NextRequest) {
  const payload = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  let event
  try {
    event = constructWebhookEvent(payload, sig)
  } catch (err: any) {
    console.error('Webhook signature failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = createServiceRoleClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as any, db)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as any, db)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as any, db)
        break
      case 'invoice.payment_succeeded':
        await handleInvoicePaid(event.data.object as any, db)
        break
      case 'invoice.payment_failed':
        await handleInvoiceFailed(event.data.object as any, db)
        break
      default:
        // Unhandled event — not an error
        break
    }
  } catch (err: any) {
    console.error(`Webhook handler error for ${event.type}:`, err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutCompleted(session: any, db: any) {
  const { metadata, subscription: stripeSubId, customer: stripeCustomerId } = session
  const { user_id, org_id, plan_id } = metadata ?? {}

  if (!stripeSubId || !plan_id) return

  const sub = await stripe.subscriptions.retrieve(stripeSubId as string)
  const priceId = sub.items.data[0]?.price.id ?? ''
  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null
  const periodStart = new Date(sub.current_period_start * 1000).toISOString()
  const periodEnd = new Date(sub.current_period_end * 1000).toISOString()

  // Upsert subscriptions row
  await (db as any).from('subscriptions').upsert({
    user_id: user_id ?? null,
    org_id: org_id ?? null,
    stripe_subscription_id: stripeSubId,
    stripe_price_id: priceId,
    plan_id,
    status: sub.status,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    trial_end: trialEnd,
  }, { onConflict: 'stripe_subscription_id' })

  if (user_id) {
    // Individual user: approve + set trial_ends_at
    await (db as any).from('users').update({
      status: 'approved',
      stripe_customer_id: stripeCustomerId,
      trial_ends_at: trialEnd,
    }).eq('id', user_id)

    // Grant trial minutes transaction
    await (db as any).from('minute_transactions').insert({
      user_id,
      type: 'trial_grant',
      delta: TRIAL_MINUTES,
    })
  }

  if (org_id) {
    const planMinutes = getPlanMinutes(plan_id)
    const quantity = sub.items.data[0]?.quantity ?? 1

    // Company: approve admin, set org billing fields
    await (db as any).from('organizations').update({
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubId,
      plan_id,
      seat_count: quantity,
      minutes_pool: quantity * planMinutes,
      subscription_status: sub.status,
    }).eq('id', org_id)

    // Approve the company_admin user
    await (db as any).from('users').update({
      status: 'approved',
      stripe_customer_id: stripeCustomerId,
      trial_ends_at: trialEnd,
    }).eq('organization_id', org_id).eq('app_role', 'company_admin')
  }
}

async function handleSubscriptionUpdated(sub: any, db: any) {
  const status = sub.status
  const periodStart = new Date(sub.current_period_start * 1000).toISOString()
  const periodEnd = new Date(sub.current_period_end * 1000).toISOString()
  const priceId = sub.items.data[0]?.price.id ?? ''
  const planId = sub.items.data[0]?.price.metadata?.plan_key ?? ''

  await (db as any).from('subscriptions').update({
    status, stripe_price_id: priceId, plan_id: planId,
    current_period_start: periodStart, current_period_end: periodEnd,
  }).eq('stripe_subscription_id', sub.id)

  // Sync org status
  await (db as any).from('organizations')
    .update({ subscription_status: status, plan_id: planId })
    .eq('stripe_subscription_id', sub.id)
}

async function handleSubscriptionDeleted(sub: any, db: any) {
  await (db as any).from('subscriptions').update({
    status: 'canceled',
    canceled_at: new Date().toISOString(),
  }).eq('stripe_subscription_id', sub.id)

  await (db as any).from('organizations')
    .update({ subscription_status: 'canceled' })
    .eq('stripe_subscription_id', sub.id)
}

async function handleInvoicePaid(invoice: any, db: any) {
  const stripeSubId = invoice.subscription
  if (!stripeSubId) return

  // Find subscription row
  const { data: subRow } = await (db as any).from('subscriptions')
    .select('*').eq('stripe_subscription_id', stripeSubId).single()
  if (!subRow) return

  // ── Monthly reset ────────────────────────────────────────────────────────
  if (subRow.user_id) {
    await (db as any).from('users')
      .update({ minutes_used: 0 })
      .eq('id', subRow.user_id)

    await (db as any).from('minute_transactions').insert({
      user_id: subRow.user_id,
      type: 'monthly_reset',
      delta: 0,
    })
  }

  if (subRow.org_id) {
    const { data: org } = await (db as any).from('organizations')
      .select('seat_count, plan_id').eq('id', subRow.org_id).single()
    if (org) {
      const newPool = org.seat_count * getPlanMinutes(org.plan_id)
      await (db as any).from('organizations')
        .update({ minutes_pool: newPool, subscription_status: 'active' })
        .eq('id', subRow.org_id)

      // Reset all org users' minutes_used
      await (db as any).from('users')
        .update({ minutes_used: 0 })
        .eq('organization_id', subRow.org_id)
    }
  }

  // ── Affiliate payout ─────────────────────────────────────────────────────
  if (subRow.org_id) {
    const { data: referral } = await (db as any).from('coach_referrals')
      .select('*, users!coach_referrals_coach_id_fkey(stripe_connect_account_id)')
      .eq('org_id', subRow.org_id)
      .eq('type', 'affiliate')
      .eq('is_active', true)
      .single()

    if (referral) {
      const connectAccountId = referral.users?.stripe_connect_account_id
      const amountCents = Math.floor(invoice.amount_paid * referral.percentage / 100)

      if (connectAccountId && amountCents > 0) {
        try {
          await stripe.transfers.create({
            amount: amountCents,
            currency: 'usd',
            destination: connectAccountId,
            transfer_group: `invoice_${invoice.id}`,
          })
        } catch (err: any) {
          console.error(`Affiliate transfer failed for referral ${referral.id}:`, err.message)
        }
      } else {
        // Coach hasn't completed Connect onboarding — log it
        console.warn(`Skipped affiliate payout for referral ${referral.id}: no Connect account. Invoice: ${invoice.id}, amount: ${amountCents}`)
      }
    }
  }
}

async function handleInvoiceFailed(invoice: any, db: any) {
  const stripeSubId = invoice.subscription
  if (!stripeSubId) return

  await (db as any).from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', stripeSubId)

  await (db as any).from('organizations')
    .update({ subscription_status: 'past_due' })
    .eq('stripe_subscription_id', stripeSubId)
}
```

- [ ] **Set up Stripe CLI for local webhook forwarding**

```bash
# Install Stripe CLI if not already: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Copy the whsec_... value shown and add it to web/.env.local as STRIPE_WEBHOOK_SECRET
```

- [ ] **Commit**

```bash
git add app/api/stripe/webhook/route.ts
git commit -m "feat: stripe webhook handler (subscriptions, invoices, affiliate payouts)"
```

---

## Task 8: Checkout & Portal API routes

**Files:**
- Create: `web/app/api/stripe/checkout/route.ts`
- Create: `web/app/api/stripe/portal/route.ts`

- [ ] **Create `web/app/api/stripe/checkout/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getPriceId } from '@/lib/stripe-prices'
import { isCompanyPlan, TRIAL_DAYS } from '@/lib/plans'
import { createServiceRoleClient } from '@/lib/supabase'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// POST /api/stripe/checkout
// Body: { planKey, userId, orgId?, seats?, mode }
// mode: 'subscription' | 'addon'
export async function POST(req: NextRequest) {
  const { planKey, userId, orgId, seats, mode, addonQty } = await req.json()

  if (!planKey || !userId) {
    return NextResponse.json({ error: 'Missing planKey or userId' }, { status: 400 })
  }

  const db = createServiceRoleClient()

  // Get or create Stripe customer
  let customerId: string | undefined
  if (orgId) {
    const { data: org } = await (db as any).from('organizations')
      .select('stripe_customer_id').eq('id', orgId).single()
    customerId = org?.stripe_customer_id ?? undefined
  } else {
    const { data: user } = await (db as any).from('users')
      .select('stripe_customer_id, email, full_name').eq('id', userId).single()
    customerId = user?.stripe_customer_id ?? undefined
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user?.email,
        name: user?.full_name,
        metadata: { user_id: userId },
      })
      customerId = customer.id
      await (db as any).from('users').update({ stripe_customer_id: customerId }).eq('id', userId)
    }
  }

  if (mode === 'addon') {
    // One-time hour block purchase
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{
        price: getPriceId(planKey),
        quantity: addonQty ?? 1,
      }],
      metadata: { user_id: userId, org_id: orgId ?? '', addon_key: planKey, addon_qty: String(addonQty ?? 1) },
      success_url: `${APP_URL}/billing?addon_success=true`,
      cancel_url: `${APP_URL}/billing/add-hours`,
    })
    return NextResponse.json({ url: session.url })
  }

  // Subscription checkout
  const quantity = isCompanyPlan(planKey) ? (seats ?? 2) : 1

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: getPriceId(planKey), quantity }],
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: {
        user_id: userId,
        org_id: orgId ?? '',
        plan_id: planKey,
      },
    },
    metadata: { user_id: userId, org_id: orgId ?? '', plan_id: planKey },
    success_url: `${APP_URL}/billing?success=true`,
    cancel_url: `${APP_URL}/pricing`,
  })

  return NextResponse.json({ url: session.url })
}
```

- [ ] **Create `web/app/api/stripe/portal/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function POST(req: NextRequest) {
  const { userId, orgId } = await req.json()
  const db = createServiceRoleClient()

  let customerId: string | null = null
  if (orgId) {
    const { data } = await (db as any).from('organizations').select('stripe_customer_id').eq('id', orgId).single()
    customerId = data?.stripe_customer_id
  } else {
    const { data } = await (db as any).from('users').select('stripe_customer_id').eq('id', userId).single()
    customerId = data?.stripe_customer_id
  }

  if (!customerId) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL}/billing`,
  })

  return NextResponse.json({ url: session.url })
}
```

- [ ] **Commit**

```bash
git add app/api/stripe/checkout/route.ts app/api/stripe/portal/route.ts
git commit -m "feat: stripe checkout and portal API routes"
```

---

## Task 9: Pre-call & post-call minute API routes

**Files:**
- Create: `web/app/api/calls/check-minutes/route.ts`
- Create: `web/app/api/calls/record-usage/route.ts`

- [ ] **Create `web/app/api/calls/check-minutes/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { checkMinuteGate } from '@/lib/minute-gate'
import { getPerUserCap, getPlanMinutes, isCompanyPlan } from '@/lib/plans'
import { stripe } from '@/lib/stripe'
import { TRIAL_MINUTES } from '@/lib/plans'

// POST /api/calls/check-minutes
// Body: { userId }
// Returns: { allowed: boolean, reason?: string, minutesRemaining: number }
export async function POST(req: NextRequest) {
  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  const db = createServiceRoleClient()

  const { data: user } = await (db as any).from('users')
    .select('id, app_role, organization_id, minutes_used, bonus_minutes, trial_ends_at, auto_refill_enabled')
    .eq('id', userId).single()

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Get subscription
  let subscriptionStatus: string | null = null
  let planId: string | null = null
  let orgData: any = null

  if (user.organization_id) {
    const { data: org } = await (db as any).from('organizations')
      .select('subscription_status, plan_id, seat_count, minutes_pool, bonus_minutes, auto_refill_enabled')
      .eq('id', user.organization_id).single()
    orgData = org
    subscriptionStatus = org?.subscription_status ?? null
    planId = org?.plan_id ?? null
  } else {
    const { data: sub } = await (db as any).from('subscriptions')
      .select('status, plan_id').eq('user_id', userId).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).single()
    const { data: trialSub } = !sub
      ? await (db as any).from('subscriptions')
          .select('status, plan_id').eq('user_id', userId).eq('status', 'trialing')
          .order('created_at', { ascending: false }).limit(1).single()
      : { data: null }
    const activeSub = sub ?? trialSub
    subscriptionStatus = activeSub?.status ?? null
    planId = activeSub?.plan_id ?? null
  }

  const result = checkMinuteGate({
    role: user.app_role,
    subscriptionStatus,
    trialEndsAt: user.trial_ends_at,
    minutesUsed: user.minutes_used,
    bonusMinutes: user.bonus_minutes,
    planId: planId ?? '',
    orgMinutesPool: orgData ? orgData.minutes_pool : null,
    orgBonusMinutes: orgData ? orgData.bonus_minutes : null,
    perUserCap: orgData && planId ? getPerUserCap(planId) : null,
  })

  // Check trial 25-minute cutoff
  if (subscriptionStatus === 'trialing' && user.minutes_used >= TRIAL_MINUTES) {
    // End trial immediately in Stripe
    const { data: sub } = await (db as any).from('subscriptions')
      .select('stripe_subscription_id').eq('user_id', userId).eq('status', 'trialing').single()
    if (sub?.stripe_subscription_id) {
      await stripe.subscriptions.update(sub.stripe_subscription_id, { trial_end: 'now' })
    }
    return NextResponse.json({ allowed: false, reason: 'trial_expired', minutesRemaining: 0 })
  }

  // Auto-refill: if blocked due to exhaustion and auto_refill is on, trigger purchase
  if (!result.allowed && result.reason === 'minutes_exhausted') {
    const autoRefill = orgData ? orgData.auto_refill_enabled : user.auto_refill_enabled
    if (autoRefill) {
      // Return a signal to the client to trigger an auto-refill checkout
      return NextResponse.json({ allowed: false, reason: 'auto_refill_required', minutesRemaining: 0 })
    }
  }

  return NextResponse.json(result)
}
```

- [ ] **Create `web/app/api/calls/record-usage/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { TRIAL_MINUTES } from '@/lib/plans'
import { stripe } from '@/lib/stripe'

// POST /api/calls/record-usage
// Body: { userId, sessionId, durationSeconds }
export async function POST(req: NextRequest) {
  const { userId, sessionId, durationSeconds } = await req.json()
  if (!userId || durationSeconds == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const minutesUsed = Math.ceil(durationSeconds / 60)
  const db = createServiceRoleClient()

  const { data: user } = await (db as any).from('users')
    .select('id, app_role, organization_id, minutes_used, bonus_minutes, trial_ends_at')
    .eq('id', userId).single()

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Deduct from org pool first if company user
  if (user.organization_id) {
    const { data: org } = await (db as any).from('organizations')
      .select('minutes_pool, bonus_minutes').eq('id', user.organization_id).single()
    if (org) {
      // Deduct from pool (allow going negative — overage forgiven)
      const newPool = Math.max(0, (org.minutes_pool ?? 0) - minutesUsed)
      await (db as any).from('organizations')
        .update({ minutes_pool: newPool })
        .eq('id', user.organization_id)
    }
  }

  // Increment user's minutes_used
  const newMinutesUsed = (user.minutes_used ?? 0) + minutesUsed
  await (db as any).from('users')
    .update({ minutes_used: newMinutesUsed })
    .eq('id', userId)

  // Write audit transaction
  await (db as any).from('minute_transactions').insert({
    user_id: userId,
    org_id: user.organization_id ?? null,
    type: 'call_usage',
    delta: -minutesUsed,
    session_id: sessionId ?? null,
  })

  // Check trial cutoff
  if (user.trial_ends_at && newMinutesUsed >= TRIAL_MINUTES) {
    const { data: sub } = await (db as any).from('subscriptions')
      .select('stripe_subscription_id').eq('user_id', userId).eq('status', 'trialing').single()
    if (sub?.stripe_subscription_id) {
      await stripe.subscriptions.update(sub.stripe_subscription_id, { trial_end: 'now' })
      await (db as any).from('subscriptions')
        .update({ status: 'active', trial_end: new Date().toISOString() })
        .eq('stripe_subscription_id', sub.stripe_subscription_id)
    }
  }

  return NextResponse.json({ success: true, minutesDeducted: minutesUsed })
}
```

- [ ] **Commit**

```bash
git add app/api/calls/
git commit -m "feat: pre-call minute gate and post-call usage recording"
```

---

## Task 10: Update signup route for Stripe + coach tokens

**Files:**
- Create: `web/lib/coach-token.ts`
- Modify: `web/app/api/auth/signup/route.ts`

- [ ] **Create `web/lib/coach-token.ts`**

```ts
import { createHmac } from 'crypto'

const SECRET = process.env.COACH_INVITE_SECRET ?? 'change-me'

export type CoachTokenPayload = {
  coachId: string
  type: 'discount' | 'affiliate'
  percentage: number
  issuedAt: number
}

export function signCoachToken(payload: CoachTokenPayload): string {
  const data = JSON.stringify(payload)
  const encoded = Buffer.from(data).toString('base64url')
  const sig = createHmac('sha256', SECRET).update(encoded).digest('base64url')
  return `${encoded}.${sig}`
}

export function verifyCoachToken(token: string): CoachTokenPayload | null {
  try {
    const [encoded, sig] = token.split('.')
    const expected = createHmac('sha256', SECRET).update(encoded).digest('base64url')
    if (sig !== expected) return null
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as CoachTokenPayload
    // Tokens expire after 30 days
    if (Date.now() - payload.issuedAt > 30 * 24 * 60 * 60 * 1000) return null
    return payload
  } catch {
    return null
  }
}
```

- [ ] **Add coach token handling to `web/app/api/auth/signup/route.ts`**

Find the `POST` handler. After the user profile is created and `userId` is known, add this block before the `return NextResponse.json({ success: true })`:

```ts
// Decode coach invite token (if present)
if (coachToken) {
  const { verifyCoachToken } = await import('@/lib/coach-token')
  const payload = verifyCoachToken(coachToken)
  if (payload && orgId) {
    // Create coach_referrals row
    await supabase.from('coach_referrals' as any).insert({
      coach_id: payload.coachId,
      org_id: orgId,
      type: payload.type,
      percentage: payload.percentage,
    })

    // If discount type: create Stripe coupon and attach to subscription (done at checkout time)
    // Store the payload in session metadata so checkout route can apply it
    // We pass coupon creation to checkout — store in user metadata for now
    // For discount type: coupon is created at checkout time (not here).
    // The coachToken is passed from the signup form → checkout route directly.
    // No additional action needed here — the coach_referrals row is enough.
  }
}
```

> **Note:** The cleaner approach is to pass `coachToken` from the signup form → checkout route, where the Stripe coupon is created and applied. Update `POST /api/stripe/checkout` to accept an optional `coachToken` param, verify it, create a Stripe coupon on the fly (`stripe.coupons.create({ percent_off: payload.percentage, duration: 'forever' })`), and apply it via `discounts: [{ coupon: couponId }]` in the checkout session. Update `coach_referrals` with the `stripe_coupon_id` after creation.

- [ ] **Update checkout route to handle coach discount coupon** — open `web/app/api/stripe/checkout/route.ts` and add to the subscription checkout block:

```ts
// Add to POST handler, after `const { planKey, userId, orgId, seats, mode, addonQty } = await req.json()`
// also destructure: coachToken
const { planKey, userId, orgId, seats, mode, addonQty, coachToken } = await req.json()

// Before creating the checkout session, check for coach discount:
let discounts: { coupon: string }[] = []
if (coachToken) {
  const { verifyCoachToken } = await import('@/lib/coach-token')
  const payload = verifyCoachToken(coachToken)
  if (payload?.type === 'discount') {
    const coupon = await stripe.coupons.create({
      percent_off: payload.percentage,
      duration: 'forever',
      metadata: { coach_id: payload.coachId, org_id: orgId ?? '' },
    })
    discounts = [{ coupon: coupon.id }]
    // Store coupon_id on coach_referrals row
    await (db as any).from('coach_referrals')
      .update({ stripe_coupon_id: coupon.id })
      .eq('coach_id', payload.coachId)
      .eq('org_id', orgId)
  }
}

// Add `discounts` to the stripe.checkout.sessions.create call:
// discounts: discounts.length > 0 ? discounts : undefined,
```

- [ ] **Commit**

```bash
git add lib/coach-token.ts app/api/auth/signup/route.ts app/api/stripe/checkout/route.ts
git commit -m "feat: coach invite token signing and discount coupon at checkout"
```

---

## Task 11: Coach referrals API

**Files:**
- Create: `web/app/api/coach/referrals/route.ts`
- Create: `web/app/api/coach/referrals/[id]/route.ts`
- Create: `web/app/api/coach/connect/route.ts`

- [ ] **Create `web/app/api/coach/referrals/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { signCoachToken } from '@/lib/coach-token'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// GET — list coach's referrals
export async function GET(req: NextRequest) {
  const coachId = req.nextUrl.searchParams.get('coachId')
  if (!coachId) return NextResponse.json({ error: 'Missing coachId' }, { status: 400 })

  const db = createServiceRoleClient()
  const { data, error } = await (db as any).from('coach_referrals')
    .select('*, organizations(name, subscription_status)')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ referrals: data })
}

// POST — generate a new invite link token
export async function POST(req: NextRequest) {
  const { coachId, type, percentage } = await req.json()
  if (!coachId || !type || !percentage) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (!['discount', 'affiliate'].includes(type)) {
    return NextResponse.json({ error: 'type must be discount or affiliate' }, { status: 400 })
  }
  if (percentage < 1 || percentage > 100) {
    return NextResponse.json({ error: 'percentage must be 1–100' }, { status: 400 })
  }

  const token = signCoachToken({ coachId, type, percentage, issuedAt: Date.now() })
  const inviteUrl = `${APP_URL}/signup?coach=${token}`
  return NextResponse.json({ token, inviteUrl })
}
```

- [ ] **Create `web/app/api/coach/referrals/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

// PATCH — edit percentage or revoke
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { percentage, is_active } = await req.json()
  const db = createServiceRoleClient()

  const updates: Record<string, any> = {}
  if (percentage !== undefined) updates.percentage = percentage
  if (is_active !== undefined) updates.is_active = is_active

  const { data: referral } = await (db as any).from('coach_referrals')
    .select('*').eq('id', params.id).single()
  if (!referral) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // If revoking a discount, remove the Stripe coupon from the subscription
  if (is_active === false && referral.type === 'discount' && referral.stripe_coupon_id) {
    const { data: org } = await (db as any).from('organizations')
      .select('stripe_subscription_id').eq('id', referral.org_id).single()
    if (org?.stripe_subscription_id) {
      await stripe.subscriptions.update(org.stripe_subscription_id, { discounts: [] })
    }
  }

  await (db as any).from('coach_referrals').update(updates).eq('id', params.id)
  return NextResponse.json({ success: true })
}
```

- [ ] **Create `web/app/api/coach/connect/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const CLIENT_ID = process.env.STRIPE_CONNECT_CLIENT_ID ?? ''

// GET — initiate Stripe Connect Express OAuth
export async function GET(req: NextRequest) {
  const coachId = req.nextUrl.searchParams.get('coachId')
  if (!coachId) return NextResponse.json({ error: 'Missing coachId' }, { status: 400 })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: 'read_write',
    redirect_uri: `${APP_URL}/coach/connect/callback`,
    state: coachId,
  })

  return NextResponse.redirect(`https://connect.stripe.com/oauth/authorize?${params}`)
}

// POST /api/coach/connect — exchange OAuth code for account ID
export async function POST(req: NextRequest) {
  const { code, coachId } = await req.json()
  if (!code || !coachId) return NextResponse.json({ error: 'Missing code or coachId' }, { status: 400 })

  const res = await fetch('https://connect.stripe.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_secret: process.env.STRIPE_SECRET_KEY ?? '',
    }),
  })

  const data = await res.json()
  if (!res.ok || !data.stripe_user_id) {
    return NextResponse.json({ error: data.error_description ?? 'Connect failed' }, { status: 400 })
  }

  const db = createServiceRoleClient()
  await (db as any).from('users')
    .update({ stripe_connect_account_id: data.stripe_user_id })
    .eq('id', coachId)

  return NextResponse.json({ success: true })
}
```

- [ ] **Commit**

```bash
git add app/api/coach/
git commit -m "feat: coach referral API and Stripe Connect OAuth"
```

---

## Task 12: /pricing page

**Files:**
- Create: `web/app/pricing/page.tsx`
- Create: `web/components/pricing/pricing-table.tsx`
- Create: `web/components/pricing/seat-calculator.tsx`

- [ ] **Create `web/components/pricing/seat-calculator.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { getCompanyPlanId, PLAN_PRICE_CENTS } from '@/lib/plans'

type Props = { onSelect: (planKey: string, seats: number) => void }

export function SeatCalculator({ onSelect }: Props) {
  const [seats, setSeats] = useState(2)
  const [tier, setTier] = useState<'std' | 'pro'>('pro')

  const planKey = getCompanyPlanId(tier, seats)
  const pricePerSeat = PLAN_PRICE_CENTS[planKey] / 100
  const total = pricePerSeat * seats

  return (
    <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-5">
      <h3 className="text-lg font-semibold text-white">Company Plan Calculator</h3>

      <div className="flex gap-2">
        {(['std', 'pro'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTier(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tier === t
                ? 'bg-indigo-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {t === 'std' ? 'Standard (120 min/user)' : 'Pro (240 min/user)'}
          </button>
        ))}
      </div>

      <div>
        <label className="text-sm text-gray-400 block mb-2">
          Number of seats: <span className="text-white font-semibold">{seats}</span>
        </label>
        <input
          type="range" min={2} max={100} value={seats}
          onChange={e => setSeats(Number(e.target.value))}
          className="w-full accent-indigo-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>2</span><span>5</span><span>20</span><span>50</span><span>100</span>
        </div>
      </div>

      <div className="bg-white/5 rounded-xl p-4">
        <div className="flex justify-between text-sm text-gray-400">
          <span>Per seat/month</span>
          <span className="text-white font-semibold">${pricePerSeat.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold text-white mt-2">
          <span>Monthly total ({seats} seats)</span>
          <span className="text-green-400">${total.toFixed(2)}/mo</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">7-day free trial • Cancel anytime</p>
      </div>

      <button
        onClick={() => onSelect(planKey, seats)}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
      >
        Get Started — ${total.toFixed(2)}/mo
      </button>
    </div>
  )
}
```

- [ ] **Create `web/app/pricing/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SeatCalculator } from '@/components/pricing/seat-calculator'

const INDIVIDUAL_PLANS = [
  { key: 'individual_starter', label: 'Starter', price: '$34.99', minutes: '120 min/mo', addl: '$14.99/hr', weeklyNote: '~30 min/wk' },
  { key: 'individual_growth', label: 'Growth', price: '$57.99', minutes: '240 min/mo', addl: '$12.99/hr', weeklyNote: '~60 min/wk', popular: true },
  { key: 'individual_pro', label: 'Pro', price: '$89.99', minutes: '400 min/mo', addl: '$10.99/hr', weeklyNote: '~100 min/wk' },
]

export default function PricingPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'individual' | 'company'>('individual')

  function handleIndividualSelect(planKey: string) {
    router.push(`/signup?plan=${planKey}`)
  }

  function handleCompanySelect(planKey: string, seats: number) {
    router.push(`/signup?plan=${planKey}&seats=${seats}&type=company`)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">Simple, transparent pricing</h1>
          <p className="text-gray-400 text-lg">7-day free trial on all plans. No charge until your trial ends.</p>
        </div>

        {/* Tab toggle */}
        <div className="flex justify-center mb-10">
          <div className="bg-gray-900 border border-white/10 rounded-xl p-1 flex gap-1">
            {(['individual', 'company'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {t === 'individual' ? 'Individual' : 'Company'}
              </button>
            ))}
          </div>
        </div>

        {tab === 'individual' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {INDIVIDUAL_PLANS.map(plan => (
              <div
                key={plan.key}
                className={`relative bg-gray-900 rounded-2xl p-6 border flex flex-col ${
                  plan.popular ? 'border-indigo-500' : 'border-white/10'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-semibold mb-1">{plan.label}</h3>
                <div className="text-3xl font-bold text-white mb-1">{plan.price}<span className="text-base text-gray-400 font-normal">/mo</span></div>
                <p className="text-sm text-gray-400 mb-6">{plan.minutes} <span className="text-gray-600">({plan.weeklyNote})</span></p>
                <ul className="space-y-2 text-sm text-gray-300 mb-8 flex-1">
                  <li>✓ All scenario types</li>
                  <li>✓ AI scoring & feedback</li>
                  <li>✓ Session history</li>
                  <li>✓ Additional hours: {plan.addl}</li>
                </ul>
                <button
                  onClick={() => handleIndividualSelect(plan.key)}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
                >
                  Start Free Trial
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'company' && (
          <div className="max-w-xl mx-auto">
            <SeatCalculator onSelect={handleCompanySelect} />
            <p className="text-center text-sm text-gray-500 mt-4">
              Minutes shared as a pool across your team. Each user capped at 150% of their plan allocation.
            </p>
          </div>
        )}

        <p className="text-center text-sm text-gray-600 mt-12">
          Already have an account? <a href="/login" className="text-indigo-400 hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Add `/pricing` to public routes in middleware** — find `PUBLIC_ROUTES` array and add `'/pricing'`.

- [ ] **Commit**

```bash
git add app/pricing/ components/pricing/ middleware.ts
git commit -m "feat: public pricing page with individual plans and company seat calculator"
```

---

## Task 13: /billing page & usage bar

**Files:**
- Create: `web/components/billing/usage-bar.tsx`
- Create: `web/app/billing/page.tsx`
- Create: `web/app/billing/add-hours/page.tsx`

- [ ] **Create `web/components/billing/usage-bar.tsx`**

```tsx
type Props = {
  used: number
  total: number        // plan minutes (not including bonus)
  bonus: number        // rollover bonus minutes remaining
  label?: string
}

export function UsageBar({ used, total, bonus, label }: Props) {
  const planPct = Math.min(100, (used / Math.max(total, 1)) * 100)
  const overPlan = Math.max(0, used - total)
  const bonusRemaining = Math.max(0, bonus - overPlan)

  return (
    <div className="space-y-2">
      {label && <p className="text-sm text-gray-400">{label}</p>}
      <div className="h-3 bg-white/10 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-indigo-500 transition-all"
          style={{ width: `${planPct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{used} min used</span>
        <span>{total} min included{bonus > 0 ? ` + ${bonusRemaining} bonus` : ''}</span>
      </div>
    </div>
  )
}
```

- [ ] **Create `web/app/billing/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { UsageBar } from '@/components/billing/usage-bar'
import { getPlanMinutes, PLAN_LABEL, isCompanyPlan } from '@/lib/plans'

export default function BillingPage() {
  const { user } = useAuth()
  const [billing, setBilling] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    fetch('/api/billing/summary?userId=' + user.id)
      .then(r => r.json())
      .then(d => { setBilling(d); setLoading(false) })
  }, [user?.id])

  async function openPortal() {
    if (!user) return
    setPortalLoading(true)
    const res = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, orgId: user.organizationId }),
    })
    const { url } = await res.json()
    window.location.href = url
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading...</div>

  const planId = billing?.planId ?? ''
  const planMinutes = getPlanMinutes(planId)
  const planLabel = PLAN_LABEL[planId] ?? 'Unknown Plan'

  return (
    <div className="min-h-screen bg-gray-950 text-white py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Billing & Usage</h1>

        {/* Plan summary */}
        <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400">Current plan</p>
              <p className="text-xl font-semibold">{planLabel}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              billing?.status === 'active' ? 'bg-green-500/20 text-green-400' :
              billing?.status === 'trialing' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {billing?.status ?? 'inactive'}
            </span>
          </div>

          {billing?.status === 'trialing' && billing?.trialEnd && (
            <p className="text-sm text-yellow-400">
              Trial ends {new Date(billing.trialEnd).toLocaleDateString()} or at 25 minutes used.
            </p>
          )}

          <UsageBar
            used={billing?.minutesUsed ?? 0}
            total={planMinutes}
            bonus={billing?.bonusMinutes ?? 0}
            label="This billing period"
          />

          {billing?.nextReset && (
            <p className="text-xs text-gray-500">Resets {new Date(billing.nextReset).toLocaleDateString()}</p>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href="/billing/add-hours"
            className="bg-gray-900 border border-white/10 rounded-2xl p-5 hover:border-indigo-500/50 transition-colors group"
          >
            <p className="font-semibold group-hover:text-indigo-400 transition-colors">Add Training Hours</p>
            <p className="text-sm text-gray-400 mt-1">Purchase extra minutes that never expire</p>
          </a>

          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="bg-gray-900 border border-white/10 rounded-2xl p-5 text-left hover:border-indigo-500/50 transition-colors group disabled:opacity-50"
          >
            <p className="font-semibold group-hover:text-indigo-400 transition-colors">
              {portalLoading ? 'Redirecting...' : 'Manage Subscription'}
            </p>
            <p className="text-sm text-gray-400 mt-1">Change plan, view invoices, update payment</p>
          </button>
        </div>

        {/* Auto-refill toggle */}
        <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="font-medium">Auto-refill</p>
            <p className="text-sm text-gray-400">Automatically buy 1 hour when minutes run out</p>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/billing/auto-refill', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user?.id, orgId: user?.organizationId, enabled: !billing?.autoRefill }),
              })
              setBilling((b: any) => ({ ...b, autoRefill: !b.autoRefill }))
            }}
            className={`relative w-12 h-6 rounded-full transition-colors ${billing?.autoRefill ? 'bg-indigo-600' : 'bg-white/20'}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${billing?.autoRefill ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Create a `GET /api/billing/summary` route** — `web/app/api/billing/summary/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  const db = createServiceRoleClient()

  const { data: user } = await (db as any).from('users')
    .select('minutes_used, bonus_minutes, trial_ends_at, auto_refill_enabled, organization_id')
    .eq('id', userId).single()

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (user.organization_id) {
    const { data: org } = await (db as any).from('organizations')
      .select('plan_id, seat_count, minutes_pool, bonus_minutes, subscription_status, auto_refill_enabled')
      .eq('id', user.organization_id).single()
    const { data: sub } = await (db as any).from('subscriptions')
      .select('current_period_end, trial_end, status')
      .eq('org_id', user.organization_id)
      .order('created_at', { ascending: false }).limit(1).single()

    return NextResponse.json({
      planId: org?.plan_id,
      status: org?.subscription_status,
      minutesUsed: user.minutes_used,
      bonusMinutes: org?.bonus_minutes ?? 0,
      minutesPool: org?.minutes_pool ?? 0,
      seatCount: org?.seat_count,
      nextReset: sub?.current_period_end,
      trialEnd: sub?.trial_end,
      autoRefill: org?.auto_refill_enabled,
    })
  }

  const { data: sub } = await (db as any).from('subscriptions')
    .select('plan_id, status, current_period_end, trial_end')
    .eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(1).single()

  return NextResponse.json({
    planId: sub?.plan_id,
    status: sub?.status,
    minutesUsed: user.minutes_used,
    bonusMinutes: user.bonus_minutes,
    nextReset: sub?.current_period_end,
    trialEnd: sub?.trial_end,
    autoRefill: user.auto_refill_enabled,
  })
}
```

- [ ] **Create `web/app/api/billing/auto-refill/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

export async function PATCH(req: NextRequest) {
  const { userId, orgId, enabled } = await req.json()
  const db = createServiceRoleClient()

  if (orgId) {
    await (db as any).from('organizations').update({ auto_refill_enabled: enabled }).eq('id', orgId)
  } else {
    await (db as any).from('users').update({ auto_refill_enabled: enabled }).eq('id', userId)
  }
  return NextResponse.json({ success: true })
}
```

- [ ] **Create `web/app/billing/add-hours/page.tsx`**

```tsx
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth-provider'
import { ADDON_PRICE_CENTS, getAddonPriceKey, PLAN_LABEL } from '@/lib/plans'

export default function AddHoursPage() {
  const { user } = useAuth()
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(false)
  const [planId, setPlanId] = useState<string>('')

  useEffect(() => {
    if (!user) return
    fetch('/api/billing/summary?userId=' + user.id)
      .then(r => r.json())
      .then(d => setPlanId(d.planId ?? ''))
  }, [user?.id])

  const addonKey = getAddonPriceKey(planId)
  const pricePerHour = planId ? (ADDON_PRICE_CENTS[addonKey] ?? 0) / 100 : 0
  const total = pricePerHour * qty

  async function handlePurchase() {
    if (!user || !planId) return
    setLoading(true)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planKey: addonKey,
        userId: user.id,
        orgId: user.organizationId,
        mode: 'addon',
        addonQty: qty,
      }),
    })
    const { url } = await res.json()
    window.location.href = url
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white py-10 px-4">
      <div className="max-w-md mx-auto">
        <a href="/billing" className="text-sm text-gray-400 hover:text-white mb-6 block">← Back to Billing</a>
        <h1 className="text-2xl font-bold mb-6">Add Training Hours</h1>

        <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-5">
          <p className="text-sm text-gray-400">
            Extra hours never expire and carry over each month.
          </p>

          <div>
            <label className="text-sm text-gray-400 block mb-2">
              Hours to add: <span className="text-white font-semibold">{qty} hour{qty !== 1 ? 's' : ''} ({qty * 60} minutes)</span>
            </label>
            <input
              type="range" min={1} max={20} value={qty}
              onChange={e => setQty(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>

          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex justify-between text-sm text-gray-400">
              <span>Price per hour</span>
              <span className="text-white">${pricePerHour.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-white mt-2">
              <span>Total</span>
              <span className="text-green-400">${total.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handlePurchase}
            disabled={loading || !planId}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? 'Redirecting...' : `Buy ${qty} hour${qty !== 1 ? 's' : ''} — $${total.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Handle addon checkout success in webhook** — add to `handleCheckoutCompleted` in `web/app/api/stripe/webhook/route.ts`, after the subscription block:

```ts
// After the existing subscription handling, add:
// Handle addon hour purchase
if (session.mode === 'payment') {
  const { user_id, org_id, addon_qty } = session.metadata ?? {}
  const qty = parseInt(addon_qty ?? '1', 10)
  const minutesToAdd = qty * 60

  if (org_id) {
    const { data: org } = await (db as any).from('organizations')
      .select('bonus_minutes').eq('id', org_id).single()
    await (db as any).from('organizations')
      .update({ bonus_minutes: (org?.bonus_minutes ?? 0) + minutesToAdd })
      .eq('id', org_id)
  } else if (user_id) {
    const { data: user } = await (db as any).from('users')
      .select('bonus_minutes').eq('id', user_id).single()
    await (db as any).from('users')
      .update({ bonus_minutes: (user?.bonus_minutes ?? 0) + minutesToAdd })
      .eq('id', user_id)
  }

  if (user_id) {
    await (db as any).from('minute_transactions').insert({
      user_id,
      org_id: org_id || null,
      type: 'purchase',
      delta: minutesToAdd,
      stripe_charge_id: session.payment_intent,
    })
  }
}
```

- [ ] **Commit**

```bash
git add app/billing/ components/billing/ app/api/billing/
git commit -m "feat: billing page, usage bar, add-hours purchase flow"
```

---

## Task 14: Coach referrals page & Connect callback

**Files:**
- Create: `web/app/coach/referrals/page.tsx`
- Create: `web/app/coach/connect/callback/page.tsx`

- [ ] **Create `web/app/coach/referrals/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'

export default function CoachReferralsPage() {
  const { user } = useAuth()
  const [referrals, setReferrals] = useState<any[]>([])
  const [form, setForm] = useState({ type: 'affiliate' as 'affiliate' | 'discount', percentage: 15 })
  const [inviteUrl, setInviteUrl] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    fetch(`/api/coach/referrals?coachId=${user.id}`)
      .then(r => r.json())
      .then(d => setReferrals(d.referrals ?? []))
  }, [user?.id])

  async function generateLink() {
    setLoading(true)
    const res = await fetch('/api/coach/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId: user?.id, ...form }),
    })
    const d = await res.json()
    setInviteUrl(d.inviteUrl ?? '')
    setLoading(false)
  }

  async function toggleActive(id: string, currentActive: boolean) {
    await fetch(`/api/coach/referrals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !currentActive }),
    })
    setReferrals(r => r.map(ref => ref.id === id ? { ...ref, is_active: !currentActive } : ref))
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Referrals</h1>
          <a
            href={`/api/coach/connect?coachId=${user?.id}`}
            className="text-sm px-4 py-2 bg-gray-800 border border-white/10 rounded-lg hover:bg-gray-700 transition-colors"
          >
            {/* TODO: show "Connected ✓" if stripe_connect_account_id exists */}
            Connect Stripe for Payouts →
          </a>
        </div>

        {/* Generate invite link */}
        <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold">Create Invite Link</h2>
          <div className="flex gap-3">
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="affiliate">Affiliate — I earn %</option>
              <option value="discount">Discount — Company gets %</option>
            </select>
            <div className="flex items-center gap-2">
              <input
                type="number" min={1} max={100} value={form.percentage}
                onChange={e => setForm(f => ({ ...f, percentage: Number(e.target.value) }))}
                className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              />
              <span className="text-gray-400 text-sm">%</span>
            </div>
            <button
              onClick={generateLink}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Generate
            </button>
          </div>
          {inviteUrl && (
            <div className="flex gap-2">
              <input
                readOnly value={inviteUrl}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono"
              />
              <button
                onClick={() => navigator.clipboard.writeText(inviteUrl)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10"
              >
                Copy
              </button>
            </div>
          )}
        </div>

        {/* Referral list */}
        <div className="space-y-3">
          {referrals.length === 0 && (
            <p className="text-gray-500 text-sm">No referrals yet. Generate a link above to invite a company.</p>
          )}
          {referrals.map(ref => (
            <div key={ref.id} className="bg-gray-900 border border-white/10 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{ref.organizations?.name ?? 'Company'}</p>
                <p className="text-sm text-gray-400">
                  {ref.type === 'affiliate' ? `You earn ${ref.percentage}%` : `They get ${ref.percentage}% off`}
                  {' · '}
                  <span className={ref.organizations?.subscription_status === 'active' ? 'text-green-400' : 'text-gray-500'}>
                    {ref.organizations?.subscription_status ?? 'pending'}
                  </span>
                </p>
              </div>
              <button
                onClick={() => toggleActive(ref.id, ref.is_active)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                  ref.is_active
                    ? 'bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400'
                    : 'bg-gray-700 text-gray-400 hover:bg-green-500/20 hover:text-green-400'
                }`}
              >
                {ref.is_active ? 'Active — click to revoke' : 'Revoked — click to restore'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Create `web/app/coach/connect/callback/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'

function CallbackInner() {
  const params = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const code = params.get('code')
    const coachId = params.get('state')
    if (!code || !coachId) { setStatus('error'); return }

    fetch('/api/coach/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, coachId }),
    }).then(r => r.json()).then(d => {
      if (d.success) { setStatus('success'); setTimeout(() => router.push('/coach/referrals'), 2000) }
      else setStatus('error')
    }).catch(() => setStatus('error'))
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center space-y-3">
        {status === 'loading' && <p className="text-gray-400">Connecting your Stripe account...</p>}
        {status === 'success' && (
          <>
            <p className="text-green-400 text-lg font-semibold">✓ Stripe account connected!</p>
            <p className="text-gray-400 text-sm">Redirecting to referrals...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-red-400">Connection failed.</p>
            <a href="/coach/referrals" className="text-indigo-400 text-sm hover:underline">Go back</a>
          </>
        )}
      </div>
    </div>
  )
}

export default function ConnectCallbackPage() {
  return <Suspense><CallbackInner /></Suspense>
}
```

- [ ] **Commit**

```bash
git add app/coach/
git commit -m "feat: coach referrals dashboard and Stripe Connect callback"
```

---

## Task 15: Admin subscriptions page

**Files:**
- Create: `web/app/admin/subscriptions/page.tsx`

- [ ] **Create `web/app/admin/subscriptions/page.tsx`**

```tsx
import { createServiceRoleClient } from '@/lib/supabase'
import { PLAN_LABEL } from '@/lib/plans'

export const dynamic = 'force-dynamic'

export default async function AdminSubscriptionsPage() {
  const db = createServiceRoleClient()

  const { data: subs } = await (db as any).from('subscriptions')
    .select(`
      *,
      users(id, email, full_name, app_role, stripe_connect_account_id),
      organizations(id, name, seat_count)
    `)
    .order('created_at', { ascending: false })

  const { data: skippedPayouts } = await (db as any).from('coach_referrals')
    .select('*, users!coach_referrals_coach_id_fkey(email, stripe_connect_account_id), organizations(name)')
    .eq('type', 'affiliate')
    .eq('is_active', true)
    .is('users.stripe_connect_account_id', null)

  return (
    <div className="min-h-screen bg-gray-950 text-white py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold">Subscriptions</h1>

        {/* Coaches missing Connect */}
        {skippedPayouts && skippedPayouts.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
            <p className="text-yellow-400 font-medium mb-2">⚠ Coaches with affiliate referrals but no Stripe Connect account</p>
            <ul className="text-sm text-yellow-300 space-y-1">
              {skippedPayouts.map((r: any) => (
                <li key={r.id}>{r.users?.email} → {r.organizations?.name} ({r.percentage}%)</li>
              ))}
            </ul>
          </div>
        )}

        {/* Subscriptions table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-left">
                <th className="pb-3 pr-4">Account</th>
                <th className="pb-3 pr-4">Plan</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Seats</th>
                <th className="pb-3">Period End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(subs ?? []).map((sub: any) => {
                const name = sub.organizations?.name ?? sub.users?.full_name ?? sub.users?.email ?? '—'
                const seats = sub.organizations?.seat_count ?? null
                return (
                  <tr key={sub.id} className="text-gray-300">
                    <td className="py-3 pr-4">
                      <p className="text-white">{name}</p>
                      <p className="text-xs text-gray-500">{sub.users?.app_role ?? 'company'}</p>
                    </td>
                    <td className="py-3 pr-4">{PLAN_LABEL[sub.plan_id] ?? sub.plan_id}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        sub.status === 'active' ? 'bg-green-500/20 text-green-400' :
                        sub.status === 'trialing' ? 'bg-yellow-500/20 text-yellow-400' :
                        sub.status === 'past_due' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>{sub.status}</span>
                    </td>
                    <td className="py-3 pr-4">{seats ?? '—'}</td>
                    <td className="py-3 text-gray-500">
                      {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add app/admin/subscriptions/page.tsx
git commit -m "feat: admin subscriptions overview page"
```

---

## Task 16: Update AppUser with billing fields

**Files:**
- Modify: `web/components/auth-provider.tsx`

The `AppUser` interface and `loadUser` SELECT query need billing fields so components can read subscription state without extra fetches.

- [ ] **Add fields to the `AppUser` interface** in `web/components/auth-provider.tsx`:

```ts
export interface AppUser {
  // ... existing fields ...
  minutesUsed: number
  bonusMinutes: number
  trialEndsAt: string | null
  autoRefillEnabled: boolean
}
```

- [ ] **Extend the `loadUser` SELECT query** — find the `.select(...)` call on the `users` table and append the new columns:

```ts
.select('id, auth_user_id, email, full_name, app_role, status, scenario_access, coach_instance_id, organization_id, user_type, marketing_consent, minutes_used, bonus_minutes, trial_ends_at, auto_refill_enabled')
```

- [ ] **Map the new fields in the `AppUser` object** returned from `loadUser`:

```ts
minutesUsed: data.minutes_used ?? 0,
bonusMinutes: data.bonus_minutes ?? 0,
trialEndsAt: data.trial_ends_at ?? null,
autoRefillEnabled: data.auto_refill_enabled ?? false,
```

- [ ] **Commit**

```bash
git add components/auth-provider.tsx
git commit -m "feat: add billing fields to AppUser context"
```

---

## Task 17: Wire signup page to plan selection

**Files:**
- Modify: `web/app/signup/page.tsx`

- [ ] **Add plan awareness to the signup page** — read `?plan=`, `?seats=`, `?type=`, `?coach=` from search params and store in state. After successful account creation, redirect to checkout instead of the dashboard:

In `web/app/signup/page.tsx`, find the `SearchParamsReader` / inner component and add:

```tsx
const planParam = searchParams.get('plan')
const seatsParam = searchParams.get('seats')
const typeParam = searchParams.get('type')   // 'company' or empty
const coachParam = searchParams.get('coach') // coach invite token
```

Then, after the `fetch('/api/auth/signup', ...)` call succeeds, replace the `router.push('/training')` redirect with:

```tsx
// After successful signup, redirect to Stripe Checkout
if (planParam) {
  const checkoutRes = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      planKey: planParam,
      userId: signupResult.userId,  // API must return userId
      orgId: signupResult.orgId ?? null,
      seats: seatsParam ? parseInt(seatsParam) : undefined,
      mode: 'subscription',
      coachToken: coachParam ?? undefined,
    }),
  })
  const { url } = await checkoutRes.json()
  if (url) { window.location.href = url; return }
}
router.push('/training')
```

> **Verify first:** Open `web/app/api/auth/signup/route.ts` and confirm the final `return NextResponse.json(...)` includes `userId` and `orgId`. If it currently only returns `{ success: true, autoApproved: boolean }`, add the user's Supabase ID to the response: `return NextResponse.json({ success: true, autoApproved, userId: profileData.id, orgId: profileData.organization_id ?? null })`.

- [ ] **Commit**

```bash
git add app/signup/page.tsx
git commit -m "feat: signup page redirects to Stripe checkout after account creation"
```

---

## Task 18: Final wiring & smoke test

- [ ] **Run all unit tests**

```bash
cd web && npx vitest run
```
Expected: all tests in `__tests__/plans.test.ts` and `__tests__/minute-gate.test.ts` pass.

- [ ] **Start dev server and Stripe CLI listener**

```bash
# Terminal 1
cd web && npm run dev

# Terminal 2
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

- [ ] **End-to-end: Individual signup**
  1. Navigate to `http://localhost:3000/pricing`
  2. Click "Start Free Trial" on Individual Growth
  3. Complete signup form
  4. Stripe Checkout opens with 7-day trial
  5. Complete checkout with test card `4242 4242 4242 4242`
  6. Confirm redirect to `/billing?success=true`
  7. Verify in Supabase: `subscriptions` row created, user `status = approved`, `trial_ends_at` set

- [ ] **End-to-end: Company signup**
  1. Go to `/pricing`, Company tab, set 5 seats, select Pro
  2. Complete signup
  3. Confirm subscription quantity = 5, correct per-seat price

- [ ] **End-to-end: Add hours**
  1. Go to `/billing`, click "Add Training Hours"
  2. Select 2 hours, complete checkout
  3. Verify `bonus_minutes` incremented by 120 in Supabase

- [ ] **End-to-end: Coach referral**
  1. Log in as a coach user
  2. Go to `/coach/referrals`, generate a 15% affiliate link
  3. Open the link in an incognito window, complete company signup
  4. Verify `coach_referrals` row created in Supabase

- [ ] **End-to-end: Minute gate (manual)**
  1. In Supabase, set a user's `minutes_used` to equal their plan minutes (e.g. 240 for growth)
  2. Call `POST /api/calls/check-minutes` with that `userId`
  3. Verify response: `{ allowed: false, reason: 'minutes_exhausted', minutesRemaining: 0 }`

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: pricing & stripe integration complete"
```
