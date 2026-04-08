import { NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function GET() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: profile } = await (supabase as any)
    .from('users').select('id').eq('auth_user_id', authUser.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: notifications } = await (supabase as any)
    .from('notifications')
    .select('*')
    .eq('user_id', (profile as any).id)
    .order('created_at', { ascending: false })
    .limit(50);

  const unreadCount = ((notifications ?? []) as any[]).filter(n => !n.read).length;

  return NextResponse.json({ notifications: notifications ?? [], unreadCount });
}

export async function PATCH() {
  // Mark all notifications read for current user
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: profile } = await (supabase as any)
    .from('users').select('id').eq('auth_user_id', authUser.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await (supabase as any)
    .from('notifications')
    .update({ read: true })
    .eq('user_id', (profile as any).id)
    .eq('read', false);

  return NextResponse.json({ success: true });
}
