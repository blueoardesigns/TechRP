import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getPriceId } from '@/lib/stripe-prices'
import { isCompanyPlan, TRIAL_DAYS } from '@/lib/plans'
import { requireUser } from '@/lib/api-auth'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
// Hard cap on coach-discount coupons. Anything larger must be issued
// out-of-band via Stripe directly.
const MAX_COACH_DISCOUNT_PCT = 50

// POST /api/stripe/checkout
// Body: { planKey, mode, seats?, addonQty?, coachToken? }
// userId/orgId are derived from the authenticated session — body values ignored.
export async function POST(req: NextRequest) {
  const auth = await requireUser({ allowNonApproved: true })
  if (!auth.ok) return auth.response
  const { user, service: db } = auth

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const planKey = typeof body.planKey === 'string' ? body.planKey : null
  const mode = body.mode === 'addon' ? 'addon' : 'subscription'
  const seats = typeof body.seats === 'number' ? body.seats : undefined
  const addonQty = typeof body.addonQty === 'number' ? Math.max(1, Math.min(100, body.addonQty)) : 1
  const coachToken = typeof body.coachToken === 'string' ? body.coachToken : undefined

  if (!planKey) return NextResponse.json({ error: 'Missing planKey' }, { status: 400 })

  const userId = user.profileId
  const orgId = user.organizationId
  // For company-plan checkouts the caller must be a company_admin or superuser.
  if (isCompanyPlan(planKey) && user.appRole !== 'company_admin' && user.appRole !== 'superuser') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Get or create Stripe customer
    let customerId: string | undefined
    if (orgId && isCompanyPlan(planKey)) {
      const { data: org } = await (db as any).from('organizations')
        .select('stripe_customer_id, name').eq('id', orgId).single()
      customerId = org?.stripe_customer_id ?? undefined
      if (!customerId && org) {
        const customer = await stripe.customers.create({
          name: org.name,
          metadata: { org_id: orgId },
        })
        customerId = customer.id
        await (db as any).from('organizations').update({ stripe_customer_id: customerId }).eq('id', orgId)
      }
    } else {
      const { data: u } = await (db as any).from('users')
        .select('stripe_customer_id, email, full_name').eq('id', userId).single()
      customerId = u?.stripe_customer_id ?? undefined
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: u?.email ?? user.email,
          name: u?.full_name,
          metadata: { user_id: userId },
        })
        customerId = customer.id
        await (db as any).from('users').update({ stripe_customer_id: customerId }).eq('id', userId)
      }
    }

    if (mode === 'addon') {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        line_items: [{
          price: getPriceId(planKey as Parameters<typeof getPriceId>[0]),
          quantity: addonQty,
        }],
        metadata: {
          user_id: userId,
          org_id: orgId ?? '',
          addon_key: planKey,
          addon_qty: String(addonQty),
        },
        success_url: `${APP_URL}/billing?addon_success=true`,
        cancel_url: `${APP_URL}/billing/add-hours`,
      })
      return NextResponse.json({ url: session.url })
    }

    const quantity = isCompanyPlan(planKey) ? (seats ?? 2) : 1

    // Coach discount coupon — clamped to prevent abuse via leaked tokens.
    let discounts: { coupon: string }[] = []
    if (coachToken) {
      const { verifyCoachToken } = await import('@/lib/coach-token')
      const payload = verifyCoachToken(coachToken)
      if (payload?.type === 'discount') {
        const pct = Number(payload.percentage)
        if (!Number.isFinite(pct) || pct <= 0 || pct > MAX_COACH_DISCOUNT_PCT) {
          return NextResponse.json(
            { error: `Coach discount percentage must be between 1 and ${MAX_COACH_DISCOUNT_PCT}` },
            { status: 400 }
          )
        }
        const coupon = await stripe.coupons.create({
          percent_off: pct,
          duration: 'forever',
          metadata: { coach_id: payload.coachId, org_id: orgId ?? '' },
        })
        discounts = [{ coupon: coupon.id }]
        try {
          await (db as any).from('coach_referrals')
            .update({ stripe_coupon_id: coupon.id })
            .eq('coach_id', payload.coachId)
            .eq('org_id', orgId)
        } catch { /* row may not exist yet — created at signup */ }
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: getPriceId(planKey as Parameters<typeof getPriceId>[0]), quantity }],
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: {
          user_id: userId,
          org_id: orgId ?? '',
          plan_id: planKey,
        },
      },
      metadata: { user_id: userId, org_id: orgId ?? '', plan_id: planKey },
      ...(discounts.length > 0 ? { discounts } : {}),
      success_url: `${APP_URL}/billing?success=true`,
      cancel_url: `${APP_URL}/pricing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Checkout session creation failed:', message)
    return NextResponse.json({ error: 'Failed to create checkout session', details: message }, { status: 500 })
  }
}
