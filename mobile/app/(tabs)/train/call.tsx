import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { Persona, TranscriptEntry } from '../../../lib/types';
import { getVapi, isVapiAvailable } from '../../../lib/vapi';
import { VAPI_ASSISTANT_ID, GROQ_MODEL, pickVoice, getScenarioConfig, DIFFICULTY_MODIFIERS, Difficulty } from '../../../lib/scenarios';
import TranscriptMessage from '../../../components/TranscriptMessage';
import { colors, spacing, radius } from '../../../lib/theme';

type CallStatus = 'connecting' | 'connected' | 'ending';

export default function CallScreen() {
  const { personaId, difficulty: diffParam } = useLocalSearchParams<{ personaId: string; difficulty?: string }>();
  const difficulty: Difficulty = (['easy', 'medium', 'hard'].includes(diffParam ?? '') ? diffParam : 'medium') as Difficulty;
  const [persona, setPersona] = useState<Persona | null>(null);
  const [messages, setMessages] = useState<TranscriptEntry[]>([]);
  const [callStatus, setCallStatus] = useState<CallStatus>('connecting');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const listRef = useRef<FlatList>(null);
  const messagesRef = useRef<TranscriptEntry[]>([]);
  const callStartRef = useRef<Date>(new Date());
  const vapiCallIdRef = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!personaId) return;
    if (!isVapiAvailable()) {
      setCallStatus('connecting');
      return;
    }
    supabase.from('personas').select('*').eq('id', personaId).single().then(({ data }) => {
      if (data) {
        setPersona(data);
        startCall(data);
      }
    });
    return () => {
      try { getVapi().stop(); } catch (_) {}
    };
  }, [personaId]);

  const startCall = async (p: Persona) => {
    const vapi = getVapi();
    const voiceId = pickVoice(p);

    // Clear any stale listeners from a previous session before registering new ones.
    vapi.removeAllListeners();

    vapi.on('call-start', () => setCallStatus('connected'));
    vapi.on('speech-start', () => setIsSpeaking(true));
    vapi.on('speech-end', () => setIsSpeaking(false));
    vapi.on('message', (msg: any) => {
      if (msg.type === 'transcript' && msg.transcriptType === 'final') {
        const entry: TranscriptEntry = {
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.transcript,
          timestamp: new Date().toISOString(),
        };
        messagesRef.current = [...messagesRef.current, entry];
        setMessages([...messagesRef.current]);
      }
    });
    vapi.on('call-end', () => handleCallEnd());
    vapi.on('error', (e: any) => console.error('[Vapi] error:', JSON.stringify(e)));

    callStartRef.current = new Date();
    vapiCallIdRef.current = null;
    try {
      const callInfo = await vapi.start(VAPI_ASSISTANT_ID, {
        model: {
          provider: 'groq',
          model: GROQ_MODEL,
          messages: [{ role: 'system', content: DIFFICULTY_MODIFIERS[difficulty] + p.system_prompt }],
        },
        voice: { provider: '11labs', voiceId, model: 'eleven_flash_v2_5', speed: 1.07 },
        firstMessage: p.first_message,
        maxDurationSeconds: 600,
      } as any);
      if ((callInfo as any)?.id) vapiCallIdRef.current = (callInfo as any).id;
    } catch (e) {
      console.error('[Vapi] start failed:', e);
      setCallStatus('connecting');
    }
  };

  const handleEndCall = async () => {
    setCallStatus('ending');
    getVapi().stop();
  };

  const navigatedRef = useRef(false);
  const navigateToAssessment = (sessionId: string) => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    router.replace({
      pathname: '/(tabs)/train/assessment',
      params: { sessionId },
    });
  };

  const handleCallEnd = async () => {
    if (!persona) {
      console.warn('[CallEnd] No persona — navigating away anyway');
      navigateToAssessment('');
      return;
    }
    const transcript = messagesRef.current;

    // Hard ceiling: ALWAYS navigate within 6s. Save still happens in background.
    const failsafe = setTimeout(() => {
      console.warn('[CallEnd] Save failsafe fired — navigating without sessionId');
      navigateToAssessment('');
    }, 6000);

    // Save session immediately (no assessment yet) so it's never lost
    try {
      const { data: authData } = await Promise.race([
        supabase.auth.getUser(),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('auth timeout')), 3000)),
      ]);
      const userId = authData?.user?.id ?? null;

      let organizationId: string | null = null;
      if (userId) {
        try {
          const { data: profileData } = await Promise.race([
            supabase.from('users').select('organization_id').eq('auth_user_id', userId).single(),
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error('profile timeout')), 2000)),
          ]);
          organizationId = (profileData as any)?.organization_id ?? null;
        } catch (e) {
          console.warn('[CallEnd] Profile fetch timed out, continuing without org:', e);
        }
      }

      const insertPayload: any = {
        user_id: userId,
        organization_id: organizationId,
        persona_id: persona.id,
        persona_name: persona.name,
        persona_scenario_type: persona.scenario_type,
        transcript,
        assessment: null,
        vapi_call_id: vapiCallIdRef.current,
        started_at: callStartRef.current.toISOString(),
        ended_at: new Date().toISOString(),
      };

      const insertResult: any = await Promise.race([
        supabase.from('training_sessions').insert(insertPayload).select('id').single(),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('insert timeout')), 4000)),
      ]);
      if (insertResult?.error) console.error('[CallEnd] Insert error:', insertResult.error);
      const sessionId = (insertResult?.data as { id: string } | null)?.id ?? '';
      clearTimeout(failsafe);
      navigateToAssessment(sessionId);
    } catch (e) {
      console.error('[CallEnd] Save flow exception:', e);
      clearTimeout(failsafe);
      navigateToAssessment('');
    }
  };

  const speakerLabel = persona?.speaker_label ?? 'Contact';
  const personaInitials = persona?.name
    ? persona.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  if (!isVapiAvailable()) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="mic-off-outline" size={48} color={colors.textDim} />
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>
            Voice calls require a device build
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
            This feature isn't available in Expo Go. Install via TestFlight to make calls.
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeTop}>
        {/* Call header */}
        <View style={styles.header}>
          {/* Avatar + status */}
          <View style={styles.avatarSection}>
            <View style={[
              styles.avatarRing,
              callStatus === 'connected' && isSpeaking && styles.avatarRingActive,
            ]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{personaInitials}</Text>
              </View>
            </View>
            <Text style={styles.personaName} numberOfLines={1}>
              {persona?.name ?? 'Connecting…'}
            </Text>
            <View style={styles.statusRow}>
              {callStatus === 'connecting' && (
                <>
                  <ActivityIndicator color={colors.accentLight} size="small" />
                  <Text style={styles.statusText}>Connecting…</Text>
                </>
              )}
              {callStatus === 'connected' && (
                <>
                  <View style={[styles.liveDot, isSpeaking && styles.liveDotActive]} />
                  <Text style={styles.statusText}>
                    {isSpeaking ? `${speakerLabel} is speaking` : 'Your turn'}
                  </Text>
                </>
              )}
              {callStatus === 'ending' && (
                <>
                  <ActivityIndicator color={colors.textMuted} size="small" />
                  <Text style={styles.statusText}>Grading your call…</Text>
                </>
              )}
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* Live transcript */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <TranscriptMessage role={item.role} content={item.content} speakerLabel={speakerLabel} />
        )}
        contentContainerStyle={styles.transcript}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="chatbubbles-outline" size={32} color={colors.textDim} />
            <Text style={styles.emptyText}>Conversation will appear{`\n`}as you speak…</Text>
          </View>
        }
      />

      {/* End call */}
      <SafeAreaView style={styles.safeBottom}>
        <TouchableOpacity
          style={[styles.endButton, callStatus !== 'connected' && styles.endButtonDisabled]}
          onPress={handleEndCall}
          disabled={callStatus !== 'connected'}
          activeOpacity={0.8}
        >
          {callStatus === 'ending' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="call" size={26} color="#fff" />
          )}
          <Text style={styles.endButtonText}>
            {callStatus === 'ending' ? 'Saving…' : 'End Call'}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  safeTop: { backgroundColor: colors.bg },
  safeBottom: { backgroundColor: colors.bg, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },

  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },

  avatarSection: { alignItems: 'center', gap: spacing.sm },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  avatarRingActive: {
    borderColor: colors.accentLight,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: colors.text },
  personaName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statusText: { color: colors.textMuted, fontSize: 13 },
  liveDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.textDim,
  },
  liveDotActive: { backgroundColor: colors.scoreGreen },

  transcript: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  emptyWrap: { alignItems: 'center', marginTop: 60, gap: spacing.md },
  emptyText: {
    color: colors.textDim,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
  },

  endButton: {
    flexDirection: 'row',
    backgroundColor: colors.danger,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 56,
    marginBottom: spacing.sm,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  endButtonDisabled: { opacity: 0.4 },
  endButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
