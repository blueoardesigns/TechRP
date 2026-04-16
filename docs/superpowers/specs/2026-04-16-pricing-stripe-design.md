# TechRP Pricing & Stripe Integration — Design Spec

**Date:** 2026-04-16  
**Status:** Approved  
**Approach:** Stripe Subscriptions (flat) + Supabase Minute Tracking + Stripe Connect for coach payouts

---

## 1. Overview

Add a full subscription and billing system to TechRP. Technicians and companies pay monthly for access to voice AI training calls, metered by minutes. Additional hour blocks can be purchased on demand. Coaches receive a free account and earn recurring affiliate revenue (or offer discounts) to companies they bring on. All payments processed through Stripe; coach payouts via Stripe Connect Express.

**Superuser exception:** `tim@blueoardesigns.com` (`app_role = 'superuser'`) has unlimited minutes and bypasses all billing enforcement. No Stripe customer is created for this account.

---

## 2. Pricing Plans

### Individual Plans

| Plan Key | Minutes/Month | Monthly Fee | Add'l Hour |
|---|---|---|---|
| `individual_starter` | 120 min | $34.99 | $14.99 |
| `individual_growth` | 240 min | $57.99 | $12.99 |
| `individual_pro` | 400 min | $89.99 | $10.99 |

- Weekly minute figures (30/60/100) are display-only. Enforcement is monthly.
- Minutes reset to 0 on each billing cycle renewal.
- Purchased bonus minutes roll over indefinitely and are consumed after plan minutes are exhausted.

### Company Plans — Standard (120 min/user/month)

| Price Key | Seats | Per User/Month | Add'l Hour |
|---|---|---|---|
| `co_std_t1` | 2–4 | $27.99 | $10.99 |
| `co_std_t2` | 5–19 | $24.99 | $9.99 |
| `co_std_t3` | 20–49 | $21.99 | $8.99 |
| `co_std_t4` | 50+ | $18.99 | $8.49 |

### Company Plans — Pro (240 min/user/month)

| Price Key | Seats | Per User/Month | Add'l Hour |
|---|---|---|---|
| `co_pro_t1` | 2–4 | $44.99 | $10.99 |
| `co_pro_t2` | 5–19 | $42.99 | $9.99 |
| `co_pro_t3` | 20–49 | $39.99 | $8.99 |
| `co_pro_t4` | 50+ | $34.99 | $8.49 |

**Company minute pool:** Total org minutes = `seat_count × plan_minutes_per_user`. Minutes are shared across the org. Any individual user is hard-capped at 150% of their plan's per-user allocation (Standard: 180 min/user, Pro: 360 min/user). Active calls always complete even if the cap is hit mid-call; overage is forgiven.

---

## 3. Trial

- Every new signup (individual or company) gets a **7-day free trial**.
- Trial also ends when **25 minutes of calls** are consumed — whichever comes first.
- Credit card is required at signup. No charge until trial ends.
- 25-minute cutoff: tracked in Supabase (`minutes_used`). When hit, call `stripe.subscriptions.update({ trial_end: 'now' })` to end the Stripe trial immediately.

---

## 4. Additional Hour Blocks

- Purchased as **Stripe one-time Payment Intents** (not recurring).
- 60 minutes added to `bonus_minutes` immediately on payment success.
- Bonus minutes roll over indefinitely; never reset on billing cycle.
- Two purchase modes:
  - **Manual:** User selects number of hours to buy at `/billing/add-hours`.
  - **Auto-refill:** When minutes hit 0, automatically trigger a one-time charge for 1 hour block. Toggled via `auto_refill_enabled` on `users`.
- Add-on price is determined by the user's current plan tier (individual) or org seat tier (company).

---

## 5. Database Schema Changes

### New columns on `users`

