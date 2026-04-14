import { NextResponse, NextRequest } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function GET() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ playbooks: [] });

  const supabase = createServiceSupabase();
  const { data: profile } = await (supabase as any)
    .from('users').select('coach_instance_id, app_role').eq('auth_user_id', authUser.id).single();

  const coachInstanceId = (profile as any)?.coach_instance_id ?? null;
  const appRole = (profile as any)?.app_role as string;

  // Superusers see all default (global) content
  if (appRole === 'superuser') {
    const { data } = await (supabase as any)
      .from('playbooks').select('*')
      .is('coach_instance_id', null)
      .order('created_at', { ascending: false });
    return NextResponse.json({ playbooks: data ?? [] });
  }

  if (coachInstanceId) {
    const { data: inst } = await (supabase as any)
      .from('coach_instances').select('global_playbooks_enabled').eq('id', coachInstanceId).single();
    const globalEnabled = (inst as any)?.global_playbooks_enabled ?? false;

    let query;
    if (globalEnabled) {
      query = (supabase as any).from('playbooks').select('*')
        .or(`coach_instance_id.eq.${coachInstanceId},coach_instance_id.is.null`)
        .order('created_at', { ascending: false });
    } else {
      query = (supabase as any).from('playbooks').select('*')
        .eq('coach_instance_id', coachInstanceId)
        .order('created_at', { ascending: false });
    }
    const { data } = await query;
    return NextResponse.json({ playbooks: data ?? [] });
  }

  const { data } = await (supabase as any)
    .from('playbooks').select('*')
    .is('coach_instance_id', null)
    .order('created_at', { ascending: false });
  return NextResponse.json({ playbooks: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: profile } = await (supabase as any)
    .from('users')
    .select('id, app_role, coach_instance_id')
    .eq('auth_user_id', authUser.id)
    .single();

  if (!profile || !['coach', 'company_admin', 'superuser'].includes((profile as any).app_role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name, content, scenario_type } = await request.json();
  if (!name || !content) {
    return NextResponse.json({ error: 'name and content are required' }, { status: 400 });
  }

  const { data, error } = await (supabase as any)
    .from('playbooks')
    .insert({
      name,
      content,
      scenario_type: scenario_type ?? null,
      coach_instance_id: (profile as any).coach_instance_id ?? null,
      uploaded_by: (profile as any).id,
    })
    .select('id, name, scenario_type, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ playbook: data }, { status: 201 });
}
