'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { AppNav } from '@/components/nav';

export default function AccountPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  // Initialise fields once user loads (guards against auth loading race)
  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setEmail(user.email);
    }
  }, [user?.id]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Danger Zone modal state
  const [showDangerModal, setShowDangerModal] = useState(false);
  const [dangerStep, setDangerStep] = useState<1 | 2 | 3>(1);
  const [dangerAction, setDangerAction] = useState<'suspend' | 'delete' | null>(null);
  const [dangerReason, setDangerReason] = useState('');
  const [dangerReasonDetail, setDangerReasonDetail] = useState('');
  const [dangerConfirmText, setDangerConfirmText] = useState('');
  const [dangerLoading, setDangerLoading] = useState(false);
  const [dangerError, setDangerError] = useState('');

  function openDangerModal() {
    setShowDangerModal(true);
    setDangerStep(1);
    setDangerAction(null);
    setDangerReason('');
    setDangerReasonDetail('');
    setDangerConfirmText('');
    setDangerError('');
  }

  async function handleDangerConfirm() {
    if (!dangerAction || !dangerReason) return;
    if (dangerAction === 'delete' && dangerConfirmText !== 'DELETE') return;
    setDangerLoading(true);
    setDangerError('');
    try {
      const res = await fetch('/api/account/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: dangerAction,
          reason: dangerReason,
          reasonDetail: dangerReasonDetail || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDangerError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      // Sign out and redirect to marketing homepage
      window.location.href = '/';
    } catch {
      setDangerError('Network error. Please try again.');
    } finally {
      setDangerLoading(false);
    }
  }

  const isIndividual = user?.role === 'individual';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    const res = await fetch('/api/account', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? 'Failed to save changes.');
      return;
    }

    await refreshUser();
    setSuccess(true);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AppNav />
      <div className="max-w-xl mx-auto px-6 sm:px-10 py-12">
        <h1 className="text-2xl font-bold text-white mb-1">Account Settings</h1>
        <p className="text-sm text-gray-500 mb-8">
          {isIndividual ? 'Update your name and email address.' : 'Your account details.'}
        </p>

        <div className="bg-gray-900 border border-white/10 rounded-2xl p-8">
          {isIndividual ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Full name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
                {email !== user.email && (
                  <p className="text-xs text-yellow-400 mt-1.5">
                    A confirmation will be sent to your new email address.
                  </p>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              {success && (
                <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  Changes saved.
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Full name</p>
                <p className="text-sm text-white">{user.fullName || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Email</p>
                <p className="text-sm text-white">{user.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Role</p>
                <p className="text-sm text-white capitalize">{user.role.replace('_', ' ')}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── DANGER ZONE ── */}
        <div className="mt-12 border border-red-500/20 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wide mb-1">Danger Zone</h2>
          <p className="text-sm text-gray-500 mb-4">
            Suspend or permanently delete your account. Suspending pauses your billing and blocks
            access — your data is preserved. Deletion is permanent and cannot be undone.
          </p>
          <button
            onClick={openDangerModal}
            className="px-4 py-2 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/10 transition-colors"
          >
            Manage Account Status
          </button>
        </div>

        {/* ── DANGER ZONE MODAL ── */}
        {showDangerModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-md w-full">

              {/* Step 1: Choose action */}
              {dangerStep === 1 && (
                <>
                  <h3 className="text-lg font-bold text-white mb-1">What would you like to do?</h3>
                  <p className="text-sm text-gray-500 mb-6">Choose an option below.</p>
                  <div className="space-y-3 mb-6">
                    <button
                      onClick={() => setDangerAction('suspend')}
                      className={`w-full text-left p-4 rounded-xl border transition-colors ${
                        dangerAction === 'suspend'
                          ? 'border-indigo-500/60 bg-indigo-500/10'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="font-semibold text-white text-sm mb-1">Temporarily suspend</div>
                      <p className="text-xs text-gray-500">
                        Pause your subscription and block access. Your data is preserved.
                        You can reactivate anytime by contacting us.
                      </p>
                    </button>
                    <button
                      onClick={() => setDangerAction('delete')}
                      className={`w-full text-left p-4 rounded-xl border transition-colors ${
                        dangerAction === 'delete'
                          ? 'border-red-500/60 bg-red-500/10'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="font-semibold text-red-400 text-sm mb-1">Permanently delete</div>
                      <p className="text-xs text-gray-500">
                        Cancel your subscription and erase all records. This cannot be undone.
                      </p>
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDangerModal(false)}
                      className="flex-1 py-2.5 border border-white/10 text-gray-400 rounded-xl text-sm hover:border-white/20 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => dangerAction && setDangerStep(2)}
                      disabled={!dangerAction}
                      className="flex-1 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                    >
                      Continue →
                    </button>
                  </div>
                </>
              )}

              {/* Step 2: Reason */}
              {dangerStep === 2 && (
                <>
                  <h3 className="text-lg font-bold text-white mb-1">Tell us why</h3>
                  <p className="text-sm text-gray-500 mb-6">Your feedback helps us improve.</p>
                  <div className="space-y-2 mb-4">
                    {[
                      'Price is too high',
                      'No time to use the software',
                      "I've gotten as much out of it as I can",
                      "I don't enjoy using the software",
                      'Other',
                    ].map((r) => (
                      <label key={r} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="dangerReason"
                          value={r}
                          checked={dangerReason === r}
                          onChange={() => { setDangerReason(r); setDangerReasonDetail(''); }}
                          className="accent-indigo-500"
                        />
                        <span className="text-sm text-gray-300">{r}</span>
                      </label>
                    ))}
                  </div>
                  {dangerReason === 'Other' && (
                    <textarea
                      value={dangerReasonDetail}
                      onChange={(e) => setDangerReasonDetail(e.target.value)}
                      placeholder="Tell us more…"
                      rows={3}
                      className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none mb-4"
                    />
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDangerStep(1)}
                      className="flex-1 py-2.5 border border-white/10 text-gray-400 rounded-xl text-sm hover:border-white/20 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => dangerReason && setDangerStep(3)}
                      disabled={!dangerReason}
                      className="flex-1 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                    >
                      Continue →
                    </button>
                  </div>
                </>
              )}

              {/* Step 3: Confirm */}
              {dangerStep === 3 && (
                <>
                  <h3 className="text-lg font-bold text-white mb-1">
                    {dangerAction === 'suspend' ? 'Confirm suspension' : 'Confirm deletion'}
                  </h3>
                  <p className="text-sm text-gray-500 mb-6">
                    {dangerAction === 'suspend'
                      ? 'Your subscription will be paused and you will be signed out immediately. Contact us to reactivate.'
                      : 'This will permanently delete your account, all session history, and all playbooks. Type DELETE to confirm.'}
                  </p>
                  {dangerAction === 'delete' && (
                    <input
                      type="text"
                      value={dangerConfirmText}
                      onChange={(e) => setDangerConfirmText(e.target.value)}
                      placeholder="Type DELETE to confirm"
                      className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors mb-4"
                    />
                  )}
                  {dangerError && (
                    <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
                      {dangerError}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDangerStep(2)}
                      className="flex-1 py-2.5 border border-white/10 text-gray-400 rounded-xl text-sm hover:border-white/20 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleDangerConfirm}
                      disabled={dangerLoading || (dangerAction === 'delete' && dangerConfirmText !== 'DELETE')}
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {dangerLoading
                        ? 'Processing…'
                        : dangerAction === 'suspend'
                          ? 'Suspend My Account'
                          : 'Permanently Delete My Account'}
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        )}

        <button
          onClick={() => router.back()}
          className="mt-6 text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
