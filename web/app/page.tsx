import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingNav } from '@/components/marketing-nav';
import { MarketingFooter } from '@/components/marketing-footer';

export const metadata: Metadata = {
  title: 'TechRP — AI Sales Training for Restoration Teams',
  description: 'AI-powered role-play training built for restoration sales teams. Practice the conversations that close jobs before they count.',
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <MarketingNav />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-32 pb-28 px-6 text-center">
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-[radial-gradient(circle,rgba(99,102,241,0.18),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.3) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full px-4 py-1.5 text-xs font-semibold text-indigo-300 tracking-[2px] uppercase mb-8">
            AI-Powered Sales Training for Restoration Teams
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.1] mb-6 tracking-tight">
            Your team is losing deals<br />
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              they should be winning.
            </span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            AI-powered role-play training built for restoration sales teams. Field reps, BD, and estimators practice the conversations that close jobs — before they count.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl font-bold text-lg shadow-[0_4px_24px_rgba(99,102,241,0.4)] hover:shadow-[0_4px_36px_rgba(99,102,241,0.6)] transition-shadow"
            >
              Start Free Trial
            </Link>
            <Link
              href="/pricing"
              className="px-8 py-4 border border-white/10 rounded-xl font-semibold text-slate-300 hover:border-white/25 hover:text-white transition-colors"
            >
              See Pricing
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-600">No credit card required · 7-day free trial</p>
        </div>
      </section>

      {/* ── PAIN POINT ── */}
      <section className="py-24 px-6 bg-[#080d1a]">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold tracking-[3px] text-indigo-400 uppercase mb-4 text-center">The Problem</p>
          <h2 className="text-4xl font-extrabold text-center mb-4 leading-tight">
            Your team learns on real customers.<br />That&apos;s a problem.
          </h2>
          <p className="text-slate-400 text-center max-w-2xl mx-auto mb-16 leading-relaxed">
            Without structured practice, every live call is your team&apos;s training session.
            Research shows traditional training barely moves the needle.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {([
              { stat: '5%',     label: 'Knowledge retention from lecture-based training',       source: 'ATD Research', color: 'text-red-400' },
              { stat: '75%',    label: 'Retention when teams learn through active role-play',   source: 'ATD Research', color: 'text-emerald-400' },
              { stat: '[STAT]', label: 'Industry stat — add your restoration-specific number',  source: 'Your data',    color: 'text-blue-400' },
            ] as const).map((item) => (
              <div key={item.stat} className="bg-slate-800/60 border border-white/5 rounded-2xl p-8 text-center backdrop-blur">
                <div className={`text-5xl font-black mb-3 ${item.color}`}>{item.stat}</div>
                <p className="text-slate-300 font-medium mb-2 leading-snug">{item.label}</p>
                <p className="text-slate-600 text-xs">{item.source}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-slate-400 mt-12 text-lg font-medium">TechRP closes that gap.</p>
        </div>
      </section>

      {/* ── SOLUTION PILLARS ── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold tracking-[3px] text-indigo-400 uppercase mb-4 text-center">How It Works</p>
          <h2 className="text-4xl font-extrabold text-center mb-16 leading-tight">Practice. Score. Improve. Repeat.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: '🎯',
                title: 'Practice',
                desc: '150+ AI personas modeled on real homeowners, adjusters, and property managers. Skeptics, price-shoppers, insurance fighters — all there, on demand.',
              },
              {
                icon: '📊',
                title: 'Score',
                desc: 'Every session graded automatically by Claude AI against your custom playbook. Detailed feedback delivered instantly. No manager time required.',
              },
              {
                icon: '📈',
                title: 'Improve',
                desc: 'Managers review sessions, assign targeted playbooks, and track each rep\'s progress over time. Know who\'s ready before the call.',
              },
            ].map((pillar) => (
              <div key={pillar.title} className="bg-slate-800/40 border border-white/5 rounded-2xl p-8 backdrop-blur">
                <div className="text-4xl mb-5">{pillar.icon}</div>
                <h3 className="text-xl font-bold mb-3">{pillar.title}</h3>
                <p className="text-slate-400 leading-relaxed">{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCREENSHOTS ── */}
      <section className="py-24 px-6 bg-[#080d1a]">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold tracking-[3px] text-indigo-400 uppercase mb-4 text-center">The Platform</p>
          <h2 className="text-4xl font-extrabold text-center mb-4 leading-tight">
            Built for the restoration industry.<br />Not adapted from generic software.
          </h2>
          <p className="text-slate-400 text-center max-w-2xl mx-auto mb-16 leading-relaxed">
            Purpose-built for the conversations your team actually faces — on job sites, over the phone, and in front of skeptical homeowners.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              'Training session in progress — AI persona voice call',
              'Session review — transcript + AI score breakdown',
              'Manager dashboard — team performance over time',
            ].map((caption) => (
              <div
                key={caption}
                className="bg-slate-800/40 border border-white/10 rounded-2xl aspect-video flex items-center justify-center p-4"
              >
                <p className="text-slate-600 text-xs text-center leading-relaxed">[SCREENSHOT: {caption}]</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VIDEO ── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-extrabold mb-4 leading-tight">Watch a live training session</h2>
          <p className="text-slate-400 mb-10 leading-relaxed">
            See how a restoration rep goes from nervous to confident in a single session.
          </p>
          <div className="bg-slate-800/40 border border-white/10 rounded-2xl aspect-video flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(99,102,241,0.5)]">
                <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p className="text-slate-600 text-sm">[VIDEO: 90-second training session walkthrough]</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="py-16 px-6 bg-[#080d1a] border-y border-white/5">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '150+',      label: 'AI personas' },
            { value: '10',        label: 'scenario types' },
            { value: '75%',       label: 'avg. retention with role-play' },
            { value: 'Claude AI', label: 'powers every score' },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-extrabold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                {s.value}
              </div>
              <div className="text-slate-500 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING TEASER ── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-semibold tracking-[3px] text-indigo-400 uppercase mb-4">Pricing</p>
          <h2 className="text-4xl font-extrabold mb-4 leading-tight">Simple, transparent pricing</h2>
          <p className="text-slate-400 mb-12 leading-relaxed">Start free. Scale as your team grows.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[
              { name: 'Starter', price: '$34.99', minutes: '120 min/mo', popular: false },
              { name: 'Growth',  price: '$57.99', minutes: '240 min/mo', popular: true  },
              { name: 'Pro',     price: '$89.99', minutes: '400 min/mo', popular: false },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-6 border ${
                  plan.popular
                    ? 'border-indigo-500/40 bg-indigo-500/5 shadow-[0_0_40px_rgba(99,102,241,0.1)]'
                    : 'border-white/5 bg-slate-800/30'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    Most Popular
                  </div>
                )}
                <div className="inline-block bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold px-2 py-0.5 rounded-full mb-4">
                  7-day free trial
                </div>
                <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                <div className="text-3xl font-extrabold mb-1">
                  {plan.price}<span className="text-base font-normal text-slate-500">/mo</span>
                </div>
                <p className="text-slate-500 text-sm mb-6">{plan.minutes}</p>
                <Link
                  href="/signup"
                  className="block w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-sm font-bold text-center hover:opacity-90 transition-opacity"
                >
                  Start Free Trial
                </Link>
              </div>
            ))}
          </div>
          <Link href="/pricing" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
            See full pricing &amp; team plans →
          </Link>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-28 px-6 bg-gradient-to-b from-[#080d1a] to-[#0f172a]">
        <div className="max-w-3xl mx-auto text-center relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.15),transparent_65%)] pointer-events-none" />
          <h2 className="relative text-5xl font-extrabold mb-4 leading-tight">
            Ready to build a team<br />
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              that closes?
            </span>
          </h2>
          <p className="relative text-slate-400 text-lg mb-10 leading-relaxed">
            Join restoration companies already training smarter with TechRP.
          </p>
          <div className="relative">
            <Link
              href="/signup"
              className="inline-block px-10 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl font-bold text-lg shadow-[0_4px_24px_rgba(99,102,241,0.4)] hover:shadow-[0_4px_36px_rgba(99,102,241,0.6)] transition-shadow"
            >
              Start your 7-day free trial
            </Link>
            <p className="mt-4 text-sm text-slate-600">No credit card required</p>
          </div>
        </div>
      </section>

      <MarketingFooter current="home" />
    </div>
  );
}
