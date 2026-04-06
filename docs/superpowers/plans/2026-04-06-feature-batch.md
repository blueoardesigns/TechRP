# Feature Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI content rewrite, markdown formatting toolbar, Vapi interrupt tuning, call difficulty selector, and playbook accordion on session detail.

**Architecture:** One new API route for Claude-powered content rewrite. Three existing pages get targeted additions: training page gets interrupt config + difficulty state, playbook editor gets formatting toolbar + AI panel, persona editor gets AI panel, session detail gets a server-side playbook fetch + accordion.

**Tech Stack:** Next.js 14 App Router, `@anthropic-ai/sdk`, `@vapi-ai/web`, `react-markdown`, Supabase, Tailwind CSS.

---

## File Map

| File | Change |
|------|--------|
| `web/app/api/ai/rewrite-content/route.ts` | **Create** — POST endpoint, calls Claude, returns rewritten text |
| `web/app/playbooks/[id]/page.tsx` | **Modify** — add formatting toolbar + AI rewrite panel in edit mode |
| `web/app/personas/page.tsx` | **Modify** — add AI rewrite panel to system_prompt field in edit modal |
| `web/app/training/page.tsx` | **Modify** — add `stopSpeakingPlan` + difficulty selector + badge |
| `web/app/sessions/[id]/page.tsx` | **Modify** — fetch playbook by scenario type, render collapsed accordion |

---

## Task 1: API Route — POST /api/ai/rewrite-content

**Files:**
- Create: `web/app/api/ai/rewrite-content/route.ts`

- [ ] **Step 1: Create the route file**

```ts
// web/app/api/ai/rewrite-content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerSupabase } from '@/lib/supabase-server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { content, prompt } = await req.json();
    if (!content || !prompt) {
      return NextResponse.json({ error: 'content and prompt are required' }, { status: 400 });
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: 'You are an editor. Rewrite the provided content according to the instruction. Return only the rewritten content — no preamble, explanation, or surrounding quotes.',
      messages: [{ role: 'user', content: `Instruction: ${prompt}\n\n---\n\n${content}` }],
    });

    const result = message.content[0].type === 'text' ? message.content[0].text : '';
    return NextResponse.json({ content: result });
  } catch (e: any) {
    console.error('AI rewrite error:', e);
    return NextResponse.json({ error: e.message ?? 'Rewrite failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify the route compiles**

```bash
cd web && npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no TypeScript errors in the new file.

- [ ] **Step 3: Smoke-test with curl (dev server must be running)**

```bash
# First get a session cookie by logging in, then:
curl -s -X POST http://localhost:3000/api/ai/rewrite-content \
  -H "Content-Type: application/json" \
  -d '{"content":"Call the homeowner back","prompt":"Make more concise"}' \
  -b "your-supabase-session-cookie"
```

Expected: `{"content":"...rewritten text..."}` or `{"error":"Unauthorized"}` if no cookie (correct — auth is working).

- [ ] **Step 4: Commit**

```bash
git add web/app/api/ai/rewrite-content/route.ts
git commit -m "feat: add POST /api/ai/rewrite-content endpoint"
```

---

## Task 2: Vapi Interrupt Settings

**Files:**
- Modify: `web/app/training/page.tsx` (inside `handleStartCall`, the `vapiRef.current.start()` call)

- [ ] **Step 1: Add `stopSpeakingPlan` to the Vapi start call**

Find the `vapiRef.current.start(VAPI_ASSISTANT_ID, { ... } as any)` call (~line 234) and add `stopSpeakingPlan` alongside the existing overrides:

```ts
const callInfo = await vapiRef.current.start(VAPI_ASSISTANT_ID, {
  model: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    messages: [{ role: 'system', content: selectedPersona.systemPrompt }],
  },
  voice: { provider: 'vapi', voiceId },
  firstMessage: selectedPersona.firstMessage,
  stopSpeakingPlan: {
    numWordsToInterruptAssistant: 1,
    voiceSeconds: 0.2,
    backoffSeconds: 1,
  },
} as any);
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd web && npm run build 2>&1 | grep "training" | grep -i error
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/app/training/page.tsx
git commit -m "feat: tune Vapi stopSpeakingPlan to allow 1-word interruptions"
```

