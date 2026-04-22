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
    if (!profile) return;
    const load = async () => {
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
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={sessions.length === 0 ? styles.empty : styles.content}
      data={sessions}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        sessions.length > 0 ? (
          <View style={styles.header}>
            <Text style={styles.screenTitle}>Training Sessions</Text>
            <Text style={styles.screenSubtitle}>{sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded</Text>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.emptyContent}>
          <Text style={styles.emptyIcon}>🎙️</Text>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptyText}>Complete a training call to see your results here.</Text>
        </View>
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
            activeOpacity={0.75}
          >
            <View style={styles.iconWrap}>
              <Text style={styles.icon}>{scenario?.icon ?? '🎙️'}</Text>
            </View>
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
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1 },

  header: { marginBottom: spacing.md },
  screenTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 4 },
  screenSubtitle: { fontSize: 13, color: colors.textMuted },

  emptyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 21 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 72,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  icon: { fontSize: 20 },
  rowText: { flex: 1, gap: 3 },
  personaName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  scenarioLabel: { color: colors.textMuted, fontSize: 12 },
  date: { color: colors.textDim, fontSize: 11 },
});
