# Payment Type Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Payment Type" selector (Potential Claim / Self-Pay / Random) to the technician session setup that injects a behavior modifier into the Vapi system prompt, and clean all technician personas of baked-in claim decisions.

**Architecture:** Follows the existing `DIFFICULTY_MODIFIERS` pattern exactly — a constant modifier map, state + ref in the training page, injected into the system prompt at call start. UI is a second button group below difficulty in the persona-preview phase. Persona cleanup removes baked-in claim decisions from both `personas.ts` (static) and `all-personas.ts` (seeded), re-seeding the DB afterward.

**Tech Stack:** Next.js 14, TypeScript, React state/refs, Tailwind CSS

---

## File Structure

| File | Change |
|------|--------|
| `web/app/training/page.tsx` | Add `PaymentType` type, `PAYMENT_MODIFIERS` constant, `getPaymentModifier` fn, state, ref, useEffect, system prompt injection, UI selector |
| `web/lib/personas.ts` | Remove baked-in claim decisions from static technician personas |
| `web/lib/all-personas.ts` | Remove baked-in claim decisions from all seeded technician personas |

---

### Task 1: Add PAYMENT_MODIFIERS constant and getPaymentModifier function

**Files:**
- Modify: `web/app/training/page.tsx` (after line 154, the closing `};` of `DIFFICULTY_MODIFIERS`)

- [ ] **Step 1: Add PaymentType type, PAYMENT_MODIFIERS, and getPaymentModifier after DIFFICULTY_MODIFIERS**

In `web/app/training/page.tsx`, find the `DIFFICULTY_MODIFIERS` block (ends around line 154). Immediately after its closing `};`, insert:

```ts
type PaymentType = 'potential_claim' | 'self_pay' | 'random';

const PAYMENT_MODIFIERS: Record<'potential_claim' | 'self_pay', { call: string; facetime: string }> = {
  potential_claim: {
    call: '[PAYMENT TYPE: POTENTIAL CLAIM] This homeowner has contacted or is seriously considering contacting their insurance company about this damage. They may ask how claims work, whether you work with adjusters, what their deductible means for them, and how billing flows through insurance. Let those topics come up naturally based on their personality — do not volunteer a claim decision they have not yet made.\n\n',
    facetime: '[PAYMENT TYPE: POTENTIAL CLAIM] This homeowner has contacted or is seriously considering contacting their insurance company about this damage. They may ask how claims work, whether you work with adjusters, what their deductible means for them, and how billing flows through insurance. Let those topics come up naturally based on their personality — do not volunteer a claim decision they have not yet made.\n\n',
  },
  self_pay: {
    call: '[PAYMENT TYPE: SELF-PAY] This homeowner is paying out of pocket and is not filing an insurance claim. They may ask how much something like this typically costs, how payment works, or whether payment plans exist. They will not demand an exact price quote over the phone, but will express genuine curiosity about overall cost.\n\n',
    facetime: '[PAYMENT TYPE: SELF-PAY] This homeowner is paying out of pocket and is not filing an insurance claim. At a natural point in the conversation, directly ask the technician for a price or estimate. Be direct about wanting to understand the cost before committing.\n\n',
  },
};

function getPaymentModifier(type: PaymentType, scenarioType: ScenarioType): string {
  const resolved: 'potential_claim' | 'self_pay' = type === 'random'
    ? (Math.random() < 0.5 ? 'potential_claim' : 'self_pay')
    : type;
  const channel: 'call' | 'facetime' = scenarioType === 'homeowner_facetime' ? 'facetime' : 'call';
  return PAYMENT_MODIFIERS[resolved][channel];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to the new types or function.

- [ ] **Step 3: Commit**

```bash
git add web/app/training/page.tsx
git commit -m "feat: add PAYMENT_MODIFIERS constant and getPaymentModifier to training page"
```

---

### Task 2: Wire paymentType state, ref, and system prompt injection

**Files:**
- Modify: `web/app/training/page.tsx`

- [ ] **Step 1: Add paymentType state and ref**

In the state declarations block (around line 203), after the `difficulty` state line and `difficultyRef` line, add:

```ts
const [paymentType, setPaymentType] = useState<PaymentType>('random');
const paymentTypeRef = useRef<PaymentType>('random');
```

- [ ] **Step 2: Add useEffect to keep paymentTypeRef in sync**

After the existing `useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);` line (around line 314), add:

```ts
useEffect(() => { paymentTypeRef.current = paymentType; }, [paymentType]);
```

- [ ] **Step 3: Inject payment modifier into system prompt**

Find the system prompt construction in `handleStartCall` (around line 358). The current code reads:

```ts
const systemPrompt =
  DIFFICULTY_MODIFIERS[difficultyRef.current] +
  selectedPersona.systemPrompt +
  TIMING_INSTRUCTIONS +
  getInterruptInstructions(selectedPersona.personalityType);
