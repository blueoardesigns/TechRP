'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="url(#sgGrad)" />
      <path d="M7 9h18M16 9v14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M10 16h7l4 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <defs>
        <linearGradient id="sgGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0EA5E9" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const MODULES = [
  {
    id: 'technician',
    title: 'Technician Scenarios',
    desc: 'Homeowner inbound calls, face-to-face, plumber referrals',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    id: 'property_manager',
    title: 'Property Manager',
    desc: 'Cold calls and meetings with residential and commercial PMs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    id: 'insurance',
    title: 'Insurance Broker',
    desc: 'Cold calls and discovery with insurance agents and brokers',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
  },
  {
    id: 'plumber_bd',
    title: 'Plumber BD',
    desc: 'Build referral relationships with plumbing companies',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
];

const STEPS = ['Account', 'Modules', 'Terms'];
type Step = 0 | 1 | 2;

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-2 mb-8" aria-label="Progress">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors duration-200 ${
              done ? 'bg-emerald-500 text-white' :
              active ? 'bg-sky-600 text-white' :
              'bg-slate-800 text-slate-500'
            }`}>
              {done ? (
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              ) : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${active ? 'text-white' : done ? 'text-emerald-400' : 'text-slate-600'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px mx-1 ${i < current ? 'bg-emerald-500' : 'bg-slate-800'}`} aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function InputField({
  label, type = 'text', placeholder, value, onChange, readOnly, required, hint,
}: {
  label: string; type?: string; placeholder?: string; value: string;
  onChange?: (v: string) => void; readOnly?: boolean; required?: boolean; hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 mb-1.5 tracking-wide uppercase">
        {label}{required && <span className="text-sky-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        required={required}
        className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all duration-150 ${
          readOnly ? 'opacity-60 cursor-not-allowed border-white/5' : 'border-white/10 hover:border-white/20'
        }`}
      />
      {hint && <p className="text-xs text-slate-600 mt-1">{hint}</p>}
    </div>
  );
}

function SignupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const coachToken = searchParams.get('coach');
  const orgToken   = searchParams.get('org');
  const candidateToken = searchParams.get('candidate');
  const typeParam  = searchParams.get('type');
  const refCode    = searchParams.get('ref') ?? undefined;
  const refSource  = searchParams.get('ref_source') ?? undefined;
  const planParam  = searchParams.get('plan') ?? undefined;
  const seatsParam = searchParams.get('seats') ?? undefined;
  const coachParam = searchParams.get('coach') ?? undefined;

  const lockedRole: 'individual' | 'company_admin' | null =
    orgToken ? 'individual' :
    candidateToken ? 'individual' :
    coachToken && typeParam !== 'individual' ? 'company_admin' :
    coachToken && typeParam === 'individual' ? 'individual' :
    null;

  const [coachInfo, setCoachInfo] = useState<{ name: string } | null>(null);
  const [orgInfo, setOrgInfo]     = useState<{ name: string } | null>(null);
  const [candidateInfo, setCandidateInfo] = useState<{
    email: string; full_name: string | null; assigned_scenarios: { scenario_type: string; count: number }[]
  } | null>(null);
  const [candidateError, setCandidateError] = useState('');

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

  useEffect(() => {
    if (!candidateToken) return;
    fetch(`/api/auth/invite-info?candidate=${candidateToken}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setCandidateError(d.error); return; }
        setCandidateInfo(d);
        setEmail(d.email);
        if (d.full_name) setFullName(d.full_name);
      });
  }, [candidateToken]);

  const [step, setStep] = useState<Step>(0);
  const [role, setRole] = useState<'individual' | 'company_admin'>(lockedRole ?? 'individual');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>(['technician']);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleModule = (id: string) =>
    setSelectedModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);

  const handleAccountNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (role === 'individual' && !orgToken && !candidateToken) {
      setStep(1);
    } else {
      setStep(2);
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
          scenarioAccess: orgToken || candidateToken ? [] : role === 'individual' ? selectedModules : ['technician', 'property_manager', 'insurance', 'plumber_bd'],
          coachToken: coachToken ?? undefined,
          orgToken:   orgToken   ?? undefined,
          candidateToken: candidateToken ?? undefined,
          marketingConsent,
          refCode,
          refSource,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setLoading(false); return; }

      if (planParam) {
        try {
          const checkoutRes = await fetch('/api/stripe/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              planKey: planParam,
              userId: data.userId,
              orgId: data.orgId ?? null,
              seats: seatsParam ? parseInt(seatsParam, 10) : undefined,
              mode: 'subscription',
              coachToken: coachParam ?? undefined,
            }),
          });
          const { url } = await checkoutRes.json() as { url?: string };
          if (url) { window.location.href = url; return; }
        } catch {
          // fall through
        }
      }

      router.push('/training');
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  if (candidateToken && candidateError) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 text-red-400 mx-auto" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <h1 className="text-xl font-bold">Invalid Invite Link</h1>
          <p className="text-slate-400 text-sm">{candidateError}</p>
        </div>
      </div>
    );
  }

  // Suppress unused var warning
  void candidateInfo;

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <style suppressHydrationWarning>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');`}</style>

      {/* ── Left panel — hidden on mobile ───────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[42%] relative flex-col justify-between p-12 bg-slate-900 border-r border-white/8 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-sky-600/8 to-transparent pointer-events-none" aria-hidden="true" />
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-violet-600/6 to-transparent pointer-events-none" aria-hidden="true" />

        <div className="relative flex items-center gap-3">
          <LogoMark size={36} />
          <span className="font-bold text-xl tracking-tight text-white">TechRP</span>
        </div>

        <div className="relative space-y-8">
          <div>
            <p className="text-xs font-bold tracking-widest text-sky-500 uppercase mb-3">Voice AI Training</p>
            <h2 className="text-4xl font-extrabold text-white leading-tight mb-4">
              Your team&apos;s<br />competitive edge.
            </h2>
            <p className="text-slate-400 text-base leading-relaxed">
              Practice real restoration sales calls. Get scored. Close more jobs.
            </p>
          </div>

          <ul className="space-y-4">
            {[
              { text: 'Live voice calls with AI homeowners, PMs & insurance reps', color: 'bg-sky-500' },
              { text: 'Instant AI scoring against your custom playbooks', color: 'bg-violet-500' },
              { text: '150+ realistic personas across all scenario types', color: 'bg-emerald-500' },
            ].map(f => (
              <li key={f.text} className="flex items-start gap-3">
                <span className={`mt-1.5 w-2 h-2 rounded-full ${f.color} shrink-0`} aria-hidden="true" />
                <span className="text-sm text-slate-300 leading-relaxed">{f.text}</span>
              </li>
            ))}
          </ul>

          <div className="bg-slate-800/60 border border-white/8 rounded-2xl p-5">
            <div className="flex gap-1 mb-3" aria-label="5 out of 5 stars">
              {[...Array(5)].map((_, i) => (
                <svg key={i} viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-400" aria-hidden="true">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <blockquote className="text-sm text-slate-300 leading-relaxed mb-3">
              &ldquo;My techs were terrified of inbound calls. After two weeks on TechRP their close rate jumped 30%.&rdquo;
            </blockquote>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center text-xs font-bold text-white" aria-hidden="true">RM</div>
              <div>
                <p className="text-xs font-semibold text-white">Ryan Meade</p>
                <p className="text-xs text-slate-500">Owner, Meade Restoration</p>
              </div>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-slate-700">&copy; {new Date().getFullYear()} TechRP</p>
      </div>

      {/* ── Right panel (form) ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="flex items-center gap-2.5 mb-8 lg:hidden">
          <LogoMark size={28} />
          <span className="font-bold text-lg text-white">TechRP</span>
        </div>

        <div className="w-full max-w-md">
          <StepIndicator current={step} />

          {/* Invite banner */}
          {(coachInfo || orgInfo) && (
            <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl px-4 py-3 text-sm text-sky-300 mb-6">
              You&apos;re joining <strong>{coachInfo?.name ?? orgInfo?.name}</strong>&apos;s training program.
            </div>
          )}

          {/* ── Step 0: Account ─────────────────────────────────────────── */}
          {step === 0 && (
            <div>
              <h1 className="text-2xl font-extrabold text-white mb-1">Create your account</h1>
              <p className="text-sm text-slate-500 mb-7">Start with 5 free training sessions — no card needed.</p>

              <form onSubmit={handleAccountNext} className="space-y-5">
                {!lockedRole && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Account type</label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-xl border border-white/8">
                      {(['individual', 'company_admin'] as const).map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
                            role === r ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {r === 'individual' ? 'Individual' : 'Company'}
                          <span className={`block text-xs font-normal mt-0.5 ${role === r ? 'text-sky-200' : 'text-slate-600'}`}>
                            {r === 'individual' ? 'Solo technician' : 'Team / company'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <InputField label="Full Name" placeholder="Jane Smith" value={fullName} onChange={setFullName} required />
                  </div>
                  {role === 'company_admin' && (
                    <div className="col-span-2 sm:col-span-1">
                      <InputField label="Company Name" placeholder="Acme Restoration" value={companyName} onChange={setCompanyName} required />
                    </div>
                  )}
                </div>

                <InputField
                  label="Work Email" type="email" placeholder="you@company.com"
                  value={email} onChange={v => !candidateToken && setEmail(v)}
                  readOnly={!!candidateToken} required
                />

                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Password" type="password" placeholder="Min. 8 chars" value={password} onChange={setPassword} required />
                  <InputField label="Confirm" type="password" placeholder="••••••••" value={confirmPassword} onChange={setConfirmPassword} required />
                </div>

                {error && (
                  <div role="alert" className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0" aria-hidden="true">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition-colors duration-150 cursor-pointer shadow-lg shadow-sky-900/30 text-sm"
                >
                  Continue
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 inline ml-1.5 -mt-0.5" aria-hidden="true">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                  </svg>
                </button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-6">
                Already have an account?{' '}
                <Link href="/login" className="text-sky-400 hover:text-sky-300 font-semibold transition-colors duration-150">Sign in</Link>
              </p>
            </div>
          )}

          {/* ── Step 1: Modules ──────────────────────────────────────────── */}
          {step === 1 && (
            <div>
              <h1 className="text-2xl font-extrabold text-white mb-1">Choose your training modules</h1>
              <p className="text-sm text-slate-500 mb-7">Select scenarios you want to practice. Change anytime in settings.</p>

              <div className="space-y-3 mb-7">
                {MODULES.map(mod => {
                  const selected = selectedModules.includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => toggleModule(mod.id)}
                      className={`w-full text-left flex items-start gap-4 p-4 rounded-xl border transition-all duration-150 cursor-pointer ${
                        selected ? 'bg-sky-600/12 border-sky-500/40 shadow-sm' : 'bg-slate-900 border-white/8 hover:border-white/20'
                      }`}
                    >
                      <div className={`mt-0.5 w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors duration-150 ${
                        selected ? 'bg-sky-500 border-sky-500' : 'border-slate-600'
                      }`} aria-hidden="true">
                        {selected && (
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-white">
                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={selected ? 'text-sky-400' : 'text-slate-500'}>{mod.icon}</span>
                          <span className="text-sm font-semibold text-white">{mod.title}</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{mod.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {error && <p role="alert" className="text-sm text-red-400 mb-4">{error}</p>}

              <div className="flex gap-3">
                <button
                  onClick={() => { setError(''); setStep(0); }}
                  className="flex-1 py-3 text-sm text-slate-400 hover:text-white border border-white/10 hover:border-white/25 rounded-xl transition-colors duration-150 cursor-pointer font-medium"
                >
                  ← Back
                </button>
                <button
                  onClick={() => {
                    if (selectedModules.length === 0) { setError('Select at least one module.'); return; }
                    setError(''); setStep(2);
                  }}
                  className="flex-[2] py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition-colors duration-150 cursor-pointer text-sm shadow-lg shadow-sky-900/30"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Terms ────────────────────────────────────────────── */}
          {step === 2 && (
            <div>
              <h1 className="text-2xl font-extrabold text-white mb-1">Review & accept terms</h1>
              <p className="text-sm text-slate-500 mb-7">Almost done — just a quick read.</p>

              <div className="bg-slate-900 border border-white/8 rounded-xl p-5 text-xs text-slate-400 leading-relaxed space-y-3 max-h-52 overflow-y-auto mb-5">
                <p><strong className="text-slate-200">AI Processing.</strong> Your training call transcripts are analyzed by Anthropic Claude to generate scores. Call audio is processed by Vapi.ai using third-party voice services. By using TechRP you consent to this processing.</p>
                <p><strong className="text-slate-200">Recordings.</strong> Training calls are recorded for transcription. Recordings are retained for up to 7 days. You consent to your voice being recorded during sessions.</p>
                <p><strong className="text-slate-200">Data Use.</strong> Transcript and assessment data is stored securely for your training history. Your data is never sold to third parties.</p>
                <p><strong className="text-slate-200">Acceptable Use.</strong> TechRP is for legitimate sales training only. Misuse may result in account termination.</p>
                <p className="text-slate-600 italic">Placeholder agreement — final ToS pending legal review.</p>
              </div>

              <div className="space-y-4 mb-6">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div
                    onClick={() => setTosAccepted(!tosAccepted)}
                    role="checkbox"
                    aria-checked={tosAccepted}
                    className={`mt-0.5 w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors duration-150 cursor-pointer ${
                      tosAccepted ? 'bg-sky-500 border-sky-500' : 'border-slate-600 group-hover:border-slate-400'
                    }`}
                    aria-hidden="true"
                  >
                    {tosAccepted && (
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-white" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-slate-300 leading-relaxed">
                    I have read and agree to the Terms of Service, including that my training calls are processed by third-party AI services.
                    <span className="text-sky-500 ml-1 font-medium">*</span>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={e => setMarketingConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-600 text-sky-500 focus:ring-sky-500 bg-slate-900 shrink-0 cursor-pointer"
                  />
                  <span className="text-xs text-slate-500 leading-relaxed">
                    Send me tips, updates, and offers from TechRP. Unsubscribe anytime.
                  </span>
                </label>
              </div>

              {error && (
                <div role="alert" className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0" aria-hidden="true">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setError(''); setStep((lockedRole ?? role) === 'individual' && !orgToken ? 1 : 0); }}
                  className="flex-1 py-3 text-sm text-slate-400 hover:text-white border border-white/10 hover:border-white/25 rounded-xl transition-colors duration-150 cursor-pointer font-medium"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !tosAccepted}
                  className="flex-[2] py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition-colors duration-150 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-sky-900/30"
                >
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>
              </div>
            </div>
          )}
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
