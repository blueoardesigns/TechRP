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
  const [showTranscript, setShowTranscript] = useState(false);
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
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const { assessment, transcript, persona_name, persona_scenario_type } = session;
  const scenario = getScenarioConfig(persona_scenario_type ?? '');
  const speakerLabel = persona_name ?? 'Contact';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.scenarioPill}>
        <Text style={styles.scenarioPillText}>{scenario?.label ?? persona_scenario_type}</Text>
      </View>
      <Text style={styles.personaName}>{persona_name}</Text>

      {/* Score */}
      <View style={styles.heroCard}>
        <View style={styles.scoreRow}>
          <ScoreBadge score={assessment?.score ?? 0} size="lg" />
          {assessment?.letter_grade && <Text style={styles.grade}>{assessment.letter_grade}</Text>}
        </View>
        {assessment?.summary && (
          <Text style={styles.summary}>{assessment.summary}</Text>
        )}
      </View>

      {/* Strengths */}
      {assessment?.strengths?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Strengths</Text>
          {assessment.strengths.map((s: string, i: number) => (
            <View key={i} style={styles.bullet}>
              <View style={[styles.bulletIcon, styles.strengthIcon]}>
                <Text style={styles.bulletIconText}>✓</Text>
              </View>
              <Text style={styles.bulletText}>{s}</Text>
            </View>
          ))}
        </>
      )}

      {/* Improvements */}
      {assessment?.improvements?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Areas to Improve</Text>
          {assessment.improvements.map((s: string, i: number) => (
            <View key={i} style={styles.bullet}>
              <View style={[styles.bulletIcon, styles.improvIcon]}>
                <Text style={styles.bulletIconText}>→</Text>
              </View>
              <Text style={styles.bulletText}>{s}</Text>
            </View>
          ))}
        </>
      )}

      {/* Transcript (collapsible) */}
      {transcript?.length > 0 && (
        <>
          <TouchableOpacity
            style={styles.transcriptToggle}
            onPress={() => setShowTranscript(v => !v)}
            activeOpacity={0.75}
          >
            <Text style={styles.sectionTitle} onPress={() => setShowTranscript(v => !v)}>
              {showTranscript ? '▾' : '▸'}  Transcript ({transcript.length} messages)
            </Text>
          </TouchableOpacity>
          {showTranscript && transcript.map((msg: any, i: number) => (
            <TranscriptMessage
              key={i}
              role={msg.role}
              content={msg.content}
              speakerLabel={speakerLabel}
            />
          ))}
        </>
      )}

      {/* Train again */}
      <TouchableOpacity style={styles.trainButton} onPress={handleTrainAgain} activeOpacity={0.85}>
        <Text style={styles.trainButtonText}>▶  Train on Same Scenario</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },

  scenarioPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(2,132,199,0.12)',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.2)',
  },
  scenarioPillText: {
    color: colors.accentLight,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  personaName: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: spacing.md },

  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  grade: { fontSize: 42, fontWeight: '900', color: colors.text },
  summary: { color: colors.textMuted, fontSize: 15, lineHeight: 23 },

  sectionTitle: {
    color: colors.accentLight,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  bullet: { flexDirection: 'row', marginBottom: spacing.sm, gap: spacing.sm, alignItems: 'flex-start' },
  bulletIcon: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  strengthIcon: { backgroundColor: 'rgba(34,197,94,0.15)' },
  improvIcon:   { backgroundColor: 'rgba(2,132,199,0.12)' },
  bulletIconText: { fontSize: 12, fontWeight: '700', color: colors.text },
  bulletText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 22 },

  transcriptToggle: { marginTop: spacing.lg },

  trainButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
    minHeight: 56,
    justifyContent: 'center',
  },
  trainButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
