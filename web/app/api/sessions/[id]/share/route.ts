// web/app/api/sessions/[id]/share/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: profile } = await (supabase as any)
    .from('users').select('id').eq('auth_user_id', authUser.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify session ownership.
  const { data: session } = await (supabase as any)
    .from('training_sessions')
    .select('id, user_id, share_token')
    .eq('id', params.id)
    .single();

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if ((session as any).user_id !== (profile as any).id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const enabled = body?.enabled !== false; // default enable

  if (enabled) {
    const token = randomBytes(24).toString('hex');
    await (supabase as any)
      .from('training_sessions')
      .update({ share_token: token, share_enabled_at: new Date().toISOString() })
      .eq('id', params.id);
    return NextResponse.json({ url: `${APP_URL}/share/session/${token}`, token });
  } else {
    await (supabase as any)
      .from('training_sessions')
      .update({ share_token: null })
      .eq('id', params.id);
    return NextResponse.json({ url: null });
  }
}
