/**
 * Centralized API authentication / authorization helper.
 *
 * Use `requireUser()` at the top of every API route that mutates or returns
 * user-scoped data. It:
 *   1. Reads the Supabase auth cookie via `createServerSupabase()`.
 *   2. Loads the matching `users` profile row via service role.
 *   3. Optionally enforces required `app_role`s.
 *
 * Returns a `RequireUserResult` discriminated union; on failure, callers should
 * `return result.response` immediately (it's a pre-built NextResponse with the
 * correct status code).
 */

import { NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from './supabase-server';

export type AppRole = 'individual' | 'company_admin' | 'coach' | 'superuser';

export interface AuthedUser {
  /** Supabase auth.users.id */
  authUserId: string;
  /** users.id (profile UUID) */
  profileId: string;
  email: string;
  appRole: AppRole | null;
  status: string | null;
  organizationId: string | null;
  coachInstanceId: string | null;
  userType: string | null;
}

export type RequireUserResult =
  | { ok: true; user: AuthedUser; service: ReturnType<typeof createServiceSupabase> }
  | { ok: false; response: NextResponse };

export interface RequireUserOptions {
  /** If set, caller must have one of these app_roles. */
  roles?: AppRole[];
  /** If true, allow suspended/pending users through. Default false. */
  allowNonApproved?: boolean;
}

export async function requireUser(opts: RequireUserOptions = {}): Promise<RequireUserResult> {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser }, error: authErr } = await supabaseAuth.auth.getUser();
  if (authErr || !authUser) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const service = createServiceSupabase();
  const { data: profile, error: profErr } = await (service as any)
    .from('users')
    .select('id, email, app_role, status, organization_id, coach_instance_id, user_type')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (profErr || !profile) {
    return { ok: false, response: NextResponse.json({ error: 'Profile not found' }, { status: 403 }) };
  }

  if (!opts.allowNonApproved && profile.status && profile.status !== 'approved') {
    return { ok: false, response: NextResponse.json({ error: `Account ${profile.status}` }, { status: 403 }) };
  }

  if (opts.roles && opts.roles.length > 0) {
    if (!profile.app_role || !opts.roles.includes(profile.app_role as AppRole)) {
      return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }
  }

  return {
    ok: true,
    user: {
      authUserId: authUser.id,
      profileId: profile.id,
      email: profile.email ?? authUser.email ?? '',
      appRole: (profile.app_role ?? null) as AppRole | null,
      status: profile.status ?? null,
      organizationId: profile.organization_id ?? null,
      coachInstanceId: profile.coach_instance_id ?? null,
      userType: profile.user_type ?? null,
    },
    service,
  };
}

/**
 * Check whether `user` may access a resource owned by `ownerProfileId`.
 * Owners and superusers always pass; coaches and company_admins also pass when
 * `sharedOrgId` matches `user.organizationId`.
 */
export function canAccessOwned(
  user: AuthedUser,
  ownerProfileId: string | null | undefined,
  sharedOrgId: string | null | undefined = null,
): boolean {
  if (user.appRole === 'superuser') return true;
  if (ownerProfileId && ownerProfileId === user.profileId) return true;
  if (
    sharedOrgId &&
    user.organizationId &&
    sharedOrgId === user.organizationId &&
    (user.appRole === 'company_admin' || user.appRole === 'coach')
  ) {
    return true;
  }
  return false;
}

export function forbidden(message = 'Forbidden'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}
