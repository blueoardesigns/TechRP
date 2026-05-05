import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}));

const getUserMock = vi.fn();
const profileSelectMock = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabase: () => ({ auth: { getUser: getUserMock } }),
  createServiceSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: profileSelectMock,
        }),
      }),
    }),
  }),
}));

import { requireUser, canAccessOwned } from '../lib/api-auth';

describe('requireUser', () => {
  beforeEach(() => {
    getUserMock.mockReset();
    profileSelectMock.mockReset();
  });

  it('returns 401 when no auth user', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const result = await requireUser();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it('returns 403 when profile not found', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'auth-1', email: 'a@b.c' } }, error: null });
    profileSelectMock.mockResolvedValue({ data: null, error: null });
    const result = await requireUser();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it('returns 403 when status is not approved', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'auth-1', email: 'a@b.c' } }, error: null });
    profileSelectMock.mockResolvedValue({
      data: { id: 'p1', email: 'a@b.c', app_role: 'individual', status: 'suspended' },
      error: null,
    });
    const result = await requireUser();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it('allows non-approved when option set', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'auth-1', email: 'a@b.c' } }, error: null });
    profileSelectMock.mockResolvedValue({
      data: { id: 'p1', email: 'a@b.c', app_role: 'individual', status: 'pending' },
      error: null,
    });
    const result = await requireUser({ allowNonApproved: true });
    expect(result.ok).toBe(true);
  });

  it('rejects when role does not match', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'auth-1', email: 'a@b.c' } }, error: null });
    profileSelectMock.mockResolvedValue({
      data: { id: 'p1', email: 'a@b.c', app_role: 'individual', status: 'approved' },
      error: null,
    });
    const result = await requireUser({ roles: ['superuser'] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it('passes when role matches and status approved', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'auth-1', email: 'a@b.c' } }, error: null });
    profileSelectMock.mockResolvedValue({
      data: { id: 'p1', email: 'a@b.c', app_role: 'superuser', status: 'approved', organization_id: 'org-1' },
      error: null,
    });
    const result = await requireUser({ roles: ['superuser'] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.profileId).toBe('p1');
      expect(result.user.authUserId).toBe('auth-1');
      expect(result.user.appRole).toBe('superuser');
    }
  });
});

describe('canAccessOwned', () => {
  const base = {
    authUserId: 'a',
    profileId: 'p1',
    email: 'a@b.c',
    status: 'approved',
    organizationId: 'org-1',
    coachInstanceId: null,
    userType: null,
  };

  it('owner passes', () => {
    expect(canAccessOwned({ ...base, appRole: 'individual' }, 'p1')).toBe(true);
  });

  it('non-owner individual fails', () => {
    expect(canAccessOwned({ ...base, appRole: 'individual' }, 'p2')).toBe(false);
  });

  it('superuser passes regardless', () => {
    expect(canAccessOwned({ ...base, appRole: 'superuser' }, 'p2')).toBe(true);
  });

  it('company_admin passes for same-org resource', () => {
    expect(canAccessOwned({ ...base, appRole: 'company_admin' }, 'p2', 'org-1')).toBe(true);
  });

  it('company_admin fails for other-org resource', () => {
    expect(canAccessOwned({ ...base, appRole: 'company_admin' }, 'p2', 'org-2')).toBe(false);
  });

  it('coach passes for same-org resource', () => {
    expect(canAccessOwned({ ...base, appRole: 'coach' }, 'p2', 'org-1')).toBe(true);
  });
});
