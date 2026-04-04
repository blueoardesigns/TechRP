# Auth + Coach Role + Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `coach` role tier, fix remaining auth gaps (real user IDs, rejected state, role-based nav), enforce content isolation per coach instance, and ship infrastructure polish (skeletons, mobile layout, Sentry, analytics).

**Architecture:** Coach instances sit above company_admin orgs; users are linked via `coach_instance_id` and `organization_id` foreign keys. All content isolation is enforced at the query layer (API routes filter by coach context). Tim creates coaches via a secret-gated `/admin` page; coaches share invite URLs with token params.

**Tech Stack:** Next.js 14, Supabase (PostgreSQL + auth), Resend (email), Tailwind CSS, `@sentry/nextjs`, existing `createBrowserSupabase` / `createServiceSupabase` client patterns.

**No test framework is configured.** Each task has a manual **Verify:** step instead of automated tests. Run `cd web && npm run build` after each task group to catch TypeScript errors early.

---

## File Map

### New files
| File | Purpose |
|---|---|
| `web/supabase/coach-migration.sql` | All schema additions for coach tier |
| `web/app/admin/page.tsx` | Tim's coach management UI |
| `web/app/api/admin/coaches/route.ts` | Create / deactivate coaches |
| `web/app/coach/page.tsx` | Coach dashboard |
| `web/app/api/coach/instance/route.ts` | GET + PATCH coach instance settings |
| `web/app/api/coach/companies/route.ts` | GET + POST client companies |
| `web/app/api/coach/users/route.ts` | GET users in coach instance |
| `web/app/api/coach/users/[userId]/route.ts` | PATCH (deactivate) a user |
| `web/app/team/page.tsx` | Company admin team panel |
| `web/app/insights/page.tsx` | Analytics dashboard |
| `web/components/skeleton.tsx` | Reusable skeleton components |

### Modified files
| File | What changes |
|---|---|
| `web/components/auth-provider.tsx` | Add `coach` role, `coachInstanceId`, `organizationId` |
| `web/components/nav.tsx` | Role-based nav items |
| `web/middleware.ts` | Gate `/admin` on `ADMIN_SECRET`; allow `/coach`, `/team`, `/insights` |
| `web/app/pending/page.tsx` | Branch on `pending` vs `rejected` status; add resend button |
| `web/app/training/page.tsx` | Replace `PLACEHOLDER_USER_ID`; filter scenarios by `scenarioAccess` |
| `web/app/api/recordings/upload/route.ts` | Replace hardcoded IDs with session user |
| `web/app/api/insights/route.ts` | Replace hardcoded ID; extend metrics |
| `web/app/signup/page.tsx` | Read `?coach`, `?org`, `?type` params; lock role + modules |
| `web/app/api/auth/signup/route.ts` | Handle coach/org invite logic + auto-approve |
| `web/app/api/auth/approve/route.ts` | Support coach as approver (not just Tim) |
| `web/app/playbooks/page.tsx` | Content isolation + skeleton + mobile |
| `web/app/personas/page.tsx` | Content isolation |
| `web/app/api/playbook/route.ts` | Filter by coach instance |
| `web/app/api/assess/route.ts` | Scope playbook lookup to coach instance |
| `web/app/sessions/page.tsx` | Skeleton + mobile responsive |
| `web/app/playbooks/create/page.tsx` | AI persona generation after save |
| `web/package.json` | Add `@sentry/nextjs` |
| `web/.env.local` | Add `ADMIN_SECRET`, `NEXT_PUBLIC_APP_URL` (if missing) |

---

## Task 1: Database Migration

**Files:**
- Create: `web/supabase/coach-migration.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================================
-- Coach Migration — TechRP
-- Run in Supabase SQL editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- 1. Extend app_role to include 'coach'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_app_role_check;
ALTER TABLE users ADD CONSTRAINT users_app_role_check
  CHECK (app_role IN ('individual', 'company_admin', 'coach'));

-- 2. Add coach_instance_id and organization_id to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS coach_instance_id UUID,
  ADD COLUMN IF NOT EXISTS organization_id   UUID;

-- 3. Create coach_instances table
CREATE TABLE IF NOT EXISTS coach_instances (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL,
  invite_token             TEXT NOT NULL UNIQUE,
  global_playbooks_enabled BOOLEAN NOT NULL DEFAULT false,
  global_personas_enabled  BOOLEAN NOT NULL DEFAULT false,
  auto_approve_users       BOOLEAN NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Add FK from users.coach_instance_id → coach_instances
ALTER TABLE users
  ADD CONSTRAINT users_coach_instance_id_fkey
  FOREIGN KEY (coach_instance_id) REFERENCES coach_instances(id)
  ON DELETE SET NULL;

-- 5. Extend organizations with coach link + invite token
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS coach_instance_id UUID REFERENCES coach_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invite_token      TEXT UNIQUE;

-- 6. Add coach_instance_id to playbooks and personas
ALTER TABLE playbooks
  ADD COLUMN IF NOT EXISTS coach_instance_id UUID REFERENCES coach_instances(id) ON DELETE CASCADE;

ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS coach_instance_id UUID REFERENCES coach_instances(id) ON DELETE CASCADE;

-- 7. Index for fast token lookups
CREATE INDEX IF NOT EXISTS coach_instances_invite_token_idx ON coach_instances(invite_token);
CREATE INDEX IF NOT EXISTS organizations_invite_token_idx   ON organizations(invite_token);
CREATE INDEX IF NOT EXISTS users_coach_instance_id_idx      ON users(coach_instance_id);
```

- [ ] **Step 2: Run in Supabase**

Open Supabase dashboard → SQL Editor → New query. Paste the full file content and click Run. Confirm each statement succeeds (no red errors).

- [ ] **Step 3: Verify columns exist**

In Supabase → Table Editor → `users`, confirm columns `coach_instance_id` and `organization_id` appear. Check `coach_instances` table exists. Check `organizations` has `invite_token`.

- [ ] **Step 4: Commit**

```bash
cd /Users/TinierTim/TBDev/techrp
git add web/supabase/coach-migration.sql
git commit -m "feat: add coach migration SQL (coach_instances, org invite tokens, content isolation columns)"
```

---

## Task 2: AppUser Type + AuthProvider

**Files:**
- Modify: `web/components/auth-provider.tsx`

- [ ] **Step 1: Update types and AppUser interface**

Replace the top of `auth-provider.tsx` (lines 1–18):

```tsx
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase-browser';

export type UserRole = 'individual' | 'company_admin' | 'coach';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface AppUser {
  id: string;
  authUserId: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  scenarioAccess: string[];
  coachInstanceId: string | null;
  organizationId: string | null;
}
```

- [ ] **Step 2: Update the profile select query and mapping**

In `loadUser`, replace the Supabase select and `appUser` construction:

```tsx
const { data: profile } = await supabase
  .from('users')
  .select('id, auth_user_id, email, name, full_name, app_role, status, scenario_access, coach_instance_id, organization_id')
  .eq('auth_user_id', authUser.id)
  .single();

if (!profile) {
  setUser(null);
  setLoading(false);
  return;
}

const appUser: AppUser = {
  id: profile.id,
  authUserId: authUser.id,
  email: (profile as any).email ?? authUser.email ?? '',
  fullName: (profile as any).full_name ?? (profile as any).name ?? '',
  role: ((profile as any).app_role ?? 'individual') as UserRole,
  status: ((profile as any).status ?? 'pending') as UserStatus,
  scenarioAccess: (profile as any).scenario_access ?? [],
  coachInstanceId: (profile as any).coach_instance_id ?? null,
  organizationId: (profile as any).organization_id ?? null,
};
```

- [ ] **Step 3: Add rejected-user redirect**

In `loadUser`, after the pending redirect, add:

```tsx
// Redirect pending users away from protected pages
if (appUser.status === 'pending' && !PUBLIC_PATHS.includes(pathname)) {
  router.replace('/pending');
}
// Redirect rejected users to /pending (shows different UI there)
if (appUser.status === 'rejected' && !PUBLIC_PATHS.includes(pathname)) {
  router.replace('/pending');
}
```

- [ ] **Step 4: Verify**

Run `cd web && npm run build`. Confirm no TypeScript errors on `AppUser` or `UserRole`.

- [ ] **Step 5: Commit**

```bash
git add web/components/auth-provider.tsx
git commit -m "feat: add coach role, coachInstanceId, organizationId to AppUser"
```

---

## Task 3: Middleware Update

**Files:**
- Modify: `web/middleware.ts`

The `/admin` route needs to bypass Supabase auth and use `ADMIN_SECRET` instead. All other protected routes stay as-is.

- [ ] **Step 1: Update middleware.ts**

