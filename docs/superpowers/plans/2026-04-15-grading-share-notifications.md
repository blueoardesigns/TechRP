# Grading + Share + Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 1–100 grading with letter grades and actions-to-take, a public LinkedIn-shareable session page with referral tracking, notification expansion (new types + realtime), and a superuser global broadcast.

**Architecture:** Four independently-mergeable phases. Scoring is prompt-only + display helpers. Share+referrals add one migration, one public server-component page, a share toggle route, and signup integration. Notifications reuse the existing `notifications` table; trigger inserts are added to signup and coach connection flows. Global broadcast is a superuser page that fans out `notifications` inserts and writes an audit row.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + Realtime), Claude API (`@anthropic-ai/sdk`), TypeScript.

**Spec:** `docs/superpowers/specs/2026-04-15-grading-share-notifications-design.md`

---

## Ground rules for every task

- Every task ends with a commit on the current branch. Prefer small commits.
- Run `cd web && npm run lint` and `cd web && npm run build` before every commit that touches TypeScript. Both must pass.
- There is no Jest/Vitest setup in this repo. "Tests" in this plan are **route-level smoke checks** via the dev server + curl (documented in each task), not unit tests. Do not add a test framework.
- Never log referral codes, tokens, or auth IDs to console in production paths.
- Do NOT use the `any` cast where the existing file uses properly typed `supabase` — mirror the surrounding style (this codebase uses `(supabase as any)` generously; stay consistent).

---

# Phase 1 — Scoring overhaul (1–100 + letter grade + actions to take)

## Task 1.1: Create scoring helpers

**Files:**
- Create: `web/lib/scoring.ts`

- [ ] **Step 1: Write the file**

```ts
// web/lib/scoring.ts
export const LETTER_BANDS = [
  { min: 90, letter: 'A' },
  { min: 80, letter: 'B' },
  { min: 70, letter: 'C' },
  { min: 60, letter: 'D' },
  { min: 0,  letter: 'F' },
] as const;

export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export function computeLetter(score: number): LetterGrade {
  return LETTER_BANDS.find((b) => score >= b.min)!.letter as LetterGrade;
}

export interface ActionToTake {
  ai_said: string;
  suggested_response: string;
  technique?: string;
}

export interface Assessment {
  score: number;
  letter_grade?: LetterGrade;
  strengths: string[];
  improvements: string[];
  summary: string;
  actions_to_take?: ActionToTake[];
}

/**
 * Normalize any assessment (legacy 1–10 or new 1–100) to a 1–100 display score + letter.
 * Legacy scores (<= 10) are scaled by 10.
 */
export function getDisplayScore(assessment: Pick<Assessment, 'score' | 'letter_grade'> | null | undefined): {
  score: number;
  letter: LetterGrade;
} {
  const raw = Number(assessment?.score ?? 0);
  const score = raw <= 10 ? Math.round(raw * 10) : Math.round(raw);
  const letter = (assessment?.letter_grade as LetterGrade | undefined) ?? computeLetter(score);
  return { score, letter };
}

export function gradeColor(letter: LetterGrade): { text: string; ring: string; bg: string } {
  switch (letter) {
    case 'A': return { text: 'text-emerald-400', ring: 'border-emerald-500/40', bg: 'bg-emerald-500/10' };
    case 'B': return { text: 'text-lime-400',    ring: 'border-lime-500/40',    bg: 'bg-lime-500/10'    };
    case 'C': return { text: 'text-yellow-400',  ring: 'border-yellow-500/40',  bg: 'bg-yellow-500/10'  };
    case 'D': return { text: 'text-orange-400',  ring: 'border-orange-500/40',  bg: 'bg-orange-500/10'  };
    case 'F': return { text: 'text-red-400',     ring: 'border-red-500/40',     bg: 'bg-red-500/10'     };
  }
}
```

- [ ] **Step 2: Verify lint + typecheck**

Run: `cd web && npm run lint`
Expected: passes with no errors in the new file.

Run: `cd web && npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add web/lib/scoring.ts
git commit -m "feat(scoring): add 1–100 display helpers and letter-grade bands"
```

---

## Task 1.2: Update `/api/assess` prompt to 1–100 + actions_to_take

**Files:**
- Modify: `web/app/api/assess/route.ts`

- [ ] **Step 1: Replace the scoring framework + JSON format sections**

In `web/app/api/assess/route.ts`, locate the `assessmentPrompt` template literal (line ~145). Replace the `## Scoring Framework` through the end of the prompt (up to and including the closing backtick of the template literal) with this block. Keep `scenarioContext`, `playbookSection`, `transcriptText`, `primaryOutcome`, and `primaryCriteria` usage unchanged above this block.

```ts
    const assessmentPrompt = `You are an experienced sales manager grading a training call for a water damage restoration company. ${scenarioContext}${playbookSection}

Here is the conversation transcript:

${transcriptText}

## Scoring Framework

Your score (1–100) must reflect these weights:

**75% — Sales Outcome**
${primaryOutcome}

${primaryCriteria}

**25% — Playbook Execution**
${resolvedPlaybookContent
  ? `How closely did the rep follow the playbook above? Use it as a helpful guide, not a rigid checklist — give credit for the intent even if the exact phrasing differed.`
  : `No playbook is loaded for this scenario. Base this 25% on general best practices: structured opener, active listening, clear value prop, and a defined close.`}

## Scoring Guide (map score to letter grade)
- **A (90–100):** Would almost certainly sign/refer. Strong close, confident objection handling.
- **B (80–89):** Likely positive outcome. Good fundamentals, minor missed opportunities.
- **C (70–79):** Uncertain outcome. Some good moments; key objections unaddressed.
- **D (60–69):** Unlikely to sign/refer. Lost control or failed to build trust.
- **F (below 60):** Damaging. Would likely cost the company the job or relationship.

## Actions to Take

Include 1–5 specific moments where the rep missed an opportunity. For each, quote what ${contactLabel} said verbatim in "ai_said", then give a specific better response in "suggested_response". Optionally tag a technique name (e.g., "Reframe to discovery", "Trial close", "Feel-felt-found").

Be encouraging but direct — like a good sales manager who wants the rep to improve.

