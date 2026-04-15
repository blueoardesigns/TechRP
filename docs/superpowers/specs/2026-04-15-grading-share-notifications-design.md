# Grading Overhaul + Share-to-LinkedIn + Notifications Expansion

**Date:** 2026-04-15
**Status:** Approved, ready for implementation plan

## Overview

Five coordinated changes to the TechRP web app:

1. Sessions graded on a 1–100 scale with a letter grade (A–F).
2. Assessments include 1–5 "Actions to Take" examples referencing specific moments from the transcript.
3. Users can share a public read-only page for a session (LinkedIn-friendly) that doubles as a referral signup link. Referred signups credit the referrer with 60 minutes of future overage allowance.
4. Notification system expanded with new trigger types (referral signup, coach assignment from either side) and a realtime subscription upgrade for the existing bell.
5. Superuser can broadcast a notification to all approved users.

Out of scope: mobile app changes, historical score backfill, referral credit *redemption* (blocked on billing), global notification scaling optimization.

---

## 1. Scoring: 1–100 + Letter Grade

### Assess route changes (`web/app/api/assess/route.ts`)

Updated prompt asks Claude for 1–100 score, letter grade, and actions to take. New JSON contract:

```json
{
  "score": 87,
  "letter_grade": "B",
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "summary": "...",
  "actions_to_take": [
    {
      "ai_said": "So how much is this going to cost me?",
      "suggested_response": "Great question — before I can quote, let me make sure I understand the scope...",
      "technique": "Reframe to discovery"
    }
  ]
}
```

Scoring bands communicated in prompt:
- **A (90–100)** — Would almost certainly sign/refer. Strong close, confident objection handling.
- **B (80–89)** — Likely positive outcome. Good fundamentals, minor missed opportunities.
- **C (70–79)** — Uncertain. Some good moments; key objections left unaddressed.
- **D (60–69)** — Unlikely to sign/refer. Lost control or failed to build trust.
- **F (<60)** — Damaging call. Would likely cost the company the job or relationship.

`actions_to_take` is 1–5 items. Prompt instructs: "For each, quote what the AI said verbatim, then give a specific suggested response the rep could have used."

Bump `max_tokens` 1024 → 2048 to fit the extra content.

Validation: require `score`, `strengths`, `improvements`, `summary`. `letter_grade` and `actions_to_take` are optional on the server (derived/defaulted in display helpers).

### Display helpers (`web/lib/scoring.ts`)

```ts
export const LETTER_BANDS = [
  { min: 90, letter: 'A' },
  { min: 80, letter: 'B' },
  { min: 70, letter: 'C' },
  { min: 60, letter: 'D' },
  { min: 0,  letter: 'F' },
] as const;

export function computeLetter(score: number): string {
  return LETTER_BANDS.find(b => score >= b.min)!.letter;
}

export function getDisplayScore(assessment: any): { score: number; letter: string } {
  const raw = Number(assessment?.score ?? 0);
  // Legacy assessments used 1–10; detect and scale.
  const score = raw <= 10 ? Math.round(raw * 10) : Math.round(raw);
  const letter = assessment?.letter_grade ?? computeLetter(score);
  return { score, letter };
}
```

### Session display (`web/app/sessions/[id]/page.tsx`)

- Header score badge shows `87 / 100` and letter grade pill.
- New "Actions to Take" section below "Improvements", rendered only when `actions_to_take` is non-empty. Each item shows the AI quote (italic, muted), the suggested response (bold), and the technique tag.

Session list views use `getDisplayScore` wherever score is displayed so legacy sessions still render correctly.

### No DB migration

`assessment` is JSONB — new fields appear naturally as new sessions are graded.

---

## 2. Share Page + Referrals

### Migration (`web/supabase/share-referral-migration.sql`)

