# Candidate Invites & Company Admin Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full candidate invite lifecycle to TechRP — company admins invite candidates via personal links, assign scenario quotas, and get notified when candidates complete; plus fix the RLS recursion bug and add per-member module assignment UI.

**Architecture:** New `candidate_invites` and `notifications` tables hold invite state. Candidates sign up via personal tokens that pre-fill and lock their email; `user_type='candidate'` distinguishes them from employees. The `POST /api/sessions` handler triggers a completion check after every candidate session, firing in-app + email notifications when all quotas are met. The team page gains a Candidates tab and per-employee module editor.

**Tech Stack:** Next.js 14 App Router, Supabase (service role for all writes), Resend for email, `createServiceSupabase()` / `createServerSupabase()` from `@/lib/supabase-server`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `web/supabase/candidate-invites-migration.sql` | All new schema: tables, columns, RLS fix |
| Create | `web/lib/candidate-completion.ts` | Per-scenario quota check + notification fire |
| Create | `web/app/api/team/candidates/route.ts` | GET (list) + POST (create invite) |
| Create | `web/app/api/team/candidates/[id]/route.ts` | DELETE (revoke pending invite) |
| Create | `web/app/api/team/candidates/[id]/upgrade-email/route.ts` | POST — send upgrade email |
| Create | `web/app/api/auth/upgrade/route.ts` | POST — flip candidate → standard |
| Create | `web/app/api/notifications/route.ts` | GET all + PATCH read-all |
| Create | `web/app/api/notifications/[id]/read/route.ts` | PATCH — mark one read |
| Create | `web/app/upgrade/page.tsx` | Candidate upgrade confirmation page |
| Create | `web/components/notification-bell.tsx` | Bell icon + unread dropdown |
| Modify | `web/app/api/auth/invite-info/route.ts` | Add `?candidate=TOKEN` branch |
| Modify | `web/app/api/auth/signup/route.ts` | Add candidate token signup flow |
| Modify | `web/app/api/team/members/[memberId]/route.ts` | Add `scenario_access` PATCH |
| Modify | `web/app/api/sessions/route.ts` | Call completion check after session save |
| Modify | `web/app/signup/page.tsx` | Pre-fill locked email + marketing consent for candidate flow |
| Modify | `web/app/team/page.tsx` | Candidates tab + module assignment in Employees tab |
| Modify | `web/components/nav.tsx` | Add NotificationBell between nav links and sign-out |
| Modify | `web/components/auth-provider.tsx` | Add `userType` to `AppUser` |

---

## Task 1: Database Migration

**Files:**
- Create: `web/supabase/candidate-invites-migration.sql`

- [ ] **Step 1: Write migration file**

```sql
-- ============================================================
-- TechRP — Candidate Invites + Notifications + RLS Fix
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Create candidate_invites ──────────────────────────────
CREATE TABLE IF NOT EXISTS candidate_invites (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 TEXT NOT NULL,
  full_name             TEXT,
  personal_token        TEXT UNIQUE NOT NULL,
  invited_by_user_id    UUID NOT NULL REFERENCES users(id),
  organization_id       UUID NOT NULL REFERENCES organizations(id),
  coach_instance_id     UUID REFERENCES coach_instances(id),
  assigned_scenarios    JSONB NOT NULL DEFAULT '[]',
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','signed_up','in_progress','complete','upgraded')),
  signed_up_user_id     UUID REFERENCES users(id),
  notification_sent_at  TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email, organization_id)
);

-- ── 2. Extend users ──────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS user_type TEXT NOT NULL DEFAULT 'standard'
    CHECK (user_type IN ('standard', 'candidate')),
  ADD COLUMN IF NOT EXISTS candidate_invite_id UUID REFERENCES candidate_invites(id),
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT false;

-- ── 3. Create notifications ──────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread
  ON notifications(user_id, read) WHERE NOT read;

-- ── 4. RLS fix — SECURITY DEFINER to avoid recursion ────────
CREATE OR REPLACE FUNCTION is_company_admin_of_org(check_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_user_id = auth.uid()
      AND app_role = 'company_admin'
      AND organization_id = check_org_id
  );
$$;

-- Drop old recursive policies (use common names)
DROP POLICY IF EXISTS "company_admin_view_org_users" ON users;
DROP POLICY IF EXISTS "Users can view their org members" ON users;
DROP POLICY IF EXISTS "Team members can view org users" ON users;

CREATE POLICY "company_admin_view_org_users"
ON users FOR SELECT
USING (is_company_admin_of_org(organization_id));

-- ── 5. RLS on candidate_invites ──────────────────────────────
ALTER TABLE candidate_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_admin_manage_candidates"
ON candidate_invites FOR ALL
USING (is_company_admin_of_org(organization_id));

-- ── 6. RLS on notifications ──────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper to get own user id without recursion
CREATE OR REPLACE FUNCTION get_my_user_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE POLICY "user_view_own_notifications"
ON notifications FOR SELECT
USING (user_id = get_my_user_id());

CREATE POLICY "user_update_own_notifications"
ON notifications FOR UPDATE
USING (user_id = get_my_user_id());
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Open the Supabase dashboard → SQL Editor → paste the file above → Run.

Expected: all statements complete with no errors. Verify with:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'candidate_invites' ORDER BY ordinal_position;
```

