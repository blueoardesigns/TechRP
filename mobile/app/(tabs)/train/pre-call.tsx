import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Persona } from '../../../lib/types';
import PersonaCard from '../../../components/PersonaCard';
import { colors, spacing, radius } from '../../../lib/theme';
import { getScenarioConfig } from '../../../lib/scenarios';

export default function PreCallScreen() {
  const { personaId, scenarioType } = useLocalSearchParams<{ personaId: string; scenarioType: string }>();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!personaId) return;
    supabase
      .from('personas')
      .select('*')
      .eq('id', personaId)
      .single()
      .then(({ data }) => {
        setPersona(data);
        setLoading(false);
      });
  }, [personaId]);

  const handleStartCall = () => {
    if (!persona) return;
    router.push({
      pathname: '/(tabs)/train/call',
      params: { personaId: persona.id },
    });
  };

  if (loading || !persona) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>Loading scenario…</Text>
      </View>
    );
  }

  const scenario = getScenarioConfig(persona.scenario_type);

  return (
    <View style={styles.container}>
      {/* Scenario label */}
      <View style={styles.scenarioPill}>
        <Text style={styles.scenarioPillText}>{scenario?.label ?? persona.scenario_type}</Text>
      </View>

      {/* Persona info */}
      <PersonaCard persona={persona} />

      {/* Role context */}
      <View style={styles.roleCard}>
        <Text style={styles.roleLabel}>Your role</Text>
        <Text style={styles.roleValue}>{scenario?.techRole ?? 'Technician'}</Text>
      </View>

      {/* Tips */}
      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>Before you call</Text>
        <Text style={styles.tipLine}>• Speak naturally — the AI will respond in real time</Text>
        <Text style={styles.tipLine}>• Try to handle objections and close</Text>
        <Text style={styles.tipLine}>• You'll get scored when the call ends</Text>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={styles.button}
        onPress={handleStartCall}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>🎙️  Start Call</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: { color: colors.textMuted, fontSize: 14 },

  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },

  scenarioPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(2,132,199,0.15)',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
  },
  scenarioPillText: {
    color: colors.accentLight,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleLabel: { color: colors.textMuted, fontSize: 13 },
  roleValue: { color: colors.text, fontSize: 14, fontWeight: '600' },

  tipsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  tipsTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.xs },
  tipLine: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },

  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: spacing.lg,
    minHeight: 58,
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 0.2 },
});
