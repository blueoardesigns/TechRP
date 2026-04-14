import { NextRequest, NextResponse } from 'next/server';
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
  if (!data || (data as any).app_role !== 'coach') return null;
  return data as any;
}

// GET /api/coach/companies/[orgId]/playbooks
// Returns all coach playbooks with visible:boolean for this org
export async function GET(
  _request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const profile = await getCoachProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();

  const { data: org } = await (supabase as any)
    .from('organizations')
    .select('id, name')
    .eq('id', params.orgId)
    .eq('coach_instance_id', profile.coach_instance_id)
    .single();

  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const { data: playbooks } = await (supabase as any)
    .from('playbooks')
    .select('id, name, scenario_type, created_at')
    .eq('coach_instance_id', profile.coach_instance_id)
    .order('created_at', { ascending: false });

  const { data: whitelistRows } = await (supabase as any)
    .from('playbook_company_access')
    .select('playbook_id')
    .eq('organization_id', params.orgId);

  const whitelistSet = new Set((whitelistRows ?? []).map((r: any) => r.playbook_id));
  const hasWhitelist = whitelistSet.size > 0;

  const result = (playbooks ?? []).map((p: any) => ({
    ...p,
    visible: hasWhitelist ? whitelistSet.has(p.id) : true,
  }));

  return NextResponse.json({ playbooks: result, hasWhitelist });
}

// PUT /api/coach/companies/[orgId]/playbooks
// Body: { playbookIds: string[] } — full replacement of whitelist
export async function PUT(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const profile = await getCoachProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();

  const { data: org } = await (supabase as any)
    .from('organizations')
    .select('id')
    .eq('id', params.orgId)
    .eq('coach_instance_id', profile.coach_instance_id)
    .single();

  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const { playbookIds } = await request.json();
  if (!Array.isArray(playbookIds)) {
    return NextResponse.json({ error: 'playbookIds must be an array' }, { status: 400 });
  }

  const { data: allCoachPlaybooks } = await (supabase as any)
    .from('playbooks')
    .select('id')
    .eq('coach_instance_id', profile.coach_instance_id);

  const allIds = new Set((allCoachPlaybooks ?? []).map((p: any) => p.id));
  const validIds = playbookIds.filter((id) => allIds.has(id));

  // Delete existing whitelist rows owned by this coach for this org
  if (allIds.size > 0) {
    await (supabase as any)
      .from('playbook_company_access')
      .delete()
      .eq('organization_id', params.orgId)
      .in('playbook_id', Array.from(allIds));
  }

  // If all playbooks selected or none selected, leave empty (show all = no rows)
  if (validIds.length === 0 || validIds.length === allIds.size) {
    return NextResponse.json({ ok: true, hasWhitelist: false });
  }

  const rows = validIds.map((id: string) => ({
    playbook_id: id,
    organization_id: params.orgId,
  }));

  const { error } = await (supabase as any)
    .from('playbook_company_access')
    .insert(rows);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, hasWhitelist: true });
}
