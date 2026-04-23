'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import { AppShell } from '@/components/app-shell';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const SCENARIO_LABELS: Record<string, string> = {
  technician: 'Technician', property_manager: 'Property Manager',
  insurance: 'Insurance Broker', plumber_bd: 'Plumber BD',
  homeowner_inbound: 'Inbound Call', homeowner_facetime: 'Door Knock',
  plumber_lead: 'Plumber Lead', commercial_property_manager: 'Commercial PM',
  insurance_broker: 'Insurance Broker', property_manager_discovery: 'Residential PM · Discovery',
  commercial_pm_discovery: 'Commercial PM · Discovery',
  insurance_broker_discovery: 'Insurance · Discovery', plumber_bd_discovery: 'Plumber · Discovery',
};

const DATE_RANGES = [
  { id: 'all', label: 'All Time' }, { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' }, { id: 'ytd', label: 'Year to date' },
  { id: '365d', label: 'Last 365 days' },
];

interface CoachCompany { id: string; name: string; }

interface Member {
  id: string; full_name: string; email: string; status: string;
  sessionCount: number; sessions30d: number; lastSessionAt: string | null; avgScore: number | null;
}

interface TeamSession {
  id: string; user_id: string; started_at: string; ended_at: string | null;
  score: number | null; persona_name: string | null; persona_scenario_type: string | null;
  user: { full_name: string; email: string } | null;
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

export default function CoachedTeamsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [companies, setCompanies] = useState<CoachCompany[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [allSessions, setAllSessions] = useState<TeamSession[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [companiesLoading, setCompaniesLoading] = useState(true);

  const [sessUserFilter, setSessUserFilter] = useState('all');
  const [sessScenarioFilter, setSessScenarioFilter] = useState('all');
  const [sessRange, setSessRange] = useState('30d');

  useEffect(() => {
    if (!user) return;
    if (!['coach', 'superuser'].includes(user.role)) { router.replace('/'); return; }
    fetch('/api/coach/companies')
      .then(r => r.json())
      .then(d => {
        const list: CoachCompany[] = (d.companies ?? []).map((c: any) => ({ id: c.id, name: c.name }));
        setCompanies(list);
        if (list.length > 0) setSelectedOrgId(list[0].id);
      })
      .finally(() => setCompaniesLoading(false));
  }, [user, router]);

  const loadTeam = useCallback(() => {
    if (!selectedOrgId) return;
    setDataLoading(true);
    fetch(`/api/coach/team?orgId=${selectedOrgId}`)
      .then(r => r.json())
      .then(d => {
        setMembers(d.members ?? []);
        setAllSessions(d.sessions ?? []);
      })
      .finally(() => setDataLoading(false));
  }, [selectedOrgId]);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  // Client-side filter sessions
  const sessions = allSessions.filter(s => {
    if (sessUserFilter !== 'all' && s.user_id !== sessUserFilter) return false;
    if (sessScenarioFilter !== 'all' && s.persona_scenario_type !== sessScenarioFilter) return false;
    if (sessRange !== 'all') {
      const now = Date.now();
      const cutoffs: Record<string, number> = {
        '7d': now - 7 * 86400_000, '30d': now - 30 * 86400_000,
        '365d': now - 365 * 86400_000,
        'ytd': new Date(new Date().getFullYear(), 0, 1).getTime(),
      };
      if (new Date(s.started_at).getTime() < (cutoffs[sessRange] ?? 0)) return false;
    }
    return true;
  });

  const uniqueScenarios = Array.from(new Set(allSessions.map(s => s.persona_scenario_type).filter(Boolean))) as string[];
  const sessMembers = members.map(m => ({ id: m.id, full_name: m.full_name }));

  if (companiesLoading) return (
    <AppShell><div className="flex items-center justify-center py-32 text-gray-500">Loading…</div></AppShell>
  );

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10 space-y-8">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">My Coached Teams</h1>
          {companies.length > 1 && (
            <select
              value={selectedOrgId}
              onChange={e => {
                setSelectedOrgId(e.target.value);
                setSessUserFilter('all');
                setSessScenarioFilter('all');
              }}
              className="bg-gray-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        {companies.length === 0 ? (
          <p className="text-gray-500 py-20 text-center text-sm">
            No coached companies yet. Share your coach invite code with companies to get started.
          </p>
        ) : dataLoading ? (
          <p className="text-gray-500 py-10 text-center text-sm">Loading team data…</p>
        ) : (
          <>
            {/* Members table */}
            {members.length === 0 ? (
              <p className="text-gray-500 text-sm">This team has no members yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-white/10">
                      <th className="pb-3 font-medium text-gray-400">Name</th>
                      <th className="pb-3 font-medium text-gray-400">Status</th>
                      <th className="pb-3 font-medium text-gray-400">Avg Score</th>
                      <th className="pb-3 font-medium text-gray-400">Sessions (30d)</th>
                      <th className="pb-3 font-medium text-gray-400">Last Session</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {members.map(m => (
                      <tr key={m.id}>
                        <td className="py-3">
                          <p className="text-white font-medium">{m.full_name}</p>
                          <p className="text-gray-500 text-xs">{m.email}</p>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.status === 'approved' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                            {m.status === 'approved' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3">{scoreBadge(m.avgScore)}</td>
                        <td className="py-3 text-gray-400">{m.sessions30d}</td>
                        <td className="py-3 text-gray-500 text-xs">{fmtRelative(m.lastSessionAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sessions section */}
            <div className="space-y-4 pt-4">
              <h2 className="text-lg font-semibold text-white">Sessions</h2>
              <div className="flex flex-wrap gap-3">
                <select value={sessUserFilter} onChange={e => setSessUserFilter(e.target.value)}
                  className="bg-gray-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none">
                  <option value="all">All members</option>
                  {sessMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
                <select value={sessScenarioFilter} onChange={e => setSessScenarioFilter(e.target.value)}
                  className="bg-gray-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none">
                  <option value="all">All scenarios</option>
                  {uniqueScenarios.map(t => <option key={t} value={t}>{SCENARIO_LABELS[t] ?? t}</option>)}
                </select>
                <select value={sessRange} onChange={e => setSessRange(e.target.value)}
                  className="bg-gray-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none">
                  {DATE_RANGES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
              {sessions.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">No sessions match these filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-white/10">
                        <th className="pb-3 font-medium text-gray-400">Member</th>
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
                            <p className="text-white">{s.user?.full_name ?? '—'}</p>
                            <p className="text-gray-500 text-xs">{s.user?.email ?? ''}</p>
                          </td>
                          <td className="py-2.5 text-gray-400">
                            {SCENARIO_LABELS[s.persona_scenario_type ?? ''] ?? s.persona_scenario_type ?? '—'}
                          </td>
                          <td className="py-2.5">{scoreBadge(s.score)}</td>
                          <td className="py-2.5 text-gray-500 text-xs">{fmtRelative(s.started_at)}</td>
                          <td className="py-2.5">
                            <Link href={`/sessions/${s.id}`} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
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
          </>
        )}
      </div>
    </AppShell>
  );
}
