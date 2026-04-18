import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createServiceRoleClient } from '@/lib/supabase';

async function getCallerProfile() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return null;
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('users')
    .select('id, app_role, coach_instance_id')
    .eq('auth_user_id', authUser.id)
    .single();
  return (data as any) ?? null;
}

function isCoach(profile: any) {
  return profile?.app_role === 'coach' || profile?.app_role === 'superuser';
}

// GET — coach gets their note; user gets the shared note (if any)
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const profile = await getCallerProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();

  if (isCoach(profile)) {
    const { data } = await (supabase as any)
      .from('coach_notes')
      .select('id, content, is_shared, updated_at')
      .eq('session_id', params.id)
      .eq('coach_id', profile.id)
      .maybeSingle();
    return NextResponse.json({ note: data ?? null, isCoach: true });
  }

  // Regular user — only see shared note
  const { data } = await (supabase as any)
    .from('coach_notes')
    .select('content, updated_at')
    .eq('session_id', params.id)
    .eq('is_shared', true)
    .maybeSingle();
  return NextResponse.json({ note: data ?? null, isCoach: false });
}

// PUT — upsert note content (coach only)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const profile = await getCallerProfile();
  if (!profile || !isCoach(profile)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { content } = await req.json();
  if (typeof content !== 'string') {
    return NextResponse.json({ error: 'content required' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await (supabase as any)
    .from('coach_notes')
    .upsert(
      { session_id: params.id, coach_id: profile.id, content, updated_at: new Date().toISOString() },
      { onConflict: 'session_id,coach_id' }
    )
    .select('id, content, is_shared, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data });
}

// PATCH — toggle is_shared; send notification when sharing (coach only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const profile = await getCallerProfile();
  if (!profile || !isCoach(profile)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { is_shared } = await req.json();
  const supabase = createServiceRoleClient();

  const { data: note, error } = await (supabase as any)
    .from('coach_notes')
    .update({ is_shared, updated_at: new Date().toISOString() })
    .eq('session_id', params.id)
    .eq('coach_id', profile.id)
    .select('id, content, is_shared, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send notification to session owner when coach shares
  if (is_shared) {
    const { data: session } = await (supabase as any)
      .from('training_sessions')
      .select('user_id, persona_scenario_type, started_at')
      .eq('id', params.id)
      .single();

    if (session) {
      const scenario = (session as any).persona_scenario_type ?? 'training';
      const date = new Date((session as any).started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      await (supabase as any).from('notifications').insert({
        user_id: (session as any).user_id,
        type: 'coach_note',
        title: 'Your coach left feedback',
        body: `New coaching notes on your ${scenario.replace(/_/g, ' ')} session from ${date}.`,
        data: { session_id: params.id },
      });
    }
  }

  return NextResponse.json({ note });
}
