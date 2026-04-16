import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

// PATCH — edit percentage or revoke
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { percentage, is_active } = await req.json()
  const db = createServiceRoleClient()

  const updates: Record<string, unknown> = {}
  if (percentage !== undefined) updates.percentage = percentage
  if (is_active !== undefined) updates.is_active = is_active

  const { data: referral } = await (db as any).from('coach_referrals')
    .select('*').eq('id', id).single()
  if (!referral) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // If revoking a discount, remove the Stripe coupon from the subscription
  if (is_active === false && referral.type === 'discount' && referral.stripe_coupon_id) {
    try {
      const { data: org } = await (db as any).from('organizations')
        .select('stripe_subscription_id').eq('id', referral.org_id).single()
      if (org?.stripe_subscription_id) {
        await stripe.subscriptions.update(org.stripe_subscription_id, { discounts: [] })
      }
    } catch (err: unknown) {
      console.warn('Failed to remove discount from subscription:', err instanceof Error ? err.message : String(err))
    }
  }

  await (db as any).from('coach_referrals').update(updates).eq('id', id)
  return NextResponse.json({ success: true })
}
