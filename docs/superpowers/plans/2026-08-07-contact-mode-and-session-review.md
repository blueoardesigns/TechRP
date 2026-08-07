# Contact Mode & Shared Session Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let reps pick how they're contacting a persona (phone / cold visit / scheduled visit) on nine scenarios, and turn the public session share link into a review page where anyone with the URL can hear the recording and leave comments pinned to individual transcript lines that surface during playback.

**Architecture:** Feature 1 adds a `ContactMode` value that flows from a picker on the pre-call screen into the Vapi system-prompt modifier chain and the opening-message strategy — no persona data is edited. Feature 2 adds a `share_mode` discriminator on `training_sessions` plus a `session_comments` table, exposes token-authorized public routes for recording playback and comments, and renders one shared review component on both the public share page and the owner's session page.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres + service-role client), Vitest, Vapi Web SDK, React Native / Expo SDK 52, Cloudflare R2 via `@aws-sdk/client-s3`.

**Spec:** [docs/superpowers/specs/2026-08-07-contact-mode-and-session-review-design.md](../specs/2026-08-07-contact-mode-and-session-review-design.md)

## Global Constraints

- Tests are Vitest. Run from `web/` with `npm test`. Test files live in `web/__tests__/*.test.ts` and mock route dependencies with `vi.mock` — they never touch a real database. Follow the style of `web/__tests__/recording-route.test.ts`.
- Never run a dev server with `Bash`. Use the preview tooling; the app requires port 3000.
- `ContactMode` default is `'phone'`. With `'phone'` selected, Vapi call overrides must be byte-identical to today's.
- `homeowner_inbound` and `homeowner_facetime` never show a contact-mode picker.
- The four `*_discovery` scenarios expose exactly two modes: `'phone'` and `'scheduled_visit'` (labeled "In-Person Meeting").
- `share_mode` defaults to `'summary'`. Every share link that exists today must keep rendering exactly what it renders today.
- Anonymous comment identity is name-only by design. Never add an email or account requirement.
- SQL migrations are standalone files in `web/supabase/*.sql`, idempotent (`IF NOT EXISTS`), and are applied by hand — no migration runner.
- Every public API route must be added to `PUBLIC_PREFIXES` in `web/middleware.ts` and must enforce its own authorization.
- `TODO.md` is gitignored; force-add with `git add -f TODO.md` if you update it.
- Commit messages end with `Co-Authored-By: WOZCODE <contact@withwoz.com>`.

---

## File Structure

**Feature 1 — Contact Mode**

| File | Responsibility |
|---|---|
| `web/lib/contact-mode.ts` | **Create.** `ContactMode` type, option derivation, labels, prompt modifiers, type guard. Pure — no React, no DB. |
| `web/__tests__/contact-mode.test.ts` | **Create.** Unit tests for option derivation and modifier text. |
| `web/app/training/page.tsx` | **Modify.** Picker UI, state, modifier + `firstMessageMode` wiring, save payload. |
| `web/supabase/contact-mode-migration.sql` | **Create.** `training_sessions.contact_mode` column. |
| `web/lib/training-sessions.ts` | **Modify.** Carry `contactMode` into the insert payload. |
| `web/app/sessions/[id]/page.tsx` | **Modify.** Display contact mode in the metadata card. |
| `web/app/api/assess/route.ts` | **Modify.** Include contact mode in the persona context. |
| `mobile/lib/contact-mode.ts` | **Create.** Mirror of the web module (matches the existing deliberate duplication of `SCENARIOS`). |
| `mobile/app/(tabs)/train/pre-call.tsx` | **Modify.** Picker UI, passes mode as a route param. |
| `mobile/app/(tabs)/train/call.tsx` | **Modify.** Modifier + `firstMessageMode` wiring, save payload. |

**Feature 2 — Share review & comments**

| File | Responsibility |
|---|---|
| `web/supabase/session-comments-migration.sql` | **Create.** `share_mode` column, `session_comments` table, RLS. |
| `web/lib/recording.ts` | **Create.** R2 object-key derivation + presign, extracted from the existing route. |
| `web/app/api/recording/route.ts` | **Modify.** Consume `web/lib/recording.ts`. |
| `web/lib/transcript.ts` | **Create.** Transcript parsing + per-message offset computation. |
| `web/lib/share-access.ts` | **Create.** Share-token → review session authorization. |
| `web/lib/rate-limit.ts` | **Create.** Best-effort in-memory IP throttle. |
| `web/app/api/sessions/[id]/share/route.ts` | **Modify.** Accept and persist `mode`. |
| `web/app/api/share/[token]/recording/route.ts` | **Create.** Token-authorized presign. |
| `web/app/api/share/[token]/comments/route.ts` | **Create.** GET list, POST create. |
| `web/app/api/share/[token]/comments/[commentId]/route.ts` | **Create.** DELETE by author token or owner. |
| `web/middleware.ts` | **Modify.** Add `/api/share/` to `PUBLIC_PREFIXES`. |
| `web/components/session-review/transcript-review.tsx` | **Create.** Transcript + inline comment threads + composer. |
| `web/components/session-review/review-player.tsx` | **Create.** Sticky player, seek, `timeupdate` sync, comment surfacing. |
| `web/components/session-review/types.ts` | **Create.** Shared props/DTO types for the two components. |
| `web/app/share/session/[token]/page.tsx` | **Modify.** Render the review section when `share_mode = 'review'`. |
| `web/app/sessions/[id]/page.tsx` | **Modify.** Replace the inline transcript block with the shared component. |
| `web/app/sessions/[id]/share-dialog.tsx` | **Modify.** Mode selector + corrected copy. |

---

## Task 1: Contact mode module

**Files:**
- Create: `web/lib/contact-mode.ts`
- Test: `web/__tests__/contact-mode.test.ts`

**Interfaces:**
- Consumes: `ScenarioConfig`, `ScenarioGroup` from `web/lib/personas.ts`.
- Produces:
  - `type ContactMode = 'phone' | 'cold_visit' | 'scheduled_visit'`
  - `interface ContactModeOption { value: ContactMode; label: string }`
  - `getContactModeOptions(scenario: ScenarioConfig): ContactModeOption[]`
  - `getContactModeModifier(mode: ContactMode, group: ScenarioGroup): string`
  - `isContactMode(value: unknown): value is ContactMode`
  - `contactModeLabel(mode: ContactMode, scenario: ScenarioConfig): string`

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/contact-mode.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  getContactModeOptions,
  getContactModeModifier,
  isContactMode,
  contactModeLabel,
} from '../lib/contact-mode'
import { getScenarioConfig } from '../lib/personas'

describe('getContactModeOptions', () => {
  // The two homeowner scenarios already encode their channel in the scenario
  // itself, so offering a channel picker there would contradict the persona.
  it('offers no options for scenarios that already fix the channel', () => {
    expect(getContactModeOptions(getScenarioConfig('homeowner_inbound'))).toEqual([])
    expect(getContactModeOptions(getScenarioConfig('homeowner_facetime'))).toEqual([])
  })

  it('offers all three modes on a technician cold-call scenario, in inspection language', () => {
    expect(getContactModeOptions(getScenarioConfig('plumber_lead'))).toEqual([
      { value: 'phone', label: 'Phone Call' },
      { value: 'cold_visit', label: 'Cold Inspection' },
      { value: 'scheduled_visit', label: 'Scheduled Inspection' },
    ])
  })

  it('uses business-development language on a bizdev cold-call scenario', () => {
    expect(getContactModeOptions(getScenarioConfig('insurance_broker'))).toEqual([
      { value: 'phone', label: 'Phone Call' },
      { value: 'cold_visit', label: 'Cold Walk-In' },
      { value: 'scheduled_visit', label: 'Scheduled Meeting' },
    ])
  })

  // A discovery meeting is scheduled by definition — "cold" would contradict
  // the persona prompt, which assumes the meeting was arranged in advance.
  it('drops the cold option on discovery scenarios', () => {
    expect(getContactModeOptions(getScenarioConfig('plumber_bd_discovery'))).toEqual([
      { value: 'phone', label: 'Phone Call' },
      { value: 'scheduled_visit', label: 'In-Person Meeting' },
    ])
  })
})

describe('getContactModeModifier', () => {
  // Phone is the pre-existing behavior; emitting anything would change every
  // call that has ever been run.
  it('adds nothing for a phone call', () => {
    expect(getContactModeModifier('phone', 'technician')).toBe('')
    expect(getContactModeModifier('phone', 'bizdev')).toBe('')
  })

  it('tells a scheduled-visit persona they arranged this on an earlier call', () => {
    const mod = getContactModeModifier('scheduled_visit', 'technician')
    expect(mod).toContain('[CONTACT MODE: SCHEDULED IN-PERSON VISIT]')
    expect(mod.toLowerCase()).toContain('spoke')
    expect(mod.toLowerCase()).toContain('vague')
  })

  it('tells a cold-visit persona the arrival is unannounced', () => {
    const mod = getContactModeModifier('cold_visit', 'bizdev')
    expect(mod).toContain('[CONTACT MODE: UNANNOUNCED IN-PERSON VISIT]')
    expect(mod.toLowerCase()).toContain('not expecting')
  })

  // The 650 persona seeds hard-code phone-flavored openers such as "gave me
  // your number". This instruction is what keeps them coherent in person
  // without editing a single seed.
  it('forbids phone references in the opening line for every in-person mode', () => {
    for (const mode of ['cold_visit', 'scheduled_visit'] as const) {
      for (const group of ['technician', 'bizdev'] as const) {
        const mod = getContactModeModifier(mode, group)
        expect(mod).toContain('[OPENING]')
        expect(mod).toContain('your number')
      }
    }
  })

  it('ends with a blank-line separator so it concatenates cleanly', () => {
    expect(getContactModeModifier('cold_visit', 'technician').endsWith('\n\n')).toBe(true)
  })
})

describe('isContactMode', () => {
  it('accepts the three valid modes', () => {
    expect(isContactMode('phone')).toBe(true)
    expect(isContactMode('cold_visit')).toBe(true)
    expect(isContactMode('scheduled_visit')).toBe(true)
  })

  it('rejects anything else, so API callers cannot inject a value', () => {
    expect(isContactMode('carrier_pigeon')).toBe(false)
    expect(isContactMode(null)).toBe(false)
    expect(isContactMode(undefined)).toBe(false)
    expect(isContactMode(3)).toBe(false)
  })
})

