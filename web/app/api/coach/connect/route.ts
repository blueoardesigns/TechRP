import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const CLIENT_ID = process.env.STRIPE_CONNECT_CLIENT_ID ?? ''

// GET — initiate Stripe Connect Express OAuth
export async function GET(req: NextRequest) {
  const coachId = req.nextUrl.searchParams.get('coachId')
  if (!coachId) return NextResponse.json({ error: 'Missing coachId' }, { status: 400 })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: 'read_write',
    redirect_uri: `${APP_URL}/coach/connect/callback`,
    state: coachId,
  })

  return NextResponse.redirect(`https://connect.stripe.com/oauth/authorize?${params}`)
}

// POST — exchange OAuth code for Connect account ID
export async function POST(req: NextRequest) {
  const { code, coachId } = await req.json()
  if (!code || !coachId) return NextResponse.json({ error: 'Missing code or coachId' }, { status: 400 })

  const res = await fetch('https://connect.stripe.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code as string,
      client_secret: process.env.STRIPE_SECRET_KEY ?? '',
    }),
  })

  const data = await res.json() as { stripe_user_id?: string; error_description?: string }
  if (!res.ok || !data.stripe_user_id) {
    return NextResponse.json({ error: data.error_description ?? 'Connect failed' }, { status: 400 })
  }

  const db = createServiceRoleClient()
  await (db as any).from('users')
    .update({ stripe_connect_account_id: data.stripe_user_id })
    .eq('id', coachId)

  return NextResponse.json({ success: true })
}
