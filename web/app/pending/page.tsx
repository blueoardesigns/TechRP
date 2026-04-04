'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';

export default function PendingPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await fetch('/api/auth/resend-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email }),
      });
      setResent(true);
    } finally {
      setResending(false);
    }
  };

  const isRejected = user?.status === 'rejected';

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-5">

        <div className={`w-16 h-16 ${isRejected ? 'bg-red-500/15 border-red-500/20' : 'bg-yellow-500/15 border-yellow-500/20'} border rounded-full flex items-center justify-center mx-auto`}>
          <span className="text-3xl">{isRejected ? '✋' : '⏳'}</span>
        </div>

        {isRejected ? (
          <>
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Application Not Approved</h1>
              <p className="text-gray-400 text-sm leading-relaxed">
                Your account request was not approved at this time. If you believe this is an error, please reach out directly.
              </p>
            </div>
            <a
              href="mailto:tim@blueoardesigns.com"
              className="inline-block text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Contact tim@blueoardesigns.com →
            </a>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Pending Approval</h1>
              <p className="text-gray-400 text-sm leading-relaxed">
                Your account is being reviewed. You&apos;ll receive an email at{' '}
                <span className="text-white font-medium">{user?.email ?? 'your email'}</span>{' '}
                once you&apos;re approved — usually within 24 hours.
              </p>
            </div>

            <div className="bg-gray-900 border border-white/10 rounded-xl px-5 py-4 text-left space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">What happens next</p>
              <ul className="text-sm text-gray-400 space-y-1.5">
                <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">→</span> Your request has been sent for review</li>
                <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">→</span> You&apos;ll get an email when approved</li>
                <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">→</span> Sign back in to start training</li>
              </ul>
            </div>

            {resent ? (
              <p className="text-sm text-green-400">Approval request resent.</p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
              >
                {resending ? 'Resending…' : 'Resend approval request'}
              </button>
            )}
          </>
        )}

        <button
          onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors block mx-auto"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