| Column | Type | Purpose |
|---|---|---|
| `minutes_used` | integer default 0 | Minutes consumed this billing period |
| `bonus_minutes` | integer default 0 | Purchased extra minutes (rollover) |
| `trial_ends_at` | timestamptz nullable | Trial expiry timestamp (null = not in trial) |
| `stripe_customer_id` | text nullable | Stripe customer ID (individuals only) |
| `auto_refill_enabled` | boolean default false | Auto-purchase 1hr block when minutes hit 0 |
| `stripe_connect_account_id` | text nullable | Stripe Connect Express account (coaches only) |

### New columns on `organizations`

| Column | Type | Purpose |
|---|---|---|
| `stripe_customer_id` | text nullable | Stripe customer for org billing |
| `stripe_subscription_id` | text nullable | Active Stripe subscription ID |
| `plan_id` | text nullable | e.g. `co_std_t1`, `co_pro_t2` |
| `seat_count` | integer default 0 | Purchased seats |
| `minutes_pool` | integer default 0 | Remaining shared minutes (reset monthly) |
| `bonus_minutes` | integer default 0 | Org-level purchased extra minutes (rollover) |
| `subscription_status` | text default 'inactive' | `active` / `trialing` / `past_due` / `canceled` / `inactive` |
| `auto_refill_enabled` | boolean default false | Auto-purchase 1hr block when org minutes pool hits 0 (admin sets this) |

### New table: `subscriptions`

One row per subscription. Covers both individual users and orgs.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid nullable FK → users | Set for individual plans; null for orgs |
| `org_id` | uuid nullable FK → organizations | Set for company plans; null for individuals |
| `stripe_subscription_id` | text unique | |
| `stripe_price_id` | text | Active Stripe Price ID |
| `plan_id` | text | Internal plan key (e.g. `individual_growth`) |
| `status` | text | Mirrors Stripe: `trialing` / `active` / `past_due` / `canceled` |
| `current_period_start` | timestamptz | |
| `current_period_end` | timestamptz | Used for monthly minute resets |
| `trial_end` | timestamptz nullable | |
| `canceled_at` | timestamptz nullable | |
| `created_at` | timestamptz default now() | |

### New table: `coach_referrals`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `coach_id` | uuid FK → users | Must have `app_role = 'coach'` |
| `org_id` | uuid FK → organizations | The referred company |
| `type` | text | `'discount'` or `'affiliate'` — either/or per referral |
| `percentage` | integer | e.g. 15 = 15%. Editable by coach or superuser |
| `stripe_coupon_id` | text nullable | Stripe coupon ID (discount type only) |
| `is_active` | boolean default true | false = revoked |
| `created_at` | timestamptz default now() | |

### New table: `minute_transactions`

Append-only audit log of every minute debit and credit.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | Who consumed/received minutes |
| `org_id` | uuid nullable | Set for company users |
| `type` | text | `call_usage` / `purchase` / `monthly_reset` / `trial_grant` |
| `delta` | integer | Positive = credit, negative = debit |
| `session_id` | uuid nullable | Links to `training_sessions` for call_usage |
| `stripe_charge_id` | text nullable | Links to Stripe charge for purchases |
| `created_at` | timestamptz default now() | |

---

## 6. Stripe Product Structure

All products and prices are created via a seed script (`POST /api/stripe/seed`) using idempotency keys. Resulting Stripe Price IDs are stored in `web/lib/stripe-prices.ts`.

### Products
- **TechRP Individual** — 3 recurring prices (individual_starter, individual_growth, individual_pro)
- **TechRP Company Standard** — 4 per-seat recurring prices (co_std_t1–t4)
- **TechRP Company Pro** — 4 per-seat recurring prices (co_pro_t1–t4)
- **TechRP Add-on Hours** — 7 one-time prices (addon_hr_individual_starter, addon_hr_individual_growth, addon_hr_individual_pro, addon_hr_co_t1–t4)

### Company Subscription Mechanics
- Stripe subscription uses `quantity = seat_count`.
- When seat count crosses a tier boundary, update the subscription: swap to the new price + update quantity in a single Stripe API call.
- Tier boundaries: 2–4, 5–19, 20–49, 50+.

