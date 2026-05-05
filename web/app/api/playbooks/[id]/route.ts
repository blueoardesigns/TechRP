import { NextRequest, NextResponse } from 'next/server';
import { requireUser, canAccessOwned } from '@/lib/api-auth';

const FALLBACK_ORG = '00000000-0000-0000-0000-000000000001';

async function loadPlaybook(service: ReturnType<typeof import('@/lib/supabase-server').createServiceSupabase>, id: string) {
  const { data, error } = await (service as any)
    .from('playbooks')
    .select('id, organization_id, uploaded_by, name, content, scenario_type, is_active, created_at, updated_at, file_url')
    .eq('id', id)
    .maybeSingle();
  return { data, error };
}

/** Returns true if `user` may view this playbook. */
function canRead(
  user: { appRole: string | null; profileId: string; organizationId: string | null; coachInstanceId: string | null },
  pb: { organization_id: string | null; uploaded_by: string | null },
): boolean {
  if (user.appRole === 'superuser') return true;
  // Global default playbooks (FALLBACK_ORG) are readable by all approved users.
  if (pb.organization_id === FALLBACK_ORG) return true;
  return canAccessOwned(
    {
      appRole: user.appRole as never,
      profileId: user.profileId,
      organizationId: user.organizationId,
      authUserId: '',
      email: '',
      status: 'approved',
      coachInstanceId: user.coachInstanceId,
      userType: null,
    },
    pb.uploaded_by,
    pb.organization_id,
  );
}

/** Returns true if `user` may modify/delete this playbook. */
function canWrite(
  user: { appRole: string | null; profileId: string; organizationId: string | null },
  pb: { organization_id: string | null; uploaded_by: string | null },
): boolean {
  if (user.appRole === 'superuser') return true;
  // Global defaults are only mutable by superusers.
  if (pb.organization_id === FALLBACK_ORG) return false;
  if (pb.uploaded_by && pb.uploaded_by === user.profileId) return true;
  if (
    user.appRole === 'company_admin' &&
    user.organizationId &&
    pb.organization_id === user.organizationId
  ) return true;
  return false;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user, service } = auth;

  const { data, error } = await loadPlaybook(service, params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Playbook not found' }, { status: 404 });
  if (!canRead(user, data)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json({ playbook: data });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user, service } = auth;

  const { data: existing, error: loadErr } = await loadPlaybook(service, params.id);
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Playbook not found' }, { status: 404 });
  if (!canWrite(user, existing)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if (typeof body.name === 'string') updates.name = body.name;
  if (typeof body.content === 'string') updates.content = body.content;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

  const { data, error } = await (service as any)
    .from('playbooks').update(updates).eq('id', params.id).select().single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to save' }, { status: 500 });
  return NextResponse.json({ playbook: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user, service } = auth;

  const { data: existing, error: loadErr } = await loadPlaybook(service, params.id);
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Playbook not found' }, { status: 404 });
  if (!canWrite(user, existing)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await (service as any).from('playbooks').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
