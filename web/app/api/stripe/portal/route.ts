import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { requireUser } from '@/lib/api-auth'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// POST /api/stripe/portal
// Body: { scope?: 'user' | 'org' } — default 'user'
// Returns a Stripe billing portal URL for the authenticated caller.
export async function POST(req: NextRequest) {
  const auth = await requireUser({ allowNonApproved: true })
  if (!auth.ok) return auth.response
  const { user, service: db } = auth

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const scope = body.scope === 'org' ? 'org' : 'user'

  let customerId: string | null = null
  if (scope === 'org') {
    if (user.appRole !== 'company_admin' && user.appRole !== 'superuser') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!user.organizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }
    const { data } = await (db as any).from('organizations')
      .select('stripe_customer_id').eq('id', user.organizationId).single()
    customerId = data?.stripe_customer_id ?? null
  } else {
    const { data } = await (db as any).from('users')
      .select('stripe_customer_id').eq('id', user.profileId).single()
    customerId = data?.stripe_customer_id ?? null
  }

  if (!customerId) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL}/billing`,
  })

  return NextResponse.json({ url: session.url })
}
