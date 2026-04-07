import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function PATCH(req: NextRequest) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { fullName, email } = await req.json();
  if (!fullName && !email) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const supabase = createServiceSupabase();

  // Update users table
  const updates: Record<string, string> = {};
  if (fullName) { updates.full_name = fullName; updates.name = fullName; }
  if (email) updates.email = email;

  const { data: updatedProfile, error: profileError } = await (supabase as any)
    .from('users')
    .update(updates)
    .eq('auth_user_id', authUser.id)
    .select('id, full_name, email, app_role, status, scenario_access, coach_instance_id, organization_id')
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Sync email change to Supabase Auth
  if (email && email !== authUser.email) {
    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
      authUser.id,
      { email }
    );
    if (authUpdateError) {
      // Profile already updated — log but don't fail the request
      console.error('Failed to sync email to Supabase Auth:', authUpdateError);
    }
  }

  return NextResponse.json({ profile: updatedProfile });
}
