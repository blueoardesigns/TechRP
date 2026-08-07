import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { TRIAL_MINUTES } from '@/lib/plans'
import { stripe } from '@/lib/stripe'

// POST /api/calls/record-usage
// Body: { sessionId?, durationSeconds }
// userId is derived from the authenticated session — body-supplied userId is ignored.
export async function POST(req: NextRequest) {
  const auth = await requireUser({ allowNonApproved: true })
  if (!auth.ok) return auth.response
  const { user, service: db } = auth

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null
  const durationSeconds = typeof body.durationSeconds === 'number' ? body.durationSeconds : null
  if (durationSeconds == null || durationSeconds < 0 || durationSeconds > 60 * 60 * 6) {
    return NextResponse.json({ error: 'Invalid durationSeconds' }, { status: 400 })
  }

  const userId = user.profileId
  const minutesUsed = Math.ceil(durationSeconds / 60)

  const { data: userRow } = await (db as any).from('users')
    .select('id, app_role, organization_id, minutes_used, bonus_minutes, trial_ends_at')
    .eq('id', userId).single()

  if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Atomically deduct from the org pool, increment the user counter, and write
  // the audit row in a single transaction (see record_call_usage in
  // web/supabase/atomic-minutes-migration.sql). This replaces a read-modify-write
  // that lost updates when two calls ended concurrently. Returns the new
  // users.minutes_used for the trial cutoff below.
  const { data: newMinutesUsed, error: deductError } = await (db as any).rpc('record_call_usage', {
    p_user_id: userId,
    p_org_id: userRow.organization_id ?? null,
    p_minutes: minutesUsed,
    p_session_id: sessionId,
  })

  if (deductError) {
    console.error('record-usage: record_call_usage RPC failed:', deductError)
    return NextResponse.json({ error: 'Failed to record usage' }, { status: 500 })
  }

  // Trial 25-minute cutoff — only fire if still in trialing status
  if (userRow.trial_ends_at && newMinutesUsed >= TRIAL_MINUTES) {
    const { data: sub } = await (db as any).from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('user_id', userId)
      .eq('status', 'trialing')
      .maybeSingle()
    if (sub?.stripe_subscription_id && sub.status === 'trialing') {
      try {
        await stripe.subscriptions.update(sub.stripe_subscription_id as string, { trial_end: 'now' })
        await (db as any).from('subscriptions')
          .update({ status: 'active', trial_end: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.stripe_subscription_id)
      } catch (err: unknown) {
        console.warn('record-usage: trial end update failed:', err instanceof Error ? err.message : String(err))
      }
    }
  }

  return NextResponse.json({ success: true, minutesDeducted: minutesUsed })
}
