// computeMastery is pure; stub the supabase client so importing mastery.ts
// doesn't require native AsyncStorage or env vars under Jest
jest.mock('../lib/supabase', () => ({ supabase: {} }));

import { computeMastery } from '../lib/mastery';

const s = (scenarioType: string, score: number) => ({ scenarioType, score });

describe('computeMastery', () => {
  it('returns empty map and zero counts for no sessions', () => {
    const m = computeMastery([]);
    expect(m.byScenario).toEqual({});
    expect(m.counts).toEqual({ gold: 0, silver: 0, bronze: 0 });
  });

  it('one session ≥70 earns bronze with 0/2 toward silver', () => {
    const m = computeMastery([s('price_objection', 72)]);
    expect(m.byScenario.price_objection).toEqual({
      tier: 'bronze',
      nextTier: 'silver',
      progress: { have: 0, need: 2 },
    });
    expect(m.counts).toEqual({ gold: 0, silver: 0, bronze: 1 });
  });

  it('two sessions ≥80 earn silver with progress toward gold', () => {
    const m = computeMastery([s('a', 81), s('a', 83)]);
    expect(m.byScenario.a.tier).toBe('silver');
    expect(m.byScenario.a.nextTier).toBe('gold');
    expect(m.byScenario.a.progress).toEqual({ have: 0, need: 3 });
  });

  it('three sessions ≥85 earn gold with no next tier', () => {
    const m = computeMastery([s('a', 85), s('a', 90), s('a', 99)]);
    expect(m.byScenario.a).toEqual({ tier: 'gold', nextTier: null, progress: null });
    expect(m.counts.gold).toBe(1);
  });

  it('a single high score counts toward every tier at once', () => {
    const m = computeMastery([s('a', 90)]);
    expect(m.byScenario.a.tier).toBe('bronze');       // 1× ≥70 ✓
    expect(m.byScenario.a.nextTier).toBe('silver');
    expect(m.byScenario.a.progress).toEqual({ have: 1, need: 2 }); // the 90 counts toward silver
  });

  it('sessions below 70 earn nothing', () => {
    const m = computeMastery([s('a', 65), s('a', 50)]);
    expect(m.byScenario.a).toEqual({
      tier: null,
      nextTier: 'bronze',
      progress: { have: 0, need: 1 },
    });
    expect(m.counts).toEqual({ gold: 0, silver: 0, bronze: 0 });
  });

  it('tracks scenario types independently and aggregates counts', () => {
    const m = computeMastery([
      s('a', 90), s('a', 88), s('a', 86),   // gold
      s('b', 82), s('b', 84),               // silver
      s('c', 75),                           // bronze
      s('d', 60),                           // nothing
    ]);
    expect(m.byScenario.a.tier).toBe('gold');
    expect(m.byScenario.b.tier).toBe('silver');
    expect(m.byScenario.c.tier).toBe('bronze');
    expect(m.byScenario.d.tier).toBeNull();
    expect(m.counts).toEqual({ gold: 1, silver: 1, bronze: 1 });
  });

  it('mixed scores accumulate correctly (silver needs two ≥80, not two ≥70)', () => {
    const m = computeMastery([s('a', 79), s('a', 81)]);
    expect(m.byScenario.a.tier).toBe('bronze');
    expect(m.byScenario.a.progress).toEqual({ have: 1, need: 2 });
  });
});
