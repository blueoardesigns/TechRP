// web/app/share/session/[token]/page.tsx
import { createServiceSupabase } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import { getDisplayScore, gradeColor, type Assessment, type ActionToTake } from '@/lib/scoring';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

async function getSharedSession(token: string) {
  const supabase = createServiceSupabase();
  const { data: session } = await (supabase as any)
    .from('training_sessions')
    .select('id, user_id, started_at, ended_at, assessment, persona_name, persona_scenario_type, share_token')
    .eq('share_token', token)
    .single();
  if (!session || !(session as any).share_token) return null;

  const { data: user } = await (supabase as any)
    .from('users')
    .select('id, full_name, name, referral_code')
    .eq('id', (session as any).user_id)
    .single();

  return { session, user };
}

function parseAssessment(a: string | null): Assessment | null {
  if (!a) return null;
  try { return JSON.parse(a); } catch { return null; }
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return '—';
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function initials(name: string): string {
  return name.split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const data = await getSharedSession(params.token);
  if (!data) return { title: 'Session not found' };
  const assessment = parseAssessment((data.session as any).assessment);
  const { score, letter } = getDisplayScore(assessment);
  const name = (data.user as any)?.full_name ?? (data.user as any)?.name ?? 'A rep';
  return {
    title: `${name} scored ${score}/100 on TechRP`,
    description: assessment?.summary ?? 'Sales training roleplay scored by AI on TechRP.',
    robots: { index: false, follow: false },
    openGraph: {
      title: `${name} scored ${score}/100 (${letter}) on TechRP`,
      description: assessment?.summary ?? '',
      type: 'article',
    },
  };
}

export default async function SharePage({ params }: { params: { token: string } }) {
  const data = await getSharedSession(params.token);
  if (!data) notFound();
  const { session, user } = data;

  const assessment = parseAssessment((session as any).assessment);
  if (!assessment) notFound();

  const { score, letter } = getDisplayScore(assessment);
  const { text, ring, bg } = gradeColor(letter);
  const personaName = (session as any).persona_name;
  const scenarioType = (session as any).persona_scenario_type;
  const name = (user as any)?.full_name ?? (user as any)?.name ?? 'Rep';
  const refCode = (user as any)?.referral_code ?? '';
  const actions: ActionToTake[] = Array.isArray(assessment.actions_to_take) ? assessment.actions_to_take : [];
  const joinUrl = refCode
    ? `/signup?ref=${encodeURIComponent(refCode)}&ref_source=share_page`
    : '/signup';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600" />
            <span className="text-sm font-semibold">TechRP</span>
          </div>
          <a href={joinUrl} className="text-xs font-semibold text-blue-300 hover:text-blue-200">Join TechRP →</a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        <section className={`rounded-3xl border ${ring} ${bg} p-8 flex items-center gap-6`}>
          <div className={`w-28 h-28 rounded-full border-2 ${ring} flex flex-col items-center justify-center bg-gray-950`}>
            <span className={`text-5xl font-bold ${text} leading-none`}>{score}</span>
            <span className="text-[10px] text-gray-500 mt-1">/ 100</span>
            <span className={`text-sm font-bold ${text}`}>{letter}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-300">
                {initials(name)}
              </div>
              <p className="text-lg font-semibold">{name}</p>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Scored a <span className={`font-bold ${text}`}>{letter}</span> on a TechRP AI-graded sales training call.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Persona', value: personaName ?? '—' },
            { label: 'Scenario', value: scenarioType ?? '—' },
            { label: 'Date', value: formatDate((session as any).started_at) },
            { label: 'Duration', value: formatDuration((session as any).started_at, (session as any).ended_at) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-900 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
              <p className="text-sm font-semibold text-white leading-snug break-words">{value}</p>
            </div>
          ))}
        </section>

        <section className="bg-gray-900 border border-white/10 rounded-2xl p-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Coaching Summary</p>
          <p className="text-sm text-gray-300 leading-relaxed">{assessment.summary}</p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-5">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-3">Strengths</p>
            <ul className="space-y-2">
              {assessment.strengths.map((s, i) => (
                <li key={i} className="text-sm text-gray-300 flex gap-2">
                  <span className="text-emerald-400 shrink-0">✓</span>{s}
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-xl p-5">
            <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide mb-3">Focus Areas</p>
            <ul className="space-y-2">
              {assessment.improvements.map((s, i) => (
                <li key={i} className="text-sm text-gray-300 flex gap-2">
                  <span className="text-yellow-400 shrink-0">↑</span>{s}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {actions.length > 0 && (
          <section className="border border-blue-500/20 bg-blue-500/5 rounded-xl p-5">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-3">Actions to Take</p>
            <ol className="space-y-4">
              {actions.map((a, i) => (
                <li key={i} className="text-sm text-gray-300">
                  <p className="text-xs text-gray-500 mb-1">
                    {i + 1}. When <span className="font-semibold text-white">{personaName || 'they'}</span> said:
                  </p>
                  <p className="italic text-gray-400 border-l-2 border-gray-700 pl-3 mb-2">&ldquo;{a.ai_said}&rdquo;</p>
                  <p className="text-gray-300">
                    <span className="text-blue-300 font-semibold">You could have said:</span> &ldquo;{a.suggested_response}&rdquo;
                  </p>
                  {a.technique && (
                    <p className="text-[10px] uppercase tracking-wide text-blue-400/70 mt-1">{a.technique}</p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 p-8 text-center">
          <h2 className="text-xl font-bold mb-2">Train like {name.split(' ')[0]}.</h2>
          <p className="text-sm text-gray-300 mb-5">Practice real sales calls against AI personas. Get AI-graded feedback. Start free.</p>
          <a
            href={joinUrl}
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
          >
            Start your free TechRP account →
          </a>
        </section>

      </main>
    </div>
  );
}
