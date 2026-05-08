import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingNav } from '@/components/marketing-nav';
import { MarketingFooter } from '@/components/marketing-footer';
import { RoiCalculator } from './roi-calculator';

export const metadata: Metadata = {
  title: 'TechRP — Close 5–10% More Restoration Jobs Without New Leads',
  description:
    'Voice-AI roleplay training for water and mold restoration teams. Turn the leads you already pay for into more closed jobs — built by a 25-year sales coach.',
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <MarketingNav />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-32 pb-28 px-6 text-center">
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-[radial-gradient(circle,rgba(99,102,241,0.18),transparent_60%)] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.3) 1px,transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full px-4 py-1.5 text-xs font-semibold text-indigo-300 tracking-[2px] uppercase mb-8">
            Voice AI Roleplay for Restoration Sales
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.1] mb-6 tracking-tight">
            Close 5–10% more restoration jobs.<br />
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              Without spending a dollar on new leads.
            </span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            TechRP turns your technicians and BD reps into closers with voice-AI roleplay built
            specifically for water and mold restoration. Designed by a 25-year sales coach.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl font-bold text-lg shadow-[0_4px_24px_rgba(99,102,241,0.4)] hover:shadow-[0_4px_36px_rgba(99,102,241,0.6)] transition-shadow"
            >
              Start Training My Team
            </Link>
            <a
              href="https://calendly.com/tim-blueoardesigns/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 border border-white/10 rounded-xl font-semibold text-slate-300 hover:border-white/25 hover:text-white transition-colors"
            >
              Book a 30-min Walkthrough
            </a>
            <Link
              href="#roi"
              className="px-8 py-4 text-slate-400 font-semibold hover:text-white transition-colors"
            >
              Calculate My ROI ↓
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            Built for techs, BD reps, owners, and coaches · Plumbers, Property Managers, and Insurance personas
          </p>
        </div>
      </section>

      {/* ── PROBLEM ── */}
      <section className="py-24 px-6 bg-[#080d1a]">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold tracking-[3px] text-indigo-400 uppercase mb-4 text-center">
            The Problem
          </p>
          <h2 className="text-4xl font-extrabold text-center mb-4 leading-tight">
            You&apos;re not losing jobs because of marketing.<br />
            You&apos;re losing them on the call.
          </h2>
          <p className="text-slate-400 text-center max-w-2xl mx-auto mb-16 leading-relaxed">
            Every week, deals you should be winning slip away — not because the lead was bad, but
            because the rep wasn&apos;t ready.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                emoji: '❄️',
                title: 'The frozen tech',
                desc: '“Let me think about it,” the homeowner says. Your new tech has no answer. You just lost a $10,000 job.',
              },
              {
                emoji: '👋',
                title: 'The polite handshake',
                desc: 'Your BD rep walks out of the plumber’s shop with smiles — and zero referrals. Again.',
              },
              {
                emoji: '🔥',
                title: 'The new-hire burn',
                desc: 'A great-looking hire bombs the first three calls. They learn on real customers, and your real revenue pays the tuition.',
              },
            ].map((p) => (
              <div
                key={p.title}
                className="bg-slate-800/60 border border-white/5 rounded-2xl p-7 backdrop-blur"
              >
                <div className="text-4xl mb-3">{p.emoji}</div>
                <h3 className="text-lg font-bold mb-2">{p.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-slate-300 mt-12 text-lg font-medium">
            You’re paying for leads. Then handing them to people who haven&apos;t been trained to close.
          </p>
        </div>
      </section>

      {/* ── SOLUTION ── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold tracking-[3px] text-indigo-400 uppercase mb-4 text-center">
            The Solution
          </p>
          <h2 className="text-4xl font-extrabold text-center mb-4 leading-tight">
            Reps that practice 100 calls before their first real one win more jobs.
          </h2>
          <p className="text-slate-400 text-center max-w-2xl mx-auto mb-16 leading-relaxed">
            TechRP gives every technician and BD rep a safe place to practice — against realistic
            AI homeowners, property managers, plumbers, and insurance agents — until they sound
            confident, consultative, and ready.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: '🎙️',
                title: 'Voice-First Roleplay',
                desc: 'Real conversations, real objections, real pressure — powered by the highest-end conversational voice AI available.',
              },
              {
                icon: '📋',
                title: 'Battle-Tested Playbooks',
                desc: 'Every scenario ships with a playbook written from 25+ years of sales and field-training experience. Fully editable for your shop.',
              },
              {
                icon: '🧠',
                title: 'Instant Critique',
                desc: 'Score, strengths, what to fix — delivered the moment the call ends. No waiting on a manager.',
              },
              {
                icon: '🎧',
                title: 'Recorded & Reviewable',
                desc: 'Every call saved. Managers and coaches can listen, leave notes, and turn one rep’s mistake into the whole team’s lesson.',
              },
              {
                icon: '🪜',
                title: 'Skill Progression',
                desc: 'Techs start on inbound calls and graduate to in-person walkthroughs. BD reps move from cold opens to closing discovery meetings.',
              },
              {
                icon: '🎯',
                title: 'Vertical-Specific Personas',
                desc: 'Plumbers, Property Managers, and Insurance Agents — the referral sources that actually drive your pipeline.',
              },
            ].map((s) => (
              <div
                key={s.title}
                className="bg-slate-800/40 border border-white/5 rounded-2xl p-6 backdrop-blur hover:border-indigo-500/30 transition-colors"
              >
                <div className="text-3xl mb-3">{s.icon}</div>
                <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROI CALCULATOR ── */}
      <section id="roi" className="py-28 px-6 bg-[#080d1a] scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-[3px] text-indigo-400 uppercase mb-4">
              Do The Math
            </p>
            <h2 className="text-4xl sm:text-5xl font-extrabold mb-4 leading-tight">
              A mere 10% lift on your close rate is{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                massive
              </span>
              .
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Same leads. Same marketing budget. Same trucks. The only thing that changes is how
              prepared your people are when they answer the phone or walk through the door.
            </p>
          </div>
          <RoiCalculator />
          <p className="text-center text-xs text-slate-600 mt-8 max-w-2xl mx-auto">
            Estimates are per individual rep using TechRP, based on ~22 working days per month.
            Multiply by your number of trained reps for company-wide impact. Defaults reflect a typical
            water/mold restoration team: $10,000 average ticket, 2 calls/day, 50% close rate, 70% gross margin.
          </p>
        </div>
      </section>

      {/* ── WHO IT'S FOR ── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold tracking-[3px] text-indigo-400 uppercase mb-4 text-center">
            Built For Every Seat
          </p>
          <h2 className="text-4xl font-extrabold text-center mb-16 leading-tight">
            One platform. Every role that touches a customer.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: '🔧',
                title: 'Field Technicians',
                desc: 'Master the inbound call. Then the in-home walkthrough. Stop losing jobs at the kitchen table.',
              },
              {
                icon: '🤝',
                title: 'Business Development Reps',
                desc: 'Open cold visits, build referral relationships, and close discovery meetings with Plumbers, PMs, and Insurance.',
              },
              {
                icon: '🏢',
                title: 'Owners & Managers',
                desc: 'Track every rep, every call, every score. See who’s improving — before it shows up in your revenue.',
              },
              {
                icon: '🧭',
                title: 'Coaches',
                desc: 'Bring your restoration clients onto one platform. Track teams, listen to calls, leave notes, prove your impact.',
              },
              {
                icon: '🎯',
                title: 'Hiring Managers',
                desc: 'Send a Sales Skill Test to candidates before you hire. Find out who can actually sell — not just interview well.',
              },
              {
                icon: '👤',
                title: 'Individual Operators',
                desc: 'Solo techs and owner-operators can sharpen their skills on their own time, on their own schedule.',
              },
            ].map((r) => (
              <div
                key={r.title}
                className="bg-slate-800/40 border border-white/5 rounded-2xl p-6 backdrop-blur"
              >
                <div className="text-3xl mb-3">{r.icon}</div>
                <h3 className="text-base font-bold mb-2">{r.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 px-6 bg-[#080d1a]">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold tracking-[3px] text-indigo-400 uppercase mb-4 text-center">
            How It Works
          </p>
          <h2 className="text-4xl font-extrabold text-center mb-16 leading-tight">
            Four steps. Ten minutes. Better reps.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { n: '1', t: 'Pick a Scenario', d: 'Inbound homeowner. Plumber drop-in. Insurance adjuster meeting. Choose the role and the situation.' },
              { n: '2', t: 'Read the Playbook', d: 'Two minutes. Goals, key questions, objection handling — written by a 25-year sales coach.' },
              { n: '3', t: 'Take the Call', d: 'Real voice. Real conversation. Real objections like “I need to call my husband.”' },
              { n: '4', t: 'Get Scored & Coached', d: 'Instant critique, recording saved, manager notes attached. Run it again until it’s automatic.' },
            ].map((step) => (
              <div
                key={step.n}
                className="bg-slate-800/40 border border-white/5 rounded-2xl p-6 backdrop-blur"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black mb-4">
                  {step.n}
                </div>
                <h3 className="text-base font-bold mb-2">{step.t}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{step.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold tracking-[3px] text-indigo-400 uppercase mb-4 text-center">
            FAQ
          </p>
          <h2 className="text-4xl font-extrabold text-center mb-12 leading-tight">
            Questions, answered.
          </h2>
          <div className="space-y-4">
            {[
              {
                q: 'Is this just chatbot training?',
                a: 'No. TechRP uses the highest-end conversational voice AI available. Your reps actually talk — the AI listens, responds in real time, throws curveballs, and pushes back. The closest thing to a live call without burning a real lead.',
              },
              {
                q: 'My team won’t have time for “another tool.”',
                a: 'A roleplay takes 5–10 minutes. One call before the workday saves them from blowing the next real one. Most teams see measurable improvement inside two weeks.',
              },
              {
                q: 'We already have a coach. Why do we need this?',
                a: 'Your coach should be coaching — not running drills. TechRP handles the reps so your coach (or you) can focus on the high-leverage feedback. You can also invite your coach in directly with a Coach account.',
              },
              {
                q: 'Can I customize the playbooks for our company?',
                a: 'Yes. Every playbook ships ready-to-use and fully editable. Add your branded talk tracks, your service offerings, your local market language.',
              },
              {
                q: 'Will this work for hiring?',
                a: 'That’s one of its best uses. Send a candidate a single skill test before you make an offer. You’ll know in 10 minutes whether they can actually sell — not just interview.',
              },
              {
                q: 'How accurate is the AI scoring?',
                a: 'Every transcript is graded by Claude (Anthropic’s leading AI) against the active playbook for that scenario — same rubric every time, no manager bias, instant feedback.',
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group bg-slate-800/40 border border-white/5 rounded-2xl backdrop-blur open:border-indigo-500/30 transition-colors"
              >
                <summary className="flex items-center justify-between cursor-pointer list-none p-5">
                  <span className="font-semibold text-white pr-4">{item.q}</span>
                  <span className="text-indigo-400 text-2xl leading-none transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="px-5 pb-5 text-slate-400 leading-relaxed text-sm">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-28 px-6 bg-gradient-to-b from-[#080d1a] to-[#0f172a]">
        <div className="max-w-3xl mx-auto text-center relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.15),transparent_65%)] pointer-events-none" />
          <h2 className="relative text-5xl font-extrabold mb-4 leading-tight">
            The next call your rep takes is worth thousands.<br />
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              Make sure they’re ready.
            </span>
          </h2>
          <p className="relative text-slate-400 text-lg mb-10 leading-relaxed">
            A 5% lift pays for TechRP many times over. A 10% lift changes your year.
          </p>
          <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-block px-10 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl font-bold text-lg shadow-[0_4px_24px_rgba(99,102,241,0.4)] hover:shadow-[0_4px_36px_rgba(99,102,241,0.6)] transition-shadow"
            >
              Start Training My Team
            </Link>
            <a
              href="https://calendly.com/tim-blueoardesigns/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-10 py-4 border border-white/10 rounded-xl font-semibold text-slate-300 hover:border-white/25 hover:text-white transition-colors"
            >
              Book a 30-min Walkthrough
            </a>
          </div>
          <p className="relative mt-4 text-sm text-slate-600">
            7-day free trial · No credit card required
          </p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
