import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Assessment } from '../../../lib/types';
import ScoreBadge from '../../../components/ScoreBadge';
import { colors, spacing, radius } from '../../../lib/theme';

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
        setAssessment((data as { assessment: unknown } | null)?.assessment as Assessment | null ?? null);
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>Grading your session…</Text>
        <Text style={styles.loadingSubtext}>This takes a few seconds</Text>
      </View>
    );
  }

  if (!assessment) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>Assessment not available.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Score hero */}
      <View style={styles.heroCard}>
        <View style={styles.scoreRow}>
          <ScoreBadge score={assessment.score} size="lg" />
          {assessment.letter_grade && (
            <Text style={styles.grade}>{assessment.letter_grade}</Text>
          )}
        </View>
        <Text style={styles.summary}>{assessment.summary}</Text>
      </View>

      {/* Strengths */}
      <SectionHeader label="Strengths" />
      {assessment.strengths.map((s, i) => (
        <View key={i} style={styles.bulletRow}>
          <View style={[styles.bulletIcon, styles.strengthIcon]}>
            <Text style={styles.bulletIconText}>✓</Text>
          </View>
          <Text style={styles.bulletText}>{s}</Text>
        </View>
      ))}

      {/* Improvements */}
      <SectionHeader label="Areas to Improve" />
      {assessment.improvements.map((s, i) => (
        <View key={i} style={styles.bulletRow}>
          <View style={[styles.bulletIcon, styles.improvIcon]}>
            <Text style={styles.bulletIconText}>→</Text>
          </View>
          <Text style={styles.bulletText}>{s}</Text>
        </View>
      ))}

      {/* Actions to take */}
      {assessment.actions_to_take && assessment.actions_to_take.length > 0 && (
        <>
          <SectionHeader label="Practice Moments" />
          {assessment.actions_to_take.map((a, i) => (
            <View key={i} style={styles.actionCard}>
              <Text style={styles.actionLabel}>They said:</Text>
              <Text style={styles.actionQuote}>"{a.ai_said}"</Text>
              <Text style={styles.actionLabel}>Better response:</Text>
              <Text style={styles.actionResponse}>{a.suggested_response}</Text>
              {a.technique && (
                <View style={styles.techniquePill}>
                  <Text style={styles.techniqueText}>{a.technique}</Text>
                </View>
              )}
            </View>
          ))}
        </>
      )}

      {/* Done */}
      <TouchableOpacity style={styles.doneButton} onPress={() => router.replace('/(tabs)/train')} activeOpacity={0.85}>
        <Text style={styles.doneButtonText}>↩  Train Again</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.sessionsButton} onPress={() => router.replace('/(tabs)/sessions')} activeOpacity={0.85}>
        <Text style={styles.sessionsButtonText}>View All Sessions</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <Text style={sectionHeaderStyle}>{label}</Text>
  );
}

const sectionHeaderStyle = {
  color: colors.accentLight,
  fontSize: 12,
  fontWeight: '700' as const,
  letterSpacing: 1,
  textTransform: 'uppercase' as const,
  marginBottom: spacing.sm,
  marginTop: spacing.lg,
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  loadingSubtext: { color: colors.textMuted, fontSize: 13 },
  errorIcon: { fontSize: 32, marginBottom: spacing.sm },
  errorText: { color: colors.textMuted, fontSize: 15 },

  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },

  // Hero score card
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  grade: { fontSize: 42, fontWeight: '900', color: colors.text },
  summary: { color: colors.textMuted, fontSize: 15, lineHeight: 23 },

  // Bullets
  bulletRow: { flexDirection: 'row', marginBottom: spacing.sm, gap: spacing.sm, alignItems: 'flex-start' },
  bulletIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  strengthIcon: { backgroundColor: 'rgba(34,197,94,0.15)' },
  improvIcon:   { backgroundColor: 'rgba(2,132,199,0.12)' },
  bulletIconText: { fontSize: 12, fontWeight: '700', color: colors.text },
  bulletText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 22 },

  // Action cards
  actionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: colors.border,
    borderRightColor: colors.border,
    borderBottomColor: colors.border,
    gap: 4,
  },
  actionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  actionQuote: { color: colors.text, fontSize: 14, fontStyle: 'italic', lineHeight: 21 },
  actionResponse: { color: colors.text, fontSize: 14, lineHeight: 21 },
  techniquePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(2,132,199,0.15)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginTop: spacing.sm,
  },
  techniqueText: {
    color: colors.accentLight,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Buttons
  doneButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
    minHeight: 56,
    justifyContent: 'center',
  },
  doneButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sessionsButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 52,
    justifyContent: 'center',
  },
  sessionsButtonText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
});
