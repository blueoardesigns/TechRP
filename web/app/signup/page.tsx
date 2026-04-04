'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const MODULES = [
  {
    id: 'technician',
    icon: '🔧',
    label: 'Technician Scenarios',
    description: 'Homeowner inbound calls, face-to-face visits, plumber referrals',
  },
  {
    id: 'property_manager',
    icon: '🏠',
    label: 'Property Manager',
    description: 'Cold calls and discovery meetings with residential and commercial property managers',
  },
  {
    id: 'insurance',
    icon: '📋',
    label: 'Insurance Broker',
    description: 'Cold calls and discovery meetings with insurance agents and brokers',
  },
  {
    id: 'plumber_bd',
    icon: '🪠',
    label: 'Plumber Business Development',
    description: 'Build referral relationships with plumbing companies',
  },
];

type Step = 'account' | 'modules' | 'tos';

function SignupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const coachToken = searchParams.get('coach');
  const orgToken   = searchParams.get('org');
  const typeParam  = searchParams.get('type');

  // Determine locked role from invite context
  const lockedRole: 'individual' | 'company_admin' | null =
    orgToken ? 'individual' :
    coachToken && typeParam !== 'individual' ? 'company_admin' :
    coachToken && typeParam === 'individual' ? 'individual' :
    null;

  const [coachInfo, setCoachInfo] = useState<{ name: string } | null>(null);
  const [orgInfo, setOrgInfo]     = useState<{ name: string } | null>(null);

  useEffect(() => {
    if (coachToken) {
      fetch(`/api/auth/invite-info?coach=${coachToken}`)
        .then(r => r.json())
        .then(d => { if (d.name) setCoachInfo(d); });
    }
    if (orgToken) {
      fetch(`/api/auth/invite-info?org=${orgToken}`)
        .then(r => r.json())
        .then(d => { if (d.name) setOrgInfo(d); });
    }
  }, [coachToken, orgToken]);

  // Form state
  const [step, setStep] = useState<Step>('account');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'individual' | 'company_admin'>(lockedRole ?? 'individual');
  const [selectedModules, setSelectedModules] = useState<string[]>(['technician']);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [companyName, setCompanyName] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggleModule = (id: string) => {
    setSelectedModules(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleAccountNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    // Skip module selection for org invites (modules inherited from company admin) or company_admin signups
    if (role === 'individual' && !orgToken) {
      setStep('modules');
    } else {
      setStep('tos');
    }
  };

  const handleSubmit = async () => {
    if (!tosAccepted) { setError('Please accept the Terms of Service to continue.'); return; }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          password,
          role,
          companyName: role === 'company_admin' ? companyName : undefined,
          scenarioAccess: orgToken ? [] : role === 'individual' ? selectedModules : ['technician', 'property_manager', 'insurance', 'plumber_bd'],
          coachToken: coachToken ?? undefined,
          orgToken:   orgToken   ?? undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setLoading(false); return; }

      if (data.autoApproved) {
        router.push('/training');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  // ── Success state ────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto text-3xl">🎉</div>
          <h1 className="text-2xl font-bold text-white">Request Received!</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Your account is pending approval. You&apos;ll receive an email at <span className="text-white font-medium">{email}</span> once you&apos;re approved — usually within 24 hours.
          </p>
          <Link href="/login" className="block mt-4 text-sm text-blue-400 hover:text-blue-300 transition-colors">
            Back to login →
          </Link>
        </div>
      </div>
    );
  }

  // ── Shared header ────────────────────────────────────────────────────────────

  const Logo = () => (
    <div className="flex justify-center mb-8">
      <div className="flex items-center gap-2.5">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="url(#g)" />
          <path d="M7 9h18M16 9v14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M10 16h7l4 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3B82F6" /><stop offset="1" stopColor="#6366F1" />
            </linearGradient>
          </defs>
        </svg>
        <span className="font-bold text-lg tracking-tight">TechRP</span>
      </div>
    </div>
  );

  // ── Step 1: Account details ──────────────────────────────────────────────────

  if (step === 'account') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Logo />
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-8">
            <h1 className="text-xl font-bold text-white mb-1">Request Access</h1>
            <p className="text-sm text-gray-500 mb-6">Create your TechRP account</p>

            <form onSubmit={handleAccountNext} className="space-y-4">
              {/* Invite banner */}
              {(coachInfo || orgInfo) && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-sm text-blue-300">
                  You&apos;re joining <strong>{coachInfo?.name ?? orgInfo?.name}</strong>&apos;s training program.
                </div>
              )}

              {/* Account type — hidden when role is locked by invite */}
              {!lockedRole && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Account Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['individual', 'company_admin'] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all text-left ${
                        role === r
                          ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                          : 'bg-gray-800 border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      <span className="block font-semibold">
                        {r === 'individual' ? 'Individual' : 'Company'}
                      </span>
                      <span className="block text-xs opacity-70 mt-0.5">
                        {r === 'individual' ? 'Solo technician' : 'Team / company'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {role === 'company_admin' && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Company Name</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="Acme Restoration"
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                Continue →
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-gray-500 mt-5">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Step 2: Module selection (Individual only) ───────────────────────────────

  if (step === 'modules') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Logo />
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-8">
            <h1 className="text-xl font-bold text-white mb-1">Choose Your Modules</h1>
            <p className="text-sm text-gray-500 mb-6">
              Select the training scenarios you want access to. You can change these later in Account Settings.
            </p>

            <div className="space-y-3 mb-6">
              {MODULES.map(mod => {
                const selected = selectedModules.includes(mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleModule(mod.id)}
                    className={`w-full text-left flex items-start gap-3 p-4 rounded-xl border transition-all ${
                      selected
                        ? 'bg-blue-600/15 border-blue-500/40'
                        : 'bg-gray-800 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                      selected ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
                    }`}>
                      {selected && <span className="text-white text-[10px] font-bold">✓</span>}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span>{mod.icon}</span>
                        <span className="text-sm font-semibold text-white">{mod.label}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{mod.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('account')}
                className="flex-1 py-2.5 text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/25 rounded-xl transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => { if (selectedModules.length === 0) { setError('Select at least one module.'); return; } setError(''); setStep('tos'); }}
                className="flex-2 py-2.5 px-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                Continue →
              </button>
            </div>
            {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  // ── Step 3: Terms of Service ─────────────────────────────────────────────────

  const effectiveRole = lockedRole ?? role;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Logo />
        <div className="bg-gray-900 border border-white/10 rounded-2xl p-8">
          <h1 className="text-xl font-bold text-white mb-1">Terms of Service</h1>
          <p className="text-sm text-gray-500 mb-4">Please review and accept before continuing.</p>

          <div className="bg-gray-800 border border-white/10 rounded-xl p-4 text-xs text-gray-400 leading-relaxed space-y-2 max-h-48 overflow-y-auto mb-5">
            <p><strong className="text-gray-200">Use of AI Tools.</strong> Your training call transcripts are analyzed by Anthropic Claude API to generate performance assessments and scores. Call audio is processed by Vapi.ai, which uses third-party AI voice services. By using TechRP, you acknowledge and consent to this processing.</p>
            <p><strong className="text-gray-200">Recordings.</strong> Training calls are recorded by Vapi.ai for transcription purposes. Recordings are retained for up to 7 days. You consent to your voice being recorded during training sessions.</p>
            <p><strong className="text-gray-200">Data Use.</strong> Transcript and assessment data is stored securely and used to provide your training history and performance metrics. Your data is not sold to third parties.</p>
            <p><strong className="text-gray-200">Acceptable Use.</strong> TechRP is for legitimate sales training purposes only. Misuse of the platform, including attempting to circumvent AI safety measures or using the platform for purposes other than sales training, may result in account termination.</p>
            <p className="text-gray-500 italic">This is a placeholder agreement. A final Terms of Service will be provided once reviewed by legal counsel.</p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer mb-5">
            <div
              onClick={() => setTosAccepted(!tosAccepted)}
              className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                tosAccepted ? 'bg-blue-500 border-blue-500' : 'border-gray-600 hover:border-gray-400'
              }`}
            >
              {tosAccepted && <span className="text-white text-[10px] font-bold">✓</span>}
            </div>
            <span className="text-sm text-gray-300 leading-relaxed">
              I have read and agree to the Terms of Service, including that my training calls are processed by third-party AI services.
            </span>
          </label>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(effectiveRole === 'individual' && !orgToken ? 'modules' : 'account')}
              className="flex-1 py-2.5 text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/25 rounded-xl transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !tosAccepted}
              className="flex-2 py-2.5 px-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting…' : 'Request Access'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupPageInner />
    </Suspense>
  );
}
