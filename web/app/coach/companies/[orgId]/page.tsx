'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { getDisplayScore } from '@/lib/scoring';

const SCENARIO_LABELS: Record<string, string> = {
  homeowner_inbound:             'Inbound Call',
  homeowner_facetime:            'Door Knock',
  plumber_lead:                  'Plumber Lead',
  property_manager:              'Residential PM',
  commercial_property_manager:   'Commercial PM',
  insurance_broker:              'Insurance Broker',
  plumber_bd:                    'Plumber BD',
  property_manager_discovery:    'Residential PM · Discovery',
  commercial_pm_discovery:       'Commercial PM · Discovery',
  insurance_broker_discovery:    'Insurance · Discovery',
  plumber_bd_discovery:          'Plumber · Discovery',
};

function getScore(assessment: any): number | null {
  if (!assessment) return null;
  const a = typeof assessment === 'string' ? JSON.parse(assessment) : assessment;
  if (typeof a?.score !== 'number') return null;
  return getDisplayScore(a).score;
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

function scoreBadge(score: number) {
  if (score >= 80) return 'bg-emerald-500/15 text-emerald-400';
  if (score >= 60) return 'bg-yellow-500/15 text-yellow-400';
  return 'bg-red-500/15 text-red-400';
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(start: string, end: string | null) {
  if (!end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface SessionUser { full_name: string; email: string; app_role: string; }
interface Session {
  id: string; user_id: string; started_at: string; ended_at: string | null;
  assessment: any; persona_name: string | null; persona_scenario_type: string | null;
  user: SessionUser | null;
}
interface OrgUser { id: string; full_name: string; email: string; app_role: string; }

export default function CompanySessionsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();
  const [org, setOrg] = useState<{ id: string; name: string } | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [filterUser, setFilterUser] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/coach/companies/${orgId}/sessions`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { router.replace('/coach'); return; }
        setOrg(d.org);
        setSessions(d.sessions ?? []);
        setUsers((d.users ?? []).filter((u: OrgUser) => u.app_role === 'individual'));
      })
      .finally(() => setLoading(false));
  }, [orgId, router]);

  const filtered = filterUser === 'all'
    ? sessions
    : sessions.filter(s => s.user_id === filterUser);

  const techSessions = sessions.filter(s => {
    const u = users.find(u => u.id === s.user_id);
    return u != null;
  });

  const userStats = users.map(u => {
    const userSessions = techSessions.filter(s => s.user_id === u.id);
    const scores = userSessions.map(s => getScore(s.assessment)).filter((x): x is number => x !== null);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return { ...u, sessionCount: userSessions.length, avgScore: avg };
  }).sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-5xl mx-auto px-6 py-16 text-center text-gray-500">Loading…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/coach" className="text-gray-500 hover:text-white text-sm transition-colors">
            ← Coach Hub
          </Link>
          <span className="text-gray-700">/</span>
          <h1 className="text-xl font-bold">{org?.name}</h1>
        </div>

        {/* Team leaderboard */}
        {userStats.length > 0 && (
          <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10">
              <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase">Team Leaderboard</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-gray-500 text-xs uppercase tracking-widest">
                  <th className="text-left px-5 py-3">Technician</th>
                  <th className="text-left px-5 py-3">Sessions</th>
                  <th className="text-left px-5 py-3">Avg Score</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {userStats.map((u, i) => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 text-xs w-4">{i + 1}</span>
                        <div>
                          <p className="font-medium">{u.full_name}</p>
                          <p className="text-gray-500 text-xs">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-400">{u.sessionCount}</td>
                    <td className="px-5 py-3">
                      {u.avgScore !== null
                        ? <span className={`font-semibold ${scoreColor(u.avgScore)}`}>{u.avgScore}/100</span>
                        : <span className="text-gray-600">—</span>
                      }
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setFilterUser(filterUser === u.id ? 'all' : u.id)}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {filterUser === u.id ? 'Show all' : 'Filter'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sessions table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase">
              Sessions {filterUser !== 'all' && `— ${users.find(u => u.id === filterUser)?.full_name}`}
            </p>
            {filterUser !== 'all' && (
              <button onClick={() => setFilterUser('all')} className="text-xs text-gray-500 hover:text-white transition-colors">
                Clear filter ×
              </button>
            )}
          </div>
          <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-500 text-xs uppercase tracking-widest">
                  <th className="text-left px-5 py-3">Technician</th>
                  <th className="text-left px-5 py-3">Scenario</th>
                  <th className="text-left px-5 py-3">Score</th>
                  <th className="text-left px-5 py-3">Duration</th>
                  <th className="text-right px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const score = getScore(s.assessment);
                  const scenario = s.persona_scenario_type ? (SCENARIO_LABELS[s.persona_scenario_type] ?? s.persona_scenario_type) : '—';
                  return (
                    <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => window.location.href = `/sessions/${s.id}?back=/coach/companies/${orgId}`}>
                      <td className="px-5 py-3">
                        <p className="font-medium">{s.user?.full_name ?? '—'}</p>
                        <p className="text-gray-500 text-xs">{s.persona_name ?? ''}</p>
                      </td>
                      <td className="px-5 py-3 text-gray-400">{scenario}</td>
                      <td className="px-5 py-3">
                        {score !== null
                          ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scoreBadge(score)}`}>{score}/100</span>
                          : <span className="text-gray-600">—</span>
                        }
                      </td>
                      <td className="px-5 py-3 text-gray-400">{formatDuration(s.started_at, s.ended_at)}</td>
                      <td className="px-5 py-3 text-gray-400 text-right">
                        <span className="text-xs text-blue-400">{formatDate(s.started_at)} →</span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-500">No sessions found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
