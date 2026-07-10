// computeStreak is pure; stub the supabase client so importing streaks.ts
// doesn't require native AsyncStorage or env vars under Jest
jest.mock('../lib/supabase', () => ({ supabase: {} }));

import { computeStreak } from '../lib/streaks';

// Helper: build a local Date at noon (avoids DST edge weirdness in fixtures)
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);

const NOW = day(2026, 7, 10); // Fri Jul 10 2026, local noon

describe('computeStreak', () => {
  it('returns zero streak for empty history', () => {
    const s = computeStreak([], NOW);
    expect(s.current).toBe(0);
    expect(s.practicedToday).toBe(false);
    expect(s.week).toEqual([false, false, false, false, false, false, false]);
  });

  it('counts a single session today as a 1-day streak', () => {
    const s = computeStreak([day(2026, 7, 10)], NOW);
    expect(s.current).toBe(1);
    expect(s.practicedToday).toBe(true);
    expect(s.week[6]).toBe(true); // today is the last slot
  });

  it('counts consecutive days ending today', () => {
    const s = computeStreak([day(2026, 7, 8), day(2026, 7, 9), day(2026, 7, 10)], NOW);
    expect(s.current).toBe(3);
    expect(s.practicedToday).toBe(true);
  });

  it('keeps a streak alive when it ended yesterday (not yet practiced today)', () => {
    const s = computeStreak([day(2026, 7, 8), day(2026, 7, 9)], NOW);
    expect(s.current).toBe(2);
    expect(s.practicedToday).toBe(false);
  });

  it('kills the streak after a full missed day', () => {
    const s = computeStreak([day(2026, 7, 7), day(2026, 7, 8)], NOW);
    expect(s.current).toBe(0);
    expect(s.practicedToday).toBe(false);
  });

  it('a gap inside history only counts the latest run', () => {
    const s = computeStreak(
      [day(2026, 7, 3), day(2026, 7, 4), day(2026, 7, 9), day(2026, 7, 10)],
      NOW,
    );
    expect(s.current).toBe(2);
  });

  it('multiple sessions on the same day count once', () => {
    const s = computeStreak(
      [day(2026, 7, 10), new Date(2026, 6, 10, 8, 0), new Date(2026, 6, 10, 20, 0)],
      NOW,
    );
    expect(s.current).toBe(1);
  });

  it('handles month boundaries', () => {
    const now = day(2026, 7, 1);
    const s = computeStreak([day(2026, 6, 29), day(2026, 6, 30), day(2026, 7, 1)], now);
    expect(s.current).toBe(3);
  });

  it('builds the week strip oldest-first ending today', () => {
    // practiced Jul 4 (6 days ago) and Jul 9 (yesterday)
    const s = computeStreak([day(2026, 7, 4), day(2026, 7, 9)], NOW);
    expect(s.week).toEqual([true, false, false, false, false, true, false]);
  });

  it('ignores time of day — late-night session still counts for its local date', () => {
    const s = computeStreak([new Date(2026, 6, 9, 23, 59), new Date(2026, 6, 10, 0, 1)], NOW);
    expect(s.current).toBe(2);
  });
});
