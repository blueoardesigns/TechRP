# Team Features, Persona Expansion & Discovery Overhaul — Design Spec

**Date:** 2026-04-23
**Status:** Approved

---

## Overview

Nine changes across two implementation phases:

- **Phase 1 (code):** Member drill-down page, session user attribution, coached teams visibility fix, Tiptap SSR fix
- **Phase 2 (content):** Transcript seeding, insurance broker persona/playbook additions, plumber persona/playbook additions, 50-total personas per type, discovery meeting playbook + grading overhaul

---

## Phase 1: Code Changes

### 1. Member Drill-Down Page (`/team/members/[memberId]`)

**New page:** `web/app/team/members/[memberId]/page.tsx` — client component, accessible to `company_admin` and `superuser` only. Redirects others to `/`.

**New API endpoint:** `GET /api/team/members/[memberId]`
- Auth: same `['company_admin', 'superuser']` allowedRoles check as the list endpoint
- Verifies the requested member belongs to the admin's `organization_id`
- Returns: `{ member: { id, full_name, email, status, created_at, scenario_access, sessionCount, sessions30d, lastSessionAt, avgScore }, sessions: [...] }`
- Sessions include: `id, started_at, ended_at, score, persona_name, persona_scenario_type`
- Sessions ordered by `started_at DESC`, limit 200

**Page layout:**
- Header: back link to `/team`, member name + email, status badge (Active/Inactive), metrics row (avg score, sessions 30d, last session)
- Sessions table: Scenario | Score | Date | View → (links to `/sessions/[id]`)
- Empty state if no sessions yet

**Team page change:** Wrap the member name cell in a `<Link href={/team/members/${m.id}}>` on the employees tab.

---

### 2. Session Page User Attribution

**File:** `web/app/sessions/[id]/page.tsx` (server component)

After fetching the session, add:
```ts
const { data: sessionUser } = await supabase
  .from('users')
  .select('full_name, email, app_role')
  .eq('id', session.user_id)
  .single();
```

