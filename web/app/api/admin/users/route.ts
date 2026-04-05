import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

async function isAuthorized(request: NextRequest): Promise<boolean> {
  // Option 1: admin_key cookie
  const key = request.cookies.get('admin_key')?.value;
  if (key && key === process.env.ADMIN_SECRET) return true;
  // Option 2: logged in as superuser
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return false;
  const sb = createServiceSupabase();
  const { data: profile } = await (sb as any).from('users').select('app_role').eq('auth_user_id', authUser.id).single();
  return (profile as any)?.app_role === 'superuser';
}

export async function GET(request: NextRequest) {
  if (!await isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceSupabase();

  // Fetch all users
  const { data: users, error } = await (supabase as any)
    .from('users')
    .select('id, auth_user_id, email, full_name, name, app_role, status, organization_id, coach_instance_id, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch all training sessions for stats
  const { data: sessions } = await (supabase as any)
    .from('training_sessions')
    .select('id, user_id, started_at, ended_at, assessment');

  // Build per-user stats
  const statsMap: Record<string, { sessionCount: number; totalMinutes: number; scores: number[] }> = {};
  for (const s of (sessions ?? [])) {
    if (!statsMap[s.user_id]) statsMap[s.user_id] = { sessionCount: 0, totalMinutes: 0, scores: [] };
    statsMap[s.user_id].sessionCount++;
    if (s.ended_at && s.started_at) {
      const mins = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000;
      statsMap[s.user_id].totalMinutes += mins;
    }
    try {
      const a = typeof s.assessment === 'string' ? JSON.parse(s.assessment) : s.assessment;
      if (typeof a?.score === 'number') statsMap[s.user_id].scores.push(a.score);
    } catch {}
  }

  // Fetch org names
  const { data: orgs } = await (supabase as any).from('organizations').select('id, name');
  const orgMap: Record<string, string> = {};
  for (const o of (orgs ?? [])) orgMap[o.id] = o.name;

  const enriched = (users ?? []).map((u: any) => {
    const stats = statsMap[u.id] ?? { sessionCount: 0, totalMinutes: 0, scores: [] };
    const avgScore = stats.scores.length
      ? Math.round((stats.scores.reduce((a: number, b: number) => a + b, 0) / stats.scores.length) * 10) / 10
      : null;
    return {
      id: u.id,
      email: u.email,
      fullName: u.full_name ?? u.name ?? '',
      role: u.app_role,
      status: u.status,
      organizationName: u.organization_id ? (orgMap[u.organization_id] ?? u.organization_id) : null,
      createdAt: u.created_at,
      sessionCount: stats.sessionCount,
      totalMinutes: Math.round(stats.totalMinutes),
      avgScore,
    };
  });

  return NextResponse.json({ users: enriched });
}