Replace the full file:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/pending'];
const PUBLIC_PREFIXES = ['/api/auth/', '/_next/', '/favicon'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /admin is gated by ADMIN_SECRET, not Supabase auth
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin/')) {
    const key = request.nextUrl.searchParams.get('key')
      ?? request.cookies.get('admin_key')?.value;
    if (key === process.env.ADMIN_SECRET) {
      const res = NextResponse.next({ request });
      // Set cookie so subsequent /admin navigations don't need the param
      res.cookies.set('admin_key', key, { httpOnly: true, sameSite: 'lax', path: '/' });
      return res;
    }
    // No valid key — redirect to /admin/login (or just 401 for API routes)
    if (pathname.startsWith('/api/admin/')) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/admin/login';
    return NextResponse.redirect(loginUrl);
  }

  // Always allow public routes and static assets
  if (
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- [ ] **Step 2: Add `ADMIN_SECRET` to `.env.local`**

Open `web/.env.local` and add:
```
ADMIN_SECRET=choose-a-strong-secret-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 3: Create the admin login page**

Create `web/app/admin/login/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [key, setKey] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/admin?key=${encodeURIComponent(key)}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold">Admin Access</h1>
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="Enter admin key"
          className="w-full bg-gray-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run `cd web && npm run build`. Navigate to `/admin` in the browser — should redirect to `/admin/login`. Enter the key and confirm it redirects to `/admin`.

- [ ] **Step 5: Commit**

```bash
git add web/middleware.ts web/app/admin/login/page.tsx web/.env.local
git commit -m "feat: gate /admin on ADMIN_SECRET, keep Supabase auth for all other protected routes"
```

---

## Task 4: Pending Page — Rejected State + Resend Button

**Files:**
- Modify: `web/app/pending/page.tsx`

- [ ] **Step 1: Replace pending/page.tsx**

```tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';

export default function PendingPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await fetch('/api/auth/resend-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email }),
      });
      setResent(true);
    } finally {
      setResending(false);
    }
  };

  const isRejected = user?.status === 'rejected';

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-5">

        <div className={`w-16 h-16 ${isRejected ? 'bg-red-500/15 border-red-500/20' : 'bg-yellow-500/15 border-yellow-500/20'} border rounded-full flex items-center justify-center mx-auto`}>
          <span className="text-3xl">{isRejected ? '✋' : '⏳'}</span>
        </div>

        {isRejected ? (
          <>
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Application Not Approved</h1>
              <p className="text-gray-400 text-sm leading-relaxed">
                Your account request was not approved at this time. If you believe this is an error, please reach out directly.
              </p>
            </div>
            <a
              href="mailto:tim@blueoardesigns.com"
              className="inline-block text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Contact tim@blueoardesigns.com →
            </a>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Pending Approval</h1>
              <p className="text-gray-400 text-sm leading-relaxed">
                Your account is being reviewed. You&apos;ll receive an email at{' '}
                <span className="text-white font-medium">{user?.email ?? 'your email'}</span>{' '}
                once you&apos;re approved — usually within 24 hours.
              </p>
            </div>

            <div className="bg-gray-900 border border-white/10 rounded-xl px-5 py-4 text-left space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">What happens next</p>
              <ul className="text-sm text-gray-400 space-y-1.5">
                <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">→</span> Your request has been sent for review</li>
                <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">→</span> You&apos;ll get an email when approved</li>
                <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">→</span> Sign back in to start training</li>
              </ul>
            </div>

            {resent ? (
              <p className="text-sm text-green-400">Approval request resent.</p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
              >
                {resending ? 'Resending…' : 'Resend approval request'}
              </button>
            )}
          </>
        )}

        <button
          onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors block mx-auto"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Sign up a new account and leave it pending. Visit `/pending` — should show the hourglass state with resend button. To test rejected: manually set `status = 'rejected'` in Supabase for that user and reload — should show the red ✋ state with contact link.

- [ ] **Step 3: Commit**

```bash
git add web/app/pending/page.tsx
git commit -m "feat: pending page — distinct rejected state and resend approval button"
```

---

## Task 5: Wire Real user_id Everywhere

**Files:**
- Modify: `web/app/training/page.tsx`
- Modify: `web/app/api/recordings/upload/route.ts`
- Modify: `web/app/api/insights/route.ts`

- [ ] **Step 1: Update training/page.tsx**

At the top of the component, import `useAuth` and remove the placeholder constants. Find:

```tsx
const PLACEHOLDER_USER_ID = '00000000-0000-0000-0000-000000000001';
const PLACEHOLDER_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';
```

Delete those two lines. Add `useAuth` import at the top of the file:

```tsx
import { useAuth } from '@/components/auth-provider';
```

Inside the `default function TrainingPage()` component body, add at the top:

```tsx
const { user } = useAuth();
```

Then find all usages of `PLACEHOLDER_USER_ID` and replace with `user?.id ?? ''`, and all usages of `PLACEHOLDER_ORGANIZATION_ID` and replace with `user?.organizationId ?? ''`.

- [ ] **Step 2: Update recordings/upload/route.ts**

Replace the hardcoded constants at the top of the file:

```ts
// Remove these:
// const ORG_ID  = '00000000-0000-0000-0000-000000000001';
// const USER_ID = '00000000-0000-0000-0000-000000000001';
```

Add session lookup using the server Supabase client. At the top of the `POST` handler, before any other logic, add:

```ts
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

// Inside POST handler, at the top:
const supabaseAuth = createServerSupabase();
const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
if (!authUser) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const supabase = createServiceSupabase();
const { data: profile } = await supabase
  .from('users')
  .select('id, organization_id')
  .eq('auth_user_id', authUser.id)
  .single();

const USER_ID = (profile as any)?.id ?? '';
const ORG_ID  = (profile as any)?.organization_id ?? '';
```

- [ ] **Step 3: Update insights/route.ts**

Find the hardcoded user_id default:

```ts
const userId = searchParams.get('user_id') || '00000000-0000-0000-0000-000000000001';
```

Replace with server-side auth lookup:

```ts
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

// Inside GET handler, replace the userId line with:
const supabaseAuth = createServerSupabase();
const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
if (!authUser) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
const supabase = createServiceSupabase();
const { data: profile } = await supabase
  .from('users')
  .select('id')
  .eq('auth_user_id', authUser.id)
  .single();
const userId = (profile as any)?.id ?? '';
```

- [ ] **Step 4: Verify**

Start dev server (`cd web && npm run dev`). Sign in as an approved user, start a training session, complete it — confirm the session appears in `/sessions` with the real user's data, not the placeholder UUID.

- [ ] **Step 5: Commit**

```bash
git add web/app/training/page.tsx web/app/api/recordings/upload/route.ts web/app/api/insights/route.ts
git commit -m "fix: replace PLACEHOLDER_USER_ID with real session user in training, recordings, insights"
```

---

## Task 6: Tim's Admin Interface

**Files:**
- Create: `web/app/admin/page.tsx`
- Create: `web/app/api/admin/coaches/route.ts`

- [ ] **Step 1: Create the admin API route**

Create `web/app/api/admin/coaches/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/admin/coaches — list all coaches
export async function GET() {
  const supabase = adminSupabase();
  const { data, error } = await supabase
    .from('users')
    .select(`
      id, full_name, email, status, created_at,
      coach_instances ( id, name, invite_token )
    `)
    .eq('app_role', 'coach')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ coaches: data });
}

