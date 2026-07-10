import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { fetchStreak, StreakInfo } from '../lib/streaks';
import { colors, radius, spacing } from '../lib/theme';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function headline(streak: StreakInfo): string {
  if (streak.current === 0) return 'Start your streak';
  return `🔥 ${streak.current}-day streak`;
}

function subline(streak: StreakInfo): string {
  if (streak.current === 0) return 'Complete a session to start a streak';
  if (streak.practicedToday) return "You've practiced today ✓";
  return 'Practice today to keep your streak';
}

export default function StreakCard() {
  const { profile } = useAuth();
  const [streak, setStreak] = useState<StreakInfo | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let cancelled = false;
      fetchStreak(profile.id).then(info => {
        if (!cancelled && info) setStreak(info);
      });
      return () => { cancelled = true; };
    }, [profile]),
  );

  // Best-effort: render nothing until we have data (no loading flicker)
  if (!streak) return null;

  const today = new Date();
  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - i));
    return DAY_LETTERS[d.getDay()];
  });

  return (
    <View style={styles.card}>
      <View style={styles.textCol}>
        <Text style={styles.headline}>{headline(streak)}</Text>
        <Text style={styles.subline}>{subline(streak)}</Text>
      </View>
      <View style={styles.weekRow}>
        {streak.week.map((practiced, i) => {
          const isToday = i === 6;
          return (
            <View key={i} style={styles.dayCol}>
              <View
                style={[
                  styles.dot,
                  practiced && styles.dotFilled,
                  isToday && styles.dotToday,
                ]}
              />
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {dayLabels[i]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  textCol: { flex: 1, gap: 3 },
  headline: { color: colors.text, fontSize: 16, fontWeight: '700' },
  subline: { color: colors.textMuted, fontSize: 12 },
  weekRow: { flexDirection: 'row', gap: 6 },
  dayCol: { alignItems: 'center', gap: 4 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  dotFilled: {
    backgroundColor: '#FF9500',
    borderColor: '#FF9500',
  },
  dotToday: {
    borderColor: colors.accentLight,
    borderWidth: 1.5,
  },
  dayLabel: { color: colors.textDim, fontSize: 9, fontWeight: '600' },
  dayLabelToday: { color: colors.accentLight },
});
