import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Assessment } from '../../../lib/types';
import ScoreBadge from '../../../components/ScoreBadge';
import { colors, spacing, radius, typography } from '../../../lib/theme';

export default function AssessmentScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!sessionId) return;
    supabase
      .from('training_sessions')
      .select('assessment')
      .eq('id', sessionId)
      .single()
      .then(({ data }) => {
        setAssessment(data?.assessment ?? null);
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>Grading your session...</Text>
      </View>
    );
  }

  if (!assessment) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Assessment not available.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.scoreRow}>
        <ScoreBadge score={assessment.score} size="lg" />
        {assessment.letter_grade && (
          <Text style={styles.grade}>{assessment.letter_grade}</Text>
        )}
      </View>

      <Text style={styles.summary}>{assessment.summary}</Text>

      <Text style={styles.sectionTitle}>Strengths</Text>
      {assessment.strengths.map((s, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>✓</Text>
          <Text style={styles.bulletText}>{s}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Improvements</Text>
      {assessment.improvements.map((s, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={[styles.bulletDot, { color: colors.accent }]}>→</Text>
          <Text style={styles.bulletText}>{s}</Text>
        </View>
      ))}

      {assessment.actions_to_take && assessment.actions_to_take.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Actions to Take</Text>
          {assessment.actions_to_take.map((a, i) => (
            <View key={i} style={styles.actionCard}>
              <Text style={styles.actionLabel}>They said:</Text>
              <Text style={styles.actionQuote}>"{a.ai_said}"</Text>
              <Text style={styles.actionLabel}>Better response:</Text>
              <Text style={styles.actionResponse}>{a.suggested_response}</Text>
              {a.technique && (
                <Text style={styles.technique}>{a.technique}</Text>
              )}
            </View>
          ))}
        </>
      )}

      <TouchableOpacity style={styles.doneButton} onPress={() => router.replace('/(tabs)/train')}>
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { color: colors.textMuted, fontSize: 14 },
  errorText: { color: colors.textMuted, fontSize: 14 },
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  grade: { fontSize: 36, fontWeight: '900', color: colors.text },
  summary: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: spacing.xl },
  sectionTitle: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  bulletRow: { flexDirection: 'row', marginBottom: spacing.sm, gap: spacing.sm },
  bulletDot: { color: colors.scoreGreen, fontSize: 14, fontWeight: '700', width: 18 },
  bulletText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
  actionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  actionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  actionQuote: { color: colors.text, fontSize: 14, fontStyle: 'italic', marginBottom: spacing.sm },
  actionResponse: { color: colors.text, fontSize: 14, lineHeight: 20 },
  technique: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '600',
    marginTop: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  doneButton: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  doneButtonText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
