import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scenarioType = searchParams.get('scenario_type');

    if (!scenarioType) {
      return NextResponse.json({ error: 'scenario_type is required' }, { status: 400 });
    }

    const supabaseAuth = createServerSupabase();
    const { data: { user: authUser } } = await supabaseAuth.auth.getUser();

    let coachInstanceId: string | null = null;
    let globalEnabled = true;

    if (authUser) {
      const supabaseUser = createServiceSupabase();
      const { data: profile } = await (supabaseUser as any)
        .from('users').select('coach_instance_id').eq('auth_user_id', authUser.id).single();
      coachInstanceId = (profile as any)?.coach_instance_id ?? null;

      if (coachInstanceId) {
        const { data: inst } = await (supabaseUser as any)
          .from('coach_instances').select('global_playbooks_enabled').eq('id', coachInstanceId).single();
        globalEnabled = (inst as any)?.global_playbooks_enabled ?? false;
      }
    }

    const supabase = createServiceSupabase();

    if (coachInstanceId) {
      const { data: coachPlaybook } = await (supabase as any)
        .from('playbooks')
        .select('id, name, content, scenario_type')
        .eq('scenario_type', scenarioType)
        .eq('coach_instance_id', coachInstanceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (coachPlaybook) return NextResponse.json({ playbook: coachPlaybook });
      if (!globalEnabled) return NextResponse.json({ playbook: null });
    }

    const { data, error } = await (supabase as any)
      .from('playbooks')
      .select('id, name, content, scenario_type')
      .eq('scenario_type', scenarioType)
      .is('coach_instance_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return NextResponse.json({ playbook: null });
    return NextResponse.json({ playbook: data });
  } catch (error) {
    console.error('Error fetching scenario playbook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
