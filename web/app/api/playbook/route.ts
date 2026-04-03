import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';

// GET /api/playbook?scenario_type=homeowner_inbound
// Returns the active playbook for a scenario (used by assessment rubric)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scenarioType = searchParams.get('scenario_type');

    if (!scenarioType) {
      return NextResponse.json({ error: 'scenario_type is required' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    const { data, error } = await (supabase
      .from('playbooks' as any)
      .select('id, name, content, scenario_type')
      .eq('scenario_type', scenarioType)
      .order('created_at', { ascending: false })
      .limit(1)
      .single() as any);

    if (error || !data) {
      return NextResponse.json({ playbook: null });
    }

    return NextResponse.json({ playbook: data });
  } catch (error) {
    console.error('Error fetching scenario playbook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
