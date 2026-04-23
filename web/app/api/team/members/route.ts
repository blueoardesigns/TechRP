import { NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function GET() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: admin } = await (supabase as any)
    .from('users')
    .select('id, organization_id, app_role')
    .eq('auth_user_id', authUser.id)
    .single();

  const allowedRoles = ['company_admin', 'superuser'];
  if (!admin || !allowedRoles.includes((admin as any).app_role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(admin as any).organization_id) {
    return NextResponse.json({ members: [], inviteToken: '', seatLimit: 0, activeCount: 0 });
  }

  const orgId = (admin as any).organization_id;

  const [orgRes, membersRes] = await Promise.all([
    (supabase as any).from('organizations').select('invite_token, seat_limit').eq('id', orgId).single(),
    (supabase as any)
      .from('users')
      .select('id, full_name, email, status, created_at, scenario_access')
      .eq('organization_id', orgId)
      .eq('app_role', 'individual')
      .order('created_at', { ascending: false }),
  ]);

  const members: any[] = membersRes.data ?? [];
  const memberIds = members.map((m: any) => m.id);

  // Fetch all sessions for org members
  const { data: sessions } = memberIds.length
    ? await (supabase as any)
        .from('training_sessions')
        .select('id, user_id, started_at, assessment')
        .in('user_id', memberIds)
    : { data: [] };

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();

  // Build per-member stats
  const statsMap: Record<string, {
    sessionCount: number;
    sessions30d: number;
    lastSessionAt: string | null;
    avgScore: number | null;
  }> = {};

  for (const s of (sessions ?? []) as any[]) {
    if (!statsMap[s.user_id]) {
      statsMap[s.user_id] = { sessionCount: 0, sessions30d: 0, lastSessionAt: null, avgScore: null };
    }
    const st = statsMap[s.user_id];
    st.sessionCount += 1;
    if (s.started_at > thirtyDaysAgo) st.sessions30d += 1;
    if (!st.lastSessionAt || s.started_at > st.lastSessionAt) st.lastSessionAt = s.started_at;

    // Parse score
    const raw = s.assessment as any;
    if (raw) {
      const score = typeof raw === 'string' ? JSON.parse(raw).score : raw.score;
      if (typeof score === 'number') {
        const display = score <= 10 ? Math.round(score * 10) : Math.round(score);
        if (st.avgScore === null) st.avgScore = display;
        else st.avgScore = Math.round((st.avgScore + display) / 2);
      }
    }
  }

  const activeCount = members.filter((m: any) => m.status === 'approved').length;

  return NextResponse.json({
    members: members.map((m: any) => ({
      ...m,
      ...(statsMap[m.id] ?? { sessionCount: 0, sessions30d: 0, lastSessionAt: null, avgScore: null }),
    })),
    inviteToken: (orgRes.data as any)?.invite_token ?? '',
    seatLimit: (orgRes.data as any)?.seat_limit ?? 0,
    activeCount,
  });
}
