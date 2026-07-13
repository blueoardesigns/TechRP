// computeXP/xpForSession are pure; stub the supabase client so importing xp.ts
// doesn't require native AsyncStorage or env vars under Jest
jest.mock('../lib/supabase', () => ({ supabase: {} }));

import { xpForSession, computeXP, rankForLevel } from '../lib/xp';

describe('xpForSession', () => {
  it('gives 30 + score for graded sessions', () => {
    expect(xpForSession(85)).toBe(115);
    expect(xpForSession(70)).toBe(100);
  });

  it('gives the 30-point completion floor for ungraded sessions', () => {
    expect(xpForSession(null)).toBe(30);
    expect(xpForSession(0)).toBe(30);
  });

  it('caps at 130 for a perfect score', () => {
    expect(xpForSession(100)).toBe(130);
  });
});

describe('computeXP', () => {
  it('starts at level 1 Rookie with 0/100 progress', () => {
    expect(computeXP([])).toEqual({
      totalXP: 0,
      level: 1,
      rank: 'Rookie',
      levelProgress: { have: 0, need: 100 },
    });
  });

  it('accumulates XP across graded and ungraded sessions', () => {
    // 115 + 30 + 100 = 245
    const p = computeXP([85, null, 70]);
    expect(p.totalXP).toBe(245);
  });

  it('hits level thresholds exactly (level n needs 50·n·(n−1) total XP)', () => {
    expect(computeXP([70]).level).toBe(2);        // 100 XP = exactly level 2
    expect(computeXP([69]).level).toBe(1);        // 99 XP
    // level 3 at 300: 100+100+100
    expect(computeXP([70, 70, 70]).level).toBe(3);
    // 299 XP stays level 2
    expect(computeXP([70, 70, 69]).level).toBe(2);
  });

  it('reports progress within the current level', () => {
    // 245 XP: level 2 starts at 100, needs 200 more for level 3
    const p = computeXP([85, null, 70]);
    expect(p.level).toBe(2);
    expect(p.levelProgress).toEqual({ have: 145, need: 200 });
  });

  it('assigns rank bands at their edges', () => {
    expect(rankForLevel(1)).toBe('Rookie');
    expect(rankForLevel(2)).toBe('Rookie');
    expect(rankForLevel(3)).toBe('Apprentice');
    expect(rankForLevel(5)).toBe('Apprentice');
    expect(rankForLevel(6)).toBe('Journeyman');
    expect(rankForLevel(9)).toBe('Journeyman');
    expect(rankForLevel(10)).toBe('Pro');
    expect(rankForLevel(14)).toBe('Pro');
    expect(rankForLevel(15)).toBe('Closer');
    expect(rankForLevel(19)).toBe('Closer');
    expect(rankForLevel(20)).toBe('Rainmaker');
    expect(rankForLevel(35)).toBe('Rainmaker');
  });

  it('wires rank into the computed profile', () => {
    // three sessions ≥70 → exactly 300 XP → level 3 → Apprentice
    expect(computeXP([70, 70, 70]).rank).toBe('Apprentice');
  });
});