---

## Task 3: Difficulty Selector + Badge

**Files:**
- Modify: `web/app/training/page.tsx`

- [ ] **Step 1: Add difficulty state, ref, and modifier constant near the top of `TrainingPage`**

After the existing `const vapiRef = useRef...` block (~line 133), add:

```ts
const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
const difficultyRef = useRef<'easy' | 'medium' | 'hard'>('medium');
```

After the existing `useEffect(() => { selectedPersonaRef.current = selectedPersona; }, [selectedPersona]);` (~line 190), add:

```ts
useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);
```

Add the modifier map as a module-level constant, just above the `TrainingPage` component:

```ts
const DIFFICULTY_MODIFIERS: Record<'easy' | 'medium' | 'hard', string> = {
  easy: '[DIFFICULTY: EASY] Be cooperative and relatively easy to work with. Raise at most one minor objection before warming up to the conversation.\n\n',
  medium: '',
  hard: '[DIFFICULTY: HARD] Be highly skeptical and resistant. Raise 2–3 strong objections. Push back firmly before considering any agreement. Do not commit easily.\n\n',
};
```

- [ ] **Step 2: Apply difficulty modifier to the system prompt in `handleStartCall`**

In `handleStartCall`, replace the static `selectedPersona.systemPrompt` reference in the Vapi `start()` call with:

```ts
const systemPrompt = DIFFICULTY_MODIFIERS[difficultyRef.current] + selectedPersona.systemPrompt;
```

Then use `systemPrompt` in the model messages:

```ts
messages: [{ role: 'system', content: systemPrompt }],
```

- [ ] **Step 3: Add difficulty selector UI in the persona-preview phase**

In the persona-preview `return` block, between the "Your Role" card (`</div>` closing the role card ~line 480) and the `{/* Actions */}` div, insert:

```tsx
{/* Difficulty */}
<div>
  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Difficulty</p>
  <div className="flex gap-2">
    {(['easy', 'medium', 'hard'] as const).map(d => (
      <button
        key={d}
        onClick={() => setDifficulty(d)}
        className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-colors border ${
          difficulty === d
            ? d === 'easy'   ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
            : d === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                             : 'bg-red-500/20 text-red-400 border-red-500/40'
            : 'bg-transparent text-gray-600 border-white/10 hover:border-white/20 hover:text-gray-400'
        }`}
      >
        {d}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 4: Add difficulty badge in the calling-phase header**

In the calling-phase header, in the `{/* Status indicator */}` block, add the badge after the status span:

```tsx
{/* Difficulty badge */}
<span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
  difficulty === 'easy'   ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
  difficulty === 'hard'   ? 'bg-red-500/15 text-red-400 border-red-500/30'
                          : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
} capitalize`}>
  {difficulty}
</span>
```

- [ ] **Step 5: Verify — run dev and test**

```bash
cd web && npm run dev
```

Open `http://localhost:3000/training`, select a scenario, confirm:
- Easy / Medium / Hard pills appear on persona preview
- Selected pill highlights the correct color
- During a call, the difficulty badge appears in the header

- [ ] **Step 6: Commit**

```bash
git add web/app/training/page.tsx
git commit -m "feat: add Easy/Medium/Hard difficulty selector to training calls"
```

---

## Task 4: Formatting Toolbar — Playbook Editor

**Files:**
- Modify: `web/app/playbooks/[id]/page.tsx`

- [ ] **Step 1: Add `useRef` to the React import and declare `textareaRef`**

Update the React import at the top of the file:

```ts
import { useEffect, useRef, useState } from 'react';
```

At the top of `PlaybookDetailPage`, after the existing state declarations, add:

```ts
const textareaRef = useRef<HTMLTextAreaElement>(null);
```

Add the following helper function **above** the `PlaybookDetailPage` component (module-level):

