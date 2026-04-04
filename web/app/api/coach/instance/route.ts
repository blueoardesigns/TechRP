import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

async function getCoachProfile() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return null;
  const supabase = createServiceSupabase();
  const { data } = await (supabase as any)
    .from('users')
    .select('id, app_role, coach_instance_id')
    .eq('auth_user_id', authUser.id)
    .single();
  if (!data || (data as any).app_role !== 'coach') return null;
  return data as any;
}

export async function GET() {
  const profile = await getCoachProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data } = await (supabase as any)
    .from('coach_instances')
    .select('*')
    .eq('id', profile.coach_instance_id)
    .single();

  return NextResponse.json({ instance: data });
}

export async function PATCH(req: NextRequest) {
  const profile = await getCoachProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const allowed = ['auto_approve_users', 'global_playbooks_enabled', 'global_personas_enabled'];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  const supabase = createServiceSupabase();
  await (supabase as any).from('coach_instances').update(updates).eq('id', profile.coach_instance_id);
  return NextResponse.json({ success: true });
}
