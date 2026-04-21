import { useEffect, useState } from 'react';
import { FlatList, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { TrainingSession } from '../../../lib/types';
import { getScenarioConfig } from '../../../lib/scenarios';
import ScoreBadge from '../../../components/ScoreBadge';
import { colors, spacing, radius } from '../../../lib/theme';

export default function SessionsListScreen() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!profile) return; // wait for profile to load

    const load = async () => {
      // Use the users table PK (profile.id), NOT the auth UUID.
      // training_sessions.user_id is keyed to users.id per the RLS policy.
      const { data, error } = await supabase
        .from('training_sessions')
        .select('id, persona_name, persona_scenario_type, assessment, created_at, started_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) console.error('[sessions] query error:', JSON.stringify(error));
      setSessions((data ?? []) as TrainingSession[]);
      setLoading(false);
    };
    load();
  }, [profile]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={sessions.length === 0 ? styles.empty : styles.content}
      data={sessions}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <Text style={styles.emptyText}>No sessions yet. Start training to see results here.</Text>
      }
      renderItem={({ item }) => {
        const scenario = getScenarioConfig(item.persona_scenario_type ?? '');
        const score = item.assessment?.score ?? 0;
        const date = new Date(item.created_at).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        });
        return (
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push({ pathname: '/(tabs)/sessions/[id]', params: { id: item.id } })}
          >
            <Text style={styles.icon}>{scenario?.icon ?? '🎙️'}</Text>
            <View style={styles.rowText}>
              <Text style={styles.personaName}>{item.persona_name ?? 'Unknown'}</Text>
              <Text style={styles.scenarioLabel}>{scenario?.label ?? item.persona_scenario_type}</Text>
              <Text style={styles.date}>{date}</Text>
            </View>
            <ScoreBadge score={score} />
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: { fontSize: 24, marginRight: spacing.md },
  rowText: { flex: 1 },
  personaName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  scenarioLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  date: { color: colors.textDim, fontSize: 11, marginTop: 2 },
});
