import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createServiceRoleClient } from '@/lib/supabase';

export async function GET() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();
  const { data: coach } = await (supabase as any)
    .from('users')
    .select('coach_instance_id, app_role')
    .eq('auth_user_id', authUser.id)
    .single();

  if (!coach || (coach as any).app_role !== 'coach' && (coach as any).app_role !== 'superuser') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: users } = await (supabase as any)
    .from('users')
    .select('id, full_name, email, app_role, status, created_at, organization_id')
    .eq('coach_instance_id', (coach as any).coach_instance_id)
    .order('created_at', { ascending: false });

  // Get session counts
  const userIds = (users ?? []).map((u: any) => u.id);
  const { data: sessions } = userIds.length
    ? await (supabase as any).from('training_sessions').select('user_id').in('user_id', userIds)
    : { data: [] };

  const sessionMap: Record<string, number> = {};
  (sessions ?? []).forEach((s: any) => {
    sessionMap[s.user_id] = (sessionMap[s.user_id] ?? 0) + 1;
  });

  const result = (users ?? []).map((u: any) => ({ ...u, sessionCount: sessionMap[u.id] ?? 0 }));
  return NextResponse.json({ users: result });
}