### Stripe Connect (Coach Payouts)
- Platform must be approved for Connect in Stripe dashboard (one-time, ~1 business day).
- Coaches onboard via Stripe Connect Express OAuth flow.
- `stripe_connect_account_id` stored on coach's `users` row.
- On `invoice.payment_succeeded` webhook: find active affiliate `coach_referrals` row for org → calculate `invoice_total × (percentage / 100)` → `stripe.transfers.create()` to coach's Connect account.

### Stripe Coupons (Coach Discounts)
- Created per referral: `percent_off: N, duration: 'forever'`.
- Attached to Stripe subscription at checkout when company signs up via a discount referral link.
- On revoke: call Stripe API to remove coupon from subscription. Takes effect next billing cycle.

---

## 7. Signup Flows

### Individual
1. `/pricing` — public page, pick plan, click Get Started → `/signup?plan=individual_growth` (+ optional `?ref=CODE` for coach discount)
2. `/signup` — create account (name, email, password). Plan and coach ref stored in session.
3. Redirect to **Stripe hosted Checkout** — selected price, `trial_period_days: 7`. If coach discount ref valid: Stripe coupon attached.
4. On `checkout.session.completed` webhook: create `subscriptions` row, set user `status = approved`, set `trial_ends_at = now + 7 days`, write `minute_transactions` row (type: `trial_grant`, delta: +25).

### Company
1. `/pricing` — Company tab, select Standard or Pro, enter seat count (min 2). Live calculator shows per-seat price + monthly total based on tier.
2. `/signup?plan=company&seats=N&tier=std|pro` — admin creates account + org name.
3. Stripe Checkout — correct per-seat price auto-selected, `quantity = seat_count`, 7-day trial.
4. On `checkout.session.completed`: create org `subscriptions` row, set `minutes_pool = seat_count × plan_minutes_per_user`, admin `status = approved`.

---

## 8. Minute Enforcement

Pre-call gate: `POST /api/calls/check-minutes` — called by mobile app before Vapi is initiated. Returns `{ allowed: bool, reason?: string, minutes_remaining: number }`.

### Check sequence (in order)
1. **Superuser bypass** — if `app_role = 'superuser'`, return `allowed: true` immediately.
2. **Subscription active?** — if status is `canceled` or `past_due`, block. Show upgrade/payment prompt.
3. **Trial expired?** — if `now > trial_ends_at` AND subscription status is still `trialing`, block with trial-ended screen.
4. **Minutes available?**
   - Individual: `minutes_used < plan_minutes + bonus_minutes`
   - Company: `org.minutes_pool + org.bonus_minutes > 0` AND `user.minutes_used < per_user_cap`
   - If depleted: block. If `auto_refill_enabled`, trigger auto-refill first (one-time charge), then re-check.

### Post-call usage recording
`POST /api/calls/record-usage` — called when Vapi call ends, with `{ session_id, duration_seconds }`.
- Round up to nearest minute.
- Deduct from `minutes_used` (user) and `minutes_pool` (org, if applicable).
- Write `minute_transactions` row (type: `call_usage`).
- If individual and `minutes_used ≥ 25` during trial: call `stripe.subscriptions.update({ trial_end: 'now' })`.
- If `auto_refill_enabled` and minutes_used now exceeds allowance: trigger refill charge.
- Overage after an active call is always forgiven — never block retroactively.

### Monthly reset
On `invoice.payment_succeeded` webhook:
- Reset `minutes_used = 0` for all users on the subscription.
- Replenish `org.minutes_pool = seat_count × plan_minutes_per_user` for company plans.
- `bonus_minutes` is never reset.
- Write `minute_transactions` row (type: `monthly_reset`) for audit trail.

---

## 9. Coach Affiliate System

### Creating a referral
1. Coach navigates to `/coach/referrals`, clicks "Invite Company".
2. Chooses type (`discount` or `affiliate`) and sets percentage (integer, 1–100).
3. API generates a signed token encoding `{ coach_id, type, percentage }` → returns invite URL `/signup?coach=TOKEN`.
4. Coach copies and sends link to company.

