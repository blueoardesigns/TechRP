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