Respond in the following JSON format (valid JSON only, no markdown):
{
  "score": <number 1-100>,
  "letter_grade": "<A|B|C|D|F>",
  "strengths": [<array of 2–4 strings>],
  "improvements": [<array of 2–4 strings>],
  "summary": "<2–3 sentence overall feedback in a sales manager voice>",
  "actions_to_take": [
    {
      "ai_said": "<verbatim quote from ${contactLabel}>",
      "suggested_response": "<what the rep could have said>",
      "technique": "<optional short tag>"
    }
  ]
}

Be specific and constructive. Reference actual moments from the conversation.`;
```

- [ ] **Step 2: Bump `max_tokens` and update validation**

In the same file, change the Anthropic call and the validation block:

```ts
    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: assessmentPrompt,
        },
      ],
    });
```

And replace the existing validation block with:

```ts
    // Validate assessment structure
    if (
      typeof assessment.score !== 'number' ||
      !Array.isArray(assessment.strengths) ||
      !Array.isArray(assessment.improvements) ||
      typeof assessment.summary !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Invalid assessment structure from API' },
        { status: 500 }
      );
    }

    // actions_to_take is optional; normalize to array
    if (!Array.isArray(assessment.actions_to_take)) {
      assessment.actions_to_take = [];
    }
```

- [ ] **Step 3: Verify lint + build**

Run: `cd web && npm run lint && npm run build`
Expected: both pass. If build reports unused vars, remove them.

- [ ] **Step 4: Smoke-test the route**

Start dev server: `cd web && npm run dev` (or use preview_start if running in the preview harness).

POST to `/api/assess` with a small fake transcript:

```bash
curl -s http://localhost:3000/api/assess \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"assistant","content":"So how much is this gonna cost me?"},{"role":"user","content":"Good question. Typical jobs run 3-5k depending on scope."}]}' | jq .
```

