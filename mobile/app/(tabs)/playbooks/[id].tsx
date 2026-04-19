import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Playbook } from '../../../lib/types';
import { getScenarioConfig } from '../../../lib/scenarios';
import { colors, spacing } from '../../../lib/theme';

export default function PlaybookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('playbooks')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setPlaybook(data as Playbook | null);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  if (!playbook) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Playbook not found.</Text>
      </View>
    );
  }

  const scenario = getScenarioConfig(playbook.scenario_type ?? '');

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.scenarioLabel}>{scenario?.label ?? playbook.scenario_type}</Text>
      {playbook.name && <Text style={styles.title}>{playbook.name}</Text>}
      <Text style={styles.body}>{playbook.content}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.textMuted, fontSize: 14 },
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  scenarioLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.lg,
  },
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 24,
  },
});
