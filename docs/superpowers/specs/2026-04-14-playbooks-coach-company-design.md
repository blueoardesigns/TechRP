# TechRP — Playbooks, Coach-Company Connections & PDF Playbook Builder
**Date:** 2026-04-14  
**Status:** Approved, ready for implementation

---

## Scope

Seven related features across four clusters:

1. **Persona timing behavior** — AI personas wrap calls at 7.5 min, hard stop at 10 min via Vapi
2. **Persona interruptions** — Global interruption baseline + per-persona tuning
3. **PDF/Doc → AI Chat → Playbook** — Coach uploads a document, Claude asks questions, generates playbook
4. **Per-company playbook visibility** — Coaches control which playbooks each connected company sees
5. **Company–coach connections** — Companies can invite consulting coaches with scoped permissions
6. **Coach email approval** — Coaches approve/decline company access requests via email
7. **Connection removal** — Both parties can disconnect

---

## Section 1: Persona Timing & Interruptions

### Timing (Item 1)

**Scope:** Persona behavior only — no scoring changes.

**Persona system_prompt additions** (all personas in `web/lib/all-personas.ts`):
- Instruct the persona to naturally steer toward close or next step around the 7–8 minute mark (e.g. "you're a busy person, you need to wrap up")
- If momentum is strong at that point, push for commitment — agree to sign or schedule a follow-up rather than just ending neutrally
- Never let the call drag past 10 minutes regardless of where the conversation stands

**Vapi hard cap:**
- `maxDurationSeconds: 600` added to the `sharedOverrides` object in `web/app/training/page.tsx` (lines ~294–302)
- This is a Vapi-native failsafe — call ends at exactly 10 minutes independent of AI judgment
- No playbook scoring rubric changes

### Interruptions (Item 2)

**Global Vapi baseline:**
- `interruptionsEnabled: true` added to the `sharedOverrides` object in `web/app/training/page.tsx`
- Currently unset (defaults off); this enables the baseline for all personas

**Per-persona system_prompt tuning:**
- Skeptical/frustrated personalities: explicit cut-in instructions ("If the technician rambles, cut in with 'Hold on—' or 'Wait' mid-sentence")
- Busy/dismissive personalities: redirect instructions when technician doesn't get to the point quickly
- Agreeable personalities: minimal interrupt instructions — only on clear confusion
- Each persona seed in `web/lib/all-personas.ts` updated with appropriate interrupt language based on its `personality_type`

**Files changed:** `web/lib/all-personas.ts`, mobile app Vapi call config

---

## Section 2: PDF/Doc Upload → AI Chat → Playbook (Item 3)

### Overview
New playbook creation path: coach uploads a PDF or Word doc → Claude reads it and asks clarifying questions one at a time → generates a full playbook draft using the existing generation pipeline.

### File Upload & Extraction

**New route:** `POST /api/playbook/upload`
- Accepts: PDF (`.pdf`) or Word (`.docx`) file via multipart form
- Extracts plain text server-side
  - PDF: `pdf-parse` npm package
  - DOCX: `mammoth` npm package
- Returns: `{ extractedText: string }`
- Text is **not stored in DB** — returned to client and held in React state

### Conversational Q&A

**New route:** `POST /api/playbook/chat`
- Stateless — client sends full message history on every turn
- Request body: `{ messages: {role, content}[], extractedText: string }`
- Claude system prompt instructs it to:
  1. On first message: analyze extracted text, identify what's clear vs. missing
  2. Ask one targeted question per response to fill gaps (scenario type, objections, must-mentions, closing ask, ideal outcome, opening line, first 30 seconds)
  3. When sufficient info gathered, respond with `__READY__` marker followed by JSON matching the `/api/playbook/generate` input schema
- Client detects `__READY__`, auto-calls `/api/playbook/generate`, navigates to playbook edit page with draft pre-filled

### UI

- New **"Upload Document"** option on coach's playbook creation page (tab or modal alongside existing manual form)
- Upload input at top, chat interface below
- Subtle progress indicator: "3 of ~6 questions answered"
- No new pages — lives within existing playbook creation flow at `/playbooks/create`

### Dependencies
```
npm install pdf-parse mammoth
```

---

## Section 3: Per-Company Playbook Visibility (Item 4)

### Overview
Coaches control which of their playbooks each connected company can access. Default is all playbooks visible — coaches only act when restricting a company.

### Database

New table: `playbook_company_access`
```sql
CREATE TABLE playbook_company_access (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id      UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(playbook_id, organization_id)
);
```

**Whitelist model:**
- If a coach has added rows for a company → that company sees only whitelisted playbooks
- If no rows exist for a company → company sees all coach's playbooks (zero migration needed)

### API Changes

**Extended:** `GET /api/playbooks`
- When caller is `company_admin` or their users: apply whitelist filter against `playbook_company_access`

**New:** `GET /api/coach/companies/[orgId]/playbooks`
- Returns all coach's playbooks with `visible: boolean` for each (based on whitelist rows)

**New:** `PUT /api/coach/companies/[orgId]/playbooks`
- Body: `{ playbookIds: string[] }` — full replacement of whitelist for this org
- If `playbookIds` equals all playbooks → delete all rows (revert to "show all" default)

### UI

In the coach's company detail view (existing `/coach` companies list):
- New **"Playbook Access"** panel
- Shows all coach's playbooks as a checklist — checked = visible
- All checked by default (no rows = show all)
- Save button replaces entire whitelist

