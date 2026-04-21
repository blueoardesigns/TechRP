import Link from 'next/link';

function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="url(#lGrad)" />
      <path d="M7 9h18M16 9v14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M10 16h7l4 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <defs>
        <linearGradient id="lGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0EA5E9" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const STATS = [
  { value: '84', suffix: '/100', label: 'Avg. score' },
  { value: '12x', suffix: '', label: 'More practice reps' },
  { value: '2min', suffix: '', label: 'To first call' },
];

const TESTIMONIALS = [
  {
    quote: "My techs were terrified of inbound calls. After two weeks on TechRP their close rate jumped 30%.",
    name: 'Ryan Meade',
    role: 'Owner, Meade Restoration',
    initials: 'RM',
    color: 'bg-sky-600',
  },
  {
    quote: "The AI homeowner is surprisingly realistic. You really can't tell it's not a live call at first.",
    name: 'Cassidy Torres',
    role: 'Sales Manager, PuroClean',
    initials: 'CT',
    color: 'bg-violet-600',
  },
  {
    quote: "We use it for onboarding. New hires are ready to take real calls in half the time.",
    name: 'Derek Park',
    role: 'Director of Training, ServPro',
    initials: 'DP',
    color: 'bg-emerald-600',
  },
];

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ),
    title: 'Live Voice Calls',
    desc: 'Practice real conversations with AI personas voiced by Vapi — inbound homeowners, plumbers, insurance reps, and more.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
      </svg>
    ),
    title: 'AI Scoring',
    desc: 'Claude grades every call against your playbook: strengths, improvements, and a 1–10 score — delivered instantly.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    title: 'Custom Playbooks',
    desc: 'Build rubrics that match how your company sells. Every graded call reflects YOUR process, not a generic script.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
    title: '150+ AI Personas',
    desc: 'From skeptical homeowners to savvy property managers — a full cast of realistic training characters ready to challenge your team.',
  },
];

