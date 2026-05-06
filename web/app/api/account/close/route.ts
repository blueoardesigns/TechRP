import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { createServiceRoleClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { Resend } from 'resend'
import { PLAN_LABEL } from '@/lib/plans'
import { validateCloseRequest, buildAdminEmailBody } from '@/lib/account-close'

const resend = new Resend(process.env.RESEND_API_KEY)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'tbauertext@gmail.com'

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

  // 3. Fetch user record and active subscription.
  //    `users.id` is the profile UUID, NOT the Supabase auth user UUID — use
  //    `auth_user_id` to look up the profile, then key all subsequent
  //    queries off the profile id.
  const db = createServiceRoleClient()
  const { data: userRecord, error: userErr } = await (db as any)
    .from('users')
    .select('id, full_name, email, stripe_customer_id, auth_user_id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()

  if (userErr || !userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  const profileId = userRecord.id as string

  const { data: subscription } = await (db as any)
    .from('subscriptions')
    .select('stripe_subscription_id, plan_id')
    .eq('user_id', profileId)
    .in('status', ['active', 'trialing'])
    .maybeSingle()

  const planLabel = PLAN_LABEL[subscription?.plan_id ?? ''] ?? subscription?.plan_id ?? 'Unknown plan'
  const timestamp = new Date().toISOString()

  // 4. Stripe operation — must succeed before touching the DB
  // If no active subscription exists (e.g. trial expired, already cancelled),
  // skip Stripe — proceed directly to DB update. This is intentional.
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

  // 5. DB update — keyed off the profile id, not the auth user id.
  if (action === 'suspend') {
    const { error: suspendErr } = await (db as any)
      .from('users').update({ status: 'suspended' }).eq('id', profileId)
    if (suspendErr) return NextResponse.json({ error: 'Failed to suspend account' }, { status: 500 })
  } else {
    // Delete in dependency order — each step must succeed before proceeding.
    // Note: `playbooks` are owned via `uploaded_by` (not `created_by`) and
    // are intentionally preserved at the org level on individual deletion;
    // we only null out `uploaded_by` to retain organizational content.
    const { error: sessErr } = await (db as any)
      .from('training_sessions').delete().eq('user_id', profileId)
    if (sessErr) return NextResponse.json({ error: 'Failed to delete session data' }, { status: 500 })

    const { error: playbookErr } = await (db as any)
      .from('playbooks').update({ uploaded_by: null }).eq('uploaded_by', profileId)
    if (playbookErr) return NextResponse.json({ error: 'Failed to detach playbooks' }, { status: 500 })

    const { error: userRowErr } = await (db as any)
      .from('users').delete().eq('id', profileId)
    if (userRowErr) return NextResponse.json({ error: 'Failed to delete user record' }, { status: 500 })

    const { error: authErr } = await db.auth.admin.deleteUser(authUser.id)
    if (authErr) return NextResponse.json({ error: 'Failed to delete auth account' }, { status: 500 })
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

  return NextResponse.json({ success: true, action: action === 'suspend' ? 'suspended' : 'deleted' })
}