- [ ] **Step 3: Verify users columns were added**

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('user_type', 'candidate_invite_id', 'marketing_consent');
```

Expected: 3 rows.

- [ ] **Step 4: Commit**

```bash
git add web/supabase/candidate-invites-migration.sql
git commit -m "sql: add candidate_invites, notifications tables, RLS fix"
```

---

## Task 2: Extend Team Members PATCH — Scenario Access

**Files:**
- Modify: `web/app/api/team/members/[memberId]/route.ts`

- [ ] **Step 1: Replace file with extended version**

The current route only accepts `{ status: 'rejected' }`. Extend it to also accept `{ scenario_access: string[] }`.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function PATCH(req: NextRequest, { params }: { params: { memberId: string } }) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: admin } = await (supabase as any)
    .from('users')
    .select('organization_id, app_role')
    .eq('auth_user_id', authUser.id)
    .single();

  if (!admin || (admin as any).app_role !== 'company_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify target is in same org
  const { data: target } = await (supabase as any)
    .from('users')
    .select('organization_id')
    .eq('id', params.memberId)
    .single();

  if (!target || (target as any).organization_id !== (admin as any).organization_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();

  // Handle status deactivation
  if ('status' in body) {
    if (body.status !== 'rejected') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    await (supabase as any).from('users').update({ status: 'rejected' }).eq('id', params.memberId);
    return NextResponse.json({ success: true });
  }

  // Handle scenario_access update
  if ('scenario_access' in body) {
    if (!Array.isArray(body.scenario_access)) {
      return NextResponse.json({ error: 'scenario_access must be an array' }, { status: 400 });
    }
    const valid = ['technician', 'property_manager', 'insurance', 'plumber_bd'];
    const invalid = body.scenario_access.filter((s: string) => !valid.includes(s));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Invalid scenario types: ${invalid.join(', ')}` }, { status: 400 });
    }
    await (supabase as any)
      .from('users')
      .update({ scenario_access: body.scenario_access })
      .eq('id', params.memberId);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'No valid field to update' }, { status: 400 });
}
```

- [ ] **Step 2: Test via curl**

Start dev server: `cd web && npm run dev`

```bash
# Replace TOKEN with a real company_admin session token from browser cookies
curl -X PATCH http://localhost:3000/api/team/members/MEMBER_ID \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=TOKEN" \
  -d '{"scenario_access": ["technician", "plumber_bd"]}'
```

Expected: `{"success":true}`

- [ ] **Step 3: Commit**

```bash
git add web/app/api/team/members/[memberId]/route.ts
git commit -m "feat: extend team member PATCH to support scenario_access update"
```

---

## Task 3: Candidate Completion Library

**Files:**
- Create: `web/lib/candidate-completion.ts`

This is written first so Tasks 4 and 6 can import it cleanly.

- [ ] **Step 1: Create the file**

```typescript
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface AssignedScenario {
  scenario_type: string;
  count: number;
}

/**
 * Called after every session save for a candidate user.
 * Fires completion notification + auto-suspend when all quotas met.
 */
