import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';
import { sendConnectionRemoved } from '@/lib/connection-emails';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: profile } = await (supabase as any)
    .from('users')
    .select('id, app_role, organization_id, full_name, email')
    .eq('auth_user_id', authUser.id)
    .single();

  if (!profile || (profile as any).app_role !== 'company_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch connection to verify ownership and get coach details
  const { data: conn } = await (supabase as any)
    .from('company_coach_connections')
    .select('id, organization_id, coach_instance_id, status')
    .eq('id', params.id)
    .single();

  if (!conn || (conn as any).organization_id !== (profile as any).organization_id) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  const { error: deleteError } = await (supabase as any).from('company_coach_connections').delete().eq('id', params.id);
  if (deleteError) return NextResponse.json({ error: 'Failed to remove connection' }, { status: 500 });

  // Get org name and coach email for notification
  const [{ data: org }, { data: coachUser }] = await Promise.all([
    (supabase as any).from('organizations').select('name').eq('id', (conn as any).organization_id).single(),
    (supabase as any).from('users').select('full_name, email').eq('coach_instance_id', (conn as any).coach_instance_id).eq('app_role', 'coach').single(),
  ]);

  if ((coachUser as any)?.email) {
    try {
      await sendConnectionRemoved({
        recipientEmail: (coachUser as any).email,
        recipientName: (coachUser as any).full_name ?? 'Coach',
        removerName: (profile as any).full_name ?? 'Company Admin',
        companyName: (org as any)?.name ?? 'the company',
      });
    } catch (e) {
      console.error('Failed to send removal email to coach:', e);
    }
  }

  return NextResponse.json({ ok: true });
}