describe('contactModeLabel', () => {
  it('labels a stored mode for display on the session page', () => {
    expect(contactModeLabel('scheduled_visit', getScenarioConfig('plumber_lead')))
      .toBe('Scheduled Inspection')
    expect(contactModeLabel('phone', getScenarioConfig('insurance_broker_discovery')))
      .toBe('Phone Call')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run __tests__/contact-mode.test.ts`
Expected: FAIL — `Failed to resolve import "../lib/contact-mode"`.

- [ ] **Step 3: Write the implementation**

Create `web/lib/contact-mode.ts`:

```ts
// web/lib/contact-mode.ts
//
// How the rep is reaching this persona. Scenarios other than the two homeowner
// ones are channel-agnostic: the same persona can be called, dropped in on, or
// visited by appointment. The 650 persona seeds in all-personas.ts are written
// phone-first ("gave me your number"), so in-person modes replace the canned
// opening with a model-generated one and instruct the persona never to
// reference a phone. That keeps every seed usable in every mode with no data
// migration.
import type { ScenarioConfig, ScenarioGroup } from './personas';

export type ContactMode = 'phone' | 'cold_visit' | 'scheduled_visit';

export interface ContactModeOption {
  value: ContactMode;
  label: string;
}

/** Scenarios whose channel is already fixed by the scenario itself. */
const FIXED_CHANNEL_SCENARIOS = ['homeowner_inbound', 'homeowner_facetime'];

function visitLabels(group: ScenarioGroup): { cold: string; scheduled: string } {
  return group === 'technician'
    ? { cold: 'Cold Inspection', scheduled: 'Scheduled Inspection' }
    : { cold: 'Cold Walk-In', scheduled: 'Scheduled Meeting' };
}

export function getContactModeOptions(scenario: ScenarioConfig): ContactModeOption[] {
  if (FIXED_CHANNEL_SCENARIOS.includes(scenario.type)) return [];

  // A discovery meeting is scheduled by definition, so "cold" is meaningless
  // there and the remaining in-person option needs neutral wording.
  if (scenario.callType === 'discovery') {
    return [
      { value: 'phone', label: 'Phone Call' },
      { value: 'scheduled_visit', label: 'In-Person Meeting' },
    ];
  }

  const { cold, scheduled } = visitLabels(scenario.group);
  return [
    { value: 'phone', label: 'Phone Call' },
    { value: 'cold_visit', label: cold },
    { value: 'scheduled_visit', label: scheduled },
  ];
}

export function contactModeLabel(mode: ContactMode, scenario: ScenarioConfig): string {
  const match = getContactModeOptions(scenario).find(o => o.value === mode);
  return match?.label ?? 'Phone Call';
}

export function isContactMode(value: unknown): value is ContactMode {
  return value === 'phone' || value === 'cold_visit' || value === 'scheduled_visit';
}

/**
 * Never reference a phone in the opening. This is the single instruction that
 * lets phone-written persona seeds open coherently in person.
 */
const OPENING_RULE = `[OPENING] Open the conversation yourself, in character, in one or two spoken sentences appropriate to someone who has just walked up to you in person. Do NOT reference giving out your number, being given your number, calling anyone, or being called — none of that happened. React to a person physically in front of you.\n\n`;

const COLD_VISIT = (group: ScenarioGroup) =>
  `[CONTACT MODE: UNANNOUNCED IN-PERSON VISIT] This person has shown up ${group === 'technician' ? 'at your home' : 'at your place of business'} without an appointment. You were not expecting anyone and no one arranged this. Your first reaction is to whoever has just interrupted your ${group === 'technician' ? 'day' : 'workday'} — mild surprise, and a need to know who they are and why they are here before you engage.\n\n` +
  OPENING_RULE;

const SCHEDULED_VISIT = (group: ScenarioGroup) =>
  `[CONTACT MODE: SCHEDULED IN-PERSON VISIT] You spoke by phone with someone from this company earlier to arrange this ${group === 'technician' ? 'visit' : 'meeting'}, and they are now here at the agreed time. You may or may not have given that person detail about your situation on that call — you genuinely do not remember exactly what you shared. If the rep references something you supposedly told the office, go along with it vaguely ("I think that's right, yeah") rather than denying it or inventing precise specifics. You are expecting them, so you are not startled — but being expected is not the same as being sold.\n\n` +
  OPENING_RULE;

export function getContactModeModifier(mode: ContactMode, group: ScenarioGroup): string {
  if (mode === 'phone') return '';
  return mode === 'cold_visit' ? COLD_VISIT(group) : SCHEDULED_VISIT(group);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run __tests__/contact-mode.test.ts`
Expected: PASS — 12 tests.

- [ ] **Step 5: Commit**

```bash
git add web/lib/contact-mode.ts web/__tests__/contact-mode.test.ts
git commit -m "feat(training): add contact mode options and prompt modifiers

Co-Authored-By: WOZCODE <contact@withwoz.com>"
```

---

## Task 2: Wire the contact mode picker into the web training flow

**Files:**
- Modify: `web/app/training/page.tsx` (state near line 249, modifier chain near line 461, overrides near line 475, picker UI after the Payment Type block at line 796)

**Interfaces:**
- Consumes: `ContactMode`, `getContactModeOptions`, `getContactModeModifier` from Task 1.
- Produces: `contactModeRef.current` readable by the save path in Task 3.

- [ ] **Step 1: Add the import**

At the top of `web/app/training/page.tsx`, beside the existing `@/lib/personas` import:

```tsx
import {
  type ContactMode,
  getContactModeOptions,
  getContactModeModifier,
} from '@/lib/contact-mode';
```

- [ ] **Step 2: Add state and a ref**

Next to `const [paymentType, setPaymentType] = useState<PaymentType>('random');` (line ~249):

```tsx
const [contactMode, setContactMode] = useState<ContactMode>('phone');
const contactModeRef = useRef<ContactMode>('phone');
```

Beside the existing `useEffect(() => { paymentTypeRef.current = paymentType; }, [paymentType]);` (line ~369):

```tsx
useEffect(() => { contactModeRef.current = contactMode; }, [contactMode]);
```

And in the reset that runs alongside `setPaymentType('random');` (line ~388), add:

```tsx
setContactMode('phone');
```

- [ ] **Step 3: Feed the modifier into the system prompt**

In `startCall`, the chain at line ~461 becomes — note `getContactModeModifier` goes first so the channel frames everything after it:

```tsx
const systemPrompt =
  DIFFICULTY_MODIFIERS[difficultyRef.current] +
  getContactModeModifier(contactModeRef.current, scenarioConfig.group) +
  (scenarioConfig.group === 'bizdev' ? RESTORATION_BD_CONTEXT : '') +
  getBusyModifier(selectedPersona.personalityType, scenarioConfig.group) +
  RAPPORT_BEHAVIOR +
  (scenarioConfig.group === 'technician'
    ? getPaymentModifier(paymentTypeRef.current, selectedPersona.scenarioType)
    : '') +
  selectedPersona.systemPrompt +
  TIMING_INSTRUCTIONS +
  getInterruptInstructions(selectedPersona.personalityType);
```

- [ ] **Step 4: Switch the opening strategy**

Replace the `firstMessage` line inside `sharedOverrides` (line ~475) with a spread, so the phone path is byte-identical to today and the in-person path lets the model open in character:

```tsx
// Phone keeps the persona's hand-written opener. The in-person modes drop it:
// the seeds are phone-flavored ("gave me your number"), so the persona opens
// from the [OPENING] rule in the contact-mode modifier instead.
const openingOverrides = contactModeRef.current === 'phone'
  ? { firstMessage: selectedPersona.firstMessage }
  : { firstMessageMode: 'assistant-speaks-first-with-model-generated-message' as const };

const sharedOverrides = {
  artifactPlan: { recordingFormat: 'mp3' as const },
  voice: { provider: '11labs', voiceId, model: 'eleven_flash_v2_5', speed: 1.07 },
  ...openingOverrides,
  maxDurationSeconds: 600,
  stopSpeakingPlan: {
    numWords: 0,
    voiceSeconds: 0.1,
    backoffSeconds: 0.5,
  },
};
```

- [ ] **Step 5: Render the picker**

Immediately after the closing `)}` of the Payment Type block (line ~821), add. It renders for both groups, unlike Payment Type, and renders nothing when the scenario fixes its own channel:

```tsx
{/* Contact Mode — hidden on scenarios whose channel is already fixed */}
{getContactModeOptions(scenario).length > 0 && (
  <div className="mb-8">
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">How are you reaching them?</p>
    <div className="flex gap-2">
      {getContactModeOptions(scenario).map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setContactMode(value)}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${
            contactMode === value
              ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40'
              : 'bg-transparent text-gray-600 border-white/10 hover:border-white/20 hover:text-gray-400'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 6: Verify in the browser**

Start the preview with `preview_start` (config name for the Next dev server), navigate to `/training`, and confirm with `read_page`:
- `plumber_lead` preview shows three buttons: Phone Call / Cold Inspection / Scheduled Inspection.
- `insurance_broker` shows Phone Call / Cold Walk-In / Scheduled Meeting.
- `plumber_bd_discovery` shows exactly two buttons, the second labeled "In-Person Meeting".
- `homeowner_inbound` and `homeowner_facetime` show no such block.
- Phone Call is preselected everywhere.

Then run `read_console_messages` with `onlyErrors: true` and confirm it is empty.

- [ ] **Step 7: Lint**

Run: `cd web && npx next lint`
Expected: no new errors in `app/training/page.tsx`.

- [ ] **Step 8: Commit**

```bash
git add web/app/training/page.tsx
git commit -m "feat(training): contact mode picker drives prompt and opening line

Co-Authored-By: WOZCODE <contact@withwoz.com>"
```

---

## Task 3: Persist contact mode on the session

**Files:**
- Create: `web/supabase/contact-mode-migration.sql`
- Modify: `web/lib/training-sessions.ts:1-35`
- Modify: `web/app/training/page.tsx` (save call, line ~574)
- Modify: `web/app/sessions/[id]/page.tsx` (select at line ~114 context, metadata card line ~275)
- Modify: `web/app/api/assess/route.ts` (persona context)

**Interfaces:**
- Consumes: `ContactMode`, `contactModeLabel`, `isContactMode` from Task 1.
- Produces: `training_sessions.contact_mode` column, readable by later tasks and by `/api/assess`.

- [ ] **Step 1: Write the migration**

Create `web/supabase/contact-mode-migration.sql`:

```sql
-- Record how the rep reached the persona on a training call.
--
-- NULL means the session predates this feature; read it as 'phone', which is
-- what every historical call was.
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS contact_mode TEXT;

ALTER TABLE training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_contact_mode_check;

ALTER TABLE training_sessions
  ADD CONSTRAINT training_sessions_contact_mode_check
  CHECK (contact_mode IS NULL OR contact_mode IN ('phone', 'cold_visit', 'scheduled_visit'));
```

- [ ] **Step 2: Apply the migration**

Run the file's contents in the Supabase SQL editor for the project. Confirm with:

```sql
select column_name from information_schema.columns
where table_name = 'training_sessions' and column_name = 'contact_mode';
```

Expected: one row.

- [ ] **Step 3: Carry the value through the save helper**

In `web/lib/training-sessions.ts`, add `contactMode?: string | null;` to `SaveTrainingSessionParams`, and add to the POST body:

```ts
contact_mode: params.contactMode ?? null,
```

- [ ] **Step 4: Pass it from the training page**

In `handleSaveSession` in `web/app/training/page.tsx`, add to the `saveTrainingSession({ ... })` argument:

```tsx
contactMode: contactModeRef.current,
```

- [ ] **Step 5: Display it on the session page**

In `web/app/sessions/[id]/page.tsx`, import at the top:

```tsx
import { contactModeLabel, isContactMode } from '@/lib/contact-mode';
import { getScenarioConfig } from '@/lib/personas';
```

Then, immediately after the Scenario row in the metadata card (line ~275):

```tsx
{scenarioType && isContactMode((session as any).contact_mode) && (
  <div className="flex items-center justify-between">
    <span className="text-xs text-slate-500">Contact</span>
    <span className="text-xs text-slate-300">
      {contactModeLabel((session as any).contact_mode, getScenarioConfig(scenarioType))}
    </span>
  </div>
)}
```

If `getSession` uses an explicit column list rather than `select('*')`, add `contact_mode` to it.

- [ ] **Step 6: Give the grader the channel**

In `web/app/api/assess/route.ts`, where the persona context block is assembled for the prompt, append a line when the request body carries a contact mode. Read it from the request body as `contact_mode`, validate with `isContactMode`, and emit:

```ts
const channelLine = isContactMode(body.contact_mode) && body.contact_mode !== 'phone'
  ? `\nCHANNEL: This was an in-person visit, not a phone call${body.contact_mode === 'scheduled_visit' ? ' — the meeting had been scheduled by phone in advance' : ' — the rep arrived unannounced'}. Judge the opening and rapport accordingly.\n`
  : '';
```

Insert `channelLine` into the prompt next to the existing persona context, and pass `contact_mode: contactModeRef.current` from `generateAssessment` in the training page.

- [ ] **Step 7: Verify end to end**

In the preview, run a short call on `plumber_lead` with Scheduled Inspection selected, end it, then confirm in the Supabase SQL editor:

```sql
select contact_mode from training_sessions order by created_at desc limit 1;
```

Expected: `scheduled_visit`. Then open that session's detail page and confirm the Contact row reads "Scheduled Inspection".

- [ ] **Step 8: Commit**

```bash
git add web/supabase/contact-mode-migration.sql web/lib/training-sessions.ts web/app/training/page.tsx "web/app/sessions/[id]/page.tsx" web/app/api/assess/route.ts
git commit -m "feat(sessions): persist contact mode and pass it to assessment

Co-Authored-By: WOZCODE <contact@withwoz.com>"
```

---

## Task 4: Mirror contact mode in the mobile app

**Files:**
- Create: `mobile/lib/contact-mode.ts`
- Modify: `mobile/app/(tabs)/train/pre-call.tsx:1-40` and the render body after the Difficulty card (line ~98)
- Modify: `mobile/app/(tabs)/train/call.tsx:18-19`, `:85-94`, `:144-153`

**Interfaces:**
- Consumes: `getScenarioConfig`, `ScenarioConfig`, `ScenarioGroup` from `mobile/lib/scenarios.ts`.
- Produces: same exported names as `web/lib/contact-mode.ts`.

- [ ] **Step 1: Create the mobile module**

Create `mobile/lib/contact-mode.ts` with **the same contents as `web/lib/contact-mode.ts`**, changing only the import line to:

```ts
import type { ScenarioConfig, ScenarioGroup } from './types';
```

If `ScenarioGroup` is not exported from `mobile/lib/types.ts`, import both from `./scenarios` instead — check which module declares them before writing the import. This duplication is deliberate and matches how `SCENARIOS` and `DIFFICULTY_MODIFIERS` are already maintained separately in `mobile/lib/scenarios.ts`.

- [ ] **Step 2: Add the picker to the pre-call screen**

In `mobile/app/(tabs)/train/pre-call.tsx`, add the import:

```tsx
import { type ContactMode, getContactModeOptions } from '../../../lib/contact-mode';
```

Add state beside `difficulty` (line 15):

```tsx
const [contactMode, setContactMode] = useState<ContactMode>('phone');
```

Pass it through the router push (line 33):

```tsx
router.push({
  pathname: '/(tabs)/train/call',
  params: { personaId: persona.id, difficulty, contactMode },
});
```

Add the picker after the Difficulty card (after line 98), reusing the existing difficulty pill styles:

```tsx
{getContactModeOptions(scenario).length > 0 && (
  <View style={styles.difficultyCard}>
    <Text style={styles.difficultyTitle}>How are you reaching them?</Text>
    <View style={styles.difficultyRow}>
      {getContactModeOptions(scenario).map(({ value, label }) => (
        <TouchableOpacity
          key={value}
          style={[styles.difficultyPill, contactMode === value && styles.diffPillMedium]}
          onPress={() => setContactMode(value)}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.difficultyPillText,
            contactMode === value && styles.difficultyPillTextActive,
          ]}>
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
)}
```

`scenario` is already computed at line 48. Note that line 48 runs after the loading guard, so the picker only renders once the persona has loaded — that is correct.

- [ ] **Step 3: Hide the canned opening line for in-person modes**

Still in `pre-call.tsx`, the "They'll say" card at line 101 previews `persona.first_message`, which is wrong once the model generates the opener. Change its condition:

```tsx
{!!persona.first_message && contactMode === 'phone' && (
```

- [ ] **Step 4: Apply the mode on the call screen**

In `mobile/app/(tabs)/train/call.tsx`, add the import:

```tsx
import { type ContactMode, getContactModeModifier, isContactMode } from '../../../lib/contact-mode';
```

Read the param beside `difficulty` (line 18):

```tsx
const { personaId, difficulty: diffParam, contactMode: modeParam } = useLocalSearchParams<{
  personaId: string; difficulty?: string; contactMode?: string;
}>();
const difficulty: Difficulty = (['easy', 'medium', 'hard'].includes(diffParam ?? '') ? diffParam : 'medium') as Difficulty;
const contactMode: ContactMode = isContactMode(modeParam) ? modeParam : 'phone';
```

Replace the `vapi.start` overrides (lines 85–94):

```tsx
const scenario = getScenarioConfig(p.scenario_type);
const openingOverrides = contactMode === 'phone'
  ? { firstMessage: p.first_message }
  : { firstMessageMode: 'assistant-speaks-first-with-model-generated-message' };

const callInfo = await vapi.start(VAPI_ASSISTANT_ID, {
  model: {
    provider: 'groq',
    model: GROQ_MODEL,
    messages: [{
      role: 'system',
      content:
        DIFFICULTY_MODIFIERS[difficulty] +
        getContactModeModifier(contactMode, scenario?.group ?? 'technician') +
        p.system_prompt,
    }],
  },
  voice: { provider: '11labs', voiceId, model: 'eleven_flash_v2_5', speed: 1.07 },
  ...openingOverrides,
  maxDurationSeconds: 600,
} as any);
```

`getScenarioConfig` is already imported at line 11.

- [ ] **Step 5: Persist the mode**

In the same file, add to `pendingPayload` (line 144):

```tsx
contact_mode: contactMode,
```

- [ ] **Step 6: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: no new errors in `lib/contact-mode.ts`, `app/(tabs)/train/pre-call.tsx`, or `app/(tabs)/train/call.tsx`.

- [ ] **Step 7: Verify on a device**

Vapi/WebRTC requires a physical device build — the simulator shows the "requires device build" screen by design. Run `cd mobile && npx expo start --clear`, open on a physical device, pick `plumber_lead`, choose Scheduled Inspection, and confirm the persona opens without referencing a phone call and acknowledges a prior scheduling call when asked. If no device is available, state that this step was not verified rather than marking it done.

- [ ] **Step 8: Commit**

```bash
git add mobile/lib/contact-mode.ts "mobile/app/(tabs)/train/pre-call.tsx" "mobile/app/(tabs)/train/call.tsx"
git commit -m "feat(mobile): contact mode picker for training calls

Co-Authored-By: WOZCODE <contact@withwoz.com>"
```

---

## Task 5: Share mode and comments schema

**Files:**
- Create: `web/supabase/session-comments-migration.sql`

**Interfaces:**
- Produces: `training_sessions.share_mode` column; `session_comments` table with columns `id`, `session_id`, `author_name`, `body`, `anchor_message_index`, `anchor_offset_seconds`, `author_token_hash`, `created_at`.

- [ ] **Step 1: Write the migration**

Create `web/supabase/session-comments-migration.sql`:

```sql
-- Review-mode share links and transcript-anchored comments.
--
-- share_mode defaults to 'summary', which is exactly what every share link
-- created before this migration renders: score, coaching summary, strengths,
-- improvements, actions. Only 'review' exposes the recording and transcript,
-- so no previously-shared URL starts leaking audio.
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS share_mode TEXT NOT NULL DEFAULT 'summary';

ALTER TABLE training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_share_mode_check;

ALTER TABLE training_sessions
  ADD CONSTRAINT training_sessions_share_mode_check
  CHECK (share_mode IN ('summary', 'review'));

-- Comments are anchored to a transcript line, not to a wall-clock position:
-- anchor_message_index is the index into the parsed transcript array and is the
-- durable anchor. anchor_offset_seconds is derived from that message's
-- timestamp at insert time and is nullable, because sessions recorded before
-- per-message timestamps existed cannot produce one.
CREATE TABLE IF NOT EXISTS session_comments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  author_name           TEXT NOT NULL,
  body                  TEXT NOT NULL,
  anchor_message_index  INT  NOT NULL,
  anchor_offset_seconds INT,
  -- sha256 of an opaque token the commenter's browser keeps in localStorage.
  -- The raw token is never stored; it is the only thing that lets an anonymous
  -- commenter delete their own comment.
  author_token_hash     TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_comments_session
  ON session_comments (session_id, anchor_message_index);

-- Anonymous clients never reach this table directly. Every read and write goes
-- through a service-role route that authorizes by share token or by session
-- ownership, so RLS is enabled with no permissive policy at all.
ALTER TABLE session_comments ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Apply and verify**

Run the file in the Supabase SQL editor, then:

```sql
select share_mode from training_sessions limit 1;
select count(*) from session_comments;
select relrowsecurity from pg_class where relname = 'session_comments';
```

Expected: `summary`; `0`; `t`.

- [ ] **Step 3: Confirm existing links are untouched**

```sql
select count(*) from training_sessions where share_token is not null and share_mode <> 'summary';
```

Expected: `0`.

- [ ] **Step 4: Commit**

```bash
git add web/supabase/session-comments-migration.sql
git commit -m "feat(db): add share_mode and session_comments

Co-Authored-By: WOZCODE <contact@withwoz.com>"
```

---

## Task 6: Extract the R2 presign helper

**Files:**
- Create: `web/lib/recording.ts`
- Modify: `web/app/api/recording/route.ts:1-127`
- Test: `web/__tests__/recording-route.test.ts` (must keep passing unchanged)

**Interfaces:**
- Produces:
  - `objectKeyFromUrl(rawUrl: string, bucket: string): string | null`
  - `type RecordingResult = { ok: true; url: string } | { ok: false; status: number; error: string }`
  - `resolveRecordingUrl(vapiCallId: string): Promise<RecordingResult>`

- [ ] **Step 1: Confirm the existing tests pass before touching anything**

Run: `cd web && npx vitest run __tests__/recording-route.test.ts`
Expected: PASS — this is the baseline the refactor must preserve.

- [ ] **Step 2: Create the helper**

Create `web/lib/recording.ts`:

```ts
// web/lib/recording.ts
//
// Recordings live in our own R2 bucket (Vapi custom storage). Vapi's
// /mono-recording endpoint redirects to an *unsigned* R2 URL, which the browser
// cannot read — R2 requires SigV4 on every object read and returns an
// InvalidArgument/Authorization XML error instead of audio. So we read the
// object location from the call artifact and presign it ourselves.
//
// This module holds no authorization logic on purpose: callers decide who may
// see a recording. /api/recording checks session ownership;
// /api/share/[token]/recording checks a review-mode share token.
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/** Playback links are short-lived; long enough to start and scrub a long call. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type RecordingResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string };

/**
 * Turn a Vapi-reported recording URL into an R2 object key.
 *
 * Vapi stores the object at the bucket root, so the key is just the path. Some
 * responses include the bucket as the first segment — strip it when present so
 * both shapes resolve to the same key.
 */
export function objectKeyFromUrl(rawUrl: string, bucket: string): string | null {
  try {
    const { pathname } = new URL(rawUrl);
    const key = decodeURIComponent(pathname.replace(/^\/+/, ''));
    if (!key) return null;
    return key.startsWith(`${bucket}/`) ? key.slice(bucket.length + 1) : key;
  } catch {
    return null;
  }
}

export async function resolveRecordingUrl(vapiCallId: string): Promise<RecordingResult> {
  if (!process.env.VAPI_API_KEY) {
    return { ok: false, status: 500, error: 'VAPI_API_KEY is not configured' };
  }

  const callRes = await fetch(`https://api.vapi.ai/call/${vapiCallId}`, {
    headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}` },
  });
  if (!callRes.ok) {
    console.error('Vapi call lookup failed:', callRes.status, callRes.statusText);
    return { ok: false, status: callRes.status, error: 'Failed to fetch recording from Vapi API' };
  }

  const call = await callRes.json();
  // Vapi populates these only once the recording has finished uploading.
  const recordingUrl: string | null =
    call?.artifact?.recording?.mono?.combinedUrl ?? call?.artifact?.recordingUrl ?? null;
  if (!recordingUrl) {
    return { ok: false, status: 404, error: 'Recording not available yet' };
  }

  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    console.error('R2 storage env vars are not configured');
    return { ok: false, status: 500, error: 'Recording storage is not configured' };
  }

  const key = objectKeyFromUrl(recordingUrl, R2_BUCKET);
  if (!key) {
    return { ok: false, status: 502, error: 'Recording location is unreadable' };
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
    { expiresIn: SIGNED_URL_TTL_SECONDS },
  );

  return { ok: true, url };
}
```

- [ ] **Step 3: Rewrite the route to consume it**

Replace the body of `POST` in `web/app/api/recording/route.ts` after the ownership checks, and delete the now-duplicated `objectKeyFromUrl`, `SIGNED_URL_TTL_SECONDS`, and the S3 imports:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUser, canAccessOwned } from '@/lib/api-auth';
import { resolveRecordingUrl } from '@/lib/recording';

interface RecordingRequest {
  sessionId: string;
}

/**
 * Resolve a playable recording URL for a training session.
 *
 * Takes a session id (never a raw Vapi call id): the call id is read from the
 * session row only after the caller's access to that session is verified.
 * Accepting a caller-supplied call id would let any authenticated user mint a
 * recording URL for any call, including other organizations'.
 */
export async function POST(request: NextRequest) {
  try {
    // Reachable from mobile (no cookies), so accept a Bearer token too. This
    // route is in the middleware PUBLIC_PREFIXES and enforces auth itself.
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const auth = await requireUser({ bearerToken });
    if (!auth.ok) return auth.response;
    const { user, service } = auth;

    const body = await request.json().catch(() => null) as RecordingRequest | null;
    const sessionId = body && typeof body.sessionId === 'string' ? body.sessionId : null;
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const { data: session, error: loadErr } = await service
      .from('training_sessions')
      .select('vapi_call_id, user_id, organization_id')
      .eq('id', sessionId)
      .maybeSingle();

    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canAccessOwned(user, session.user_id, session.organization_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!session.vapi_call_id) {
      return NextResponse.json({ error: 'Session has no recording' }, { status: 404 });
    }

    const result = await resolveRecordingUrl(session.vapi_call_id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ recordingUrl: result.url });
  } catch (error) {
    console.error('Error fetching recording:', error);
    return NextResponse.json({ error: 'Failed to fetch recording' }, { status: 500 });
  }
}
```

**Ordering note:** the original route checked `VAPI_API_KEY` before loading the session; it is now checked inside `resolveRecordingUrl`, after the ownership check. The existing test `'500s rather than signing with missing storage credentials'` still passes because it deletes an R2 variable, not the Vapi key, and no existing test asserts a 500 for a missing `VAPI_API_KEY` on an inaccessible session. Checking authorization before configuration is the safer order.

- [ ] **Step 4: Run the existing suite unchanged**

Run: `cd web && npx vitest run __tests__/recording-route.test.ts`
Expected: PASS — all 13 tests, with **no edits to the test file**. If any test needed editing, the refactor changed behavior; revert and re-do it.

- [ ] **Step 5: Run the whole suite**

Run: `cd web && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/lib/recording.ts web/app/api/recording/route.ts
git commit -m "refactor(recording): extract R2 presign into lib/recording

Co-Authored-By: WOZCODE <contact@withwoz.com>"
```

---

## Task 7: Transcript parsing and offset computation

**Files:**
- Create: `web/lib/transcript.ts`
- Test: `web/__tests__/transcript.test.ts`

**Interfaces:**
- Produces:
  - `interface TranscriptMessage { role: 'user' | 'assistant'; content: string; timestamp?: string }`
  - `parseTranscript(raw: unknown): TranscriptMessage[]`
  - `messageOffsetSeconds(message: TranscriptMessage, startedAt: string | null): number | null`

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/transcript.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseTranscript, messageOffsetSeconds } from '../lib/transcript'

const START = '2026-08-07T12:00:00.000Z'

describe('parseTranscript', () => {
  it('parses the JSON string the web app stores', () => {
    const raw = JSON.stringify([{ role: 'user', content: 'Hi', timestamp: START }])
    expect(parseTranscript(raw)).toEqual([{ role: 'user', content: 'Hi', timestamp: START }])
  })

  // The mobile app inserts the transcript as an array rather than a JSON
  // string, so rows written from the phone arrive already parsed.
  it('accepts an array that was stored without stringifying', () => {
    const raw = [{ role: 'assistant', content: 'Hello', timestamp: START }]
    expect(parseTranscript(raw)).toEqual(raw)
  })

  it('returns an empty list for null, malformed JSON, or a non-array', () => {
    expect(parseTranscript(null)).toEqual([])
    expect(parseTranscript('{not json')).toEqual([])
    expect(parseTranscript('{"role":"user"}')).toEqual([])
    expect(parseTranscript(42)).toEqual([])
  })

  it('drops entries that are not usable transcript lines', () => {
    const raw = JSON.stringify([
      { role: 'user', content: 'kept' },
      { role: 'user' },
      null,
      'nope',
    ])
    expect(parseTranscript(raw)).toEqual([{ role: 'user', content: 'kept' }])
  })
})

describe('messageOffsetSeconds', () => {
  it('returns whole seconds elapsed since the call started', () => {
    const msg = { role: 'user' as const, content: 'x', timestamp: '2026-08-07T12:01:30.400Z' }
    expect(messageOffsetSeconds(msg, START)).toBe(90)
  })

  // Sessions recorded before per-message timestamps existed cannot be synced to
  // audio. Their comments still anchor to a line; they just do not seek.
  it('returns null when the message has no timestamp', () => {
    expect(messageOffsetSeconds({ role: 'user', content: 'x' }, START)).toBeNull()
  })

  it('returns null when the session has no start time or the values are unparsable', () => {
    const msg = { role: 'user' as const, content: 'x', timestamp: START }
    expect(messageOffsetSeconds(msg, null)).toBeNull()
    expect(messageOffsetSeconds({ ...msg, timestamp: 'garbage' }, START)).toBeNull()
    expect(messageOffsetSeconds(msg, 'garbage')).toBeNull()
  })

  // Clock skew between the client that timestamped the message and the stored
  // start time must never produce a negative seek target.
  it('clamps a message stamped before the call start to zero', () => {
    const msg = { role: 'user' as const, content: 'x', timestamp: '2026-08-07T11:59:58.000Z' }
    expect(messageOffsetSeconds(msg, START)).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run __tests__/transcript.test.ts`
Expected: FAIL — `Failed to resolve import "../lib/transcript"`.

- [ ] **Step 3: Write the implementation**

Create `web/lib/transcript.ts`:

```ts
// web/lib/transcript.ts
//
// Transcripts are written by two clients with different shapes: the web app
// stores JSON.stringify(messages), the mobile app inserts the array directly.
// Both carry ISO timestamps per message, which is what lets a comment anchored
// to a transcript line resolve to a position in the recording.
export interface TranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

function isTranscriptMessage(value: unknown): value is TranscriptMessage {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  return (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';
}

export function parseTranscript(raw: unknown): TranscriptMessage[] {
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return []; }
  }
  if (!Array.isArray(value)) return [];
  return value.filter(isTranscriptMessage);
}

/**
 * Seconds from the start of the call to this message. Null when it cannot be
 * computed — the caller must treat that as "not seekable" rather than zero,
 * since zero would silently point every unsynced comment at the call opening.
 */
export function messageOffsetSeconds(
  message: TranscriptMessage,
  startedAt: string | null,
): number | null {
  if (!message.timestamp || !startedAt) return null;
  const at = new Date(message.timestamp).getTime();
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(at) || Number.isNaN(start)) return null;
  return Math.max(0, Math.floor((at - start) / 1000));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run __tests__/transcript.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Replace the duplicate parser on the session page**

In `web/app/sessions/[id]/page.tsx`, delete the local `interface Message` (line 89) and `function parseTranscript` (lines 96–102), and import instead:

```tsx
import { parseTranscript, type TranscriptMessage } from '@/lib/transcript';
```

Update the `messages.map` callback's parameter type from `Message` to `TranscriptMessage` if it is annotated.

- [ ] **Step 6: Verify the session page still renders**

Run: `cd web && npx next lint` — expected: no new errors. Then load an existing session detail page in the preview and confirm with `read_page` that the transcript still lists its messages.

- [ ] **Step 7: Commit**

```bash
git add web/lib/transcript.ts web/__tests__/transcript.test.ts "web/app/sessions/[id]/page.tsx"
git commit -m "feat(transcript): shared transcript parsing and offset helpers

Co-Authored-By: WOZCODE <contact@withwoz.com>"
```

---

## Task 8: Share-token authorization and rate limiting

**Files:**
- Create: `web/lib/share-access.ts`
- Create: `web/lib/rate-limit.ts`
- Test: `web/__tests__/share-access.test.ts`

**Interfaces:**
- Produces:
  - `interface ReviewSession { id: string; user_id: string | null; organization_id: string | null; started_at: string; transcript: unknown; vapi_call_id: string | null; }`
  - `loadReviewSession(service: any, token: unknown): Promise<ReviewSession | null>`
  - `allowRequest(key: string, limit: number, windowMs: number): boolean`

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/share-access.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadReviewSession } from '../lib/share-access'
import { allowRequest } from '../lib/rate-limit'

const FUTURE = new Date(Date.now() + 86_400_000).toISOString()
const PAST = new Date(Date.now() - 86_400_000).toISOString()

const ROW = {
  id: 'sess-1',
  user_id: 'owner-1',
  organization_id: 'org-1',
  started_at: '2026-08-07T12:00:00.000Z',
  transcript: '[]',
  vapi_call_id: 'call-1',
  share_token: 'tok',
  share_mode: 'review',
  share_expires_at: FUTURE,
}

function serviceReturning(row: unknown) {
  return { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }) }
}

describe('loadReviewSession', () => {
  it('returns the session for a valid review-mode token', async () => {
    const s = await loadReviewSession(serviceReturning(ROW), 'tok')
    expect(s?.id).toBe('sess-1')
  })

  // A summary link is the LinkedIn-shareable page. It must never grant access
  // to audio or transcript, which is exactly what these routes hand out.
  it('refuses a summary-mode token', async () => {
    const s = await loadReviewSession(serviceReturning({ ...ROW, share_mode: 'summary' }), 'tok')
    expect(s).toBeNull()
  })

  it('refuses an expired token', async () => {
    const s = await loadReviewSession(serviceReturning({ ...ROW, share_expires_at: PAST }), 'tok')
    expect(s).toBeNull()
  })

  it('refuses a revoked token', async () => {
    const s = await loadReviewSession(serviceReturning({ ...ROW, share_token: null }), 'tok')
    expect(s).toBeNull()
  })

  it('refuses an unknown token', async () => {
    expect(await loadReviewSession(serviceReturning(null), 'nope')).toBeNull()
  })

  it('refuses a missing or non-string token without querying', async () => {
    const from = vi.fn()
    expect(await loadReviewSession({ from } as any, undefined)).toBeNull()
    expect(await loadReviewSession({ from } as any, 123)).toBeNull()
    expect(from).not.toHaveBeenCalled()
  })

  it('treats a token with no expiry as still valid', async () => {
    const s = await loadReviewSession(serviceReturning({ ...ROW, share_expires_at: null }), 'tok')
    expect(s?.id).toBe('sess-1')
  })
})

describe('allowRequest', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('allows up to the limit then refuses', () => {
    expect(allowRequest('ip-a', 2, 1000)).toBe(true)
    expect(allowRequest('ip-a', 2, 1000)).toBe(true)
    expect(allowRequest('ip-a', 2, 1000)).toBe(false)
  })

  it('tracks keys independently', () => {
    allowRequest('ip-b', 1, 1000)
    expect(allowRequest('ip-b', 1, 1000)).toBe(false)
    expect(allowRequest('ip-c', 1, 1000)).toBe(true)
  })

  it('allows again once the window has passed', () => {
    allowRequest('ip-d', 1, 1000)
    expect(allowRequest('ip-d', 1, 1000)).toBe(false)
    vi.advanceTimersByTime(1001)
    expect(allowRequest('ip-d', 1, 1000)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run __tests__/share-access.test.ts`
Expected: FAIL — unresolved imports for `../lib/share-access` and `../lib/rate-limit`.

- [ ] **Step 3: Write both modules**

Create `web/lib/rate-limit.ts`:

```ts
// web/lib/rate-limit.ts
//
// Best-effort in-process throttle for anonymous writes. On serverless this is
// per-instance, so it slows a naive flood rather than guaranteeing a global
// cap — which is the right trade for a feature whose audience is coaches
// holding a private URL, not the open internet.
const hits = new Map<string, number[]>();

export function allowRequest(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
```

Create `web/lib/share-access.ts`:

```ts
// web/lib/share-access.ts
//
// A review-mode share token is the entire authentication for the public
// recording and comment routes, so this is the one place that decides whether a
// token grants access. A summary-mode token must never pass: that link is meant
// to be posted publicly and exposes only the score and coaching feedback.
export interface ReviewSession {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  started_at: string;
  transcript: unknown;
  vapi_call_id: string | null;
}

export async function loadReviewSession(
  service: any,
  token: unknown,
): Promise<ReviewSession | null> {
  if (typeof token !== 'string' || !token) return null;

  const { data } = await service
    .from('training_sessions')
    .select('id, user_id, organization_id, started_at, transcript, vapi_call_id, share_token, share_mode, share_expires_at')
    .eq('share_token', token)
    .maybeSingle();

  if (!data || !data.share_token) return null;
  if (data.share_mode !== 'review') return null;
  if (data.share_expires_at && new Date(data.share_expires_at).getTime() < Date.now()) return null;

  return {
    id: data.id,
    user_id: data.user_id ?? null,
    organization_id: data.organization_id ?? null,
    started_at: data.started_at,
    transcript: data.transcript,
    vapi_call_id: data.vapi_call_id ?? null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run __tests__/share-access.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add web/lib/share-access.ts web/lib/rate-limit.ts web/__tests__/share-access.test.ts
git commit -m "feat(share): review-token authorization and request throttle

Co-Authored-By: WOZCODE <contact@withwoz.com>"
```

---

## Task 9: Public comments API

**Files:**
- Create: `web/app/api/share/[token]/comments/route.ts`
- Create: `web/app/api/share/[token]/comments/[commentId]/route.ts`
- Modify: `web/middleware.ts:4-16`
- Test: `web/__tests__/share-comments-route.test.ts`

**Interfaces:**
- Consumes: `loadReviewSession` (Task 8), `allowRequest` (Task 8), `parseTranscript` + `messageOffsetSeconds` (Task 7), `createServiceSupabase` from `@/lib/supabase-server`.
- Produces: JSON comment DTO `{ id, author_name, body, anchor_message_index, anchor_offset_seconds, created_at, mine: boolean }`.

- [ ] **Step 1: Add the public prefix**

In `web/middleware.ts`, add to `PUBLIC_PREFIXES` after the `/api/coach/connections/` entry:

```ts
  // Public session review links. The share token in the URL is the
  // authentication; each route validates it via loadReviewSession.
  '/api/share/',
```

- [ ] **Step 2: Write the failing test**

Create `web/__tests__/share-comments-route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockLoadReviewSession = vi.fn()
const mockAllowRequest = vi.fn()
const mockInsert = vi.fn()
const mockSelectList = vi.fn()

vi.mock('@/lib/share-access', () => ({
  loadReviewSession: (...a: unknown[]) => mockLoadReviewSession(...a),
}))
vi.mock('@/lib/rate-limit', () => ({
  allowRequest: (...a: unknown[]) => mockAllowRequest(...a),
}))
vi.mock('@/lib/supabase-server', () => ({
  createServiceSupabase: () => ({
    from: () => ({
      insert: (row: unknown) => {
        mockInsert(row)
        return { select: () => ({ single: async () => ({ data: { id: 'c-1', ...(row as object) }, error: null }) }) }
      },
      select: () => ({
        eq: () => ({ order: async () => mockSelectList() }),
      }),
    }),
  }),
}))

const { GET, POST } = await import('../app/api/share/[token]/comments/route')

const START = '2026-08-07T12:00:00.000Z'
const SESSION = {
  id: 'sess-1',
  user_id: 'owner-1',
  organization_id: 'org-1',
  started_at: START,
  transcript: JSON.stringify([
    { role: 'assistant', content: 'Hello', timestamp: START },
    { role: 'user', content: 'Hi there', timestamp: '2026-08-07T12:00:45.000Z' },
  ]),
  vapi_call_id: 'call-1',
}

function post(body: unknown) {
  return new Request('http://localhost/api/share/tok/comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
    body: JSON.stringify(body),
  }) as any
}

const params = { params: { token: 'tok' } }
const VALID = { author_name: 'Dana', body: 'Nice recovery here.', anchor_message_index: 1, author_token: 'abc123' }

beforeEach(() => {
  mockLoadReviewSession.mockResolvedValue(SESSION)
  mockAllowRequest.mockReturnValue(true)
  mockSelectList.mockResolvedValue({ data: [], error: null })
})
afterEach(() => vi.clearAllMocks())

describe('POST /api/share/[token]/comments', () => {
  it('creates a comment anchored to a transcript line', async () => {
    const res = await POST(post(VALID), params)
    expect(res.status).toBe(201)
    expect(mockInsert).toHaveBeenCalled()
    const row = mockInsert.mock.calls[0][0]
    expect(row.session_id).toBe('sess-1')
    expect(row.anchor_message_index).toBe(1)
    expect(row.author_name).toBe('Dana')
  })

  // The offset is what makes the comment surface at the right moment during
  // playback, and it must be derived server-side so a client cannot claim an
  // arbitrary position in the recording.
  it('derives the offset from the anchored message, ignoring any client value', async () => {
    await POST(post({ ...VALID, anchor_offset_seconds: 9999 }), params)
    expect(mockInsert.mock.calls[0][0].anchor_offset_seconds).toBe(45)
  })

  it('stores a hash of the author token, never the token itself', async () => {
    await POST(post(VALID), params)
    const row = mockInsert.mock.calls[0][0]
    expect(row.author_token_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(row)).not.toContain('abc123')
  })

  it('rejects an anchor that is not a line in this transcript', async () => {
    const res = await POST(post({ ...VALID, anchor_message_index: 47 }), params)
    expect(res.status).toBe(400)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('rejects an empty name or body, and an over-long body', async () => {
    expect((await POST(post({ ...VALID, author_name: '   ' }), params)).status).toBe(400)
    expect((await POST(post({ ...VALID, body: '' }), params)).status).toBe(400)
    expect((await POST(post({ ...VALID, body: 'x'.repeat(2001) }), params)).status).toBe(400)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('404s for a token that does not grant review access', async () => {
    mockLoadReviewSession.mockResolvedValue(null)
    const res = await POST(post(VALID), params)
    expect(res.status).toBe(404)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('429s when the caller exceeds the rate limit', async () => {
    mockAllowRequest.mockReturnValue(false)
    const res = await POST(post(VALID), params)
    expect(res.status).toBe(429)
    expect(mockInsert).not.toHaveBeenCalled()
  })
})

describe('GET /api/share/[token]/comments', () => {
  it('never leaks the author token hash to the browser', async () => {
    mockSelectList.mockResolvedValue({
      data: [{
        id: 'c-1', author_name: 'Dana', body: 'Nice.', anchor_message_index: 1,
        anchor_offset_seconds: 45, created_at: START, author_token_hash: 'deadbeef',
      }],
      error: null,
    })
    const req = new Request('http://localhost/api/share/tok/comments') as any
    const res = await GET(req, params)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.comments[0].id).toBe('c-1')
    expect(JSON.stringify(json)).not.toContain('deadbeef')
    expect(json.comments[0].author_token_hash).toBeUndefined()
  })

  it('404s for a token that does not grant review access', async () => {
    mockLoadReviewSession.mockResolvedValue(null)
    const req = new Request('http://localhost/api/share/tok/comments') as any
    expect((await GET(req, params)).status).toBe(404)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd web && npx vitest run __tests__/share-comments-route.test.ts`
Expected: FAIL — cannot resolve `../app/api/share/[token]/comments/route`.

- [ ] **Step 4: Write the list/create route**

Create `web/app/api/share/[token]/comments/route.ts`:

```ts
// web/app/api/share/[token]/comments/route.ts
//
// Anonymous, token-authorized comments on a shared session. Identity is a name
// the commenter types — deliberate: the audience is coaches and teammates
// holding a private URL. The only durable identity is an opaque token their
// browser keeps in localStorage, stored here as a hash so it can authorize a
// later delete without the server ever holding the secret.
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServiceSupabase } from '@/lib/supabase-server';
import { loadReviewSession } from '@/lib/share-access';
import { allowRequest } from '@/lib/rate-limit';
import { parseTranscript, messageOffsetSeconds } from '@/lib/transcript';

const MAX_NAME = 60;
const MAX_BODY = 2000;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function clientKey(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

function publicComment(row: any, viewerHash: string | null) {
  return {
    id: row.id,
    author_name: row.author_name,
    body: row.body,
    anchor_message_index: row.anchor_message_index,
    anchor_offset_seconds: row.anchor_offset_seconds ?? null,
    created_at: row.created_at,
    mine: !!viewerHash && row.author_token_hash === viewerHash,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  const service = createServiceSupabase();
  const session = await loadReviewSession(service, params.token);
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // The viewer's raw token arrives as a query param so the UI can mark which
  // comments they may delete. It is hashed here and never stored from a read.
  const raw = new URL(request.url).searchParams.get('author_token');
  const viewerHash = raw ? hashToken(raw) : null;

  const { data, error } = await service
    .from('session_comments')
    .select('id, author_name, body, anchor_message_index, anchor_offset_seconds, created_at, author_token_hash')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    comments: (data ?? []).map((row: any) => publicComment(row, viewerHash)),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  const service = createServiceSupabase();
  const session = await loadReviewSession(service, params.token);
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!allowRequest(`comment:${clientKey(request)}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many comments — try again later' }, { status: 429 });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const authorName = typeof body.author_name === 'string' ? body.author_name.trim() : '';
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  const index = typeof body.anchor_message_index === 'number' ? body.anchor_message_index : -1;
  const authorToken = typeof body.author_token === 'string' ? body.author_token : '';

  if (!authorName || authorName.length > MAX_NAME) {
    return NextResponse.json({ error: 'A name is required' }, { status: 400 });
  }
  if (!text || text.length > MAX_BODY) {
    return NextResponse.json({ error: 'A comment of 1–2000 characters is required' }, { status: 400 });
  }
  if (!authorToken) {
    return NextResponse.json({ error: 'Missing author token' }, { status: 400 });
  }

  // The anchor must name a real line in this transcript — otherwise the comment
  // would render nowhere and could not be deleted from the UI.
  const messages = parseTranscript(session.transcript);
  if (!Number.isInteger(index) || index < 0 || index >= messages.length) {
    return NextResponse.json({ error: 'Comment is not anchored to a transcript line' }, { status: 400 });
  }

  // Derived server-side: a client must not be able to claim an arbitrary
  // position in the recording.
  const offset = messageOffsetSeconds(messages[index], session.started_at);

  const { data, error } = await service
    .from('session_comments')
    .insert({
      session_id: session.id,
      author_name: authorName,
      body: text,
      anchor_message_index: index,
      anchor_offset_seconds: offset,
      author_token_hash: hashToken(authorToken),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ comment: publicComment(data, hashToken(authorToken)) }, { status: 201 });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && npx vitest run __tests__/share-comments-route.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 6: Write the delete route**

Create `web/app/api/share/[token]/comments/[commentId]/route.ts`:

```ts
// web/app/api/share/[token]/comments/[commentId]/route.ts
//
// Two parties may delete a comment: the anonymous author, proven by the opaque
// token their browser stored when they posted it, and the session owner, proven
// by an authenticated session. Nobody else.
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServiceSupabase } from '@/lib/supabase-server';
import { loadReviewSession } from '@/lib/share-access';
import { requireUser, canAccessOwned } from '@/lib/api-auth';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { token: string; commentId: string } },
) {
  const service = createServiceSupabase();
  const session = await loadReviewSession(service, params.token);
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: comment } = await service
    .from('session_comments')
    .select('id, session_id, author_token_hash')
    .eq('id', params.commentId)
    .maybeSingle();

  if (!comment || comment.session_id !== session.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const raw = new URL(request.url).searchParams.get('author_token');
  let permitted = !!raw && hashToken(raw) === comment.author_token_hash;

  if (!permitted) {
    // Fall back to owner moderation. An anonymous caller simply fails this.
    const auth = await requireUser();
    permitted = auth.ok && canAccessOwned(auth.user, session.user_id, session.organization_id);
  }

  if (!permitted) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await service.from('session_comments').delete().eq('id', params.commentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Test the delete route**

Append to `web/__tests__/share-comments-route.test.ts` a second `describe` block. Add these mocks at the top of the file alongside the existing ones:

```ts
const mockRequireUser = vi.fn()
const mockCanAccessOwned = vi.fn()
const mockDelete = vi.fn()
const mockCommentRow = vi.fn()

vi.mock('@/lib/api-auth', () => ({
  requireUser: (...a: unknown[]) => mockRequireUser(...a),
  canAccessOwned: (...a: unknown[]) => mockCanAccessOwned(...a),
}))
```

Extend the `createServiceSupabase` mock's `from()` to also return `{ maybeSingle: async () => ({ data: mockCommentRow(), error: null }) }` from `select().eq()` and `{ eq: async () => { mockDelete(); return { error: null } } }` from `delete()`. Then:

```ts
const { DELETE } = await import('../app/api/share/[token]/comments/[commentId]/route')

describe('DELETE /api/share/[token]/comments/[commentId]', () => {
  const delParams = { params: { token: 'tok', commentId: 'c-1' } }
  const AUTHOR_HASH = createHash('sha256').update('abc123').digest('hex')

  beforeEach(() => {
    mockCommentRow.mockReturnValue({ id: 'c-1', session_id: 'sess-1', author_token_hash: AUTHOR_HASH })
    mockRequireUser.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) })
  })

  it('lets the original author delete their own comment', async () => {
    const req = new Request('http://localhost/api/share/tok/comments/c-1?author_token=abc123', { method: 'DELETE' }) as any
    expect((await DELETE(req, delParams)).status).toBe(200)
    expect(mockDelete).toHaveBeenCalled()
  })

  // Without this, anyone holding the public link could delete anyone's comment.
  it('refuses a different visitor holding the same public link', async () => {
    const req = new Request('http://localhost/api/share/tok/comments/c-1?author_token=someone-else', { method: 'DELETE' }) as any
    expect((await DELETE(req, delParams)).status).toBe(403)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('lets the session owner moderate any comment', async () => {
    mockRequireUser.mockResolvedValue({ ok: true, user: { profileId: 'owner-1' }, service: {} })
    mockCanAccessOwned.mockReturnValue(true)
    const req = new Request('http://localhost/api/share/tok/comments/c-1', { method: 'DELETE' }) as any
    expect((await DELETE(req, delParams)).status).toBe(200)
  })

  it('refuses to delete a comment belonging to a different session', async () => {
    mockCommentRow.mockReturnValue({ id: 'c-1', session_id: 'other-session', author_token_hash: AUTHOR_HASH })
    const req = new Request('http://localhost/api/share/tok/comments/c-1?author_token=abc123', { method: 'DELETE' }) as any
    expect((await DELETE(req, delParams)).status).toBe(404)
    expect(mockDelete).not.toHaveBeenCalled()
  })
})
```

Import `createHash` from `crypto` at the top of the test file.

- [ ] **Step 8: Run the suite**

Run: `cd web && npm test`
Expected: PASS — all files.

- [ ] **Step 9: Commit**

```bash
git add "web/app/api/share/[token]/comments" web/middleware.ts web/__tests__/share-comments-route.test.ts
git commit -m "feat(share): anonymous transcript comments API

Co-Authored-By: WOZCODE <contact@withwoz.com>"
```

---

## Task 10: Public recording route and share-mode toggle

**Files:**
- Create: `web/app/api/share/[token]/recording/route.ts`
- Modify: `web/app/api/sessions/[id]/share/route.ts:31-56`
- Modify: `web/app/sessions/[id]/share-dialog.tsx`
- Test: `web/__tests__/share-recording-route.test.ts`

**Interfaces:**
- Consumes: `loadReviewSession` (Task 8), `resolveRecordingUrl` (Task 6).
- Produces: `POST /api/share/[token]/recording` → `{ recordingUrl }`; `POST /api/sessions/[id]/share` accepts `mode`.

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/share-recording-route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockLoadReviewSession = vi.fn()
const mockResolveRecordingUrl = vi.fn()

vi.mock('@/lib/share-access', () => ({
  loadReviewSession: (...a: unknown[]) => mockLoadReviewSession(...a),
}))
vi.mock('@/lib/recording', () => ({
  resolveRecordingUrl: (...a: unknown[]) => mockResolveRecordingUrl(...a),
}))
vi.mock('@/lib/supabase-server', () => ({ createServiceSupabase: () => ({}) }))

const { POST } = await import('../app/api/share/[token]/recording/route')

const SIGNED = 'https://acct.r2.cloudflarestorage.com/x-mono.mp3?X-Amz-Signature=deadbeef'
const params = { params: { token: 'tok' } }
function req() {
  return new Request('http://localhost/api/share/tok/recording', { method: 'POST' }) as any
}

beforeEach(() => {
  mockLoadReviewSession.mockResolvedValue({ id: 'sess-1', vapi_call_id: 'call-1', started_at: '2026-08-07T12:00:00.000Z' })
  mockResolveRecordingUrl.mockResolvedValue({ ok: true, url: SIGNED })
})
afterEach(() => vi.clearAllMocks())

describe('POST /api/share/[token]/recording', () => {
  it('presigns the recording for a review-mode token with no logged-in user', async () => {
    const res = await POST(req(), params)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ recordingUrl: SIGNED })
  })

  // The call id must come from the session the token resolves to, never from
  // the caller — otherwise any share link would mint audio for any call.
  it('uses the call id from the token-resolved session', async () => {
    await POST(req(), params)
    expect(mockResolveRecordingUrl).toHaveBeenCalledWith('call-1')
  })

  it('404s when the token is summary-mode, expired, revoked, or unknown', async () => {
    mockLoadReviewSession.mockResolvedValue(null)
    const res = await POST(req(), params)
    expect(res.status).toBe(404)
    expect(mockResolveRecordingUrl).not.toHaveBeenCalled()
  })

  it('404s when the session never had a recording', async () => {
    mockLoadReviewSession.mockResolvedValue({ id: 'sess-1', vapi_call_id: null })
    expect((await POST(req(), params)).status).toBe(404)
    expect(mockResolveRecordingUrl).not.toHaveBeenCalled()
  })

  it('propagates an upstream failure status', async () => {
    mockResolveRecordingUrl.mockResolvedValue({ ok: false, status: 404, error: 'Recording not available yet' })
    expect((await POST(req(), params)).status).toBe(404)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run __tests__/share-recording-route.test.ts`
Expected: FAIL — cannot resolve the route module.

- [ ] **Step 3: Write the route**

Create `web/app/api/share/[token]/recording/route.ts`:

```ts
// web/app/api/share/[token]/recording/route.ts
//
// Public sibling of /api/recording. Same presign, different gate: a review-mode
// share token instead of an authenticated session. Summary-mode tokens are
// rejected in loadReviewSession, so the LinkedIn-shareable link never yields
// audio.
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-server';
import { loadReviewSession } from '@/lib/share-access';
import { resolveRecordingUrl } from '@/lib/recording';

export async function POST(
  _request: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const service = createServiceSupabase();
    const session = await loadReviewSession(service, params.token);
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!session.vapi_call_id) {
      return NextResponse.json({ error: 'Session has no recording' }, { status: 404 });
    }

    const result = await resolveRecordingUrl(session.vapi_call_id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ recordingUrl: result.url });
  } catch (error) {
    console.error('Error fetching shared recording:', error);
    return NextResponse.json({ error: 'Failed to fetch recording' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run __tests__/share-recording-route.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Accept a mode on the share toggle route**

In `web/app/api/sessions/[id]/share/route.ts`, replace the body-parsing and enable branch (lines 31–50):

```ts
  const body = await request.json().catch(() => ({}));
  const enabled = body?.enabled !== false; // default enable
  const mode = body?.mode === 'review' ? 'review' : 'summary';

  if (enabled) {
    // Reuse the existing token when there is one, so switching a link between
    // summary and review does not break a URL already sent to someone.
    const token = session.share_token ?? randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + SHARE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('training_sessions')
      .update({
        share_token: token,
        share_mode: mode,
        share_enabled_at: new Date().toISOString(),
        share_expires_at: expiresAt,
      })
      .eq('id', params.id);
    return NextResponse.json({
      url: `${APP_URL}/share/session/${token}`,
      token,
      mode,
      expiresAt,
    });
  }
```

Add `share_mode` to the `select` on line 22 so the current mode is available.

- [ ] **Step 6: Add the mode selector to the dialog**

In `web/app/sessions/[id]/share-dialog.tsx`, accept `initialMode` as a prop, hold it in state, send it with every toggle, and replace the inaccurate description. Pass the current value from `web/app/sessions/[id]/page.tsx`:

```tsx
<ShareDialog
  sessionId={params.id}
  initialToken={(session as any).share_token ?? null}
  initialMode={(session as any).share_mode === 'review' ? 'review' : 'summary'}
/>
```

In the dialog, replace the paragraph at line 57 and add the selector above the link controls:

```tsx
<div className="mb-5">
  <div className="flex gap-2 mb-3">
    {([
      { value: 'summary' as const, label: 'Summary only' },
      { value: 'review' as const, label: 'Full review' },
    ]).map(({ value, label }) => (
      <button
        key={value}
        onClick={() => setMode(value)}
        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors border ${
          mode === value
            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
            : 'bg-transparent text-gray-500 border-white/10 hover:text-gray-300'
        }`}
      >
        {label}
      </button>
    ))}
  </div>
  <p className="text-xs text-gray-400">
    {mode === 'review'
      ? 'Anyone with the link can play the recording, read the full transcript, and leave comments on individual lines.'
      : 'Anyone with the link sees the score, coaching feedback, and actions to take. The recording and transcript stay private.'}
  </p>
</div>
```

Changing `mode` while a link already exists must re-POST so the change persists — call `toggle(true)` from a `useEffect` on `mode` when `token` is non-null, or call it directly in the button's `onClick` after `setMode`.

- [ ] **Step 7: Verify in the browser**

In the preview, open a session you own, create a link in Summary mode, and confirm the public page still shows only score and feedback. Switch to Full review, reload the same URL, and confirm the transcript section appears (it will be empty until Task 11 — for now confirm the API with `read_network_requests`: `POST /api/share/<token>/recording` returns 200 with no session cookie, and returns 404 after switching back to Summary).

- [ ] **Step 8: Commit**

```bash
git add "web/app/api/share/[token]/recording" "web/app/api/sessions/[id]/share/route.ts" "web/app/sessions/[id]/share-dialog.tsx" "web/app/sessions/[id]/page.tsx" web/__tests__/share-recording-route.test.ts
git commit -m "feat(share): review-mode links and token-scoped recording access

Co-Authored-By: WOZCODE <contact@withwoz.com>"
```

---

## Task 11: Transcript review component

**Files:**
- Create: `web/components/session-review/types.ts`
- Create: `web/components/session-review/transcript-review.tsx`

**Interfaces:**
- Consumes: `TranscriptMessage` from `@/lib/transcript`.
- Produces:
  - `interface SessionComment { id: string; author_name: string; body: string; anchor_message_index: number; anchor_offset_seconds: number | null; created_at: string; mine: boolean }`
  - `getAuthorToken(): string`, `COMMENT_NAME_KEY: string`
  - `<TranscriptReview messages personaName comments activeIndex seekable canModerate canComment onSeek onCreate onDelete />`

- [ ] **Step 1: Define the shared types**

Create `web/components/session-review/types.ts`:

```ts
// web/components/session-review/types.ts
//
// One review UI serves two callers with different auth: the public share page
// (token in the URL) and the owner's session page (cookie session). They differ
// only in which endpoints back the CommentApi and whether moderation is on, so
// the components take behavior as props rather than reaching for auth
// themselves.
export interface SessionComment {
  id: string;
  author_name: string;
  body: string;
  anchor_message_index: number;
  anchor_offset_seconds: number | null;
  created_at: string;
  /** True when this browser's stored author token created the comment. */
  mine: boolean;
}

/** Opaque per-browser identity, the only thing that lets an anonymous
 *  commenter delete their own comment later. */
export function getAuthorToken(): string {
  const KEY = 'techrp_comment_token';
  const existing = localStorage.getItem(KEY);
  if (existing) return existing;
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  localStorage.setItem(KEY, token);
  return token;
}

export const COMMENT_NAME_KEY = 'techrp_comment_name';
```

- [ ] **Step 2: Build the transcript component**

Create `web/components/session-review/transcript-review.tsx` as a `'use client'` component. It receives:

```tsx
export function TranscriptReview({
  messages,
  personaName,
  comments,
  activeIndex,
  seekable,
  canModerate,
  onSeek,
  onCreate,
  onDelete,
}: {
  messages: TranscriptMessage[];
  personaName: string | null;
  comments: SessionComment[];
  /** Index of the line currently playing, or -1. */
  activeIndex: number;
  /** False when the session has no recording — hides seek affordances. */
  seekable: boolean;
  /** False when there is no comments endpoint — hides the Comment buttons. */
  canComment: boolean;
  canModerate: boolean;
  onSeek: (messageIndex: number) => void;
  onCreate: (messageIndex: number, authorName: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
})
```

Requirements:

- Reuse the existing bubble markup from `web/app/sessions/[id]/page.tsx:243-259` so the transcript looks unchanged: `justify-end` + `bg-sky-500/15` for `role === 'user'` labeled "You", `bg-slate-800` for the persona labeled with `personaName || 'Contact'`.
- Give each bubble `id={`msg-${i}`}` so the player can scroll it into view.
- When `i === activeIndex`, add `ring-1 ring-sky-400/60` to the bubble.
- Below each bubble, render that line's comments (filter `comments` by `anchor_message_index === i`) as a compact list: bold `author_name`, the body, and a `×` delete button shown when `c.mine || canModerate`, wired to `onDelete(c.id)`.
- Render a comment count badge on the bubble when the line has comments.
- On hover (and always on touch widths), show a small "Comment" button on the bubble that opens an inline composer for that line only — one composer open at a time, tracked with `const [composerIndex, setComposerIndex] = useState<number | null>(null)`.
- The composer has a name input seeded from `localStorage.getItem(COMMENT_NAME_KEY) ?? ''` and a textarea. On submit: trim both, refuse empty, `localStorage.setItem(COMMENT_NAME_KEY, name)`, `await onCreate(composerIndex, name, body)`, then close the composer and clear the textarea. Disable the submit button while the promise is in flight and surface a thrown error as inline red text.
- When `seekable`, clicking a bubble calls `onSeek(i)`.
- Do not fetch anything. All I/O is the caller's job.

- [ ] **Step 3: Verify the transcript renders in isolation**

Temporarily render `<TranscriptReview>` on an owner session page with `comments={[]}`, `activeIndex={-1}`, `seekable={false}`, and no-op handlers. In the preview, confirm with `read_page` that every transcript line still appears with the correct speaker labels, and with `read_console_messages` (`onlyErrors: true`) that there are no errors.

- [ ] **Step 4: Lint**

Run: `cd web && npx next lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add web/components/session-review/types.ts web/components/session-review/transcript-review.tsx
git commit -m "feat(review): transcript component with inline anchored comments

Co-Authored-By: WOZCODE <contact@withwoz.com>"
```

---

## Task 12: Playback sync and page wiring

**Files:**
- Create: `web/components/session-review/review-player.tsx`
- Create: `web/components/session-review/session-review.tsx`
- Modify: `web/app/share/session/[token]/page.tsx`
- Modify: `web/app/sessions/[id]/page.tsx`

**Interfaces:**
- Consumes: `TranscriptReview` (Task 11), `SessionComment`, `CommentApi`, `getAuthorToken` (Task 11), `parseTranscript`/`messageOffsetSeconds` (Task 7).
- Produces: `<SessionReview transcript startedAt personaName recordingEndpoint commentsEndpoint canModerate />`

- [ ] **Step 1: Build the player**

Create `web/components/session-review/review-player.tsx` (`'use client'`). It owns the `<audio>` element and all time state:

```tsx
export function ReviewPlayer({
  recordingEndpoint,
  offsets,
  comments,
  onActiveIndexChange,
  seekRequest,
}: {
  /** POST endpoint that returns { recordingUrl }. */
  recordingEndpoint: string;
  /** offsets[i] is the start second of message i, or null when unsynced. */
  offsets: (number | null)[];
  comments: SessionComment[];
  onActiveIndexChange: (index: number) => void;
  /** Incrementing counter + target index; changing it triggers a seek. */
  seekRequest: { index: number; nonce: number } | null;
})
```

Requirements:

- On mount, `POST` to `recordingEndpoint` with an empty body and set `url` from `{ recordingUrl }`. On failure, render the same "recording unavailable" treatment as `web/app/sessions/[id]/recording-player.tsx` — the transcript must still be usable.
- On `timeupdate`, compute the active index: the largest `i` whose `offsets[i]` is non-null and `<= currentTime`. Skip null offsets entirely. Call `onActiveIndexChange` only when the value actually changes.
- When the active index changes, `document.getElementById(`msg-${i}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })`, unless the user scrolled manually in the last 4 seconds. Track that with a `wheel`/`touchmove` listener setting a `lastManualScrollRef`.
- Render any comments whose `anchor_message_index` equals the active index as cards immediately above the player, so the listener sees the comment at the moment it applies.
- React to `seekRequest`: when `nonce` changes and `offsets[index]` is non-null, set `audio.currentTime` and `play()`. Use `nonce` rather than `index` so clicking the same line twice seeks twice.
- Style it as a sticky bottom bar matching `web/app/sessions/[id]/actions-with-playback.tsx:78-82`: `sticky bottom-4 bg-slate-900/95 backdrop-blur border border-white/10 rounded-xl p-4`.

- [ ] **Step 2: Build the container**

Create `web/components/session-review/session-review.tsx` (`'use client'`). It owns data fetching and wires the two pieces together:

```tsx
export function SessionReview({
  transcript,
  startedAt,
  personaName,
  hasRecording,
  recordingEndpoint,
  commentsEndpoint,
  canModerate,
}: {
  transcript: unknown;
  startedAt: string;
  personaName: string | null;
  hasRecording: boolean;
  /** Absent when no share token exists yet — the player is then not rendered. */
  recordingEndpoint?: string;
  /** Absent when no share token exists yet — commenting is then disabled. */
  commentsEndpoint?: string;
  canModerate: boolean;
})
```

Requirements:

- `const messages = useMemo(() => parseTranscript(transcript), [transcript])`.
- `const offsets = useMemo(() => messages.map(m => messageOffsetSeconds(m, startedAt)), [messages, startedAt])`.
- On mount, `GET ${commentsEndpoint}?author_token=${getAuthorToken()}` and hold `comments` in state.
- `onCreate` POSTs `{ author_name, body, anchor_message_index, author_token: getAuthorToken() }` to `commentsEndpoint`, then appends the returned comment to state. A non-OK response throws with the body's `error` so the composer can display it — a 404 there means the link was revoked or switched back to summary mode while the page was open, so surface "This link is no longer active."
- `onDelete` sends `DELETE ${commentsEndpoint}/${id}?author_token=${getAuthorToken()}` and removes it from state on success.
- Holds `activeIndex` state and a `seekRequest` counter; passes both down.
- Renders `<TranscriptReview>` with `canComment={!!commentsEndpoint}` and `seekable={hasRecording && !!recordingEndpoint && offsets.some(o => o !== null)}`, then `<ReviewPlayer>` only when `hasRecording && recordingEndpoint`.

- [ ] **Step 3: Wire the public share page**

In `web/app/share/session/[token]/page.tsx`:

- Add `share_mode`, `transcript`, `vapi_call_id`, and `persona_name` to the `select` in `getSharedSession` (`persona_name` is already selected).
- After the "Actions to Take" section and before the join CTA, render when review mode is on:

```tsx
{(session as any).share_mode === 'review' && (
  <section className="bg-gray-900 border border-white/10 rounded-2xl p-6">
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Recording & Transcript</p>
    <SessionReview
      transcript={(session as any).transcript}
      startedAt={(session as any).started_at}
      personaName={personaName}
      hasRecording={!!(session as any).vapi_call_id}
      recordingEndpoint={`/api/share/${params.token}/recording`}
      commentsEndpoint={`/api/share/${params.token}/comments`}
      canModerate={false}
    />
  </section>
)}
```

Leave the summary-mode page byte-identical.

- [ ] **Step 4: Wire the owner session page**

In `web/app/sessions/[id]/page.tsx`, replace the entire Transcript `SectionCard` body (lines 238–262) with the shared component. The owner reaches the same routes through the session's own share token, so a session that has never been shared has no token to authorize with. Both endpoint props are optional for exactly that case: when they are absent, `SessionReview` skips the comments fetch, passes `comments={[]}`, hides the Comment buttons, and renders no player — the owner still sees the transcript, and the right-column `RecordingPlayer` still handles audio.

```tsx
<SectionCard title={`Transcript${messages.length > 0 ? ` · ${messages.length} messages` : ''}`}>
  {messages.length === 0 ? (
    <p className="text-center py-8 text-slate-600 text-sm">No transcript available.</p>
  ) : (
    <SessionReview
      transcript={session.transcript}
      startedAt={session.started_at}
      personaName={personaName}
      hasRecording={false}
      recordingEndpoint={(session as any).share_token ? `/api/share/${(session as any).share_token}/recording` : undefined}
      commentsEndpoint={(session as any).share_token ? `/api/share/${(session as any).share_token}/comments` : undefined}
      canModerate={isOwner}
    />
  )}
</SectionCard>
```

`hasRecording={false}` is deliberate here: the owner page already has a standalone `RecordingPlayer` card in the right column, and two audio elements on one page would fight each other. The owner reads and moderates comments inline and plays audio from the existing card.

- [ ] **Step 5: Verify the whole flow in the browser**

With the preview running:

1. Open a session you own, set the share link to Full review, copy the URL.
2. Open that URL in a fresh tab (`tabs_create` + `navigate`) so no session cookie applies.
3. Confirm with `read_page`: the transcript renders, the player renders, and the summary sections above are unchanged.
4. Click a transcript line's Comment button, enter a name and body, submit. Confirm the comment appears under that line and that `read_network_requests` shows `POST /api/share/<token>/comments` returning 201.
5. Play the recording. Confirm the active line gains its highlight ring and the comment card appears beside the player when playback reaches that line.
6. Click a different line and confirm the audio seeks there.
7. Delete your own comment; confirm it disappears and the DELETE returned 200.
8. Reload; confirm the remaining comments persist and yours still shows a delete control.
9. In the owner tab, confirm the same comment appears on `/sessions/[id]` with a delete control.
10. Switch the link back to Summary and reload the public tab: the transcript, player, and comments must all be gone.
11. Run `read_console_messages` with `onlyErrors: true` — expected: empty.

- [ ] **Step 6: Run the full suite and lint**

Run: `cd web && npm test && npx next lint`
Expected: PASS, no new lint errors.

- [ ] **Step 7: Commit**

```bash
git add web/components/session-review "web/app/share/session/[token]/page.tsx" "web/app/sessions/[id]/page.tsx"
git commit -m "feat(review): playback-synced anchored comments on shared sessions

Co-Authored-By: WOZCODE <contact@withwoz.com>"
```

- [ ] **Step 8: Mark the spec complete in TODO.md**

Add a completed entry referencing both features, then:

```bash
git add -f TODO.md
git commit -m "docs: mark contact mode and session review complete

Co-Authored-By: WOZCODE <contact@withwoz.com>"
```

---

## Verification Summary

Before claiming this plan complete, all of the following must hold, with output shown:

- `cd web && npm test` passes, including the untouched `recording-route.test.ts`.
- `cd web && npx next lint` reports no new errors.
- `cd mobile && npx tsc --noEmit` reports no new errors.
- A `plumber_lead` call in Scheduled Inspection mode opens without any phone reference and acknowledges a prior scheduling call.
- `homeowner_inbound` and `homeowner_facetime` show no contact-mode picker.
- A summary-mode share link renders exactly what it rendered before this work, and its `/api/share/<token>/recording` returns 404.
- A review-mode share link, opened with no session cookie, plays audio and accepts an anonymous comment pinned to a transcript line.
- That comment surfaces during playback at its line, is deletable by its author from the same browser, and is deletable by the owner from `/sessions/[id]`.

Anything not verified must be reported as not verified rather than marked done.