export async function checkCandidateCompletion(userId: string): Promise<void> {
  const supabase = serviceClient();

  // Load user + invite in one shot
  const { data: user } = await (supabase as any)
    .from('users')
    .select('user_type, candidate_invite_id, full_name, email, organization_id')
    .eq('id', userId)
    .single();

  if (!user || (user as any).user_type !== 'candidate' || !(user as any).candidate_invite_id) return;

  const { data: invite } = await (supabase as any)
    .from('candidate_invites')
    .select('id, assigned_scenarios, status, notification_sent_at, invited_by_user_id, personal_token')
    .eq('id', (user as any).candidate_invite_id)
    .single();

  if (!invite || (invite as any).notification_sent_at) return;  // already notified

  // Count completed sessions per scenario type for this user
  const { data: sessions } = await (supabase as any)
    .from('training_sessions')
    .select('persona_scenario_type')
    .eq('user_id', userId);

  const counts: Record<string, number> = {};
  ((sessions ?? []) as any[]).forEach((s) => {
    const t = s.persona_scenario_type;
    if (t) counts[t] = (counts[t] ?? 0) + 1;
  });

  // Update status to in_progress if still signed_up
  if ((invite as any).status === 'signed_up') {
    await (supabase as any)
      .from('candidate_invites')
      .update({ status: 'in_progress' })
      .eq('id', (invite as any).id);
  }

  // Check if all quotas met
  const assigned: AssignedScenario[] = (invite as any).assigned_scenarios ?? [];
  const allComplete = assigned.length > 0 && assigned.every(
    ({ scenario_type, count }) => (counts[scenario_type] ?? 0) >= count
  );
  if (!allComplete) return;

  // --- All quotas met: fire completion ---

  // 1. Mark invite complete + stamp notification time atomically
  await (supabase as any)
    .from('candidate_invites')
    .update({ status: 'complete', notification_sent_at: new Date().toISOString() })
    .eq('id', (invite as any).id);

  // 2. Auto-suspend candidate
  await (supabase as any)
    .from('users')
    .update({ status: 'suspended' })
    .eq('id', userId);

  // 3. Create in-app notification for company admin
  await (supabase as any).from('notifications').insert({
    user_id: (invite as any).invited_by_user_id,
    type: 'candidate_complete',
    title: `${(user as any).full_name ?? (user as any).email} completed their assessment`,
    body: 'View their session results in the Candidates tab.',
    data: {
      candidate_invite_id: (invite as any).id,
      candidate_user_id: userId,
    },
  });

  // 4. Send email to company admin
  const { data: adminUser } = await (supabase as any)
    .from('users')
    .select('email, full_name')
    .eq('id', (invite as any).invited_by_user_id)
    .single();

  if (adminUser) {
    const candidateName = (user as any).full_name ?? (user as any).email;
    const resultsUrl = `${APP_URL}/team`;
    try {
      await resend.emails.send({
        from: 'TechRP <noreply@blueoardesigns.com>',
        to: (adminUser as any).email,
        subject: `${candidateName} completed their assessment`,
        html: `
          <h2>Candidate Assessment Complete</h2>
          <p><strong>${candidateName}</strong> has completed all ${assigned.reduce((a, s) => a + s.count, 0)} assigned sessions.</p>
          <p>
            <a href="${resultsUrl}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">
              View Results →
            </a>
          </p>
        `,
      });
    } catch (err) {
      console.error('Failed to send candidate completion email:', err);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add web/lib/candidate-completion.ts
git commit -m "feat: add candidate completion check library"
```

---

## Task 4: Wire Completion Check into Sessions Route

**Files:**
- Modify: `web/app/api/sessions/route.ts`

- [ ] **Step 1: Import and call completion check after session save**

Add the import at the top of the file and call it inside the `POST` handler after the auto-suspend block:

```typescript
// Add this import at the top (after existing imports)
import { checkCandidateCompletion } from '@/lib/candidate-completion';
```

Replace the POST handler's user block (lines 36–58 in original) with:

```typescript
    // Increment sessions_used and auto-suspend if limit reached
    const userId = body.user_id;
    if (userId) {
      const { error: rpcError } = await (supabase as any).rpc('increment_sessions_used', { target_user_id: userId });
      if (rpcError) {
        console.error('Failed to increment sessions_used for user', userId, rpcError);
      }

      const { data: userRow } = await (supabase as any)
        .from('users')
        .select('sessions_used, session_limit, user_type')
        .eq('id', userId)
        .single();

      if (
        userRow &&
        userRow.session_limit !== null &&
        userRow.sessions_used >= userRow.session_limit
      ) {
        await (supabase as any)
          .from('users')
          .update({ status: 'suspended' })
          .eq('id', userId);
      }

      // Candidate-specific completion check (fires email + in-app notification)
      if (userRow?.user_type === 'candidate') {
        checkCandidateCompletion(userId).catch(err =>
          console.error('Candidate completion check failed:', err)
        );
      }
    }
```

- [ ] **Step 2: Verify the server still starts**

```bash
cd web && npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add web/app/api/sessions/route.ts
git commit -m "feat: trigger candidate completion check after session save"
```

---

## Task 5: Notifications API Routes

**Files:**
- Create: `web/app/api/notifications/route.ts`
- Create: `web/app/api/notifications/[id]/read/route.ts`
- Create: `web/app/api/notifications/read-all/route.ts`

- [ ] **Step 1: Create `web/app/api/notifications/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function GET() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: profile } = await (supabase as any)
    .from('users').select('id').eq('auth_user_id', authUser.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: notifications } = await (supabase as any)
    .from('notifications')
    .select('*')
    .eq('user_id', (profile as any).id)
    .order('created_at', { ascending: false })
    .limit(50);

  const unreadCount = ((notifications ?? []) as any[]).filter(n => !n.read).length;

  return NextResponse.json({ notifications: notifications ?? [], unreadCount });
}

export async function PATCH() {
  // Mark all notifications read for current user
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: profile } = await (supabase as any)
    .from('users').select('id').eq('auth_user_id', authUser.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await (supabase as any)
    .from('notifications')
    .update({ read: true })
    .eq('user_id', (profile as any).id)
    .eq('read', false);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Create `web/app/api/notifications/[id]/read/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: profile } = await (supabase as any)
    .from('users').select('id').eq('auth_user_id', authUser.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only allow marking own notifications
  const { data: notification } = await (supabase as any)
    .from('notifications')
    .select('user_id')
    .eq('id', params.id)
    .single();

  if (!notification || (notification as any).user_id !== (profile as any).id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await (supabase as any)
    .from('notifications')
    .update({ read: true })
    .eq('id', params.id);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add web/app/api/notifications/
git commit -m "feat: add notifications API routes (GET, PATCH read)"
```

---

## Task 6: Candidate Invite API Routes

**Files:**
- Create: `web/app/api/team/candidates/route.ts`
- Create: `web/app/api/team/candidates/[id]/route.ts`
- Create: `web/app/api/team/candidates/[id]/upgrade-email/route.ts`

- [ ] **Step 1: Create `web/app/api/team/candidates/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';
import { randomBytes } from 'crypto';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function getAdminContext(authUserId: string) {
  const supabase = createServiceSupabase();
  const { data: admin } = await (supabase as any)
    .from('users')
    .select('id, organization_id, coach_instance_id, app_role')
    .eq('auth_user_id', authUserId)
    .single();
  if (!admin || (admin as any).app_role !== 'company_admin' || !(admin as any).organization_id) {
    return null;
  }
  return admin as { id: string; organization_id: string; coach_instance_id: string | null; app_role: string };
}

export async function GET() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await getAdminContext(authUser.id);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();

  // Get all invites for this org
  const { data: invites } = await (supabase as any)
    .from('candidate_invites')
    .select('*')
    .eq('organization_id', admin.organization_id)
    .order('created_at', { ascending: false });

  // Get session counts per signed-up candidate for progress display
  const signedUpIds = ((invites ?? []) as any[])
    .map(i => i.signed_up_user_id)
    .filter(Boolean);

  let sessionsByUser: Record<string, Record<string, number>> = {};
  if (signedUpIds.length > 0) {
    const { data: sessions } = await (supabase as any)
      .from('training_sessions')
      .select('user_id, persona_scenario_type')
      .in('user_id', signedUpIds);

    ((sessions ?? []) as any[]).forEach((s) => {
      if (!s.persona_scenario_type) return;
      if (!sessionsByUser[s.user_id]) sessionsByUser[s.user_id] = {};
      sessionsByUser[s.user_id][s.persona_scenario_type] =
        (sessionsByUser[s.user_id][s.persona_scenario_type] ?? 0) + 1;
    });
  }

  const enriched = ((invites ?? []) as any[]).map(invite => {
    const assigned: { scenario_type: string; count: number }[] = invite.assigned_scenarios ?? [];
    const userSessions = invite.signed_up_user_id ? (sessionsByUser[invite.signed_up_user_id] ?? {}) : {};
    const sessionsComplete = assigned.reduce((sum, s) =>
      sum + Math.min(userSessions[s.scenario_type] ?? 0, s.count), 0);
    const sessionsTotal = assigned.reduce((sum, s) => sum + s.count, 0);
    return {
      ...invite,
      invite_url: `${APP_URL}/signup?candidate=${invite.personal_token}`,
      progress: { sessionsComplete, sessionsTotal },
    };
  });

  return NextResponse.json({ candidates: enriched });
}

export async function POST(req: NextRequest) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await getAdminContext(authUser.id);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { email, full_name, assigned_scenarios, expires_in_days = 30 } = await req.json();

  if (!email || !assigned_scenarios?.length) {
    return NextResponse.json({ error: 'email and assigned_scenarios are required' }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  const personal_token = randomBytes(16).toString('hex');
  const expires_at = new Date(Date.now() + expires_in_days * 86400_000).toISOString();

  const { data: invite, error } = await (supabase as any)
    .from('candidate_invites')
    .insert({
      email,
      full_name: full_name ?? null,
      personal_token,
      invited_by_user_id: admin.id,
      organization_id: admin.organization_id,
      coach_instance_id: admin.coach_instance_id,
      assigned_scenarios,
      expires_at,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A candidate with that email has already been invited.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    invite: {
      ...(invite as any),
      invite_url: `${APP_URL}/signup?candidate=${personal_token}`,
    },
  }, { status: 201 });
}
```

- [ ] **Step 2: Create `web/app/api/team/candidates/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: admin } = await (supabase as any)
    .from('users')
    .select('organization_id, app_role')
    .eq('auth_user_id', authUser.id)
    .single();

  if (!admin || (admin as any).app_role !== 'company_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: invite } = await (supabase as any)
    .from('candidate_invites')
    .select('organization_id, status')
    .eq('id', params.id)
    .single();

  if (!invite || (invite as any).organization_id !== (admin as any).organization_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if ((invite as any).status !== 'pending') {
    return NextResponse.json({ error: 'Can only revoke pending invites. Deactivate the user instead.' }, { status: 400 });
  }

  await (supabase as any).from('candidate_invites').delete().eq('id', params.id);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create `web/app/api/team/candidates/[id]/upgrade-email/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: admin } = await (supabase as any)
    .from('users')
    .select('organization_id, app_role')
    .eq('auth_user_id', authUser.id)
    .single();

  if (!admin || (admin as any).app_role !== 'company_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: invite } = await (supabase as any)
    .from('candidate_invites')
    .select('organization_id, status, personal_token, email, full_name')
    .eq('id', params.id)
    .single();

  if (!invite || (invite as any).organization_id !== (admin as any).organization_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if ((invite as any).status !== 'complete') {
    return NextResponse.json({ error: 'Candidate has not completed their assessment yet.' }, { status: 400 });
  }

  const upgradeUrl = `${APP_URL}/upgrade?token=${(invite as any).personal_token}`;
  const candidateName = (invite as any).full_name ?? (invite as any).email;

  try {
    await resend.emails.send({
      from: 'TechRP <noreply@blueoardesigns.com>',
      to: (invite as any).email,
      subject: "You've been invited to create a full TechRP account",
      html: `
        <h2>Great work, ${candidateName}!</h2>
        <p>You've completed your candidate assessment. You've been invited to create a full TechRP account to continue your training.</p>
        <p>
          <a href="${upgradeUrl}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Activate Full Account →
          </a>
        </p>
        <p style="color:#6b7280;font-size:12px;">This link is personal to you. Do not share it.</p>
      `,
    });
  } catch (err) {
    console.error('Failed to send upgrade email:', err);
    return NextResponse.json({ error: 'Failed to send email.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Commit**

```bash
git add web/app/api/team/candidates/
git commit -m "feat: add candidate invite API routes (list, create, delete, upgrade-email)"
```

---

## Task 7: Auth Upgrade Route + Upgrade Page

**Files:**
- Create: `web/app/api/auth/upgrade/route.ts`
- Create: `web/app/upgrade/page.tsx`

- [ ] **Step 1: Create `web/app/api/auth/upgrade/route.ts`**

```typescript
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
```

- [ ] **Step 2: Create `web/app/upgrade/page.tsx`**

```tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';

function UpgradeInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) setErrorMsg('Invalid upgrade link.');
  }, [token]);

  const handleUpgrade = async () => {
    if (!token) return;
    setStatus('loading');
    const res = await fetch('/api/auth/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error ?? 'Something went wrong.');
      setStatus('error');
      return;
    }
    await refreshUser();
    setStatus('success');
    setTimeout(() => router.push('/training'), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto text-3xl">🚀</div>
        <h1 className="text-2xl font-bold">Activate Full Account</h1>

        {errorMsg ? (
          <p className="text-red-400 text-sm">{errorMsg}</p>
        ) : status === 'success' ? (
          <p className="text-green-400 text-sm">Account upgraded! Redirecting…</p>
        ) : (
          <>
            <p className="text-gray-400 text-sm leading-relaxed">
              Welcome back{user?.fullName ? `, ${user.fullName}` : ''}. Click below to activate your full TechRP account and continue your training.
            </p>
            <button
              onClick={handleUpgrade}
              disabled={status === 'loading' || !token}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              {status === 'loading' ? 'Activating…' : 'Activate Full Account'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <UpgradeInner />
    </Suspense>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/app/api/auth/upgrade/route.ts web/app/upgrade/page.tsx
git commit -m "feat: add upgrade route and page for candidate-to-standard account transition"
```

---

## Task 8: Extend invite-info + Signup Routes for Candidate Token

**Files:**
- Modify: `web/app/api/auth/invite-info/route.ts`
- Modify: `web/app/api/auth/signup/route.ts`

- [ ] **Step 1: Extend invite-info to handle `?candidate=TOKEN`**

Replace the full file:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const coachToken     = searchParams.get('coach');
  const orgToken       = searchParams.get('org');
  const candidateToken = searchParams.get('candidate');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (candidateToken) {
    const { data } = await (supabase as any)
      .from('candidate_invites')
      .select('email, full_name, assigned_scenarios, expires_at, status')
      .eq('personal_token', candidateToken)
      .single();
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if ((data as any).status !== 'pending') {
      return NextResponse.json({ error: 'This invite has already been used.' }, { status: 400 });
    }
    const expiresAt = (data as any).expires_at;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This invite link has expired.' }, { status: 400 });
    }
    return NextResponse.json({
      email: (data as any).email,
      full_name: (data as any).full_name,
      assigned_scenarios: (data as any).assigned_scenarios,
    });
  }

  if (coachToken) {
    const { data } = await (supabase as any)
      .from('coach_instances')
      .select('name')
      .eq('invite_token', coachToken)
      .single();
    return NextResponse.json(data ?? { error: 'Not found' });
  }

  if (orgToken) {
    const { data } = await (supabase as any)
      .from('organizations')
      .select('name')
      .eq('invite_token', orgToken)
      .single();
    return NextResponse.json(data ?? { error: 'Not found' });
  }

  return NextResponse.json({ error: 'No token' }, { status: 400 });
}
```

- [ ] **Step 2: Add candidate branch to signup route**

In `web/app/api/auth/signup/route.ts`, update the destructure on line 11 to include `candidateToken` and `marketingConsent`:

```typescript
const { fullName, email, password, role, companyName, scenarioAccess, coachToken, orgToken, candidateToken, marketingConsent } = await req.json();
```

Then add the candidate token branch inside the resolve-invite-context block (after the `} else if (coachToken) {` block and before the direct TechRP signup block). Add this as a new `else if`:

```typescript
  } else if (candidateToken) {
    // Candidate signing up via personal invite link
    const { data: invite } = await (supabase as any)
      .from('candidate_invites')
      .select('id, email, organization_id, coach_instance_id, assigned_scenarios, status, expires_at')
      .eq('personal_token', candidateToken)
      .single();

    if (!invite || (invite as any).status !== 'pending') {
      await supabase.auth.admin.deleteUser(authUserId);
      return NextResponse.json({ error: 'Invalid or already-used invite link.' }, { status: 400 });
    }
    if ((invite as any).expires_at && new Date((invite as any).expires_at) < new Date()) {
      await supabase.auth.admin.deleteUser(authUserId);
      return NextResponse.json({ error: 'This invite link has expired.' }, { status: 400 });
    }

    organizationId = (invite as any).organization_id;
    resolvedCoachInstanceId = (invite as any).coach_instance_id;
    autoApprove = true; // candidates skip the approval queue

    // Compute session_limit and scenario_access from assigned_scenarios
    const assigned: { scenario_type: string; count: number }[] = (invite as any).assigned_scenarios ?? [];
    const sessionLimit = assigned.reduce((sum, s) => sum + s.count, 0);
    finalScenarioAccess = [...new Set(assigned.map(s => s.scenario_type))];

    // Insert user profile with candidate-specific fields
    const { error: candidateProfileError } = await (supabase as any).from('users').insert({
      auth_user_id: authUserId,
      organization_id: organizationId,
      coach_instance_id: resolvedCoachInstanceId,
      name: fullName,
      full_name: fullName,
      email: (invite as any).email, // use invite email, not form email
      role: 'technician',
      app_role: 'individual',
      status: 'approved',
      scenario_access: finalScenarioAccess,
      session_limit: sessionLimit,
      user_type: 'candidate',
      marketing_consent: marketingConsent ?? false,
      tos_accepted_at: new Date().toISOString(),
    });

    if (candidateProfileError) {
      await supabase.auth.admin.deleteUser(authUserId);
      console.error('Candidate profile insert error:', candidateProfileError);
      return NextResponse.json({ error: 'Failed to create candidate profile.' }, { status: 500 });
    }

    // Get new user's id to link invite
    const { data: newUser } = await (supabase as any)
      .from('users').select('id').eq('auth_user_id', authUserId).single();

    // Update invite to signed_up
    if (newUser) {
      await (supabase as any)
        .from('candidate_invites')
        .update({ status: 'signed_up', signed_up_user_id: (newUser as any).id })
        .eq('id', (invite as any).id);

      // Link user back to invite
      await (supabase as any)
        .from('users')
        .update({ candidate_invite_id: (invite as any).id })
        .eq('id', (newUser as any).id);

      // Notify company admin that candidate signed up
      await (supabase as any).from('notifications').insert({
        user_id: (invite as any).invited_by_user_id,
        type: 'candidate_signed_up',
        title: `${fullName} accepted your candidate invite`,
        body: 'They can now begin their assigned sessions.',
        data: { candidate_invite_id: (invite as any).id, candidate_user_id: (newUser as any).id },
      });
    }

    // Return early — skip the default profile insert below
    return NextResponse.json({ success: true, autoApproved: true });
  }
```

> **Note:** Because the candidate branch returns early, the default profile insert at step 3 in the original route is not reached. Make sure this `else if` is placed before the generic `role === 'company_admin'` block so it takes precedence.

- [ ] **Step 3: Verify build**

```bash
cd web && npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/auth/invite-info/route.ts web/app/api/auth/signup/route.ts
git commit -m "feat: extend invite-info and signup routes to handle candidate tokens"
```

---

## Task 9: Update AppUser Type + Auth Provider

**Files:**
- Modify: `web/components/auth-provider.tsx`

The `AppUser` interface needs `userType` so the UI can distinguish candidates from standard users.

- [ ] **Step 1: Add `userType` and `marketingConsent` to `AppUser` interface**

In `web/components/auth-provider.tsx`, update the `AppUser` interface (around line 10):

```typescript
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
  userType: 'standard' | 'candidate';
  marketingConsent: boolean;
}
```

- [ ] **Step 2: Extend the DB select and mapping**

Update the `.select(...)` call (around line 60) to include the new columns:

```typescript
    const { data: profile } = await (supabase as any)
      .from('users')
      .select('id, auth_user_id, email, name, full_name, app_role, status, scenario_access, coach_instance_id, organization_id, user_type, marketing_consent')
      .eq('auth_user_id', authUser.id)
      .single();
```

Update the `appUser` mapping (around line 70):

```typescript
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
      userType: ((profile as any).user_type ?? 'standard') as 'standard' | 'candidate',
      marketingConsent: (profile as any).marketing_consent ?? false,
    };
```

- [ ] **Step 3: Verify build**

```bash
cd web && npm run build 2>&1 | grep -E "error TS|Error" | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add web/components/auth-provider.tsx
git commit -m "feat: add userType and marketingConsent to AppUser"
```

---

## Task 10: Notification Bell Component

**Files:**
- Create: `web/components/notification-bell.tsx`
- Modify: `web/components/nav.tsx`

- [ ] **Step 1: Create `web/components/notification-bell.tsx`**

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  data?: { candidate_invite_id?: string; candidate_user_id?: string } | null;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    const res = await fetch('/api/notifications');
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications ?? []);
    setUnreadCount(data.unreadCount ?? 0);
  };

  useEffect(() => {
    fetchNotifications();
    // Refresh every 60 seconds
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH' });
    setNotifications(n => n.map(x => ({ ...x, read: true })));
    setUnreadCount(0);
  };

  const markOneRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    setNotifications(n => n.map(x => x.id === id ? { ...x, read: true } : x));
    setUnreadCount(c => Math.max(0, c - 1));
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
        className="relative p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Notifications"
      >
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 w-80 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-sm font-semibold text-white">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-8">No notifications yet</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-white/5">
              {notifications.map(n => (
                <li
                  key={n.id}
                  className={`px-4 py-3 cursor-pointer transition-colors hover:bg-white/5 ${!n.read ? 'bg-blue-500/5' : ''}`}
                  onClick={() => { markOneRead(n.id); }}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />}
                    <div className={!n.read ? '' : 'pl-3.5'}>
                      <p className="text-xs font-medium text-white leading-snug">{n.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{n.body}</p>
                      <p className="text-[10px] text-gray-600 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add NotificationBell to nav for company_admin users**

In `web/components/nav.tsx`, add the import at the top:

```typescript
import { NotificationBell } from '@/components/notification-bell';
```

In the `AppNav` return JSX, add `<NotificationBell />` inside the `<div className="flex items-center gap-3">` block, visible only to company_admin:

Replace the right-side div (around line 100):
```tsx
        <div className="flex items-center gap-3">
          {user?.role === 'company_admin' && <NotificationBell />}
          {user && (
            <Link
              href="/account"
              className="text-xs text-gray-500 hover:text-white transition-colors hidden sm:block"
            >
              {user.fullName || user.email}
            </Link>
          )}
          <button onClick={handleSignOut} className="text-xs text-gray-500 hover:text-white transition-colors">
            Sign out
          </button>
        </div>
```

- [ ] **Step 3: Verify build**

```bash
cd web && npm run build 2>&1 | grep -E "error TS|Error" | head -20
```

- [ ] **Step 4: Commit**

```bash
git add web/components/notification-bell.tsx web/components/nav.tsx
git commit -m "feat: add notification bell to nav for company admins"
```

---

## Task 11: Signup Page — Candidate Token Pre-fill + Marketing Consent

**Files:**
- Modify: `web/app/signup/page.tsx`

The signup page has three steps: Account → Modules → TOS. For candidates: email is locked, modules step is skipped (scenarios come from invite), a marketing consent checkbox is added to the TOS step.

- [ ] **Step 1: Add candidate token detection + state**

In `SignupPageInner`, after the `orgToken` line, add:

```typescript
  const candidateToken = searchParams.get('candidate');
```

Update the `lockedRole` to also lock candidates:
```typescript
  const lockedRole: 'individual' | 'company_admin' | null =
    orgToken ? 'individual' :
    candidateToken ? 'individual' :
    coachToken && typeParam !== 'individual' ? 'company_admin' :
    coachToken && typeParam === 'individual' ? 'individual' :
    null;
```

Add candidate state after the existing `useEffect` blocks:

```typescript
  const [candidateInfo, setCandidateInfo] = useState<{
    email: string; full_name: string | null; assigned_scenarios: { scenario_type: string; count: number }[]
  } | null>(null);
  const [candidateError, setCandidateError] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);

  useEffect(() => {
    if (!candidateToken) return;
    fetch(`/api/auth/invite-info?candidate=${candidateToken}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setCandidateError(d.error); return; }
        setCandidateInfo(d);
        setEmail(d.email);
        if (d.full_name) setFullName(d.full_name);
      });
  }, [candidateToken]);
```

- [ ] **Step 2: Lock email field and skip modules for candidates**

In `handleAccountNext`, add candidate skip condition alongside the existing org skip:

```typescript
  const handleAccountNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    // Skip module selection for org/candidate invites or company_admin signups
    if (role === 'individual' && !orgToken && !candidateToken) {
      setStep('modules');
    } else {
      setStep('tos');
    }
  };
```

In the account step JSX, make email read-only for candidates. Find the email input and replace it:

```tsx
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => !candidateToken && setEmail(e.target.value)}
                readOnly={!!candidateToken}
                required
                className={`w-full bg-gray-900 border rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${candidateToken ? 'opacity-60 cursor-not-allowed border-white/5' : 'border-white/10 hover:border-white/20'}`}
              />
```

- [ ] **Step 3: Add marketing consent checkbox to TOS step**

Find the TOS step JSX (the `step === 'tos'` block). Add the marketing consent checkbox after the TOS acceptance checkbox:

```tsx
                {/* Marketing consent — optional */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={e => setMarketingConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-gray-900 shrink-0"
                  />
                  <span className="text-xs text-gray-400 leading-relaxed">
                    I'd like to receive tips, updates, and offers from TechRP by email. You can unsubscribe at any time.
                  </span>
                </label>
```

- [ ] **Step 4: Pass candidateToken and marketingConsent to signup API**

In `handleSubmit`, update the fetch body:

```typescript
        body: JSON.stringify({
          fullName,
          email,
          password,
          role,
          companyName: role === 'company_admin' ? companyName : undefined,
          scenarioAccess: orgToken || candidateToken ? [] : role === 'individual' ? selectedModules : ['technician', 'property_manager', 'insurance', 'plumber_bd'],
          coachToken: coachToken ?? undefined,
          orgToken:   orgToken   ?? undefined,
          candidateToken: candidateToken ?? undefined,
          marketingConsent,
        }),
```

- [ ] **Step 5: Show candidate error if invalid token**

At the top of the `SignupPageInner` return, add an early return for invalid candidate tokens:

```tsx
  if (candidateToken && candidateError) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="text-3xl">⚠️</div>
          <h1 className="text-xl font-bold">Invalid Invite Link</h1>
          <p className="text-gray-400 text-sm">{candidateError}</p>
        </div>
      </div>
    );
  }
```

- [ ] **Step 6: Verify build**

```bash
cd web && npm run build 2>&1 | grep -E "error TS|Error" | head -20
```

- [ ] **Step 7: Commit**

```bash
git add web/app/signup/page.tsx
git commit -m "feat: extend signup page for candidate tokens — pre-fill email, marketing consent"
```

---

## Task 12: Team Page — Candidates Tab + Module Assignment

**Files:**
- Modify: `web/app/team/page.tsx`

The team page needs two tabs: Employees (existing content + module assignment) and Candidates (new).

- [ ] **Step 1: Replace the full team page**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { AppNav } from '@/components/nav';
import { useRouter } from 'next/navigation';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

const SCENARIO_OPTIONS = [
  { id: 'technician', label: 'Technician' },
  { id: 'property_manager', label: 'Property Manager' },
  { id: 'insurance', label: 'Insurance Broker' },
  { id: 'plumber_bd', label: 'Plumber BD' },
];

interface TeamMember {
  id: string; full_name: string; email: string; status: string;
  created_at: string; sessionCount: number; scenario_access: string[];
}

interface AssignedScenario { scenario_type: string; count: number; }

interface CandidateInvite {
  id: string; email: string; full_name: string | null; status: string;
  created_at: string; invite_url: string;
  progress: { sessionsComplete: number; sessionsTotal: number };
  assigned_scenarios: AssignedScenario[];
}

type Tab = 'employees' | 'candidates';

export default function TeamPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('employees');

  // Employees state
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [orgInviteToken, setOrgInviteToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [editingModules, setEditingModules] = useState<string | null>(null); // member id
  const [modulesDraft, setModulesDraft] = useState<string[]>([]);

  // Candidates state
  const [candidates, setCandidates] = useState<CandidateInvite[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteScenarios, setInviteScenarios] = useState<AssignedScenario[]>([
    { scenario_type: 'technician', count: 1 }
  ]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [newInviteUrl, setNewInviteUrl] = useState('');
  const [copiedInvite, setCopiedInvite] = useState('');

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'company_admin' || !user.coachInstanceId) {
      router.replace('/');
    }
  }, [user, router]);

  useEffect(() => {
    if (!user?.organizationId) return;
    Promise.all([
      fetch('/api/team/members').then(r => r.json()),
      fetch('/api/team/candidates').then(r => r.json()),
    ]).then(([membersData, candidatesData]) => {
      setMembers(membersData.members ?? []);
      setOrgInviteToken(membersData.inviteToken ?? '');
      setCandidates(candidatesData.candidates ?? []);
      setLoading(false);
    });
  }, [user]);

  const copyInvite = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedInvite(key);
    setTimeout(() => setCopiedInvite(''), 2000);
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

  const saveModules = async (memberId: string) => {
    await fetch(`/api/team/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_access: modulesDraft }),
    });
    setMembers(m => m.map(x => x.id === memberId ? { ...x, scenario_access: modulesDraft } : x));
    setEditingModules(null);
  };

  const addInviteScenario = () =>
    setInviteScenarios(s => [...s, { scenario_type: 'technician', count: 1 }]);

  const removeInviteScenario = (i: number) =>
    setInviteScenarios(s => s.filter((_, idx) => idx !== i));

  const updateInviteScenario = (i: number, field: keyof AssignedScenario, value: string | number) =>
    setInviteScenarios(s => s.map((x, idx) => idx === i ? { ...x, [field]: value } : x));

  const sendInvite = async () => {
    setInviteError('');
    if (!inviteEmail) { setInviteError('Email is required.'); return; }
    setInviteLoading(true);
    const res = await fetch('/api/team/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: inviteEmail,
        full_name: inviteName || undefined,
        assigned_scenarios: inviteScenarios,
      }),
    });
    const data = await res.json();
    setInviteLoading(false);
    if (!res.ok) { setInviteError(data.error ?? 'Failed to create invite.'); return; }
    setNewInviteUrl(data.invite.invite_url);
    setCandidates(c => [data.invite, ...c]);
  };

  const revokeInvite = async (id: string) => {
    if (!confirm('Revoke this invite?')) return;
    await fetch(`/api/team/candidates/${id}`, { method: 'DELETE' });
    setCandidates(c => c.filter(x => x.id !== id));
  };

  const sendUpgradeEmail = async (id: string) => {
    await fetch(`/api/team/candidates/${id}/upgrade-email`, { method: 'POST' });
    alert('Upgrade email sent!');
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-400',
      signed_up: 'bg-blue-500/10 text-blue-400',
      in_progress: 'bg-purple-500/10 text-purple-400',
      complete: 'bg-green-500/10 text-green-400',
      upgraded: 'bg-gray-500/10 text-gray-400',
      approved: 'bg-green-500/10 text-green-400',
      rejected: 'bg-red-500/10 text-red-400',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[status] ?? 'bg-gray-500/10 text-gray-400'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AppNav />
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">My Team</h1>
          {tab === 'employees' && orgInviteToken && (
            <div className="flex items-center gap-2">
              <code className="text-xs text-gray-400 bg-gray-900 border border-white/10 rounded-lg px-3 py-2 truncate max-w-xs">
                {APP_URL}/signup?org={orgInviteToken}
              </code>
              <button
                onClick={() => copyInvite(`${APP_URL}/signup?org=${orgInviteToken}`, 'org')}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                {copiedInvite === 'org' ? 'Copied!' : 'Copy invite'}
              </button>
            </div>
          )}
          {tab === 'candidates' && (
            <button
              onClick={() => { setShowInviteModal(true); setNewInviteUrl(''); setInviteEmail(''); setInviteName(''); setInviteScenarios([{ scenario_type: 'technician', count: 1 }]); setInviteError(''); }}
              className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              + Invite Candidate
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/10 pb-0">
          {(['employees', 'candidates'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors capitalize ${tab === t ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500 py-20 text-center">Loading…</p>
        ) : tab === 'employees' ? (
          // ── Employees Tab ───────────────────────────────────────────────
          members.length === 0 ? (
            <p className="text-gray-500 py-20 text-center text-sm">No team members yet. Share your invite link above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-white/10">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Sessions</th>
                    <th className="pb-3 font-medium">Modules</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {members.map(m => (
                    <tr key={m.id} className="group">
                      <td className="py-3 text-white">{m.full_name}</td>
                      <td className="py-3 text-gray-400">{m.email}</td>
                      <td className="py-3">{statusBadge(m.status)}</td>
                      <td className="py-3 text-gray-400">{m.sessionCount}</td>
                      <td className="py-3">
                        {editingModules === m.id ? (
                          <div className="flex flex-col gap-1">
                            {SCENARIO_OPTIONS.map(opt => (
                              <label key={opt.id} className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={modulesDraft.includes(opt.id)}
                                  onChange={e => setModulesDraft(d =>
                                    e.target.checked ? [...d, opt.id] : d.filter(x => x !== opt.id)
                                  )}
                                  className="w-3 h-3 rounded"
                                />
                                {opt.label}
                              </label>
                            ))}
                            <div className="flex gap-2 mt-1">
                              <button onClick={() => saveModules(m.id)} className="text-xs text-blue-400 hover:text-blue-300">Save</button>
                              <button onClick={() => setEditingModules(null)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 flex-wrap">
                            {(m.scenario_access ?? []).length === 0
                              ? <span className="text-xs text-gray-600">None</span>
                              : (m.scenario_access ?? []).map(s => (
                                <span key={s} className="text-[10px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded">
                                  {SCENARIO_OPTIONS.find(o => o.id === s)?.label ?? s}
                                </span>
                              ))
                            }
                            <button
                              onClick={() => { setEditingModules(m.id); setModulesDraft(m.scenario_access ?? []); }}
                              className="text-[10px] text-gray-600 hover:text-blue-400 transition-colors ml-1"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {m.status !== 'rejected' && (
                          <button
                            onClick={() => deactivate(m.id)}
                            className="text-xs text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          // ── Candidates Tab ──────────────────────────────────────────────
          candidates.length === 0 ? (
            <p className="text-gray-500 py-20 text-center text-sm">No candidates yet. Click "Invite Candidate" to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-white/10">
                    <th className="pb-3 font-medium">Name / Email</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Progress</th>
                    <th className="pb-3 font-medium">Invited</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {candidates.map(c => (
                    <tr key={c.id}>
                      <td className="py-3">
                        <p className="text-white font-medium">{c.full_name ?? '—'}</p>
                        <p className="text-gray-500 text-xs">{c.email}</p>
                      </td>
                      <td className="py-3">{statusBadge(c.status)}</td>
                      <td className="py-3 text-gray-400 text-xs">
                        {c.progress.sessionsComplete} / {c.progress.sessionsTotal} sessions
                      </td>
                      <td className="py-3 text-gray-500 text-xs">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2 flex-wrap">
                          {c.status === 'pending' && (
                            <>
                              <button
                                onClick={() => copyInvite(c.invite_url, c.id)}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                {copiedInvite === c.id ? 'Copied!' : 'Copy link'}
                              </button>
                              <button
                                onClick={() => revokeInvite(c.id)}
                                className="text-xs text-red-500 hover:text-red-400 transition-colors"
                              >
                                Revoke
                              </button>
                            </>
                          )}
                          {(c.status === 'signed_up' || c.status === 'in_progress') && (
                            <a href="/sessions" className="text-xs text-gray-400 hover:text-white transition-colors">
                              View sessions
                            </a>
                          )}
                          {c.status === 'complete' && (
                            <>
                              <a href="/sessions" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                                View results
                              </a>
                              <button
                                onClick={() => sendUpgradeEmail(c.id)}
                                className="text-xs text-green-400 hover:text-green-300 transition-colors"
                              >
                                Send upgrade email
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Invite Candidate</h2>

            {newInviteUrl ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">Invite created! Share this link with your candidate:</p>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs text-gray-300 bg-gray-800 border border-white/10 rounded-lg px-3 py-2 break-all">
                    {newInviteUrl}
                  </code>
                  <button
                    onClick={() => copyInvite(newInviteUrl, 'modal')}
                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg whitespace-nowrap"
                  >
                    {copiedInvite === 'modal' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="w-full text-sm text-gray-400 hover:text-white border border-white/10 rounded-xl py-2 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Candidate email *</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="candidate@email.com"
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name (optional)</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={e => setInviteName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-2">Assigned sessions *</label>
                  <div className="space-y-2">
                    {inviteScenarios.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <select
                          value={s.scenario_type}
                          onChange={e => updateInviteScenario(i, 'scenario_type', e.target.value)}
                          className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                        >
                          {SCENARIO_OPTIONS.map(o => (
                            <option key={o.id} value={o.id}>{o.label}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={s.count}
                          onChange={e => updateInviteScenario(i, 'count', parseInt(e.target.value) || 1)}
                          className="w-16 bg-gray-800 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none"
                        />
                        {inviteScenarios.length > 1 && (
                          <button onClick={() => removeInviteScenario(i)} className="text-gray-600 hover:text-red-400 text-sm">×</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addInviteScenario}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    + Add scenario
                  </button>
                </div>

                {inviteError && <p className="text-red-400 text-xs">{inviteError}</p>}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 text-sm text-gray-400 hover:text-white border border-white/10 rounded-xl py-2 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendInvite}
                    disabled={inviteLoading}
                    className="flex-1 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-xl py-2 transition-colors"
                  >
                    {inviteLoading ? 'Creating…' : 'Create Invite'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd web && npm run build 2>&1 | grep -E "error TS|Error" | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add web/app/team/page.tsx
git commit -m "feat: add Candidates tab and module assignment to team page"
```

---

## Task 13: Final Build Check, Lint, and Push

- [ ] **Step 1: Full build + lint**

```bash
cd web && npm run lint 2>&1 | head -40
cd web && npm run build 2>&1 | tail -30
```

Expected: lint warnings OK, build succeeds with no errors.

- [ ] **Step 2: Smoke test the candidate invite flow manually**

1. Log in as a company admin at `localhost:3000`
2. Go to `/team` → Candidates tab → "Invite Candidate"
3. Enter an email, name, 2x Technician → Create Invite → copy the link
4. Open the link in an incognito window → verify email is pre-filled and locked
5. Complete signup → verify redirect to training
6. Log back in as admin → Candidates tab → should show "Signed Up" status

- [ ] **Step 3: Smoke test notifications**

1. As a candidate, complete a session via `/api/sessions` POST (or wait for a real session)
2. Log in as company admin → bell icon should show unread count
3. Click bell → notification "... completed their assessment" should appear

- [ ] **Step 4: Push to GitHub**

```bash
git push origin claude/awesome-chatelet
```

- [ ] **Step 5: Confirm TODO items complete and update TODO.md**

Mark these complete in `TODO.md`:
- `[x] SQL: Add RLS policy so company admins can view users in their org without infinite recursion`
- `[x] Admin panel: assign/edit modules per team member`
- `[x] Candidate invites: auto-suspend account when sessions_used >= session_limit`
- `[x] Candidate invites: "Send Upgrade Email"`
- `[x] Candidate upgrade: pre-fill email on signup page from invite link`

```bash
git add TODO.md
git commit -m "docs: mark candidate invite TODO items complete"
git push origin claude/awesome-chatelet
```
