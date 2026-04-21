'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { SkeletonRow } from '@/components/skeleton';

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  organizationName: string | null;
  createdAt: string;
  sessionCount: number;
  totalMinutes: number;
  avgScore: number | null;
}

const ROLES = ['individual', 'company_admin', 'coach', 'superuser'];
const STATUSES = ['pending', 'approved', 'rejected'];

function roleColor(role: string) {
  switch (role) {
    case 'superuser':    return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    case 'coach':        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'company_admin': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    default:             return 'bg-white/10 text-gray-300 border-white/20';
  }
}

function statusColor(status: string) {
  switch (status) {
    case 'approved': return 'bg-green-500/20 text-green-300 border-green-500/30';
    case 'rejected': return 'bg-red-500/20 text-red-300 border-red-500/30';
    default:         return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
  }
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {label}
    </span>
  );
}

interface EditModalProps {
  user: AdminUser;
  onClose: () => void;
  onSave: (userId: string, role: string, status: string) => Promise<void>;
}

function EditModal({ user, onClose, onSave }: EditModalProps) {
  const [role, setRole] = useState(user.role);
  const [status, setStatus] = useState(user.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(user.id, role, status);
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-5 shadow-2xl">
        <div>
          <h2 className="text-base font-semibold text-white">Edit User</h2>
          <p className="text-sm text-gray-400 mt-0.5 truncate">{user.email}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {ROLES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm text-gray-400 border border-white/10 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setUsers(json.users ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = useMemo(() => {
    return users.filter(u => {
      const q = search.toLowerCase();
      const matchSearch = !q || u.email.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q);
      const matchRole = !roleFilter || u.role === roleFilter;
      const matchStatus = !statusFilter || u.status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const handleSave = async (userId: string, role: string, status: string) => {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_role: role, status }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? 'Save failed');
    }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role, status } : u));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Delete failed');
      }
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDeleteConfirm(false);
    } catch (e: any) {
      alert(e.message ?? 'Delete failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin"
            className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Admin
          </Link>
          <span className="text-gray-600">/</span>
          <h1 className="text-xl font-bold text-white">Users</h1>
          {!loading && (
            <span className="ml-auto text-sm text-gray-500">{users.length} total</span>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-gray-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="bg-gray-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-gray-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300 mb-6">
            {error}
            <button onClick={fetchUsers} className="ml-3 underline hover:no-underline">Retry</button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
            {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )}

        {/* Desktop table */}
        {!loading && !error && (
          <>
            <div className="hidden md:block bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Name / Email</th>
                    <th className="text-left px-4 py-3 font-medium">Role</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Org</th>
                    <th className="text-right px-4 py-3 font-medium">Sessions</th>
                    <th className="text-right px-4 py-3 font-medium">Time (min)</th>
                    <th className="text-right px-4 py-3 font-medium">Avg Score</th>
                    <th className="text-right px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-500 text-sm">
                        No users found
                      </td>
                    </tr>
                  )}
                  {filtered.map((u, i) => (
                    <tr
                      key={u.id}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${i === filtered.length - 1 ? 'border-b-0' : ''}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-white">{u.fullName || '—'}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{u.email}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge label={u.role} colorClass={roleColor(u.role)} />
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge label={u.status} colorClass={statusColor(u.status)} />
                      </td>
                      <td className="px-4 py-3.5 text-gray-400 text-xs">{u.organizationName ?? '—'}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-gray-300">{u.sessionCount}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-gray-300">{u.totalMinutes}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {u.avgScore != null ? (
                          <span className={u.avgScore >= 7 ? 'text-green-400' : u.avgScore >= 5 ? 'text-yellow-400' : 'text-red-400'}>
                            {u.avgScore}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditTarget(u)}
                            className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-blue-500/10 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => { setDeleteTarget(u); setDeleteConfirm(false); }}
                            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filtered.length === 0 && (
                <p className="text-center py-12 text-gray-500 text-sm">No users found</p>
              )}
              {filtered.map(u => (
                <div key={u.id} className="bg-gray-900 border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-white truncate">{u.fullName || '—'}</div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">{u.email}</div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Badge label={u.role} colorClass={roleColor(u.role)} />
                      <Badge label={u.status} colorClass={statusColor(u.status)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-lg font-semibold text-white tabular-nums">{u.sessionCount}</div>
                      <div className="text-xs text-gray-500">Sessions</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-white tabular-nums">{u.totalMinutes}m</div>
                      <div className="text-xs text-gray-500">Time</div>
                    </div>
                    <div>
                      <div className={`text-lg font-semibold tabular-nums ${u.avgScore != null ? (u.avgScore >= 7 ? 'text-green-400' : u.avgScore >= 5 ? 'text-yellow-400' : 'text-red-400') : 'text-gray-600'}`}>
                        {u.avgScore ?? '—'}
                      </div>
                      <div className="text-xs text-gray-500">Avg Score</div>
                    </div>
                  </div>
                  {u.organizationName && (
                    <div className="text-xs text-gray-500">Org: {u.organizationName}</div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setEditTarget(u)}
                      className="flex-1 text-sm text-blue-400 border border-blue-500/30 rounded-lg py-1.5 hover:bg-blue-500/10 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { setDeleteTarget(u); setDeleteConfirm(false); }}
                      className="flex-1 text-sm text-red-400 border border-red-500/30 rounded-lg py-1.5 hover:bg-red-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Edit modal */}
      {editTarget && (
        <EditModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={handleSave}
        />
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h2 className="text-base font-semibold text-white">Delete User</h2>
            <p className="text-sm text-gray-400">
              Are you sure you want to permanently delete{' '}
              <span className="text-white font-medium">{deleteTarget.email}</span>?
              This cannot be undone.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 rounded-lg text-sm text-gray-400 border border-white/10 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
