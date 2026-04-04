import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';

async function getSession(id: string) {
  try {
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
interface Assessment { score: number; strengths: string[]; improvements: string[]; summary: string; }

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

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? 'text-emerald-400' : score >= 6 ? 'text-yellow-400' : 'text-red-400';
  const ring  = score >= 8 ? 'border-emerald-500/40' : score >= 6 ? 'border-yellow-500/40' : 'border-red-500/40';
  return (
    <div className={`w-20 h-20 rounded-full border-2 ${ring} flex flex-col items-center justify-center`}>
      <span className={`text-3xl font-bold ${color}`}>{score}</span>
      <span className="text-xs text-gray-600">/10</span>
    </div>
  );
}

export default async function SessionDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession(params.id);
  if (!session) notFound();

  const messages = parseTranscript(session.transcript);
  const assessment = parseAssessment(session.assessment);
  const personaName = (session as any).persona_name;
  const scenarioType = (session as any).persona_scenario_type;

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-white/10 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 sm:px-10 h-14 flex items-center justify-between">
          <Link href="/sessions" className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Sessions
          </Link>
          <h1 className="text-sm font-semibold text-white">Session Details</h1>
          <div className="w-20" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8 space-y-5">

        {/* ── Meta row ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Date', value: formatDateTime(session.started_at) },
            { label: 'Duration', value: formatDuration(session.started_at, session.ended_at) },
            { label: 'Status', value: session.ended_at ? 'Completed' : 'In Progress' },
            { label: 'Persona', value: personaName || scenarioType || '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-900 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
              <p className="text-sm font-semibold text-white leading-snug">{value}</p>
            </div>
          ))}
        </div>

        {/* ── Assessment ────────────────────────────────────────────────────── */}
        {assessment && (
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Performance Assessment</p>
            <div className="flex items-start gap-6 mb-5">
              <ScoreBadge score={assessment.score} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Coaching Summary</p>
                <p className="text-sm text-gray-300 leading-relaxed">{assessment.summary}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-4">
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-3">Strengths</p>
                <ul className="space-y-2">
                  {assessment.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-gray-300 flex gap-2">
                      <span className="text-emerald-400 shrink-0">✓</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-xl p-4">
                <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide mb-3">Focus Areas</p>
                <ul className="space-y-2">
                  {assessment.improvements.map((s, i) => (
                    <li key={i} className="text-sm text-gray-300 flex gap-2">
                      <span className="text-yellow-400 shrink-0">↑</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── Recording ─────────────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-white/10 rounded-2xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Call Recording</p>
          {session.recording_url ? (
            <div className="space-y-2">
              <audio controls className="w-full h-10 [&::-webkit-media-controls-panel]:bg-gray-800 rounded-lg">
                <source src={session.recording_url} type="audio/mpeg" />
                <source src={session.recording_url} type="audio/wav" />
              </audio>
              <a
                href={session.recording_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Download recording →
              </a>
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              {session.vapi_call_id ? 'Recording may still be processing.' : 'No recording available.'}
            </p>
          )}
        </div>

        {/* ── Transcript ────────────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transcript</p>
            <span className="text-xs text-gray-600">{messages.length} messages</span>
          </div>
          {messages.length === 0 ? (
            <p className="text-center py-10 text-gray-600 text-sm">No transcript available.</p>
          ) : (
            <div className="p-5 space-y-3 max-h-[500px] overflow-y-auto">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-gray-800 text-gray-100 rounded-bl-sm'
                  }`}>
                    <p className="text-xs font-semibold mb-1 opacity-60">
                      {msg.role === 'user' ? 'Technician' : (personaName || 'Contact')}
                    </p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
