// web/app/api/coach/team/route.ts
// Mirrors /api/team/sessions + /api/team/members but for a coached org.
// Caller must be a coach (or superuser) with an active/pending connection to that org.
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createServiceRoleClient } from '@/lib/supabase';

async function getCoachContext(authUserId: string) {
  const supabase = createServiceRoleClient();
  const { data } = await (supabase as any)
    .from('users')
    .select('id, app_role, coach_instance_id')
    .eq('auth_user_id', authUserId)
    .single();
  if (!data) return null;
  const role = (data as any).app_role;
  if (role !== 'coach' && role !== 'superuser') return null;
  return data as any;
}

export async function GET(req: NextRequest) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const coach = await getCoachContext(authUser.id);
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const orgId = url.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const supabase = createServiceRoleClient();

  // Verify coach has access to this org (skip for superuser)
  if (coach.app_role !== 'superuser') {
    const { data: conn } = await (supabase as any)
      .from('company_coach_connections')
      .select('id, status')
      .eq('organization_id', orgId)
      .eq('coach_instance_id', coach.coach_instance_id)
      .in('status', ['active', 'pending'])
      .single();
    if (!conn) return NextResponse.json({ error: 'No access to this org' }, { status: 403 });
  }

  // Fetch org info + members + sessions
  const [orgRes, membersRes] = await Promise.all([
    (supabase as any).from('organizations').select('id, name, seat_limit').eq('id', orgId).single(),
    (supabase as any)
      .from('users')
      .select('id, full_name, email, status, created_at, scenario_access')
      .eq('organization_id', orgId)
      .eq('app_role', 'individual')
      .order('created_at', { ascending: false }),
  ]);

  const members: any[] = membersRes.data ?? [];
  const memberIds = members.map((m: any) => m.id);

  const { data: sessions } = memberIds.length
    ? await (supabase as any)
        .from('training_sessions')
        .select('id, user_id, started_at, ended_at, assessment, persona_name, persona_scenario_type')
        .in('user_id', memberIds)
        .order('started_at', { ascending: false })
        .limit(500)
    : { data: [] };

  // Build member stats
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();
  const statsMap: Record<string, any> = {};
  for (const s of (sessions ?? []) as any[]) {
    if (!statsMap[s.user_id]) statsMap[s.user_id] = { sessionCount: 0, sessions30d: 0, lastSessionAt: null, avgScore: null };
    const st = statsMap[s.user_id];
    st.sessionCount += 1;
    if (s.started_at > thirtyDaysAgo) st.sessions30d += 1;
    if (!st.lastSessionAt || s.started_at > st.lastSessionAt) st.lastSessionAt = s.started_at;
    const raw = s.assessment;
    if (raw) {
      const a = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (typeof a.score === 'number') {
        const display = a.score <= 10 ? Math.round(a.score * 10) : Math.round(a.score);
        st.avgScore = st.avgScore === null ? display : Math.round((st.avgScore + display) / 2);
      }
    }
  }

  const memberMap: Record<string, any> = {};
  for (const m of members) memberMap[m.id] = m;

  const enrichedSessions = ((sessions ?? []) as any[]).map(s => {
    const raw = s.assessment;
    let score: number | null = null;
    if (raw) {
      const a = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (typeof a.score === 'number') score = a.score <= 10 ? Math.round(a.score * 10) : Math.round(a.score);
    }
    return { ...s, score, user: memberMap[s.user_id] ?? null };
  });

  return NextResponse.json({
    org: orgRes.data,
    members: members.map((m: any) => ({ ...m, ...(statsMap[m.id] ?? { sessionCount: 0, sessions30d: 0, lastSessionAt: null, avgScore: null }) })),
    sessions: enrichedSessions,
  });
}