### RLS
Both `playbook_company_access` and `company_coach_connections` follow the existing pattern:
- Service role bypass policy (all API routes use `createServiceRoleClient`)
- Authenticated read: coaches can read rows scoped to their `coach_instance_id`; company admins can read rows scoped to their `organization_id`
- Policies added to `web/supabase/coach-company-connections-migration.sql`

---

## Section 4: Company–Coach Connections (Items 5–7)

### Overview
Companies can invite consulting coaches with scoped permissions. This is an additional relationship — coaches can still create and own companies as before. Coach approval via email is required before access is granted.

### Database

New table: `company_coach_connections`
```sql
CREATE TABLE company_coach_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  coach_instance_id UUID NOT NULL REFERENCES coach_instances(id) ON DELETE CASCADE,
  permission_level  TEXT NOT NULL CHECK (permission_level IN ('edit_playbooks', 'readonly')),
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'declined')),
  approval_token    TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at       TIMESTAMPTZ,
  UNIQUE(organization_id, coach_instance_id)
);
```

### Company Admin Flow (Item 5)

**Location:** New **"Coaches"** tab in company admin dashboard

**Add a coach:**
1. Company admin pastes coach's invite token (`coach_instances.invite_token`)
2. System resolves the coach, shows confirmation dialog:
   - Coach name and instance name
   - List of what access grants: users, sessions, recordings
   - Permission level selector: "Can edit playbooks" vs. "View sessions & recordings only"
   - Warning: *"The coach will be able to see all users in your organization and their training sessions and recordings."*
3. Company admin confirms → connection row created with `status: 'pending'`
4. Pending state shown in the Coaches tab until coach responds

### Email Approval Flow (Item 6)

On connection request, Resend sends coach an email containing:
- Requesting company name
- What they're granting access to (users, sessions, recordings)
- Permission level (edit playbooks or read-only)
- **Accept** button → `POST /api/coach/connections/[token]/respond?action=accept`
- **Decline** button → `POST /api/coach/connections/[token]/respond?action=decline`

On **accept:**
- `status → active`, `accepted_at` set
- Company admin receives confirmation email

On **decline:**
- `status → declined`
- Company admin receives notification email

### Access Enforcement

**`permission_level: 'edit_playbooks'`** (when `status: 'active'`):
- Coach can view the company's sessions and recordings
- Coach can view AND edit the company's custom playbooks
- Edit controls shown in coach's view of that company's playbooks

**`permission_level: 'readonly'`** (when `status: 'active'`):
- Coach can view sessions and recordings only
- Playbooks visible but read-only, edit controls hidden

The `playbook_company_access` whitelist from Section 3 applies on top — a consulting coach only sees playbooks the owning coach has made visible to that company.

### Connection Removal (Item 7)

**Coach removes:** New "Connected Companies" section in coach dashboard → "Disconnect" button per company → deletes connection row → company admin notified via email

**Company admin removes:** "Coaches" tab → "Remove" button per coach → deletes connection row → coach notified via email

### New API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/company/coaches` | `GET` | List company's coach connections (pending + active) |
| `/api/company/coaches` | `POST` | Submit coach invite token, create pending connection |
| `/api/company/coaches/[id]` | `DELETE` | Company removes a coach connection |
| `/api/coach/connections/[token]/respond` | `POST` | Coach accepts or declines via email link (`?action=accept\|decline`) |
| `/api/coach/connections` | `GET` | Coach lists all their company connections |
| `/api/coach/connections/[id]` | `DELETE` | Coach removes a connection |

---

## Migration Summary

### New DB tables (one migration file: `web/supabase/coach-company-connections-migration.sql`)
1. `playbook_company_access`
2. `company_coach_connections`

### Seed updates (no DB changes, re-seed via `POST /api/seed`)
- All 11 playbooks in `default-playbooks.ts` — no scoring changes, content stays as-is
- All personas in `all-personas.ts` — timing + interrupt instructions added

### New npm packages
- `pdf-parse`
- `mammoth`

### Files changed
| File | Change |
|---|---|
| `web/lib/all-personas.ts` | Add timing + interrupt instructions to all persona system_prompts |
| `web/lib/default-playbooks.ts` | No changes (timing is persona behavior, not scoring) |
| `web/app/training/page.tsx` | Add `maxDurationSeconds: 600`, `interruptionsEnabled: true` to `sharedOverrides` |
| `web/app/api/playbook/upload/route.ts` | New — PDF/doc extraction |
| `web/app/api/playbook/chat/route.ts` | New — stateless AI Q&A |
| `web/app/api/coach/companies/[orgId]/playbooks/route.ts` | New — GET/PUT playbook visibility |
| `web/app/api/company/coaches/route.ts` | New — GET/POST company coach connections |
| `web/app/api/company/coaches/[id]/route.ts` | New — DELETE company coach connection |
| `web/app/api/coach/connections/route.ts` | New — GET coach connections |
| `web/app/api/coach/connections/[id]/route.ts` | New — DELETE coach connection |
| `web/app/api/coach/connections/[token]/respond/route.ts` | New — email approval handler |
| `web/app/playbooks/create/page.tsx` | Add upload + chat UI path |
| `web/app/(dashboard)/coach/` | Add playbook access panel + connected companies section |
| `web/app/(dashboard)/company/` | Add Coaches tab |
| `web/supabase/coach-company-connections-migration.sql` | New — two new tables |

---

## Open Questions / Future
- Per-session recording access granularity (currently all-or-nothing per company)
- Coach billing model for consulting connections (out of scope for this spec)
