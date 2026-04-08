import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
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

  const { data: invite } = await (supabase as any)
    .from('candidate_invites')
    .select('organization_id, status')
    .eq('id', params.id)
    .single();

  if (!invite || (invite as any).organization_id !== (admin as any).organization_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if ((invite as any).status !== 'pending') {
    return NextResponse.json({ error: 'Can only revoke pending invites. Deactivate the user instead.' }, { status: 400 });
  }

  await (supabase as any).from('candidate_invites').delete().eq('id', params.id);
  return NextResponse.json({ success: true });
}
