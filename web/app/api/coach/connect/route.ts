import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { createHmac, timingSafeEqual } from 'crypto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const CLIENT_ID = process.env.STRIPE_CONNECT_CLIENT_ID ?? ''
const STATE_SECRET = process.env.COACH_INVITE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'change-me-dev-only'

/** Sign a coachId+timestamp tuple for use as OAuth state. */
function signState(coachId: string): string {
  const ts = Date.now().toString()
  const payload = `${coachId}.${ts}`
  const sig = createHmac('sha256', STATE_SECRET).update(payload).digest('base64url')
  return `${Buffer.from(payload).toString('base64url')}.${sig}`
}

/** Verify state, returning coachId if signature is valid and ts < 1h old. */
function verifyState(state: string): string | null {
  try {
    const [encoded, sig] = state.split('.')
    if (!encoded || !sig) return null
    const expected = createHmac('sha256', STATE_SECRET).update(Buffer.from(encoded, 'base64url').toString()).digest('base64url')
    const sigBuf = Buffer.from(sig)
    const expectedBuf = Buffer.from(expected)
    if (sigBuf.length !== expectedBuf.length) return null
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null
    const [coachId, ts] = Buffer.from(encoded, 'base64url').toString().split('.')
    if (!coachId || !ts) return null
    if (Date.now() - parseInt(ts, 10) > 60 * 60 * 1000) return null
    return coachId
  } catch {
    return null
  }
}

// GET — initiate Stripe Connect Express OAuth.
// Caller must be authenticated as a coach; state is HMAC-signed so the
// callback can't be tricked into binding to another coach.
export async function GET(_req: NextRequest) {
  const auth = await requireUser({ roles: ['coach', 'superuser'] })
  if (!auth.ok) return auth.response
  const { user } = auth

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: 'read_write',
    redirect_uri: `${APP_URL}/coach/connect/callback`,
    state: signState(user.profileId),
  })

  return NextResponse.redirect(`https://connect.stripe.com/oauth/authorize?${params}`)
}

// POST — exchange OAuth code for Connect account ID.
// `state` from the OAuth callback must round-trip a signed coachId; that
// id is the only one we'll write to. We also require the caller to be
// authenticated as the same coach (defense-in-depth).
export async function POST(req: NextRequest) {
  const auth = await requireUser({ roles: ['coach', 'superuser'] })
  if (!auth.ok) return auth.response
  const { user, service: db } = auth

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  const code = typeof body.code === 'string' ? body.code : null
  const state = typeof body.state === 'string' ? body.state : null
  if (!code || !state) return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })

  const stateCoachId = verifyState(state)
  if (!stateCoachId) return NextResponse.json({ error: 'Invalid or expired state' }, { status: 400 })
  if (user.appRole !== 'superuser' && stateCoachId !== user.profileId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const res = await fetch('https://connect.stripe.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_secret: process.env.STRIPE_SECRET_KEY ?? '',
    }),
  })

  const data = (await res.json()) as { stripe_user_id?: string; error_description?: string }
  if (!res.ok || !data.stripe_user_id) {
    return NextResponse.json({ error: data.error_description ?? 'Connect failed' }, { status: 400 })
  }

  await (db as any).from('users')
    .update({ stripe_connect_account_id: data.stripe_user_id })
    .eq('id', stateCoachId)

  return NextResponse.json({ success: true })
}
