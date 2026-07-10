import { supabase } from './supabase';
import { getDisplayScore } from './scoring';

export type MedalTier = 'gold' | 'silver' | 'bronze';

export interface ScoredSession {
  scenarioType: string;
  score: number;
}

export interface ScenarioMastery {
  tier: MedalTier | null;
  nextTier: MedalTier | null;
  /** Qualifying sessions toward nextTier; null when gold */
  progress: { have: number; need: number } | null;
}

export interface MasteryMap {
  byScenario: Record<string, ScenarioMastery>;
  counts: { gold: number; silver: number; bronze: number };
}

export const MEDAL_EMOJI: Record<MedalTier, string> = {
  gold: '🥇',
  silver: '🥈',
  bronze: '🥉',
};

// Cumulative requirements, lowest → highest. A single session counts toward
// every tier whose score bar it clears.
const TIERS: { tier: MedalTier; minScore: number; need: number }[] = [
  { tier: 'bronze', minScore: 70, need: 1 },
  { tier: 'silver', minScore: 80, need: 2 },
  { tier: 'gold', minScore: 85, need: 3 },
];

export function computeMastery(sessions: ScoredSession[]): MasteryMap {
  const byType = new Map<string, number[]>();
  for (const s of sessions) {
    const list = byType.get(s.scenarioType) ?? [];
    list.push(s.score);
    byType.set(s.scenarioType, list);
  }

  const byScenario: Record<string, ScenarioMastery> = {};
  const counts = { gold: 0, silver: 0, bronze: 0 };

  for (const [type, scores] of byType) {
    let earnedIdx = -1;
    for (let i = 0; i < TIERS.length; i++) {
      const qualifying = scores.filter(sc => sc >= TIERS[i].minScore).length;
      if (qualifying >= TIERS[i].need) earnedIdx = i;
    }

    const tier = earnedIdx >= 0 ? TIERS[earnedIdx].tier : null;
    const next = earnedIdx < TIERS.length - 1 ? TIERS[earnedIdx + 1] : null;

    byScenario[type] = {
      tier,
      nextTier: next?.tier ?? null,
      progress: next
        ? { have: scores.filter(sc => sc >= next.minScore).length, need: next.need }
        : null,
    };
    if (tier) counts[tier] += 1;
  }

  return { byScenario, counts };
}

/**
 * Fetch the user's graded sessions and compute per-scenario mastery.
 * Same dual-user-id matching and best-effort policy as streaks.
 */
export async function fetchMastery(profileId: string): Promise<MasteryMap | null> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const authUserId = authUser?.id;
    if (!authUserId) return null;

    const { data, error } = await supabase
      .from('training_sessions')
      .select('persona_scenario_type, assessment')
      .or(`user_id.eq.${authUserId},user_id.eq.${profileId}`);

    if (error) {
      console.error('[mastery] query error:', JSON.stringify(error));
      return null;
    }
    return computeMastery(rowsToScoredSessions(data ?? []));
  } catch (e) {
    console.error('[mastery] fetch exception:', e);
    return null;
  }
}

/** Normalize DB rows (assessment jsonb may be object or string) to graded sessions. */
export function rowsToScoredSessions(
  rows: { persona_scenario_type: string | null; assessment: unknown }[],
): ScoredSession[] {
  const out: ScoredSession[] = [];
  for (const row of rows) {
    if (!row.persona_scenario_type) continue;
    const raw = row.assessment;
    const parsed = raw
      ? (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw)
      : null;
    if (!parsed) continue;
    const { score } = getDisplayScore(parsed as { score?: number });
    if (score > 0) out.push({ scenarioType: row.persona_scenario_type, score });
  }
  return out;
}
