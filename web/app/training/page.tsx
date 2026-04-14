'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Vapi from '@vapi-ai/web';
import { saveTrainingSession, updateSessionAssessment, updateSessionRecording } from '@/lib/training-sessions';
import { generateAssessment } from '@/lib/assessment';
import {
  SCENARIOS,
  type ScenarioType,
  type ScenarioGroup,
  type ScenarioConfig,
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

// ─── Scenario card ────────────────────────────────────────────────────────────

function ScenarioCard({
  scenario,
  onSelect,
  disabled,
  labelOverride,
}: {
  scenario: ScenarioConfig;
  onSelect: (type: ScenarioType) => void;
  disabled: boolean;
  labelOverride?: string;
}) {
  const isDiscovery = scenario.callType === 'discovery';
  return (
    <button
      onClick={() => onSelect(scenario.type)}
      disabled={disabled}
      className="group relative text-left bg-gray-900 border border-white/10 hover:border-white/30 rounded-2xl p-6 transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:cursor-wait"
    >
      {/* Hover accent bar */}
      <div className={`absolute top-0 left-6 right-6 h-0.5 rounded-full bg-gradient-to-r ${isDiscovery ? 'from-indigo-500 to-violet-500' : 'from-blue-500 to-indigo-500'} opacity-0 group-hover:opacity-100 transition-opacity`} />
      {/* Call type badge */}
      <div className="absolute top-4 right-4">
        <span className={`text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-full border ${isDiscovery ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>
          {isDiscovery ? 'Discovery' : 'Cold Call'}
        </span>
      </div>
      <div className="text-3xl mb-3">{scenario.icon}</div>
      <h3 className={`font-semibold text-white mb-1 transition-colors pr-16 ${isDiscovery ? 'group-hover:text-indigo-400' : 'group-hover:text-blue-400'}`}>
        {labelOverride ?? scenario.label}
      </h3>
      <p className="text-sm text-gray-500 leading-relaxed pr-2">{scenario.description}</p>
      <p className={`text-xs mt-3 font-medium opacity-0 group-hover:opacity-100 transition-opacity ${isDiscovery ? 'text-indigo-400' : 'text-blue-400'}`}>
        Select →
      </p>
    </button>
  );
}

// ─── Shared nav header ────────────────────────────────────────────────────────

function PageHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <header className="border-b border-white/10 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 sm:px-10 h-14 flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-white transition-colors">
          ← TechRP
        </button>
        <h1 className="text-sm font-semibold text-white">{title}</h1>
        <div className="w-20" />
      </div>
    </header>
  );
}

// ─── Difficulty modifiers ─────────────────────────────────────────────────────

const DIFFICULTY_MODIFIERS: Record<'easy' | 'medium' | 'hard', string> = {
  easy: '[DIFFICULTY: EASY] Be cooperative and relatively easy to work with. Raise at most one minor objection before warming up to the conversation.\n\n',
  medium: '',
  hard: '[DIFFICULTY: HARD] Be highly skeptical and resistant. Raise 2–3 strong objections. Push back firmly before considering any agreement. Do not commit easily.\n\n',
};

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
      const systemPrompt =
        DIFFICULTY_MODIFIERS[difficultyRef.current] +
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

  // ── Phase: Scenario Selection ──────────────────────────────────────────────

  if (phase === 'scenario-select') {
    if (user?.scenarioAccess?.length && !accessibleScenarios.length) {
      return (
        <div className="min-h-screen bg-gray-950 text-white">
          <PageHeader onBack={() => router.push('/')} title="Start Training" />
          <div className="py-20 text-center text-gray-500">
            <p>No training scenarios are available for your account.</p>
            <p className="text-sm mt-2">Contact your admin to get access.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <PageHeader onBack={() => router.push('/')} title="Start Training" />

        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 space-y-10">

          {/* Technician Scenarios */}
          {techScenarios.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-4">
                Technician Scenarios
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {techScenarios.map((scenario) => (
                  <ScenarioCard
                    key={scenario.type}
                    scenario={scenario}
                    onSelect={handleSelectScenario}
                    disabled={personasLoading}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Business Development — grouped by company type */}
          {BD_COMPANY_GROUPS.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-5">
                Business Development
              </p>
              <div className="space-y-6">
                {BD_COMPANY_GROUPS.map((group) => (
                  <div key={group.label}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-px flex-1 bg-white/10" />
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-widest">
                        {group.icon} {group.label}
                      </span>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {group.cold && (
                        <ScenarioCard
                          key={group.cold.type}
                          scenario={group.cold}
                          labelOverride="Cold Call"
                          onSelect={handleSelectScenario}
                          disabled={personasLoading}
                        />
                      )}
                      {group.discovery && (
                        <ScenarioCard
                          key={group.discovery.type}
                          scenario={group.discovery}
                          labelOverride="Discovery Meeting"
                          onSelect={handleSelectScenario}
                          disabled={personasLoading}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {personasLoading && (
            <div className="text-center py-4 text-sm text-gray-500 animate-pulse">
              Loading personas…
            </div>
          )}
          {personasError && (
            <div className="text-center py-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4">
              {personasError}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Phase: Persona Preview ─────────────────────────────────────────────────

  if (phase === 'persona-preview' && selectedPersona) {
    const scenario = SCENARIOS.find(s => s.type === selectedPersona.scenarioType)!;

    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <PageHeader onBack={() => setPhase('scenario-select')} title={scenario.label} />

        <div className="max-w-xl mx-auto px-8 py-12">
          {/* Scenario badge */}
          <div className="flex items-center gap-2 mb-8">
            <span className="text-2xl">{scenario.icon}</span>
            <span className="text-sm font-medium text-gray-400">{scenario.label}</span>
          </div>

          <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-2">
            You&apos;ll be speaking with
          </p>
          <h2 className="text-3xl font-bold text-white mb-6">
            {selectedPersona.name}
          </h2>

          {/* Persona card */}
          <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-white/10">
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                {selectedPersona.speakerLabel}
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">They say:</p>
              <p className="text-gray-200 text-sm italic leading-relaxed">
                &ldquo;{selectedPersona.firstMessage}&rdquo;
              </p>
            </div>
          </div>

          {/* Your role */}
          <div className="flex items-start gap-3 bg-blue-600/10 border border-blue-500/20 rounded-xl px-4 py-3 mb-8">
            <span className="text-blue-400 text-lg mt-0.5">👤</span>
            <div>
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-0.5">Your Role</p>
              <p className="text-sm text-white font-medium">{scenario.techRole}</p>
            </div>
          </div>

          {/* Difficulty */}
          <div className="mb-8">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Difficulty</p>
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-colors border ${
                    difficulty === d
                      ? d === 'easy'   ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : d === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                                       : 'bg-red-500/20 text-red-400 border-red-500/40'
                      : 'bg-transparent text-gray-600 border-white/10 hover:border-white/20 hover:text-gray-400'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleStartCall}
              disabled={!vapi}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Training Call
            </button>
            {scenarioPersonas.length > 1 && (
              <button
                onClick={handlePickDifferent}
                className="w-full py-2.5 text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/25 rounded-xl transition-colors"
              >
                Try a Different Person →
              </button>
            )}
            <button
              onClick={() => setPhase('scenario-select')}
              className="w-full py-2 text-sm text-gray-600 hover:text-gray-400 transition-colors"
            >
              ← Change Scenario
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: Calling ─────────────────────────────────────────────────────────

  if (phase === 'calling' && selectedPersona) {
    const scenario = SCENARIOS.find(s => s.type === selectedPersona.scenarioType)!;
    const isConnecting = callStatus === 'connecting';
    const isConnected = callStatus === 'connected';

    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        {/* Call header */}
        <header className="border-b border-white/10 bg-gray-950/90 backdrop-blur shrink-0">
          <div className="max-w-3xl mx-auto px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">{scenario.icon}</span>
              <div>
                <p className="text-sm font-semibold text-white">{selectedPersona.name}</p>
                <p className="text-xs text-gray-500">{scenario.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Status indicator */}
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse' :
                  isConnecting ? 'bg-yellow-400 animate-pulse' : 'bg-gray-500'
                }`} />
                <span className={`text-xs font-medium ${
                  isConnected ? 'text-emerald-400' :
                  isConnecting ? 'text-yellow-400' : 'text-gray-500'
                }`}>
                  {isConnected ? 'Live' : isConnecting ? 'Connecting…' : 'Ended'}
                </span>
                {/* Difficulty badge */}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                  difficulty === 'easy'   ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                  difficulty === 'hard'   ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                         : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                } capitalize`}>
                  {difficulty}
                </span>
              </div>
              {/* Save status */}
              {saveStatus === 'saving' && <span className="text-xs text-yellow-400">Saving…</span>}
              {saveStatus === 'assessing' && <span className="text-xs text-blue-400">Analyzing…</span>}
              {saveStatus === 'error' && <span className="text-xs text-red-400">Save failed</span>}
            </div>
          </div>
        </header>

        {/* Transcript */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-6 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-20 text-gray-600">
                {isConnecting ? (
                  <p className="animate-pulse text-sm">Connecting to {selectedPersona.name}…</p>
                ) : (
                  <p className="text-sm">Waiting for the conversation to begin…</p>
                )}
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-gray-800 text-gray-100 rounded-bl-sm'
                  }`}>
                    <p className="text-xs font-semibold mb-1 opacity-60">
                      {msg.role === 'user' ? scenario.techRole : selectedPersona.speakerLabel}
                    </p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* End call footer */}
        <div className="shrink-0 border-t border-white/10 bg-gray-950/90 backdrop-blur">
          <div className="max-w-3xl mx-auto px-8 py-4 flex items-center justify-center gap-4">
            {callStatus !== 'idle' ? (
              <button
                onClick={handleEndCall}
                className="flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                <span className="w-2 h-2 bg-white rounded-full" />
                End Call
              </button>
            ) : (
              <p className="text-sm text-gray-500">Call ended — saving your session…</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: Post-call ───────────────────────────────────────────────────────

  if (phase === 'post-call') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-8">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
            <span className="text-3xl">✓</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Session Complete</h2>
            <p className="text-gray-400 text-sm">Your session has been saved and assessed by AI.</p>
          </div>

          <div className="space-y-3 pt-2">
            {lastSessionId && (
              <button
                onClick={() => router.push(`/sessions/${lastSessionId}`)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
              >
                View Assessment →
              </button>
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
              className="w-full py-3 bg-gray-900 hover:bg-gray-800 border border-white/10 text-white font-medium rounded-xl transition-colors"
            >
              Train Again
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
