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
  const bg = badgeColor(score);
  return (
    <View
      testID="score-badge"
      style={[
        styles.badge,
        { backgroundColor: bg + '22', borderColor: bg + '55' },
        isLarge && styles.large,
      ]}
    >
      <Text style={[styles.text, { color: bg }, isLarge && styles.textLarge]}>
        {score}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  large: {
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
  },
  textLarge: {
    fontSize: 36,
    fontWeight: '900',
  },
});
