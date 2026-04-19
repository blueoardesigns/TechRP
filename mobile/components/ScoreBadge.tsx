import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';

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
  return (
    <View
      testID="score-badge"
      style={[styles.badge, { backgroundColor: badgeColor(score) }, isLarge && styles.large]}
    >
      <Text style={[styles.text, isLarge && styles.textLarge]}>{score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  large: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  textLarge: {
    fontSize: 32,
  },
});
