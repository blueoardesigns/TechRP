import { NextRequest, NextResponse } from 'next/server';
import { requireUser, canAccessOwned } from '@/lib/api-auth';
import { checkCandidateCompletion } from '@/lib/candidate-completion';

// Depends on increment_sessions_used RPC — see web/supabase/session-limit-migration.sql

const FALLBACK_ORG = '00000000-0000-0000-0000-000000000001';

/**
 * GET /api/sessions — list sessions visible to the caller.
 *  - superuser: all sessions
 *  - company_admin / coach: sessions in their organization_id
 *  - individual: only their own sessions
 */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user, service } = auth;

  let query = (service as any).from('training_sessions').select('*').order('started_at', { ascending: false }).limit(200);

  if (user.appRole === 'superuser') {
    // no filter
  } else if ((user.appRole === 'company_admin' || user.appRole === 'coach') && user.organizationId) {
    query = query.eq('organization_id', user.organizationId);
  } else {
    query = query.eq('user_id', user.profileId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data ?? [] });
}

/**
 * POST /api/sessions — create a session for the authenticated user.
 * user_id and organization_id are forced to the caller's profile values;
 * any values supplied in the body are ignored.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user, service } = auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Strip caller-controlled identity fields and force them server-side.
  delete body.user_id;
  delete body.organization_id;

  const insertRow = {
    ...body,
    user_id: user.profileId,
    organization_id: user.organizationId ?? FALLBACK_ORG,
  };

  const { data, error } = await (service as any)
    .from('training_sessions')
    .insert(insertRow)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Increment sessions_used and auto-suspend if limit reached
  const { error: rpcError } = await (service as any).rpc('increment_sessions_used', {
    target_user_id: user.profileId,
  });
  if (rpcError) {
    console.error('Failed to increment sessions_used for user', user.profileId, rpcError);
  }

  const { data: userRow } = await (service as any)
    .from('users')
    .select('sessions_used, session_limit, user_type')
    .eq('id', user.profileId)
    .single();

  if (
    userRow &&
    userRow.session_limit !== null &&
    userRow.sessions_used >= userRow.session_limit
  ) {
    await (service as any).from('users').update({ status: 'suspended' }).eq('id', user.profileId);
  }

  // Candidate-specific completion check
  if (userRow?.user_type === 'candidate') {
    checkCandidateCompletion(user.profileId).catch(err =>
      console.error('Candidate completion check failed:', err)
    );
  }

  return NextResponse.json({ session: data }, { status: 201 });
}

/**
 * PATCH /api/sessions — update a session the caller owns or has org access to.
 * Body must include `id`. Identity fields (user_id, organization_id) cannot
 * be updated through this endpoint.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user, service } = auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id : null;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Disallow caller from rewriting ownership.
  delete body.id;
  delete body.user_id;
  delete body.organization_id;

  // Verify ownership / org access
  const { data: existing, error: fetchErr } = await (service as any)
    .from('training_sessions')
    .select('user_id, organization_id')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canAccessOwned(user, existing.user_id, existing.organization_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await (service as any)
    .from('training_sessions')
    .update(body)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data });
}
