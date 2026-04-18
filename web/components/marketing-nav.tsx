'use client';

import Link from 'next/link';

function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="url(#mktGrad)" />
      <path d="M7 9h18M16 9v14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M10 16h7l4 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <defs>
        <linearGradient id="mktGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" /><stop offset="1" stopColor="#6366F1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0f172a]/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-bold text-base tracking-tight text-white">TechRP</span>
        </Link>

        <nav className="hidden sm:flex items-center gap-1">
          <Link href="/pricing" className="px-4 py-1.5 rounded-md text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
            Pricing
          </Link>
          <Link href="/about" className="px-4 py-1.5 rounded-md text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
            About
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="px-4 py-2 rounded-lg text-sm text-slate-300 border border-white/10 hover:border-white/20 transition-colors">
            Log In
          </Link>
          <Link href="/signup" className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-90 transition-opacity shadow-[0_2px_12px_rgba(99,102,241,0.35)]">
            Start Free Trial →
          </Link>
        </div>
      </div>
    </header>
  );
}
