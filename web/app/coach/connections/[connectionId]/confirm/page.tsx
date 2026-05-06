'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Coach-connection confirmation page.
 *
 * Email recipients land here from a single "Review request" link. Accept and
 * Decline are real button clicks that POST to /api/coach/connections/[id]/respond.
 * Link prefetchers (Outlook Safe Links, Slack unfurl, antivirus scanners) can
 * fetch this page but cannot click buttons, so they can't auto-accept.
 */
export default function ConfirmConnectionPage() {
  const params = useParams<{ connectionId: string }>();
  const router = useRouter();
  const token = params.connectionId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<null | 'accept' | 'decline'>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{
    status: string;
    companyName: string | null;
    coachName: string | null;
    permissionLevel: string | null;
  } | null>(null);
  const [done, setDone] = useState<null | 'accepted' | 'declined'>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/coach/connections/${token}/respond`, { method: 'GET' })
      .then(async r => {
        if (!r.ok) throw new Error((await r.json())?.error ?? 'Not found');
        return r.json();
      })
      .then(data => {
        if (cancelled) return;
        setInfo(data);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err?.message ?? 'Could not load request');
        setLoading(false);
      });
    return () => { cancelled = true };
  }, [token]);

  async function submit(action: 'accept' | 'decline') {
    setSubmitting(action);
    setError(null);
    try {
      const res = await fetch(`/api/coach/connections/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Request failed');
        setSubmitting(null);
        return;
      }
      setDone(action === 'accept' ? 'accepted' : 'declined');
      setSubmitting(null);
      if (action === 'accept') {
        setTimeout(() => router.push('/coach'), 2000);
      }
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading request…</p>
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-xl font-bold">Request not found</h1>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-3">
          <h1 className={`text-xl font-bold ${done === 'accepted' ? 'text-emerald-400' : 'text-slate-300'}`}>
            {done === 'accepted' ? 'Connection accepted' : 'Request declined'}
          </h1>
          <p className="text-slate-400 text-sm">
            {done === 'accepted'
              ? `You now have access to ${info?.companyName ?? 'the company'}'s data on TechRP. Redirecting…`
              : `You have declined the request from ${info?.companyName ?? 'the company'}.`}
          </p>
        </div>
      </div>
    );
  }

  if (info?.status && info.status !== 'pending') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-xl font-bold">Already {info.status}</h1>
          <p className="text-slate-400 text-sm">
            This request has already been {info.status}.
          </p>
        </div>
      </div>
    );
  }

  const permissionText =
    info?.permissionLevel === 'edit_playbooks'
      ? 'view their users, training sessions, and recordings — and edit their playbooks.'
      : 'view their users, training sessions, and recordings (read-only).';

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-2xl p-8 space-y-5">
        <h1 className="text-xl font-bold">Connection request</h1>
        <p className="text-slate-300 text-sm leading-relaxed">
          <strong>{info?.companyName ?? 'A company'}</strong> wants to connect with you on TechRP.
          If you accept, you will be able to {permissionText}
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => submit('accept')}
            disabled={submitting !== null}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {submitting === 'accept' ? 'Accepting…' : 'Accept'}
          </button>
          <button
            onClick={() => submit('decline')}
            disabled={submitting !== null}
            className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {submitting === 'decline' ? 'Declining…' : 'Decline'}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          If you didn&apos;t expect this, you can safely close this page.
        </p>
      </div>
    </div>
  );
}
