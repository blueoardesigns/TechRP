// web/app/api/admin/notifications/broadcast/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

async function requireSuperuser() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return null;
  const supabase = createServiceSupabase();
  const { data } = await (supabase as any)
    .from('users')
    .select('id, app_role')
    .eq('auth_user_id', authUser.id)
    .single();
  if (!data || (data as any).app_role !== 'superuser') return null;
  return data as { id: string };
}

export async function GET() {
  const me = await requireSuperuser();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createServiceSupabase();
  const { data: history } = await (supabase as any)
    .from('global_broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ history: history ?? [] });
}

export async function POST(request: NextRequest) {
  const me = await requireSuperuser();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { title, body, link } = await request.json();

  if (typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }
  if (typeof body !== 'string' || body.trim().length === 0) {
    return NextResponse.json({ error: 'Body is required' }, { status: 400 });
  }

  const supabase = createServiceSupabase();

  // Fetch all approved users.
  const { data: recipients } = await (supabase as any)
    .from('users')
    .select('id')
    .eq('status', 'approved');

  const ids: string[] = ((recipients ?? []) as { id: string }[]).map((u) => u.id);
  if (ids.length === 0) {
    return NextResponse.json({ error: 'No approved users' }, { status: 400 });
  }

  const linkValue = typeof link === 'string' && link.trim().length > 0 ? link.trim() : null;
  const notifData = linkValue ? { link: linkValue } : null;

  // Bulk insert.
  const rows = ids.map((user_id) => ({
    user_id,
    type: 'global_broadcast',
    title: title.trim(),
    body: body.trim(),
    data: notifData,
  }));

  const { error: insertError } = await (supabase as any)
    .from('notifications')
    .insert(rows);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await (supabase as any).from('global_broadcasts').insert({
    sent_by: me.id,
    title: title.trim(),
    body: body.trim(),
    link: linkValue,
    recipient_count: ids.length,
  });

  return NextResponse.json({ recipient_count: ids.length });
}