// POST /api/admin/coaches — create a coach
export async function POST(req: NextRequest) {
  const { fullName, email, instanceName } = await req.json();
  if (!fullName || !email || !instanceName) {
    return NextResponse.json({ error: 'fullName, email, instanceName required' }, { status: 400 });
  }

  const supabase = adminSupabase();

  // 1. Create Supabase auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? 'Auth create failed' }, { status: 400 });
  }

  // 2. Send magic link so coach sets their own password
  await supabase.auth.admin.generateLink({ type: 'magiclink', email });

  // 3. Insert user row
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .insert({
      auth_user_id: authData.user.id,
      full_name: fullName,
      name: fullName,
      email,
      app_role: 'coach',
      role: 'manager',
      status: 'approved',
      scenario_access: ['homeowner_inbound','homeowner_facetime','plumber_lead',
        'property_manager','commercial_property_manager','insurance_broker','plumber_bd'],
    } as any)
    .select('id')
    .single();

  if (userError || !userRow) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 });
  }

  // 4. Create coach instance
  const inviteToken = randomBytes(6).toString('hex');
  const { data: instance, error: instanceError } = await supabase
    .from('coach_instances')
    .insert({
      coach_user_id: (userRow as any).id,
      name: instanceName,
      invite_token: inviteToken,
    } as any)
    .select('id, invite_token')
    .single();

  if (instanceError) {
    return NextResponse.json({ error: 'Failed to create coach instance' }, { status: 500 });
  }

  // 5. Link user to their instance
  await supabase.from('users').update({ coach_instance_id: (instance as any).id } as any)
    .eq('id', (userRow as any).id);

  // 6. Send welcome email with magic link
  try {
    const { data: linkData } = await supabase.auth.admin.generateLink({ type: 'magiclink', email });
    await resend.emails.send({
      from: 'TechRP <noreply@blueoardesigns.com>',
      to: email,
      subject: "You've been added as a TechRP Coach",
      html: `
        <h2>Welcome to TechRP, ${fullName}!</h2>
        <p>Your coach account has been created for <strong>${instanceName}</strong>.</p>
        <p>Click below to set up your password and access your dashboard:</p>
        <br/>
        <a href="${(linkData as any)?.properties?.action_link ?? APP_URL + '/login'}"
           style="background:#2563eb;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
          Set Up My Account →
        </a>
        <br/><br/>
        <p>Your invite link for clients: <code>${APP_URL}/signup?coach=${inviteToken}</code></p>
      `,
    });
  } catch (e) {
    console.error('Welcome email failed:', e);
  }

  return NextResponse.json({
    success: true,
    inviteUrl: `${APP_URL}/signup?coach=${inviteToken}`,
    coachId: (userRow as any).id,
  });
}

// PATCH /api/admin/coaches — deactivate a coach
export async function PATCH(req: NextRequest) {
  const { coachId } = await req.json();
  const supabase = adminSupabase();
  await supabase.from('users').update({ status: 'rejected' } as any).eq('id', coachId);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Create admin/page.tsx**

Create `web/app/admin/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';

interface CoachRow {
  id: string;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
  coach_instances: { id: string; name: string; invite_token: string }[];
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default function AdminPage() {
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', instanceName: '' });
  const [creating, setCreating] = useState(false);
  const [newInviteUrl, setNewInviteUrl] = useState('');

  const fetchCoaches = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/coaches');
    const data = await res.json();
    setCoaches(data.coaches ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchCoaches(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const res = await fetch('/api/admin/coaches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setCreating(false);
    if (data.inviteUrl) {
      setNewInviteUrl(data.inviteUrl);
      setForm({ fullName: '', email: '', instanceName: '' });
      fetchCoaches();
    } else {
      alert(data.error ?? 'Failed to create coach');
    }
  };

  const handleDeactivate = async (coachId: string) => {
    if (!confirm('Deactivate this coach?')) return;
    await fetch('/api/admin/coaches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId }),
    });
    fetchCoaches();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Coach Management</h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Create Coach
          </button>
        </div>

        {newInviteUrl && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-sm">
            <p className="text-green-400 font-medium mb-1">Coach created! Invite URL:</p>
            <code className="text-green-300 break-all">{newInviteUrl}</code>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 py-10 text-center">Loading…</p>
        ) : (
          <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-500 text-xs uppercase tracking-widest">
                  <th className="text-left px-5 py-3">Name</th>
                  <th className="text-left px-5 py-3">Email</th>
                  <th className="text-left px-5 py-3">Instance</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Invite URL</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {coaches.map(c => {
                  const inst = c.coach_instances?.[0];
                  return (
                    <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-5 py-3 font-medium">{c.full_name}</td>
                      <td className="px-5 py-3 text-gray-400">{c.email}</td>
                      <td className="px-5 py-3 text-gray-400">{inst?.name ?? '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'approved' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {inst ? (
                          <button
                            onClick={() => navigator.clipboard.writeText(`${APP_URL}/signup?coach=${inst.invite_token}`)}
                            className="hover:text-white transition-colors"
                          >
                            Copy link
                          </button>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {c.status === 'approved' && (
                          <button onClick={() => handleDeactivate(c.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {coaches.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">No coaches yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
              <h2 className="text-lg font-bold">Create Coach</h2>
              <form onSubmit={handleCreate} className="space-y-3">
                {(['fullName', 'email', 'instanceName'] as const).map(field => (
                  <input
                    key={field}
                    type={field === 'email' ? 'email' : 'text'}
                    placeholder={field === 'fullName' ? 'Full name' : field === 'email' ? 'Email address' : 'Practice / company name'}
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    required
                    className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                ))}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-white/10 text-gray-400 hover:text-white rounded-lg py-2.5 text-sm transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={creating} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50">
                    {creating ? 'Creating…' : 'Create Coach'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Navigate to `/admin?key=<your-ADMIN_SECRET>`. Should see the coach table. Click "Create Coach", fill in the form, confirm the invite URL appears and a magic-link email was sent to the coach.

- [ ] **Step 4: Commit**

```bash
git add web/app/admin/page.tsx web/app/admin/login/page.tsx web/app/api/admin/coaches/route.ts
git commit -m "feat: Tim's admin interface — create and deactivate coaches"
```

---

## Task 7: Coach Dashboard + APIs

**Files:**
- Create: `web/app/coach/page.tsx`
- Create: `web/app/api/coach/instance/route.ts`
- Create: `web/app/api/coach/companies/route.ts`
- Create: `web/app/api/coach/users/route.ts`
- Create: `web/app/api/coach/users/[userId]/route.ts`

- [ ] **Step 1: Create coach instance API**

Create `web/app/api/coach/instance/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

async function getCoachProfile() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return null;
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from('users')
    .select('id, app_role, coach_instance_id')
    .eq('auth_user_id', authUser.id)
    .single();
  if (!data || (data as any).app_role !== 'coach') return null;
  return data as any;
}

export async function GET() {
  const profile = await getCoachProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from('coach_instances')
    .select('*')
    .eq('id', profile.coach_instance_id)
    .single();

  return NextResponse.json({ instance: data });
}

