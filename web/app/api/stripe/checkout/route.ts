import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getPriceId } from '@/lib/stripe-prices'
import { isCompanyPlan, TRIAL_DAYS } from '@/lib/plans'
import { createServiceRoleClient } from '@/lib/supabase'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// POST /api/stripe/checkout
// Body: { planKey, userId, orgId?, seats?, mode, addonQty? }
// mode: 'subscription' | 'addon'
export async function POST(req: NextRequest) {
  const { planKey, userId, orgId, seats, mode, addonQty, coachToken } = await req.json()

  if (!planKey || !userId) {
    return NextResponse.json({ error: 'Missing planKey or userId' }, { status: 400 })
  }

  const db = createServiceRoleClient()

  try {
    // Get or create Stripe customer
    let customerId: string | undefined
    if (orgId) {
      const { data: org } = await (db as any).from('organizations')
        .select('stripe_customer_id, name').eq('id', orgId).single()
      customerId = org?.stripe_customer_id ?? undefined
      // Create org customer if missing
      if (!customerId && org) {
        const customer = await stripe.customers.create({
          name: org.name,
          metadata: { org_id: orgId },
        })
        customerId = customer.id
        await (db as any).from('organizations').update({ stripe_customer_id: customerId }).eq('id', orgId)
      }
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
        metadata: {
          user_id: userId,
          org_id: orgId ?? '',
          addon_key: planKey,
          addon_qty: String(addonQty ?? 1),
        },
        success_url: `${APP_URL}/billing?addon_success=true`,
        cancel_url: `${APP_URL}/billing/add-hours`,
      })
      return NextResponse.json({ url: session.url })
    }

    // Subscription checkout
    const quantity = isCompanyPlan(planKey) ? (seats ?? 2) : 1

    // Coach discount coupon (only for subscription + discount type token)
    let discounts: { coupon: string }[] = []
    if (coachToken && mode !== 'addon') {
      const { verifyCoachToken } = await import('@/lib/coach-token')
      const payload = verifyCoachToken(coachToken as string)
      if (payload?.type === 'discount') {
        const coupon = await stripe.coupons.create({
          percent_off: payload.percentage,
          duration: 'forever',
          metadata: { coach_id: payload.coachId, org_id: orgId ?? '' },
        })
        discounts = [{ coupon: coupon.id }]
        // Store coupon_id on coach_referrals row (best-effort)
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
