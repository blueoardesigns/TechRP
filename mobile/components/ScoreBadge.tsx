import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../lib/theme';

interface Props {
  score: number;
  size?: 'sm' | 'lg';
}

function badgeColor(score: number): string {
  if (score >= 80) return colors.scoreGreen;
  if (score >= 60) return colors.scoreYellow;
  return colors.scoreRed;
}

export default function ScoreBadge({ score, size = 'sm' }: Props) {
  const isLarge = size === 'lg';
  const color = badgeColor(score);
  return (
    <View
      testID="score-badge"
      style={[
        styles.badge,
        { backgroundColor: color + '18', borderColor: color + '50' },
        isLarge && styles.large,
      ]}
    >
      <Text style={[styles.text, { color }, isLarge && styles.textLarge]}>
        {score}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  large: {
    borderRadius: radius.md,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  textLarge: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
});
