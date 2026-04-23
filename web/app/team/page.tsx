'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import { AppShell } from '@/components/app-shell';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

const SCENARIO_OPTIONS = [
  { id: 'technician',        label: 'Technician'       },
  { id: 'property_manager',  label: 'Property Manager' },
  { id: 'insurance',         label: 'Insurance Broker' },
  { id: 'plumber_bd',        label: 'Plumber BD'       },
];

const SCENARIO_LABELS: Record<string, string> = {
  technician: 'Technician', property_manager: 'Property Manager',
  insurance: 'Insurance Broker', plumber_bd: 'Plumber BD',
  homeowner_inbound: 'Inbound Call', homeowner_facetime: 'Door Knock',
  plumber_lead: 'Plumber Lead', commercial_property_manager: 'Commercial PM',
  insurance_broker: 'Insurance Broker', insurance_broker_discovery: 'Insurance · Discovery',
  property_manager_discovery: 'Residential PM · Discovery', commercial_pm_discovery: 'Commercial PM · Discovery',
  plumber_bd_discovery: 'Plumber · Discovery',
};

const DATE_RANGES = [
  { id: 'all', label: 'All Time' },
  { id: '7d',  label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'ytd', label: 'Year to date' },
  { id: '365d', label: 'Last 365 days' },
];

interface TeamMember {
  id: string; full_name: string; email: string; status: string;
  created_at: string; sessionCount: number; sessions30d: number;
  lastSessionAt: string | null; avgScore: number | null;
  scenario_access: string[];
}

interface CandidateInvite {
  id: string; email: string; full_name: string | null; status: string;
  created_at: string; invite_url: string;
  progress: { sessionsComplete: number; sessionsTotal: number };
  assigned_scenarios: { scenario_type: string; count: number }[];
  avgScore: number | null; completedAt: string | null;
}

interface TeamSession {
  id: string; user_id: string; started_at: string; ended_at: string | null;
  score: number | null; persona_name: string | null; persona_scenario_type: string | null;
  user: { full_name: string; email: string } | null;
}

type Tab = 'employees' | 'candidates';

function statusBadge(status: string) {
  const active = status === 'approved';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${active ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function scoreBadge(score: number | null) {
  if (score === null) return <span className="text-gray-600 text-xs">—</span>;
  const cls = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`text-sm font-semibold ${cls}`}>{score}</span>;
}

function candidateStatusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-400',
    signed_up: 'bg-blue-500/10 text-blue-400',
    in_progress: 'bg-purple-500/10 text-purple-400',
    complete: 'bg-green-500/10 text-green-400',
    upgraded: 'bg-gray-500/10 text-gray-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[status] ?? 'bg-gray-500/10 text-gray-400'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtRelative(d: string | null) {
  if (!d) return '—';
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return fmtDate(d);
}

type SortDir = 'asc' | 'desc';
function SortTh({ label, col, sort, onSort }: {
  label: string; col: string;
  sort: { col: string; dir: SortDir };
  onSort: (col: string) => void;
}) {
  const active = sort.col === col;
  return (
    <th
      className="pb-3 font-medium text-gray-400 cursor-pointer select-none hover:text-white transition-colors text-left"
      onClick={() => onSort(col)}
    >
      {label} {active ? (sort.dir === 'asc' ? '↑' : '↓') : <span className="text-gray-700">↕</span>}
    </th>
  );
}

