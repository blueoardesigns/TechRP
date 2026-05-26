import { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Touchable } from '../../../components/Touchable';
import { supabase } from '../../../lib/supabase';
import { TrainingSession } from '../../../lib/types';
import ScoreBadge from '../../../components/ScoreBadge';
import TranscriptMessage from '../../../components/TranscriptMessage';
import { getDisplayScore } from '../../../lib/scoring';
import { colors, spacing, radius } from '../../../lib/theme';
import { getScenarioConfig } from '../../../lib/scenarios';
import RecordingPlayer, { type RecordingPlayerHandle } from '../../../components/RecordingPlayer';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const router = useRouter();
  const playerRef = useRef<RecordingPlayerHandle>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('training_sessions')
      .select('*, recording_url, vapi_call_id')
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

  const { transcript, persona_name, persona_scenario_type } = session;
  // Supabase may return jsonb as an object OR a JSON string — normalise both
  const assessment: any = (() => {
    const raw = session.assessment;
    if (!raw) return null;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return raw;
  })();
  const scenario = getScenarioConfig(persona_scenario_type ?? '');
  const speakerLabel = persona_name ?? 'Contact';
  // Treat empty/broken assessment (no score or score 0 with no data) as missing
  const hasAssessment = assessment
    && typeof assessment.score === 'number'
    && (assessment.score > 0 || (assessment.strengths?.length > 0 || assessment.improvements?.length > 0));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: persona_name ?? 'Session Detail' }} />
      {/* Header */}
      <View style={styles.scenarioPill}>
        <Text style={styles.scenarioPillText}>{scenario?.label ?? persona_scenario_type}</Text>
      </View>
      <Text style={styles.personaName}>{persona_name}</Text>

      {/* Score / no-assessment state */}
      {!hasAssessment ? (
        <View style={[styles.heroCard, styles.pendingCard]}>
          <Ionicons name="hourglass-outline" size={28} color={colors.textMuted} />
          <Text style={styles.pendingTitle}>Assessment Pending</Text>
          <Text style={styles.pendingText}>
            The AI grade for this session wasn't saved. This usually means the app couldn't reach the server when the call ended.
          </Text>
        </View>
      ) : (
        <View style={styles.heroCard}>
          <View style={styles.scoreRow}>
            <ScoreBadge score={getDisplayScore(assessment).score} size="lg" />
            {(assessment.letter_grade || getDisplayScore(assessment).letter) && (
              <Text style={styles.grade}>{getDisplayScore(assessment).letter}</Text>
            )}
          </View>
          {assessment.summary && (
            <Text style={styles.summary}>{assessment.summary}</Text>
          )}
        </View>
      )}

      {/* Recording */}
      <Text style={styles.sectionTitle}>Recording</Text>
      <RecordingPlayer
        ref={playerRef}
        recordingUrl={(session as any)?.recording_url ?? null}
        vapiCallId={(session as any)?.vapi_call_id ?? null}
        sessionId={session.id}
      />

      {/* Strengths */}
      {assessment?.strengths?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Strengths</Text>
          {assessment.strengths.map((s: string, i: number) => (
            <View key={i} style={styles.bullet}>
              <View style={[styles.bulletIcon, styles.strengthIcon]}>
                <Ionicons name="checkmark" size={13} color={colors.scoreGreen} />
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
                <Ionicons name="arrow-forward" size={13} color={colors.accent} />
              </View>
              <Text style={styles.bulletText}>{s}</Text>
            </View>
          ))}
        </>
      )}

      {/* Practice Moments / Actions to take */}
      {assessment?.actions_to_take?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Practice Moments</Text>
          {assessment.actions_to_take.map((a: any, i: number) => (
            <View key={i} style={styles.actionCard}>
              <View style={styles.actionHeader}>
                <Text style={styles.actionLabel}>They said:</Text>
                {typeof a.offset_seconds === 'number' && (
                  <TouchableOpacity
                    style={styles.playMomentButton}
                    onPress={() => playerRef.current?.seekTo(a.offset_seconds)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="play" size={10} color={colors.accentLight} />
                    <Text style={styles.playMomentText}>
                      {Math.floor(a.offset_seconds / 60)}:{(a.offset_seconds % 60).toString().padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
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

      {/* Transcript (collapsible) */}
      {Array.isArray(transcript) && transcript.length > 0 && (
        <>
          <Touchable
            style={styles.transcriptToggle}
            onPress={() => setShowTranscript(v => !v)}
          >
            <View style={styles.transcriptHeader}>
              <Ionicons name={showTranscript ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.accentLight} />
              <Text style={styles.sectionTitle}>Transcript ({transcript.length} messages)</Text>
            </View>
          </Touchable>
          {showTranscript && transcript.map((msg: any, i: number) => (
            <TranscriptMessage
              key={i}
              role={msg.role}
              content={msg.content ?? ''}
              speakerLabel={speakerLabel}
            />
          ))}
        </>
      )}

      {/* Train again */}
      <Touchable style={styles.trainButton} onPress={handleTrainAgain}>
        <Ionicons name="refresh" size={18} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.trainButtonText}>Train on Same Scenario</Text>
      </Touchable>
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
    borderWidth: 0.5,
    borderColor: colors.borderStrong,
  },
  pendingCard: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  pendingTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  pendingText: { color: colors.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
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
  bulletText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 22 },

  actionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    borderTopWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderTopColor: colors.border,
    borderRightColor: colors.border,
    borderBottomColor: colors.border,
    gap: 4,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  playMomentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(2,132,199,0.12)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.2)',
  },
  playMomentText: {
    color: colors.accentLight,
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  transcriptToggle: { marginTop: spacing.lg },
  transcriptHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  trainButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: spacing.xl,
    minHeight: 56,
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  trainButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
