# Auth + Coach Role + Infrastructure Design
**Date:** 2026-04-03
**Status:** Approved

---

## Overview

Extend the existing `individual` / `company_admin` auth system with a `coach` tier, wire up real user IDs throughout the app, enforce role-based access, and add error monitoring + analytics + UI polish.

---

## Section 1: Database Schema

### Modify `users.app_role`
Add `'coach'` to the CHECK constraint:
```sql
CHECK (app_role IN ('individual', 'company_admin', 'coach'))
```

### Add `users.coach_instance_id`
```sql
ALTER TABLE users ADD COLUMN coach_instance_id UUID REFERENCES coach_instances(id);
```
Nullable. Links any user to the coach whose invite link they used. Null = direct TechRP user.

### Add `users.organization_id`
```sql
ALTER TABLE users ADD COLUMN organization_id UUID REFERENCES organizations(id);
```
Nullable. Links individuals to the company admin's organization.

### New `coach_instances` table
```sql
CREATE TABLE coach_instances (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id           UUID NOT NULL REFERENCES users(id),
  name                    TEXT NOT NULL,
  invite_token            TEXT NOT NULL UNIQUE,
  global_playbooks_enabled BOOLEAN NOT NULL DEFAULT false,
  global_personas_enabled  BOOLEAN NOT NULL DEFAULT false,
  auto_approve_users       BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Modify `organizations`
```sql
ALTER TABLE organizations
  ADD COLUMN coach_instance_id UUID REFERENCES coach_instances(id),
  ADD COLUMN invite_token TEXT UNIQUE;
```
`coach_instance_id` links the org to a coach's instance. `invite_token` is used in `/signup?org=TOKEN` URLs for company admins to invite their team.

### Modify `playbooks` and `personas`
```sql
ALTER TABLE playbooks ADD COLUMN coach_instance_id UUID REFERENCES coach_instances(id);
ALTER TABLE personas  ADD COLUMN coach_instance_id UUID REFERENCES coach_instances(id);
```
Null = global TechRP content. Non-null = belongs to that coach's instance.

### Content isolation query pattern
```sql
-- For a user with coach_instance_id and that instance's settings:
WHERE coach_instance_id = :userCoachInstanceId
   OR (coach_instance_id IS NULL AND :globalEnabled = true)
