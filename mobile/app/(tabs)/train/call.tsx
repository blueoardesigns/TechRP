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

    // 1. POST to /api/assess
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

    // 2. Save session to Supabase
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id')
      .eq('auth_user_id', user?.id)
      .single();
    const { data: session } = await supabase
      .from('training_sessions')
      .insert({
        user_id: user?.id,
        organization_id: profile?.organization_id,
        persona_id: persona.id,
        persona_name: persona.name,
        persona_scenario_type: persona.scenario_type,
        transcript,
        assessment,
        started_at: callStartRef.current.toISOString(),
        ended_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    // 3. Navigate to assessment
    router.replace({
      pathname: '/(tabs)/train/assessment',
      params: { sessionId: session?.id ?? '' },
    });
  };

  const speakerLabel = persona?.speaker_label ?? 'Contact';

  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        {callStatus === 'connecting' && (
          <>
            <ActivityIndicator color={colors.accent} size="small" />
            <Text style={styles.statusText}>Connecting...</Text>
          </>
        )}
        {callStatus === 'connected' && (
          <>
            <View style={[styles.dot, isSpeaking && styles.dotActive]} />
            <Text style={styles.statusText}>{isSpeaking ? `${speakerLabel} is speaking` : 'Listening...'}</Text>
          </>
        )}
        {callStatus === 'ending' && (
          <>
            <ActivityIndicator color={colors.textMuted} size="small" />
            <Text style={styles.statusText}>Saving session...</Text>
          </>
        )}
      </View>

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
          <Text style={styles.emptyText}>Conversation will appear here as you speak...</Text>
        }
      />

      <TouchableOpacity
        style={[styles.endButton, callStatus === 'ending' && styles.endButtonDisabled]}
        onPress={handleEndCall}
        disabled={callStatus !== 'connected'}
      >
        <Text style={styles.endButtonText}>End Call</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    gap: spacing.sm,
  },
  statusText: { color: colors.textMuted, fontSize: 13 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.textMuted,
  },
  dotActive: { backgroundColor: colors.scoreGreen },
  transcript: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  emptyText: {
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.xxl * 2,
    fontSize: 14,
    lineHeight: 20,
  },
  endButton: {
    margin: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  endButtonDisabled: { opacity: 0.5 },
  endButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