```ts
type FormatType = 'bold' | 'italic' | 'h2' | 'bullet' | 'numbered';

function applyFormatting(
  type: FormatType,
  content: string,
  selStart: number,
  selEnd: number
): { value: string; cursorStart: number; cursorEnd: number } {
  const lineStart = content.lastIndexOf('\n', selStart - 1) + 1;

  switch (type) {
    case 'bold': {
      const sel = content.slice(selStart, selEnd) || 'bold text';
      const out = `**${sel}**`;
      return {
        value: content.slice(0, selStart) + out + content.slice(selEnd),
        cursorStart: selStart + 2,
        cursorEnd: selStart + 2 + sel.length,
      };
    }
    case 'italic': {
      const sel = content.slice(selStart, selEnd) || 'italic text';
      const out = `*${sel}*`;
      return {
        value: content.slice(0, selStart) + out + content.slice(selEnd),
        cursorStart: selStart + 1,
        cursorEnd: selStart + 1 + sel.length,
      };
    }
    case 'h2': {
      const prefix = '## ';
      return {
        value: content.slice(0, lineStart) + prefix + content.slice(lineStart),
        cursorStart: selStart + prefix.length,
        cursorEnd: selEnd + prefix.length,
      };
    }
    case 'bullet': {
      const prefix = '- ';
      return {
        value: content.slice(0, lineStart) + prefix + content.slice(lineStart),
        cursorStart: selStart + prefix.length,
        cursorEnd: selEnd + prefix.length,
      };
    }
    case 'numbered': {
      const prefix = '1. ';
      return {
        value: content.slice(0, lineStart) + prefix + content.slice(lineStart),
        cursorStart: selStart + prefix.length,
        cursorEnd: selEnd + prefix.length,
      };
    }
  }
}
```

- [ ] **Step 2: Add `handleFormat` callback and attach `ref` to the textarea**

Inside `PlaybookDetailPage`, add `handleFormat` after the state declarations:

```ts
const handleFormat = (type: FormatType) => {
  const ta = textareaRef.current;
  if (!ta) return;
  const { value, cursorStart, cursorEnd } = applyFormatting(
    type, content, ta.selectionStart, ta.selectionEnd
  );
  setContent(value);
  // Restore cursor after React re-render
  requestAnimationFrame(() => {
    ta.focus();
    ta.setSelectionRange(cursorStart, cursorEnd);
  });
};
```

Add `ref={textareaRef}` to the existing `<textarea>` element in the editor panel (it currently has no ref).

- [ ] **Step 3: Render the formatting toolbar in edit mode**

In the editor panel, between the `<p className="text-xs ...">Markdown</p>` label and the `<textarea>`, insert:

```tsx
{/* Formatting toolbar */}
<div className="flex items-center gap-1 mb-2">
  {([
    { type: 'bold'     as FormatType, label: 'B',  title: 'Bold'         },
    { type: 'italic'   as FormatType, label: 'I',  title: 'Italic'       },
    { type: 'h2'       as FormatType, label: 'H2', title: 'Heading'      },
    { type: 'bullet'   as FormatType, label: '•',  title: 'Bullet list'  },
    { type: 'numbered' as FormatType, label: '1.', title: 'Numbered list' },
  ]).map(({ type, label, title }) => (
    <button
      key={type}
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); handleFormat(type); }}
      className="px-2.5 py-1 text-xs font-mono font-semibold text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-800 border border-white/10 hover:border-white/25 rounded-lg transition-colors"
    >
      {label}
    </button>
  ))}
</div>
```

Note: `onMouseDown` with `e.preventDefault()` prevents the textarea from losing focus before the handler reads `selectionStart/End`.

- [ ] **Step 4: Verify in browser**

```bash
cd web && npm run dev
```

Open a playbook, click Edit. Confirm toolbar appears. Type some text, select it, click **B** → selection wraps in `**...**`. Place cursor on a line, click **•** → `- ` prepends to the line.

- [ ] **Step 5: Commit**

```bash
git add web/app/playbooks/[id]/page.tsx
git commit -m "feat: add markdown formatting toolbar to playbook editor"
```

---

## Task 5: AI Rewrite Panel — Playbook Editor

**Files:**
- Modify: `web/app/playbooks/[id]/page.tsx`

