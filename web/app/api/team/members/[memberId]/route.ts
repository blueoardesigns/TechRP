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

  const body = await req.json();

  // Handle status deactivation
  if ('status' in body) {
    if (body.status !== 'rejected') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    await (supabase as any).from('users').update({ status: 'rejected' }).eq('id', params.memberId);
    return NextResponse.json({ success: true });
  }

  // Handle scenario_access update
  if ('scenario_access' in body) {
    if (!Array.isArray(body.scenario_access)) {
      return NextResponse.json({ error: 'scenario_access must be an array' }, { status: 400 });
    }
    const valid = ['technician', 'property_manager', 'insurance', 'plumber_bd'];
    const invalid = body.scenario_access.filter((s: string) => !valid.includes(s));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Invalid scenario types: ${invalid.join(', ')}` }, { status: 400 });
    }
    await (supabase as any)
      .from('users')
      .update({ scenario_access: body.scenario_access })
      .eq('id', params.memberId);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'No valid field to update' }, { status: 400 });
}
