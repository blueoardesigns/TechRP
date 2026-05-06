import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { constructWebhookEvent, stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'
import { getPlanMinutes, TRIAL_MINUTES } from '@/lib/plans'

/** Hard cap on coach affiliate percentage. Defense-in-depth alongside coach-token clamp. */
const MAX_AFFILIATE_PCT = 50

export async function POST(req: NextRequest) {
  const payload = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = constructWebhookEvent(payload, sig)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Webhook signature failed:', message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = createServiceRoleClient()

  // Idempotency: insert event.id into webhook_events. If we get a unique-violation
  // (code 23505), this is a Stripe retry — return success without re-processing.
  const { error: dedupeError } = await (db as any)
    .from('webhook_events')
    .insert({ event_id: event.id, event_type: event.type })
  if (dedupeError) {
    if ((dedupeError as { code?: string }).code === '23505') {
      console.info(`Skipping duplicate Stripe event ${event.id} (${event.type})`)
      return NextResponse.json({ received: true, duplicate: true })
    }
    console.error('webhook_events insert failed:', dedupeError)
    // Fall through and process anyway — duplicate processing is preferable to
    // dropped events when the dedupe table is unavailable.
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, db)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, db)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, db)
        break
      case 'invoice.payment_succeeded':
        await handleInvoicePaid(event.data.object as Stripe.Invoice, db)
        break
      case 'invoice.payment_failed':
        await handleInvoiceFailed(event.data.object as Stripe.Invoice, db)
        break
      default:
        break
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Webhook handler error for ${event.type}:`, message)
    // Roll back the dedupe row so Stripe will retry.
    await (db as any).from('webhook_events').delete().eq('event_id', event.id)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

type DbClient = ReturnType<typeof createServiceRoleClient>

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, db: DbClient) {
  const meta = (session.metadata ?? {}) as Record<string, string>
  const { user_id, org_id, plan_id } = meta
  const stripeSubId = session.subscription as string | null
  const stripeCustomerId = session.customer as string | null

  // Handle addon hour purchase (payment mode)
  if (session.mode === 'payment') {
    const { user_id: uid, org_id: oid, addon_qty } = meta
    const qty = parseInt(addon_qty ?? '1', 10)
    const minutesToAdd = qty * 60

    if (oid) {
      const { data: org } = await (db as any).from('organizations')
        .select('bonus_minutes').eq('id', oid).single()
      await (db as any).from('organizations')
        .update({ bonus_minutes: ((org?.bonus_minutes as number) ?? 0) + minutesToAdd })
        .eq('id', oid)
    } else if (uid) {
      const { data: user } = await (db as any).from('users')
        .select('bonus_minutes').eq('id', uid).single()
      await (db as any).from('users')
        .update({ bonus_minutes: ((user?.bonus_minutes as number) ?? 0) + minutesToAdd })
        .eq('id', uid)
    }

    if (uid) {
      await (db as any).from('minute_transactions').insert({
        user_id: uid,
        org_id: oid || null,
        type: 'purchase',
        delta: minutesToAdd,
        stripe_charge_id: session.payment_intent as string | null,
      })
    }
    return
  }

  if (!stripeSubId || !plan_id) return

  const sub = await stripe.subscriptions.retrieve(stripeSubId) as any
  const priceId = sub.items.data[0]?.price.id ?? ''
  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null
  const periodStart = new Date(sub.current_period_start * 1000).toISOString()
  const periodEnd = new Date(sub.current_period_end * 1000).toISOString()

  // Upsert subscriptions row
  await (db as any).from('subscriptions').upsert({
    user_id: user_id ?? null,
    org_id: org_id || null,
    stripe_subscription_id: stripeSubId,
    stripe_price_id: priceId,
    plan_id,
    status: sub.status,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    trial_end: trialEnd,
  }, { onConflict: 'stripe_subscription_id' })

  if (user_id) {
    await (db as any).from('users').update({
      status: 'approved',
      stripe_customer_id: stripeCustomerId,
      trial_ends_at: trialEnd,
    }).eq('id', user_id)

    // Grant 25 trial minutes
    await (db as any).from('minute_transactions').insert({
      user_id,
      type: 'trial_grant',
      delta: TRIAL_MINUTES,
    })
  }

  if (org_id) {
    const planMinutes = getPlanMinutes(plan_id)
    const quantity = sub.items.data[0]?.quantity ?? 1

    await (db as any).from('organizations').update({
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubId,
      plan_id,
      seat_count: quantity,
      minutes_pool: quantity * planMinutes,
      subscription_status: sub.status,
    }).eq('id', org_id)

    // Approve the company_admin
    await (db as any).from('users').update({
      status: 'approved',
      stripe_customer_id: stripeCustomerId,
      trial_ends_at: trialEnd,
    }).eq('organization_id', org_id).eq('app_role', 'company_admin')
  }
}

async function handleSubscriptionUpdated(subInput: Stripe.Subscription, db: DbClient) {
  const sub = subInput as any
  const priceId = sub.items.data[0]?.price.id ?? ''
  const planId = (sub.items.data[0]?.price.metadata?.plan_key as string) ?? ''
  const periodStart = new Date(sub.current_period_start * 1000).toISOString()
  const periodEnd = new Date(sub.current_period_end * 1000).toISOString()

  await (db as any).from('subscriptions').update({
    status: sub.status,
    stripe_price_id: priceId,
    plan_id: planId,
    current_period_start: periodStart,
    current_period_end: periodEnd,
  }).eq('stripe_subscription_id', sub.id)

  await (db as any).from('organizations')
    .update({ subscription_status: sub.status, plan_id: planId })
    .eq('stripe_subscription_id', sub.id)
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription, db: DbClient) {
  await (db as any).from('subscriptions').update({
    status: 'canceled',
    canceled_at: new Date().toISOString(),
  }).eq('stripe_subscription_id', sub.id)

  await (db as any).from('organizations')
    .update({ subscription_status: 'canceled' })
    .eq('stripe_subscription_id', sub.id)
}

async function handleInvoicePaid(invoice: Stripe.Invoice, db: DbClient) {
  const stripeSubId = (invoice as any).subscription as string | null
  if (!stripeSubId) return

  const { data: subRow } = await (db as any).from('subscriptions')
    .select('*').eq('stripe_subscription_id', stripeSubId).maybeSingle()
  if (!subRow) return

  // Only reset minutes_used at the start of a new billing period — NOT for
  // proration / upgrade / downgrade / addon invoices, which would otherwise
  // wipe paid mid-cycle usage.
  const billingReason = (invoice as any).billing_reason as string | undefined
  const isCycleStart = billingReason === 'subscription_cycle' || billingReason === 'subscription_create'

  if (isCycleStart) {
    if (subRow.user_id) {
      await (db as any).from('users').update({ minutes_used: 0 }).eq('id', subRow.user_id)
      await (db as any).from('minute_transactions').insert({
        user_id: subRow.user_id,
        type: 'monthly_reset',
        delta: 0,
      })
    }

    if (subRow.org_id) {
      const { data: org } = await (db as any).from('organizations')
        .select('seat_count, plan_id').eq('id', subRow.org_id).maybeSingle()
      if (org) {
        const newPool = (org.seat_count as number) * getPlanMinutes(org.plan_id as string)
        await (db as any).from('organizations')
          .update({ minutes_pool: newPool, subscription_status: 'active' })
          .eq('id', subRow.org_id)
        await (db as any).from('users').update({ minutes_used: 0 }).eq('organization_id', subRow.org_id)
      }
    }
  } else if (subRow.org_id) {
    // Non-cycle invoices for orgs (proration etc.) still update status to active.
    await (db as any).from('organizations')
      .update({ subscription_status: 'active' })
      .eq('id', subRow.org_id)
  }

  // ── Affiliate payout ─────────────────────────────────────────────────────
  // Only on subscription_cycle invoices. Cap percentage. No payouts on $0 invoices.
  if (isCycleStart && billingReason === 'subscription_cycle' && subRow.org_id && (invoice.amount_paid as number) > 0) {
    const { data: referral } = await (db as any).from('coach_referrals')
      .select('id, percentage, coach_id, users!coach_referrals_coach_id_fkey(stripe_connect_account_id)')
      .eq('org_id', subRow.org_id)
      .eq('type', 'affiliate')
      .eq('is_active', true)
      .maybeSingle()

    if (referral) {
      const connectAccountId = (referral.users as { stripe_connect_account_id: string | null } | null)
        ?.stripe_connect_account_id
      const rawPct = Number(referral.percentage)
      const pct = Math.max(0, Math.min(MAX_AFFILIATE_PCT, Number.isFinite(rawPct) ? rawPct : 0))
      const amountCents = Math.floor((invoice.amount_paid as number) * pct / 100)

      if (connectAccountId && amountCents > 0) {
        try {
          await stripe.transfers.create({
            amount: amountCents,
            currency: 'usd',
            destination: connectAccountId,
            transfer_group: `invoice_${invoice.id}`,
          }, {
            // Stripe-side idempotency: if the same invoice payment fires twice,
            // Stripe rejects the second transfer.
            idempotencyKey: `affiliate_${invoice.id}_${referral.id}`,
          })
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          console.error(`Affiliate transfer failed for referral ${referral.id}:`, message)
        }
      } else {
        console.warn(
          `Skipped affiliate payout: referral=${referral.id}, invoice=${invoice.id}, amount_cents=${amountCents}, connect_account=${connectAccountId ?? 'not set'}`
        )
      }
    }
  }
}

async function handleInvoiceFailed(invoice: Stripe.Invoice, db: DbClient) {
  const stripeSubId = (invoice as any).subscription as string | null
  if (!stripeSubId) return

  await (db as any).from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', stripeSubId)

  await (db as any).from('organizations')
    .update({ subscription_status: 'past_due' })
    .eq('stripe_subscription_id', stripeSubId)
}
