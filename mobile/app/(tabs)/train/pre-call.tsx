import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Persona } from '../../../lib/types';
import PersonaCard from '../../../components/PersonaCard';
import { colors, spacing, radius, typography } from '../../../lib/theme';
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
      </View>
    );
  }

  const scenario = getScenarioConfig(persona.scenario_type);

  return (
    <View style={styles.container}>
      <Text style={styles.scenarioLabel}>{scenario?.label}</Text>
      <PersonaCard persona={persona} />

      <View style={styles.roleRow}>
        <Text style={styles.roleLabel}>Your role:</Text>
        <Text style={styles.roleValue}>{scenario?.techRole ?? 'Technician'}</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleStartCall}>
        <Text style={styles.buttonText}>🎙️  Start Call</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  scenarioLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  roleLabel: { color: colors.textMuted, fontSize: 14, marginRight: spacing.sm },
  roleValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: spacing.xl,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
