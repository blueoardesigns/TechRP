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
