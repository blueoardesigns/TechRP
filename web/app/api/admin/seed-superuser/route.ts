import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  // Auth check — must have ADMIN_SECRET
  const secret = process.env.ADMIN_SECRET;
  const authHeader = request.headers.get('authorization');
  const cookieKey = request.cookies.get('admin_key')?.value;
  const provided = authHeader?.replace('Bearer ', '') ?? cookieKey;
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceSupabase();

  // Create Supabase auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'tim@blueoardesigns.com',
    password: 'testing',
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const authUserId = authData.user.id;

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
      full_name: 'Tim Bauer',
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
