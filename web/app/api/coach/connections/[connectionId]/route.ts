import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';
import { sendConnectionRemoved } from '@/lib/connection-emails';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: profile } = await (supabase as any)
    .from('users')
    .select('id, app_role, coach_instance_id, full_name')
    .eq('auth_user_id', authUser.id)
    .single();

  if (!profile || (profile as any).app_role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: conn } = await (supabase as any)
    .from('company_coach_connections')
    .select('id, organization_id, coach_instance_id')
    .eq('id', params.connectionId)
    .single();

  if (!conn || (conn as any).coach_instance_id !== (profile as any).coach_instance_id) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  await (supabase as any).from('company_coach_connections').delete().eq('id', params.connectionId);

  // Notify company admin
  const [{ data: org }, { data: adminUser }] = await Promise.all([
    (supabase as any).from('organizations').select('name').eq('id', (conn as any).organization_id).single(),
    (supabase as any).from('users').select('full_name, email').eq('organization_id', (conn as any).organization_id).eq('app_role', 'company_admin').single(),
  ]);

  if ((adminUser as any)?.email) {
    try {
      await sendConnectionRemoved({
        recipientEmail: (adminUser as any).email,
        recipientName: (adminUser as any).full_name ?? 'Admin',
        removerName: (profile as any).full_name ?? 'Your coach',
        companyName: (org as any)?.name ?? 'your company',
      });
    } catch (e) {
      console.error('Failed to send removal email to company admin:', e);
    }
  }

  return NextResponse.json({ ok: true });
}
