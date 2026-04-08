# In-Call LLM: Groq Llama 3.3 70B with Haiku Fallback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-call Vapi LLM (currently Claude Sonnet) with Groq Llama 3.3 70B, falling back to Claude Haiku 3 if Groq fails to start or errors.

**Architecture:** App-level fallback in `handleStartCall` — try Groq first, catch any error, log it, then retry with Anthropic Haiku. Vapi's native `fallbackModels` is OpenAI/Azure-only and does not support cross-provider fallback, so this is handled in code. Shared overrides (`voice`, `firstMessage`, `stopSpeakingPlan`) are extracted once and reused across both attempts to avoid duplication.

**Tech Stack:** Next.js 14, `@vapi-ai/web`, TypeScript. No new dependencies required.

---

### Task 1: Refactor `handleStartCall` to use Groq with Haiku fallback

**Files:**
- Modify: `web/app/training/page.tsx` — `handleStartCall` function (~lines 260–296)

No automated test infrastructure exists in this project. Manual verification steps are included below.

- [ ] **Step 1: Open the file and locate `handleStartCall`**

  The function currently starts a call at `web/app/training/page.tsx` around line 260. The `model` block to replace is:

  ```ts
  model: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    messages: [{ role: 'system', content: systemPrompt }],
  },
  ```

- [ ] **Step 2: Replace `handleStartCall` with the new implementation**

  Replace the entire `handleStartCall` function (from `const handleStartCall = async () => {` to its closing `};`) with:

  ```ts
  const handleStartCall = async () => {
    if (!vapiRef.current || !selectedPersona) return;
    try {
      setPhase('calling');
      setCallStatus('connecting');
      setMessages([]);
      messagesRef.current = [];
      vapiCallIdRef.current = null;
      setSaveStatus('idle');

      const voiceId = pickVoice(selectedPersona);
      const systemPrompt = DIFFICULTY_MODIFIERS[difficultyRef.current] + selectedPersona.systemPrompt;

      const sharedOverrides = {
        voice: { provider: 'vapi', voiceId },
        firstMessage: selectedPersona.firstMessage,
        stopSpeakingPlan: {
          numWords: 0,
          voiceSeconds: 0.1,
          backoffSeconds: 0.5,
        },
      };

      const groqModel = {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemPrompt }],
      };

      const haikuModel = {
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'system', content: systemPrompt }],
      };

      let callInfo: any;
      try {
        callInfo = await vapiRef.current.start(VAPI_ASSISTANT_ID, {
          model: groqModel,
          ...sharedOverrides,
        } as any);
      } catch (groqError) {
        console.warn('[Groq fallback] Groq failed to start, falling back to Claude Haiku 3:', groqError);
        callInfo = await vapiRef.current.start(VAPI_ASSISTANT_ID, {
          model: haikuModel,
          ...sharedOverrides,
        } as any);
      }

      if (callInfo?.id) {
        vapiCallIdRef.current = callInfo.id;
      }
    } catch (error) {
      console.error('Error starting call:', error);
      alert('Failed to start call. Please check the console.');
      setCallStatus('idle');
      setPhase('persona-preview');
    }
  };
  ```

- [ ] **Step 3: Verify the file compiles**

  ```bash
  cd web && npm run build 2>&1 | tail -20
  ```

  Expected: build succeeds with no TypeScript errors related to `handleStartCall`. (Unrelated pre-existing warnings are okay.)

- [ ] **Step 4: Manual smoke test — Groq happy path**

  1. Start the dev server: `cd web && npm run dev`
  2. Open `http://localhost:3000/training`
  3. Select any scenario and persona, click **Start Training Call**
  4. Open browser DevTools → Console
  5. Confirm the call connects (green "Live" indicator appears)
  6. Confirm there is **no** `[Groq fallback]` log line — Groq handled it directly
  7. End the call; confirm session is saved and assessment runs

- [ ] **Step 5: Manual smoke test — fallback path (optional, requires Groq to be unreachable)**

  To force the fallback, temporarily change `groqModel.model` to `'invalid-model-name'` in your local copy, start a call, and confirm:
  - Console shows `[Groq fallback] Groq failed to start, falling back to Claude Haiku 3: ...`
  - Call still connects using Haiku
  - Revert the temporary change after confirming

- [ ] **Step 6: Lint check**

  ```bash
  cd web && npm run lint 2>&1 | tail -20
  ```

  Expected: no new lint errors.

- [ ] **Step 7: Commit**

  ```bash
  git add web/app/training/page.tsx
  git commit -m "feat: switch in-call LLM to Groq Llama 3.3 70B with Claude Haiku 3 fallback"
  ```
