import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
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
  if (!admin || !allowedRoles.includes((admin as any).app_role) || !(admin as any).organization_id) {
    return NextResponse.json({ sessions: [] });
  }

  const orgId = (admin as any).organization_id;
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'all';
  const scenarioType = url.searchParams.get('scenarioType') ?? 'all';
  const range = url.searchParams.get('range') ?? 'all';

  // Get all individual members of this org
  const { data: members } = await (supabase as any)
    .from('users')
    .select('id, full_name, email')
    .eq('organization_id', orgId)
    .eq('app_role', 'individual');

  const memberMap: Record<string, { full_name: string; email: string }> = {};
  for (const m of (members ?? []) as any[]) memberMap[m.id] = m;
  const memberIds = Object.keys(memberMap);
  if (!memberIds.length) return NextResponse.json({ sessions: [], members: [] });

  let query = (supabase as any)
    .from('training_sessions')
    .select('id, user_id, started_at, ended_at, assessment, persona_name, persona_scenario_type')
    .in('user_id', memberIds)
    .order('started_at', { ascending: false })
    .limit(200);

  if (userId !== 'all') query = query.eq('user_id', userId);
  if (scenarioType !== 'all') query = query.eq('persona_scenario_type', scenarioType);

  if (range !== 'all') {
    let cutoff: Date;
    const now = new Date();
    if (range === '7d') cutoff = new Date(now.getTime() - 7 * 86400_000);
    else if (range === '30d') cutoff = new Date(now.getTime() - 30 * 86400_000);
    else if (range === '365d') cutoff = new Date(now.getTime() - 365 * 86400_000);
    else { // ytd
      cutoff = new Date(now.getFullYear(), 0, 1);
    }
    query = query.gte('started_at', cutoff.toISOString());
  }

  const { data: sessions } = await query;

  const enriched = ((sessions ?? []) as any[]).map(s => {
    const raw = s.assessment;
    let score: number | null = null;
    if (raw) {
      const a = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (typeof a.score === 'number') {
        score = a.score <= 10 ? Math.round(a.score * 10) : Math.round(a.score);
      }
    }
    return { ...s, score, user: memberMap[s.user_id] ?? null };
  });

  return NextResponse.json({
    sessions: enriched,
    members: (members ?? []).map((m: any) => ({ id: m.id, full_name: m.full_name })),
  });
}
