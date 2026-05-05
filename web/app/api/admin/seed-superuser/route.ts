import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  // BOOTSTRAP ONLY — this is the single endpoint that still accepts
  // ADMIN_SECRET, used to seed the very first superuser. Bearer header
  // only (no query string, no cookie persistence) so accidental URL leaks
  // can't escalate.
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'ADMIN_SECRET not configured' }, { status: 503 });
  }
  const authHeader = request.headers.get('authorization');
  const provided = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceSupabase();

  // Create Supabase auth user (or fetch existing)
  let authUserId: string;
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'tim@blueoardesigns.com',
    password: 'testing',
    email_confirm: true,
  });

  if (authError) {
    // If already exists, look up the user by email
    const { data: { users: existingUsers } } = await supabase.auth.admin.listUsers();
    const existing = existingUsers.find(u => u.email === 'tim@blueoardesigns.com');
    if (!existing) return NextResponse.json({ error: authError.message }, { status: 400 });
    authUserId = existing.id;
  } else {
    authUserId = authData.user.id;
  }

  // Check if profile already exists
  const { data: existing } = await (supabase as any)
    .from('users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .single();

  if (!existing) {
    const { error: profileError } = await (supabase as any).from('users').insert({
      auth_user_id: authUserId,
      email: 'tim@blueoardesigns.com',
      name: 'Tim Bauer',
      full_name: 'Tim Bauer',
      role: 'manager',
      app_role: 'superuser',
      status: 'approved',
      scenario_access: [],
    });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, userId: authUserId });
}
