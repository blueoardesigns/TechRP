# Payment Type Selector — Design Spec
Date: 2026-04-17

## Overview

Add a "Payment Type" selector to the technician session setup (persona-preview phase). This controls whether the homeowner persona behaves as someone filing/considering an insurance claim, paying out of pocket, or a random mix of either. Works identically to the existing difficulty selector — injects a modifier block into the Vapi system prompt at call start.

Scope: technician-group scenarios only (`homeowner_inbound`, `homeowner_facetime`, `plumber_lead`). BD scenarios are unaffected.

---

## 1. State & Resolver

New state in `web/app/training/page.tsx`:

```ts
type PaymentType = 'potential_claim' | 'self_pay' | 'random';
const [paymentType, setPaymentType] = useState<PaymentType>('random');
const paymentTypeRef = useRef<PaymentType>('random');
```

Default: `'random'` — mirrors how `difficulty` defaults to `'medium'`.

At call start, resolve before injecting into the system prompt:

```ts
function resolvePaymentType(type: PaymentType, scenarioType: ScenarioType): string {
  const resolved = type === 'random'
    ? (Math.random() < 0.5 ? 'potential_claim' : 'self_pay')
    : type;
  const isFaceToFace = scenarioType === 'homeowner_facetime';
  return PAYMENT_MODIFIERS[resolved][isFaceToFace ? 'facetime' : 'call'];
}
```

The resolved type is never surfaced to the technician when Random was selected.

---

## 2. Prompt Injection

### Position in system prompt
```
DIFFICULTY_MODIFIER + PAYMENT_MODIFIER + persona.systemPrompt + TIMING_INSTRUCTIONS + INTERRUPT_INSTRUCTIONS
```

### Modifier strings

**Potential Claim (both call types):**
```
[PAYMENT TYPE: POTENTIAL CLAIM] This homeowner has contacted or is seriously considering contacting their insurance company about this damage. They may ask how claims work, whether you work with adjusters, what their deductible means for them, and how billing flows through insurance. Let those topics come up naturally based on their personality — do not volunteer a claim decision they have not yet made.
```

**Self-Pay — Phone call** (`homeowner_inbound`, `plumber_lead`):
```
[PAYMENT TYPE: SELF-PAY] This homeowner is paying out of pocket and is not filing an insurance claim. They may ask how much something like this typically costs, how payment works, or whether payment plans exist. They will not demand an exact price quote over the phone, but will express genuine curiosity about overall cost.
```

**Self-Pay — Face to face** (`homeowner_facetime`):
```
[PAYMENT TYPE: SELF-PAY] This homeowner is paying out of pocket and is not filing an insurance claim. At a natural point in the conversation, directly ask the technician for a price or estimate. Be direct about wanting to understand the cost before committing.
```

Face-to-face detection: `scenarioType === 'homeowner_facetime'`.

---

## 3. Persona Cleanup

### Problem
Many technician personas in `web/lib/personas.ts` and `web/lib/all-personas.ts` have claim decisions baked into their system prompts, which would conflict with the injected modifier.

### Two categories to fix

**Already-filed / adjuster-involved** — locks scenario into insurance path:
- Examples: "already opened a claim", "adjuster has already been out", "adjuster told me to call you first"
- Fix: remove or rewrite to neutral past-tense context ("has homeowners insurance, hasn't decided next steps")

**Explicit self-pay** — locks scenario into no-insurance path:
- Examples: "not covered by insurance, cost comes out of pocket", "bracing for out-of-pocket cost", "won't mention insurance unless asked"
- Fix: remove the self-pay framing; keep the cost-anxiety personality trait without specifying the payment path

### What to keep
- "Has homeowners insurance with [carrier]" — fine, realistic background
- Deductible anxiety as a personality trait — fine, but framed as a concern, not a decided path
- General cost sensitivity — fine, keep it

### Files to update
- `web/lib/all-personas.ts` — all technician personas (homeowner_inbound_*, homeowner_facetime_*, plumber_lead_*)
- `web/lib/personas.ts` — the smaller static PERSONAS array (same scenario types)

After updating, re-seeding via `POST /api/seed` will push cleaned personas to the DB.

---

## 4. UI

Location: persona-preview phase, directly below the existing difficulty selector.

Only rendered when `SCENARIOS.find(s => s.type === selectedPersona.scenarioType)?.group === 'technician'`.

```
Payment Type
[ Potential Claim ]  [ Self-Pay ]  [ Random ]
```

Button styles mirror the difficulty selector:
- Selected "Potential Claim": blue accent (matches insurance/claim context)
- Selected "Self-Pay": amber accent
- Selected "Random": gray (neutral, same as unselected difficulty)
- Unselected: `bg-transparent text-gray-600 border-white/10`

The `Random` button label never changes to reveal the resolved type.

---

## 5. Out of Scope

- Saving resolved payment type to `training_sessions` DB — not in this change
- BD scenarios — no payment type selector
- Mobile app — not touched