export async function PATCH(req: NextRequest) {
  const profile = await getCoachProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const allowed = ['auto_approve_users', 'global_playbooks_enabled', 'global_personas_enabled'];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  const supabase = createServiceSupabase();
  await supabase.from('coach_instances').update(updates as any).eq('id', profile.coach_instance_id);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Create coach companies API**

Create `web/app/api/coach/companies/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';
import { randomBytes } from 'crypto';

async function getCoachInstance() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return null;
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from('users')
    .select('id, app_role, coach_instance_id')
    .eq('auth_user_id', authUser.id)
    .single();
  if (!data || (data as any).app_role !== 'coach') return null;
  return data as any;
}

export async function GET() {
  const profile = await getCoachInstance();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, invite_token, created_at')
    .eq('coach_instance_id', profile.coach_instance_id)
    .order('created_at', { ascending: false });

  // Get user counts per org
  const orgIds = (orgs ?? []).map((o: any) => o.id);
  const { data: users } = orgIds.length
    ? await supabase.from('users').select('id, organization_id').in('organization_id', orgIds)
    : { data: [] };

  const countMap: Record<string, number> = {};
  (users ?? []).forEach((u: any) => {
    countMap[u.organization_id] = (countMap[u.organization_id] ?? 0) + 1;
  });

  const result = (orgs ?? []).map((o: any) => ({ ...o, userCount: countMap[o.id] ?? 0 }));
  return NextResponse.json({ companies: result });
}

export async function POST(req: NextRequest) {
  const profile = await getCoachInstance();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const inviteToken = randomBytes(6).toString('hex');
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from('organizations')
    .insert({ name, coach_instance_id: profile.coach_instance_id, invite_token: inviteToken } as any)
    .select('id, name, invite_token')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ company: data });
}
```

- [ ] **Step 3: Create coach users API**

Create `web/app/api/coach/users/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function GET() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: coach } = await supabase
    .from('users')
    .select('coach_instance_id, app_role')
    .eq('auth_user_id', authUser.id)
    .single();

  if (!coach || (coach as any).app_role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email, app_role, status, created_at, organization_id')
    .eq('coach_instance_id', (coach as any).coach_instance_id)
    .order('created_at', { ascending: false });

  // Get session counts
  const userIds = (users ?? []).map((u: any) => u.id);
  const { data: sessions } = userIds.length
    ? await supabase.from('training_sessions').select('user_id').in('user_id', userIds)
    : { data: [] };

  const sessionMap: Record<string, number> = {};
  (sessions ?? []).forEach((s: any) => {
    sessionMap[s.user_id] = (sessionMap[s.user_id] ?? 0) + 1;
  });

  const result = (users ?? []).map((u: any) => ({ ...u, sessionCount: sessionMap[u.id] ?? 0 }));
  return NextResponse.json({ users: result });
}
```

Create `web/app/api/coach/users/[userId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function PATCH(req: NextRequest, { params }: { params: { userId: string } }) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: coach } = await supabase
    .from('users').select('coach_instance_id, app_role').eq('auth_user_id', authUser.id).single();

  if (!coach || (coach as any).app_role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Confirm the target user belongs to this coach's instance
  const { data: target } = await supabase
    .from('users').select('id, coach_instance_id').eq('id', params.userId).single();

  if (!target || (target as any).coach_instance_id !== (coach as any).coach_instance_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { status } = await req.json();
  await supabase.from('users').update({ status } as any).eq('id', params.userId);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Create coach/page.tsx**

Create `web/app/coach/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { AppNav } from '@/components/nav';
import { useRouter } from 'next/navigation';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

interface CoachInstance {
  id: string; name: string; invite_token: string;
  auto_approve_users: boolean;
  global_playbooks_enabled: boolean;
  global_personas_enabled: boolean;
}
interface Company { id: string; name: string; invite_token: string; userCount: number; }
interface CoachUser { id: string; full_name: string; email: string; app_role: string; status: string; sessionCount: number; }

export default function CoachPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [instance, setInstance] = useState<CoachInstance | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<CoachUser[]>([]);
  const [tab, setTab] = useState<'companies' | 'users' | 'content'>('companies');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [addingCompany, setAddingCompany] = useState(false);
  const [copiedToken, setCopiedToken] = useState('');

  useEffect(() => {
    if (user && user.role !== 'coach') router.replace('/');
  }, [user, router]);

  useEffect(() => {
    fetch('/api/coach/instance').then(r => r.json()).then(d => setInstance(d.instance));
    fetch('/api/coach/companies').then(r => r.json()).then(d => setCompanies(d.companies ?? []));
    fetch('/api/coach/users').then(r => r.json()).then(d => setUsers(d.users ?? []));
  }, []);

  const copyLink = (token: string, type: 'coach' | 'org') => {
    const url = type === 'coach'
      ? `${APP_URL}/signup?coach=${token}`
      : `${APP_URL}/signup?org=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(''), 2000);
  };

  const toggleSetting = async (key: string, value: boolean) => {
    await fetch('/api/coach/instance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
    setInstance(i => i ? { ...i, [key]: value } as CoachInstance : i);
  };

  const addCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    setAddingCompany(true);
    const res = await fetch('/api/coach/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCompanyName }),
    });
    const data = await res.json();
    if (data.company) setCompanies(c => [data.company, ...c]);
    setNewCompanyName('');
    setAddingCompany(false);
  };

  const deactivateUser = async (userId: string) => {
    if (!confirm('Deactivate this user?')) return;
    await fetch(`/api/coach/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    });
    setUsers(u => u.map(x => x.id === userId ? { ...x, status: 'rejected' } : x));
  };

  if (!instance) return null;

  const TABS = [
    { key: 'companies', label: 'Client Companies' },
    { key: 'users',     label: 'All Users' },
    { key: 'content',   label: 'Content' },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AppNav />
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 space-y-8">

        {/* Header + invite link */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{instance.name}</h1>
            <p className="text-gray-500 text-sm mt-0.5">Coach Dashboard</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs text-gray-400 bg-gray-900 border border-white/10 rounded-lg px-3 py-2 max-w-xs truncate">
              {APP_URL}/signup?coach={instance.invite_token}
            </code>
            <button
              onClick={() => copyLink(instance.invite_token, 'coach')}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              {copiedToken === instance.invite_token ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/10 pb-0">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm rounded-t-md transition-colors ${tab === t.key ? 'text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Companies tab */}
        {tab === 'companies' && (
          <div className="space-y-4">
            <form onSubmit={addCompany} className="flex gap-2">
              <input
                value={newCompanyName}
                onChange={e => setNewCompanyName(e.target.value)}
                placeholder="Client company name…"
                className="flex-1 bg-gray-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={addingCompany}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {addingCompany ? 'Adding…' : 'Add Company'}
              </button>
            </form>
            <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-gray-500 text-xs uppercase tracking-widest">
                    <th className="text-left px-5 py-3">Company</th>
                    <th className="text-left px-5 py-3">Users</th>
                    <th className="text-left px-5 py-3">Admin Invite URL</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map(c => (
                    <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-5 py-3 font-medium">{c.name}</td>
                      <td className="px-5 py-3 text-gray-400">{c.userCount}</td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => copyLink(c.invite_token, 'org')}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {copiedToken === c.invite_token ? 'Copied!' : 'Copy invite link'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {companies.length === 0 && (
                    <tr><td colSpan={3} className="px-5 py-10 text-center text-gray-500">No client companies yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Users tab */}
        {tab === 'users' && (
          <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-500 text-xs uppercase tracking-widest">
                  <th className="text-left px-5 py-3">Name</th>
                  <th className="text-left px-5 py-3">Role</th>
                  <th className="text-left px-5 py-3">Sessions</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-5 py-3">
                      <p className="font-medium">{u.full_name}</p>
                      <p className="text-gray-500 text-xs">{u.email}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-400 capitalize">{u.app_role.replace('_', ' ')}</td>
                    <td className="px-5 py-3 text-gray-400">{u.sessionCount}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.status === 'approved' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {u.status === 'approved' && (
                        <button onClick={() => deactivateUser(u.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-500">No users yet. Share your invite link to get started.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Content tab */}
        {tab === 'content' && (
          <div className="space-y-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-sm text-gray-300">Global TechRP Content</h3>
              {([
                ['global_playbooks_enabled', 'Include TechRP default playbooks'],
                ['global_personas_enabled',  'Include TechRP default personas'],
                ['auto_approve_users',        'Auto-approve new signups'],
              ] as const).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">{label}</span>
                  <button
                    onClick={() => toggleSetting(key, !instance[key])}
                    className={`w-10 h-6 rounded-full transition-colors ${instance[key] ? 'bg-blue-600' : 'bg-gray-700'}`}
                  >
                    <span className={`block w-4 h-4 bg-white rounded-full mx-1 transition-transform ${instance[key] ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
            </div>
            <a
              href="/playbooks"
              className="block text-center bg-gray-900 border border-white/10 hover:border-white/20 rounded-2xl py-4 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Manage Playbooks →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify**

Log in as a coach user. Navigate to `/coach`. Confirm all three tabs render. Add a client company, confirm it appears with an invite link. Toggle a content setting and refresh — confirm it persists.

- [ ] **Step 6: Commit**

```bash
git add web/app/coach/page.tsx web/app/api/coach/
git commit -m "feat: coach dashboard — client companies, users panel, content toggles"
```

---

## Task 7b: Coach Playbook Save → AI Persona Generation

**Files:**
- Modify: `web/app/playbooks/create/page.tsx`
- Create: `web/app/api/coach/generate-personas/route.ts`

When a coach saves a playbook, the system calls Claude to suggest which `ScenarioType(s)` it maps to, then seeds relevant personas tagged to the coach's instance.

- [ ] **Step 1: Create the generate-personas API**

Create `web/app/api/coach/generate-personas/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';
import { SCENARIOS } from '@/lib/personas';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: coach } = await supabase
    .from('users').select('coach_instance_id, app_role').eq('auth_user_id', authUser.id).single();

  if (!coach || (coach as any).app_role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { playbookName, playbookContent } = await req.json();
  const validTypes = SCENARIOS.map(s => s.type);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `Given this sales training playbook, which scenario types does it apply to?

Playbook name: ${playbookName}
Content summary: ${playbookContent.slice(0, 800)}

Valid scenario types: ${validTypes.join(', ')}

Reply with a JSON array of matching scenario type strings only. Example: ["homeowner_inbound","property_manager"]`,
    }],
  });

  let suggestedTypes: string[] = [];
  try {
    const text = (message.content[0] as any).text ?? '';
    const match = text.match(/\[.*\]/s);
    if (match) suggestedTypes = JSON.parse(match[0]).filter((t: string) => validTypes.includes(t));
  } catch {
    suggestedTypes = [];
  }

  return NextResponse.json({ suggestedTypes });
}
```

- [ ] **Step 2: Trigger AI suggestion after playbook save in create page**

In `web/app/playbooks/create/page.tsx`, after the successful playbook save (the existing `router.push` or success state), add:

```tsx
// After playbook is saved — check if this is a coach
const { user } = useAuth(); // add this at top of component

// After successful save:
if (user?.role === 'coach' && savedPlaybookName && savedPlaybookContent) {
  const res = await fetch('/api/coach/generate-personas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playbookName: savedPlaybookName, playbookContent: savedPlaybookContent }),
  });
  const data = await res.json();
  if (data.suggestedTypes?.length) {
    // Show confirmation dialog before seeding
    setSuggestedScenarios(data.suggestedTypes); // new state
    setShowPersonaConfirm(true); // new state
    return; // don't navigate yet
  }
}
router.push('/playbooks'); // navigate if no suggestions or not a coach
```

Add a confirmation modal in the JSX:

```tsx
{showPersonaConfirm && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
    <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
      <h2 className="text-lg font-bold">Seed Personas?</h2>
      <p className="text-sm text-gray-400">
        This playbook maps to: <strong className="text-white">{suggestedScenarios.join(', ')}</strong>.
        Would you like to seed AI personas for these scenarios in your instance?
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => { setShowPersonaConfirm(false); router.push('/playbooks'); }}
          className="flex-1 border border-white/10 text-gray-400 hover:text-white rounded-lg py-2.5 text-sm transition-colors"
        >
          Skip
        </button>
        <button
          onClick={async () => {
            await fetch('/api/seed', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ scenarioTypes: suggestedScenarios, coachInstanceId: user?.coachInstanceId }),
            });
            setShowPersonaConfirm(false);
            router.push('/playbooks');
          }}
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
        >
          Seed Personas
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Update /api/seed to accept coach_instance_id**

In `web/app/api/seed/route.ts`, check for `coachInstanceId` in the request body. When seeding personas, if `coachInstanceId` is present, tag the inserted rows:

```ts
const { coachInstanceId } = await req.json(); // add to existing destructure

// When inserting personas, add:
const personasToInsert = generatedPersonas.map(p => ({
  ...p,
  coach_instance_id: coachInstanceId ?? null,
}));
```

- [ ] **Step 4: Verify**

Log in as a coach. Go to `/playbooks/create`, complete the wizard and save. Confirm the AI persona generation modal appears with suggested scenario types. Click "Seed Personas" and verify personas appear in `/personas` tagged to the coach instance.

- [ ] **Step 5: Commit**

```bash
git add web/app/playbooks/create/page.tsx web/app/api/coach/generate-personas/route.ts web/app/api/seed/route.ts
git commit -m "feat: coach playbook save triggers AI persona generation and seeds coach-instance personas"
```

---

## Task 8: Signup Flow — Coach / Org Invite Params

**Files:**
- Modify: `web/app/signup/page.tsx`
- Modify: `web/app/api/auth/signup/route.ts`
- Modify: `web/app/api/auth/approve/route.ts`

- [ ] **Step 1: Read invite params in signup/page.tsx**

At the top of the `SignupPage` component, add:

```tsx
import { useSearchParams } from 'next/navigation';

// Inside the component:
const searchParams = useSearchParams();
const coachToken  = searchParams.get('coach');
const orgToken    = searchParams.get('org');
const typeParam   = searchParams.get('type'); // 'individual' | null

const [coachInfo, setCoachInfo]   = useState<{ name: string } | null>(null);
const [orgInfo, setOrgInfo]       = useState<{ name: string; coachToken?: string } | null>(null);

// Resolve invite context on mount
useEffect(() => {
  if (coachToken) {
    fetch(`/api/auth/invite-info?coach=${coachToken}`)
      .then(r => r.json())
      .then(d => { if (d.name) setCoachInfo(d); });
  }
  if (orgToken) {
    fetch(`/api/auth/invite-info?org=${orgToken}`)
      .then(r => r.json())
      .then(d => { if (d.name) setOrgInfo(d); });
  }
}, [coachToken, orgToken]);
```

- [ ] **Step 2: Lock role and skip module selection for invite signups**

In the signup page, when `coachToken` (without `typeParam=individual`) or `orgToken` is present:
- Force role selection: `orgToken` → `'individual'`; `coachToken` without `type=individual` → `'company_admin'`; `coachToken` with `type=individual` → `'individual'`
- Show a banner at the top: `"You're joining {coachInfo?.name ?? orgInfo?.name}'s training program"`
- Hide the role picker
- For `orgToken` signups: skip the module selection step entirely (modules inherited server-side)

Add above the role picker JSX:

```tsx
// Determine locked role from invite context
const lockedRole: 'individual' | 'company_admin' | null =
  orgToken ? 'individual' :
  coachToken && typeParam !== 'individual' ? 'company_admin' :
  coachToken && typeParam === 'individual' ? 'individual' :
  null;

// Use lockedRole in initial state and hide the role picker when set
```

Add invite banner (show if `coachInfo` or `orgInfo`):

```tsx
{(coachInfo || orgInfo) && (
  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-sm text-blue-300 mb-4">
    You&apos;re joining <strong>{coachInfo?.name ?? orgInfo?.name}</strong>&apos;s training program.
  </div>
)}
```

- [ ] **Step 3: Pass invite tokens to the signup API**

In the form submit handler, include the tokens in the POST body:

```tsx
body: JSON.stringify({
  fullName, email, password, role, companyName,
  scenarioAccess: lockedRole === 'individual' && orgToken ? [] : selectedModules,
  coachToken:  coachToken ?? undefined,
  orgToken:    orgToken   ?? undefined,
})
```

- [ ] **Step 4: Create invite-info API**

Create `web/app/api/auth/invite-info/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const coachToken = searchParams.get('coach');
  const orgToken   = searchParams.get('org');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (coachToken) {
    const { data } = await supabase
      .from('coach_instances')
      .select('name')
      .eq('invite_token', coachToken)
      .single();
    return NextResponse.json(data ?? { error: 'Not found' });
  }

  if (orgToken) {
    const { data } = await supabase
      .from('organizations')
      .select('name')
      .eq('invite_token', orgToken)
      .single();
    return NextResponse.json(data ?? { error: 'Not found' });
  }

  return NextResponse.json({ error: 'No token' }, { status: 400 });
}
```

- [ ] **Step 5: Update signup API to handle invite context**

In `web/app/api/auth/signup/route.ts`, extract the new params and update the profile insert:

```ts
const { fullName, email, password, role, companyName, scenarioAccess, coachToken, orgToken } = await req.json();
```

After auth user creation, resolve coach/org context:

```ts
let resolvedCoachInstanceId: string | null = null;
let resolvedOrgId = '00000000-0000-0000-0000-000000000001';
let autoApprove = false;
let approverEmail = 'tim@blueoardesigns.com';
let finalScenarioAccess = scenarioAccess ?? [];

if (orgToken) {
  // Org invite: individual joining a company
  const { data: org } = await supabase
    .from('organizations')
    .select('id, coach_instance_id')
    .eq('invite_token', orgToken)
    .single();
  if (org) {
    resolvedOrgId = (org as any).id;
    resolvedCoachInstanceId = (org as any).coach_instance_id;
    // Inherit scenario_access from the org's company admin
    const { data: admin } = await supabase
      .from('users')
      .select('scenario_access')
      .eq('organization_id', (org as any).id)
      .eq('app_role', 'company_admin')
      .single();
    if (admin) finalScenarioAccess = (admin as any).scenario_access ?? [];
  }
} else if (coachToken) {
  // Coach invite
  const { data: inst } = await supabase
    .from('coach_instances')
    .select('id, auto_approve_users, coach_user_id')
    .eq('invite_token', coachToken)
    .single();
  if (inst) {
    resolvedCoachInstanceId = (inst as any).id;
    autoApprove = (inst as any).auto_approve_users;
    // Get coach email for manual-approve flow
    const { data: coachUser } = await supabase
      .from('users').select('email').eq('id', (inst as any).coach_user_id).single();
    if (coachUser) approverEmail = (coachUser as any).email;
    // If company_admin invite, create org
    if (role === 'company_admin' && companyName) {
      const { randomBytes } = await import('crypto');
      const orgInviteToken = randomBytes(6).toString('hex');
      const { data: newOrg } = await supabase
        .from('organizations')
        .insert({ name: companyName, coach_instance_id: resolvedCoachInstanceId, invite_token: orgInviteToken } as any)
        .select('id').single();
      if (newOrg) resolvedOrgId = (newOrg as any).id;
    }
  }
}

// Update the users.insert to include:
const { error: profileError } = await supabase.from('users').insert({
  // ... existing fields ...
  coach_instance_id: resolvedCoachInstanceId,
  organization_id: resolvedOrgId,
  scenario_access: finalScenarioAccess,
  status: autoApprove ? 'approved' : 'pending',
} as any);

// Only send approval email if not auto-approved
if (!autoApprove) {
  // Send to approverEmail (Tim or the coach)
  await resend.emails.send({
    from: 'TechRP <noreply@blueoardesigns.com>',
    to: approverEmail,
    subject: `New TechRP Signup — ${fullName}`,
    html: `...` // same template as before
  });
}
```

- [ ] **Step 6: Verify**

1. Visit `/signup?coach=<valid_token>` — confirm banner shows coach name, role is locked to company_admin
2. Complete signup — confirm user created with correct `coach_instance_id`
3. Visit `/signup?org=<valid_org_token>` — confirm banner shows company name, role locked to individual, no module selection step
4. If coach has `auto_approve_users = true`, confirm user lands directly on training after signup

- [ ] **Step 7: Commit**

```bash
git add web/app/signup/page.tsx web/app/api/auth/signup/route.ts web/app/api/auth/invite-info/
git commit -m "feat: signup flow handles coach/org invite tokens, auto-approve, inherited module access"
```

---

## Task 9: Role-Based Nav

**Files:**
- Modify: `web/components/nav.tsx`

- [ ] **Step 1: Replace NAV_ITEMS with role-aware computation**

Replace the static `NAV_ITEMS` constant and the nav rendering in `nav.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, type AppUser } from '@/components/auth-provider';

function getNavItems(user: AppUser | null) {
  if (!user || user.status !== 'approved') return [];

  if (user.role === 'coach') {
    return [
      { href: '/coach',     label: 'Dashboard' },
      { href: '/playbooks', label: 'Playbooks' },
      { href: '/personas',  label: 'Personas'  },
    ];
  }

  if (user.role === 'company_admin') {
    const items = [
      { href: '/training',   label: 'Train'      },
      { href: '/sessions',   label: 'Sessions'   },
      { href: '/recordings', label: 'Upload'     },
      { href: '/playbooks',  label: 'Playbooks'  },
    ];
    // Under a coach: show Team panel; direct TechRP admin: show Personas
    if (user.coachInstanceId) {
      items.push({ href: '/team', label: 'Team' });
    } else {
      items.push({ href: '/personas', label: 'Personas' });
    }
    return items;
  }

  // individual
  return [
    { href: '/training',   label: 'Train'    },
    { href: '/sessions',   label: 'Sessions' },
    { href: '/recordings', label: 'Upload'   },
  ];
}

// ... keep LogoMark unchanged ...

export function AppNav() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const navItems = getNavItems(user);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header className="border-b border-white/10 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 sm:px-10 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-bold text-base tracking-tight text-white">TechRP</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-1.5 rounded-md text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user && (
            <span className="text-xs text-gray-500 hidden sm:block">
              {user.fullName || user.email}
            </span>
          )}
          <button onClick={handleSignOut} className="text-xs text-gray-500 hover:text-white transition-colors">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify**

Log in as each role type and confirm correct nav items appear. Individuals should not see Playbooks or Personas. Coaches should see Dashboard/Playbooks/Personas only.

- [ ] **Step 3: Commit**

```bash
git add web/components/nav.tsx
git commit -m "feat: role-based nav — individual/company_admin/coach each see correct items"
```

---

## Task 10: Team Panel (Company Admin)

**Files:**
- Create: `web/app/team/page.tsx`

- [ ] **Step 1: Create team/page.tsx**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { AppNav } from '@/components/nav';
import { useRouter } from 'next/navigation';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

interface TeamMember {
  id: string; full_name: string; email: string; status: string;
  created_at: string; sessionCount: number;
}

export default function TeamPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgInviteToken, setOrgInviteToken] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user && (user.role !== 'company_admin' || !user.coachInstanceId)) {
      router.replace('/');
    }
  }, [user, router]);

  useEffect(() => {
    if (!user?.organizationId) return;

    // Fetch org members
    fetch(`/api/team/members`)
      .then(r => r.json())
      .then(d => {
        setMembers(d.members ?? []);
        setOrgInviteToken(d.inviteToken ?? '');
        setLoading(false);
      });
  }, [user]);

  const copyInvite = () => {
    navigator.clipboard.writeText(`${APP_URL}/signup?org=${orgInviteToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const deactivate = async (memberId: string) => {
    if (!confirm('Deactivate this team member?')) return;
    await fetch(`/api/team/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    });
    setMembers(m => m.map(x => x.id === memberId ? { ...x, status: 'rejected' } : x));
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AppNav />
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">My Team</h1>
          {orgInviteToken && (
            <div className="flex items-center gap-2">
              <code className="text-xs text-gray-400 bg-gray-900 border border-white/10 rounded-lg px-3 py-2 truncate max-w-xs">
                {APP_URL}/signup?org={orgInviteToken}
              </code>
              <button
                onClick={copyInvite}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                {copied ? 'Copied!' : 'Copy invite'}
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-gray-500 py-20 text-center">Loading…</p>
        ) : (
          <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-500 text-xs uppercase tracking-widest">
                  <th className="text-left px-5 py-3">Name</th>
                  <th className="text-left px-5 py-3">Sessions</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-5 py-3">
                      <p className="font-medium">{m.full_name}</p>
                      <p className="text-gray-500 text-xs">{m.email}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-400">{m.sessionCount}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'approved' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {m.status === 'approved' && (
                        <button onClick={() => deactivate(m.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-500">No team members yet. Share your invite link.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create team member APIs**

Create `web/app/api/team/members/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function GET() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: admin } = await supabase
    .from('users')
    .select('id, organization_id, app_role')
    .eq('auth_user_id', authUser.id)
    .single();

  if (!admin || (admin as any).app_role !== 'company_admin' || !(admin as any).organization_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = (admin as any).organization_id;

  const { data: org } = await supabase
    .from('organizations').select('invite_token').eq('id', orgId).single();

  const { data: members } = await supabase
    .from('users')
    .select('id, full_name, email, status, created_at')
    .eq('organization_id', orgId)
    .eq('app_role', 'individual')
    .order('created_at', { ascending: false });

  const memberIds = (members ?? []).map((m: any) => m.id);
  const { data: sessions } = memberIds.length
    ? await supabase.from('training_sessions').select('user_id').in('user_id', memberIds)
    : { data: [] };

  const sessionMap: Record<string, number> = {};
  (sessions ?? []).forEach((s: any) => { sessionMap[s.user_id] = (sessionMap[s.user_id] ?? 0) + 1; });

  return NextResponse.json({
    members: (members ?? []).map((m: any) => ({ ...m, sessionCount: sessionMap[m.id] ?? 0 })),
    inviteToken: (org as any)?.invite_token ?? '',
  });
}
```

Create `web/app/api/team/members/[memberId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function PATCH(req: NextRequest, { params }: { params: { memberId: string } }) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: admin } = await supabase
    .from('users').select('organization_id, app_role').eq('auth_user_id', authUser.id).single();

  if (!admin || (admin as any).app_role !== 'company_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify target is in same org
  const { data: target } = await supabase
    .from('users').select('organization_id').eq('id', params.memberId).single();

  if (!target || (target as any).organization_id !== (admin as any).organization_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { status } = await req.json();
  await supabase.from('users').update({ status } as any).eq('id', params.memberId);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Verify**

Log in as a company_admin that has `coachInstanceId` set. Navigate to `/team`. Confirm member list and invite link appear. Copy link — confirm it contains the org token.

- [ ] **Step 4: Commit**

```bash
git add web/app/team/ web/app/api/team/
git commit -m "feat: team panel for coach-linked company admins"
```

---

## Task 11: Content Isolation

**Files:**
- Modify: `web/app/api/playbook/route.ts`
- Modify: `web/app/playbooks/page.tsx`
- Modify: `web/app/personas/page.tsx`
- Modify: `web/app/api/assess/route.ts`

- [ ] **Step 1: Update playbook API to filter by coach instance**

In `web/app/api/playbook/route.ts`, replace the query with coach-scoped logic:

```ts
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

// Inside GET handler, before the Supabase query:
const supabaseAuth = createServerSupabase();
const { data: { user: authUser } } = await supabaseAuth.auth.getUser();

let coachInstanceId: string | null = null;
let globalEnabled = true;

if (authUser) {
  const supabaseUser = createServiceSupabase();
  const { data: profile } = await supabaseUser
    .from('users').select('coach_instance_id').eq('auth_user_id', authUser.id).single();
  coachInstanceId = (profile as any)?.coach_instance_id ?? null;

  if (coachInstanceId) {
    const { data: inst } = await supabaseUser
      .from('coach_instances').select('global_playbooks_enabled').eq('id', coachInstanceId).single();
    globalEnabled = (inst as any)?.global_playbooks_enabled ?? false;
  }
}

// Build the query with isolation filter
const supabase = createServiceSupabase();
let query = supabase
  .from('playbooks')
  .select('id, name, content, scenario_type')
  .eq('scenario_type', scenarioType)
  .order('created_at', { ascending: false })
  .limit(1);

if (coachInstanceId) {
  // Coach user: show coach's own playbooks; fall back to global only if enabled
  const { data: coachPlaybook } = await supabase
    .from('playbooks')
    .select('id, name, content, scenario_type')
    .eq('scenario_type', scenarioType)
    .eq('coach_instance_id', coachInstanceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (coachPlaybook) return NextResponse.json({ playbook: coachPlaybook });
  if (!globalEnabled) return NextResponse.json({ playbook: null });
  // Fall through to global query
}

const { data, error } = await query.is('coach_instance_id', null).maybeSingle();
if (error || !data) return NextResponse.json({ playbook: null });
return NextResponse.json({ playbook: data });
```

- [ ] **Step 2: Update assess route for coach-scoped playbook lookup**

In `web/app/api/assess/route.ts`, after extracting `scenarioType` from the request body, replace the playbook fetch URL:

```ts
// Resolve coach_instance_id from the requesting user
const supabaseAuth = createServerSupabase();
const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
let coachParam = '';
if (authUser) {
  const sb = createServiceSupabase();
  const { data: profile } = await sb
    .from('users').select('coach_instance_id').eq('auth_user_id', authUser.id).single();
  if ((profile as any)?.coach_instance_id) {
    coachParam = `&coach_instance_id=${(profile as any).coach_instance_id}`;
  }
}

// Use internal fetch with coach context (or call the query directly)
```

Alternatively, extract the playbook query logic into a shared helper and call it directly. The simplest approach — pass `coach_instance_id` as a query param to `/api/playbook` and handle it there (since assess already calls that endpoint):

```ts
const playbookRes = await fetch(
  `${process.env.NEXT_PUBLIC_APP_URL}/api/playbook?scenario_type=${scenarioType}`,
  { headers: { cookie: req.headers.get('cookie') ?? '' } }  // forward session cookie
);
```

This reuses the playbook isolation logic already added in Step 1.

- [ ] **Step 3: Update playbooks/page.tsx to filter by coach instance**

The existing playbooks page uses the browser Supabase client directly. Update the fetch to go through the API instead (which already has isolation):

```tsx
// Replace the direct Supabase query with:
useEffect(() => {
  fetch('/api/playbooks')
    .then(r => r.json())
    .then(d => {
      setPlaybooks(d.playbooks ?? []);
      setLoading(false);
    });
}, []);
```

Create `web/app/api/playbooks/route.ts` (note: plural, new route):

```ts
import { NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function GET() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ playbooks: [] });

  const supabase = createServiceSupabase();
  const { data: profile } = await supabase
    .from('users').select('coach_instance_id, app_role').eq('auth_user_id', authUser.id).single();

  const coachInstanceId = (profile as any)?.coach_instance_id ?? null;

  let query = supabase.from('playbooks').select('*').order('created_at', { ascending: false });

  if (coachInstanceId) {
    const { data: inst } = await supabase
      .from('coach_instances').select('global_playbooks_enabled').eq('id', coachInstanceId).single();
    const globalEnabled = (inst as any)?.global_playbooks_enabled ?? false;

    if (globalEnabled) {
      // Coach's own + global
      query = supabase.from('playbooks').select('*')
        .or(`coach_instance_id.eq.${coachInstanceId},coach_instance_id.is.null`)
        .order('created_at', { ascending: false });
    } else {
      // Coach's own only
      query = supabase.from('playbooks').select('*')
        .eq('coach_instance_id', coachInstanceId)
        .order('created_at', { ascending: false });
    }
  } else {
    // Global only
    query = query.is('coach_instance_id', null);
  }

  const { data } = await query;
  return NextResponse.json({ playbooks: data ?? [] });
}
```

- [ ] **Step 4: Update personas/page.tsx and its API for isolation**

Update `web/app/api/personas/route.ts` GET handler — add coach isolation before the query:

```ts
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function GET() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();

  const supabase = createServiceSupabase();
  let coachInstanceId: string | null = null;

  if (authUser) {
    const { data: profile } = await supabase
      .from('users').select('coach_instance_id').eq('auth_user_id', authUser.id).single();
    coachInstanceId = (profile as any)?.coach_instance_id ?? null;
  }

  let query = supabase.from('personas').select('*').order('name');

  if (coachInstanceId) {
    const { data: inst } = await supabase
      .from('coach_instances').select('global_personas_enabled').eq('id', coachInstanceId).single();
    const globalEnabled = (inst as any)?.global_personas_enabled ?? false;

    if (globalEnabled) {
      query = supabase.from('personas').select('*')
        .or(`coach_instance_id.eq.${coachInstanceId},coach_instance_id.is.null`)
        .order('name');
    } else {
      query = supabase.from('personas').select('*')
        .eq('coach_instance_id', coachInstanceId)
        .order('name');
    }
  } else {
    query = query.is('coach_instance_id', null);
  }

  const { data } = await query;
  return NextResponse.json({ personas: data ?? [] });
}
```

In `web/app/personas/page.tsx`, replace the direct Supabase `from('personas')` query with:

```tsx
const res = await fetch('/api/personas');
const data = await res.json();
setPersonas(data.personas ?? []);
```

- [ ] **Step 5: Verify**

1. Log in as a direct TechRP user — should see all global playbooks/personas
2. Log in as a coach user — should see only their own content (add a test playbook with `coach_instance_id` set and confirm it appears)
3. Toggle `global_playbooks_enabled` for the coach instance — should affect what the coach sees

- [ ] **Step 6: Commit**

```bash
git add web/app/api/playbook/route.ts web/app/api/playbooks/route.ts web/app/api/personas/route.ts web/app/api/assess/route.ts web/app/playbooks/page.tsx web/app/personas/page.tsx
git commit -m "feat: content isolation — playbooks and personas filtered by coach instance"
```

---

## Task 12: Scenario Access Enforcement in Training

**Files:**
- Modify: `web/app/training/page.tsx`

- [ ] **Step 1: Filter SCENARIOS by user.scenarioAccess**

In `web/app/training/page.tsx`, after `const { user } = useAuth()`, add:

```tsx
// Filter scenarios to those the user has access to
const accessibleScenarios = user?.scenarioAccess?.length
  ? SCENARIOS.filter(s => user.scenarioAccess.includes(s.type))
  : SCENARIOS; // fallback: show all if no restrictions set
```

Then replace all references to `SCENARIOS` in the scenario picker JSX with `accessibleScenarios`.

- [ ] **Step 2: Show locked state for inaccessible scenarios**

If `user?.scenarioAccess?.length > 0` but the user tries to access a scenario they don't have (e.g. direct URL navigation), show a message:

```tsx
// At the top of the 'scenario-select' phase render:
if (user?.scenarioAccess?.length && !accessibleScenarios.length) {
  return (
    <div className="py-20 text-center text-gray-500">
      <p>No training scenarios are available for your account.</p>
      <p className="text-sm mt-2">Contact your admin to get access.</p>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Create a test user with `scenario_access = ['homeowner_inbound']`. Log in and confirm only the Homeowner Inbound scenario card appears on the training page.

- [ ] **Step 4: Commit**

```bash
git add web/app/training/page.tsx
git commit -m "feat: filter training scenarios by user.scenarioAccess"
```

---

## Task 13: Loading Skeletons

**Files:**
- Create: `web/components/skeleton.tsx`
- Modify: `web/app/sessions/page.tsx`
- Modify: `web/app/playbooks/page.tsx`

- [ ] **Step 1: Create skeleton components**

Create `web/components/skeleton.tsx`:

```tsx
export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-white/10 rounded ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonLine className="h-4 w-32" />
        <SkeletonLine className="h-5 w-16 rounded-full" />
      </div>
      <SkeletonLine className="h-3 w-24" />
      <div className="flex gap-2 pt-1">
        <SkeletonLine className="h-3 w-20" />
        <SkeletonLine className="h-3 w-16" />
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-white/5">
      <SkeletonLine className="h-4 w-28" />
      <SkeletonLine className="h-4 w-20 ml-auto" />
      <SkeletonLine className="h-5 w-14 rounded-full" />
      <SkeletonLine className="h-4 w-12" />
    </div>
  );
}

export function SkeletonPlaybookCard() {
  return (
    <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between">
        <SkeletonLine className="h-4 w-40" />
        <SkeletonLine className="h-5 w-20 rounded-full" />
      </div>
      <SkeletonLine className="h-3 w-full" />
      <SkeletonLine className="h-3 w-3/4" />
    </div>
  );
}
```

- [ ] **Step 2: Use skeletons in sessions/page.tsx**

Replace `{loading ? <div>Loading…</div> : ...}` with:

```tsx
import { SkeletonRow } from '@/components/skeleton';

// Replace the loading text:
{loading ? (
  <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
    {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
  </div>
) : /* existing session list JSX */}
```

- [ ] **Step 3: Use skeletons in playbooks/page.tsx**

```tsx
import { SkeletonPlaybookCard } from '@/components/skeleton';

// Replace loading text:
{loading ? (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {[...Array(4)].map((_, i) => <SkeletonPlaybookCard key={i} />)}
  </div>
) : /* existing playbooks grid JSX */}
```

- [ ] **Step 4: Verify**

Navigate to `/sessions` and `/playbooks`. Briefly throttle network in DevTools (Network tab → Slow 3G). Confirm skeleton cards pulse while data loads, then snap to the real content.

- [ ] **Step 5: Commit**

```bash
git add web/components/skeleton.tsx web/app/sessions/page.tsx web/app/playbooks/page.tsx
git commit -m "feat: loading skeletons on sessions and playbooks pages"
```

---

## Task 14: Mobile-Responsive Layouts

**Files:**
- Modify: `web/app/sessions/page.tsx`
- Modify: `web/app/playbooks/page.tsx`

- [ ] **Step 1: Fix sessions list — replace fixed grid with responsive cards**

The sessions table uses `grid grid-cols-12` with fixed column spans, which overflows on mobile. Replace the session row with a responsive card approach.

Find the session row JSX (the `grid grid-cols-12` element) and replace it with:

```tsx
{/* Mobile: stacked card. Desktop: row layout */}
<div
  key={session.id}
  onClick={() => router.push(`/sessions/${session.id}`)}
  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0 px-5 py-4 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
>
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`text-xs px-2 py-0.5 rounded-full border ${scenarioMeta.color}`}>
        {scenarioMeta.label}
      </span>
      {score !== null && (
        <span className={`text-xs font-bold ${score >= 7 ? 'text-green-400' : score >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
          {score}/10
        </span>
      )}
    </div>
    <p className="text-gray-500 text-xs mt-1">{formatDate(session.started_at)}</p>
  </div>
  <div className="text-xs text-gray-500 sm:ml-4 sm:text-right">
    {formatDuration(session.started_at, session.ended_at)}
  </div>
</div>
```

- [ ] **Step 2: Verify sessions on mobile**

Open DevTools → Toggle device toolbar → iPhone 12 Pro. Navigate to `/sessions`. Confirm rows stack vertically with no horizontal overflow.

- [ ] **Step 3: Commit**

```bash
git add web/app/sessions/page.tsx web/app/playbooks/page.tsx
git commit -m "fix: mobile-responsive sessions list and playbooks grid"
```

---

## Task 15: Sentry Error Monitoring

**Files:**
- Modify: `web/package.json` (via npm install)
- New config files created by Sentry wizard

- [ ] **Step 1: Install and configure Sentry**

```bash
cd web
npx @sentry/wizard@latest -i nextjs
```

When prompted:
- Select "Yes" to create example page with error
- Select "Yes" for Sentry CI/CD
- If it asks for a DSN, create a free account at sentry.io → New Project → Next.js → copy the DSN

- [ ] **Step 2: Add DSN to .env.local**

```
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_ORG=your-org
SENTRY_PROJECT=techrp
```

- [ ] **Step 3: Verify**

Run `cd web && npm run build`. Then start dev server and navigate to the example error page Sentry created (usually `/sentry-example-page`). Trigger the error. Check sentry.io dashboard — the error should appear within ~30 seconds.

- [ ] **Step 4: Commit**

```bash
cd ..
git add web/sentry.client.config.ts web/sentry.server.config.ts web/sentry.edge.config.ts web/next.config.ts web/package.json web/package-lock.json
git commit -m "feat: Sentry error monitoring for Next.js (client + server)"
```

---

## Task 16: Analytics Dashboard

**Files:**
- Modify: `web/app/api/insights/route.ts`
- Create: `web/app/insights/page.tsx`

- [ ] **Step 1: Extend the insights API**

In `web/app/api/insights/route.ts`, after getting `userId`, add queries for aggregate metrics. Replace the response with:

```ts
// Existing: per-user session data
const { data: sessions } = await supabase
  .from('training_sessions')
  .select('id, score, scenario_type, started_at, assessment')
  .eq('user_id', userId)
  .order('started_at', { ascending: false });

// New: org-level metrics (for company_admin / coach)
const { data: orgSessions } = await supabase
  .from('training_sessions')
  .select('id, score, scenario_type, started_at, user_id')
  .order('started_at', { ascending: false })
  .limit(500);  // bounded query; refine with org filter once user lookup is added

const totalSessions = (orgSessions ?? []).length;
const scores = (orgSessions ?? []).map((s: any) => s.score).filter(Boolean);
const avgScore = scores.length ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1) : null;

// Sessions per scenario
const byScenario: Record<string, number> = {};
(orgSessions ?? []).forEach((s: any) => {
  byScenario[s.scenario_type] = (byScenario[s.scenario_type] ?? 0) + 1;
});

// Active users last 30 days
const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const activeUserIds = new Set(
  (orgSessions ?? []).filter((s: any) => s.started_at > cutoff).map((s: any) => s.user_id)
);

return NextResponse.json({
  // existing fields...
  metrics: {
    totalSessions,
    avgScore,
    activeUsers: activeUserIds.size,
    byScenario,
  },
});
```

- [ ] **Step 2: Create insights/page.tsx**

Create `web/app/insights/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { AppNav } from '@/components/nav';

interface Metrics {
  totalSessions: number;
  avgScore: string | null;
  activeUsers: number;
  byScenario: Record<string, number>;
}

const SCENARIO_LABELS: Record<string, string> = {
  homeowner_inbound: 'Inbound Call', homeowner_facetime: 'Door Knock',
  plumber_lead: 'Plumber Lead', property_manager: 'Residential PM',
  commercial_property_manager: 'Commercial PM', insurance_broker: 'Insurance',
  plumber_bd: 'Plumber BD',
};

export default function InsightsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    fetch('/api/insights')
      .then(r => r.json())
      .then(d => setMetrics(d.metrics ?? null));
  }, []);

  const STAT_CARDS = metrics ? [
    { label: 'Total Sessions',   value: metrics.totalSessions },
    { label: 'Avg Score',        value: metrics.avgScore ? `${metrics.avgScore}/10` : '—' },
    { label: 'Active (30d)',      value: metrics.activeUsers },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AppNav />
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 space-y-8">
        <h1 className="text-2xl font-bold">Analytics</h1>

        {!metrics ? (
          <p className="text-gray-500 py-20 text-center">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {STAT_CARDS.map(card => (
                <div key={card.label} className="bg-gray-900 border border-white/10 rounded-2xl p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{card.label}</p>
                  <p className="text-3xl font-bold">{card.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-300">Sessions by Scenario</h2>
              {Object.entries(metrics.byScenario)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => {
                  const max = Math.max(...Object.values(metrics.byScenario));
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-sm text-gray-400 w-44 shrink-0">{SCENARIO_LABELS[type] ?? type}</span>
                      <div className="flex-1 bg-gray-800 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${(count / max) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-400 w-8 text-right">{count}</span>
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add insights to nav for company_admin + coach**

In `web/components/nav.tsx`, add `{ href: '/insights', label: 'Analytics' }` to the `company_admin` and `coach` nav items arrays.

- [ ] **Step 4: Verify**

Navigate to `/insights` as an approved company_admin or coach. Confirm the stat cards and scenario bar chart render with real data.

- [ ] **Step 5: Commit**

```bash
git add web/app/insights/ web/app/api/insights/route.ts web/components/nav.tsx
git commit -m "feat: analytics dashboard — session counts, avg score, active users, by-scenario breakdown"
```

---

## Final Build Check

- [ ] Run `cd web && npm run build` — fix any TypeScript errors before calling this complete
- [ ] Run `cd web && npm run lint` — fix any lint warnings
- [ ] Commit any fixes: `git commit -m "fix: build and lint cleanup"`

---

## Summary Checklist

| Task | Description |
|---|---|
| 1 | DB migration — coach_instances, org invite tokens |
| 2 | AppUser type — add coach role, coachInstanceId, organizationId |
| 3 | Middleware — ADMIN_SECRET gate for /admin |
| 4 | Pending page — rejected state + resend button |
| 5 | Real user_id — training, recordings, insights |
| 6 | Tim's /admin — create + deactivate coaches |
| 7 | Coach dashboard — companies, users, content toggles |
| 8 | Signup flow — coach/org invite params |
| 9 | Role-based nav |
| 10 | Team panel — company admin manages their org |
| 11 | Content isolation — playbooks, personas, assessment |
| 12 | Scenario access enforcement in training |
| 13 | Loading skeletons |
| 14 | Mobile-responsive layouts |
| 15 | Sentry |
| 16 | Analytics dashboard |
