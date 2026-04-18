import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createServiceRoleClient } from '@/lib/supabase';

export async function PATCH(req: NextRequest, { params }: { params: { userId: string } }) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();
  const { data: coach } = await (supabase as any)
    .from('users')
    .select('coach_instance_id, app_role')
    .eq('auth_user_id', authUser.id)
    .single();

  if (!coach || (coach as any).app_role !== 'coach' && (coach as any).app_role !== 'superuser') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Confirm the target user belongs to this coach's instance
  const { data: target } = await (supabase as any)
    .from('users')
    .select('id, coach_instance_id')
    .eq('id', params.userId)
    .single();

  if (!target || (target as any).coach_instance_id !== (coach as any).coach_instance_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { status } = await req.json();
  if (status !== 'rejected') {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  await (supabase as any).from('users').update({ status }).eq('id', params.userId);
  return NextResponse.json({ success: true });
}
