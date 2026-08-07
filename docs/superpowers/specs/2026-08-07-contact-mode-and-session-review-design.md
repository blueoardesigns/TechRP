# Contact Mode & Shared Session Review — Design

Date: 2026-08-07
Status: Approved, ready for implementation planning

Two independent features, specified together because both were approved in the
same brainstorming session. They share no code and can be built in either order.

---

## Feature 1 — Contact Mode picker

### Problem

Every scenario currently assumes a single, implicit channel. `plumber_lead`
personas open with phone-only lines such as "my plumber Tony gave me your
number" ([web/lib/personas.ts:696](../../../web/lib/personas.ts)), so the same
persona makes no sense when the technician is standing at the door. Reps need to
practice the same scenario as a phone call, as an unannounced visit, and as a
visit that was scheduled on an earlier phone call.

### Scope

A `ContactMode` picker on the persona-preview screen for nine scenarios:

| Scenario | `callType` | Options |
|---|---|---|
| `plumber_lead` | `cold_call` | Phone Call / Cold Inspection / Scheduled Inspection |
| `property_manager` | `cold_call` | Phone Call / Cold Walk-In / Scheduled Meeting |
| `commercial_property_manager` | `cold_call` | Phone Call / Cold Walk-In / Scheduled Meeting |
| `insurance_broker` | `cold_call` | Phone Call / Cold Walk-In / Scheduled Meeting |
| `plumber_bd` | `cold_call` | Phone Call / Cold Walk-In / Scheduled Meeting |
| `property_manager_discovery` | `discovery` | Phone Call / In-Person Meeting |
| `commercial_pm_discovery` | `discovery` | Phone Call / In-Person Meeting |
| `insurance_broker_discovery` | `discovery` | Phone Call / In-Person Meeting |
| `plumber_bd_discovery` | `discovery` | Phone Call / In-Person Meeting |

`homeowner_inbound` and `homeowner_facetime` render **no picker** — those two
scenarios already encode their channel, and adding a picker would contradict
their persona prompts.

### Data model

```ts
export type ContactMode = 'phone' | 'cold_visit' | 'scheduled_visit';
```

Declared in both [web/lib/personas.ts](../../../web/lib/personas.ts) and
[mobile/lib/scenarios.ts](../../../mobile/lib/scenarios.ts). The duplication is
deliberate — it matches how `SCENARIOS` and the difficulty modifiers are already
maintained in both apps.

Option sets are derived from `ScenarioConfig`, not hard-coded per scenario:

- `callType === 'cold_call'` → all three modes.
- `callType === 'discovery'` → `phone` and `scheduled_visit` only, with
  `scheduled_visit` labeled "In-Person Meeting" (a discovery meeting is
  scheduled by definition, so "cold" is meaningless there).
- Labels vary by `group`: `technician` uses "Inspection", `bizdev` uses
  "Walk-In" / "Meeting".

Default is `phone`. With the default selected, call behavior is byte-identical
to today's, which is what keeps this change safe for the existing 650 persona
seeds.

### Prompt construction

A new `getContactModeModifier(mode: ContactMode, group: ScenarioGroup): string`
returns `''` for `phone` and a bracketed block otherwise. It is prepended into
the existing modifier chain at
[web/app/training/page.tsx:461](../../../web/app/training/page.tsx), alongside
`getPaymentModifier` and `getBusyModifier`, and mirrored in the mobile call
setup.

`cold_visit` block conveys: the rep has arrived in person, unannounced. You were
not expecting anyone. React to a stranger at your door / in your office, not to
a ringing phone.

`scheduled_visit` block conveys: you spoke by phone with someone from this
company earlier to arrange this visit. You may or may not have shared detail
about your situation on that call — if the rep references something you told the
office, go along with it vaguely rather than denying it or inventing specifics.

Every non-phone block also carries an `[OPENING]` rule:

> Greet the person in character for a face-to-face arrival, in one or two
> sentences. Never reference giving out your number, being given a number,
> calling anyone, or being called.

That last clause is what neutralizes the phone-flavored persona seeds without
editing any of them.

### Opening mechanics

In `sharedOverrides` ([web/app/training/page.tsx:475](../../../web/app/training/page.tsx)):

- `phone` → `firstMessage: selectedPersona.firstMessage` (unchanged).
- `cold_visit` / `scheduled_visit` → omit `firstMessage`, set
  `firstMessageMode: 'assistant-speaks-first-with-model-generated-message'`.

The persona opens in character from the system prompt, so each of the 650 seeds
keeps its own voice in every mode without a data migration. The cost is a small
amount of latency at call start and a non-deterministic opener; both were
accepted over rewriting or duplicating the seed library.

### Persistence

Add a nullable `training_sessions.contact_mode text` column. Saved through
[saveTrainingSession](../../../web/lib/training-sessions.ts) and passed into the
`/api/assess` persona context so grading knows whether the rep was on a phone or
in a doorway. Existing rows stay `null` and are read as `phone`. The session
detail page displays it alongside Scenario.

### UI placement

Rendered in the persona-preview phase directly beneath Difficulty and above
Payment Type ([web/app/training/page.tsx:796](../../../web/app/training/page.tsx)),
using the same segmented-button styling as the Payment Type control. Mobile
mirrors the placement in its own train screen.

### Success criteria

- Selecting Phone Call produces a call whose overrides are identical to today's.
- Selecting an in-person mode on any of the nine scenarios yields an opening
  line that references neither a phone call nor an exchanged phone number.
- Selecting Scheduled Inspection/Meeting yields a persona that acknowledges a
  prior scheduling call when asked about it.
- `homeowner_inbound` and `homeowner_facetime` show no picker.
- Discovery scenarios show exactly two options.
- The chosen mode is persisted on the session and visible on the session page.
- Web and mobile behave the same.

---

## Feature 2 — Review-mode share links with anchored comments

### Current state (verified)

The public share page at
[web/app/share/session/[token]/page.tsx](../../../web/app/share/session/[token]/page.tsx)
renders only the score, coaching summary, strengths, improvements, and actions.
It contains **no recording, no transcript, and no comments** — the share dialog
states this explicitly at
[share-dialog.tsx:58](../../../web/app/sessions/[id]/share-dialog.tsx). Recording
playback is authenticated-only: `/api/recording` calls `requireUser` before
presigning the R2 object. `coach_notes` exists but is owner-scoped and unrelated.

So this feature is a build, not a fix.

### Share modes

Add to `training_sessions`:

```sql
share_mode text not null default 'summary'
  check (share_mode in ('summary', 'review'))
```

- `summary` — today's page, unchanged. Every link that already exists stays here,
  so no previously shared URL starts leaking audio.
- `review` — adds the recording, the full transcript, and anchored comments.

The share dialog gains a Summary/Review selector, and its description copy is
rewritten to state accurately what each mode exposes. `POST /api/sessions/[id]/share`
accepts a `mode` field.

### Comments schema

```sql
create table session_comments (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null references training_sessions(id) on delete cascade,
  author_name           text not null,
  body                  text not null,
  anchor_message_index  int  not null,
  anchor_offset_seconds int,
  author_token_hash     text not null,
  created_at            timestamptz not null default now()
);
create index on session_comments (session_id, anchor_message_index);
```

- `anchor_message_index` is the index into the parsed transcript array. This is
  the durable anchor — a comment is attached to a line of dialogue, not to a
  wall-clock position.
- `anchor_offset_seconds` is computed **server-side at insert**, from the
  anchored message's `timestamp` minus the session's `started_at`. Transcript
  messages already carry ISO timestamps
  ([training/page.tsx:330](../../../web/app/training/page.tsx), serialized at
  line 576), and `started_at` is the call-start time, so these offsets line up
  with the recording. It is nullable because legacy sessions may lack timestamps.
