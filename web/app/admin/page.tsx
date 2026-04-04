'use client';

import { useEffect, useState } from 'react';

interface CoachRow {
  id: string;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
  coach_instances: { id: string; name: string; invite_token: string }[];
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default function AdminPage() {
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', instanceName: '' });
  const [creating, setCreating] = useState(false);
  const [newInviteUrl, setNewInviteUrl] = useState('');

  const fetchCoaches = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/coaches');
    const data = await res.json();
    setCoaches(data.coaches ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchCoaches(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const res = await fetch('/api/admin/coaches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setCreating(false);
    if (data.inviteUrl) {
      setNewInviteUrl(data.inviteUrl);
      setForm({ fullName: '', email: '', instanceName: '' });
      setShowModal(false);
      fetchCoaches();
    } else {
      alert(data.error ?? 'Failed to create coach');
    }
  };

  const handleDeactivate = async (coachId: string) => {
    if (!confirm('Deactivate this coach?')) return;
    await fetch('/api/admin/coaches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId }),
    });
    fetchCoaches();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Coach Management</h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Create Coach
          </button>
        </div>

        {newInviteUrl && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-sm">
            <p className="text-green-400 font-medium mb-1">Coach created! Invite URL:</p>
            <code className="text-green-300 break-all">{newInviteUrl}</code>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 py-10 text-center">Loading…</p>
        ) : (
          <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-500 text-xs uppercase tracking-widest">
                  <th className="text-left px-5 py-3">Name</th>
                  <th className="text-left px-5 py-3">Email</th>
                  <th className="text-left px-5 py-3">Instance</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Invite URL</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {coaches.map(c => {
                  const inst = c.coach_instances?.[0];
                  return (
                    <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-5 py-3 font-medium">{c.full_name}</td>
                      <td className="px-5 py-3 text-gray-400">{c.email}</td>
                      <td className="px-5 py-3 text-gray-400">{inst?.name ?? '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'approved' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {inst ? (
                          <button
                            onClick={() => navigator.clipboard.writeText(`${APP_URL}/signup?coach=${inst.invite_token}`)}
                            className="hover:text-white transition-colors"
                          >
                            Copy link
                          </button>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {c.status === 'approved' && (
                          <button onClick={() => handleDeactivate(c.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {coaches.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">No coaches yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
              <h2 className="text-lg font-bold">Create Coach</h2>
              <form onSubmit={handleCreate} className="space-y-3">
                {(['fullName', 'email', 'instanceName'] as const).map(field => (
                  <input
                    key={field}
                    type={field === 'email' ? 'email' : 'text'}
                    placeholder={field === 'fullName' ? 'Full name' : field === 'email' ? 'Email address' : 'Practice / company name'}
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    required
                    className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                ))}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-white/10 text-gray-400 hover:text-white rounded-lg py-2.5 text-sm transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={creating} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50">
                    {creating ? 'Creating…' : 'Create Coach'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
