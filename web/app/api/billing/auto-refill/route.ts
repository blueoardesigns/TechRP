import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'

// PATCH /api/billing/auto-refill
// Body: { enabled: boolean, scope?: 'user' | 'org' }
// - 'user' (default): toggles caller's own auto_refill_enabled
// - 'org': requires company_admin or superuser; toggles caller's organization
export async function PATCH(req: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { user, service: db } = auth

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled (boolean) is required' }, { status: 400 })
  }
  const enabled = body.enabled
  const scope = body.scope === 'org' ? 'org' : 'user'

  if (scope === 'org') {
    if (user.appRole !== 'company_admin' && user.appRole !== 'superuser') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!user.organizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }
    await (db as any).from('organizations').update({ auto_refill_enabled: enabled }).eq('id', user.organizationId)
  } else {
    await (db as any).from('users').update({ auto_refill_enabled: enabled }).eq('id', user.profileId)
  }

  return NextResponse.json({ success: true })
}
