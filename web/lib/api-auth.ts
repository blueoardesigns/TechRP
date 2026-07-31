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
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../shared/types/database';
import { createServerSupabase, createServiceSupabase } from './supabase-server';

export type AppRole = 'individual' | 'company_admin' | 'coach' | 'superuser';

/**
 * Service-role Supabase client typed against the project `Database`.
 *
 * The five core tables (users, organizations, personas, training_sessions,
 * playbooks) are fully modelled, so queries against them are type-checked.
 * Tables not yet in `Database` still require a local `(db as any)` cast — see
 * the coverage note in shared/types/database.ts.
 */
export type TypedDb = SupabaseClient<Database>;

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
  | { ok: true; user: AuthedUser; service: TypedDb }
  | { ok: false; response: NextResponse };

export interface RequireUserOptions {
  /** If set, caller must have one of these app_roles. */
  roles?: AppRole[];
  /** If true, allow suspended/pending users through. Default false. */
  allowNonApproved?: boolean;
  /**
   * Supabase access token from an `Authorization: Bearer` header, for routes
   * the mobile app calls. Mobile has no cookies for `createServerSupabase()`
   * to read, so those routes pass the token explicitly. When null/absent the
   * cookie session is used, so existing web-only callers are unaffected.
   */
  bearerToken?: string | null;
}

export async function requireUser(opts: RequireUserOptions = {}): Promise<RequireUserResult> {
  let authUser: { id: string; email?: string } | null = null;
  if (opts.bearerToken) {
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await anonClient.auth.getUser(opts.bearerToken);
    authUser = data.user;
  } else {
    const supabaseAuth = createServerSupabase();
    const { data } = await supabaseAuth.auth.getUser();
    authUser = data.user;
  }
  if (!authUser) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const service = createServiceSupabase() as TypedDb;
  const { data: profile, error: profErr } = await service
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
