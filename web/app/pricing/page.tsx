'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MarketingNav } from '@/components/marketing-nav';

const INDIVIDUAL_PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: '$34.99',
    minutes: 120,
    popular: false,
    features: [
      '120 training minutes/mo',
      '150+ AI personas',
      'AI-scored sessions',
      'Session history & transcripts',
      'Access all scenario types',
    ],
  },
  {
    key: 'growth',
    name: 'Growth',
    price: '$57.99',
    minutes: 240,
    popular: true,
    features: [
      '240 training minutes/mo',
      'Everything in Starter',
      'Custom playbook creation',
      'PDF/Doc playbook upload',
      'Priority support',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$89.99',
    minutes: 400,
    popular: false,
    features: [
      '400 training minutes/mo',
      'Everything in Growth',
      'Field recording upload & scoring',
      'Advanced analytics',
      'Add-on hours at $10.99/hr',
    ],
  },
] as const;

const TEAM_PLANS = [
  {
    key: 'standard',
    name: 'Company Standard',
    priceFrom: '$27.99',
    minutesPerSeat: 120,
    popular: false,
    features: [
      '120 min/seat/mo',
      'Manager dashboard',
      'Team session review',
      'Shared playbooks',
      'All individual features',
    ],
  },
  {
    key: 'pro',
    name: 'Company Pro',
    priceFrom: '$44.99',
    minutesPerSeat: 240,
    popular: true,
    features: [
      '240 min/seat/mo',
      'Everything in Standard',
      'Advanced team analytics',
      'Custom persona creation',
      'Add-on hours from $8.49/hr',
    ],
  },
] as const;

const FAQ = [
  {
    q: 'What happens after the 7-day trial?',
    a: "Your trial includes 25 minutes of practice time. After 7 days (or when you've used your trial minutes), you'll be prompted to pick a plan. You won't be charged until you choose one.",
  },
  {
    q: 'What is a training minute?',
    a: 'A training minute is one minute of active AI voice role-play. Browsing the app, reviewing sessions, and setting up playbooks do not consume minutes.',
  },
  {
    q: 'Can I switch plans?',
    a: 'Yes. You can upgrade or downgrade at any time from your account settings. Changes take effect at the next billing cycle.',
  },
  {
    q: 'Does it work for BD reps, not just field techs?',
    a: 'Absolutely. TechRP includes scenarios for both field technicians and business development reps — property managers, insurance adjusters, commercial accounts, and more.',
  },
  {
    q: "Can managers review their team's sessions?",
    a: 'Yes, on Company plans. Managers get a dashboard showing every session, full transcripts, and AI score breakdowns for each team member.',
  },
  {
    q: 'What if I need more minutes mid-month?',
    a: 'You can purchase add-on hour blocks at any time. Pricing varies by plan: $10.99–$14.99/hr for individuals, $8.49–$10.99/hr for company plans.',
  },
] as const;

export default function PricingPage() {
  const [tab, setTab] = useState<'individual' | 'team'>('individual');

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <MarketingNav />

      <section className="pt-24 pb-16 px-6 text-center">
        <p className="text-xs font-semibold tracking-[3px] text-indigo-400 uppercase mb-4">Pricing</p>
        <h1 className="text-5xl font-extrabold mb-4 leading-tight">Simple, transparent pricing</h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto mb-10">
          Start free. No credit card required. Upgrade when you&apos;re ready.
        </p>
        <div className="inline-flex bg-slate-800/60 border border-white/10 rounded-xl p-1 gap-1">
          <button
            onClick={() => setTab('individual')}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'individual' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Individual
          </button>
          <button
            onClick={() => setTab('team')}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'team' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Team
          </button>
        </div>
      </section>

      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto">
          {tab === 'individual' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {INDIVIDUAL_PLANS.map((plan) => (
                <div
                  key={plan.key}
                  className={`relative rounded-2xl p-8 border flex flex-col ${
                    plan.popular
                      ? 'border-indigo-500/40 bg-indigo-500/5 shadow-[0_0_50px_rgba(99,102,241,0.12)]'
                      : 'border-white/5 bg-slate-800/30'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                      Most Popular
                    </div>
                  )}
                  <div className="inline-block bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold px-2 py-0.5 rounded-full mb-5">
                    7-day free trial
                  </div>
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="text-4xl font-extrabold mb-1">
                    {plan.price}<span className="text-base font-normal text-slate-500">/mo</span>
                  </div>
                  <p className="text-slate-500 text-sm mb-6">{plan.minutes} training minutes/mo</p>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                        <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className="block w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-sm font-bold text-center hover:opacity-90 transition-opacity"
                  >
                    Start Free Trial
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {TEAM_PLANS.map((plan) => (
                <div
                  key={plan.key}
                  className={`relative rounded-2xl p-8 border flex flex-col ${
                    plan.popular
                      ? 'border-indigo-500/40 bg-indigo-500/5 shadow-[0_0_50px_rgba(99,102,241,0.12)]'
                      : 'border-white/5 bg-slate-800/30'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                      Most Popular
                    </div>
                  )}
                  <div className="inline-block bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold px-2 py-0.5 rounded-full mb-5">
                    7-day free trial
                  </div>
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="text-3xl font-extrabold mb-1">
                    From {plan.priceFrom}<span className="text-base font-normal text-slate-500">/seat/mo</span>
                  </div>
                  <p className="text-slate-500 text-sm mb-6">{plan.minutesPerSeat} min/seat/mo · 2+ seats</p>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                        <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className="block w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-sm font-bold text-center hover:opacity-90 transition-opacity"
                  >
                    Start Free Trial
                  </Link>
                </div>
              ))}
            </div>
          )}
          <p className="text-center text-slate-500 text-sm mt-6">
            Need more time?{' '}
            <span className="text-slate-400">
              Add-on hours available:{' '}
              {tab === 'individual' ? '$10.99–$14.99/hr depending on plan.' : '$8.49–$10.99/hr depending on plan.'}
            </span>
          </p>
          {tab === 'team' && (
            <p className="text-center text-slate-500 text-sm mt-2">
              Price scales with seat count — lower per-seat cost as your team grows.{' '}
              <a href="mailto:tbauertext@gmail.com" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                Contact us for 50+ seats.
              </a>
            </p>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 bg-[#080d1a] border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-12">Frequently asked questions</h2>
          <div className="space-y-6">
            {FAQ.map((item) => (
              <div key={item.q} className="border-b border-white/5 pb-6">
                <h3 className="font-semibold text-white mb-2">{item.q}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-slate-500 mt-10 text-sm">
            Still have questions?{' '}
            <a href="mailto:tbauertext@gmail.com" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              Contact us →
            </a>
          </p>
        </div>
      </section>

      <footer className="py-8 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md" />
            <span className="font-bold text-sm">TechRP</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link href="/"      className="hover:text-slate-300 transition-colors">Home</Link>
            <Link href="/about" className="hover:text-slate-300 transition-colors">About</Link>
            <Link href="/login" className="hover:text-slate-300 transition-colors">Log In</Link>
          </div>
          <p className="text-slate-600 text-sm">© {new Date().getFullYear()} TechRP</p>
        </div>
      </footer>
    </div>
  );
}