- [ ] **Step 1: Add `AIRewritePanel` component**

Add this component **above** `PlaybookDetailPage` in the same file:

```tsx
const QUICK_ACTIONS = [
  'Add bullet points',
  'Summarize',
  'Make more concise',
  'Expand with examples',
  'Add objection handling',
] as const;

function AIRewritePanel({ content, onRewrite }: { content: string; onRewrite: (c: string) => void }) {
  const [customPrompt, setCustomPrompt] = useState('');
  const [rewriting, setRewriting] = useState(false);

  const runRewrite = async (prompt: string) => {
    if (!prompt.trim() || rewriting) return;
    setRewriting(true);
    try {
      const res = await fetch('/api/ai/rewrite-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, prompt }),
      });
      const data = await res.json();
      if (data.content) onRewrite(data.content);
      else console.error('AI rewrite error:', data.error);
    } catch (e) {
      console.error('AI rewrite failed:', e);
    } finally {
      setRewriting(false);
    }
  };

  return (
    <div className="border border-white/10 rounded-xl p-4 bg-gray-900/50 space-y-3 mt-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AI Rewrite</p>
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map(action => (
          <button
            key={action}
            type="button"
            onClick={() => runRewrite(action)}
            disabled={rewriting}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:border-blue-500/50 hover:text-blue-400 transition-colors disabled:opacity-40"
          >
            {rewriting ? '…' : action}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={customPrompt}
          onChange={e => setCustomPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { runRewrite(customPrompt); setCustomPrompt(''); } }}
          placeholder="Custom instruction… (e.g. rewrite for plumbers)"
          disabled={rewriting}
          className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/60 disabled:opacity-40"
        />
        <button
          type="button"
          onClick={() => { runRewrite(customPrompt); setCustomPrompt(''); }}
          disabled={rewriting || !customPrompt.trim()}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
        >
          {rewriting ? '…' : 'Rewrite'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render the panel below the editor textarea**

In the editor panel (`flex flex-col flex-1`), after the closing `</textarea>` tag, add:

```tsx
<AIRewritePanel content={content} onRewrite={setContent} />
```

- [ ] **Step 3: Verify in browser**

Open a playbook → Edit. Confirm AI Rewrite panel appears below the textarea. Click "Summarize" — content should be replaced with a summary after a moment. Try a custom prompt. Confirm Cancel still resets to the last saved state.

- [ ] **Step 4: Commit**

```bash
git add web/app/playbooks/[id]/page.tsx
git commit -m "feat: add AI rewrite panel to playbook editor"
```

---

## Task 6: AI Rewrite Panel — Persona System Prompt

**Files:**
- Modify: `web/app/personas/page.tsx`

- [ ] **Step 1: Copy `AIRewritePanel` and `QUICK_ACTIONS` into the file**

Add to `web/app/personas/page.tsx` — add just above the `PersonasPage` component. The code is identical to Task 5 Step 1 except it doesn't need `useState` imported again (it's already imported):

```tsx
const QUICK_ACTIONS = [
  'Add bullet points',
  'Summarize',
  'Make more concise',
  'Expand with examples',
  'Add objection handling',
] as const;

