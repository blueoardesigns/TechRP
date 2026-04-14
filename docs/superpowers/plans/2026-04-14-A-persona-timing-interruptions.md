# Persona Timing & Interruptions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI personas push toward call close at 7.5 min, hard-stop at 10 min via Vapi, and interrupt the user naturally based on personality type.

**Architecture:** All changes live in `web/app/training/page.tsx` — we inject timing and interrupt instructions into the assembled `systemPrompt` string rather than editing 150+ persona seeds. Vapi's `maxDurationSeconds` provides the hard cap. No DB changes.

**Tech Stack:** TypeScript, Vapi SDK, existing training page

---

## File Map

| File | Change |
|---|---|
| `web/app/training/page.tsx` | Add `TIMING_INSTRUCTIONS` constant, `getInterruptInstructions()` function, inject both into `systemPrompt`, add `maxDurationSeconds: 600` to `sharedOverrides` |

---

### Task 1: Add timing instructions and interrupt behavior

**Files:**
- Modify: `web/app/training/page.tsx`

- [ ] **Step 1: Read the current file around the systemPrompt assembly**

Run:
```bash
grep -n "systemPrompt\|sharedOverrides\|DIFFICULTY" web/app/training/page.tsx | head -30
```
Confirm `systemPrompt` is built on a line like:
```typescript
const systemPrompt = DIFFICULTY_MODIFIERS[difficultyRef.current] + selectedPersona.systemPrompt;
```

- [ ] **Step 2: Add the TIMING_INSTRUCTIONS constant and getInterruptInstructions function**

Find the block where `DIFFICULTY_MODIFIERS` is defined (or near the top of the file after imports) and add the following. Place it just before or after the existing `DIFFICULTY_MODIFIERS` constant:

```typescript
const TIMING_INSTRUCTIONS = `

TIMING: This is a training call with a strict 10-minute limit. Around the 7 to 7.5 minute mark, naturally steer the conversation toward a close or a clear next step — even if the conversation isn't fully complete. If the call is going well at that point, push for commitment: agree to sign, schedule a follow-up appointment, or lock in a concrete next action before ending. Never let the call drift past 10 minutes without a resolution.`;

function getInterruptInstructions(personalityType: string): string {
  const pt = personalityType.toLowerCase();

  if (/skeptic|frustrat|angry|upset|irate|hostile|aggressive|pushy|difficult/.test(pt)) {
    return `

INTERRUPTION: You interrupt freely when the technician rambles, repeats themselves, or does not directly answer your question. Cut in mid-sentence with phrases like "Hold on—", "Wait, that's not what I asked", or "I'm going to stop you there." Do not wait for them to finish if you are frustrated.`;
  }

  if (/busy|dismiss|rushed|impatient|no.?time|distract/.test(pt)) {
    return `

INTERRUPTION: You have very limited time. If the technician doesn't get to the point within two or three sentences, cut in with "I need the short version" or "Can you just tell me the bottom line?" You interrupt when they repeat themselves or give you information you didn't ask for.`;
  }

  if (/analytical|engineer|detail|methodical|research/.test(pt)) {
    return `

INTERRUPTION: You occasionally cut in to ask a specific clarifying question when something is vague or doesn't add up. Don't let imprecise statements slide — interject with "What exactly does that mean?" or "Can you give me a specific number on that?"`;
  }

  // Default for agreeable, panicked, elderly, confused, first-time types
  return `

INTERRUPTION: You generally let the technician finish speaking. You may interject if they say something confusing or contradictory, but you are not naturally interruptive.`;
}
```

- [ ] **Step 3: Update the systemPrompt assembly line to inject timing and interrupt instructions**

Find this line (approximately line 293):
```typescript
const systemPrompt = DIFFICULTY_MODIFIERS[difficultyRef.current] + selectedPersona.systemPrompt;
```

Replace it with:
```typescript
const systemPrompt =
  DIFFICULTY_MODIFIERS[difficultyRef.current] +
  selectedPersona.systemPrompt +
  TIMING_INSTRUCTIONS +
  getInterruptInstructions(selectedPersona.personalityType);
```

- [ ] **Step 4: Add maxDurationSeconds to sharedOverrides**

Find the `sharedOverrides` object (approximately line 294–302):
```typescript
const sharedOverrides = {
  voice: { provider: '11labs', voiceId, model: 'eleven_flash_v2_5' },
  firstMessage: selectedPersona.firstMessage,
  stopSpeakingPlan: {
    numWords: 0,
    voiceSeconds: 0.1,
    backoffSeconds: 0.5,
  },
};
```

Replace with:
```typescript
const sharedOverrides = {
  voice: { provider: '11labs', voiceId, model: 'eleven_flash_v2_5' },
  firstMessage: selectedPersona.firstMessage,
  maxDurationSeconds: 600,
  stopSpeakingPlan: {
    numWords: 0,
    voiceSeconds: 0.1,
    backoffSeconds: 0.5,
  },
};
```

- [ ] **Step 5: Verify the build has no TypeScript errors**

```bash
cd web && npm run build 2>&1 | tail -20
```

Expected: Build completes without errors. If `maxDurationSeconds` causes a type error, add `as any` to the overrides object (it already uses `as any` on the `start()` call).

- [ ] **Step 6: Manual smoke test**

```bash
cd web && npm run dev
```

Open http://localhost:3000/training, start a call with a "Skeptical" persona. Verify:
- Call auto-ends at or before 10 minutes (Vapi hard cap)
- Persona exhibits interrupt behavior ("Hold on—", etc.) when you ramble

- [ ] **Step 7: Commit**

```bash
cd /Users/TinierTim/TBDev/techrp
git add web/app/training/page.tsx
git commit -m "feat: add call timing cap and per-personality interrupt behavior to AI personas"
```
