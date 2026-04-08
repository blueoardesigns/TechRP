# Candidate Invites & Company Admin Enhancements — Design Spec

**Date:** 2026-04-07  
**Status:** Approved  
**Scope:** RLS fix, module assignment per team member, full candidate invite lifecycle

---

## 1. Overview

Company admins can invite potential hires (candidates) via a personal one-time link. Admins assign specific scenario types with per-type counts (e.g. 2x Plumber Cold Call, 2x Plumber Discovery). Candidates sign up through a guided flow, complete their sessions, and are auto-suspended on completion. The admin is notified via email and in-app badge. Complete candidates can be upgraded to full accounts.

This spec also covers:
- RLS fix for company admin user queries (infinite recursion)
- Scenario access (module) assignment per team member in the admin panel

---

## 2. Database Schema

### 2.1 New table: `candidate_invites`

```sql
CREATE TABLE candidate_invites (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 TEXT NOT NULL,
  full_name             TEXT,
  personal_token        TEXT UNIQUE NOT NULL,  -- random hex, used in invite link
  invited_by_user_id    UUID NOT NULL REFERENCES users(id),
  organization_id       UUID NOT NULL REFERENCES organizations(id),
  coach_instance_id     UUID REFERENCES coach_instances(id),
  assigned_scenarios    JSONB NOT NULL,  -- [{scenario_type: string, count: number}]
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','signed_up','in_progress','complete','upgraded')),
  signed_up_user_id     UUID REFERENCES users(id),        -- set on candidate signup
  notification_sent_at  TIMESTAMPTZ,                      -- dedup completion notification
  expires_at            TIMESTAMPTZ,                      -- optional, e.g. 30 days from created_at
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email, organization_id)
);
```

### 2.2 New table: `notifications`

```sql
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),  -- recipient (company admin)
  type        TEXT NOT NULL,                        -- 'candidate_complete' | 'candidate_signed_up'
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB,                                -- {candidate_invite_id, candidate_user_id}
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread ON notifications(user_id, read) WHERE read = false;
```

### 2.3 Changes to `users`

```sql
ALTER TABLE users
  ADD COLUMN user_type TEXT NOT NULL DEFAULT 'standard'
    CHECK (user_type IN ('standard', 'candidate')),
  ADD COLUMN candidate_invite_id UUID REFERENCES candidate_invites(id);
```

### 2.4 RLS Fix — `SECURITY DEFINER` function

To let company admins query users in their org without triggering infinite recursion in RLS policies:

```sql
-- Single SECURITY DEFINER function: checks if the current auth user is a company_admin
-- belonging to the given org. Runs as function owner, bypassing RLS — breaks the recursion.
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

-- RLS policy on users table (replace any existing recursive policy):
CREATE POLICY "company_admin_view_org_users"
ON users
FOR SELECT
USING (
  is_company_admin_of_org(organization_id)
);
```

> Note: Both the role check and org check live inside `SECURITY DEFINER`, so no part of the policy queries `users` directly — the recursion is fully avoided.

---

## 3. API Routes

### 3.1 New routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/team/candidates` | Create candidate invite |
| `GET` | `/api/team/candidates` | List candidates for org with derived progress |
| `DELETE` | `/api/team/candidates/[id]` | Revoke invite |
| `POST` | `/api/team/candidates/[id]/upgrade-email` | Send upgrade email to complete candidate |
| `GET` | `/api/notifications` | List notifications for current user |
| `PATCH` | `/api/notifications/[id]/read` | Mark one notification read |
| `PATCH` | `/api/notifications/read-all` | Mark all notifications read |
| `POST` | `/api/auth/upgrade` | Upgrade candidate to full account (called from `/upgrade` page) |

### 3.2 Modified routes

**`GET /api/auth/invite-info`** — extend to accept `?candidate=TOKEN`:
- Looks up `candidate_invites.personal_token`
- Returns `{ email, full_name, assigned_scenarios, expires_at }`

**`POST /api/auth/signup`** — extend to handle `?candidate=TOKEN`:
- Looks up invite by `personal_token`
- Validates invite is `status='pending'` and not expired
- Creates user with:
  - `email` from invite (locked)
  - `user_type = 'candidate'`
  - `app_role = 'individual'`
  - `organization_id` from invite
  - `coach_instance_id` from invite
  - `scenario_access` = unique scenario types from `assigned_scenarios`
  - `session_limit` = sum of all counts in `assigned_scenarios`
  - `candidate_invite_id` = invite id
  - `status = 'approved'` (candidates skip approval flow)
- Updates invite: `signed_up_user_id = user.id`, `status = 'signed_up'`
- Creates `candidate_signed_up` notification for the company admin

**`PATCH /api/team/members/[memberId]`** — extend to accept `scenario_access: string[]`:
- Company admin can update scenario access for any member in their org
- Validates all scenario types against `ScenarioType` enum

**`POST /api/assess` (or session save endpoint)** — add completion check after saving session:
- If `user.user_type === 'candidate'`, run completion check (see §5)

### 3.3 `POST /api/team/candidates` request body

```ts
{
  email: string            // required
  full_name?: string       // optional
  assigned_scenarios: {    // at least one entry
    scenario_type: ScenarioType
    count: number          // >= 1
  }[]
  expires_in_days?: number // default: 30
}
```

Response: full invite record including `personal_token` (for constructing invite URL client-side).

---

## 4. Candidate Experience

### 4.1 Signup via invite link (`/signup?candidate=TOKEN`)

- On page load: `GET /api/auth/invite-info?candidate=TOKEN`
- Email field pre-filled and read-only
- Name field pre-filled if provided, editable
- Role selector hidden (locked to `individual`)
- Consent section (required):
  - Recording consent
  - AI analysis via third-party services (Vapi, Anthropic)
