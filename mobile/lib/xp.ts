import { supabase } from './supabase';
import { getDisplayScore } from './scoring';

export interface XPProfile {
  totalXP: number;
  level: number;
  rank: string;
  /** XP earned within the current level vs XP needed to reach the next */
  levelProgress: { have: number; need: number };
}

// XP: 30-point completion floor so every session moves the bar, plus the score
const COMPLETION_XP = 30;

const RANK_BANDS: { minLevel: number; rank: string }[] = [
  { minLevel: 20, rank: 'Rainmaker' },
  { minLevel: 15, rank: 'Closer' },
  { minLevel: 10, rank: 'Pro' },
  { minLevel: 6, rank: 'Journeyman' },
  { minLevel: 3, rank: 'Apprentice' },
  { minLevel: 1, rank: 'Rookie' },
];

export function rankForLevel(level: number): string {
  return RANK_BANDS.find(b => level >= b.minLevel)!.rank;
}

export function xpForSession(score: number | null): number {
  return COMPLETION_XP + (score && score > 0 ? score : 0);
}

/** Cumulative XP required to be at `level`: 50·n·(n−1). Advancing from n costs 100·n. */
function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function computeXP(sessionScores: (number | null)[]): XPProfile {
  const totalXP = sessionScores.reduce<number>((sum, s) => sum + xpForSession(s), 0);

  let level = 1;
  while (xpForLevel(level + 1) <= totalXP) level += 1;

  return {
    totalXP,
    level,
    rank: rankForLevel(level),
    levelProgress: {
      have: totalXP - xpForLevel(level),
      need: xpForLevel(level + 1) - xpForLevel(level),
    },
  };
}

/** Normalize DB rows to a score-or-null list (ungraded sessions → null). */
export function rowsToXPScores(rows: { assessment: unknown }[]): (number | null)[] {
  return rows.map(row => {
    const raw = row.assessment;
    const parsed = raw
      ? (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw)
      : null;
    if (!parsed) return null;
    const { score } = getDisplayScore(parsed as { score?: number });
    return score > 0 ? score : null;
  });
}

/**
 * Fetch the user's sessions and compute their XP profile.
 * Same dual-user-id matching and best-effort policy as streaks/mastery.
 */
export async function fetchXP(profileId: string): Promise<XPProfile | null> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const authUserId = authUser?.id;
    if (!authUserId) return null;

    const { data, error } = await supabase
      .from('training_sessions')
      .select('assessment')
      .or(`user_id.eq.${authUserId},user_id.eq.${profileId}`);

    if (error) {
      console.error('[xp] query error:', JSON.stringify(error));
      return null;
    }
    return computeXP(rowsToXPScores(data ?? []));
  } catch (e) {
    console.error('[xp] fetch exception:', e);
    return null;
  }
}