Render a "Trained by" banner at the very top of the page content area — only when `session.user_id !== viewer.id` (i.e., a manager/coach viewing someone else's session). The banner shows: avatar initial circle, full name, email, role label.

Suppress the banner entirely when the viewer is the session owner (they know it's their own session).

---

### 3. Coached Teams Visibility Fix (`/api/coach/companies`)

**Root cause:** The `getCoachInstance()` helper in `web/app/api/coach/companies/route.ts` was updated to use `createServiceSupabase` in the GET handler but the import still references the old pattern in some paths, and the `createServiceSupabase` function itself is imported from `@/lib/supabase-server`. Verify the full import chain is consistent.

**Fix:** Audit `web/app/api/coach/companies/route.ts` — ensure `getCoachInstance()` uses `createServiceSupabase` throughout (not `createServiceRoleClient` from `@/lib/supabase`). Remove any stale import of `createServiceRoleClient`.

**Verification:** After fix, Tim (`superuser`, `coach_instance_id = 8debc49b-fe07-4270-9b29-2768dfbe5535`) should see 5 coached companies (Apex Restoration, BlueStar Drying, Cascade Services, Delta Dry, Eagle Restore) on the Coached Teams page.

---

### 4. Tiptap SSR Fix

**File:** `web/components/ui/rich-text-editor.tsx`

Add `immediatelyRender: false` to the `useEditor` options object:

```ts
const editor = useEditor({
  immediatelyRender: false,
  extensions: [...],
  content,
  onUpdate: ...,
  editorProps: ...,
});
```

This prevents Tiptap from attempting DOM measurement during SSR, eliminating the React hydration mismatch.

---

## Phase 2: Content

### 5. Transcript Seeding

**Script:** `web/seed-transcripts.mjs` (run once, delete after)

**Target:** All `training_sessions` where `source = 'demo'` AND `transcript IS NULL`

**Format:** Array of message objects matching the session detail page's expected shape:
```json
[
  { "role": "user", "content": "..." },
  { "role": "assistant", "content": "..." }
]
```
`user` = salesperson/BD rep. `assistant` = persona/customer.

**Templates:** 6 scenario-specific templates, each with 3–4 variants:
- `technician` — homeowner with water damage, BD calling as restorer
- `property_manager` — property manager cold call
- `insurance_broker` — insurance broker BD call
- `plumber_bd` — plumber partnership call
- `homeowner_inbound` — inbound homeowner call
- `plumber_lead` — homeowner referred by plumber

**Variant selection by score:**
- Score ≥ 80 → "won" variant (prospect agrees to meeting/referral)
- Score 60–79 → "stalled" variant (soft maybe, follow-up needed)
- Score < 60 → "lost/rejected" variant (objection not overcome)

**Length:** 15–22 exchanges per transcript. Persona name from `persona_name` column woven into the BD's opening line.

**Idempotent:** Skips sessions that already have a non-null transcript.

---

### 6. Insurance Broker Personas (Items 5 + 7)

**New personas targeting claim-control positioning:**

**Actively referring (2–3 personas):**
- Understands broker-directed claims protect client retention
- Easy to engage — BD just needs to qualify themselves as the right vendor
- Persona mindset: "I've lost clients after bad claims. I need someone I trust."

**Open but unaware (3–4 personas):**
- Currently lets carrier assign vendors, doesn't know the risk
- BD must educate on: carrier-assigned vendors optimize for insurer cost, not client experience → bad outcome → policy cancellation → broker loses client
- Persona mindset: "I don't really get involved in that side of things."

**Resistant / skeptical (3–4 personas):**
- "That's not my lane." Worries about appearing to interfere in the claim process
- BD must reframe: this is client advocacy, not interference
- Persona mindset: "I just stay out of claims — it's a liability."

**Playbook addition — "The Retention Argument" section:**
- Why broker-directed claims reduce cancellations
- How to frame the BD as a claims experience manager, not a vendor
- Objection handling: "I don't get involved in claims"
- Language: "When your client has a bad restoration experience, they blame the whole situation — including their agent. You have the ability to control that."

**Total target:** 50 personas for `insurance_broker` type, 50 for `insurance_broker_discovery`.

---

### 7. Plumber BD Personas (Items 6 + 7)

**New personas targeting restorer reluctance:**

**Hostile / territorial (2–3 personas):**
- "We do it all ourselves" or "We had a deal with a restorer that went sideways"
- BD must sell the concept of partnership from scratch, acknowledge the skepticism
- Persona mindset: "Every restorer I've talked to overpromises and underdelivers."

**Burned by bad restorer (2–3 personas):**
- Lost a client or got blamed for a bad referral experience
- BD must lead with accountability and differentiation before any pitch
- Persona mindset: "The last company I sent someone to damaged the house worse."

**Financially skeptical (2–3 personas):**
- Doesn't see enough upside in the referral structure
- Needs specific numbers: referral value, frequency, what they get back
- Persona mindset: "What exactly is in it for me and my guys?"

**Playbook addition — "Handling the 'We Don't Do Referrals' Objection":**
- Acknowledge past bad experiences directly ("That's fair — a lot of restorers have burned plumbers")
- Differentiate on: accountability, communication, tech tracking, what happens when something goes wrong
- The financial frame for transaction-type plumbers: specific payout structure, timing, per-job tracking
- The relationship frame for relationship-type plumbers: lead-back model, warranty support, exclusivity offer

**Total target:** 50 personas for `plumber_bd`, 50 for `plumber_bd_discovery`.

---

### 8. All Other Persona Types to 50

For each remaining type, generate enough personas to reach 50 total. Maintain personality variety:
- Gatekeeping / brush-off
- Politely interested but busy
- Already has a vendor (loyal)
- Bad past experience
- Open but noncommittal
- Genuinely interested / high-value prospect
- Plus scenario-specific variants

**Types:**
| Scenario Type | Current | Target |
|---|---|---|
| `homeowner_inbound` | 25 | 50 |
| `homeowner_facetime` | ~10 | 50 |
| `property_manager` | 25 | 50 |
| `property_manager_discovery` | ~5 | 50 |
| `commercial_property_manager` | ~5 | 50 |
| `commercial_pm_discovery` | ~5 | 50 |
| `plumber_lead` | ~5 | 50 |

All new personas follow the existing `PersonaSeed` structure: `id`, `name`, `scenarioType`, `personalityType`, `briefDescription`, `speakerLabel`, `firstMessage`, `systemPrompt`, optional `gender`.

`systemPrompt` must be ≥ 150 words with specific behavioral instructions, objections, and response patterns. `firstMessage` must be a natural in-character opening line.

---

### 9. Discovery Meeting Playbook + Grading Overhaul (Item 8)

**Discovery persona `systemPrompt` behavioral directives (all `*_discovery` types):**
- Answer questions fully — don't deflect or gatekeep
- Share pain points when asked — this meeting was their idea too
- Expect smart, specific questions — reward depth, punish generic pitching
- Have a clear sense of what success looks like for them — they'll share it if asked

**Playbook additions for all four discovery types** (`property_manager_discovery`, `insurance_broker_discovery`, `plumber_bd_discovery`, `commercial_pm_discovery`):

New section: **"Discovery Meeting Framework"**
1. **Open with agenda-setting** (30 sec): "I want to make sure I use your time well — I'd love to spend most of this understanding your current situation and what you'd want from a partner. Sound good?"
2. **Current state questions** (5 min): Volume, current vendors/process, how referrals happen now
3. **Pain / friction** (5 min): What's broken, what's been frustrating, what's the cost of the current gap
4. **Ideal outcome** (3 min): What does a great partnership look like to them specifically
5. **Decision process** (2 min): Who else is involved, what does next step look like
6. **Close with a specific next step** — not "I'll follow up," but a defined action: tour, intro call, trial job, referral agreement draft

**Grading changes in `/api/assess`:**

When `persona_scenario_type` ends in `_discovery`, inject a discovery-specific rubric into the Claude assessment prompt:

```
DISCOVERY MEETING GRADING RUBRIC:
- Weight question quality heavily: did the rep ask about volume, current process, pain, ideal outcome, and decision criteria?
- Penalize one-way pitching: if the rep spent more than 30% of the call presenting without asking questions, score drops significantly
- Reward agenda-setting at the open
- Reward a specific, committed next step at the close (not vague follow-up)
- Penalize re-pitching content from a cold call without digging deeper
- A great discovery score (85+) requires demonstrated curiosity, not just rapport
```

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `web/app/team/members/[memberId]/page.tsx` | Member drill-down page |
| Modify | `web/app/api/team/members/[memberId]/route.ts` | Add GET handler for single-member profile + sessions (PATCH already exists) |
| Modify | `web/app/team/page.tsx` | Add Link wrapper to member name cell |
| Modify | `web/app/sessions/[id]/page.tsx` | Add "Trained by" user attribution banner |
| Modify | `web/app/api/coach/companies/route.ts` | Fix import chain for coached teams |
| Modify | `web/components/ui/rich-text-editor.tsx` | Add `immediatelyRender: false` |
| Modify | `web/lib/all-personas.ts` | Add ~300+ new personas across all types |
| Modify | `web/lib/default-playbooks.ts` | Add new sections to insurance + plumber + discovery playbooks; update discovery grading rubric |
| Modify | `web/app/api/assess/route.ts` | Inject discovery rubric when scenario ends in `_discovery` |
| Create | `web/seed-transcripts.mjs` | Seed transcripts into demo sessions (run once, delete) |
| Create | `web/seed-personas.mjs` | Seed new personas to DB via `/api/seed` (run once, delete) |

---

## Success Criteria

1. Clicking a team member name opens `/team/members/[id]` with their sessions listed and clickable
2. Viewing a session as a manager shows "Trained by [Name]" at the top
3. Tim's Coached Teams page shows all 5 seeded companies
4. Playbook editor opens without React hydration error
5. All seeded demo sessions display realistic transcripts on their detail pages
6. Insurance broker personas include claim-control mindsets across three attitudes
7. Plumber BD personas include restorer-reluctant types across three attitudes
8. All scenario types have ≥ 50 personas in `all-personas.ts`
9. Discovery playbooks include the Discovery Meeting Framework section
10. Claude assessment for `_discovery` sessions uses the discovery rubric and rewards questioning over pitching