- Marketing opt-in (optional):
  - "I'd like to receive tips, updates and offers from TechRP by email"
- Standard password fields
- On submit: `POST /api/auth/signup` with `candidate=TOKEN` param

### 4.2 Candidate dashboard — guided experience (mobile)

**First visit — tutorial overlay** (dismissible, shown once per account):
- Step 1: "Welcome to your candidate assessment"
- Step 2: "You've been assigned [N] sessions to complete"
- Step 3: "Each session is a voice roleplay — you'll speak with an AI persona"
- Step 4: "After each call, AI grades your performance"
- Step 5: "Complete all sessions to finish your assessment"

**Home screen — progress panel:**
```
Your Assessment Progress
─────────────────────────────────────
Plumber Cold Call       ●●○○  2 / 4
Plumber Discovery       ○○○○  0 / 4
─────────────────────────────────────
Total: 2 of 8 sessions complete
```

- Scenario picker filtered to assigned types only
- Completed quotas shown as greyed-out / checkmarked
- After final session: "Assessment complete! Your results have been sent to [Company Name]."

---

## 5. Completion Detection

Triggered after every session is saved for a candidate user:

```ts
async function checkCandidateCompletion(userId: string) {
  const user = await getUser(userId)
  if (user.user_type !== 'candidate' || !user.candidate_invite_id) return

  const invite = await getCandidateInvite(user.candidate_invite_id)
  if (invite.notification_sent_at) return  // already notified

  // Count completed sessions per scenario type
  const sessionCounts = await getSessionCountsByScenario(userId)

  const allComplete = invite.assigned_scenarios.every(
    ({ scenario_type, count }) => (sessionCounts[scenario_type] ?? 0) >= count
  )

  if (!allComplete) {
    // Update invite status to in_progress if not already
    if (invite.status === 'signed_up') {
      await updateInviteStatus(invite.id, 'in_progress')
    }
    return
  }

  // All quotas met — fire completion
  await Promise.all([
    updateInviteStatus(invite.id, 'complete'),
    updateInviteNotificationSent(invite.id),
    suspendUser(userId),
    createNotification(invite.invited_by_user_id, {
      type: 'candidate_complete',
      title: `${user.full_name} completed their assessment`,
      body: `View their session results in the Candidates tab.`,
      data: { candidate_invite_id: invite.id, candidate_user_id: userId }
    }),
    sendCompletionEmail(invite)  // Resend email to company admin
  ])
}
```

---

## 6. Company Admin Experience

### 6.1 Team page — two tabs

**Employees tab** (existing, enhanced):
- Existing member list
- Each row gains a "Modules" column: chip list of assigned scenario types
- Edit icon opens a multi-select dropdown of all `ScenarioType` values
- Saved via `PATCH /api/team/members/[memberId]` with `{ scenario_access: [...] }`

**Candidates tab** (new):

| Column | Notes |
|--------|-------|
| Name / Email | |
| Status | Badge: Pending · Signed Up · In Progress · Complete · Upgraded |
| Progress | e.g. "3 / 4 sessions" |
| Invited | Date |
| Actions | View Sessions · Send Upgrade Email · Revoke |

- "Invite Candidate" button → modal:
  - Email (required), Name (optional)
  - "+ Add Scenario" rows: scenario type dropdown + count number input
  - Generates invite, displays copyable link: `/signup?candidate=TOKEN`

### 6.2 Candidate session results

Accessible from "View Sessions" action on candidate row. Reuses existing session detail view — transcript, assessment scores, audio player. No new UI component needed beyond the navigation entry point.

### 6.3 Upgrade email

Admin clicks "Send Upgrade Email" on a complete candidate:
- `POST /api/team/candidates/[id]/upgrade-email`
- Sends Resend email to candidate: "You've been invited to create a full TechRP account"
- Link: `/upgrade?token=TOKEN` (same personal token, separate from signup)
- That page (`/upgrade`) is not a signup — candidates already have an account. It shows a simple confirmation screen: "Welcome back, [Name]. Click below to activate your full account." One button triggers `POST /api/auth/upgrade` which:
  - Sets `user_type → 'standard'`
  - Clears `session_limit`
  - Sets `status → 'approved'`
  - Sets invite `status → 'upgraded'`
- Candidate is then redirected to the regular dashboard

---

## 7. Notification Bell (In-App)

**Nav header:** bell icon with red unread count badge (hidden when 0).

**Dropdown panel** (click bell):
- Lists recent notifications, newest first
- Each row: icon + title + relative timestamp + link to relevant page
- "Mark all read" button at top right
- Unread rows highlighted

**API:** notifications fetched on app load and after each session save (lightweight poll or revalidation). Count derived from `GET /api/notifications` response.

---

## 8. Email Notifications (Resend)

| Trigger | Recipient | Subject |
|---------|-----------|---------|
| Candidate signs up | Company admin | "[Name] accepted your candidate invite" |
| Candidate completes all sessions | Company admin | "[Name] completed their assessment — view results" |
| Admin sends upgrade email | Candidate | "You've been invited to create a full TechRP account" |

All emails use existing Resend integration. No new email infrastructure needed.

---

## 9. Scope Boundaries

**In scope:**
- All items above
- `email_consent` captured on candidate signup (same as regular flow)

**Out of scope (deferred):**
- Invite expiry enforcement UI (DB column exists but no banner/error flow built yet)
- Bulk CSV invite upload
- Candidate-to-candidate comparison views
- Per-playbook/per-persona content toggles for coaches (separate backlog item)
- Certificate generation (separate backlog item)
