# Gamification Phase A — Assessment Reveal + Practice Streaks

**Date:** 2026-07-10
**Scope:** Mobile app only (`mobile/`). No web changes, no schema changes.
**Approved phases:** A = reveal + streaks (this spec) · B = scenario mastery medals · C = XP/levels (future specs).

## Goal

Make each training session emotionally rewarding at its peak moment (the score reveal) and give users a daily-habit reason to return (streaks). Both features derive entirely from existing `training_sessions` data.

## New Dependencies

| Package | Why | Native? |
|---|---|---|
| `expo-haptics` | Impact/success haptics during reveal | Yes — autolinks via existing prebuild/fastlane flow; requires new TestFlight build |
| `react-native-confetti-cannon` | Confetti burst on A grade / personal best | No — pure JS on core `Animated` |

Count-up and stamp animations use React Native's built-in `Animated` API. No Reanimated.

## Feature 1: Score Reveal

**Where:** `mobile/app/(tabs)/train/assessment.tsx`, done-state hero card only. Loading/grading/error/skipped states are untouched.

**New component:** `mobile/components/ScoreReveal.tsx`
Props: `score: number`, `letter: LetterGrade`, `stats: SessionStats | null` (prior-session stats, null while loading or when unavailable).

Behavior on mount:
1. Score number animates 0 → `score` over ~1.2s (ease-out), driven by an `Animated.Value` listener updating text state. Light impact haptic every ~15 points of progress.
2. When count-up completes, the letter grade stamps in: scale 1.6 → 1.0 with opacity 0 → 1 (spring), plus `notificationAsync(Success)` haptic.
3. Confetti (one `ConfettiCannon` burst, ~150 pieces, origin top-center) fires at stamp time if `letter === 'A'` OR the score is a strict new personal best (`score > stats.previousBest`, requires ≥1 prior graded session).
4. Comparison line fades in under the score:
   - New personal best (≥1 prior session): "🏆 New personal best!"
   - Otherwise with ≥1 prior session: "+N vs your average" / "−N vs your average" / "Right at your average" (N = `score − round(stats.average)`)
   - First-ever graded session: "First session on the board!"
5. Streak line (see Feature 2) fades in below the comparison line.

**Prior-session stats:** fetched in `assessment.tsx` alongside the existing session load — query `training_sessions` for the user's sessions (same `.or(user_id.eq.authId,user_id.eq.profileId)` pattern used in `sessions/index.tsx`), excluding the current session, parse `assessment` jsonb (object or string, same normalization as sessions list), and compute `{ previousBest, average, count }` from sessions with a valid score via `getDisplayScore`. Stats failure is non-critical: reveal still runs, comparison line is simply omitted.

**Reduced motion:** if `AccessibilityInfo.isReduceMotionEnabled()`, skip count-up/confetti and render final values immediately.

## Feature 2: Practice Streaks

**New module:** `mobile/lib/streaks.ts` — pure logic, unit-tested.

```ts
interface StreakInfo {
  current: number;          // consecutive days incl. today or ending yesterday
  practicedToday: boolean;
  week: boolean[];          // last 7 days, oldest first, true = practiced
}
computeStreak(sessionDates: Date[], now?: Date): StreakInfo
```

Rules:
- A "practiced day" = ≥1 saved session that calendar day, in device-local time. Graded or not — any row in `training_sessions` counts.
- Streak counts consecutive practiced days ending today, or ending yesterday (streak is "alive" until midnight of the first missed day). If neither today nor yesterday was practiced, `current = 0`.
- No freezes/grace tokens in v1.

**Data:** fetch `created_at` for the user's sessions (last 60 days is plenty) using the same user-id matching pattern. New helper `fetchStreak(profileId)` in `streaks.ts` wraps query + compute.

**UI — Train tab header (`train/index.tsx`):** a streak card between the title and the scenario list:
- Flame + count: "🔥 4-day streak" (or "Start your streak" when 0, "🔥 1-day streak" etc.)
- 7-day dot strip, oldest → today, filled dot = practiced, today's dot ring-highlighted.
- Subline: "Practice today to keep your streak" when streak alive but not practiced today; "You've practiced today ✓" when done; "Complete a session to start a streak" when 0.
- Card refreshes on screen focus (`useFocusEffect`) so it updates after a session.

**UI — Assessment screen:** after the reveal, a streak line computed from post-session data (this session counts): "🔥 Day N — streak extended!" (N ≥ 2), "🔥 Day 1 — streak started!" (N = 1). Computed client-side by refetching streak after the session is saved; failure is non-critical (line omitted).

## Error Handling

Every new fetch (stats, streak) is best-effort: failures log to console and degrade to omitting the affected line/card. The grading flow's existing error paths are not modified.

## Testing

- `__tests__/streaks.test.ts` — unit tests for `computeStreak`: empty history, single session today, consecutive run, gap breaks streak, yesterday-anchored streak still alive, streak dead after 2-day gap, week strip correctness, month/DST boundaries via local-date math.
- `__tests__/ScoreReveal.test.tsx` — renders final score/letter, correct comparison line for best/above/below/first-session cases (animations mocked/fast-forwarded via jest fake timers).
- Existing tests must keep passing; `npx tsc --noEmit` clean.

## Out of Scope

Mastery medals (Phase B), XP/levels (Phase C), leaderboards, streak push notifications, server-side streak storage.
