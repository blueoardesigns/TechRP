'use client';

import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';

export default function PendingPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-5">

        {/* Icon */}
        <div className="w-16 h-16 bg-yellow-500/15 border border-yellow-500/20 rounded-full flex items-center justify-center mx-auto">
          <span className="text-3xl">⏳</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Pending Approval</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Your account is being reviewed. You&apos;ll receive an email at{' '}
            <span className="text-white font-medium">{user?.email ?? 'your email address'}</span>{' '}
            once you&apos;re approved — usually within 24 hours.
          </p>
        </div>

        <div className="bg-gray-900 border border-white/10 rounded-xl px-5 py-4 text-left space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">What happens next</p>
          <ul className="text-sm text-gray-400 space-y-1.5">
            <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">→</span> Your request has been sent for review</li>
            <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">→</span> You&apos;ll get an email when your account is approved</li>
            <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">→</span> Sign back in to start training</li>
          </ul>
        </div>

        <button
          onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
