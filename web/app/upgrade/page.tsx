'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';

function UpgradeInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) setErrorMsg('Invalid upgrade link.');
  }, [token]);

  const handleUpgrade = async () => {
    if (!token) return;
    setStatus('loading');
    const res = await fetch('/api/auth/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error ?? 'Something went wrong.');
      setStatus('error');
      return;
    }
    await refreshUser();
    setStatus('success');
    setTimeout(() => router.push('/training'), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto text-3xl">🚀</div>
        <h1 className="text-2xl font-bold">Activate Full Account</h1>

        {errorMsg ? (
          <p className="text-red-400 text-sm">{errorMsg}</p>
        ) : status === 'success' ? (
          <p className="text-green-400 text-sm">Account upgraded! Redirecting…</p>
        ) : (
          <>
            <p className="text-gray-400 text-sm leading-relaxed">
              Welcome back{user?.fullName ? `, ${user.fullName}` : ''}. Click below to activate your full TechRP account and continue your training.
            </p>
            <button
              onClick={handleUpgrade}
              disabled={status === 'loading' || !token}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              {status === 'loading' ? 'Activating…' : 'Activate Full Account'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <UpgradeInner />
    </Suspense>
  );
}
