import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';

/**
 * Authorize a persona mutation. Returns null on success or a NextResponse on error.
 *
 *  - Global personas (coach_instance_id = null): only superusers
 *  - Coach-instance personas: only members of that coach_instance, plus superusers
 */
async function authorizePersonaMutation(
  service: ReturnType<typeof import('@/lib/supabase-server').createServiceSupabase>,
  personaId: string,
  caller: { profileId: string; appRole: string | null; coachInstanceId: string | null }
): Promise<{ persona: { coach_instance_id: string | null } } | NextResponse> {
  const { data: persona, error } = await (service as any)
    .from('personas')
    .select('coach_instance_id')
    .eq('id', personaId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!persona) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (caller.appRole === 'superuser') return { persona };
  if (persona.coach_instance_id === null) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!caller.coachInstanceId || persona.coach_instance_id !== caller.coachInstanceId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { persona };
}

// PUT /api/personas/:id — update a persona (coach/company_admin/superuser only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser({ roles: ['coach', 'company_admin', 'superuser'] });
  if (!auth.ok) return auth.response;
  const { user, service: supabase } = auth;
  const { id } = params;

  const authz = await authorizePersonaMutation(supabase, id, user);
  if (authz instanceof NextResponse) return authz;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    name,
    personality_type,
    brief_description,
    speaker_label,
    first_message,
    system_prompt,
  } = body;

  const { data, error } = await (supabase as any)
    .from('personas')
    .update({
      name,
      personality_type,
      brief_description,
      speaker_label,
      first_message,
      system_prompt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating persona:', error);
    return NextResponse.json({ error: 'Failed to update persona' }, { status: 500 });
  }

  return NextResponse.json({ persona: data });
}

// DELETE /api/personas/:id — soft delete (coach/company_admin/superuser only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser({ roles: ['coach', 'company_admin', 'superuser'] });
  if (!auth.ok) return auth.response;
  const { user, service: supabase } = auth;
  const { id } = params;

  const authz = await authorizePersonaMutation(supabase, id, user);
  if (authz instanceof NextResponse) return authz;

  const { error } = await (supabase as any)
    .from('personas')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error deleting persona:', error);
    return NextResponse.json({ error: 'Failed to delete persona' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