```

---

## Section 2: Tim's Admin Interface (`/admin`)

### Auth
Protected by middleware checking `?key=ADMIN_SECRET` query param (env var). Completely separate from Supabase auth — always accessible to Tim regardless of auth state.

### UI
Single page at `/admin`:
- Table of all coaches: name, email, instance name, user count, created date, active/deactivated status
- **Create Coach** modal: full name, email, coach/practice name
- **Deactivate** button per row (sets `users.status = 'rejected'`)

### Create Coach flow (`POST /api/admin/coaches`)
1. Create Supabase auth user via admin API
2. Send Supabase magic link email so coach sets their own password
3. Insert `users` row: `app_role = 'coach'`, `status = 'approved'` (no pending state)
4. Insert `coach_instances` row with a generated `invite_token` (nanoid, 12 chars)
5. Return the coach dashboard URL to Tim

---

## Section 3: Coach Dashboard (`/coach`)

Accessible only to `app_role = 'coach'`.

### Invite Link panel
- Displays full signup URL: `{BASE_URL}/signup?coach={invite_token}`
- One-click copy button
- **Auto-approve toggle**: "Auto-approve new signups" (on/off) — updates `coach_instances.auto_approve_users`

### Client Companies panel
- Table: company name, admin name/email, individual count, avg score
- **Add Client Company** button → modal: enter company name → creates `organizations` row linked to `coach_instance_id` + generates org `invite_token` → shows company admin invite URL: `/signup?coach={token}&org={orgToken}`
- Each row has a deactivate option

### Users panel
- Table of all users in instance (across all orgs + standalone): name, role, org, join date, session count, avg score
- Deactivate per user

### Content panel
**Their playbooks** — list with scenario type badge, edit/delete. "Add Playbook" opens existing wizard.
**Global content toggles** — "Include TechRP default playbooks" / "Include TechRP default personas" — two switches mapping to `global_playbooks_enabled` / `global_personas_enabled`.

### Playbook upload → AI persona generation
On playbook save:
1. Call Claude API with playbook title + content
2. Claude returns suggested `ScenarioType[]` mappings
3. Coach sees a confirmation: "This playbook maps to: [Homeowner Inbound, Property Manager]. Seed personas for these scenarios?"
4. On confirm: seed relevant personas tagged to `coach_instance_id` (reuse existing persona seed logic)

---

## Section 4: Signup Flow Updates

The existing `/signup` page is extended to handle four entry points via URL params.

### `/signup?coach=TOKEN` — Coach inviting a company admin
- Look up `coach_instances` by token; show "You're joining [Coach Name]'s training program"
- Role locked to `company_admin`, no role picker
- Skips module selection (gets all modules)
- On submit: create user + org linked to `coach_instance_id`, generate org's `invite_token`
- Approval: if `auto_approve_users = true` → instant access; if false → coach gets the approval email (new Resend template sent to coach's email, not Tim's). Approve/reject links call `/api/auth/approve` with the coach's identity verified via the same `APPROVAL_SECRET` pattern.

### `/signup?coach=TOKEN&org=ORG_TOKEN` — Coach inviting a company admin to a specific org
- Same as above but org is pre-created by coach via "Add Client Company"; user is linked directly to that org

### `/signup?org=TOKEN` — Company admin inviting their team (individuals)
- Look up `organizations` by `invite_token`; show "You're joining [Company Name]"
- Role locked to `individual`
- No module selection — system copies `scenario_access` from the org's company admin at signup time
- On submit: create user linked to `organization_id` + org's `coach_instance_id`
- Approval: inherits the coach instance's `auto_approve_users` setting (coach approves if manual)

### `/signup?coach=TOKEN&type=individual` — Coach inviting a standalone individual
- Role locked to `individual`, no org created
- Normal module selection step shown
- Same approval logic as coach invite (`auto_approve_users` determines instant vs coach-approved)

### Plain `/signup` — Direct TechRP users (unchanged)
- Role picker shown, Tim approves via existing flow

---

## Section 5: Role-Based Nav & UI

`AppUser` type gains `coachInstanceId?: string` and `organizationId?: string`.

### Nav visibility by role
| Role | Visible nav items |
|---|---|
| `individual` | Train, Sessions, Upload |
| `company_admin` (direct) | Train, Sessions, Upload, Playbooks, Personas |
| `company_admin` (under coach) | Train, Sessions, Upload, Playbooks, Team |
| `coach` | Dashboard, Playbooks, Personas |
| pending/rejected | None (status page only) |

Tim's `/admin` is not in the main nav — accessed directly by URL.

### Team panel (company admins under a coach)
- `/team` route — list of invited individuals: name, email, join date, session count, avg score
- Invite link display (their org's `?org=TOKEN` URL) with copy button
- Deactivate per member

### Playbooks for individuals
Individuals can't browse `/playbooks` but the active playbook is fetched at assessment time — no change to that flow.

---

## Section 6: Content Isolation & Remaining Auth Gaps

### Content isolation
Enforced at API/query layer. All queries for playbooks and personas check:
- If user has `coach_instance_id`: filter to coach's content + global if enabled
- If no `coach_instance_id`: show global TechRP content only

Assessment (`/api/assess`): fetches playbook scoped to user's coach instance first, falls back to global.

### Scenario access enforcement
Training page filters scenario picker to `user.scenario_access` array. Users without a matching scenario are shown a locked state with a "Contact your admin" message.

### Real user ID wiring
Replace all `PLACEHOLDER_USER_ID` and `PLACEHOLDER_ORGANIZATION_ID` constants in:
- `web/app/training/page.tsx`
- `web/app/api/recordings/upload/route.ts`
- `web/app/api/insights/route.ts`

Use `AuthProvider` context to get `user.id` and `user.organizationId`.

### Rejected user UI
`/pending` currently shows the same message for `pending` and `rejected` status. Add branch:
- `pending`: existing hourglass + "Your account is pending approval" message + Resend email button (wired to existing `/api/auth/resend-approval`)
- `rejected`: clear "Your application was not approved" message + contact link (`mailto:tim@blueoardesigns.com`)

---

## Section 7: Infrastructure Items

### Loading skeletons
Replace `"Loading…"` text on sessions and playbooks pages with `animate-pulse` skeleton cards matching the actual card/row layout. No new dependencies.

### Mobile-responsive admin panel
Sessions list uses `grid-cols-12` (breaks on mobile). Replace with stacked card layout below `md` breakpoint using Tailwind responsive prefixes. Same treatment for playbooks list.

### Error monitoring (Sentry)
Install `@sentry/nextjs`. Run `npx @sentry/wizard@latest -i nextjs` to scaffold config. Captures both client and server errors. Email notification on first occurrence of each new issue type. Dashboard at sentry.io.

### Analytics
No third-party tool. Extend existing `/api/insights` route and build a simple `/insights` dashboard page using data already in Supabase:
- Session counts over time
- Avg score by scenario type
- Active users (sessions in last 30 days)
- Conversion: signups → first session

### Supabase MCP
Verification step only — confirm project-scoped MCP config is working in Claude Code settings. No code changes.

---

## What's Not In This Build

- Per-playbook/per-persona content toggle for coaches (instance-level toggles only for now)
- Session limit enforcement / auto-suspend
- Password reset flow
- Email verification re-enable
- Account Settings (name/email edit)
- RLS on `training_sessions` and `playbooks` (unblocked after this build — tackle next)
- Billing/Stripe
- Mobile app (Expo/Vapi)
- Certificate generation
- Candidate one-time invite links
