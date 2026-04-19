import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { TrainingSession } from '../../../lib/types';
import ScoreBadge from '../../../components/ScoreBadge';
import TranscriptMessage from '../../../components/TranscriptMessage';
import { colors, spacing, radius } from '../../../lib/theme';
import { getScenarioConfig } from '../../../lib/scenarios';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!id) return;
    supabase
      .from('training_sessions')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setSession(data as TrainingSession | null);
        setLoading(false);
      });
  }, [id]);

  const handleTrainAgain = async () => {
    if (!session?.persona_scenario_type) return;
    const { data } = await supabase
      .from('personas')
      .select('id')
      .eq('scenario_type', session.persona_scenario_type)
      .eq('is_active', true);
    if (!data || data.length === 0) return;
    const persona = data[Math.floor(Math.random() * data.length)] as { id: string };
    router.push({
      pathname: '/(tabs)/train/pre-call',
      params: { scenarioType: session.persona_scenario_type, personaId: persona.id },
    });
  };

  if (loading || !session) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  const { assessment, transcript, persona_name, persona_scenario_type } = session;
  const scenario = getScenarioConfig(persona_scenario_type ?? '');
  const speakerLabel = persona_name ?? 'Contact';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.scenarioLabel}>{scenario?.label ?? persona_scenario_type}</Text>
      <Text style={styles.personaName}>{persona_name}</Text>

      <View style={styles.scoreRow}>
        <ScoreBadge score={assessment?.score ?? 0} size="lg" />
        {assessment?.letter_grade && <Text style={styles.grade}>{assessment.letter_grade}</Text>}
      </View>

      {assessment?.summary && (
        <Text style={styles.summary}>{assessment.summary}</Text>
      )}

      {assessment?.strengths?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Strengths</Text>
          {assessment.strengths.map((s: string, i: number) => (
            <View key={i} style={styles.bullet}>
              <Text style={styles.bulletDot}>✓</Text>
              <Text style={styles.bulletText}>{s}</Text>
            </View>
          ))}
        </>
      )}

      {assessment?.improvements?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Improvements</Text>
          {assessment.improvements.map((s: string, i: number) => (
            <View key={i} style={styles.bullet}>
              <Text style={[styles.bulletDot, { color: colors.accent }]}>→</Text>
              <Text style={styles.bulletText}>{s}</Text>
            </View>
          ))}
        </>
      )}

      {transcript?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Transcript</Text>
          {transcript.map((msg: any, i: number) => (
            <TranscriptMessage
              key={i}
              role={msg.role}
              content={msg.content}
              speakerLabel={speakerLabel}
            />
          ))}
        </>
      )}

      <TouchableOpacity style={styles.trainAgainButton} onPress={handleTrainAgain}>
        <Text style={styles.trainAgainText}>▶  Train on Same Scenario</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  scenarioLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  personaName: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: spacing.md },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  grade: { fontSize: 36, fontWeight: '900', color: colors.text },
  summary: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: spacing.lg },
  sectionTitle: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  bullet: { flexDirection: 'row', marginBottom: spacing.sm, gap: spacing.sm },
  bulletDot: { color: colors.scoreGreen, fontSize: 14, fontWeight: '700', width: 18 },
  bulletText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
  trainAgainButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  trainAgainText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
