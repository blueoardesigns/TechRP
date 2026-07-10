import { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { Assessment } from '../../../lib/types';
import ScoreReveal, { SessionStats } from '../../../components/ScoreReveal';
import { getDisplayScore } from '../../../lib/scoring';
import { fetchStreak } from '../../../lib/streaks';
import { colors, spacing, radius } from '../../../lib/theme';

type GradingStep = 'loading' | 'grading' | 'done' | 'skipped' | 'error';

export default function AssessmentScreen() {
  const { sessionId: paramSessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [sessionId, setSessionId] = useState<string>(paramSessionId ?? '');
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [step, setStep] = useState<GradingStep>('loading');
  const [statusMessage, setStatusMessage] = useState('Loading session…');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [hasPending, setHasPending] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [streakDays, setStreakDays] = useState<number | null>(null);
  const { profile } = useAuth();
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Elapsed timer for grading step
  useEffect(() => {
    if (step === 'grading') {
      setElapsedSecs(0);
      timerRef.current = setInterval(() => setElapsedSecs(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [step]);

  // Prior-session stats + streak for the reveal — best-effort, never blocks grading
  useEffect(() => {
    if (!sessionId || !profile) return;
    let cancelled = false;

    (async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const authUserId = authUser?.id;
        if (!authUserId) return;

        const { data } = await supabase
          .from('training_sessions')
          .select('id, assessment')
          .or(`user_id.eq.${authUserId},user_id.eq.${profile.id}`)
          .neq('id', sessionId);

        if (cancelled) return;

        const scores = (data ?? [])
          .map(row => {
            const raw = row.assessment;
            const parsed = raw
              ? (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw)
              : null;
            return parsed ? getDisplayScore(parsed).score : 0;
          })
          .filter(s => s > 0);

        setStats({
          previousBest: scores.length ? Math.max(...scores) : 0,
          average: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
          count: scores.length,
        });
      } catch (e) {
        console.error('[Assessment] stats fetch failed:', e);
      }
    })();

    fetchStreak(profile.id).then(info => {
      if (!cancelled && info) setStreakDays(info.current);
    });

    return () => { cancelled = true; };
  }, [sessionId, profile]);

  useEffect(() => {
    if (!sessionId) {
      // Load diagnostic info from AsyncStorage
      (async () => {
        try {
          const [saveErr, gradeErr, pending] = await Promise.all([
            AsyncStorage.getItem('last_save_error'),
            AsyncStorage.getItem('last_grading_error'),
            AsyncStorage.getItem('pending_session'),
          ]);
          setErrorDetail(saveErr ?? gradeErr ?? null);
          setHasPending(!!pending);
          setStatusMessage(pending
            ? 'We couldn\'t save your session to the server, but your transcript is safe on your device. Tap Retry to save it.'
            : 'Session could not be saved.');
        } catch {
          setStatusMessage('Session could not be saved.');
        }
        setStep('error');
      })();
      return;
    }

    let cancelled = false;

    const run = async () => {
      // 1. Load session from DB
      setStatusMessage('Loading session…');
      let data: any = null;
      try {
        const result = await supabase
          .from('training_sessions')
          .select('assessment, transcript, persona_name, persona_scenario_type, persona_id')
          .eq('id', sessionId)
          .single();
        data = result.data;
        if (result.error) {
          console.error('[Assessment] Session load error:', result.error);
        }
      } catch (e) {
        console.error('[Assessment] Session load exception:', e);
      }

      if (cancelled) return;

      if (!data) {
        setStatusMessage('Could not load session.');
        setStep('error');
        return;
      }

      // Check if assessment already exists
      const raw = data.assessment;
      const parsed = raw
        ? (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw)
        : null;

      if (parsed && typeof parsed.score === 'number' && parsed.score > 0) {
        setAssessment(parsed as Assessment);
        setStep('done');
        return;
      }

      // 2. Need to grade — call /api/assess
      setStep('grading');
      setStatusMessage('Sending transcript to AI for grading…');

      // Normalize transcript: Supabase jsonb may come back as an array OR a JSON string.
      // Handle both before length-checking so an empty-string-encoded array doesn't
      // slip through and POST `messages: []` to /api/assess (which returns 400).
      const rawTranscript = data.transcript;
      let transcript: any[] | null = null;
      if (Array.isArray(rawTranscript)) {
        transcript = rawTranscript;
      } else if (typeof rawTranscript === 'string') {
        try { transcript = JSON.parse(rawTranscript); } catch { transcript = null; }
        if (!Array.isArray(transcript)) transcript = null;
      }
      if (!transcript || transcript.length === 0) {
        setStatusMessage('Call ended with no transcript captured. There\'s nothing to grade.');
        setErrorDetail('The call connected but no spoken audio was captured before it ended. Try training again.');
        setStep('error');
        return;
      }

      // Fetch persona details separately (avoid join issues)
      let personaDetails: any = null;
      if (data.persona_id) {
        try {
          const { data: pData } = await supabase
            .from('personas')
            .select('personality_type, speaker_label')
            .eq('id', data.persona_id)
            .single();
          personaDetails = pData;
        } catch { /* non-critical */ }
      }

      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
      try {
        const controller = new AbortController();
        abortRef.current = controller;
        const timeout = setTimeout(() => controller.abort(), 60_000);

        setStatusMessage('AI is analyzing your call…');

        // Send the Supabase access token so the server can authenticate this
        // request (the route now rejects unauthenticated callers) and resolve
        // coach-isolated playbooks for this user.
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        const res = await fetch(`${baseUrl}/api/assess`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          signal: controller.signal,
          body: JSON.stringify({
            messages: transcript,
            persona: {
              name: data.persona_name ?? '',
              personalityType: personaDetails?.personality_type ?? '',
              scenarioType: data.persona_scenario_type ?? '',
              speakerLabel: personaDetails?.speaker_label ?? 'Contact',
            },
          }),
        });
        clearTimeout(timeout);

        if (cancelled) return;

        if (!res.ok) {
          const errText = await res.text().catch(() => 'Unknown error');
          console.error('[Assessment] API error:', res.status, errText);
          // Try to surface the server's actual error message
          let serverMsg = errText;
          try {
            const parsed = JSON.parse(errText);
            if (parsed?.error) serverMsg = String(parsed.error);
          } catch { /* keep raw text */ }
          const detail = `HTTP ${res.status} from /api/assess\nMessages sent: ${transcript.length}\nServer says: ${serverMsg.slice(0, 500)}`;
          await AsyncStorage.setItem('last_grading_error', detail).catch(() => {});
          setStatusMessage(`Grading failed (${res.status}). Your session was saved.`);
          setErrorDetail(detail);
          setStep('error');
          return;
        }

        setStatusMessage('Saving your grade…');
        const json = await res.json();
        const newAssessment = json.assessment;

        if (newAssessment) {
          await AsyncStorage.removeItem('last_grading_error').catch(() => {});
          await supabase
            .from('training_sessions')
            .update({ assessment: newAssessment })
            .eq('id', sessionId);
          setAssessment(newAssessment as Assessment);
          setStep('done');
        } else {
          const detail = `Server returned 200 but no assessment field.\nBody: ${JSON.stringify(json).slice(0, 500)}`;
          await AsyncStorage.setItem('last_grading_error', detail).catch(() => {});
          setStatusMessage('AI returned an empty assessment. Your session was saved.');
          setErrorDetail(detail);
          setStep('error');
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          setStatusMessage('Grading was cancelled. Your session was saved.');
          setStep('skipped');
        } else {
          console.error('[Assessment] Fetch exception:', e);
          const detail = `Network/fetch error: ${e?.message ?? String(e)}`;
          await AsyncStorage.setItem('last_grading_error', detail).catch(() => {});
          setStatusMessage('Could not reach grading server. Your session was saved.');
          setErrorDetail(detail);
          setStep('error');
        }
      }
    };

    run();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [sessionId]);

  const handleSkip = () => {
    abortRef.current?.abort();
    setStep('skipped');
    setStatusMessage('Grading skipped. Your session was saved.');
  };

  const handleRetrySave = async () => {
    setRetrying(true);
    setStep('loading');
    setStatusMessage('Retrying save…');
    try {
      const cached = await AsyncStorage.getItem('pending_session');
      if (!cached) throw new Error('No cached session to retry');
      const payload = JSON.parse(cached);
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error('Not signed in');
      let organizationId: string | null = null;
      let profileUserId: string | null = null;
      try {
        const { data: profileData } = await supabase
          .from('users')
          .select('id, organization_id')
          .eq('auth_user_id', userId)
          .single();
        organizationId = (profileData as any)?.organization_id ?? null;
        profileUserId = (profileData as any)?.id ?? null;
      } catch { /* non-critical */ }
      const insertResult: any = await supabase
        .from('training_sessions')
        .insert({ ...payload, user_id: profileUserId ?? userId, organization_id: organizationId })
        .select('id')
        .single();
      if (insertResult.error) throw new Error(insertResult.error.message);
      const newId = (insertResult.data as { id: string } | null)?.id;
      if (!newId) throw new Error('Insert returned no id');
      await AsyncStorage.removeItem('pending_session');
      await AsyncStorage.removeItem('last_save_error');
      setSessionId(newId);
      setErrorDetail(null);
      setHasPending(false);
      setRetrying(false);
      // useEffect will re-run with new sessionId and proceed to grading
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setErrorDetail(msg);
      setStatusMessage('Retry failed. ' + msg);
      setStep('error');
      setRetrying(false);
    }
  };

  // Progress / loading states
  if (step === 'loading' || step === 'grading') {
    const stepIndex = step === 'loading' ? 0 : 1;
    return (
      <View style={styles.center}>
        <View style={styles.progressWrap}>
          {/* Step dots */}
          <View style={styles.stepsRow}>
            {['Save', 'Analyze', 'Results'].map((label, i) => (
              <View key={label} style={styles.stepItem}>
                <View style={[
                  styles.stepDot,
                  i <= stepIndex && styles.stepDotActive,
                  i < stepIndex && styles.stepDotComplete,
                ]}>
                  {i < stepIndex ? (
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  ) : i === stepIndex ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : null}
                </View>
                <Text style={[styles.stepLabel, i <= stepIndex && styles.stepLabelActive]}>
                  {label}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.loadingText}>{statusMessage}</Text>
          {step === 'grading' && elapsedSecs > 0 && (
            <Text style={styles.loadingSubtext}>
              {elapsedSecs < 15
                ? `${elapsedSecs}s — this usually takes 10–20 seconds`
                : elapsedSecs < 30
                  ? `${elapsedSecs}s — almost there…`
                  : `${elapsedSecs}s — taking longer than usual`}
            </Text>
          )}
          {step === 'loading' && (
            <Text style={styles.loadingSubtext}>Preparing your transcript…</Text>
          )}
        </View>

        {step === 'grading' && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.7}>
            <Text style={styles.skipButtonText}>Skip Grading</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Error / skipped states
  if (step === 'error' || step === 'skipped') {
    return (
      <View style={styles.center}>
        <Ionicons
          name={step === 'skipped' ? 'play-skip-forward-outline' : 'warning-outline'}
          size={36}
          color={colors.textMuted}
        />
        <Text style={styles.errorText}>{statusMessage}</Text>
        {errorDetail && (
          <View style={styles.errorDetailBox}>
            <Text style={styles.errorDetailLabel}>Details</Text>
            <Text style={styles.errorDetailText}>{errorDetail}</Text>
          </View>
        )}
        <View style={styles.errorButtons}>
          {hasPending && !sessionId && (
            <TouchableOpacity
              style={styles.doneButton}
              onPress={handleRetrySave}
              activeOpacity={0.85}
              disabled={retrying}
            >
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.doneButtonText}>{retrying ? 'Retrying…' : 'Retry Save'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={hasPending && !sessionId ? styles.sessionsButton : styles.doneButton}
            onPress={() => router.replace('/(tabs)/train')}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh" size={18} color={hasPending && !sessionId ? colors.textMuted : '#fff'} style={{ marginRight: 6 }} />
            <Text style={hasPending && !sessionId ? styles.sessionsButtonText : styles.doneButtonText}>Train Again</Text>
          </TouchableOpacity>
          {sessionId && (
            <TouchableOpacity
              style={styles.sessionsButton}
              onPress={() => router.push({ pathname: '/(tabs)/sessions/[id]', params: { id: sessionId } })}
              activeOpacity={0.85}
            >
              <Text style={styles.sessionsButtonText}>View Saved Session</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.sessionsButton}
            onPress={() => router.replace('/(tabs)/sessions')}
            activeOpacity={0.85}
          >
            <Text style={styles.sessionsButtonText}>All Sessions</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!assessment) {
    return (
      <View style={styles.center}>
        <Ionicons name="warning-outline" size={36} color={colors.textMuted} />
        <Text style={styles.errorText}>Assessment not available.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Score hero */}
      <View style={styles.heroCard}>
        <ScoreReveal
          score={getDisplayScore(assessment).score}
          letter={getDisplayScore(assessment).letter}
          stats={stats}
          streakDays={streakDays}
        />
        <Text style={styles.summary}>{assessment.summary}</Text>
      </View>

      {/* Strengths */}
      <SectionHeader label="Strengths" />
      {assessment.strengths.map((s, i) => (
        <View key={i} style={styles.bulletRow}>
          <View style={[styles.bulletIcon, styles.strengthIcon]}>
            <Ionicons name="checkmark" size={13} color={colors.scoreGreen} />
          </View>
          <Text style={styles.bulletText}>{s}</Text>
        </View>
      ))}

      {/* Improvements */}
      <SectionHeader label="Areas to Improve" />
      {assessment.improvements.map((s, i) => (
        <View key={i} style={styles.bulletRow}>
          <View style={[styles.bulletIcon, styles.improvIcon]}>
            <Ionicons name="arrow-forward" size={12} color={colors.accentLight} />
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
        <Ionicons name="refresh" size={18} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.doneButtonText}>Train Again</Text>
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
    padding: spacing.lg,
  },
  progressWrap: { alignItems: 'center', gap: spacing.md },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  stepItem: { alignItems: 'center', gap: spacing.xs },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  stepDotActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  stepDotComplete: {
    backgroundColor: colors.scoreGreen,
    borderColor: colors.scoreGreen,
  },
  stepLabel: { fontSize: 11, color: colors.textDim, fontWeight: '600' },
  stepLabelActive: { color: colors.text },

  loadingText: { color: colors.text, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  loadingSubtext: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  skipButton: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skipButtonText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },

  errorText: { color: colors.text, fontSize: 15, fontWeight: '600', textAlign: 'center', lineHeight: 22 },
  errorDetailBox: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  errorDetailLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  errorDetailText: { color: colors.text, fontSize: 12, fontFamily: 'Courier', lineHeight: 18 },
  errorButtons: { width: '100%', marginTop: spacing.lg, gap: spacing.sm },

  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },

  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 0.5,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  summary: { color: colors.textMuted, fontSize: 15, lineHeight: 23 },

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

  doneButton: {
    flexDirection: 'row',
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    minHeight: 56,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
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