```

Replace it with:

```ts
const systemPrompt =
  DIFFICULTY_MODIFIERS[difficultyRef.current] +
  getPaymentModifier(paymentTypeRef.current, selectedPersona.scenarioType) +
  selectedPersona.systemPrompt +
  TIMING_INSTRUCTIONS +
  getInterruptInstructions(selectedPersona.personalityType);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/app/training/page.tsx
git commit -m "feat: wire paymentType state and inject modifier into Vapi system prompt"
```

---

### Task 3: Add Payment Type selector UI in persona-preview phase

**Files:**
- Modify: `web/app/training/page.tsx`

- [ ] **Step 1: Add payment type selector after the difficulty selector**

In the persona-preview phase, `scenario` is defined at the top of the block as:
```ts
const scenario = SCENARIOS.find(s => s.type === selectedPersona.scenarioType)!;
```

Find the difficulty selector block (the `<div className="mb-8">` containing the difficulty buttons, around lines 668–687). After its closing `</div>`, insert:

```tsx
{/* Payment Type — technician scenarios only */}
{scenario.group === 'technician' && (
  <div className="mb-8">
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payment Type</p>
    <div className="flex gap-2">
      {([
        { value: 'potential_claim' as const, label: 'Potential Claim' },
        { value: 'self_pay' as const, label: 'Self-Pay' },
        { value: 'random' as const, label: 'Random' },
      ]).map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setPaymentType(value)}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${
            paymentType === value
              ? value === 'potential_claim' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
              : value === 'self_pay'         ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                             : 'bg-gray-500/20 text-gray-400 border-gray-500/40'
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

- [ ] **Step 2: Reset paymentType when selecting a new scenario**

In `handleSelectScenario` (around line 317), just before the `setPhase('persona-preview')` call, add:

```ts
setPaymentType('random');
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Start dev server and verify UI manually**

```bash
cd web && npm run dev
```

Open http://localhost:3000/training.

- Select **Homeowner — Inbound Call** → persona preview should show Payment Type selector below Difficulty with three buttons: Potential Claim, Self-Pay, Random. Random should be selected (gray accent) by default.
- Click Potential Claim → turns blue. Click Self-Pay → turns amber. Click Random → returns gray.
- Go back and select a BD scenario (e.g. **Residential Property Manager**) → Payment Type selector should NOT appear.

- [ ] **Step 5: Commit**

```bash
git add web/app/training/page.tsx
git commit -m "feat: add Payment Type selector UI to persona preview for technician scenarios"
```

---

### Task 4: Clean static personas in web/lib/personas.ts

**Files:**
- Modify: `web/lib/personas.ts`

**Cleanup rule:** Remove language that commits the persona to a specific payment path. Keep personality traits (cost anxiety, skepticism) but remove statements like "already called insurance", "not filing a claim", "will not mention insurance unless asked".

- [ ] **Step 1: Fix homeowner_inbound_1 (Linda Chen) — remove "already called insurance"**

In `briefDescription`, change:
```
// Before
"...She's already called her insurance company and was told to call a restoration company first."

// After
"...She has homeowners insurance and isn't sure what to do next."
```

In `systemPrompt`, change:
```
// Before
"You already called your insurance company and they told you to call a restoration company first"

// After
"You have homeowners insurance but haven't called them yet and aren't sure if you should"
```

In `systemPrompt` objection 2, change:
```
// Before
"2. 'My insurance agent said to call you first — does that mean they'll pay for everything?'"

// After
"2. 'Should I call my insurance company about this? Would that cover everything?'"
```

- [ ] **Step 2: Fix homeowner_facetime_1 (Dave Prentiss) — remove explicit self-pay objections**

In `systemPrompt`, change objection 4:
```
// Before
"4. 'What's this going to cost? Because I'm not paying anything out of pocket.'"

// After
"4. 'What's something like this going to cost?'"
```

Change objection 5:
```
// Before
"5. 'I had an insurance claim three years ago and my rates went up. I'm not filing another one.'"

// After
"5. 'I had a bad experience with an insurance claim a few years back. I'm on the fence about using insurance for this.'"
```

- [ ] **Step 3: Fix homeowner_facetime_3 (Tom Becker) — neutralize insurance objection 2**

In `systemPrompt`, change objection 2:
```
// Before
"2. 'I have insurance but my deductible is $2,500. Am I going to owe that full amount?'"

// After
"2. 'If I were to use my insurance, how does the cost actually work? What would I end up paying?'"
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add web/lib/personas.ts
git commit -m "fix: remove baked-in claim decisions from static technician personas"
```

---

### Task 5: Clean seeded personas in web/lib/all-personas.ts

**Files:**
- Modify: `web/lib/all-personas.ts`

**Cleanup rule (same as Task 4):**
1. Remove `systemPrompt` / `briefDescription` / `firstMessage` language stating the homeowner has *already filed*, *already had an adjuster visit*, or is *explicitly not using insurance*
2. Keep: "has insurance", "confused about coverage", "worried about cost/deductible" — these are personality traits, not decisions

**Identified specific changes (apply all in one editing pass):**

- [ ] **Step 1: Fix homeowner_inbound_2 (David Chen)**

In `systemPrompt`, change:
```
// Before
"You have Allstate insurance and have already opened a claim."

// After
"You have Allstate insurance but have not yet decided whether to file a claim."
```

- [ ] **Step 2: Fix homeowner_inbound_3 (Sandra Flores)**

Change `personalityType`:
```
// Before: "Already Has Insurance Involved"
// After:  "Insurance-Focused Researcher"
```

Change `briefDescription`:
```
// Before
"Her insurance adjuster told her to get three quotes and she's just checking boxes. Her objection is she already has a preferred vendor from her insurance company and is skeptical of independents."

// After
"Sandra has water damage and wants to understand whether to use her insurance company's preferred vendor or hire an independent company. She's methodical and wants to make the right call."
```

Change `firstMessage`:
```
// Before
"Hi, my insurance company gave me a list of contractors to call. I'm just getting my three quotes like they asked. Can you give me a quote over the phone?"

// After
"Hi, I have water damage and I'm trying to figure out the best way to handle this. I know insurance companies have preferred vendors — can you tell me how you work with insurance companies?"
```

In `systemPrompt`, remove: "Your insurance company (Farmers) has already sent an adjuster and given you a preferred vendor list. You're calling independents just to fulfill the three-quote requirement."

Replace with: "You have Farmers homeowners insurance and are weighing whether to involve them. You've heard insurance companies have preferred vendors and you want to understand how independent restoration companies compare before deciding."

- [ ] **Step 3: Fix homeowner_inbound_4 (Tom Grady)**

In `systemPrompt`, change:
```
// Before
"You secretly have homeowners insurance but don't want to use it because you're worried about your rates going up. You will not mention insurance unless directly asked."

// After
"You have homeowners insurance but are worried about your rates going up if you file a claim. You're hesitant to bring it up but won't deny you have it if asked."
```

- [ ] **Step 4: Fix homeowner_inbound_9 (Mike Kowalski)**

In `systemPrompt`, change:
```
// Before
"You are not covered by insurance (high deductible) so any cost comes out of pocket, which is the real reason you tried to DIY it."

// After
"You have high-deductible insurance and the real reason you tried to DIY it is that you're not sure the total cost will even exceed your deductible — and you don't want to file a small claim."
```

- [ ] **Step 5: Fix homeowner_facetime_10 (Gary Okafor)**

In `systemPrompt`, change:
```
// Before
"minimize vacancy and maximize your claim"

// After
"minimize vacancy and manage cost"
```

- [ ] **Step 6: Fix homeowner_facetime_12 (Roberto Vega)**

Change `firstMessage`:
```
// Before
"Come in. I know flooding isn't covered by insurance so I'm kind of bracing myself for whatever this is going to cost out of pocket. I've got savings."

// After
"Come in. I'm not totally sure what my insurance covers for something like this — a pipe burst inside the house. I always heard flooding isn't covered but I'm not sure if that applies here."
```

In `systemPrompt`, change:
```
// Before
"You are prepared to pay entirely out of pocket."

// After
"You're genuinely unsure if your Farmers homeowners insurance covers internal pipe damage — you've heard 'flooding isn't covered' and have conflated it with all water damage."
```

Keep the rest of the persona (the misconception about flood vs. plumbing coverage is still a valuable training element regardless of payment type).

- [ ] **Step 7: Fix homeowner_facetime_14 (Denise Rutherford)**

Change `personalityType`:
```
// Before: "Already Has Insurance Involved"
// After:  "Unsure About Next Steps"
```

Change `briefDescription`:
```
// Before
"Her adjuster told her to get contractors in immediately but also said to get pre-approval for the work scope. She's caught between urgency and process."

// After
"Her master bathroom flooded from a cracked shower pan. She has insurance and wants to do this the right way but isn't sure what to do first — call insurance, call a restoration company, or wait."
```

Change `firstMessage`:
```
// Before
"Hi, come in — my adjuster told me to get someone in here right away, but he also said to call him before anything gets removed or opened up. So I'm not sure what you can do right now."

// After
"Hi, come in — I have water damage in my master bathroom from a cracked shower pan. I'm not sure what I'm supposed to do first — call my insurance company or call a restoration company. Can you help me figure that out?"
```

In `systemPrompt`, remove all references to an adjuster having already visited or given instructions. Replace the opening context with: "You have State Farm homeowners insurance and want to handle this correctly. You're unsure whether to call insurance first or get restoration started first, and you're worried about doing something wrong that might affect your claim."

- [ ] **Step 8: Full audit pass — remaining technician personas**

Read through all remaining `homeowner_inbound_*`, `homeowner_facetime_*`, and `plumber_lead_*` entries that haven't been touched yet. Apply the same cleanup rule to any that contain:
- Phrases like "already filed", "adjuster has been out", "adjuster told me", "already opened a claim"
- Phrases like "paying out of pocket", "not using insurance", "won't mention insurance unless asked"

Note: references to *having* insurance, *wondering* about coverage, or *worrying* about cost are fine to leave — these are personality traits, not payment decisions.

- [ ] **Step 9: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```

Expected: no type errors (only string content changed, `PersonaSeed` shape is unchanged).

- [ ] **Step 10: Commit**

```bash
git add web/lib/all-personas.ts
git commit -m "fix: remove baked-in claim decisions from seeded technician personas"
```

---

### Task 6: Re-seed DB and verify end-to-end

- [ ] **Step 1: Start the dev server**

```bash
cd web && npm run dev
```

- [ ] **Step 2: Re-seed personas to push cleaned prompts to DB**

```bash
curl -X POST http://localhost:3000/api/seed
```

Expected: `{"success":true}` or similar. This updates all persona rows in Supabase with the cleaned system prompts.

- [ ] **Step 3: Verify Potential Claim path (phone)**

Open http://localhost:3000/training. Select **Homeowner — Inbound Call**. Set difficulty Medium, payment type **Potential Claim**. Start call. Verify the persona raises insurance-related topics (deductible, adjuster, claim process). End call.

- [ ] **Step 4: Verify Self-Pay path (phone)**

Select **Homeowner — Inbound Call**. Set payment type **Self-Pay**. Start call. Verify the persona asks about cost and payment but does NOT demand an exact price quote over the phone.

- [ ] **Step 5: Verify Self-Pay path (face to face)**

Select **Homeowner — Face to Face**. Set payment type **Self-Pay**. Start call. Verify the persona at some point directly asks the technician for a price or estimate.

- [ ] **Step 6: Verify Random stays hidden**

Select any technician scenario. Set payment type **Random**. Start call. Verify the "Random" button label does not change to reveal the resolved type during or after the call.

- [ ] **Step 7: Verify BD scenarios unaffected**

Select **Residential Property Manager** (or any BD scenario). Verify the Payment Type selector does NOT appear on the persona preview screen.

- [ ] **Step 8: Run lint**

```bash
cd web && npm run lint
```

Fix any lint errors, commit if needed:

```bash
git add web/app/training/page.tsx
git commit -m "fix: lint issues in payment type feature"
```
