import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';
import { randomBytes } from 'crypto';

async function getCoachInstance() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return null;
  const supabase = createServiceSupabase();
  const { data } = await (supabase as any)
    .from('users')
    .select('id, app_role, coach_instance_id, organization_id')
    .eq('auth_user_id', authUser.id)
    .single();
  if (!data || ((data as any).app_role !== 'coach' && (data as any).app_role !== 'superuser')) return null;
  return data as any;
}

export async function GET() {
  const profile = await getCoachInstance();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();

  let orgIds: string[] = [];

  if (profile.app_role === 'superuser') {
    // Superuser sees all orgs connected via company_coach_connections
    const { data: conns } = await (supabase as any)
      .from('company_coach_connections')
      .select('organization_id')
      .in('status', ['active', 'pending']);
    orgIds = [...new Set(((conns ?? []) as any[]).map((c: any) => c.organization_id))];
  } else {
    // Coach sees orgs connected to their coach_instance_id
    const { data: conns } = await (supabase as any)
      .from('company_coach_connections')
      .select('organization_id')
      .eq('coach_instance_id', profile.coach_instance_id)
      .in('status', ['active', 'pending']);
    orgIds = ((conns ?? []) as any[]).map((c: any) => c.organization_id);
  }

  // Exclude the caller's own organization (coaches shouldn't see their own org in coached teams)
  if (profile.organization_id) {
    orgIds = orgIds.filter((id: string) => id !== profile.organization_id);
  }

  if (!orgIds.length) return NextResponse.json({ companies: [] });

  const { data: orgs } = await (supabase as any)
    .from('organizations')
    .select('id, name, invite_token, created_at')
    .in('id', orgIds)
    .order('name');

  // Get user counts per org
  const { data: users } = orgIds.length
    ? await (supabase as any).from('users').select('id, organization_id').in('organization_id', orgIds)
    : { data: [] };

  const countMap: Record<string, number> = {};
  ((users ?? []) as any[]).forEach((u: any) => {
    countMap[u.organization_id] = (countMap[u.organization_id] ?? 0) + 1;
  });

  const result = ((orgs ?? []) as any[]).map((o: any) => ({ ...o, userCount: countMap[o.id] ?? 0 }));
  return NextResponse.json({ companies: result });
}

export async function POST(req: NextRequest) {
  const profile = await getCoachInstance();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const inviteToken = randomBytes(6).toString('hex');
  const supabase = createServiceSupabase();
  const { data, error } = await (supabase as any)
    .from('organizations')
    .insert({ name, invite_token: inviteToken })
    .select('id, name, invite_token')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ company: { ...(data as any), userCount: 0 } });
}
