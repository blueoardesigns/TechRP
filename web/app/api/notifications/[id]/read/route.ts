import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: profile } = await (supabase as any)
    .from('users').select('id').eq('auth_user_id', authUser.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only allow marking own notifications
  const { data: notification } = await (supabase as any)
    .from('notifications')
    .select('user_id')
    .eq('id', params.id)
    .single();

  if (!notification || (notification as any).user_id !== (profile as any).id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await (supabase as any)
    .from('notifications')
    .update({ read: true })
    .eq('id', params.id);

  return NextResponse.json({ success: true });
}
