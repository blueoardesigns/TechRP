'use client';

import { useEffect, useState } from 'react';
import * as React from 'react';
import { useAuth } from '@/components/auth-provider';
import { AppNav } from '@/components/nav';
import { useRouter } from 'next/navigation';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

interface CoachInstance {
  id: string; name: string; invite_token: string;
  auto_approve_users: boolean;
  global_playbooks_enabled: boolean;
  global_personas_enabled: boolean;
}
interface Company { id: string; name: string; invite_token: string; userCount: number; }
interface CoachUser { id: string; full_name: string; email: string; app_role: string; status: string; sessionCount: number; }

export default function CoachPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [instance, setInstance] = useState<CoachInstance | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<CoachUser[]>([]);
  const [tab, setTab] = useState<'companies' | 'users' | 'content'>('companies');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [addingCompany, setAddingCompany] = useState(false);
  const [copiedToken, setCopiedToken] = useState('');
  const [playbookAccessOrgId, setPlaybookAccessOrgId] = React.useState<string | null>(null);
  const [orgPlaybooks, setOrgPlaybooks] = React.useState<{ id: string; name: string; scenario_type: string | null; visible: boolean }[]>([]);
  const [playbookAccessLoading, setPlaybookAccessLoading] = React.useState(false);
  const [playbookAccessSaving, setPlaybookAccessSaving] = React.useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'coach') { router.replace('/'); return; }
    fetch('/api/coach/instance').then(r => r.json()).then(d => setInstance(d.instance));
    fetch('/api/coach/companies').then(r => r.json()).then(d => setCompanies(d.companies ?? []));
    fetch('/api/coach/users').then(r => r.json()).then(d => setUsers(d.users ?? []));
  }, [user, router]);

  const copyLink = (token: string, type: 'coach' | 'org') => {
    const url = type === 'coach'
      ? `${APP_URL}/signup?coach=${token}`
      : `${APP_URL}/signup?org=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(''), 2000);
  };

  const toggleSetting = async (key: string, value: boolean) => {
    await fetch('/api/coach/instance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
    setInstance(i => i ? { ...i, [key]: value } as CoachInstance : i);
  };

  const addCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    setAddingCompany(true);
    const res = await fetch('/api/coach/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCompanyName }),
    });
    const data = await res.json();
    if (data.company) setCompanies(c => [data.company, ...c]);
    setNewCompanyName('');
    setAddingCompany(false);
  };

  async function loadOrgPlaybooks(orgId: string) {
    setPlaybookAccessLoading(true);
    setPlaybookAccessOrgId(orgId);
    try {
      const res = await fetch(`/api/coach/companies/${orgId}/playbooks`);
      const data = await res.json();
      setOrgPlaybooks(data.playbooks ?? []);
    } finally {
      setPlaybookAccessLoading(false);
    }
  }

  async function saveOrgPlaybooks(orgId: string) {
    setPlaybookAccessSaving(true);
    try {
      const selectedIds = orgPlaybooks.filter((p) => p.visible).map((p) => p.id);
      await fetch(`/api/coach/companies/${orgId}/playbooks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playbookIds: selectedIds }),
      });
      setPlaybookAccessOrgId(null);
    } finally {
      setPlaybookAccessSaving(false);
    }
  }

  const deactivateUser = async (userId: string) => {
    if (!confirm('Deactivate this user?')) return;
    await fetch(`/api/coach/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    });
    setUsers(u => u.map(x => x.id === userId ? { ...x, status: 'rejected' } : x));
  };

  if (!instance) return null;

  const TABS = [
    { key: 'companies', label: 'Client Companies' },
    { key: 'users',     label: 'All Users' },
    { key: 'content',   label: 'Content' },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AppNav />
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 space-y-8">

        {/* Header + invite link */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{instance.name}</h1>
            <p className="text-gray-500 text-sm mt-0.5">Coach Dashboard</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs text-gray-400 bg-gray-900 border border-white/10 rounded-lg px-3 py-2 max-w-xs truncate">
              {APP_URL}/signup?coach={instance.invite_token}
            </code>
            <button
              onClick={() => copyLink(instance.invite_token, 'coach')}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              {copiedToken === instance.invite_token ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/10 pb-0">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm rounded-t-md transition-colors ${tab === t.key ? 'text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Companies tab */}
        {tab === 'companies' && (
          <div className="space-y-4">
            <form onSubmit={addCompany} className="flex gap-2">
              <input
                value={newCompanyName}
                onChange={e => setNewCompanyName(e.target.value)}
                placeholder="Client company name…"
                className="flex-1 bg-gray-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={addingCompany}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {addingCompany ? 'Adding…' : 'Add Company'}
              </button>
            </form>
            <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-gray-500 text-xs uppercase tracking-widest">
                    <th className="text-left px-5 py-3">Company</th>
                    <th className="text-left px-5 py-3">Users</th>
                    <th className="text-left px-5 py-3">Admin Invite URL</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map(c => (
                    <React.Fragment key={c.id}>
                      <tr className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-5 py-3 font-medium">{c.name}</td>
                        <td className="px-5 py-3 text-gray-400">{c.userCount}</td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => copyLink(c.invite_token, 'org')}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            {copiedToken === c.invite_token ? 'Copied!' : 'Copy invite link'}
                          </button>
                        </td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td colSpan={3} className="px-5 pb-3">
                          {/* Playbook Access toggle */}
                          <div className="mt-3 border-t border-gray-700 pt-3">
                            {playbookAccessOrgId === c.id ? (
                              <div className="flex flex-col gap-2">
                                <p className="text-sm font-medium text-gray-300">Playbook Access</p>
                                {playbookAccessLoading ? (
                                  <p className="text-xs text-gray-500">Loading...</p>
                                ) : orgPlaybooks.length === 0 ? (
                                  <p className="text-xs text-gray-500">No playbooks in your instance yet.</p>
                                ) : (
                                  <>
                                    <p className="text-xs text-gray-500">
                                      {orgPlaybooks.every((p) => p.visible) ? 'All playbooks visible (default)' : `${orgPlaybooks.filter((p) => p.visible).length} of ${orgPlaybooks.length} playbooks visible`}
                                    </p>
                                    <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                                      {orgPlaybooks.map((p) => (
                                        <label key={p.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={p.visible}
                                            onChange={(e) =>
                                              setOrgPlaybooks((prev) =>
                                                prev.map((pb) => pb.id === p.id ? { ...pb, visible: e.target.checked } : pb)
                                              )
                                            }
                                            className="accent-blue-500"
                                          />
                                          {p.name}
                                          {p.scenario_type && (
                                            <span className="text-xs text-gray-500">({p.scenario_type})</span>
                                          )}
                                        </label>
                                      ))}
                                    </div>
                                    <div className="flex gap-2 mt-1">
                                      <button
                                        onClick={() => saveOrgPlaybooks(c.id)}
                                        disabled={playbookAccessSaving}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs rounded-lg transition-colors"
                                      >
                                        {playbookAccessSaving ? 'Saving...' : 'Save'}
                                      </button>
                                      <button
                                        onClick={() => setPlaybookAccessOrgId(null)}
                                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => loadOrgPlaybooks(c.id)}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                Manage Playbook Access →
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                  {companies.length === 0 && (
                    <tr><td colSpan={3} className="px-5 py-10 text-center text-gray-500">No client companies yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Users tab */}
        {tab === 'users' && (
          <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-500 text-xs uppercase tracking-widest">
                  <th className="text-left px-5 py-3">Name</th>
                  <th className="text-left px-5 py-3">Role</th>
                  <th className="text-left px-5 py-3">Sessions</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-5 py-3">
                      <p className="font-medium">{u.full_name}</p>
                      <p className="text-gray-500 text-xs">{u.email}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-400 capitalize">{u.app_role.replace('_', ' ')}</td>
                    <td className="px-5 py-3 text-gray-400">{u.sessionCount}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.status === 'approved' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {u.status === 'approved' && (
                        <button onClick={() => deactivateUser(u.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-500">No users yet. Share your invite link to get started.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Content tab */}
        {tab === 'content' && (
          <div className="space-y-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-sm text-gray-300">Global TechRP Content</h3>
              {([
                ['global_playbooks_enabled', 'Include TechRP default playbooks'],
                ['global_personas_enabled',  'Include TechRP default personas'],
                ['auto_approve_users',        'Auto-approve new signups'],
              ] as const).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">{label}</span>
                  <button
                    onClick={() => toggleSetting(key, !instance[key])}
                    className={`w-10 h-6 rounded-full transition-colors ${instance[key] ? 'bg-blue-600' : 'bg-gray-700'}`}
                  >
                    <span className={`block w-4 h-4 bg-white rounded-full mx-1 transition-transform ${instance[key] ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
            </div>
            <a
              href="/playbooks"
              className="block text-center bg-gray-900 border border-white/10 hover:border-white/20 rounded-2xl py-4 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Manage Playbooks →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
