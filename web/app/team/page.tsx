'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { AppNav } from '@/components/nav';
import { useRouter } from 'next/navigation';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

const SCENARIO_OPTIONS = [
  { id: 'technician', label: 'Technician' },
  { id: 'property_manager', label: 'Property Manager' },
  { id: 'insurance', label: 'Insurance Broker' },
  { id: 'plumber_bd', label: 'Plumber BD' },
];

interface TeamMember {
  id: string; full_name: string; email: string; status: string;
  created_at: string; sessionCount: number; scenario_access: string[];
}

interface AssignedScenario { scenario_type: string; count: number; }

interface CandidateInvite {
  id: string; email: string; full_name: string | null; status: string;
  created_at: string; invite_url: string;
  progress: { sessionsComplete: number; sessionsTotal: number };
  assigned_scenarios: AssignedScenario[];
}

type Tab = 'employees' | 'candidates' | 'coaches';

export default function TeamPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('employees');

  // Employees state
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [orgInviteToken, setOrgInviteToken] = useState('');
  const [editingModules, setEditingModules] = useState<string | null>(null); // member id
  const [modulesDraft, setModulesDraft] = useState<string[]>([]);

  // Candidates state
  const [candidates, setCandidates] = useState<CandidateInvite[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteScenarios, setInviteScenarios] = useState<AssignedScenario[]>([
    { scenario_type: 'technician', count: 1 }
  ]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [newInviteUrl, setNewInviteUrl] = useState('');
  const [copiedInvite, setCopiedInvite] = useState('');

  // Coaches state
  const [coachConnections, setCoachConnections] = useState<{
    id: string;
    coachName: string;
    coachEmail: string;
    permissionLevel: 'edit_playbooks' | 'readonly';
    status: 'pending' | 'active';
  }[]>([]);
  const [coachesLoading, setCoachesLoading] = useState(false);
  const [showAddCoach, setShowAddCoach] = useState(false);
  const [coachInviteToken, setCoachInviteToken] = useState('');
  const [coachPermission, setCoachPermission] = useState<'edit_playbooks' | 'readonly'>('readonly');
  const [addingCoach, setAddingCoach] = useState(false);
  const [addCoachError, setAddCoachError] = useState('');
  const [removingCoachId, setRemovingCoachId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'company_admin' || !user.coachInstanceId) {
      router.replace('/');
    }
  }, [user, router]);

  useEffect(() => {
    if (!user?.organizationId) return;
    Promise.all([
      fetch('/api/team/members').then(r => r.json()),
      fetch('/api/team/candidates').then(r => r.json()),
    ]).then(([membersData, candidatesData]) => {
      setMembers(membersData.members ?? []);
      setOrgInviteToken(membersData.inviteToken ?? '');
      setCandidates(candidatesData.candidates ?? []);
      setLoading(false);
    });
    loadCoachConnections();
  }, [user]);

  async function loadCoachConnections() {
    setCoachesLoading(true);
    try {
      const res = await fetch('/api/company/coaches');
      const data = await res.json();
      setCoachConnections(
        (data.connections ?? []).map((c: any) => ({
          id: c.id,
          coachName: c.coachName,
          coachEmail: c.coachEmail,
          permissionLevel: c.permission_level,
          status: c.status,
        }))
      );
    } catch (err) {
      console.error('Failed to load coach connections:', err);
    } finally {
      setCoachesLoading(false);
    }
  }

  async function handleAddCoach() {
    if (!coachInviteToken.trim()) return;
    setAddingCoach(true);
    setAddCoachError('');
    try {
      const res = await fetch('/api/company/coaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteToken: coachInviteToken.trim(), permissionLevel: coachPermission }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send request');
      setShowAddCoach(false);
      setCoachInviteToken('');
      await loadCoachConnections();
    } catch (err: any) {
      setAddCoachError(err.message);
    } finally {
      setAddingCoach(false);
    }
  }

  const copyInvite = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedInvite(key);
    setTimeout(() => setCopiedInvite(''), 2000);
  };

  const deactivate = async (memberId: string) => {
    if (!confirm('Deactivate this team member?')) return;
    await fetch(`/api/team/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    });
    setMembers(m => m.map(x => x.id === memberId ? { ...x, status: 'rejected' } : x));
  };

  const saveModules = async (memberId: string) => {
    await fetch(`/api/team/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_access: modulesDraft }),
    });
    setMembers(m => m.map(x => x.id === memberId ? { ...x, scenario_access: modulesDraft } : x));
    setEditingModules(null);
  };

  const addInviteScenario = () =>
    setInviteScenarios(s => [...s, { scenario_type: 'technician', count: 1 }]);

  const removeInviteScenario = (i: number) =>
    setInviteScenarios(s => s.filter((_, idx) => idx !== i));

  const updateInviteScenario = (i: number, field: keyof AssignedScenario, value: string | number) =>
    setInviteScenarios(s => s.map((x, idx) => idx === i ? { ...x, [field]: value } : x));

  const sendInvite = async () => {
    setInviteError('');
    if (!inviteEmail) { setInviteError('Email is required.'); return; }
    setInviteLoading(true);
    const res = await fetch('/api/team/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: inviteEmail,
        full_name: inviteName || undefined,
        assigned_scenarios: inviteScenarios,
      }),
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
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`Failed to send upgrade email: ${data.error ?? 'Unknown error'}`);
      return;
    }
    alert('Upgrade email sent!');
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-400',
      signed_up: 'bg-blue-500/10 text-blue-400',
      in_progress: 'bg-purple-500/10 text-purple-400',
      complete: 'bg-green-500/10 text-green-400',
      upgraded: 'bg-gray-500/10 text-gray-400',
      approved: 'bg-green-500/10 text-green-400',
      rejected: 'bg-red-500/10 text-red-400',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[status] ?? 'bg-gray-500/10 text-gray-400'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AppNav />
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">My Team</h1>
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
        <div className="flex gap-1 border-b border-white/10 pb-0">
          {(['employees', 'candidates', 'coaches'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t === 'coaches') loadCoachConnections(); }}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors capitalize ${tab === t ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500 py-20 text-center">Loading…</p>
        ) : tab === 'coaches' ? (
          // ── Coaches Tab ─────────────────────────────────────────────────
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Coaches</h2>
                <p className="text-sm text-gray-400">Invite a coach to access your team&apos;s sessions and playbooks</p>
              </div>
              <button
                onClick={() => setShowAddCoach(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
              >
                + Add Coach
              </button>
            </div>

            {showAddCoach && (
              <div className="bg-gray-800 rounded-xl p-5 flex flex-col gap-4 border border-gray-700">
                <h3 className="text-white font-medium">Add a Consulting Coach</h3>

                <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3 text-sm text-yellow-300">
                  <strong>Before you continue:</strong> The coach will be able to view your users, training sessions, and recordings.
                  {coachPermission === 'edit_playbooks' && ' They will also be able to edit your playbooks.'}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-400">Coach Invite Code</label>
                  <input
                    type="text"
                    value={coachInviteToken}
                    onChange={(e) => setCoachInviteToken(e.target.value)}
                    placeholder="Paste the coach's invite code here"
                    className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500">Ask your coach to share their invite code from their dashboard.</p>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-400">Permission Level</label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="permission"
                        value="readonly"
                        checked={coachPermission === 'readonly'}
                        onChange={() => setCoachPermission('readonly')}
                        className="mt-0.5 accent-blue-500"
                      />
                      <div>
                        <p className="text-sm text-white">View only</p>
                        <p className="text-xs text-gray-400">Coach can view sessions and recordings but cannot edit playbooks</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="permission"
                        value="edit_playbooks"
                        checked={coachPermission === 'edit_playbooks'}
                        onChange={() => setCoachPermission('edit_playbooks')}
                        className="mt-0.5 accent-blue-500"
                      />
                      <div>
                        <p className="text-sm text-white">Edit playbooks</p>
                        <p className="text-xs text-gray-400">Coach can view sessions, recordings, and edit your custom playbooks</p>
                      </div>
                    </label>
                  </div>
                </div>

                {addCoachError && <p className="text-red-400 text-sm">{addCoachError}</p>}

                <div className="flex gap-2">
                  <button
                    onClick={handleAddCoach}
                    disabled={addingCoach || !coachInviteToken.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm rounded-lg font-medium transition-colors"
                  >
                    {addingCoach ? 'Sending Request...' : 'Send Request'}
                  </button>
                  <button
                    onClick={() => { setShowAddCoach(false); setAddCoachError(''); setCoachInviteToken(''); }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {coachesLoading ? (
              <p className="text-gray-500 text-sm">Loading...</p>
            ) : coachConnections.length === 0 ? (
              <p className="text-gray-500 text-sm">No coaches connected yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {coachConnections.map((conn) => (
                  <div key={conn.id} className="bg-gray-800 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <p className="text-white font-medium">{conn.coachName}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          conn.status === 'active'
                            ? 'bg-green-900/50 text-green-400'
                            : 'bg-yellow-900/50 text-yellow-400'
                        }`}>
                          {conn.status === 'active' ? 'Active' : 'Awaiting coach approval'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {conn.permissionLevel === 'edit_playbooks' ? 'Can edit playbooks' : 'View only'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm(`Remove ${conn.coachName}? They will lose access immediately.`)) return;
                        setRemovingCoachId(conn.id);
                        const res = await fetch(`/api/company/coaches/${conn.id}`, { method: 'DELETE' });
                        if (res.ok) {
                          setCoachConnections((prev) => prev.filter((c) => c.id !== conn.id));
                        } else {
                          alert('Failed to remove coach. Please try again.');
                        }
                        setRemovingCoachId(null);
                      }}
                      disabled={removingCoachId === conn.id}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
                    >
                      {removingCoachId === conn.id ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : tab === 'employees' ? (
          // ── Employees Tab ───────────────────────────────────────────────
          members.length === 0 ? (
            <p className="text-gray-500 py-20 text-center text-sm">No team members yet. Share your invite link above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-white/10">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Sessions</th>
                    <th className="pb-3 font-medium">Modules</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {members.map(m => (
                    <tr key={m.id} className="group">
                      <td className="py-3 text-white">{m.full_name}</td>
                      <td className="py-3 text-gray-400">{m.email}</td>
                      <td className="py-3">{statusBadge(m.status)}</td>
                      <td className="py-3 text-gray-400">{m.sessionCount}</td>
                      <td className="py-3">
                        {editingModules === m.id ? (
                          <div className="flex flex-col gap-1">
                            {SCENARIO_OPTIONS.map(opt => (
                              <label key={opt.id} className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={modulesDraft.includes(opt.id)}
                                  onChange={e => setModulesDraft(d =>
                                    e.target.checked ? [...d, opt.id] : d.filter(x => x !== opt.id)
                                  )}
                                  className="w-3 h-3 rounded"
                                />
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
                            <button
                              onClick={() => { setEditingModules(m.id); setModulesDraft(m.scenario_access ?? []); }}
                              className="text-[10px] text-gray-600 hover:text-blue-400 transition-colors ml-1"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {m.status !== 'rejected' && (
                          <button
                            onClick={() => deactivate(m.id)}
                            className="text-xs text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          // ── Candidates Tab ──────────────────────────────────────────────
          candidates.length === 0 ? (
            <p className="text-gray-500 py-20 text-center text-sm">No candidates yet. Click &quot;Invite Candidate&quot; to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-white/10">
                    <th className="pb-3 font-medium">Name / Email</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Progress</th>
                    <th className="pb-3 font-medium">Invited</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {candidates.map(c => (
                    <tr key={c.id}>
                      <td className="py-3">
                        <p className="text-white font-medium">{c.full_name ?? '—'}</p>
                        <p className="text-gray-500 text-xs">{c.email}</p>
                      </td>
                      <td className="py-3">{statusBadge(c.status)}</td>
                      <td className="py-3 text-gray-400 text-xs">
                        {c.progress.sessionsComplete} / {c.progress.sessionsTotal} sessions
                      </td>
                      <td className="py-3 text-gray-500 text-xs">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2 flex-wrap">
                          {c.status === 'pending' && (
                            <>
                              <button
                                onClick={() => copyInvite(c.invite_url, c.id)}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                {copiedInvite === c.id ? 'Copied!' : 'Copy link'}
                              </button>
                              <button
                                onClick={() => revokeInvite(c.id)}
                                className="text-xs text-red-500 hover:text-red-400 transition-colors"
                              >
                                Revoke
                              </button>
                            </>
                          )}
                          {(c.status === 'signed_up' || c.status === 'in_progress') && (
                            <a href="/sessions" className="text-xs text-gray-400 hover:text-white transition-colors">
                              View sessions
                            </a>
                          )}
                          {c.status === 'complete' && (
                            <>
                              <a href="/sessions" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                                View results
                              </a>
                              <button
                                onClick={() => sendUpgradeEmail(c.id)}
                                className="text-xs text-green-400 hover:text-green-300 transition-colors"
                              >
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
          )
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Invite Candidate</h2>

            {newInviteUrl ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">Invite created! Share this link with your candidate:</p>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs text-gray-300 bg-gray-800 border border-white/10 rounded-lg px-3 py-2 break-all">
                    {newInviteUrl}
                  </code>
                  <button
                    onClick={() => copyInvite(newInviteUrl, 'modal')}
                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg whitespace-nowrap"
                  >
                    {copiedInvite === 'modal' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="w-full text-sm text-gray-400 hover:text-white border border-white/10 rounded-xl py-2 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Candidate email *</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="candidate@email.com"
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name (optional)</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={e => setInviteName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-2">Assigned sessions *</label>
                  <div className="space-y-2">
                    {inviteScenarios.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <select
                          value={s.scenario_type}
                          onChange={e => updateInviteScenario(i, 'scenario_type', e.target.value)}
                          className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                        >
                          {SCENARIO_OPTIONS.map(o => (
                            <option key={o.id} value={o.id}>{o.label}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={s.count}
                          onChange={e => updateInviteScenario(i, 'count', parseInt(e.target.value) || 1)}
                          className="w-16 bg-gray-800 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none"
                        />
                        {inviteScenarios.length > 1 && (
                          <button onClick={() => removeInviteScenario(i)} className="text-gray-600 hover:text-red-400 text-sm">×</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addInviteScenario}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    + Add scenario
                  </button>
                </div>

                {inviteError && <p className="text-red-400 text-xs">{inviteError}</p>}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 text-sm text-gray-400 hover:text-white border border-white/10 rounded-xl py-2 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendInvite}
                    disabled={inviteLoading}
                    className="flex-1 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-xl py-2 transition-colors"
                  >
                    {inviteLoading ? 'Creating…' : 'Create Invite'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