```sql
-- Share tokens on sessions
ALTER TABLE training_sessions
  ADD COLUMN share_token TEXT UNIQUE,
  ADD COLUMN share_enabled_at TIMESTAMPTZ;

CREATE INDEX idx_training_sessions_share_token
  ON training_sessions(share_token) WHERE share_token IS NOT NULL;

-- Referrals
ALTER TABLE users
  ADD COLUMN referral_code TEXT UNIQUE,
  ADD COLUMN referral_credits_minutes INTEGER NOT NULL DEFAULT 0;

CREATE TABLE referrals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id      UUID NOT NULL REFERENCES users(id),
  referred_id      UUID NOT NULL REFERENCES users(id) UNIQUE,
  source           TEXT NOT NULL,  -- 'share_page' | 'signup_link'
  credited_minutes INTEGER NOT NULL DEFAULT 60,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);

-- Global broadcasts audit log (see §4)
CREATE TABLE global_broadcasts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by         UUID NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  link            TEXT,
  recipient_count INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

One-time backfill (end of migration): generate `referral_code` for every existing user via `UPDATE users SET referral_code = ... WHERE referral_code IS NULL`. Code format: 8-char base32 (e.g., `K3MZ7X2P`).

### Referral helpers (`web/lib/referral.ts`)

- `generateReferralCode(): string` — 8-char base32, checked for uniqueness at insert time.
- `applyReferral(referrerCode, newUserId, source): Promise<void>` — looks up referrer by code, inserts `referrals` row, `+60` to `referrer.referral_credits_minutes`, fires `referral_signup` notification. Silent no-op if code invalid.

### Share toggle route (`POST /api/sessions/[id]/share`)

- Auth required, must own the session (verified against `training_sessions.user_id`).
- Body: `{ enabled: boolean }`.
- If enabled: generate token (32-char hex via `crypto.randomUUID()` twice or similar unguessable source), set `share_token` and `share_enabled_at`. Return `{ url }`.
- If disabled: null out `share_token`, keep `share_enabled_at` for audit. Return `{ url: null }`.

### Public share page (`web/app/share/session/[token]/page.tsx`)

Server component, no auth required. Reads via service role. Returns 404 if token null or not found.

Layout (minimal standalone — no app nav):
- **Hero:** Big score `87` + letter pill `B`, user display name, avatar circle (initials fallback).
- **Meta strip:** Persona name, scenario type, date, duration (mm:ss).
- **Summary** — from assessment.
- **Strengths** — bulleted list.
- **Improvements** — bulleted list.
- **Actions to Take** — rendered same as private session page.
- **CTA footer:** "Train like [name]. Start free on TechRP →" linking `/signup?ref={referrer_code}`.

Metadata:
- `robots: { index: false, follow: false }` so shares don't end up in Google.
- OpenGraph tags with title `[name] scored 87/100 on TechRP`, description from `summary`, generic TechRP image. These make LinkedIn previews clean.

Explicitly excluded from the page: transcript, recording link.

### Share dialog (`web/app/sessions/[id]/share-dialog.tsx`)

Client component, owner-only button on session detail page. Modal contents:
- Copy-link button with the public URL.
- "Share on LinkedIn" button → opens `https://www.linkedin.com/sharing/share-offsite/?url={encodeURIComponent(url)}` in a new tab.
- "Revoke link" button (if currently enabled) → calls share route with `{enabled: false}`.

### Signup route update (`web/app/api/auth/signup/route.ts`)

Extend existing route to read `ref` query param (already handles `coach` and `org`). After successful user creation, call `applyReferral(refCode, newUser.id, 'share_page' | 'signup_link')`. Source is `share_page` if referral came via the public share page path, `signup_link` otherwise — determined by an additional `ref_source` query param set by the share page's CTA link.

### TODO.md additions

- Referral credit redemption: when billing/minute cap lands, consume `referral_credits_minutes` before blocking user at the session cap.
- Global notification scaling: if user count grows past ~5k, switch global broadcasts from fan-out insert to `global_notifications` + `dismissed_global_notifications` join table.

---

## 3. Notifications: New Types + Realtime

### Reuses existing infrastructure

The `notifications` table (from `candidate-invites-migration.sql`) and bell component (`web/components/notification-bell.tsx`) already exist. No schema changes for personal notifications.

Table shape (already live):
```
notifications(id, user_id, type, title, body, data JSONB, read, created_at)
```

### New notification types

| `type` | Recipient | Fires when |
|---|---|---|
| `referral_signup` | Referrer | A user signs up via `?ref=CODE`. Fired inside `applyReferral()`. |
| `coach_assigned` | The coachee | A coach is attached to their account (`users.coach_instance_id` set, or company/coach connection accepted). |
| `coach_added_by_user` | The coach | Same event — opposite side of the relationship. |
| `global_broadcast` | All approved users | Superuser broadcast (§4). |

Coach assignment trigger points: identified during implementation by grepping for the write sites that set `coach_instance_id` or insert into the coach/company connection tables. All such sites gain a pair of notification inserts.

