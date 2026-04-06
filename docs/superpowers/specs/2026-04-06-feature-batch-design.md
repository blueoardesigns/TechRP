# Feature Batch Design — 2026-04-06

Four improvements to training quality, editor UX, and session review.

---

## Feature 1 — Playbook/Persona Editor: Formatting Toolbar + AI Rewrite

### Overview
Two enhancements to the playbook detail editor and persona system-prompt textarea: a markdown formatting toolbar and an AI-powered rewrite panel.

### Formatting Toolbar (Playbook editor only)
Rendered above the textarea when `isEditing` is true. Buttons:

| Button | Action |
|--------|--------|
| **B** | Wrap selection in `**...**` |
| *I* | Wrap selection in `*...*` |
| H2 | Prefix line with `## ` |
| • Bullet | Prefix line with `- ` |
| 1. Numbered | Prefix line with `1. ` |

Implementation: pure DOM manipulation via `textarea.selectionStart` / `selectionEnd`. No external library. A `insertFormatting(type)` helper reads/writes the textarea value and updates React state.

### AI Rewrite Panel (Playbook editor + Persona system_prompt)
Rendered below the formatting toolbar (playbooks) or below the `system_prompt` textarea (personas) when editing.

**Quick-action chips (5 presets):**
1. Add bullet points
2. Summarize
3. Make more concise
4. Expand with examples
5. Add objection handling

**Freeform input:** text field for custom prompt (e.g. "Rewrite for a plumber audience").

**Behavior:** Clicking a chip or submitting the freeform input:
1. Shows loading state on the button / input
2. POSTs `{ content, prompt }` to `POST /api/ai/rewrite-content`
3. Replaces the textarea value with the returned content
4. User can undo by pressing Cancel (which resets to original saved content)

### New API Route: `POST /api/ai/rewrite-content`
- **Auth:** Requires valid Supabase session (uses `createServerSupabase()`)
- **Request body:** `{ content: string, prompt: string }`
- **Claude call:** Single-turn with system prompt: *"You are an editor. Rewrite the following content according to the instruction. Return only the rewritten content with no preamble or explanation."*
- **Response:** `{ content: string }`
- **Error handling:** Returns `{ error: string }` with appropriate HTTP status

### Files changed
- `web/app/playbooks/[id]/page.tsx` — add toolbar + AI rewrite panel in edit mode
- `web/app/personas/page.tsx` — add AI rewrite panel to `system_prompt` field in modal
- `web/app/api/ai/rewrite-content/route.ts` — new file

---

## Feature 2 — Vapi Interrupt Settings

### Overview
The AI persona currently doesn't yield when the user starts speaking mid-sentence. Adding a `stopSpeakingPlan` override makes it responsive to interruptions.

### Change
In `web/app/training/page.tsx` → `handleStartCall`, add to the `assistantOverrides` passed to `vapiRef.current.start()`:

```ts
stopSpeakingPlan: {
  numWordsToInterruptAssistant: 1,
  voiceSeconds: 0.2,
  backoffSeconds: 1,
},
```

- `numWordsToInterruptAssistant: 1` — one spoken word is enough to cut the assistant off
- `voiceSeconds: 0.2` — 200ms of detected voice triggers interrupt
- `backoffSeconds: 1` — after the user stops speaking, wait 1s before assistant resumes

### Files changed
- `web/app/training/page.tsx` — ~5 line addition inside `handleStartCall`

---

## Feature 3 — Playbook Below Session Detail

### Overview
When reviewing a session, the user may want a quick reminder of the playbook that was in play. Fetching the matching playbook by `persona_scenario_type` and showing it as a collapsed accordion at the bottom of the page.

### Implementation
`web/app/sessions/[id]/page.tsx` is a server component. Add a second Supabase query after `getSession`:

```ts
async function getPlaybookForScenario(scenarioType: string | null) {
  if (!scenarioType) return null;
  const { data } = await supabase
    .from('playbooks')
    .select('name, content')
    .eq('scenario_type', scenarioType)
    .is('coach_instance_id', null)  // global playbook
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data ?? null;
}
```

Render below the transcript:

```tsx
{playbook && (
  <details className="...">
    <summary>Playbook: {playbook.name}</summary>
    <ReactMarkdown>{playbook.content}</ReactMarkdown>
  </details>
)}
```

- Collapsed by default (`<details>` without `open`)
- Uses `ReactMarkdown` (already a dependency)
- If no playbook found for that scenario type, section is omitted entirely
- Styled to match the existing card pattern (gray-900 bg, white/10 border, rounded-2xl)

### Files changed
- `web/app/sessions/[id]/page.tsx` — add query + accordion section

---

## Feature 4 — Easy / Medium / Hard Difficulty

### Overview
Technicians can select a difficulty before starting a call. Difficulty injects a modifier into the persona's system prompt sent to Vapi — no DB changes.

### UI
On the `persona-preview` phase, add a difficulty selector above the "Start Training Call" button:

```
Difficulty   [ Easy ]  [ Medium ]  [ Hard ]
```

- Default: Medium
- Stored in `useState<'easy' | 'medium' | 'hard'>('medium')`
- Also carried in a `difficultyRef` so it's available inside the `call-end` event handler

### System Prompt Modifiers

| Level | Prepended text |
|-------|---------------|
| Easy | `"[DIFFICULTY: EASY] Be cooperative and relatively easy to work with. Raise at most one minor objection before warming up to the conversation.\n\n"` |
| Medium | *(no modifier — system prompt used as-is)* |
| Hard | `"[DIFFICULTY: HARD] Be highly skeptical and resistant. Raise 2–3 strong objections. Push back firmly before considering any agreement. Don't commit easily.\n\n"` |

### Call Header Badge
During the call phase, display the difficulty as a colored chip next to the status indicator:

- Easy: green
- Medium: yellow
- Hard: red

### Session Storage
Difficulty is **not** stored to the database. It's a training aid, not a metric.

### Files changed
- `web/app/training/page.tsx` — add `difficulty` state + ref, selector UI on persona-preview phase, modifier logic in `handleStartCall`, badge in calling phase header

---

## Summary of Files

| File | Change |
|------|--------|
| `web/app/playbooks/[id]/page.tsx` | Formatting toolbar + AI rewrite panel |
| `web/app/personas/page.tsx` | AI rewrite panel on system_prompt field |
| `web/app/api/ai/rewrite-content/route.ts` | New API route |
| `web/app/training/page.tsx` | Interrupt settings + difficulty selector |
| `web/app/sessions/[id]/page.tsx` | Playbook accordion below transcript |
