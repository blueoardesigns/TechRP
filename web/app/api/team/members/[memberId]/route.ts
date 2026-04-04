import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function PATCH(req: NextRequest, { params }: { params: { memberId: string } }) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: admin } = await (supabase as any)
    .from('users')
    .select('organization_id, app_role')
    .eq('auth_user_id', authUser.id)
    .single();

  if (!admin || (admin as any).app_role !== 'company_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify target is in same org
  const { data: target } = await (supabase as any)
    .from('users')
    .select('organization_id')
    .eq('id', params.memberId)
    .single();

  if (!target || (target as any).organization_id !== (admin as any).organization_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { status } = await req.json();
  if (status !== 'rejected') {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  await (supabase as any).from('users').update({ status }).eq('id', params.memberId);
  return NextResponse.json({ success: true });
}
