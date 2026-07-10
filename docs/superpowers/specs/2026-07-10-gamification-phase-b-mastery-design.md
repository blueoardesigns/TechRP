# Gamification Phase B — Scenario Mastery Medals

**Date:** 2026-07-10
**Scope:** Mobile app only (`mobile/`). No web changes, no schema changes, no new dependencies.
**Depends on:** Phase A (score reveal + streaks), shipped 2026-07-10.

## Goal

Turn the scenario picker from a menu into a map to conquer. Each scenario type earns a bronze/silver/gold medal based on repeated quality performance, steering users toward scenarios they've been avoiding and giving them a collection to complete.

## Medal Rules

A medal tier is earned per `scenario_type` from the user's graded sessions (score via `getDisplayScore`, sessions with score > 0 only):

| Tier | Requirement |
|---|---|
| 🥉 Bronze | 1 session scoring ≥ 70 |
| 🥈 Silver | 2 sessions scoring ≥ 80 |
| 🥇 Gold | 3 sessions scoring ≥ 85 |

- Requirements are cumulative counts, not consecutive: a session scoring 87 counts toward all three tiers at once.
- Medals never downgrade — they're derived from all-time history, so the computed tier only rises.
- Highest earned tier is displayed. Progress toward the *next* tier = qualifying-session count for that tier (e.g. "2/3 to gold").

## New Module: `mobile/lib/mastery.ts` (pure logic, unit-tested)

```ts
export type MedalTier = 'gold' | 'silver' | 'bronze' | null;

export interface ScenarioMastery {
  tier: MedalTier;
  /** Next tier up, or null when gold */
  nextTier: Exclude<MedalTier, null> | null;
  /** Qualifying sessions toward nextTier, e.g. { have: 2, need: 3 } */
  progress: { have: number; need: number } | null;
}

export interface MasteryMap {
  byScenario: Record<string, ScenarioMastery>;
  counts: { gold: number; silver: number; bronze: number };
}

// sessions: { scenarioType: string; score: number }[] — graded sessions only
computeMastery(sessions: ScoredSession[]): MasteryMap
```

`fetchMastery(profileId)` wraps the query: `training_sessions` select `persona_scenario_type, assessment` using the same dual-user-id `.or()` pattern as streaks/sessions list, normalizes jsonb (object or string), filters to score > 0. Returns `MasteryMap | null`; failures are best-effort (log + null), same policy as Phase A.

## UI

### 1. Scenario picker rows (`train/index.tsx`)

- Fetch mastery on screen focus (`useFocusEffect`), same lifecycle as StreakCard's fetch.
- Each row shows its medal between the text and the chevron: 🥉/🥈/🥇 (emoji, matching the app's existing emoji icon style).
- Rows with no medal but partial progress show nothing extra — the picker stays clean; progress lives in the pre-call and assessment surfaces.
- While mastery is loading or unavailable, rows render exactly as today (no layout shift: medal slot is width-reserved only when data exists).

### 2. Mastery summary chip (Train tab header)

Under the StreakCard, a single compact line — only rendered once the user has ≥1 medal:

> 🥇 2 · 🥈 3 · 🥉 5 — 10 of 14 scenarios medaled

(counts from `MasteryMap.counts`; denominator = number of scenario types in `getSectionedScenarios()`).

### 3. Medal moment on the assessment screen (`assessment.tsx` + `ScoreReveal`)

The assessment screen already fetches prior sessions for stats. Extend that flow:

- Compute mastery for this session's `scenario_type` twice: excluding the current session ("before") and including it ("after").
- If the tier increased, pass `medalUnlocked: 'bronze' | 'silver' | 'gold'` to `ScoreReveal`, which renders an unlock line in the detail fade-in (below the streak line):
  - "🥇 Gold medal — Price Objections mastered!" (scenario label from `getScenarioConfig`)
  - Gold unlock also fires the confetti cannon (in addition to the existing A / personal-best triggers).
- If no tier change but the session progressed toward the next tier (qualifying count increased), show a progress line instead: "🥈 2/3 toward silver — Price Objections". At most one medal line is shown (unlock wins over progress).
- Haptic: `notificationAsync(Success)` on medal unlock (reuses the pattern already in ScoreReveal; skipped under Reduce Motion along with the rest).

## Error Handling

Identical policy to Phase A: every mastery fetch/computation is best-effort. Failure means the medal column, summary chip, or unlock line is simply absent. Grading flow untouched.

## Testing

- `__tests__/mastery.test.ts` — unit tests for `computeMastery`:
  - no sessions → null tier, no counts
  - one 72 → bronze, progress 0/2 toward silver
  - two ≥80 → silver; three ≥85 → gold, nextTier null
  - a single 90 counts toward all tiers simultaneously (bronze earned, 1/2 silver, 1/3 gold)
  - sub-70 sessions earn nothing but don't break anything
  - multiple scenario types tracked independently; counts aggregate correctly
- `__tests__/ScoreReveal.test.tsx` — extend: medal unlock line renders; progress line renders; unlock beats progress; absent when no medal data.
- Existing suites keep passing; `npx tsc --noEmit` clean.

## Out of Scope

XP/levels (Phase C), medal push notifications, web dashboard medal display, per-persona (as opposed to per-scenario) mastery, server-side medal storage.