### Data shape

Each notification stores a `data` JSONB object the bell renders opaquely; new convention: if `data.link` is present, clicking the notification navigates there. Example:

```json
{ "link": "/sessions/abc-123" }
```

The bell is updated so clicks on a notification with `data.link` call `router.push(link)` after marking read.

### Realtime upgrade to bell

Replace the 60-second polling in `web/components/notification-bell.tsx` with a Supabase Realtime subscription:

```ts
const channel = supabase
  .channel(`notifications:${profileId}`)
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profileId}` },
    (payload) => { prepend payload.new; bump unreadCount; })
  .subscribe();
```

Keep the initial `fetchNotifications()` call on mount. Keep a 5-minute safety poll as a fallback in case the channel drops. Cleanup on unmount.

Supabase Realtime must be enabled on the `notifications` table — add to the migration:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

---

## 4. Superuser Global Broadcast

### Admin page (`web/app/admin/notifications/page.tsx`)

Superuser-only (same guard as existing `/admin` pages — check `users.role = 'superuser'` server-side, redirect otherwise).

Layout:
- **Compose form:** Title (text), Body (textarea), Link URL (optional text).
- **"Send to all active users"** button — confirm dialog before firing.
- **History list** of past broadcasts (from `global_broadcasts` table): title, body preview, recipient count, sent-at timestamp.

### Broadcast route (`POST /api/admin/notifications/broadcast`)

1. Verify caller is superuser (service role check against `users.role`).
2. Validate payload: title + body required, link optional.
3. Fetch all `users.id` where `status = 'approved'`.
4. Bulk insert one `notifications` row per user: `type='global_broadcast'`, same title/body, `data = { link }` if link present.
5. Insert one `global_broadcasts` audit row with `recipient_count`.
6. Return `{ recipient_count }`.

Bulk insert uses a single `insert(rows)` call — Supabase handles arrays natively. For the current scale (hundreds of users, maybe low thousands) this is fine. Scaling concern logged to TODO.md.

### Nav link

`web/components/nav.tsx` gets a new "Broadcast" link under the admin section, visible only to superusers.

---

## 5. Files Touched

### New files
- `web/supabase/share-referral-migration.sql`
- `web/app/share/session/[token]/page.tsx`
- `web/app/api/sessions/[id]/share/route.ts`
- `web/app/sessions/[id]/share-dialog.tsx`
- `web/app/admin/notifications/page.tsx`
- `web/app/api/admin/notifications/broadcast/route.ts`
- `web/lib/scoring.ts`
- `web/lib/referral.ts`

### Modified files
- `web/app/api/assess/route.ts` — 1–100 scoring, letter grade, actions_to_take, max_tokens 2048
- `web/app/sessions/[id]/page.tsx` — display helpers, Actions to Take section, Share button
- `web/app/sessions/page.tsx` and any other list/card views — use `getDisplayScore`
- `web/app/api/auth/signup/route.ts` — accept `?ref=CODE` and `?ref_source`, apply referral
- `web/components/notification-bell.tsx` — Realtime subscription, clickable `data.link`
- Coach assignment endpoint(s) (TBD grep during implementation) — fire notification pair
- `web/components/nav.tsx` — superuser "Broadcast" link
- `CLAUDE.md` — add new routes, `share_token`, `referral_code` to architecture notes
- `TODO.md` — referral credit redemption + global broadcast scaling

---

## 6. Phasing

Four phases, each independently mergeable:

1. **Scoring overhaul** — assess route, scoring helpers, session page section.
2. **Referrals + share page** — migration, share route, public page, signup ref handling, share dialog.
3. **Notification types + realtime** — new types wired into signup/coach flows, realtime upgrade.
4. **Global broadcast** — admin page, broadcast route, nav link.

Phase 3's `referral_signup` trigger depends on phase 2 (needs `applyReferral`), but its coach-assignment triggers and realtime upgrade do not. In practice, land phase 2 before phase 3. Phases 1 and 4 are independent of everything else.

---

## 7. Non-Goals

- **Historical score backfill** — not happening; legacy sessions render as `×10`.
- **Referral credit redemption** — deferred until billing tiers exist. TODO.md entry.
- **Global broadcast scaling** — fan-out insert is fine at current scale. TODO.md entry.
- **Mobile app changes** — web-only.
- **Transcript on share page** — explicitly excluded per user choice.
- **Recording link on share page** — explicitly excluded per user ask.
