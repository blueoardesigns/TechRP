import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function PATCH(req: NextRequest, { params }: { params: { memberId: string } }) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: admin } = await (supabase as any)
    .from('users')
    .select('id, email, organization_id, app_role')
    .eq('auth_user_id', authUser.id)
    .single();

  const allowedRoles = ['company_admin', 'superuser'];
  if (!admin || !allowedRoles.includes((admin as any).app_role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify target is in same org
  const { data: target } = await (supabase as any)
    .from('users')
    .select('organization_id, status')
    .eq('id', params.memberId)
    .single();

  if (!target || (target as any).organization_id !== (admin as any).organization_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();

  // Handle status toggle (activate / deactivate)
  if ('status' in body) {
    const newStatus = body.status;
    if (!['approved', 'rejected'].includes(newStatus)) {
      return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 });
    }

    // Seat limit enforcement (skip for superuser)
    if (newStatus === 'approved' && (admin as any).app_role !== 'superuser') {
      const { data: org } = await (supabase as any)
        .from('organizations')
        .select('seat_limit')
        .eq('id', (admin as any).organization_id)
        .single();

      const { count } = await (supabase as any)
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', (admin as any).organization_id)
        .eq('status', 'approved')
        .neq('id', params.memberId);

      const seatLimit = (org as any)?.seat_limit ?? 0;
      if (seatLimit > 0 && (count ?? 0) >= seatLimit) {
        return NextResponse.json(
          { error: `Seat limit reached (${seatLimit} active). Upgrade your plan to add more members.` },
          { status: 409 }
        );
      }
    }

    await (supabase as any).from('users').update({ status: newStatus }).eq('id', params.memberId);
    return NextResponse.json({ success: true });
  }

  // Handle scenario_access update
  if ('scenario_access' in body) {
    if (!Array.isArray(body.scenario_access)) {
      return NextResponse.json({ error: 'scenario_access must be an array' }, { status: 400 });
    }
    const valid = ['technician', 'property_manager', 'insurance', 'plumber_bd'];
    const invalid = (body.scenario_access as string[]).filter(s => !valid.includes(s));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Invalid scenario types: ${invalid.join(', ')}` }, { status: 400 });
    }
    const { error } = await (supabase as any)
      .from('users')
      .update({ scenario_access: body.scenario_access })
      .eq('id', params.memberId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'No valid field to update' }, { status: 400 });
}
