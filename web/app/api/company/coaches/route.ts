import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';
import { sendCoachApprovalRequest } from '@/lib/connection-emails';

async function getCompanyAdminProfile() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return null;
  const supabase = createServiceSupabase();
  const { data } = await (supabase as any)
    .from('users')
    .select('id, app_role, organization_id, full_name, email')
    .eq('auth_user_id', authUser.id)
    .single();
  if (!data || (data as any).app_role !== 'company_admin') return null;
  return data as any;
}

// GET /api/company/coaches — list connections for this company
export async function GET() {
  const profile = await getCompanyAdminProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: connections } = await (supabase as any)
    .from('company_coach_connections')
    .select('id, coach_instance_id, permission_level, status, requested_at, accepted_at')
    .eq('organization_id', profile.organization_id)
    .neq('status', 'declined')
    .order('requested_at', { ascending: false });

  // Enrich with coach names
  const enriched = await Promise.all(
    (connections ?? []).map(async (conn: any) => {
      const { data: coachUser } = await (supabase as any)
        .from('users')
        .select('full_name, email')
        .eq('coach_instance_id', conn.coach_instance_id)
        .eq('app_role', 'coach')
        .single();
      return {
        ...conn,
        coachName: (coachUser as any)?.full_name ?? 'Unknown Coach',
        coachEmail: (coachUser as any)?.email ?? '',
      };
    })
  );

  return NextResponse.json({ connections: enriched });
}

// POST /api/company/coaches — submit coach invite token, create pending connection
export async function POST(request: NextRequest) {
  const profile = await getCompanyAdminProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { inviteToken, permissionLevel } = await request.json();

  if (!inviteToken || !permissionLevel) {
    return NextResponse.json({ error: 'inviteToken and permissionLevel are required' }, { status: 400 });
  }

  if (!['edit_playbooks', 'readonly'].includes(permissionLevel)) {
    return NextResponse.json({ error: 'permissionLevel must be edit_playbooks or readonly' }, { status: 400 });
  }

  const supabase = createServiceSupabase();

  // Look up coach instance by invite token
  const { data: coachInstance } = await (supabase as any)
    .from('coach_instances')
    .select('id, name')
    .eq('invite_token', inviteToken.trim())
    .single();

  if (!coachInstance) {
    return NextResponse.json({ error: 'Coach not found. Check the invite code and try again.' }, { status: 404 });
  }

  // Prevent connecting to the coach that owns this company (if any)
  const { data: org } = await (supabase as any)
    .from('organizations')
    .select('coach_instance_id, name')
    .eq('id', profile.organization_id)
    .single();

  if ((org as any)?.coach_instance_id === (coachInstance as any).id) {
    return NextResponse.json({ error: 'This coach already manages your company.' }, { status: 409 });
  }

  // Check for duplicate
  const { data: existing } = await (supabase as any)
    .from('company_coach_connections')
    .select('id, status')
    .eq('organization_id', profile.organization_id)
    .eq('coach_instance_id', (coachInstance as any).id)
    .single();

  if (existing) {
    if ((existing as any).status === 'active') {
      return NextResponse.json({ error: 'This coach is already connected to your company.' }, { status: 409 });
    }
    if ((existing as any).status === 'pending') {
      return NextResponse.json({ error: 'A connection request is already pending for this coach.' }, { status: 409 });
    }
    // Declined — allow re-request by deleting old row
    await (supabase as any)
      .from('company_coach_connections')
      .delete()
      .eq('id', (existing as any).id);
  }

  // Create connection
  const { data: connection, error: insertError } = await (supabase as any)
    .from('company_coach_connections')
    .insert({
      organization_id: profile.organization_id,
      coach_instance_id: (coachInstance as any).id,
      permission_level: permissionLevel,
    })
    .select('id, approval_token')
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Get coach user details for email
  const { data: coachUser } = await (supabase as any)
    .from('users')
    .select('full_name, email')
    .eq('coach_instance_id', (coachInstance as any).id)
    .eq('app_role', 'coach')
    .single();

  if ((coachUser as any)?.email) {
    try {
      await sendCoachApprovalRequest({
        coachEmail: (coachUser as any).email,
        coachName: (coachUser as any).full_name ?? 'Coach',
        companyName: (org as any)?.name ?? 'A company',
        permissionLevel: permissionLevel as 'edit_playbooks' | 'readonly',
        approvalToken: (connection as any).approval_token,
      });
    } catch (emailError) {
      console.error('Failed to send coach approval email:', emailError);
      // Don't fail the request — connection is created, email is best-effort
    }
  }

  // In-app notification to the coach that someone wants them as their coach.
  const { data: coachProfile } = await (supabase as any)
    .from('users')
    .select('id')
    .eq('coach_instance_id', (coachInstance as any).id)
    .eq('app_role', 'coach')
    .single();

  if (coachProfile) {
    await (supabase as any).from('notifications').insert({
      user_id: (coachProfile as any).id,
      type: 'coach_added_by_user',
      title: `${(org as any)?.name ?? 'A company'} added you as their coach`,
      body: 'Review and accept the connection request to gain access.',
      data: { link: '/coach', organization_id: profile.organization_id },
    });
  }

  return NextResponse.json({ ok: true, connectionId: (connection as any).id }, { status: 201 });
}
