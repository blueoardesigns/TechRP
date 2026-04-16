import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

export async function PATCH(req: NextRequest) {
  const { userId, orgId, enabled } = await req.json()
  const db = createServiceRoleClient()

  if (orgId) {
    await (db as any).from('organizations').update({ auto_refill_enabled: enabled }).eq('id', orgId)
  } else {
    await (db as any).from('users').update({ auto_refill_enabled: enabled }).eq('id', userId)
  }
  return NextResponse.json({ success: true })
}
