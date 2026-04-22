import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Persona, TranscriptEntry } from '../../../lib/types';
import { getVapi } from '../../../lib/vapi';
import { VAPI_ASSISTANT_ID, GROQ_MODEL, pickVoice, getScenarioConfig } from '../../../lib/scenarios';
import TranscriptMessage from '../../../components/TranscriptMessage';
import { colors, spacing, radius } from '../../../lib/theme';

type CallStatus = 'connecting' | 'connected' | 'ending';

export default function CallScreen() {
  const { personaId } = useLocalSearchParams<{ personaId: string }>();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [messages, setMessages] = useState<TranscriptEntry[]>([]);
  const [callStatus, setCallStatus] = useState<CallStatus>('connecting');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const listRef = useRef<FlatList>(null);
  const messagesRef = useRef<TranscriptEntry[]>([]);
  const callStartRef = useRef<Date>(new Date());
  const router = useRouter();

  useEffect(() => {
    if (!personaId) return;
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

    vapi.on('call-start', () => setCallStatus('connected'));
    vapi.on('speech-start', () => setIsSpeaking(true));
    vapi.on('speech-end', () => setIsSpeaking(false));
    vapi.on('message', (msg: any) => {
      if (msg.type === 'transcript' && msg.transcriptType === 'final') {
        const entry: TranscriptEntry = {
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.transcript,
        };
        messagesRef.current = [...messagesRef.current, entry];
        setMessages([...messagesRef.current]);
      }
    });
    vapi.on('call-end', () => handleCallEnd());
    vapi.on('error', (e: Error) => console.error('Vapi error:', e));

    callStartRef.current = new Date();
    await vapi.start(VAPI_ASSISTANT_ID, {
      model: {
        provider: 'groq',
        model: GROQ_MODEL,
        messages: [{ role: 'system', content: p.system_prompt }],
      },
      voice: { provider: '11labs', voiceId, model: 'eleven_flash_v2_5' },
      firstMessage: p.first_message,
      maxDurationSeconds: 600,
    } as any);
  };

  const handleEndCall = async () => {
    setCallStatus('ending');
    getVapi().stop();
  };

  const handleCallEnd = async () => {
    if (!persona) return;
    const transcript = messagesRef.current;

    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    let assessment = null;
    try {
      const res = await fetch(`${baseUrl}/api/assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: transcript,
          persona: {
            name: persona.name,
            personalityType: persona.personality_type,
            scenarioType: persona.scenario_type,
            speakerLabel: persona.speaker_label,
          },
        }),
      });
      const json = await res.json();
      assessment = json.assessment;
    } catch (e) {
      console.error('Assessment failed:', e);
    }

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id')
      .eq('auth_user_id', userId ?? '')
      .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertPayload: any = {
      user_id: userId,
      organization_id: (profile as any)?.organization_id ?? null,
      persona_id: persona.id,
      persona_name: persona.name,
      persona_scenario_type: persona.scenario_type,
      transcript,
      assessment,
      started_at: callStartRef.current.toISOString(),
      ended_at: new Date().toISOString(),
    };
    const { data: sessionData } = await supabase
      .from('training_sessions')
      .insert(insertPayload)
      .select('id')
      .single();

    router.replace({
      pathname: '/(tabs)/train/assessment',
      params: { sessionId: (sessionData as { id: string } | null)?.id ?? '' },
    });
  };

  const speakerLabel = persona?.speaker_label ?? 'Contact';

  return (
    <View style={styles.container}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        {callStatus === 'connecting' && (
          <>
            <ActivityIndicator color={colors.accentLight} size="small" />
            <Text style={styles.statusText}>Connecting…</Text>
          </>
        )}
        {callStatus === 'connected' && (
          <>
            <View style={[styles.dot, isSpeaking && styles.dotActive]} />
            <Text style={styles.statusText}>
              {isSpeaking ? `${speakerLabel} is speaking` : 'Your turn — say something'}
            </Text>
          </>
        )}
        {callStatus === 'ending' && (
          <>
            <ActivityIndicator color={colors.textMuted} size="small" />
            <Text style={styles.statusText}>Grading your call…</Text>
          </>
        )}
        {persona && (
          <Text style={styles.personaChip} numberOfLines={1}>{persona.name}</Text>
        )}
      </View>

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
            <Text style={styles.emptyText}>Conversation will appear here as you speak…</Text>
          </View>
        }
      />

      {/* End call button */}
      <TouchableOpacity
        style={[styles.endButton, callStatus !== 'connected' && styles.endButtonDisabled]}
        onPress={handleEndCall}
        disabled={callStatus !== 'connected'}
        activeOpacity={0.85}
      >
        <Text style={styles.endButtonText}>
          {callStatus === 'ending' ? 'Saving…' : '📵  End Call'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
    minHeight: 52,
  },
  statusText: { color: colors.textMuted, fontSize: 13, flex: 1 },
  dot: {
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: colors.textDim,
  },
  dotActive: { backgroundColor: colors.scoreGreen },
  personaChip: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: 'hidden',
    maxWidth: 120,
  },

  transcript: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  emptyWrap: { alignItems: 'center', marginTop: 80 },
  emptyText: {
    color: colors.textDim,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 260,
  },

  endButton: {
    margin: spacing.lg,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    minHeight: 58,
    justifyContent: 'center',
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  endButtonDisabled: { opacity: 0.45 },
  endButtonText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
});
