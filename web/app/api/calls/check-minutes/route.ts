import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { checkMinuteGate } from '@/lib/minute-gate'
import { getPerUserCap, TRIAL_MINUTES, TRIAL_SESSION_LIMIT } from '@/lib/plans'
import { stripe } from '@/lib/stripe'

// POST /api/calls/check-minutes
// Body: (none) — userId derived from auth session.
// Returns: { allowed: boolean, reason?: string, minutesRemaining: number }
export async function POST() {
  const auth = await requireUser({ allowNonApproved: true })
  if (!auth.ok) return auth.response
  const { user, service: db } = auth
  const userId = user.profileId

  const { data: userRow } = await (db as any).from('users')
    .select('id, app_role, organization_id, minutes_used, bonus_minutes, trial_ends_at, auto_refill_enabled, sessions_used')
    .eq('id', userId).single()

  if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  let subscriptionStatus: string | null = null
  let planId: string | null = null
  let orgData: Record<string, unknown> | null = null

  if (userRow.organization_id) {
    const { data: org } = await (db as any).from('organizations')
      .select('subscription_status, plan_id, seat_count, minutes_pool, bonus_minutes, auto_refill_enabled')
      .eq('id', userRow.organization_id).single()
    orgData = org ?? null
    subscriptionStatus = (org?.subscription_status as string) ?? null
    planId = (org?.plan_id as string) ?? null
  } else {
    const { data: activeSub } = await (db as any).from('subscriptions')
      .select('status, plan_id')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    subscriptionStatus = (activeSub?.status as string) ?? null
    planId = (activeSub?.plan_id as string) ?? null
  }

  // Trial session limit — block before a new call if all 3 sessions are used
  if (subscriptionStatus === 'trialing' && (userRow.sessions_used as number) >= TRIAL_SESSION_LIMIT) {
    return NextResponse.json({ allowed: false, reason: 'trial_expired', minutesRemaining: 0 })
  }

  // Trial 90-minute cutoff — checked BEFORE the gate so it takes precedence
  if (subscriptionStatus === 'trialing' && (userRow.minutes_used as number) >= TRIAL_MINUTES) {
    try {
      const { data: sub } = await (db as any).from('subscriptions')
        .select('stripe_subscription_id').eq('user_id', userId).eq('status', 'trialing').maybeSingle()
      if (sub?.stripe_subscription_id) {
        await stripe.subscriptions.update(sub.stripe_subscription_id as string, { trial_end: 'now' })
      }
    } catch (err: unknown) {
      console.warn('check-minutes: trial end update failed:', err instanceof Error ? err.message : String(err))
    }
    return NextResponse.json({ allowed: false, reason: 'trial_expired', minutesRemaining: 0 })
  }

  const result = checkMinuteGate({
    role: userRow.app_role as string,
    subscriptionStatus,
    trialEndsAt: userRow.trial_ends_at as string | null,
    minutesUsed: (userRow.minutes_used as number) ?? 0,
    bonusMinutes: (userRow.bonus_minutes as number) ?? 0,
    planId: planId ?? '',
    orgMinutesPool: orgData ? (orgData.minutes_pool as number) : null,
    orgBonusMinutes: orgData ? (orgData.bonus_minutes as number) : null,
    perUserCap: orgData && planId ? getPerUserCap(planId) : null,
  })

  if (!result.allowed && result.reason === 'minutes_exhausted') {
    const autoRefill = orgData ? orgData.auto_refill_enabled : userRow.auto_refill_enabled
    if (autoRefill) {
      return NextResponse.json({ allowed: false, reason: 'auto_refill_required', minutesRemaining: 0 })
    }
  }

  return NextResponse.json(result)
}
