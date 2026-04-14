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
    .select('id, app_role, coach_instance_id')
    .eq('auth_user_id', authUser.id)
    .single();
  if (!data || (data as any).app_role !== 'coach' && (data as any).app_role !== 'superuser') return null;
  return data as any;
}

export async function GET() {
  const profile = await getCoachInstance();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: orgs } = await (supabase as any)
    .from('organizations')
    .select('id, name, invite_token, created_at')
    .eq('coach_instance_id', profile.coach_instance_id)
    .order('created_at', { ascending: false });

  // Get user counts per org
  const orgIds = (orgs ?? []).map((o: any) => o.id);
  const { data: users } = orgIds.length
    ? await (supabase as any).from('users').select('id, organization_id').in('organization_id', orgIds)
    : { data: [] };

  const countMap: Record<string, number> = {};
  (users ?? []).forEach((u: any) => {
    countMap[u.organization_id] = (countMap[u.organization_id] ?? 0) + 1;
  });

  const result = (orgs ?? []).map((o: any) => ({ ...o, userCount: countMap[o.id] ?? 0 }));
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
    .insert({ name, coach_instance_id: profile.coach_instance_id, invite_token: inviteToken })
    .select('id, name, invite_token')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ company: { ...(data as any), userCount: 0 } });
}