function AIRewritePanel({ content, onRewrite }: { content: string; onRewrite: (c: string) => void }) {
  const [customPrompt, setCustomPrompt] = useState('');
  const [rewriting, setRewriting] = useState(false);

  const runRewrite = async (prompt: string) => {
    if (!prompt.trim() || rewriting) return;
    setRewriting(true);
    try {
      const res = await fetch('/api/ai/rewrite-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, prompt }),
      });
      const data = await res.json();
      if (data.content) onRewrite(data.content);
      else console.error('AI rewrite error:', data.error);
    } catch (e) {
      console.error('AI rewrite failed:', e);
    } finally {
      setRewriting(false);
    }
  };

  return (
    <div className="border border-white/10 rounded-xl p-4 bg-gray-900/50 space-y-3 mt-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AI Rewrite</p>
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map(action => (
          <button
            key={action}
            type="button"
            onClick={() => runRewrite(action)}
            disabled={rewriting}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:border-blue-500/50 hover:text-blue-400 transition-colors disabled:opacity-40"
          >
            {rewriting ? '…' : action}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={customPrompt}
          onChange={e => setCustomPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { runRewrite(customPrompt); setCustomPrompt(''); } }}
          placeholder="Custom instruction… (e.g. make more aggressive)"
          disabled={rewriting}
          className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/60 disabled:opacity-40"
        />
        <button
          type="button"
          onClick={() => { runRewrite(customPrompt); setCustomPrompt(''); }}
          disabled={rewriting || !customPrompt.trim()}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
        >
          {rewriting ? '…' : 'Rewrite'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Find the system_prompt field in the modal form and add the panel**

In the modal form inside `PersonasPage`, find the `system_prompt` field (it's a `<textarea>` inside a `<Field>` component). After the Field component wrapping `system_prompt`, add:

```tsx
<AIRewritePanel
  content={form.system_prompt}
  onRewrite={val => setForm(f => ({ ...f, system_prompt: val }))}
/>
```

- [ ] **Step 3: Verify in browser**

Open Personas page → click Edit on any persona. Confirm AI Rewrite panel appears below the System Prompt textarea. Click a quick-action chip and confirm the system prompt is replaced.

- [ ] **Step 4: Commit**

```bash
git add web/app/personas/page.tsx
git commit -m "feat: add AI rewrite panel to persona system_prompt editor"
```

---

## Task 7: Playbook Accordion on Session Detail

**Files:**
- Modify: `web/app/sessions/[id]/page.tsx`

- [ ] **Step 1: Add `getPlaybookForScenario` server function**

Add this function just below `getSession` at the top of the file:

```ts
async function getPlaybookForScenario(scenarioType: string | null) {
  if (!scenarioType) return null;
  try {
    const { data } = await (supabase as any)
      .from('playbooks')
      .select('name, content')
      .eq('scenario_type', scenarioType)
      .is('coach_instance_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Call it in `SessionDetailPage` and pass `ReactMarkdown` import**

At the top of the file, add the import:

```ts
import ReactMarkdown from 'react-markdown';
```

In `SessionDetailPage`, after `const session = await getSession(params.id);`, add:

```ts
const playbook = await getPlaybookForScenario((session as any).persona_scenario_type ?? null);
```

- [ ] **Step 3: Render the accordion below the transcript section**

After the closing `</div>` of the transcript section (the last block before the closing `</div>` of the main content), add:

```tsx
{/* ── Playbook ──────────────────────────────────────────────────────── */}
{playbook && (
  <details className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden group">
    <summary className="px-5 py-4 cursor-pointer flex items-center justify-between select-none hover:bg-white/5 transition-colors">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Playbook Used</p>
        <p className="text-sm font-semibold text-white">{playbook.name}</p>
      </div>
      <svg
        className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </summary>
    <div className="px-8 py-6 border-t border-white/10">
      <div className="dark-prose">
        <ReactMarkdown>{playbook.content}</ReactMarkdown>
      </div>
    </div>
  </details>
)}
```

- [ ] **Step 4: Verify in browser**

```bash
cd web && npm run dev
```

Open any session that has a `persona_scenario_type`. Confirm the "Playbook Used" accordion appears at the bottom. Click to expand — playbook content should render as formatted markdown. Sessions without a matching playbook show no accordion.

- [ ] **Step 5: Commit**

```bash
git add web/app/sessions/[id]/page.tsx
git commit -m "feat: show playbook accordion on session detail page"
```

---

## Final Verification

- [ ] Run `cd web && npm run build` — confirm zero TypeScript errors across all modified files
- [ ] Start dev server, run through a full training call at each difficulty level — confirm Easy/Medium/Hard modifiers affect AI behavior and badge shows in call header
- [ ] Edit a playbook: test each toolbar button + at least 2 AI rewrite actions
- [ ] Edit a persona system_prompt: confirm AI rewrite works
- [ ] Open any session with a known scenario type: confirm playbook accordion appears and expands correctly
- [ ] Mark all 4 TODO items as complete in `TODO.md`