### Company signs up via coach link
- Token decoded at `/signup`. `coach_referrals` row created with `is_active: true`.
- **Discount:** Stripe coupon created (`percent_off: N, duration: forever`) and attached at Stripe Checkout.
- **Affiliate:** No Stripe coupon. Referral row is sufficient — webhook handles payouts.

### Affiliate payout
- Fires on every `invoice.payment_succeeded` for the org.
- Checks for active affiliate `coach_referrals` row.
- Calculates `Math.floor(invoice_total_cents × percentage / 100)`.
- Calls `stripe.transfers.create({ amount, currency: 'usd', destination: coach.stripe_connect_account_id })`.
- Coach must have completed Connect onboarding; if not, the payout is skipped and logged to server logs with the invoice ID and calculated amount. The `/admin/subscriptions` page surfaces coaches with active affiliate referrals but no Connect account so the superuser can follow up. No automatic retry.

### Revoking
- Coach (or superuser) sets `is_active = false` on `coach_referrals` row.
- If discount type: call Stripe API to remove coupon from subscription — takes effect next billing cycle.
- If affiliate type: future invoice webhooks skip the transfer check.
- Coach can re-activate or adjust percentage at any time on any referral.

### Coach subscription
- Coaches get a free account with no minute allowance by default.
- If a coach wants to run practice calls themselves, they sign up for an individual plan like any other user.
- No special coach pricing tier.

---

## 10. New Pages

| Route | Access | Purpose |
|---|---|---|
| `/pricing` | Public | Individual + Company plan tables, seat calculator, CTA |
| `/billing` | Individual + Company admin | Plan overview, usage bar, buy hours, auto-refill toggle, Stripe portal link |
| `/billing/add-hours` | Individual + Company admin | Select hour quantity → Stripe one-time checkout |
| `/coach/referrals` | Coach only | List companies, type/%, earnings, revoke/edit, create invite link, Connect onboarding |
| `/coach/connect/callback` | Coach only | Stripe Connect Express OAuth return — saves connect account ID |
| `/admin/subscriptions` | Superuser only | All subscriptions, revenue overview, manual plan override |

---

## 11. New API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/stripe/seed` | POST | Create all Stripe products + prices, write IDs to `stripe-prices.ts` |
| `/api/stripe/checkout` | POST | Create Stripe Checkout session (subscription or add-on) |
| `/api/stripe/webhook` | POST | Handle all Stripe events |
| `/api/stripe/portal` | POST | Create Stripe Customer Portal session |
| `/api/calls/check-minutes` | POST | Pre-call gate: returns allow/block/warn + remaining minutes |
| `/api/calls/record-usage` | POST | Post-call: deduct minutes, write transaction, trigger auto-refill |
| `/api/coach/referrals` | GET, POST | List or create referral tokens |
| `/api/coach/referrals/[id]` | PATCH, DELETE | Edit percentage or revoke |
| `/api/coach/connect` | GET | Initiate Stripe Connect Express OAuth |

### Webhook events handled
- `checkout.session.completed` — activate subscription, grant trial minutes
- `invoice.payment_succeeded` — reset minutes, fire affiliate transfers
- `invoice.payment_failed` — set subscription status to `past_due`
- `customer.subscription.updated` — sync plan/status changes to Supabase
- `customer.subscription.deleted` — set status to `canceled`

---

## 12. Environment Variables (additions)

```
# web/.env.local
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CONNECT_CLIENT_ID=     # for Connect OAuth
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

---

## 13. Out of Scope

- Seat add/remove mid-cycle proration (deferred — for now admins contact support)
- Company plan upgrades/downgrades via UI (Stripe Customer Portal handles this)
- Invoice PDF downloads (Stripe Customer Portal handles this)
- Companies inviting a coach after signup receiving any discount/bonus (by design: only pre-signup referral links count)
