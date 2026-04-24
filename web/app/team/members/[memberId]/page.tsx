'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { AppShell } from '@/components/app-shell';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const SCENARIO_LABELS: Record<string, string> = {
  technician: 'Technician',
  property_manager: 'Property Manager',
  insurance: 'Insurance Broker',
  plumber_bd: 'Plumber BD',
  homeowner_inbound: 'Inbound Call',
  homeowner_facetime: 'Door Knock',
  plumber_lead: 'Plumber Lead',
  commercial_property_manager: 'Commercial PM',
  insurance_broker: 'Insurance Broker',
  insurance_broker_discovery: 'Insurance · Discovery',
  property_manager_discovery: 'Residential PM · Discovery',
  commercial_pm_discovery: 'Commercial PM · Discovery',
  plumber_bd_discovery: 'Plumber · Discovery',
};

interface MemberProfile {
  id: string;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
  scenario_access: string[];
  sessionCount: number;
  sessions30d: number;
  lastSessionAt: string | null;
  avgScore: number | null;
}

interface MemberSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  score: number | null;
  persona_name: string | null;
  persona_scenario_type: string | null;
}

function scoreBadge(score: number | null) {
  if (score === null) return <span className="text-gray-600 text-xs">—</span>;
  const cls = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`text-sm font-semibold ${cls}`}>{score}</span>;
}

function fmtRelative(d: string | null) {
  if (!d) return '—';
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MemberDetailPage({ params }: { params: { memberId: string } }) {
  const { user } = useAuth();
  const router = useRouter();

  const [member, setMember] = useState<MemberProfile | null>(null);
  const [sessions, setSessions] = useState<MemberSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!['company_admin', 'superuser'].includes(user.role)) {
      router.replace('/');
      return;
    }
    fetch(`/api/team/members/${params.memberId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setMember(d.member);
        setSessions(d.sessions ?? []);
      })
      .catch(() => setError('Failed to load member'))
      .finally(() => setLoading(false));
  }, [user, params.memberId, router]);

  if (loading) return (
    <AppShell>
      <div className="flex items-center justify-center py-32 text-gray-500 text-sm">Loading…</div>
    </AppShell>
  );

  if (error || !member) return (
    <AppShell>
      <div className="flex items-center justify-center py-32 text-red-400 text-sm">{error ?? 'Member not found'}</div>
    </AppShell>
  );

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 space-y-8">

        {/* Back + header */}
        <div>
          <Link href="/team" className="text-xs text-slate-500 hover:text-white transition-colors">← Team</Link>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">{member.full_name}</h1>
              <p className="text-sm text-slate-500 mt-0.5">{member.email}</p>
            </div>
            <span className={`self-start sm:self-auto px-2.5 py-1 rounded-full text-xs font-medium ${
              member.status === 'approved' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'
            }`}>
              {member.status === 'approved' ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-white/[0.06] rounded-xl p-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Avg Score</p>
            <p className={`text-2xl font-bold ${
              member.avgScore === null ? 'text-gray-600' :
              member.avgScore >= 80 ? 'text-emerald-400' :
              member.avgScore >= 60 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {member.avgScore ?? '—'}
            </p>
          </div>
          <div className="bg-slate-900 border border-white/[0.06] rounded-xl p-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Sessions (30d)</p>
            <p className="text-2xl font-bold text-white">{member.sessions30d}</p>
          </div>
          <div className="bg-slate-900 border border-white/[0.06] rounded-xl p-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Last Session</p>
            <p className="text-sm font-medium text-slate-300 mt-1">{fmtRelative(member.lastSessionAt)}</p>
          </div>
        </div>

        {/* Sessions table */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">
            Sessions
            <span className="text-slate-500 font-normal text-sm ml-2">({member.sessionCount} total)</span>
          </h2>

          {sessions.length === 0 ? (
            <p className="text-gray-500 text-sm py-12 text-center">No sessions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-white/10">
                    <th className="pb-3 font-medium text-gray-400">Scenario</th>
                    <th className="pb-3 font-medium text-gray-400">Score</th>
                    <th className="pb-3 font-medium text-gray-400">Date</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sessions.map(s => (
                    <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5">
                        <p className="text-white">{s.persona_name ?? '—'}</p>
                        <p className="text-gray-500 text-xs">
                          {SCENARIO_LABELS[s.persona_scenario_type ?? ''] ?? s.persona_scenario_type ?? '—'}
                        </p>
                      </td>
                      <td className="py-2.5">{scoreBadge(s.score)}</td>
                      <td className="py-2.5 text-gray-500 text-xs">{fmtRelative(s.started_at)}</td>
                      <td className="py-2.5">
                        <Link
                          href={`/sessions/${s.id}?back=/team/members/${member.id}`}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
