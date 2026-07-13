# Gamification Phase C — XP, Levels & Rank Titles

**Date:** 2026-07-13
**Scope:** Mobile app only (`mobile/`). No web changes, no schema changes, **no new dependencies**.
**Depends on:** Phase A (reveal + streaks) and Phase B (mastery medals), shipped in TestFlight build 35.

## Goal

Give users a cumulative progress track that never goes down. Scores fluctuate and medals cap out; XP only rises, so every session — even a rough one — moves the bar. Rank titles give level numbers a trade-flavored identity worth chasing.

## XP Rules

Per session, computed from all-time `training_sessions` history (client-side, like streaks and mastery):

| Session | XP earned |
|---|---|
| Graded (score > 0) | `30 + score` (max 130) |
| Saved but ungraded | `30` |

The 30-point completion floor means showing up always pays — a failed grading or a rough call still advances the bar. Score via `getDisplayScore`, same normalization as Phases A/B.

## Levels & Ranks

- XP to advance *from* level *n* to *n+1* = `100 × n`. Cumulative XP for level *n* = `50 × n × (n−1)` (level 1 = 0 XP, level 2 = 100, level 3 = 300, level 4 = 600, level 5 = 1000, …).
- Pacing: level 2 after ~1 session, level 3 after ~3, level 5 after ~9, level 10 after ~40. No level cap.
- Rank titles by level band:

| Levels | Rank |
|---|---|
| 1–2 | Rookie |
| 3–5 | Apprentice |
| 6–9 | Journeyman |
| 10–14 | Pro |
| 15–19 | Closer |
| 20+ | Rainmaker |

## New Module: `mobile/lib/xp.ts` (pure logic, unit-tested)

```ts
export interface XPProfile {
  totalXP: number;
  level: number;
  rank: string;
  /** XP into the current level vs XP needed to reach the next */
  levelProgress: { have: number; need: number };
}

xpForSession(score: number | null): number      // 30 + score, or 30 when null/0
computeXP(sessionScores: (number | null)[]): XPProfile
fetchXP(profileId): Promise<XPProfile | null>   // same dual-user-id .or() query + best-effort policy
```

The fetch reuses the `training_sessions` select (`assessment` only) and jsonb normalization already established; ungraded rows map to `null`.

## UI

### 1. Profile screen (`profile/index.tsx`)

- Under the avatar/name block: **"Level 7 · Journeyman"** line styled like the existing role badge (a second pill next to it).
- New **Progress card** above the Subscription card: XP progress bar (pure `View`s — no SVG dependency; a ring can come later if we ever add `react-native-svg`), "1,240 XP" total, and "260 XP to Level 8".
- Loads via `fetchXP` on mount, best-effort: card hidden if fetch fails.

### 2. Assessment reveal (`ScoreReveal` + `assessment.tsx`)

- New detail line (with the comparison/streak/medal lines in the existing fade-in): **"+115 XP"** — computed as `xpForSession(score)`, purely presentational.
- Level-up detection mirrors the medal before/after pattern: compute `computeXP(prior)` vs `computeXP([...prior, current])` from the `priorScored`-style data already fetched — but XP needs *all* sessions (including ungraded), so the assessment screen's prior-session fetch keeps its current shape and additionally maps every row (graded or not) to a score-or-null list.
- If level increased: **"⬆️ Level 8 — Journeyman!"** line + success haptic. If the *rank* also changed (band crossed), the line becomes **"⬆️ Rank up! Level 10 — Pro"** and fires the confetti cannon (added to the existing A / personal-best / gold-unlock triggers).
- At most one level line (rank-up wording wins). Reduce Motion behavior inherited from the existing detail block.

### 3. Train tab

Nothing — the header already carries streak + mastery; XP lives on Profile and the reveal.

## Error Handling

Identical best-effort policy to Phases A/B: any XP fetch/computation failure means the line/card is absent. Grading flow untouched.

## Testing

- `__tests__/xp.test.ts`:
  - `xpForSession`: graded (30+score), ungraded floor, score 100 → 130
  - `computeXP`: 0 sessions → level 1 Rookie, 0/100 progress
  - level thresholds exact at boundaries (100 → level 2, 299 → level 2, 300 → level 3)
  - rank bands at edges (level 2 Rookie, 3 Apprentice, 9 Journeyman, 10 Pro, 20 Rainmaker)
  - mixed graded/ungraded accumulation
- `__tests__/ScoreReveal.test.tsx` — extend: +XP line renders; level-up line renders; rank-up wording wins over plain level-up; absent when XP data unavailable.
- Existing suites keep passing; `npx tsc --noEmit` clean.

## Out of Scope

Server-side XP storage, XP on the web dashboard, leaderboards (would be Phase D/social), XP for non-session actions (playbook reading etc.), avatar level ring (needs react-native-svg).
