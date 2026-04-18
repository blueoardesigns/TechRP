import Link from 'next/link';
import { AppNav } from '@/components/nav';
import { RoleCard } from '@/components/role-card';

const CARDS = [
  {
    href: '/training',
    icon: '🎯',
    label: 'Start Training',
    description: 'Pick a scenario and practice a live voice call with an AI character.',
    cta: 'Start a session →',
    accent: 'from-blue-500 to-blue-600',
    ctaColor: 'text-blue-400',
  },
  {
    href: '/sessions',
    icon: '📊',
    label: 'Sessions',
    description: 'Review completed calls, AI scores, and your performance trends over time.',
    cta: 'View history →',
    accent: 'from-emerald-500 to-emerald-600',
    ctaColor: 'text-emerald-400',
  },
  {
    href: '/playbooks',
    icon: '📘',
    label: 'Playbooks',
    description: 'Create and edit scenario playbooks. Assessments are graded against your active playbook.',
    cta: 'Manage playbooks →',
    accent: 'from-violet-500 to-violet-600',
    ctaColor: 'text-violet-400',
  },
  {
    href: '/personas',
    icon: '🎭',
    label: 'Personas',
    description: 'Browse and manage the AI characters used across each training scenario.',
    cta: 'Manage personas →',
    accent: 'from-orange-500 to-orange-600',
    ctaColor: 'text-orange-400',
  },
  {
    href: '/recordings',
    icon: '🎤',
    label: 'Field Recordings',
    description: 'Upload a real call or knock-and-talk recording for AI transcription and scoring.',
    cta: 'Upload a recording →',
    accent: 'from-rose-500 to-rose-600',
    ctaColor: 'text-rose-400',
  },
];

function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="url(#logoGrad)" />
      <path d="M7 9h18M16 9v14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M10 16h7l4 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function HeroVisual() {
  const stats = [
    { label: 'Avg. Score', value: '84', unit: '/100', color: 'text-blue-400' },
    { label: 'Sessions', value: '12', unit: ' this month', color: 'text-emerald-400' },
    { label: 'Scenarios', value: '6', unit: ' active', color: 'text-violet-400' },
  ];
  return (
    <div className="relative w-full max-w-sm mx-auto lg:mx-0 lg:ml-auto">
      {/* Glow */}
      <div className="absolute inset-0 bg-blue-600/10 rounded-3xl blur-3xl" />

      <div className="relative bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-4">
        {/* Mock waveform */}
        <div className="flex items-end gap-1 h-12">
          {[3,6,10,8,14,12,16,10,8,12,14,6,10,8,5,12,16,10,7,12,8,14,10,6,9].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-blue-500/60"
              style={{ height: `${h * 3}px`, opacity: i % 3 === 0 ? 1 : 0.5 }}
            />
          ))}
        </div>

        <div className="border-t border-white/10 pt-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Live Training Call</p>
            <p className="text-sm font-semibold text-white mt-0.5">Homeowner Inbound</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <p className={`text-xl font-bold ${s.color}`}>
                {s.value}<span className="text-xs font-normal text-gray-500">{s.unit}</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Score bar */}
        <div className="border-t border-white/10 pt-4 space-y-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Assessment score</span>
            <span className="text-white font-semibold">84 / 100</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full w-[84%] bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">

      <AppNav />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 sm:px-10 pt-16 pb-14">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-12">
          {/* Left: copy */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold tracking-widest text-blue-400 uppercase mb-4">
              Voice AI Training Platform
            </p>
            <h1 className="text-5xl font-bold leading-tight mb-5">
              Train smarter.<br />
              <span className="text-gray-400">Close more jobs.</span>
            </h1>
            <p className="text-gray-400 text-base leading-relaxed max-w-md">
              Practice real sales conversations with AI-powered homeowners, property managers, and business contacts. Get scored after every call.
            </p>
            <div className="flex items-center gap-3 mt-8">
              <Link
                href="/training"
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
              >
                Start Training →
              </Link>
              <Link
                href="/sessions"
                className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
              >
                View my sessions
              </Link>
            </div>
          </div>

          {/* Right: visual card */}
          <div className="w-full lg:w-80 shrink-0">
            <HeroVisual />
          </div>
        </div>
      </section>

      {/* ── Cards ────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 sm:px-10 pb-16">
        <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-5">What&apos;s inside</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CARDS.map(card => (
            <Link
              key={card.href}
              href={card.href}
              className="group relative bg-gray-900 border border-white/10 hover:border-white/25 rounded-2xl p-6 flex flex-col gap-4 transition-all hover:shadow-xl hover:-translate-y-0.5"
            >
              {/* Gradient top bar on hover */}
              <div className={`absolute top-0 left-6 right-6 h-0.5 rounded-full bg-gradient-to-r ${card.accent} opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="text-3xl">{card.icon}</div>
              <div className="flex-1">
                <h2 className="font-semibold text-white mb-1">{card.label}</h2>
                <p className="text-sm text-gray-400 leading-relaxed">{card.description}</p>
              </div>
              <span className={`text-sm font-medium ${card.ctaColor} group-hover:underline`}>
                {card.cta}
              </span>
            </Link>
          ))}
          <RoleCard />
        </div>

        {/* ── CTA banner ───────────────────────────────────────────────────── */}
        <div className="mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-white text-lg">Ready to practice?</p>
            <p className="text-blue-200 text-sm mt-0.5">Pick a scenario and start a live training call in under 30 seconds.</p>
          </div>
          <Link
            href="/training"
            className="shrink-0 bg-white text-gray-900 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-gray-100 transition-colors whitespace-nowrap shadow-md"
          >
            Start a Session →
          </Link>
        </div>
      </section>

    </div>
  );
}