function HeroVisual() {
  return (
    <div className="relative w-full max-w-[360px] mx-auto lg:mx-0 lg:ml-auto select-none" aria-hidden="true">
      <div className="absolute inset-0 bg-sky-500/10 rounded-3xl blur-3xl pointer-events-none" />
      <div className="relative bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-slate-300">Live Training Call</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">02:14</span>
        </div>

        <div className="px-5 py-4 border-b border-white/10">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-3 font-medium">Voice Activity</p>
          <div className="flex items-end gap-[3px] h-10">
            {[2,5,9,7,13,11,15,9,7,11,13,5,9,7,4,11,15,9,6,11,7,13,9,5,8,11,14,9,6,10].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-[2px] bg-sky-500/70"
                style={{ height: `${h * 2.5}px`, opacity: i % 4 === 0 ? 1 : 0.45 }}
              />
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2 font-medium">Homeowner Inbound — Scenario #4</p>
        </div>

        <div className="px-5 py-4 space-y-3">
          {[
            { label: 'Empathy', pct: 88, color: 'from-sky-500 to-sky-400' },
            { label: 'Urgency', pct: 72, color: 'from-violet-500 to-violet-400' },
            { label: 'Next Steps', pct: 91, color: 'from-emerald-500 to-emerald-400' },
          ].map(s => (
            <div key={s.label}>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">{s.label}</span>
                <span className="text-slate-200 font-semibold">{s.pct}</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${s.color} rounded-full`} style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="mx-5 mb-5 bg-slate-800/60 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Overall Score</p>
            <p className="text-2xl font-bold text-white mt-0.5">84 <span className="text-sm font-normal text-slate-500">/ 100</span></p>
          </div>
          <div className="w-14 h-14 relative flex items-center justify-center">
            <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#1E293B" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                stroke="url(#scoreGrad)" strokeWidth="3"
                strokeDasharray={`${(84 / 100) * 94.2} 94.2`}
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0EA5E9" />
                  <stop offset="100%" stopColor="#34D399" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <style suppressHydrationWarning>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');`}</style>

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-white/8">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg">
            <LogoMark size={30} />
            <span className="font-bold text-lg tracking-tight text-white">TechRP</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
            <Link href="/#features" className="text-sm text-slate-400 hover:text-white transition-colors duration-150">Features</Link>
            <Link href="/pricing" className="text-sm text-slate-400 hover:text-white transition-colors duration-150">Pricing</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-400 hover:text-white font-medium transition-colors duration-150 hidden sm:block">
              Sign in
            </Link>
            <Link href="/signup" className="bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-colors duration-150 cursor-pointer">
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 sm:px-10 pt-20 pb-24">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-14">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 rounded-full px-3.5 py-1.5 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-400" aria-hidden="true" />
              <span className="text-xs font-semibold text-sky-400 tracking-wide">Voice AI Training Platform</span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.08] tracking-tight mb-6">
              Train your team to<br />
              <span className="bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-transparent">
                close more jobs.
              </span>
            </h1>

            <p className="text-slate-400 text-lg leading-relaxed max-w-md mb-4">
              Practice real restoration sales calls with AI-powered homeowners, property managers, and referral partners. Get scored after every rep.
            </p>

            <p className="text-slate-500 text-sm mb-8">
              No credit card required · 5 free sessions to start
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/signup" className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors duration-150 cursor-pointer shadow-lg shadow-sky-900/30">
                Start Training Free
              </Link>
              <Link href="/login" className="text-slate-400 hover:text-white text-sm font-medium flex items-center gap-1.5 transition-colors duration-150 cursor-pointer">
                Already have an account
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>

            <div className="flex flex-wrap gap-6 mt-10 pt-10 border-t border-white/10">
              {STATS.map(s => (
                <div key={s.label}>
                  <p className="text-2xl font-extrabold text-white">
                    {s.value}<span className="text-slate-500 text-lg font-normal">{s.suffix}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full lg:w-[360px] shrink-0">
            <HeroVisual />
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section id="features" className="bg-slate-900/50 border-y border-white/8 py-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <p className="text-xs font-bold tracking-widest text-sky-500 uppercase mb-3">Platform</p>
          <h2 className="text-3xl font-bold text-white mb-12 max-w-lg">
            Everything your team needs to practice, improve, and win more.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="group bg-slate-900 border border-white/8 hover:border-sky-500/30 rounded-2xl p-6 flex flex-col gap-4 transition-all duration-200 cursor-default hover:shadow-xl hover:shadow-sky-950/40 hover:-translate-y-0.5"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:bg-sky-500/15 transition-colors duration-200">
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1.5">{f.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <p className="text-xs font-bold tracking-widest text-sky-500 uppercase mb-3">Social Proof</p>
          <h2 className="text-3xl font-bold text-white mb-12">Trusted by restoration teams.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="bg-slate-900 border border-white/8 rounded-2xl p-6 flex flex-col gap-5">
                <div className="flex gap-1" aria-label="5 out of 5 stars">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-400" aria-hidden="true">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <blockquote className="text-slate-300 text-sm leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div className="flex items-center gap-3 pt-2 border-t border-white/8">
                  <div className={`w-9 h-9 rounded-full ${t.color} flex items-center justify-center text-xs font-bold text-white shrink-0`} aria-hidden="true">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────────────────────── */}
      <section className="pb-24">
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <div className="relative bg-gradient-to-br from-sky-600/20 via-slate-900 to-violet-600/20 border border-sky-500/20 rounded-3xl px-8 py-14 sm:px-14 text-center overflow-hidden">
            <div className="absolute inset-0 bg-slate-950/40 rounded-3xl" aria-hidden="true" />
            <div className="relative">
              <h2 className="text-4xl font-extrabold text-white mb-4">Ready to build a sharper team?</h2>
              <p className="text-slate-400 text-base mb-8 max-w-md mx-auto">
                Get started in under 2 minutes. Pick a scenario, take a call, and see your score.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link href="/signup" className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-7 py-3 rounded-xl transition-colors duration-150 cursor-pointer shadow-lg shadow-sky-900/30">
                  Start Training Free
                </Link>
                <Link href="/pricing" className="text-slate-400 hover:text-white font-medium px-4 py-3 rounded-xl border border-white/10 hover:border-white/25 transition-colors duration-150 cursor-pointer text-sm">
                  View pricing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/8 py-8">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <LogoMark size={22} />
            <span className="text-sm font-semibold text-slate-400">TechRP</span>
          </div>
          <p className="text-xs text-slate-600">&copy; {new Date().getFullYear()} TechRP. All rights reserved.</p>
          <div className="flex gap-5">
            <Link href="/login" className="text-xs text-slate-500 hover:text-slate-300 transition-colors duration-150">Sign in</Link>
            <Link href="/signup" className="text-xs text-slate-500 hover:text-slate-300 transition-colors duration-150">Sign up</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
