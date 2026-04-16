import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { TRIAL_MINUTES } from '@/lib/plans'
import { stripe } from '@/lib/stripe'

// POST /api/calls/record-usage
// Body: { userId, sessionId?, durationSeconds }
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

  // Deduct from org pool if company user (never goes below 0)
  if (user.organization_id) {
    const { data: org } = await (db as any).from('organizations')
      .select('minutes_pool').eq('id', user.organization_id).single()
    if (org) {
      const newPool = Math.max(0, ((org.minutes_pool as number) ?? 0) - minutesUsed)
      await (db as any).from('organizations')
        .update({ minutes_pool: newPool })
        .eq('id', user.organization_id)
    }
  }

  // Increment user minutes_used
  const newMinutesUsed = ((user.minutes_used as number) ?? 0) + minutesUsed
  await (db as any).from('users').update({ minutes_used: newMinutesUsed }).eq('id', userId)

  // Audit log
  await (db as any).from('minute_transactions').insert({
    user_id: userId,
    org_id: user.organization_id ?? null,
    type: 'call_usage',
    delta: -minutesUsed,
    session_id: sessionId ?? null,
  })

  // Trial 25-minute cutoff — only fire if still in trialing status
  if (user.trial_ends_at && newMinutesUsed >= TRIAL_MINUTES) {
    const { data: sub } = await (db as any).from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('user_id', userId)
      .eq('status', 'trialing')
      .single()
    // Guard: only update if sub is still trialing (avoids double-fire)
    if (sub?.stripe_subscription_id && sub.status === 'trialing') {
      try {
        await stripe.subscriptions.update(sub.stripe_subscription_id as string, { trial_end: 'now' })
        await (db as any).from('subscriptions')
          .update({ status: 'active', trial_end: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.stripe_subscription_id)
      } catch (err: unknown) {
        // If trial end fails (already ended), log but don't fail the usage record
        console.warn('record-usage: trial end update failed:', err instanceof Error ? err.message : String(err))
      }
    }
  }

  return NextResponse.json({ success: true, minutesDeducted: minutesUsed })
}
