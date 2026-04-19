import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../lib/theme';
import { Persona } from '../lib/types';
import { getScenarioConfig } from '../lib/scenarios';

interface Props {
  persona: Persona;
}

export default function PersonaCard({ persona }: Props) {
  const scenario = getScenarioConfig(persona.scenario_type);
  return (
    <View style={styles.card}>
      <Text style={styles.icon}>{scenario?.icon ?? '🎙️'}</Text>
      <Text style={styles.name}>{persona.name}</Text>
      <Text style={styles.personality}>{persona.personality_type}</Text>
      <Text style={styles.description}>{persona.brief_description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    fontSize: 36,
    marginBottom: spacing.sm,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  personality: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