export default function TeamPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('employees');

  // Employees
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [orgInviteToken, setOrgInviteToken] = useState('');
  const [seatLimit, setSeatLimit] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [editingModules, setEditingModules] = useState<string | null>(null);
  const [modulesDraft, setModulesDraft] = useState<string[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Candidates
  const [candidates, setCandidates] = useState<CandidateInvite[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteScenarios, setInviteScenarios] = useState<{ scenario_type: string; count: number }[]>([
    { scenario_type: 'technician', count: 1 }
  ]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [newInviteUrl, setNewInviteUrl] = useState('');
  const [copiedInvite, setCopiedInvite] = useState('');
  const [candScenarioFilter, setCandScenarioFilter] = useState('all');
  const [candSort, setCandSort] = useState<{ col: string; dir: SortDir }>({ col: 'created_at', dir: 'desc' });

  // Sessions
  const [sessions, setSessions] = useState<TeamSession[]>([]);
  const [sessionsLoading, setSessLoading] = useState(false);
  const [sessUserFilter, setSessUserFilter] = useState('all');
  const [sessScenarioFilter, setSessScenarioFilter] = useState('all');
  const [sessRange, setSessRange] = useState('30d');
  const [sessMembers, setSessMembers] = useState<{ id: string; full_name: string }[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const managementRoles = ['company_admin', 'coach', 'superuser'];
    if (!managementRoles.includes(user.role)) router.replace('/');
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    if (!user.organizationId) { setLoading(false); return; }
    Promise.all([
      fetch('/api/team/members').then(r => r.json()),
      fetch('/api/team/candidates').then(r => r.json()),
    ]).then(([membersData, candidatesData]) => {
      setMembers(membersData.members ?? []);
      setOrgInviteToken(membersData.inviteToken ?? '');
      setSeatLimit(membersData.seatLimit ?? 0);
      setActiveCount(membersData.activeCount ?? 0);
      setCandidates(candidatesData.candidates ?? []);
      setLoading(false);
    });
  }, [user]);

  const loadSessions = useCallback(() => {
    if (!user?.organizationId) return;
    setSessLoading(true);
    const params = new URLSearchParams({ userId: sessUserFilter, scenarioType: sessScenarioFilter, range: sessRange });
    fetch(`/api/team/sessions?${params}`)
      .then(r => r.json())
      .then(d => {
        setSessions(d.sessions ?? []);
        setSessMembers(d.members ?? []);
      })
      .finally(() => setSessLoading(false));
  }, [user, sessUserFilter, sessScenarioFilter, sessRange]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const toggleStatus = async (member: TeamMember) => {
    const newStatus = member.status === 'approved' ? 'rejected' : 'approved';
    setTogglingId(member.id);
    const res = await fetch(`/api/team/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? 'Failed to update status');
      setTogglingId(null);
      return;
    }
    setMembers(m => m.map(x => x.id === member.id ? { ...x, status: newStatus } : x));
    setActiveCount(c => newStatus === 'approved' ? c + 1 : c - 1);
    setTogglingId(null);
  };

  const saveModules = async (memberId: string) => {
    const res = await fetch(`/api/team/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_access: modulesDraft }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Failed to save'); return; }
    setMembers(m => m.map(x => x.id === memberId ? { ...x, scenario_access: modulesDraft } : x));
    setEditingModules(null);
  };

  const copyInvite = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedInvite(key);
    setTimeout(() => setCopiedInvite(''), 2000);
  };

  const sendInvite = async () => {
    setInviteError('');
    if (!inviteEmail) { setInviteError('Email is required.'); return; }
    setInviteLoading(true);
    const res = await fetch('/api/team/candidates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, full_name: inviteName || undefined, assigned_scenarios: inviteScenarios }),
    });
    const data = await res.json();
    setInviteLoading(false);
    if (!res.ok) { setInviteError(data.error ?? 'Failed to create invite.'); return; }
    setNewInviteUrl(data.invite.invite_url);
    setCandidates(c => [data.invite, ...c]);
  };

  const revokeInvite = async (id: string) => {
    if (!confirm('Revoke this invite?')) return;
    await fetch(`/api/team/candidates/${id}`, { method: 'DELETE' });
    setCandidates(c => c.filter(x => x.id !== id));
  };

  const sendUpgradeEmail = async (id: string) => {
    const res = await fetch(`/api/team/candidates/${id}/upgrade-email`, { method: 'POST' });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(`Failed: ${d.error ?? 'Unknown error'}`); return; }
    alert('Upgrade email sent!');
  };

  // Candidate filtering + sorting
  const filteredCandidates = candidates
    .filter(c => {
      if (candScenarioFilter === 'all') return true;
      return (c.assigned_scenarios ?? []).some(s => s.scenario_type === candScenarioFilter);
    })
    .sort((a, b) => {
      const dir = candSort.dir === 'asc' ? 1 : -1;
      if (candSort.col === 'avgScore') return ((a.avgScore ?? -1) - (b.avgScore ?? -1)) * dir;
      if (candSort.col === 'completedAt') return ((a.completedAt ?? '') > (b.completedAt ?? '') ? 1 : -1) * dir;
      return ((a.created_at ?? '') > (b.created_at ?? '') ? 1 : -1) * dir;
    });

  const toggleCandSort = (col: string) => {
    setCandSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' });
  };

  const uniqueScenarioTypes = Array.from(
    new Set(sessions.map(s => s.persona_scenario_type).filter(Boolean))
  ) as string[];

  if (loading) return (
    <AppShell><div className="flex items-center justify-center py-32 text-gray-500">Loading…</div></AppShell>
  );

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10 space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">My Team</h1>
            {seatLimit > 0 && (
              <p className="text-sm text-gray-500 mt-0.5">
                {activeCount} of {seatLimit} seats active
              </p>
            )}
          </div>
          {tab === 'employees' && orgInviteToken && (
            <div className="flex items-center gap-2">
              <code className="text-xs text-gray-400 bg-gray-900 border border-white/10 rounded-lg px-3 py-2 truncate max-w-xs">
                {APP_URL}/signup?org={orgInviteToken}
              </code>
              <button
                onClick={() => copyInvite(`${APP_URL}/signup?org=${orgInviteToken}`, 'org')}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                {copiedInvite === 'org' ? 'Copied!' : 'Copy invite'}
              </button>
            </div>
          )}
          {tab === 'candidates' && (
            <button
              onClick={() => { setShowInviteModal(true); setNewInviteUrl(''); setInviteEmail(''); setInviteName(''); setInviteScenarios([{ scenario_type: 'technician', count: 1 }]); setInviteError(''); }}
              className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              + Invite Candidate
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/10">
          {(['employees', 'candidates'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors capitalize ${tab === t ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-white'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* ── Employees Tab ─────────────────────────────────────────────── */}
        {tab === 'employees' && (
          <>
            {members.length === 0 ? (
              <p className="text-gray-500 py-20 text-center text-sm">No team members yet. Share your invite link above.</p>
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
                      <th className="pb-3 font-medium text-gray-400">Modules</th>
                      <th className="pb-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {members.map(m => (
                      <tr key={m.id} className="group">
                        <td className="py-3">
                          <p className="text-white font-medium">{m.full_name}</p>
                          <p className="text-gray-500 text-xs">{m.email}</p>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            {statusBadge(m.status)}
                            <button
                              onClick={() => toggleStatus(m)}
                              disabled={togglingId === m.id}
                              className="text-xs text-gray-600 hover:text-blue-400 transition-colors disabled:opacity-40"
                            >
                              {togglingId === m.id ? '…' : m.status === 'approved' ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                        <td className="py-3">{scoreBadge(m.avgScore)}</td>
                        <td className="py-3 text-gray-400">{m.sessions30d}</td>
                        <td className="py-3 text-gray-400 text-xs">{fmtRelative(m.lastSessionAt)}</td>
                        <td className="py-3">
                          {editingModules === m.id ? (
                            <div className="flex flex-col gap-1">
                              {SCENARIO_OPTIONS.map(opt => (
                                <label key={opt.id} className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                                  <input type="checkbox" checked={modulesDraft.includes(opt.id)}
                                    onChange={e => setModulesDraft(d => e.target.checked ? [...d, opt.id] : d.filter(x => x !== opt.id))}
                                    className="w-3 h-3 rounded" />
                                  {opt.label}
                                </label>
                              ))}
                              <div className="flex gap-2 mt-1">
                                <button onClick={() => saveModules(m.id)} className="text-xs text-blue-400 hover:text-blue-300">Save</button>
                                <button onClick={() => setEditingModules(null)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 flex-wrap">
                              {(m.scenario_access ?? []).length === 0
                                ? <span className="text-xs text-gray-600">None</span>
                                : (m.scenario_access ?? []).map(s => (
                                  <span key={s} className="text-[10px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded">
                                    {SCENARIO_OPTIONS.find(o => o.id === s)?.label ?? s}
                                  </span>
                                ))
                              }
                              <button onClick={() => { setEditingModules(m.id); setModulesDraft(m.scenario_access ?? []); }}
                                className="text-[10px] text-gray-600 hover:text-blue-400 transition-colors ml-1">Edit</button>
                            </div>
                          )}
                        </td>
                        <td className="py-3" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sessions Section */}
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
                  {uniqueScenarioTypes.map(t => <option key={t} value={t}>{SCENARIO_LABELS[t] ?? t}</option>)}
                </select>
                <select value={sessRange} onChange={e => setSessRange(e.target.value)}
                  className="bg-gray-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none">
                  {DATE_RANGES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>

              {sessionsLoading ? (
                <p className="text-gray-500 text-sm">Loading sessions…</p>
              ) : sessions.length === 0 ? (
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

        {/* ── Candidates Tab ─────────────────────────────────────────────── */}
        {tab === 'candidates' && (
          <>
            <div className="flex flex-wrap gap-3 items-center">
              <select value={candScenarioFilter} onChange={e => setCandScenarioFilter(e.target.value)}
                className="bg-gray-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none">
                <option value="all">All scenarios</option>
                {SCENARIO_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <span className="text-gray-600 text-xs ml-auto">{filteredCandidates.length} candidate{filteredCandidates.length !== 1 ? 's' : ''}</span>
            </div>

            {filteredCandidates.length === 0 ? (
              <p className="text-gray-500 py-20 text-center text-sm">No candidates yet. Click &quot;Invite Candidate&quot; to get started.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-white/10">
                      <th className="pb-3 font-medium text-gray-400">Name / Email</th>
                      <th className="pb-3 font-medium text-gray-400">Status</th>
                      <th className="pb-3 font-medium text-gray-400">Scenarios</th>
                      <th className="pb-3 font-medium text-gray-400">Progress</th>
                      <SortTh label="Avg Score" col="avgScore" sort={candSort} onSort={toggleCandSort} />
                      <SortTh label="Invited" col="created_at" sort={candSort} onSort={toggleCandSort} />
                      <SortTh label="Completed" col="completedAt" sort={candSort} onSort={toggleCandSort} />
                      <th className="pb-3 font-medium text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredCandidates.map(c => (
                      <tr key={c.id}>
                        <td className="py-3">
                          <p className="text-white font-medium">{c.full_name ?? '—'}</p>
                          <p className="text-gray-500 text-xs">{c.email}</p>
                        </td>
                        <td className="py-3">{candidateStatusBadge(c.status)}</td>
                        <td className="py-3 text-gray-400 text-xs">
                          {(c.assigned_scenarios ?? []).map(s => `${SCENARIO_LABELS[s.scenario_type] ?? s.scenario_type} ×${s.count}`).join(', ')}
                        </td>
                        <td className="py-3 text-gray-400 text-xs">
                          {c.progress.sessionsComplete}/{c.progress.sessionsTotal}
                        </td>
                        <td className="py-3">{scoreBadge(c.avgScore)}</td>
                        <td className="py-3 text-gray-500 text-xs">{fmtDate(c.created_at)}</td>
                        <td className="py-3 text-gray-500 text-xs">{fmtDate(c.completedAt)}</td>
                        <td className="py-3">
                          <div className="flex gap-2 flex-wrap">
                            {c.status === 'pending' && (
                              <>
                                <button onClick={() => copyInvite(c.invite_url, c.id)}
                                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                                  {copiedInvite === c.id ? 'Copied!' : 'Copy link'}
                                </button>
                                <button onClick={() => revokeInvite(c.id)}
                                  className="text-xs text-red-500 hover:text-red-400 transition-colors">
                                  Revoke
                                </button>
                              </>
                            )}
                            {(c.status === 'signed_up' || c.status === 'in_progress') && (
                              <Link href="/sessions" className="text-xs text-gray-400 hover:text-white transition-colors">
                                View sessions
                              </Link>
                            )}
                            {c.status === 'complete' && (
                              <>
                                <Link href="/sessions" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                                  View results
                                </Link>
                                <button onClick={() => sendUpgradeEmail(c.id)}
                                  className="text-xs text-green-400 hover:text-green-300 transition-colors">
                                  Send upgrade email
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Invite Candidate</h2>
            {newInviteUrl ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">Invite created! Share this link:</p>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs text-gray-300 bg-gray-800 border border-white/10 rounded-lg px-3 py-2 break-all">
                    {newInviteUrl}
                  </code>
                  <button onClick={() => copyInvite(newInviteUrl, 'modal')}
                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg whitespace-nowrap">
                    {copiedInvite === 'modal' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button onClick={() => setShowInviteModal(false)}
                  className="w-full text-sm text-gray-400 hover:text-white border border-white/10 rounded-xl py-2 transition-colors">
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Candidate email *</label>
                  <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    placeholder="candidate@email.com"
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name (optional)</label>
                  <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Assigned sessions *</label>
                  <div className="space-y-2">
                    {inviteScenarios.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <select value={s.scenario_type} onChange={e => setInviteScenarios(sc => sc.map((x, idx) => idx === i ? { ...x, scenario_type: e.target.value } : x))}
                          className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                          {SCENARIO_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </select>
                        <input type="number" min={1} max={10} value={s.count}
                          onChange={e => setInviteScenarios(sc => sc.map((x, idx) => idx === i ? { ...x, count: parseInt(e.target.value) || 1 } : x))}
                          className="w-16 bg-gray-800 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none" />
                        {inviteScenarios.length > 1 && (
                          <button onClick={() => setInviteScenarios(sc => sc.filter((_, idx) => idx !== i))}
                            className="text-gray-600 hover:text-red-400 text-sm">×</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setInviteScenarios(s => [...s, { scenario_type: 'technician', count: 1 }])}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors">+ Add scenario</button>
                </div>
                {inviteError && <p className="text-red-400 text-xs">{inviteError}</p>}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setShowInviteModal(false)}
                    className="flex-1 text-sm text-gray-400 hover:text-white border border-white/10 rounded-xl py-2 transition-colors">Cancel</button>
                  <button onClick={sendInvite} disabled={inviteLoading}
                    className="flex-1 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-xl py-2 transition-colors">
                    {inviteLoading ? 'Creating…' : 'Create Invite'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
