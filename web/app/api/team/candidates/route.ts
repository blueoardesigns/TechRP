import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';
import { randomBytes } from 'crypto';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function getAdminContext(authUserId: string) {
  const supabase = createServiceSupabase();
  const { data: admin } = await (supabase as any)
    .from('users')
    .select('id, organization_id, coach_instance_id, app_role')
    .eq('auth_user_id', authUserId)
    .single();
  if (!admin || (admin as any).app_role !== 'company_admin' || !(admin as any).organization_id) {
    return null;
  }
  return admin as { id: string; organization_id: string; coach_instance_id: string | null; app_role: string };
}

export async function GET() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await getAdminContext(authUser.id);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();

  // Get all invites for this org
  const { data: invites } = await (supabase as any)
    .from('candidate_invites')
    .select('*')
    .eq('organization_id', admin.organization_id)
    .order('created_at', { ascending: false });

  // Get session counts per signed-up candidate for progress display
  const signedUpIds = ((invites ?? []) as any[])
    .map(i => i.signed_up_user_id)
    .filter(Boolean);

  let sessionsByUser: Record<string, Record<string, number>> = {};
  if (signedUpIds.length > 0) {
    const { data: sessions } = await (supabase as any)
      .from('training_sessions')
      .select('user_id, persona_scenario_type')
      .in('user_id', signedUpIds);

    ((sessions ?? []) as any[]).forEach((s) => {
      if (!s.persona_scenario_type) return;
      if (!sessionsByUser[s.user_id]) sessionsByUser[s.user_id] = {};
      sessionsByUser[s.user_id][s.persona_scenario_type] =
        (sessionsByUser[s.user_id][s.persona_scenario_type] ?? 0) + 1;
    });
  }

  const enriched = ((invites ?? []) as any[]).map(invite => {
    const assigned: { scenario_type: string; count: number }[] = invite.assigned_scenarios ?? [];
    const userSessions = invite.signed_up_user_id ? (sessionsByUser[invite.signed_up_user_id] ?? {}) : {};
    const sessionsComplete = assigned.reduce((sum, s) =>
      sum + Math.min(userSessions[s.scenario_type] ?? 0, s.count), 0);
    const sessionsTotal = assigned.reduce((sum, s) => sum + s.count, 0);
    return {
      ...invite,
      invite_url: `${APP_URL}/signup?candidate=${invite.personal_token}`,
      progress: { sessionsComplete, sessionsTotal },
    };
  });

  return NextResponse.json({ candidates: enriched });
}

export async function POST(req: NextRequest) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await getAdminContext(authUser.id);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { email, full_name, assigned_scenarios, expires_in_days = 30 } = await req.json();

  if (!email || !assigned_scenarios?.length) {
    return NextResponse.json({ error: 'email and assigned_scenarios are required' }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  const personal_token = randomBytes(16).toString('hex');
  const expires_at = new Date(Date.now() + expires_in_days * 86400_000).toISOString();

  const { data: invite, error } = await (supabase as any)
    .from('candidate_invites')
    .insert({
      email,
      full_name: full_name ?? null,
      personal_token,
      invited_by_user_id: admin.id,
      organization_id: admin.organization_id,
      coach_instance_id: admin.coach_instance_id,
      assigned_scenarios,
      expires_at,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A candidate with that email has already been invited.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    invite: {
      ...(invite as any),
      invite_url: `${APP_URL}/signup?candidate=${personal_token}`,
    },
  }, { status: 201 });
}
