'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { AppNav } from '@/components/nav';
import { useRouter } from 'next/navigation';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

interface TeamMember {
  id: string; full_name: string; email: string; status: string;
  created_at: string; sessionCount: number;
}

export default function TeamPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgInviteToken, setOrgInviteToken] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'company_admin' || !user.coachInstanceId) {
      router.replace('/');
    }
  }, [user, router]);

  useEffect(() => {
    if (!user?.organizationId) return;

    fetch('/api/team/members')
      .then(r => r.json())
      .then(d => {
        setMembers(d.members ?? []);
        setOrgInviteToken(d.inviteToken ?? '');
        setLoading(false);
      });
  }, [user]);

  const copyInvite = () => {
    navigator.clipboard.writeText(`${APP_URL}/signup?org=${orgInviteToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AppNav />
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">My Team</h1>
          {orgInviteToken && (
            <div className="flex items-center gap-2">
              <code className="text-xs text-gray-400 bg-gray-900 border border-white/10 rounded-lg px-3 py-2 truncate max-w-xs">
                {APP_URL}/signup?org={orgInviteToken}
              </code>
              <button
                onClick={copyInvite}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                {copied ? 'Copied!' : 'Copy invite'}
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-gray-500 py-20 text-center">Loading…</p>
        ) : (
          <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-500 text-xs uppercase tracking-widest">
                  <th className="text-left px-5 py-3">Name</th>
                  <th className="text-left px-5 py-3">Sessions</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-5 py-3">
                      <p className="font-medium">{m.full_name}</p>
                      <p className="text-gray-500 text-xs">{m.email}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-400">{m.sessionCount}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'approved' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {m.status === 'approved' && (
                        <button onClick={() => deactivate(m.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-500">No team members yet. Share your invite link.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
