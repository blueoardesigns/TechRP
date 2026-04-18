import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { createServiceRoleClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { Resend } from 'resend'
import { PLAN_LABEL } from '@/lib/plans'

const resend = new Resend(process.env.RESEND_API_KEY)
const ADMIN_EMAIL = 'tbauertext@gmail.com'

export function validateCloseRequest(body: unknown): { action: 'suspend' | 'delete'; reason: string; reasonDetail?: string } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Invalid request body' }
  const { action, reason, reasonDetail } = body as Record<string, unknown>
  if (action !== 'suspend' && action !== 'delete') return { error: 'action must be suspend or delete' }
  if (!reason || typeof reason !== 'string' || reason.trim() === '') return { error: 'reason is required' }
  if (reasonDetail !== undefined && typeof reasonDetail !== 'string') return { error: 'reasonDetail must be a string' }
  return { action, reason: reason.trim(), reasonDetail: reasonDetail?.trim() }
}

export function buildAdminEmailBody(opts: {
  action: 'suspend' | 'delete'
  fullName: string
  email: string
  planLabel: string
  reason: string
  reasonDetail?: string
  timestamp: string
}): string {
  const lines = [
    `Action: ${opts.action.toUpperCase()}`,
    `User: ${opts.fullName} <${opts.email}>`,
    `Plan: ${opts.planLabel}`,
    `Reason: ${opts.reason}`,
  ]
  if (opts.reasonDetail) lines.push(`Detail: ${opts.reasonDetail}`)
  lines.push(`Timestamp: ${opts.timestamp}`)
  return lines.join('\n')
}

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const supabaseAuth = createServerSupabase()
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Parse + validate body
  const body = await request.json().catch(() => null)
  const parsed = validateCloseRequest(body)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { action, reason, reasonDetail } = parsed

  // 3. Fetch user record and active subscription
  const db = createServiceRoleClient()
  const { data: userRecord, error: userErr } = await db
    .from('users')
    .select('id, full_name, email, stripe_customer_id')
    .eq('id', authUser.id)
    .single()

  if (userErr || !userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: subscription } = await db
    .from('subscriptions')
    .select('stripe_subscription_id, plan_id')
    .eq('user_id', authUser.id)
    .in('status', ['active', 'trialing'])
    .single()

  const planLabel = PLAN_LABEL[subscription?.plan_id ?? ''] ?? subscription?.plan_id ?? 'Unknown plan'
  const timestamp = new Date().toISOString()

  // 4. Stripe operation — must succeed before touching the DB
  if (subscription?.stripe_subscription_id) {
    try {
      if (action === 'suspend') {
        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          pause_collection: { behavior: 'void' },
        })
      } else {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return NextResponse.json({ error: `Billing update failed: ${message}` }, { status: 502 })
    }
  }

  // 5. DB update
  if (action === 'suspend') {
    await db.from('users').update({ status: 'suspended' }).eq('id', authUser.id)
  } else {
    // Delete in dependency order
    await db.from('training_sessions').delete().eq('user_id', authUser.id)
    await db.from('playbooks').delete().eq('created_by', authUser.id)
    await db.from('users').delete().eq('id', authUser.id)
    // Delete Supabase Auth user
    await db.auth.admin.deleteUser(authUser.id)
  }

  // 6. Admin email (best-effort — don't fail the request if email fails)
  const emailBody = buildAdminEmailBody({
    action,
    fullName: userRecord.full_name ?? 'Unknown',
    email: userRecord.email ?? authUser.email ?? '',
    planLabel,
    reason,
    reasonDetail,
    timestamp,
  })

  await resend.emails.send({
    from: 'TechRP <noreply@techrp.com>',
    to: ADMIN_EMAIL,
    subject: `[TechRP] Account ${action} — ${userRecord.email ?? authUser.email}`,
    text: emailBody,
  }).catch(() => { /* email failure is non-fatal */ })

  return NextResponse.json({ success: true, action })
}
