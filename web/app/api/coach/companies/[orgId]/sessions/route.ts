import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createServiceRoleClient } from '@/lib/supabase';

async function getCoachProfile() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return null;
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('users')
    .select('id, app_role, coach_instance_id')
    .eq('auth_user_id', authUser.id)
    .single();
  if (!data || (data as any).app_role !== 'coach' && (data as any).app_role !== 'superuser') return null;
  return data as any;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const profile = await getCoachProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();

  // Verify org belongs to this coach
  const { data: org } = await (supabase as any)
    .from('organizations')
    .select('id, name')
    .eq('id', params.orgId)
    .eq('coach_instance_id', profile.coach_instance_id)
    .single();

  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  // Get users in this org
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email, app_role')
    .eq('organization_id', params.orgId);

  const userMap: Record<string, { full_name: string; email: string; app_role: string }> = {};
  (users ?? []).forEach((u: any) => { userMap[u.id] = u; });

  // Get sessions
  const { data: sessions } = await (supabase as any)
    .from('training_sessions')
    .select('id, user_id, started_at, ended_at, assessment, persona_name, persona_scenario_type')
    .eq('organization_id', params.orgId)
    .order('started_at', { ascending: false });

  const result = (sessions ?? []).map((s: any) => ({
    ...s,
    user: userMap[s.user_id] ?? null,
  }));

  return NextResponse.json({ org, sessions: result, users: users ?? [] });
}