Expected: JSON response with `assessment.score` between 1 and 100, `letter_grade` one of A/B/C/D/F, `actions_to_take` present (possibly empty array). If the test user has no playbook, that is fine — playbook is optional.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/assess/route.ts
git commit -m "feat(assess): score 1–100 with letter grade and actions_to_take"
```

---

## Task 1.3: Display the new score + Actions to Take on session detail page

**Files:**
- Modify: `web/app/sessions/[id]/page.tsx`

- [ ] **Step 1: Import scoring helpers and update Assessment interface**

Replace the existing `Assessment` interface (line ~55) and add the import at the top of the file:

```ts
import Link from 'next/link';
import { createServiceSupabase } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { getDisplayScore, gradeColor, type Assessment } from '@/lib/scoring';
```

Then delete the local `interface Assessment { ... }` declaration entirely — it's now imported.

- [ ] **Step 2: Replace `ScoreBadge` to render 1–100 + letter**

Replace the existing `ScoreBadge` function (line ~70) with:

```tsx
function ScoreBadge({ assessment }: { assessment: Assessment }) {
  const { score, letter } = getDisplayScore(assessment);
  const { text, ring } = gradeColor(letter);
  return (
    <div className={`w-24 h-24 rounded-full border-2 ${ring} flex flex-col items-center justify-center`}>
      <span className={`text-3xl font-bold ${text} leading-none`}>{score}</span>
      <span className="text-[10px] text-gray-600 mt-0.5">/ 100</span>
      <span className={`text-xs font-bold ${text} mt-0.5`}>{letter}</span>
    </div>
  );
}
```

- [ ] **Step 3: Update the assessment section to use the new badge and render Actions to Take**

Find the block starting `<ScoreBadge score={assessment.score} />` (around line 127) and replace the entire assessment card (the `<div className="bg-gray-900 border border-white/10 rounded-2xl p-6">` block through its closing `</div>`) with:

```tsx
        {/* ── Assessment ────────────────────────────────────────────────────── */}
        {assessment && (
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Performance Assessment</p>
            <div className="flex items-start gap-6 mb-5">
              <ScoreBadge assessment={assessment} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Coaching Summary</p>
                <p className="text-sm text-gray-300 leading-relaxed">{assessment.summary}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-4">
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-3">Strengths</p>
                <ul className="space-y-2">
                  {assessment.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-gray-300 flex gap-2">
                      <span className="text-emerald-400 shrink-0">✓</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-xl p-4">
                <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide mb-3">Focus Areas</p>
                <ul className="space-y-2">
                  {assessment.improvements.map((s, i) => (
                    <li key={i} className="text-sm text-gray-300 flex gap-2">
                      <span className="text-yellow-400 shrink-0">↑</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {assessment.actions_to_take && assessment.actions_to_take.length > 0 && (
              <div className="mt-5 border border-blue-500/20 bg-blue-500/5 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-3">Actions to Take</p>
                <ol className="space-y-4">
                  {assessment.actions_to_take.map((a, i) => (
                    <li key={i} className="text-sm text-gray-300">
                      <p className="text-xs text-gray-500 mb-1">
                        {i + 1}. When <span className="font-semibold text-white">{personaName || 'they'}</span> said:
                      </p>
                      <p className="italic text-gray-400 border-l-2 border-gray-700 pl-3 mb-2">“{a.ai_said}”</p>
                      <p className="text-gray-300">
                        <span className="text-blue-300 font-semibold">You could have said:</span> “{a.suggested_response}”
                      </p>
                      {a.technique && (
                        <p className="text-[10px] uppercase tracking-wide text-blue-400/70 mt-1">{a.technique}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
```

- [ ] **Step 4: Delete the old local `parseAssessment` return type constraint**

The existing `parseAssessment` returns `Assessment | null` — since `Assessment` is now imported and has optional `letter_grade` and `actions_to_take`, no change to `parseAssessment` is needed beyond what the import already provides. Confirm the file compiles.

- [ ] **Step 5: Verify lint + build**

Run: `cd web && npm run lint && npm run build`
Expected: both pass.

- [ ] **Step 6: Visual smoke check**

Start dev server, navigate to any existing session detail page. Expected: legacy sessions (score ≤10) render as `score × 10` with the derived letter grade. New sessions (after Task 1.2 has been run on a fresh session) render natively with letter and may show Actions to Take if the model returned any.

- [ ] **Step 7: Commit**

```bash
git add web/app/sessions/[id]/page.tsx
git commit -m "feat(sessions): show 1–100 score, letter grade, and actions-to-take"
```

---

## Task 1.4: Update session list views to use `getDisplayScore`

**Files:**
- Modify: `web/app/sessions/page.tsx` (and any other file that reads `assessment.score` for display)

- [ ] **Step 1: Find all usages**

Run: `cd web && grep -rn "assessment.score\|\\.score" app/sessions/ app/insights/ components/ 2>/dev/null`

Identify every place score is displayed as text. For each, import `getDisplayScore` from `@/lib/scoring` and replace with `const { score, letter } = getDisplayScore(assessment);`.

- [ ] **Step 2: Update `/sessions` list page**

Open `web/app/sessions/page.tsx`. Where a session row shows `score`, replace with `getDisplayScore(parsedAssessment).score` and optionally append the letter pill in a small visual.

*Concrete edit depends on current file shape — read first, then edit each display site one-by-one. Do not change the sort/filter logic.*

- [ ] **Step 3: Update `/insights` analytics if it averages scores**

Open `web/app/insights/page.tsx` (if present) and check whether it averages `assessment.score`. If so, normalize each row through `getDisplayScore` before averaging so legacy rows aren't undercounted 10x.

- [ ] **Step 4: Verify lint + build**

Run: `cd web && npm run lint && npm run build`

- [ ] **Step 5: Commit**

```bash
git add web/app/sessions/page.tsx web/app/insights/page.tsx
git commit -m "feat(sessions): normalize legacy scores through display helper"
```

---

# Phase 2 — Share page + Referrals

## Task 2.1: Database migration

**Files:**
- Create: `web/supabase/share-referral-migration.sql`

- [ ] **Step 1: Write the migration**

```sql
-- web/supabase/share-referral-migration.sql
-- Share tokens + referrals + global broadcast audit
-- Run in Supabase SQL Editor. Idempotent where practical.

-- ── 1. Share tokens on training_sessions ────────────────────────────
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS share_token       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS share_enabled_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_training_sessions_share_token
  ON training_sessions(share_token) WHERE share_token IS NOT NULL;

-- ── 2. Referrals ────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code              TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referral_credits_minutes   INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS referrals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id       UUID NOT NULL REFERENCES users(id),
  referred_id       UUID NOT NULL REFERENCES users(id) UNIQUE,
  source            TEXT NOT NULL,
  credited_minutes  INTEGER NOT NULL DEFAULT 60,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

-- ── 3. Backfill referral codes for existing users ──────────────────
-- 8-char base32 derived from the user's UUID.
UPDATE users
SET referral_code = UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;

-- ── 4. Global broadcasts audit log ──────────────────────────────────
CREATE TABLE IF NOT EXISTS global_broadcasts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by          UUID NOT NULL REFERENCES users(id),
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  link             TEXT,
  recipient_count  INTEGER NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_global_broadcasts_created ON global_broadcasts(created_at DESC);

-- ── 5. Enable Realtime on notifications for bell subscription ──────
-- Safe to run repeatedly; Supabase ignores if already added.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  EXCEPTION WHEN duplicate_object THEN
    -- already in publication
    NULL;
  END;
END $$;
```

- [ ] **Step 2: Apply the migration**

Open Supabase SQL Editor for the project, paste the migration, run it. Verify in the Table Editor:
- `training_sessions` has `share_token` and `share_enabled_at`
- `users` has `referral_code` (populated for existing rows) and `referral_credits_minutes`
- `referrals` table exists
- `global_broadcasts` table exists
- `notifications` appears in Database → Replication → `supabase_realtime` publication

- [ ] **Step 3: Commit**

```bash
git add web/supabase/share-referral-migration.sql
git commit -m "feat(db): share tokens, referrals, global broadcasts, realtime on notifications"
```

---

## Task 2.2: Referral helper module

**Files:**
- Create: `web/lib/referral.ts`

- [ ] **Step 1: Write the helper**

```ts
// web/lib/referral.ts
import { createServiceSupabase } from '@/lib/supabase-server';
import { randomBytes } from 'crypto';

/**
 * Generate an 8-character base32 code. Caller is responsible for collision retry.
 */
export function generateReferralCode(): string {
  // Crockford base32 alphabet (no I/L/O/U to avoid ambiguity)
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i] % 32];
  }
  return out;
}

export type ReferralSource = 'share_page' | 'signup_link';

/**
 * Look up a referrer by code, insert the referral, credit the referrer,
 * and fire a `referral_signup` notification.
 * Silent no-op if the code is invalid. Never throws.
 */
export async function applyReferral(
  referrerCode: string | null | undefined,
  referredUserId: string,
  referredName: string,
  source: ReferralSource,
): Promise<void> {
  if (!referrerCode) return;
  const supabase = createServiceSupabase();

  const { data: referrer } = await (supabase as any)
    .from('users')
    .select('id, referral_credits_minutes')
    .eq('referral_code', referrerCode.toUpperCase())
    .single();

  if (!referrer) return;

  const referrerId = (referrer as any).id;
  const currentCredits = (referrer as any).referral_credits_minutes ?? 0;

  // Insert referral (UNIQUE on referred_id — ignore error if already exists).
  const { error: referralError } = await (supabase as any)
    .from('referrals')
    .insert({
      referrer_id: referrerId,
      referred_id: referredUserId,
      source,
      credited_minutes: 60,
    });

  if (referralError) {
    // Most likely duplicate — already credited.
    console.warn('Referral insert skipped:', referralError.message);
    return;
  }

  // Credit the referrer +60 minutes.
  await (supabase as any)
    .from('users')
    .update({ referral_credits_minutes: currentCredits + 60 })
    .eq('id', referrerId);

  // Fire notification to referrer.
  await (supabase as any).from('notifications').insert({
    user_id: referrerId,
    type: 'referral_signup',
    title: `${referredName} joined TechRP with your link`,
    body: 'You earned 60 bonus minutes for when you hit your session cap.',
    data: { link: '/account', referred_user_id: referredUserId },
  });
}
```

- [ ] **Step 2: Verify lint + typecheck**

Run: `cd web && npm run lint && npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add web/lib/referral.ts
git commit -m "feat(referral): helper to apply referral + credit + notify"
```

---

## Task 2.3: Wire referral into signup route

**Files:**
- Modify: `web/app/api/auth/signup/route.ts`

- [ ] **Step 1: Import helpers and extend payload**

At the top of the file, add:

```ts
import { applyReferral, generateReferralCode, type ReferralSource } from '@/lib/referral';
```

Change the destructure at line 11 to include the new fields:

```ts
  const { fullName, email, password, role, companyName, scenarioAccess, coachToken, orgToken, candidateToken, marketingConsent, refCode, refSource } = await req.json();
```

- [ ] **Step 2: Generate referral_code on the default (non-candidate) insert**

Find the default profile insert at line 206 (`// 3. Insert user profile`). Update it to include the generated referral code:

```ts
  // 3. Insert user profile
  const newReferralCode = generateReferralCode();
  const { error: profileError } = await (supabase as any).from('users').insert({
    auth_user_id: authUserId,
    organization_id: organizationId,
    coach_instance_id: resolvedCoachInstanceId,
    name: fullName,
    full_name: fullName,
    email,
    role: role === 'company_admin' ? 'admin' : 'technician',
    app_role: role,
    status: autoApprove ? 'approved' : 'pending',
    scenario_access: finalScenarioAccess,
    referral_code: newReferralCode,
    tos_accepted_at: new Date().toISOString(),
  });
```

Also add `referral_code: generateReferralCode()` to the candidate insert block around line 143:

```ts
    // Insert user profile with candidate-specific fields
    const { error: candidateProfileError } = await (supabase as any).from('users').insert({
      auth_user_id: authUserId,
      organization_id: organizationId,
      coach_instance_id: resolvedCoachInstanceId,
      name: fullName,
      full_name: fullName,
      email: (invite as any).email,
      role: 'technician',
      app_role: 'individual',
      status: 'approved',
      scenario_access: finalScenarioAccess,
      session_limit: sessionLimit,
      user_type: 'candidate',
      marketing_consent: marketingConsent ?? false,
      referral_code: generateReferralCode(),
      tos_accepted_at: new Date().toISOString(),
    });
```

- [ ] **Step 3: Apply referral after successful default profile insert**

After the profile-error bail (around line 225, right before `// 4. Send approval notification`), add:

```ts
  // Look up new user's internal id for referral handling.
  if (refCode) {
    const { data: newUser } = await (supabase as any)
      .from('users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single();
    if (newUser) {
      await applyReferral(
        refCode,
        (newUser as any).id,
        fullName,
        (refSource === 'share_page' ? 'share_page' : 'signup_link') as ReferralSource,
      );
    }
  }
```

- [ ] **Step 4: Verify lint + build**

Run: `cd web && npm run lint && npm run build`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/auth/signup/route.ts
git commit -m "feat(signup): accept refCode/refSource and apply referral credit"
```

---

## Task 2.4: Surface refCode on the signup form

**Files:**
- Modify: `web/app/signup/page.tsx` (locate first — may be at `web/app/(auth)/signup/page.tsx` or similar)

- [ ] **Step 1: Find the signup page**

Run: `cd web && find app -name 'page.tsx' -path '*signup*'`
Open the file that renders the signup form.

- [ ] **Step 2: Read `ref` and `ref_source` from search params**

In the client component (or wherever the form's `fetch('/api/auth/signup', ...)` lives), read the URL search params:

```ts
import { useSearchParams } from 'next/navigation';
// ...
const searchParams = useSearchParams();
const refCode = searchParams.get('ref') ?? undefined;
const refSource = searchParams.get('ref_source') ?? undefined;
```

- [ ] **Step 3: Include in signup POST body**

When the form calls `fetch('/api/auth/signup', { ... body: JSON.stringify({ ... }) })`, add `refCode` and `refSource` to the body object alongside `fullName`, `email`, etc.

- [ ] **Step 4: Verify lint + build**

Run: `cd web && npm run lint && npm run build`

- [ ] **Step 5: Commit**

```bash
git add web/app/
git commit -m "feat(signup): forward ref code from URL to API"
```

---

## Task 2.5: Share toggle API route

**Files:**
- Create: `web/app/api/sessions/[id]/share/route.ts`

- [ ] **Step 1: Write the route**

```ts
// web/app/api/sessions/[id]/share/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: profile } = await (supabase as any)
    .from('users').select('id').eq('auth_user_id', authUser.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify session ownership.
  const { data: session } = await (supabase as any)
    .from('training_sessions')
    .select('id, user_id, share_token')
    .eq('id', params.id)
    .single();

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if ((session as any).user_id !== (profile as any).id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const enabled = body?.enabled !== false; // default enable

  if (enabled) {
    const token = randomBytes(24).toString('hex');
    await (supabase as any)
      .from('training_sessions')
      .update({ share_token: token, share_enabled_at: new Date().toISOString() })
      .eq('id', params.id);
    return NextResponse.json({ url: `${APP_URL}/share/session/${token}`, token });
  } else {
    await (supabase as any)
      .from('training_sessions')
      .update({ share_token: null })
      .eq('id', params.id);
    return NextResponse.json({ url: null });
  }
}
```

- [ ] **Step 2: Verify lint + build**

Run: `cd web && npm run lint && npm run build`

- [ ] **Step 3: Commit**

```bash
git add web/app/api/sessions/\[id\]/share/route.ts
git commit -m "feat(share): POST /api/sessions/[id]/share toggle"
```

---

## Task 2.6: Public share page

**Files:**
- Create: `web/app/share/session/[token]/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// web/app/share/session/[token]/page.tsx
import { createServiceSupabase } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import { getDisplayScore, gradeColor, type Assessment, type ActionToTake } from '@/lib/scoring';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

async function getSharedSession(token: string) {
  const supabase = createServiceSupabase();
  const { data: session } = await (supabase as any)
    .from('training_sessions')
    .select('id, user_id, started_at, ended_at, assessment, persona_name, persona_scenario_type, share_token')
    .eq('share_token', token)
    .single();
  if (!session || !(session as any).share_token) return null;

  const { data: user } = await (supabase as any)
    .from('users')
    .select('id, full_name, name, referral_code')
    .eq('id', (session as any).user_id)
    .single();

  return { session, user };
}

function parseAssessment(a: string | null): Assessment | null {
  if (!a) return null;
  try { return JSON.parse(a); } catch { return null; }
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return '—';
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function initials(name: string): string {
  return name.split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const data = await getSharedSession(params.token);
  if (!data) return { title: 'Session not found' };
  const assessment = parseAssessment((data.session as any).assessment);
  const { score, letter } = getDisplayScore(assessment);
  const name = (data.user as any)?.full_name ?? (data.user as any)?.name ?? 'A rep';
  return {
    title: `${name} scored ${score}/100 on TechRP`,
    description: assessment?.summary ?? 'Sales training roleplay scored by AI on TechRP.',
    robots: { index: false, follow: false },
    openGraph: {
      title: `${name} scored ${score}/100 (${letter}) on TechRP`,
      description: assessment?.summary ?? '',
      type: 'article',
    },
  };
}

export default async function SharePage({ params }: { params: { token: string } }) {
  const data = await getSharedSession(params.token);
  if (!data) notFound();
  const { session, user } = data;

  const assessment = parseAssessment((session as any).assessment);
  if (!assessment) notFound();

  const { score, letter } = getDisplayScore(assessment);
  const { text, ring, bg } = gradeColor(letter);
  const personaName = (session as any).persona_name;
  const scenarioType = (session as any).persona_scenario_type;
  const name = (user as any)?.full_name ?? (user as any)?.name ?? 'Rep';
  const refCode = (user as any)?.referral_code ?? '';
  const actions: ActionToTake[] = Array.isArray(assessment.actions_to_take) ? assessment.actions_to_take : [];
  const joinUrl = refCode
    ? `/signup?ref=${encodeURIComponent(refCode)}&ref_source=share_page`
    : '/signup';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600" />
            <span className="text-sm font-semibold">TechRP</span>
          </div>
          <a href={joinUrl} className="text-xs font-semibold text-blue-300 hover:text-blue-200">Join TechRP →</a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        <section className={`rounded-3xl border ${ring} ${bg} p-8 flex items-center gap-6`}>
          <div className={`w-28 h-28 rounded-full border-2 ${ring} flex flex-col items-center justify-center bg-gray-950`}>
            <span className={`text-5xl font-bold ${text} leading-none`}>{score}</span>
            <span className="text-[10px] text-gray-500 mt-1">/ 100</span>
            <span className={`text-sm font-bold ${text}`}>{letter}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-300">
                {initials(name)}
              </div>
              <p className="text-lg font-semibold">{name}</p>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Scored a <span className={`font-bold ${text}`}>{letter}</span> on a TechRP AI-graded sales training call.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Persona', value: personaName ?? '—' },
            { label: 'Scenario', value: scenarioType ?? '—' },
            { label: 'Date', value: formatDate((session as any).started_at) },
            { label: 'Duration', value: formatDuration((session as any).started_at, (session as any).ended_at) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-900 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
              <p className="text-sm font-semibold text-white leading-snug break-words">{value}</p>
            </div>
          ))}
        </section>

        <section className="bg-gray-900 border border-white/10 rounded-2xl p-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Coaching Summary</p>
          <p className="text-sm text-gray-300 leading-relaxed">{assessment.summary}</p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-5">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-3">Strengths</p>
            <ul className="space-y-2">
              {assessment.strengths.map((s, i) => (
                <li key={i} className="text-sm text-gray-300 flex gap-2">
                  <span className="text-emerald-400 shrink-0">✓</span>{s}
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-xl p-5">
            <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide mb-3">Focus Areas</p>
            <ul className="space-y-2">
              {assessment.improvements.map((s, i) => (
                <li key={i} className="text-sm text-gray-300 flex gap-2">
                  <span className="text-yellow-400 shrink-0">↑</span>{s}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {actions.length > 0 && (
          <section className="border border-blue-500/20 bg-blue-500/5 rounded-xl p-5">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-3">Actions to Take</p>
            <ol className="space-y-4">
              {actions.map((a, i) => (
                <li key={i} className="text-sm text-gray-300">
                  <p className="text-xs text-gray-500 mb-1">
                    {i + 1}. When <span className="font-semibold text-white">{personaName || 'they'}</span> said:
                  </p>
                  <p className="italic text-gray-400 border-l-2 border-gray-700 pl-3 mb-2">“{a.ai_said}”</p>
                  <p className="text-gray-300">
                    <span className="text-blue-300 font-semibold">You could have said:</span> “{a.suggested_response}”
                  </p>
                  {a.technique && (
                    <p className="text-[10px] uppercase tracking-wide text-blue-400/70 mt-1">{a.technique}</p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 p-8 text-center">
          <h2 className="text-xl font-bold mb-2">Train like {name.split(' ')[0]}.</h2>
          <p className="text-sm text-gray-300 mb-5">Practice real sales calls against AI personas. Get AI-graded feedback. Start free.</p>
          <a
            href={joinUrl}
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
          >
            Start your free TechRP account →
          </a>
        </section>

      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint + build**

Run: `cd web && npm run lint && npm run build`
Expected: builds without errors.

- [ ] **Step 3: Smoke-test**

Generate a share token for a test session by running this SQL in Supabase (replace the session id):

```sql
UPDATE training_sessions
SET share_token = 'test-share-token-abc123',
    share_enabled_at = now()
WHERE id = '<some-session-uuid>';
```

Navigate to `http://localhost:3000/share/session/test-share-token-abc123`. Expected: renders the session publicly with score, grade, persona, summary, strengths, improvements, actions to take (if any), and a Join CTA. No transcript, no recording.

Clean up: `UPDATE training_sessions SET share_token = NULL WHERE id = '<the session>'` and confirm the page now 404s.

- [ ] **Step 4: Commit**

```bash
git add web/app/share/
git commit -m "feat(share): public LinkedIn-friendly session page with referral CTA"
```

---

## Task 2.7: Share dialog on session detail page

**Files:**
- Create: `web/app/sessions/[id]/share-dialog.tsx`
- Modify: `web/app/sessions/[id]/page.tsx`

- [ ] **Step 1: Create the client component**

```tsx
// web/app/sessions/[id]/share-dialog.tsx
'use client';

import { useState } from 'react';

export function ShareDialog({ sessionId, initialToken }: { sessionId: string; initialToken: string | null }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(initialToken);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/session/${token}`
    : null;

  const toggle = async (enabled: boolean) => {
    setBusy(true);
    const res = await fetch(`/api/sessions/${sessionId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) {
      const data = await res.json();
      setToken(data.token ?? null);
    }
    setBusy(false);
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const linkedInUrl = url
    ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
    : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-blue-300 hover:text-blue-200 border border-blue-500/40 rounded-md px-3 py-1.5 transition-colors"
      >
        Share
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Share this session</h3>
            <p className="text-xs text-gray-400 mb-5">
              Creates a public link showing the score, feedback, and actions to take. The transcript and recording are not included.
            </p>

            {token && url ? (
              <>
                <div className="flex gap-2 mb-3">
                  <input
                    readOnly
                    value={url}
                    className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-200"
                  />
                  <button
                    onClick={copy}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg px-3 py-2 transition-colors"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <a
                  href={linkedInUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center bg-[#0A66C2] hover:bg-[#0959a8] text-white text-sm font-semibold rounded-lg py-2.5 mb-3 transition-colors"
                >
                  Share on LinkedIn
                </a>
                <button
                  onClick={() => toggle(false)}
                  disabled={busy}
                  className="w-full text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  {busy ? 'Working...' : 'Revoke public link'}
                </button>
              </>
            ) : (
              <button
                onClick={() => toggle(true)}
                disabled={busy}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors"
              >
                {busy ? 'Creating link...' : 'Create public link'}
              </button>
            )}

            <button
              onClick={() => setOpen(false)}
              className="w-full text-xs text-gray-500 hover:text-gray-300 mt-4 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Render it on the session detail page**

In `web/app/sessions/[id]/page.tsx`, add the import at top:

```ts
import { ShareDialog } from './share-dialog';
```

Change the `getSession` selector to include the share fields. Find:

```ts
      .from('training_sessions')
      .select('*')
```

Keep `*` as-is (already returns everything).

In the header row inside `<header>`, replace:

```tsx
          <h1 className="text-sm font-semibold text-white">Session Details</h1>
          <div className="w-20" />
```

with:

```tsx
          <h1 className="text-sm font-semibold text-white">Session Details</h1>
          <ShareDialog sessionId={params.id} initialToken={(session as any).share_token ?? null} />
```

**Owner gate:** only render the `ShareDialog` if the caller owns the session. Check for current user server-side. Add this near the top of the page component:

```ts
import { createServerSupabase } from '@/lib/supabase-server';
// ...
async function getCurrentUserId(): Promise<string | null> {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return null;
  const svc = createServiceSupabase();
  const { data } = await (svc as any).from('users').select('id').eq('auth_user_id', authUser.id).single();
  return (data as any)?.id ?? null;
}
```

And in the component:

```ts
  const currentUserId = await getCurrentUserId();
  const isOwner = currentUserId && currentUserId === (session as any).user_id;
```

Then wrap the `<ShareDialog .../>` in `{isOwner && ...}`.

- [ ] **Step 3: Verify lint + build**

Run: `cd web && npm run lint && npm run build`

- [ ] **Step 4: Smoke-test**

Log in as the session owner, visit `/sessions/<id>`, click Share, click "Create public link", verify the copy button fills the clipboard, and click LinkedIn — it should open LinkedIn's share dialog prefilled with the URL. Revoke and verify the public URL now 404s.

- [ ] **Step 5: Commit**

```bash
git add web/app/sessions/\[id\]/share-dialog.tsx web/app/sessions/\[id\]/page.tsx
git commit -m "feat(sessions): share dialog with LinkedIn + revoke"
```

---

# Phase 3 — Notification types + Realtime

## Task 3.1: Trigger notifications on coach connection request

**Files:**
- Modify: `web/app/api/company/coaches/route.ts`

- [ ] **Step 1: Insert notification to the coach when a company admin requests a connection**

In `web/app/api/company/coaches/route.ts`, after the `sendCoachApprovalRequest` email try/catch block (around line 147), add:

```ts
  // In-app notification to the coach that someone wants them as their coach.
  const { data: coachProfile } = await (supabase as any)
    .from('users')
    .select('id')
    .eq('coach_instance_id', (coachInstance as any).id)
    .eq('app_role', 'coach')
    .single();

  if (coachProfile) {
    await (supabase as any).from('notifications').insert({
      user_id: (coachProfile as any).id,
      type: 'coach_added_by_user',
      title: `${(org as any)?.name ?? 'A company'} added you as their coach`,
      body: 'Review and accept the connection request to gain access.',
      data: { link: '/coach', organization_id: profile.organization_id },
    });
  }
```

- [ ] **Step 2: Verify lint + build**

Run: `cd web && npm run lint && npm run build`

- [ ] **Step 3: Commit**

```bash
git add web/app/api/company/coaches/route.ts
git commit -m "feat(notifications): notify coach when company adds them"
```

---

## Task 3.2: Trigger notification on coach connection accept

**Files:**
- Modify: `web/app/api/coach/connections/[connectionId]/respond/route.ts`

- [ ] **Step 1: Insert notification to the company admin when the coach accepts**

In the `if (action === 'accept')` branch, inside the existing `Promise.all` that already fetches `adminUser`, after the `sendConnectionAccepted` try/catch, add:

```ts
    // In-app notification to the company admin.
    if ((adminUser as any)) {
      const { data: adminProfile } = await (supabase as any)
        .from('users')
        .select('id')
        .eq('email', (adminUser as any).email)
        .eq('app_role', 'company_admin')
        .single();
      if (adminProfile) {
        await (supabase as any).from('notifications').insert({
          user_id: (adminProfile as any).id,
          type: 'coach_assigned',
          title: `${(coachUser as any)?.full_name ?? 'Your coach'} accepted the connection`,
          body: `They now have access to ${(org as any)?.name ?? 'your company'}'s data on TechRP.`,
          data: { link: '/playbooks' },
        });
      }
    }
```

- [ ] **Step 2: Verify lint + build**

Run: `cd web && npm run lint && npm run build`

- [ ] **Step 3: Commit**

```bash
git add web/app/api/coach/connections/\[connectionId\]/respond/route.ts
git commit -m "feat(notifications): notify company admin when coach accepts"
```

---

## Task 3.3: Realtime upgrade in notification bell + clickable links

**Files:**
- Modify: `web/components/notification-bell.tsx`

- [ ] **Step 1: Switch polling to Realtime subscription and handle `data.link`**

Replace the entire file contents with:

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  data?: Record<string, unknown> | null;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = async () => {
    const res = await fetch('/api/notifications');
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications ?? []);
    setUnreadCount(data.unreadCount ?? 0);
    if (data.notifications && data.notifications.length > 0) {
      // Pull profile id for realtime filter (API already scopes to the user server-side).
      const first = data.notifications[0] as Notification & { user_id?: string };
      if (first.user_id) setProfileId(first.user_id as string);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Safety poll every 5 minutes in case the realtime channel drops.
    const interval = setInterval(fetchNotifications, 300_000);
    return () => clearInterval(interval);
  }, []);

  // Realtime subscription — subscribes once profileId is known.
  useEffect(() => {
    if (!profileId) return;
    const channel = supabase
      .channel(`notifications:${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profileId}`,
        },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications((prev) => [n, ...prev].slice(0, 50));
          setUnreadCount((c) => c + 1);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profileId]);

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

  const handleClick = async (n: Notification) => {
    await markOneRead(n.id);
    const link = (n.data as Record<string, unknown> | null)?.link;
    if (typeof link === 'string' && link.length > 0) {
      setOpen(false);
      router.push(link);
    }
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
                  onClick={() => handleClick(n)}
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

- [ ] **Step 2: Include `user_id` in the `/api/notifications` response so the bell can subscribe**

Modify `web/app/api/notifications/route.ts` GET handler. Change the select to include `user_id` (already stored). Find:

```ts
  const { data: notifications } = await (supabase as any)
    .from('notifications')
    .select('*')
```

This already returns `user_id`. No change needed — `select('*')` covers it. The bell reads `user_id` off the first notification. If there are zero notifications, realtime silently won't start until the next safety-poll picks up an inserted row; this is an acceptable trade-off for brand-new users. Confirm no edit needed here.

- [ ] **Step 3: Verify lint + build**

Run: `cd web && npm run lint && npm run build`
Expected: build passes. If `@supabase/supabase-js` import fails, check it's in `web/package.json` (it already is — used in auth provider).

- [ ] **Step 4: Smoke-test**

1. Open `/sessions` while logged in as any user.
2. In a second browser tab, open Supabase SQL Editor and insert a fake notification:

```sql
INSERT INTO notifications (user_id, type, title, body, data)
SELECT id, 'test', 'Realtime test', 'Hello from the DB', '{"link":"/sessions"}'::jsonb
FROM users
WHERE email = '<your test email>'
LIMIT 1;
```

3. Expected: the bell badge in the first tab bumps from 0 to 1 within a couple of seconds without a page refresh. Opening the bell and clicking the notification navigates to `/sessions`.

- [ ] **Step 5: Commit**

```bash
git add web/components/notification-bell.tsx
git commit -m "feat(notifications): realtime subscription and clickable links"
```

---

# Phase 4 — Superuser global broadcast

## Task 4.1: Broadcast API route

**Files:**
- Create: `web/app/api/admin/notifications/broadcast/route.ts`

- [ ] **Step 1: Write the route**

```ts
// web/app/api/admin/notifications/broadcast/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

async function requireSuperuser() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return null;
  const supabase = createServiceSupabase();
  const { data } = await (supabase as any)
    .from('users')
    .select('id, app_role')
    .eq('auth_user_id', authUser.id)
    .single();
  if (!data || (data as any).app_role !== 'superuser') return null;
  return data as { id: string };
}

export async function GET() {
  const me = await requireSuperuser();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createServiceSupabase();
  const { data: history } = await (supabase as any)
    .from('global_broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ history: history ?? [] });
}

export async function POST(request: NextRequest) {
  const me = await requireSuperuser();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { title, body, link } = await request.json();

  if (typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }
  if (typeof body !== 'string' || body.trim().length === 0) {
    return NextResponse.json({ error: 'Body is required' }, { status: 400 });
  }

  const supabase = createServiceSupabase();

  // Fetch all approved users.
  const { data: recipients } = await (supabase as any)
    .from('users')
    .select('id')
    .eq('status', 'approved');

  const ids: string[] = ((recipients ?? []) as { id: string }[]).map((u) => u.id);
  if (ids.length === 0) {
    return NextResponse.json({ error: 'No approved users' }, { status: 400 });
  }

  const linkValue = typeof link === 'string' && link.trim().length > 0 ? link.trim() : null;
  const data = linkValue ? { link: linkValue } : null;

  // Bulk insert.
  const rows = ids.map((user_id) => ({
    user_id,
    type: 'global_broadcast',
    title: title.trim(),
    body: body.trim(),
    data,
  }));

  const { error: insertError } = await (supabase as any)
    .from('notifications')
    .insert(rows);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await (supabase as any).from('global_broadcasts').insert({
    sent_by: me.id,
    title: title.trim(),
    body: body.trim(),
    link: linkValue,
    recipient_count: ids.length,
  });

  return NextResponse.json({ recipient_count: ids.length });
}
```

- [ ] **Step 2: Verify lint + build**

Run: `cd web && npm run lint && npm run build`

- [ ] **Step 3: Commit**

```bash
git add web/app/api/admin/notifications/broadcast/route.ts
git commit -m "feat(broadcast): superuser global notification API"
```

---

## Task 4.2: Broadcast admin page

**Files:**
- Create: `web/app/admin/notifications/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// web/app/admin/notifications/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';

interface BroadcastRow {
  id: string;
  title: string;
  body: string;
  link: string | null;
  recipient_count: number;
  created_at: string;
}

export default function BroadcastPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<BroadcastRow[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== 'superuser') router.replace('/');
  }, [user, router]);

  const loadHistory = async () => {
    const res = await fetch('/api/admin/notifications/broadcast');
    if (res.ok) {
      const data = await res.json();
      setHistory(data.history ?? []);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  const send = async () => {
    if (!title.trim() || !body.trim()) return;
    if (!confirm(`Send this notification to ALL approved users?`)) return;
    setBusy(true);
    const res = await fetch('/api/admin/notifications/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, link: link || undefined }),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json();
      setToast(`Sent to ${data.recipient_count} users`);
      setTimeout(() => setToast(null), 3000);
      setTitle(''); setBody(''); setLink('');
      loadHistory();
    } else {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      setToast(`Error: ${err.error}`);
      setTimeout(() => setToast(null), 4000);
    }
  };

  if (!user || user.role !== 'superuser') {
    return <div className="min-h-screen bg-gray-950 text-white p-10">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <header>
          <h1 className="text-2xl font-bold">Global Broadcast</h1>
          <p className="text-sm text-gray-400 mt-1">Send a notification to every approved TechRP user.</p>
        </header>

        <section className="bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm"
              placeholder="What's happening?"
              maxLength={120}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm h-24"
              placeholder="More details..."
              maxLength={500}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Link (optional)</label>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm"
              placeholder="/playbooks or https://..."
            />
          </div>
          <button
            onClick={send}
            disabled={busy || !title.trim() || !body.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            {busy ? 'Sending...' : 'Send to all approved users'}
          </button>
          {toast && <p className="text-xs text-emerald-400">{toast}</p>}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">History</h2>
          {history.length === 0 ? (
            <p className="text-xs text-gray-600">No broadcasts yet.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="bg-gray-900 border border-white/10 rounded-xl p-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{h.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{h.body}</p>
                      {h.link && <p className="text-[10px] text-blue-400 mt-1">→ {h.link}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-500">{new Date(h.created_at).toLocaleDateString()}</p>
                      <p className="text-[10px] text-gray-600">{h.recipient_count} users</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add nav link for superusers**

Modify `web/components/nav.tsx`. In the `superuser` block (line 11–19), add the broadcast link:

```ts
  if (user.role === 'superuser') {
    return [
      { href: '/admin/users',         label: 'Users'     },
      { href: '/admin',               label: 'Coaches'   },
      { href: '/playbooks',           label: 'Playbooks' },
      { href: '/personas',            label: 'Personas'  },
      { href: '/insights',            label: 'Analytics' },
      { href: '/admin/notifications', label: 'Broadcast' },
    ];
  }
```

- [ ] **Step 3: Verify lint + build**

Run: `cd web && npm run lint && npm run build`
Expected: both pass.

- [ ] **Step 4: Smoke-test**

1. Log in as a superuser, navigate to `/admin/notifications`.
2. Fill in Title + Body, click Send, confirm the dialog. Expect toast "Sent to N users" and the history list updates.
3. In another browser tab (still superuser), check the bell — a `global_broadcast` notification should appear within a couple seconds (realtime). Click it; if a link was provided, it should navigate there.
4. Log in as a non-superuser and hit `/admin/notifications` directly — should redirect to `/`.

- [ ] **Step 5: Commit**

```bash
git add web/app/admin/notifications/page.tsx web/components/nav.tsx
git commit -m "feat(broadcast): superuser page + nav link"
```

---

# Phase 5 — Documentation

## Task 5.1: Update TODO.md and CLAUDE.md

**Files:**
- Modify: `TODO.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add TODO.md entries**

Open `TODO.md`. Add a new section near the top (after "Auth & Users" or as a new section):

```markdown
## Referrals & Billing

- [ ] Referral credit redemption — when billing/minute-cap lands, consume `users.referral_credits_minutes` before blocking users who hit their session cap. Referral tracking already writes to this column.

## Notifications (scale)

- [ ] Global broadcast scale path — when active user count grows past ~5k, switch `POST /api/admin/notifications/broadcast` from fan-out insert into `notifications` to a `global_notifications` table + `dismissed_global_notifications` join table, with the bell unioning personal + undismissed globals.
```

- [ ] **Step 2: Update CLAUDE.md Web API Routes table**

In `CLAUDE.md` under the `### Web API Routes` table, add these rows (keep the existing formatting):

```markdown
| `POST /api/sessions/[id]/share` | Toggle public share link for a session (owner-only) |
| `POST /api/admin/notifications/broadcast` | Superuser: send a notification to all approved users |
| `GET /api/admin/notifications/broadcast` | Superuser: list broadcast history |
```

Also update the `### Database` section to mention new columns: add a bullet after the key relationships list:

```markdown
- `training_sessions.share_token` (nullable) enables a public read-only share page at `/share/session/[token]`
- `users.referral_code` (unique) powers `/signup?ref=CODE` referral tracking; `users.referral_credits_minutes` holds earned bonus minutes
```

- [ ] **Step 3: Verify nothing broke**

Run: `cd web && npm run lint && npm run build`
Expected: passes (docs changes don't affect build; this is a sanity check).

- [ ] **Step 4: Commit**

```bash
git add TODO.md CLAUDE.md
git commit -m "docs: TODO + architecture notes for grading/share/notifications work"
```

---

# Completion

After all tasks are done, run the full verification suite:

- [ ] **Final check: lint + build**

```bash
cd web && npm run lint && npm run build
```

- [ ] **Final check: end-to-end smoke**

1. Log in as a test user. Run a training session (or use a recent one). Verify: new assessments come back with score 1–100, a letter grade, and (probably) actions_to_take items.
2. Open a session detail page. Verify: score badge shows 1–100 + letter, Actions to Take section renders if non-empty, Share button is visible.
3. Click Share → Create Link → Copy → open the public URL in an incognito tab. Verify: public page renders with score/letter/persona/summary/strengths/improvements/actions/CTA, no transcript, no recording, noindex in page source.
4. Click the Join CTA. Verify: `/signup?ref=<code>&ref_source=share_page` is the target.
5. Sign up a new test user via that link. Verify: `referrals` row exists, referrer's `referral_credits_minutes` incremented by 60, and the original user's bell gets a `referral_signup` notification in realtime.
6. As a superuser, visit `/admin/notifications`, send a broadcast. Verify: recipient count matches, history updates, other logged-in users' bells pop the broadcast in realtime, clicking navigates to the link.
7. As a company admin, add a coach via their invite code. Verify: the coach gets a `coach_added_by_user` notification. As the coach, accept the connection. Verify: the company admin gets a `coach_assigned` notification.
