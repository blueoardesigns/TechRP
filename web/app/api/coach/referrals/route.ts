import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { signCoachToken } from '@/lib/coach-token'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// GET — list coach's referrals
export async function GET(req: NextRequest) {
  const coachId = req.nextUrl.searchParams.get('coachId')
  if (!coachId) return NextResponse.json({ error: 'Missing coachId' }, { status: 400 })

  const db = createServiceRoleClient()
  const { data, error } = await (db as any).from('coach_referrals')
    .select('*, organizations(name, subscription_status)')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ referrals: data })
}

// POST — generate a new invite link token
export async function POST(req: NextRequest) {
  const { coachId, type, percentage } = await req.json()
  if (!coachId || !type || !percentage) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (!['discount', 'affiliate'].includes(type)) {
    return NextResponse.json({ error: 'type must be discount or affiliate' }, { status: 400 })
  }
  if (percentage < 1 || percentage > 100) {
    return NextResponse.json({ error: 'percentage must be 1–100' }, { status: 400 })
  }

  const token = signCoachToken({ coachId, type, percentage, issuedAt: Date.now() })
  const inviteUrl = `${APP_URL}/signup?coach=${token}`
  return NextResponse.json({ token, inviteUrl })
}
