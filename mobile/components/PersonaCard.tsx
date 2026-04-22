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
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{scenario?.icon ?? '🎙️'}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{persona.name}</Text>
        <View style={styles.personalityPill}>
          <Text style={styles.personalityText}>{persona.personality_type}</Text>
        </View>
        <Text style={styles.description}>{persona.brief_description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: 'rgba(2,132,199,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icon: { fontSize: 26 },
  body: { flex: 1, gap: spacing.sm },
  name: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.text,
  },
  personalityPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(2,132,199,0.12)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.2)',
  },
  personalityText: {
    fontSize: 11,
    color: colors.accentLight,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
  },
});
