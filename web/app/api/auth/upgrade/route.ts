import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'You must be logged in to upgrade.' }, { status: 401 });

  const supabase = createServiceSupabase();

  // Look up invite by token
  const { data: invite } = await (supabase as any)
    .from('candidate_invites')
    .select('id, status, signed_up_user_id')
    .eq('personal_token', token)
    .single();

  if (!invite) return NextResponse.json({ error: 'Invalid upgrade link.' }, { status: 400 });
  if ((invite as any).status !== 'complete') {
    return NextResponse.json({ error: 'Assessment not yet complete.' }, { status: 400 });
  }

  // Verify the logged-in user owns this invite
  const { data: userRow } = await (supabase as any)
    .from('users')
    .select('id, user_type')
    .eq('auth_user_id', authUser.id)
    .single();

  if (!userRow || (userRow as any).id !== (invite as any).signed_up_user_id) {
    return NextResponse.json({ error: 'This upgrade link is not for your account.' }, { status: 403 });
  }

  if ((userRow as any).user_type !== 'candidate') {
    return NextResponse.json({ error: 'Account is already a full account.' }, { status: 400 });
  }

  // Upgrade the account
  await (supabase as any)
    .from('users')
    .update({
      user_type: 'standard',
      session_limit: null,
      status: 'approved',
    })
    .eq('id', (userRow as any).id);

  await (supabase as any)
    .from('candidate_invites')
    .update({ status: 'upgraded' })
    .eq('id', (invite as any).id);

  return NextResponse.json({ success: true });
}
