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
  if (!admin || !allowedRoles.includes((admin as any).app_role) || !(admin as any).organization_id) {
    if (!admin || !allowedRoles.includes((admin as any).app_role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Allowed role but no org yet — return empty
    return NextResponse.json({ members: [], inviteToken: '' });
  }

  const orgId = (admin as any).organization_id;

  const { data: org } = await (supabase as any)
    .from('organizations')
    .select('invite_token')
    .eq('id', orgId)
    .single();

  const { data: members } = await (supabase as any)
    .from('users')
    .select('id, full_name, email, status, created_at')
    .eq('organization_id', orgId)
    .eq('app_role', 'individual')
    .order('created_at', { ascending: false });

  const memberIds = (members ?? []).map((m: any) => m.id);
  const { data: sessions } = memberIds.length
    ? await (supabase as any).from('training_sessions').select('user_id').in('user_id', memberIds)
    : { data: [] };

  const sessionMap: Record<string, number> = {};
  (sessions ?? []).forEach((s: any) => { sessionMap[s.user_id] = (sessionMap[s.user_id] ?? 0) + 1; });

  return NextResponse.json({
    members: (members ?? []).map((m: any) => ({ ...m, sessionCount: sessionMap[m.id] ?? 0 })),
    inviteToken: (org as any)?.invite_token ?? '',
  });
}
