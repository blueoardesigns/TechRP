import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase-server';
import { createServiceRoleClient as createServiceSupabase } from '@/lib/supabase';
import { ShareDialog } from './share-dialog';
import { RecordingPlayer } from './recording-player';
import { CoachNotes } from './coach-notes';
import { notFound } from 'next/navigation';
import { getDisplayScore, type Assessment } from '@/lib/scoring';
import { AppShell } from '@/components/app-shell';
import { SectionCard } from '@/components/ui/section-card';
import { ScoreBadge } from '@/components/ui/score-badge';

async function getSession(id: string) {
  try {
    const supabase = createServiceSupabase();
    const { data, error } = await (supabase as any)
      .from('training_sessions')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

async function getPlaybookForScenario(scenarioType: string | null) {
  if (!scenarioType) return null;
  try {
    const supabase = createServiceSupabase();
    const { data } = await (supabase as any)
      .from('playbooks')
      .select('name, content')
      .eq('scenario_type', scenarioType)
      .is('coach_instance_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabaseAuth = createServerSupabase();
    const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
    if (!authUser) return null;
    const svc = createServiceSupabase();
    const { data } = await (svc as any).from('users').select('id').eq('auth_user_id', authUser.id).single();
    return (data as any)?.id ?? null;
  } catch {
    return null;
  }
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return 'Ongoing';
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

function formatDateTime(d: string): string {
  return new Date(d).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface Message { role: 'user' | 'assistant'; content: string; timestamp?: string; }

function parseAssessment(a: string | null): Assessment | null {
  if (!a) return null;
  try { return JSON.parse(a); } catch { return null; }
}

function parseTranscript(t: string | null): Message[] {
  if (!t) return [];
  try {
    const p = JSON.parse(t);
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}

export default async function SessionDetailPage({ params, searchParams }: { params: { id: string }; searchParams?: { back?: string } }) {
  const session = await getSession(params.id);
  if (!session) notFound();
  const playbook = await getPlaybookForScenario((session as any).persona_scenario_type ?? null);
  const currentUserId = await getCurrentUserId();
  const isOwner = !!(currentUserId && currentUserId === (session as any).user_id);

  const messages = parseTranscript(session.transcript);
  const assessment = parseAssessment(session.assessment);
  const personaName = (session as any).persona_name;
  const scenarioType = (session as any).persona_scenario_type;

  const backHref = searchParams?.back ?? '/sessions';
  const backLabel = backHref.startsWith('/coach') ? '← Coach Hub' : '← Sessions';

  const displayScore = assessment ? getDisplayScore(assessment).score : 0;

  return (
    <AppShell>
      {/* Back nav + title */}
      <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
        <Link href={backHref} className="text-xs text-slate-500 hover:text-white transition-colors">
          {backLabel}
        </Link>
        <h1 className="text-xl font-bold text-white mt-2">
          {personaName ?? 'Session'}
          {scenarioType && (
            <span className="ml-2 text-sm font-normal text-slate-500">— {scenarioType.replace(/_/g, ' ')}</span>
          )}
        </h1>
      </div>

      <div className="px-6 py-6 grid grid-cols-1 lg:grid-cols-[3fr_1.5fr] gap-6">

        {/* LEFT COLUMN */}
        <div className="space-y-6">

          {/* Assessment card */}
          {assessment && (
            <SectionCard title="Assessment">
              {/* Score ring + summary */}
              <div className="flex items-center gap-4 mb-5">
                <div className="relative w-14 h-14 shrink-0">
                  <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
                    <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                    <circle
                      cx="28" cy="28" r="22" fill="none"
                      stroke={displayScore >= 80 ? '#34d399' : displayScore >= 60 ? '#f59e0b' : '#f87171'}
                      strokeWidth="5"
                      strokeDasharray={`${(displayScore / 100) * 138} 138`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                    {displayScore}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-white">Score: {displayScore}/100</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{assessment.summary}</p>
                </div>
              </div>

              {/* Strengths */}
              {assessment.strengths?.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Strengths</p>
                  <ul className="space-y-1.5">
                    {assessment.strengths.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Improvements */}
              {assessment.improvements?.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Improvements</p>
                  <ul className="space-y-1.5">
                    {assessment.improvements.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions to take */}
              {assessment.actions_to_take && assessment.actions_to_take.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Actions to Take</p>
                  <ol className="space-y-4">
                    {assessment.actions_to_take.map((a: any, i: number) => (
                      <li key={i} className="text-sm text-slate-300">
                        <p className="text-[10px] text-slate-500 mb-1">
                          {i + 1}. When <span className="font-semibold text-white">{personaName || 'they'}</span> said:
                        </p>
                        <p className="italic text-slate-400 border-l-2 border-slate-700 pl-3 mb-2">&ldquo;{a.ai_said}&rdquo;</p>
                        <p className="text-slate-300">
                          <span className="text-sky-400 font-semibold">You could have said:</span> &ldquo;{a.suggested_response}&rdquo;
                        </p>
                        {a.technique && (
                          <p className="text-[10px] uppercase tracking-wide text-sky-400/70 mt-1">{a.technique}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </SectionCard>
          )}

          {/* Transcript */}
          <SectionCard title={`Transcript${messages.length > 0 ? ` · ${messages.length} messages` : ''}`}>
            {messages.length === 0 ? (
              <p className="text-center py-8 text-slate-600 text-sm">No transcript available.</p>
            ) : (
              <div className="max-h-[480px] overflow-y-auto flex flex-col gap-3 pr-1">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={[
                      'max-w-[85%] rounded-xl px-3 py-2',
                      msg.role === 'user'
                        ? 'bg-sky-500/15 border border-sky-500/20 rounded-br-none'
                        : 'bg-slate-800 border border-white/[0.06] rounded-bl-none',
                    ].join(' ')}>
                      <p className={`text-[9px] font-semibold mb-1 ${msg.role === 'user' ? 'text-emerald-400' : 'text-sky-400'}`}>
                        {msg.role === 'user' ? 'You' : (personaName || 'Contact')}
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">

          {/* Metadata card */}
          <SectionCard>
            <div className="space-y-3">
              {personaName && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Persona</span>
                  <span className="text-sm text-white font-medium">{personaName}</span>
                </div>
              )}
              {scenarioType && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-slate-500 shrink-0">Scenario</span>
                  <span className="text-xs text-slate-300 text-right">{scenarioType.replace(/_/g, ' ')}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Date</span>
                <span className="text-xs text-slate-400">{formatDateTime(session.started_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Duration</span>
                <span className="text-xs font-mono text-slate-400">{formatDuration(session.started_at, session.ended_at)}</span>
              </div>
              {displayScore > 0 && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-500">Score</span>
                  <ScoreBadge score={displayScore} size="md" />
                </div>
              )}
              {isOwner && (
                <div className="pt-2 border-t border-white/[0.06]">
                  <ShareDialog sessionId={params.id} initialToken={(session as any).share_token ?? null} />
                </div>
              )}
            </div>
          </SectionCard>

          {/* Playbook card */}
          {playbook && (
            <SectionCard title="Playbook">
              <p className="text-sm text-white font-medium">{playbook.name}</p>
              <Link href="/playbooks" className="text-xs text-sky-400 hover:text-sky-300 transition-colors mt-1 block">
                View playbooks →
              </Link>
            </SectionCard>
          )}

          {/* Recording */}
          <SectionCard title="Recording">
            <RecordingPlayer
              sessionId={params.id}
              vapiCallId={(session as any).vapi_call_id ?? null}
              initialUrl={(session as any).recording_url ?? null}
            />
          </SectionCard>

          {/* Coach notes */}
          <SectionCard title="Coach Notes">
            <CoachNotes sessionId={params.id} />
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
