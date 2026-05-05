// web/app/api/sessions/[id]/share/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireUser, canAccessOwned } from '@/lib/api-auth';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
/** Public share links auto-expire after this many days. */
const SHARE_TOKEN_TTL_DAYS = 90;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user, service: supabase } = auth;

  // Load session and verify the caller owns it (or is a same-org admin/coach,
  // or is a superuser).
  const { data: session } = await (supabase as any)
    .from('training_sessions')
    .select('id, user_id, organization_id, share_token')
    .eq('id', params.id)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canAccessOwned(user, session.user_id, session.organization_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const enabled = body?.enabled !== false; // default enable

  if (enabled) {
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + SHARE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await (supabase as any)
      .from('training_sessions')
      .update({
        share_token: token,
        share_enabled_at: new Date().toISOString(),
        share_expires_at: expiresAt,
      })
      .eq('id', params.id);
    return NextResponse.json({
      url: `${APP_URL}/share/session/${token}`,
      token,
      expiresAt,
    });
  }

  await (supabase as any)
    .from('training_sessions')
    .update({ share_token: null, share_expires_at: null })
    .eq('id', params.id);
  return NextResponse.json({ url: null });
}
