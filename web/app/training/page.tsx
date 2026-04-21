'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Vapi from '@vapi-ai/web';
import { AppShell } from '@/components/app-shell';
import { saveTrainingSession, updateSessionAssessment, updateSessionRecording } from '@/lib/training-sessions';
import { generateAssessment } from '@/lib/assessment';
import {
  SCENARIOS,
  type ScenarioType,
  type ScenarioGroup,
  type Persona,
} from '@/lib/personas';
import { useAuth } from '@/components/auth-provider';

// DB persona shape (snake_case from API) mapped to Persona (camelCase)
interface DBPersona {
  id: string;
  scenario_type: ScenarioType;
  name: string;
  personality_type: string;
  brief_description: string;
  speaker_label: string;
  first_message: string;
  system_prompt: string;
  is_default: boolean;
  gender: 'male' | 'female';
}

function mapDBPersona(db: DBPersona): Persona {
  return {
    id: db.id,
    name: db.name,
    scenarioType: db.scenario_type,
    personalityType: db.personality_type,
    briefDescription: db.brief_description,
    speakerLabel: db.speaker_label,
    firstMessage: db.first_message,
    systemPrompt: db.system_prompt,
    gender: db.gender ?? 'female',
  };
}

const VAPI_ASSISTANT_ID = 'a2a54457-a2b0-4046-82b5-c7506ab9a401';

// Module-level singleton — KrispSDK (bundled inside @vapi-ai/web) registers itself
// globally and throws "KrispSDK is duplicated" if Vapi is instantiated more than once
// per page load. React 18 StrictMode double-invokes effects, so we guard here.
let _vapiSingleton: Vapi | null = null;
function getOrCreateVapi(): Vapi | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
  if (!publicKey) return null;
  if (!_vapiSingleton) {
    _vapiSingleton = new Vapi(publicKey);
  }
  return _vapiSingleton;
}
const GROQ_MODEL = 'llama-3.1-8b-instant';
const HAIKU_MODEL = 'claude-3-haiku-20240307';

// ElevenLabs voice pools — deterministic per persona so the same person always
// gets the same voice across sessions.
const VOICE_POOLS = {
  male:   ['burt', 'drew', 'josh', 'paul'],
  female: ['sarah', 'rachel', 'domi', 'bella'],
};

