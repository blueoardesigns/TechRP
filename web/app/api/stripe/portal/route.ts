import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// POST /api/stripe/portal
// Body: { userId, orgId? }
export async function POST(req: NextRequest) {
  const { userId, orgId } = await req.json()
  const db = createServiceRoleClient()

  let customerId: string | null = null
  if (orgId) {
    const { data } = await (db as any).from('organizations')
      .select('stripe_customer_id').eq('id', orgId).single()
    customerId = data?.stripe_customer_id
  } else {
    const { data } = await (db as any).from('users')
      .select('stripe_customer_id').eq('id', userId).single()
    customerId = data?.stripe_customer_id
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
