import { NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

async function getCoachProfile() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return null;
  const supabase = createServiceSupabase();
  const { data } = await (supabase as any)
    .from('users')
    .select('id, app_role, coach_instance_id')
    .eq('auth_user_id', authUser.id)
    .single();
  if (!data || (data as any).app_role !== 'coach' && (data as any).app_role !== 'superuser') return null;
  return data as any;
}

export async function GET() {
  const profile = await getCoachProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: connections } = await (supabase as any)
    .from('company_coach_connections')
    .select('id, organization_id, permission_level, status, requested_at, accepted_at')
    .eq('coach_instance_id', profile.coach_instance_id)
    .neq('status', 'declined')
    .order('requested_at', { ascending: false });

  const enriched = await Promise.all(
    (connections ?? []).map(async (conn: any) => {
      const { data: org } = await (supabase as any)
        .from('organizations')
        .select('name')
        .eq('id', conn.organization_id)
        .single();
      const { data: admin } = await (supabase as any)
        .from('users')
        .select('full_name, email')
        .eq('organization_id', conn.organization_id)
        .eq('app_role', 'company_admin')
        .single();
      return {
        ...conn,
        companyName: (org as any)?.name ?? 'Unknown Company',
        adminName: (admin as any)?.full_name ?? '',
        adminEmail: (admin as any)?.email ?? '',
      };
    })
  );

  return NextResponse.json({ connections: enriched });
}
