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
  const initials = persona.name
    ? persona.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';
  return (
    <View style={styles.card}>
      <View style={styles.avatarWrap}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{persona.name}</Text>
        <View style={styles.pills}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{persona.personality_type}</Text>
          </View>
          {scenario && (
            <View style={[styles.pill, styles.pillScenario]}>
              <Text style={[styles.pillText, styles.pillScenarioText]}>{scenario.label}</Text>
            </View>
          )}
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
    borderWidth: 0.5,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: colors.text },
  body: { flex: 1, gap: spacing.xs },
  name: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(56,189,248,0.25)',
  },
  pillText: {
    fontSize: 11,
    color: colors.accentLight,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillScenario: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: colors.border,
  },
  pillScenarioText: {
    color: colors.textMuted,
  },
  description: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: 2,
  },
});
