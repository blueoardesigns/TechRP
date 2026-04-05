import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const key = request.cookies.get('admin_key')?.value;
  if (key && key === process.env.ADMIN_SECRET) return true;
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return false;
  const sb = createServiceSupabase();
  const { data: profile } = await (sb as any).from('users').select('app_role').eq('auth_user_id', authUser.id).single();
  return (profile as any)?.app_role === 'superuser';
}

export async function PATCH(request: NextRequest, { params }: { params: { userId: string } }) {
  if (!await isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = params;
  const body = await request.json();
  const ALLOWED = ['app_role', 'status', 'full_name'] as const;
  const update: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (body[key] !== undefined) update[key] = body[key];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  const { error } = await (supabase as any).from('users').update(update).eq('id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: { userId: string } }) {
  if (!await isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = params;
  const supabase = createServiceSupabase();

  // Get auth_user_id first for Supabase auth deletion
  const { data: profile } = await (supabase as any)
    .from('users').select('auth_user_id').eq('id', userId).single();

  const { error: dbError } = await (supabase as any).from('users').delete().eq('id', userId);
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  // Delete from Supabase auth
  if ((profile as any)?.auth_user_id) {
    await supabase.auth.admin.deleteUser((profile as any).auth_user_id);
  }

  return NextResponse.json({ success: true });
}
