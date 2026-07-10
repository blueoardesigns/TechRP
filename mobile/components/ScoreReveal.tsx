import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, AccessibilityInfo, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';
import { colors, radius, spacing } from '../lib/theme';
import { LetterGrade } from '../lib/scoring';
import { MedalTier, MEDAL_EMOJI } from '../lib/mastery';

export interface MedalMoment {
  type: 'unlock' | 'progress';
  /** Unlock: the tier just earned. Progress: the tier being worked toward. */
  tier: MedalTier;
  scenarioLabel: string;
  /** Progress only */
  have?: number;
  need?: number;
}

export interface SessionStats {
  /** Best score across prior graded sessions (excludes this one) */
  previousBest: number;
  /** Average score across prior graded sessions */
  average: number;
  /** Number of prior graded sessions */
  count: number;
}

interface Props {
  score: number;
  letter: LetterGrade;
  /** Prior-session stats; null = unavailable (comparison line omitted) */
  stats: SessionStats | null;
  /** Current streak length including this session; null = unavailable (line omitted) */
  streakDays: number | null;
  /** Medal unlocked or progressed by this session; null = nothing to show */
  medal?: MedalMoment | null;
}

function medalLine(medal: MedalMoment): string {
  const emoji = MEDAL_EMOJI[medal.tier];
  const tierName = medal.tier.charAt(0).toUpperCase() + medal.tier.slice(1);
  if (medal.type === 'unlock') {
    return medal.tier === 'gold'
      ? `${emoji} Gold medal — ${medal.scenarioLabel} mastered!`
      : `${emoji} ${tierName} medal — ${medal.scenarioLabel}!`;
  }
  return `${emoji} ${medal.have}/${medal.need} toward ${medal.tier} — ${medal.scenarioLabel}`;
}

function scoreColor(score: number): string {
  if (score >= 80) return colors.scoreGreen;
  if (score >= 60) return colors.scoreYellow;
  return colors.scoreRed;
}

function comparisonLine(score: number, stats: SessionStats): string {
  if (stats.count === 0) return 'First session on the board!';
  if (score > stats.previousBest) return '🏆 New personal best!';
  const delta = score - Math.round(stats.average);
  if (delta > 0) return `+${delta} vs your average`;
  if (delta < 0) return `${delta} vs your average`;
  return 'Right at your average';
}

const COUNT_UP_MS = 1200;
const HAPTIC_STEP = 15;

export default function ScoreReveal({ score, letter, stats, streakDays, medal = null }: Props) {
  const [displayScore, setDisplayScore] = useState(0);
  const [stamped, setStamped] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [fireConfetti, setFireConfetti] = useState(false);
  const { width } = useWindowDimensions();

  const progress = useRef(new Animated.Value(0)).current;
  const stampScale = useRef(new Animated.Value(1.6)).current;
  const stampOpacity = useRef(new Animated.Value(0)).current;
  const detailOpacity = useRef(new Animated.Value(0)).current;
  const lastHapticStep = useRef(0);

  const isPersonalBest = !!stats && stats.count > 0 && score > stats.previousBest;
  const goldUnlock = medal?.type === 'unlock' && medal.tier === 'gold';
  const celebrate = letter === 'A' || isPersonalBest || goldUnlock;
  const color = scoreColor(score);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;

    if (reduceMotion) {
      setDisplayScore(score);
      setStamped(true);
      stampScale.setValue(1);
      stampOpacity.setValue(1);
      detailOpacity.setValue(1);
      return;
    }

    const sub = progress.addListener(({ value }) => {
      const current = Math.round(value);
      setDisplayScore(current);
      const step = Math.floor(current / HAPTIC_STEP);
      if (step > lastHapticStep.current) {
        lastHapticStep.current = step;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    });

    Animated.timing(progress, {
      toValue: score,
      duration: COUNT_UP_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // drives a text value via listener
    }).start(({ finished }) => {
      if (!finished) return;
      setDisplayScore(score);
      setStamped(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (celebrate) setFireConfetti(true);
      Animated.parallel([
        Animated.spring(stampScale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.timing(stampOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start(() => {
        Animated.timing(detailOpacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      });
    });

    return () => progress.removeListener(sub);
  }, [reduceMotion]);

  return (
    <View style={styles.wrap}>
      <View style={styles.scoreRow}>
        <View style={[styles.scorePill, { backgroundColor: color + '18', borderColor: color + '50' }]}>
          <Text style={[styles.scoreText, { color }]}>{displayScore}</Text>
        </View>
        {stamped && (
          <Animated.Text
            style={[styles.grade, { opacity: stampOpacity, transform: [{ scale: stampScale }] }]}
          >
            {letter}
          </Animated.Text>
        )}
      </View>

      <Animated.View style={[styles.detail, { opacity: detailOpacity }]}>
        {stats && (
          <Text style={[styles.comparisonText, isPersonalBest && { color: colors.scoreGreen }]}>
            {comparisonLine(score, stats)}
          </Text>
        )}
        {streakDays != null && streakDays > 0 && (
          <Text style={styles.streakText}>
            {streakDays === 1 ? '🔥 Day 1 — streak started!' : `🔥 Day ${streakDays} — streak extended!`}
          </Text>
        )}
        {medal && (
          <Text style={medal.type === 'unlock' ? styles.medalUnlockText : styles.medalProgressText}>
            {medalLine(medal)}
          </Text>
        )}
      </Animated.View>

      {fireConfetti && (
        <ConfettiCannon
          count={150}
          origin={{ x: width / 2, y: -20 }}
          fadeOut
          autoStart
          fallSpeed={2600}
          explosionSpeed={420}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 68,
  },
  scorePill: {
    borderRadius: radius.md,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  scoreText: { fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  grade: { fontSize: 42, fontWeight: '900', color: colors.text },
  detail: { gap: 4 },
  comparisonText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  streakText: { color: '#FF9500', fontSize: 14, fontWeight: '700' },
  medalUnlockText: { color: '#FFD60A', fontSize: 14, fontWeight: '700' },
  medalProgressText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});