function pickVoice(persona: Persona): string {
  const pool = persona.gender === 'male' ? VOICE_POOLS.male : VOICE_POOLS.female;
  let hash = 0;
  for (let i = 0; i < persona.id.length; i++) {
    hash = (hash * 31 + persona.id.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}

type CallStatus = 'idle' | 'connecting' | 'connected';
type Phase = 'scenario-select' | 'persona-preview' | 'calling' | 'post-call';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const GROUP_LABELS: Record<ScenarioGroup, string> = {
  technician: 'Technician Scenarios',
  bizdev: 'Business Development',
};

// ─── Difficulty modifiers ─────────────────────────────────────────────────────

const DIFFICULTY_MODIFIERS: Record<'easy' | 'medium' | 'hard', string> = {
  easy: '[DIFFICULTY: EASY] Be cooperative and relatively easy to work with. Raise at most one minor objection before warming up to the conversation.\n\n',
  medium: '',
  hard: '[DIFFICULTY: HARD] Be highly skeptical and resistant. Raise 2–3 strong objections. Push back firmly before considering any agreement. Do not commit easily.\n\n',
};

type PaymentType = 'potential_claim' | 'self_pay' | 'random';

const PAYMENT_MODIFIERS: Record<'potential_claim' | 'self_pay', { call: string; facetime: string }> = {
  potential_claim: {
    call: '[PAYMENT TYPE: POTENTIAL CLAIM] This homeowner has contacted or is seriously considering contacting their insurance company about this damage. They may ask how claims work, whether you work with adjusters, what their deductible means for them, and how billing flows through insurance. Let those topics come up naturally based on their personality — do not volunteer a claim decision they have not yet made.\n\n',
    facetime: '[PAYMENT TYPE: POTENTIAL CLAIM] This homeowner has contacted or is seriously considering contacting their insurance company about this damage. They may ask how claims work, whether you work with adjusters, what their deductible means for them, and how billing flows through insurance. Let those topics come up naturally based on their personality — do not volunteer a claim decision they have not yet made.\n\n',
  },
  self_pay: {
    call: '[PAYMENT TYPE: SELF-PAY] This homeowner is paying out of pocket and is not filing an insurance claim. They may ask how much something like this typically costs, how payment works, or whether payment plans exist. They will not demand an exact price quote over the phone, but will express genuine curiosity about overall cost.\n\n',
    facetime: '[PAYMENT TYPE: SELF-PAY] This homeowner is paying out of pocket and is not filing an insurance claim. At a natural point in the conversation, directly ask the technician for a price or estimate. Be direct about wanting to understand the cost before committing.\n\n',
  },
};

function getPaymentModifier(type: PaymentType, scenarioType: ScenarioType): string {
  const resolved: 'potential_claim' | 'self_pay' = type === 'random'
    ? (Math.random() < 0.5 ? 'potential_claim' : 'self_pay')
    : type;
  const channel: 'call' | 'facetime' = scenarioType === 'homeowner_facetime' ? 'facetime' : 'call';
  return PAYMENT_MODIFIERS[resolved][channel];
}

const TIMING_INSTRUCTIONS = `

TIMING: This is a training call with a strict 10-minute limit. Around the 7 to 7.5 minute mark, naturally steer the conversation toward a close or a clear next step — even if the conversation isn't fully complete. If the call is going well at that point, push for commitment: agree to sign, schedule a follow-up appointment, or lock in a concrete next action before ending. Never let the call drift past 10 minutes without a resolution.`;

function getInterruptInstructions(personalityType: string): string {
  const pt = personalityType.toLowerCase();

  // Priority: hostile/angry > busy/rushed > analytical > default
  if (/skeptic|frustrat|angry|upset|irate|hostile|aggressive|pushy|difficult/.test(pt)) {
    return `

INTERRUPTION: You interrupt freely when the technician rambles, repeats themselves, or does not directly answer your question. Cut in mid-sentence with phrases like "Hold on—", "Wait, that's not what I asked", or "I'm going to stop you there." Do not wait for them to finish if you are frustrated.`;
  }

  if (/busy|dismiss|rushed|impatient|no.?time|distract/.test(pt)) {
    return `

INTERRUPTION: You have very limited time. If the technician doesn't get to the point within two or three sentences, cut in with "I need the short version" or "Can you just tell me the bottom line?" You interrupt when they repeat themselves or give you information you didn't ask for.`;
  }

  if (/analytical|engineer|detail|methodical|research/.test(pt)) {
    return `

INTERRUPTION: You occasionally cut in to ask a specific clarifying question when something is vague or doesn't add up. Don't let imprecise statements slide — interject with "What exactly does that mean?" or "Can you give me a specific number on that?"`;
  }

  return `

INTERRUPTION: You generally let the technician finish speaking. You may interject if they say something confusing or contradictory, but you are not naturally interruptive.`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TrainingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>('scenario-select');
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [vapi, setVapi] = useState<Vapi | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'assessing' | 'saved' | 'error'>('idle');
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  const [scenarioPersonas, setScenarioPersonas] = useState<DBPersona[]>([]);
  const [personasLoading, setPersonasLoading] = useState(false);
  const [personasError, setPersonasError] = useState<string | null>(null);

  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const difficultyRef = useRef<'easy' | 'medium' | 'hard'>('medium');

  const [paymentType, setPaymentType] = useState<PaymentType>('random');
  const paymentTypeRef = useRef<PaymentType>('random');

  const vapiRef = useRef<Vapi | null>(null);
  const callStartTimeRef = useRef<Date | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const vapiCallIdRef = useRef<string | null>(null);
  const selectedPersonaRef = useRef<Persona | null>(null);
  const userRef = useRef<typeof user>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const vapiInstance = getOrCreateVapi();
    if (!vapiInstance) { console.error('NEXT_PUBLIC_VAPI_PUBLIC_KEY is not set'); return; }

    vapiRef.current = vapiInstance;
    setVapi(vapiInstance);

    // Krisp (noise cancellation) throws an unhandled rejection when the mic is
    // unavailable. It's non-fatal — catch and suppress so the overlay doesn't appear.
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.name === 'KrispInitError' || String(event.reason).includes('Krisp')) {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    const handleError = (error: any) => {
      console.error('Vapi error:', error);
    };

    const handleCallStart = () => {
      callStartTimeRef.current = new Date();
      setCallStatus('connected');
      setSaveStatus('idle');
    };

    const handleCallEnd = () => {
      // Reset the Krisp noise-cancellation processor BEFORE the SDK calls
      // cleanup() → call.destroy(). Krisp holds a module-level processor
      // reference; if it's not explicitly disabled before destroy(), that
      // reference becomes null. The next session's start() then throws
      // "KrispInitError: Cannot read properties of null (reading 'disable')"
      // which Daily.co escalates to a fatal ejection ("Meeting has ended").
      // At this point (call-end fires before SDK cleanup), the Daily call
      // object is still accessible via the TS-private property.
      const dailyCall = vapiRef.current && (vapiRef.current as any).call;
      if (dailyCall?.updateInputSettings) {
        dailyCall.updateInputSettings({
          audio: { processor: { type: 'none' } },
        }).catch(() => {/* non-critical — proceed regardless */});
      }

      setCallStatus('idle');
      if (callStartTimeRef.current) {
        const startedAt = callStartTimeRef.current;
        callStartTimeRef.current = null;
        handleSaveSession(startedAt, new Date());
      } else {
        // Call ended before connecting (e.g. mic not available) — go back so
        // the user can try again rather than getting stuck on the calling phase.
        setPhase('persona-preview');
      }
    };

    const handleMessage = (message: any) => {
      if (message.type === 'transcript' && message.transcriptType === 'final') {
        const role = message.role || (message.from === 'user' ? 'user' : 'assistant');
        const content = message.transcript || message.content || message.text || '';
        if (content) {
          const timestamp = message.timestamp
            ? (message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp))
            : new Date();
          const newMessage: Message = { role: role as 'user' | 'assistant', content, timestamp };
          setMessages(prev => {
            const updated = [...prev, newMessage];
            messagesRef.current = updated;
            return updated;
          });
        }
      }
    };

    vapiInstance.on('error', handleError);
    vapiInstance.on('call-start', handleCallStart);
    vapiInstance.on('call-end', handleCallEnd);
    vapiInstance.on('message', handleMessage);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      // Remove named handlers so StrictMode re-mount doesn't stack duplicate listeners.
      // Do NOT stop() the singleton here — it persists for the page's lifetime.
      vapiInstance.off('error', handleError);
      vapiInstance.off('call-start', handleCallStart);
      vapiInstance.off('call-end', handleCallEnd);
      vapiInstance.off('message', handleMessage);
    };
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keep persona ref in sync
  useEffect(() => { selectedPersonaRef.current = selectedPersona; }, [selectedPersona]);

  // Keep difficulty ref in sync
  useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);

  // Keep payment type ref in sync
  useEffect(() => { paymentTypeRef.current = paymentType; }, [paymentType]);

  // Keep user ref in sync so call-end handler always has the current user
  useEffect(() => { userRef.current = user; }, [user]);

  const handleSelectScenario = async (type: ScenarioType) => {
    setPersonasLoading(true);
    setPersonasError(null);
    try {
      const res = await fetch(`/api/personas?scenario_type=${type}`);
      const data = await res.json();
      const personas: DBPersona[] = data.personas || [];
      setScenarioPersonas(personas);
      if (personas.length === 0) {
        setPersonasError('No personas available for this scenario. Run /api/seed to populate default personas.');
        return;
      }
      const random = personas[Math.floor(Math.random() * personas.length)];
      setSelectedPersona(mapDBPersona(random));
      setPaymentType('random');
      setPhase('persona-preview');
    } catch (err) {
      console.error('Failed to load personas:', err);
      setPersonasError('Failed to load personas. Please try again.');
    } finally {
      setPersonasLoading(false);
    }
  };

  const handlePickDifferent = () => {
    if (!selectedPersona || scenarioPersonas.length === 0) return;
    const others = scenarioPersonas.filter(p => p.id !== selectedPersona.id);
    const pool = others.length > 0 ? others : scenarioPersonas;
    setSelectedPersona(mapDBPersona(pool[Math.floor(Math.random() * pool.length)]));
  };

  const handleStartCall = async () => {
    if (!vapiRef.current || !selectedPersona) return;
    try {
      setPhase('calling');
      setCallStatus('connecting');
      setMessages([]);
      messagesRef.current = [];
      vapiCallIdRef.current = null;
      setSaveStatus('idle');

      const voiceId = pickVoice(selectedPersona);
      const scenarioConfig = SCENARIOS.find(s => s.type === selectedPersona.scenarioType)!;
      const systemPrompt =
        DIFFICULTY_MODIFIERS[difficultyRef.current] +
        (scenarioConfig.group === 'technician'
          ? getPaymentModifier(paymentTypeRef.current, selectedPersona.scenarioType)
          : '') +
        selectedPersona.systemPrompt +
        TIMING_INSTRUCTIONS +
        getInterruptInstructions(selectedPersona.personalityType);

      const sharedOverrides = {
        voice: { provider: '11labs', voiceId, model: 'eleven_flash_v2_5' },
        firstMessage: selectedPersona.firstMessage,
        maxDurationSeconds: 600,
        stopSpeakingPlan: {
          numWords: 0,         // use VAD (voice activity detection) instead of word count
          voiceSeconds: 0.1,   // detect interrupt after 0.1s of speech (more responsive than default 0.2)
          backoffSeconds: 0.5, // wait 0.5s before resuming after interrupted (tighter than default 1s)
        },
      };

      const groqModel = {
        provider: 'groq',
        model: GROQ_MODEL,
        messages: [{ role: 'system', content: systemPrompt }],
      };

      const haikuModel = {
        provider: 'anthropic',
        model: HAIKU_MODEL,
        messages: [{ role: 'system', content: systemPrompt }],
      };

      let callInfo: any;
      try {
        callInfo = await vapiRef.current.start(VAPI_ASSISTANT_ID, {
          model: groqModel,
          ...sharedOverrides,
        } as any);
      } catch (groqError) {
        // Only fall back if the error is likely a Groq provider/model issue.
        // Errors from bad voiceId, VAPI_ASSISTANT_ID, or SDK config will fail
        // on Haiku too — don't silently double-fail in those cases.
        const shouldFallback = groqError instanceof Error
          ? /groq|model|provider|rate.?limit|unavailable/i.test(groqError.message)
          : true; // non-Error SDK throws: default to fallback (conservative, safe choice)

        if (!shouldFallback) throw groqError; // re-throw to outer catch

        console.warn('[Groq fallback] Groq failed to start, falling back to Claude Haiku 3:', groqError);
        callInfo = await vapiRef.current.start(VAPI_ASSISTANT_ID, {
          model: haikuModel,
          ...sharedOverrides,
        } as any);
        console.info('[Groq fallback] Successfully started call with Claude Haiku 3 fallback');
      }

      if (callInfo?.id) {
        vapiCallIdRef.current = callInfo.id;
      }
    } catch (error) {
      console.error('Error starting call:', error);
      alert('Failed to start call. Please check the console.');
      setCallStatus('idle');
      setPhase('persona-preview');
    }
  };

  const handleEndCall = async () => {
    if (!vapiRef.current) return;
    try {
      // Disable Krisp processor before stop() → destroy() so its module-level
      // state is cleanly null (not stale) for the next session. If the AI
      // already ended the call, handleCallEnd will have done this; the double
      // call is a harmless no-op.
      const dailyCall = (vapiRef.current as any).call;
      if (dailyCall?.updateInputSettings) {
        await dailyCall.updateInputSettings({
          audio: { processor: { type: 'none' } },
        }).catch(() => {});
      }
      await vapiRef.current.stop();
    } catch (error) {
      console.error('Error ending call:', error);
      if (callStartTimeRef.current) {
        await handleSaveSession(callStartTimeRef.current, new Date());
        callStartTimeRef.current = null;
      }
    }
  };

  const handleSaveSession = async (startedAt: Date, endedAt: Date) => {
    const persona = selectedPersonaRef.current;

    // Skip sessions under 30 seconds — accidental taps or failed connections.
    const durationSecs = (endedAt.getTime() - startedAt.getTime()) / 1000;
    if (durationSecs < 30) {
      setPhase('persona-preview');
      return;
    }

    try {
      setSaveStatus('saving');
      const messagesToSave = messagesRef.current.length > 0 ? messagesRef.current : messages;

      const currentUser = userRef.current;
      const session = await saveTrainingSession({
        userId: currentUser?.id || null,
        organizationId: currentUser?.organizationId || null,
        transcript: JSON.stringify(messagesToSave),
        startedAt,
        endedAt,
        personaId: persona?.id ?? null,
        personaName: persona?.name ?? null,
        personaScenarioType: persona?.scenarioType ?? null,
      });

      sessionIdRef.current = session.id;
      setLastSessionId(session.id);

      if (messagesToSave.length > 0) {
        setSaveStatus('assessing');
        try {
          const assessment = await generateAssessment(messagesToSave, persona ?? undefined);
          await updateSessionAssessment(session.id, JSON.stringify(assessment));
        } catch (err) { console.error('Assessment error:', err); }
      }

      if (vapiCallIdRef.current) {
        try {
          const rec = await fetch('/api/recording', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callId: vapiCallIdRef.current }),
          });
          const recData = rec.ok ? await rec.json() : null;
          await updateSessionRecording(session.id, recData?.recordingUrl || null, vapiCallIdRef.current);
        } catch {
          try { await updateSessionRecording(session.id, null, vapiCallIdRef.current!); } catch {}
        }
      }

      setSaveStatus('saved');
      setPhase('post-call');
    } catch (error) {
      console.error('Error saving session:', error);
      setSaveStatus('error');
    }
  };

  // Filter scenarios to those the user has access to
  const accessibleScenarios = user?.scenarioAccess?.length
    ? SCENARIOS.filter(s => user.scenarioAccess.includes(s.type))
    : SCENARIOS;

  const techScenarios = accessibleScenarios.filter(s => s.group === 'technician');

  // BD grouped by company type — each group has a cold call + discovery variant
  const BD_COMPANY_GROUPS = [
    { label: 'Residential Property Manager', icon: '🏠', coldType: 'property_manager' as ScenarioType, discoveryType: 'property_manager_discovery' as ScenarioType },
    { label: 'Commercial Property Manager',  icon: '🏢', coldType: 'commercial_property_manager' as ScenarioType, discoveryType: 'commercial_pm_discovery' as ScenarioType },
    { label: 'Insurance Broker',             icon: '📋', coldType: 'insurance_broker' as ScenarioType, discoveryType: 'insurance_broker_discovery' as ScenarioType },
    { label: 'Plumber',                      icon: '🪠', coldType: 'plumber_bd' as ScenarioType, discoveryType: 'plumber_bd_discovery' as ScenarioType },
  ].map(g => ({
    ...g,
    cold:      accessibleScenarios.find(s => s.type === g.coldType) ?? null,
    discovery: accessibleScenarios.find(s => s.type === g.discoveryType) ?? null,
  })).filter(g => g.cold || g.discovery);

  // ── Phase: Setup (scenario-select + persona-preview) ──────────────────────

  if (phase === 'scenario-select' || phase === 'persona-preview') {
    return (
      <AppShell>
        <div className="px-6 pt-8 pb-12 max-w-3xl mx-auto">
          <h1 className="text-xl font-bold text-white">Start a training call</h1>
          <p className="text-sm text-slate-400 mt-1">Choose your scenario and we&apos;ll assign a matching persona</p>

          <div className="mt-8 space-y-8">
            {/* Technician Scenarios */}
            {techScenarios.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-3">
                  Technician Scenarios
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {techScenarios.map((scenario) => (
                    <button
                      key={scenario.type}
                      onClick={() => handleSelectScenario(scenario.type)}
                      disabled={personasLoading}
                      className={`text-left rounded-xl border p-4 transition-colors disabled:opacity-50 disabled:cursor-wait ${
                        selectedPersona?.scenarioType === scenario.type
                          ? 'bg-sky-500/10 border-sky-500/40 text-white'
                          : 'bg-[#0f172a] border-white/[0.08] hover:border-white/20 text-slate-300'
                      }`}
                    >
                      <span className="text-2xl block mb-2">{scenario.icon}</span>
                      <span className="text-sm font-semibold block">{scenario.label}</span>
                      <span className="text-xs text-slate-500 block mt-0.5">{scenario.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Business Development — grouped by company type */}
            {BD_COMPANY_GROUPS.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-3">
                  Business Development
                </p>
                <div className="space-y-4">
                  {BD_COMPANY_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="text-[10px] text-slate-600 mb-2">{group.icon} {group.label}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {group.cold && (
                          <button
                            onClick={() => handleSelectScenario(group.cold!.type)}
                            disabled={personasLoading}
                            className={`text-left rounded-xl border p-4 transition-colors disabled:opacity-50 disabled:cursor-wait ${
                              selectedPersona?.scenarioType === group.cold.type
                                ? 'bg-sky-500/10 border-sky-500/40 text-white'
                                : 'bg-[#0f172a] border-white/[0.08] hover:border-white/20 text-slate-300'
                            }`}
                          >
                            <span className="text-2xl block mb-2">{group.cold.icon}</span>
                            <span className="text-sm font-semibold block">Cold Call</span>
                            <span className="text-xs text-slate-500 block mt-0.5">{group.cold.description}</span>
                          </button>
                        )}
                        {group.discovery && (
                          <button
                            onClick={() => handleSelectScenario(group.discovery!.type)}
                            disabled={personasLoading}
                            className={`text-left rounded-xl border p-4 transition-colors disabled:opacity-50 disabled:cursor-wait ${
                              selectedPersona?.scenarioType === group.discovery.type
                                ? 'bg-sky-500/10 border-sky-500/40 text-white'
                                : 'bg-[#0f172a] border-white/[0.08] hover:border-white/20 text-slate-300'
                            }`}
                          >
                            <span className="text-2xl block mb-2">{group.discovery.icon}</span>
                            <span className="text-sm font-semibold block">Discovery Meeting</span>
                            <span className="text-xs text-slate-500 block mt-0.5">{group.discovery.description}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {personasLoading && (
              <p className="text-sm text-slate-500 animate-pulse text-center py-2">Loading personas…</p>
            )}
            {personasError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                {personasError}
              </p>
            )}

            {/* Setup card — only when persona-preview phase and a persona is selected */}
            {phase === 'persona-preview' && selectedPersona && (() => {
              const scenario = SCENARIOS.find(s => s.type === selectedPersona.scenarioType)!;
              return (
                <div className="bg-[#0f172a] border border-white/[0.08] rounded-xl p-6 max-w-md space-y-5">
                  {/* Difficulty */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2">Difficulty</p>
                    <div className="flex gap-2">
                      {(['easy', 'medium', 'hard'] as const).map(d => (
                        <button
                          key={d}
                          onClick={() => setDifficulty(d)}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize border transition-colors cursor-pointer ${
                            difficulty === d
                              ? d === 'easy'   ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : d === 'medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                               : 'bg-red-500/20 text-red-400 border-red-500/40'
                              : 'text-slate-600 border-white/[0.08] hover:text-slate-300'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment type — technician scenarios only */}
                  {scenario.group === 'technician' && (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2">Payment Type</p>
                      <div className="flex gap-2">
                        {([
                          { value: 'potential_claim' as const, label: 'Insurance' },
                          { value: 'self_pay' as const, label: 'Self Pay' },
                          { value: 'random' as const, label: 'Random' },
                        ]).map(({ value, label }) => (
                          <button
                            key={value}
                            onClick={() => setPaymentType(value)}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                              paymentType === value
                                ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                                : 'text-slate-600 border-white/[0.08] hover:text-slate-300'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Persona preview row */}
                  <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-sky-400">
                          {selectedPersona.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white leading-none">{selectedPersona.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{selectedPersona.speakerLabel}</p>
                      </div>
                    </div>
                    {scenarioPersonas.length > 1 && (
                      <button
                        onClick={handlePickDifferent}
                        className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        ↺ Randomize
                      </button>
                    )}
                  </div>

                  {/* Start Call CTA */}
                  <button
                    onClick={handleStartCall}
                    disabled={!vapi}
                    className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Start Call
                  </button>

                  {/* Change scenario */}
                  <button
                    onClick={() => { setPhase('scenario-select'); setSelectedPersona(null); }}
                    className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    ← Change Scenario
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      </AppShell>
    );
  }

  // ── Phase: Calling ─────────────────────────────────────────────────────────

  if (phase === 'calling' && selectedPersona) {
    const isConnecting = callStatus === 'connecting';
    const isConnected = callStatus === 'connected';
    const waveHeights = [6, 14, 22, 18, 28, 20, 26, 14, 22, 10, 18, 28, 16, 8];

    return (
      <div
        className="flex flex-col h-screen bg-[#020617] text-white"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {/* Top bar */}
        <div className="h-11 bg-[#020617] border-b border-white/[0.06] flex items-center justify-between px-5 shrink-0">
          {/* Left: logo */}
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
              <rect width="18" height="18" rx="5" fill="url(#logoGrad)" />
            </svg>
            <span className="text-xs font-bold text-white">TechRP</span>
          </div>

          {/* Center: status pill */}
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 border ${
            isConnected
              ? 'bg-emerald-500/15 border-emerald-500/25'
              : isConnecting
              ? 'bg-amber-500/15 border-amber-500/25'
              : 'bg-slate-800/50 border-white/[0.06]'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? 'bg-emerald-400 animate-pulse' :
              isConnecting ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'
            }`} />
            <span className={`text-[10px] font-semibold ${
              isConnected ? 'text-emerald-400' :
              isConnecting ? 'text-amber-400' : 'text-slate-500'
            }`}>
              {isConnected ? 'Connected' : isConnecting ? 'Connecting…' : 'Idle'}
            </span>
          </div>

          {/* Right: back link */}
          <button
            onClick={() => { setPhase('scenario-select'); setSelectedPersona(null); }}
            className="text-[10px] text-slate-500 hover:text-white transition-colors cursor-pointer"
          >
            ← Back to dashboard
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left panel */}
          <div className="w-[42%] shrink-0 border-r border-white/[0.08] flex flex-col items-center justify-center gap-5 p-6 bg-[#020617]">
            {/* Persona avatar */}
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-500/25 to-indigo-500/25 border-2 border-sky-500/40 flex items-center justify-center">
                <span className="text-2xl font-extrabold text-white">
                  {selectedPersona.name.charAt(0)}
                </span>
              </div>
              <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#020617]" />
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold text-white">{selectedPersona.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{selectedPersona.speakerLabel}</p>
            </div>

            {/* Waveform */}
            <div className="flex items-end gap-[3px] h-8">
              {waveHeights.map((h, i) => (
                <div
                  key={i}
                  className="w-1 rounded-sm bg-sky-500 transition-opacity"
                  style={{
                    height: `${h}px`,
                    opacity: isConnected ? (i % 3 === 0 ? 0.9 : i % 3 === 1 ? 0.7 : 0.6) : 0.2,
                  }}
                />
              ))}
            </div>

            {/* Status pill */}
            <span className="text-[10px] text-slate-500 bg-slate-800 px-3 py-1.5 rounded-full">
              {isConnecting
                ? 'Connecting…'
                : isConnected
                ? `${selectedPersona.name} is speaking…`
                : 'Call ended'}
            </span>

            {/* End Call button */}
            <button
              onClick={handleEndCall}
              disabled={callStatus === 'idle'}
              className="w-full max-w-[200px] py-2.5 bg-red-500/10 border border-red-500/25 text-red-400 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-red-500/20"
            >
              End Call
            </button>
          </div>

          {/* Right panel — transcript */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#0a1628]">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Live Transcript</span>
              <span className="text-[10px] text-slate-600">Auto-scrolling</span>
            </div>

            {/* Bubble feed */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {messages.length === 0 ? (
                <p className="text-xs text-slate-600 text-center mt-8 animate-pulse">
                  {isConnecting
                    ? `Connecting to ${selectedPersona.name}…`
                    : 'Waiting for the conversation to begin…'}
                </p>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[78%] px-3 py-2 ${
                      msg.role === 'user'
                        ? 'bg-sky-500/15 border border-sky-500/20 rounded-xl rounded-br-none'
                        : 'bg-slate-800 border border-white/[0.06] rounded-xl rounded-bl-none'
                    }`}>
                      <p className={`text-[9px] font-semibold mb-1 ${
                        msg.role === 'user' ? 'text-emerald-400' : 'text-sky-400'
                      }`}>
                        {msg.role === 'user' ? 'You' : selectedPersona.name}
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: Post-call ───────────────────────────────────────────────────────

  if (phase === 'post-call') {
    return (
      <AppShell>
        <div className="px-6 pt-8 pb-12 max-w-lg mx-auto">
          <div className="bg-[#0f172a] border border-white/[0.08] rounded-xl p-8 text-center space-y-5">
            {/* Score ring placeholder */}
            <div className="mx-auto w-20 h-20 rounded-full bg-sky-500/10 border-2 border-sky-500/30 flex items-center justify-center">
              <span className="text-2xl">✓</span>
            </div>
            {saveStatus === 'saving'    && <p className="text-sm text-amber-400 animate-pulse">Saving session…</p>}
            {saveStatus === 'assessing' && <p className="text-sm text-sky-400 animate-pulse">Analyzing your session…</p>}
            {saveStatus === 'error'     && <p className="text-sm text-red-400">Save failed. Check console.</p>}
            <div>
              <h2 className="text-xl font-bold text-white">Session Complete</h2>
              <p className="text-sm text-slate-400 mt-1">Your session has been saved and assessed by AI.</p>
            </div>
            <div className="space-y-3 pt-2">
              {lastSessionId && (
                <a
                  href={`/sessions/${lastSessionId}`}
                  className="block w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-sm transition-colors"
                >
                  View full session →
                </a>
              )}
              <button
                onClick={() => {
                  setPhase('scenario-select');
                  setSelectedPersona(null);
                  setMessages([]);
                  messagesRef.current = [];
                  setSaveStatus('idle');
                  setLastSessionId(null);
                }}
                className="w-full py-3 bg-transparent border border-white/[0.08] text-slate-300 hover:text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                Start another
              </button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return null;
}
