# Design: In-Call LLM — Groq Llama 3.3 70B with Claude Haiku 3 Fallback

**Date:** 2026-04-07  
**Status:** Approved

## Summary

Switch the Vapi in-call LLM from Claude Sonnet to Groq Llama 3.3 70B, with automatic fallback to Claude Haiku 3 if Groq is unavailable or errors. Post-call assessment (Claude Sonnet in `/api/assess`) is unchanged.

## Scope

Single file: `web/app/training/page.tsx`, `handleStartCall` function (lines ~260–296).

## Approach

App-level fallback — chosen because Vapi's native `fallbackModels` field is OpenAI/Azure-region-only and does not support cross-provider fallback (Groq → Anthropic).

## Design

### Model Config

| Role     | Provider    | Model                      |
|----------|-------------|----------------------------|
| Primary  | `groq`      | `llama-3.3-70b-versatile`  |
| Fallback | `anthropic` | `claude-3-haiku-20240307`  |

### Call Flow

1. Build shared overrides: `voice`, `firstMessage`, `stopSpeakingPlan` (unchanged).
2. Attempt `vapiRef.current.start(VAPI_ASSISTANT_ID, { model: groqModel, ...sharedOverrides })`.
3. If step 2 throws:
   - Log the Groq error with a clear prefix (e.g. `[Groq fallback]`).
   - Retry `vapiRef.current.start(VAPI_ASSISTANT_ID, { model: haikuModel, ...sharedOverrides })`.
4. If step 3 also throws, the existing outer `catch` handles it (alert + reset to `persona-preview` phase).

### What Does Not Change

- `stopSpeakingPlan`, `voice`, and `firstMessage` overrides are identical across both attempts.
- `/api/assess` continues to use `claude-sonnet-4-20250514`.
- All other API routes are untouched.

## Error Handling

- Groq failure is logged but not surfaced to the user — they see the call connect on Haiku instead.
- If both fail, existing alert + phase reset behavior applies (no change needed).