- `author_token_hash` is the sha256 of an opaque random token the commenter's
  browser stores in `localStorage`. It is the only thing that lets an anonymous
  commenter delete their own comment. The raw token is never stored.

RLS denies anon access entirely. Every read and write goes through service-role
API routes that authorize by share token or by session ownership — the same
posture as `/api/recording`.

### Routes

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/sessions/[id]/share` | owner | extended with `mode: 'summary' \| 'review'` |
| `POST /api/share/[token]/recording` | share token | presign R2 for a review-mode link |
| `GET /api/share/[token]/comments` | share token | list comments for the session |
| `POST /api/share/[token]/comments` | share token | create a comment |
| `DELETE /api/share/[token]/comments/[id]` | author token **or** owner | delete |

The R2 presign logic (object-key derivation and SigV4 signing) moves out of
[web/app/api/recording/route.ts](../../../web/app/api/recording/route.ts) into
`web/lib/recording.ts`, and both the authenticated route and the new public
route call it. This is a targeted extraction to avoid a second copy of the
signing logic — not a broader refactor.

Token authorization on every public route checks: the token exists, the session
is not expired (`share_expires_at`), and `share_mode = 'review'`. A summary-mode
token gets a 404 from the recording and comment routes.

Validation and abuse limits on `POST comments`: `author_name` 1–60 characters
after trim, `body` 1–2000 characters, and an IP-based rate limit on creation.
Anonymous name-only identity is accepted as a deliberate tradeoff — the audience
is coaches and teammates holding a private URL, not the open internet.

### Review UI

One component directory, `web/components/session-review/`, rendered by both:

1. the review-mode share page, with owner controls off, and
2. the owner's session page, replacing the inline transcript block at
   [sessions/[id]/page.tsx:238](../../../web/app/sessions/[id]/page.tsx), with
   owner delete on.

Behavior:

- Each transcript message renders as today's bubble, plus a comment affordance
  on hover/tap, a comment-count badge, and an inline thread beneath the message
  when it has comments. Comments live **on the line**, not in a side rail.
- A sticky player sits at the bottom of the transcript. Clicking a message seeks
  the audio to that message's offset — reusing the `seekTo` handle already
  exposed by [RecordingPlayer](../../../web/app/sessions/[id]/recording-player.tsx).
- On `timeupdate`, the message whose offset window contains the current position
  is highlighted and auto-scrolled into view. Any comment anchored to that
  message slides in as a card beside the player, so the listener sees the
  comment at the moment it applies. Auto-scroll suspends while the user is
  manually scrolling and resumes on the next seek.
- The composer asks for a name, remembered in `localStorage` under
  `techrp_comment_name` so a coach types it once per browser. A delete control
  appears when the stored author token matches the comment, or when the viewer
  is the session owner.

### Edge cases

- **Legacy sessions without message timestamps:** `anchor_offset_seconds` is
  null. Comments still anchor to their message and render inline; they simply do
  not seek or auto-surface. The player still works on its own.
- **Recording unavailable or expired upstream:** the transcript and comments
  render fully; the player shows its existing error state.
- **Link revoked or expired while a page is open:** the next comment POST
  returns 404 and the UI surfaces that the link is no longer active.
- **Mode switched review → summary:** comments are retained in the database but
  are no longer publicly readable. Switching back restores them.
- **Session deleted:** comments cascade.

### Success criteria

- A summary-mode link renders exactly what it renders today.
- A review-mode link plays the recording without any authenticated session.
- A visitor can post a comment on a specific transcript line after entering a
  name, and see it appear inline under that line.
- Playing the recording highlights the current line and surfaces its comments at
  the right moment.
- The commenter can delete their own comment from the same browser; another
  browser cannot.
- The owner sees the same anchored comments on `/sessions/[id]` and can delete
  any of them.
- Nothing anonymous can read or write through Supabase directly — only through
  the token-scoped routes.
