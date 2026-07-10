import { supabase } from './supabase';

export interface StreakInfo {
  /** Consecutive practiced days, anchored to today or yesterday. 0 = no live streak. */
  current: number;
  practicedToday: boolean;
  /** Last 7 days, oldest first (index 6 = today). true = practiced. */
  week: boolean[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local-midnight epoch for a date — normalizes away time-of-day and DST drift. */
function localDayKey(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function computeStreak(sessionDates: Date[], now: Date = new Date()): StreakInfo {
  const practiced = new Set(sessionDates.map(localDayKey));
  const today = localDayKey(now);
  const dayBefore = (key: number) => localDayKey(new Date(key - DAY_MS / 2)); // half-day step is DST-safe

  const practicedToday = practiced.has(today);

  // Anchor at today if practiced, else yesterday (streak stays alive until a full day is missed)
  let current = 0;
  let cursor = practicedToday ? today : dayBefore(today);
  while (practiced.has(cursor)) {
    current += 1;
    cursor = dayBefore(cursor);
  }

  const week: boolean[] = [];
  let key = today;
  for (let i = 0; i < 7; i++) {
    week.unshift(practiced.has(key));
    key = dayBefore(key);
  }

  return { current, practicedToday, week };
}

/**
 * Fetch the user's recent session dates and compute their streak.
 * Matches sessions saved under either the auth user id (new builds) or the
 * public users.id (old builds) — same pattern as the sessions list screen.
 * Returns null on any failure; streak UI is best-effort.
 */
export async function fetchStreak(profileId: string): Promise<StreakInfo | null> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const authUserId = authUser?.id;
    if (!authUserId) return null;

    const since = new Date(Date.now() - 60 * DAY_MS).toISOString();
    const { data, error } = await supabase
      .from('training_sessions')
      .select('created_at')
      .or(`user_id.eq.${authUserId},user_id.eq.${profileId}`)
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[streaks] query error:', JSON.stringify(error));
      return null;
    }
    return computeStreak((data ?? []).map(r => new Date(r.created_at)));
  } catch (e) {
    console.error('[streaks] fetch exception:', e);
    return null;
  }
}
