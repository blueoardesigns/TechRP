import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingNav } from '@/components/marketing-nav';
import { MarketingFooter } from '@/components/marketing-footer';
import { RoiCalculator } from '../lp/roi-calculator';

export const metadata: Metadata = {
  title: 'TechRP — Turn Your Existing Team Into Restoration Closers',
  description:
    'You don’t need more leads. You need a team that closes the ones you already pay for. TechRP gives every rep voice-AI roleplay built for water and mold restoration.',
};

export default function StoryBrandLandingPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <MarketingNav />

      {/* ── HERO (Character + Promise) ── */}
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
            For Water &amp; Mold Restoration Teams
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.1] mb-6 tracking-tight">
            Every restoration owner deserves a team{' '}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              that closes.
            </span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            You don’t need more leads. You need a team that wins the ones you already pay for.
            TechRP gives every tech and BD rep voice-AI roleplay built specifically for restoration
            — so they show up ready, not learning on your customers.
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
          </div>
          <p className="mt-4 text-sm text-slate-600">
            7-day free trial · No credit card required
          </p>
        </div>
      </section>

      {/* ── EMPATHY ── */}
      <section className="py-24 px-6 bg-[#080d1a]">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-semibold tracking-[3px] text-indigo-400 uppercase mb-4">
            We Get It
          </p>
          <h2 className="text-4xl font-extrabold mb-8 leading-tight">
            You shouldn&apos;t have to choose between<br />
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              training your team and running your business.
            </span>
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed mb-6">
            You’ve poured money into Google Ads, Angi, referrals, branded trucks. The phone rings.
            And then you watch a $10,000 job slip away because the tech on the other end didn’t
            know how to handle a simple objection.
          </p>
          <p className="text-lg text-slate-400 leading-relaxed">
            It’s not their fault. Nobody taught them. And you don’t have time to ride along on
            every call.
          </p>
        </div>
      </section>

      {/* ── PROBLEM (3 layers) ── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold tracking-[3px] text-indigo-400 uppercase mb-4 text-center">
            The Real Problem
          </p>
          <h2 className="text-4xl font-extrabold text-center mb-16 leading-tight">
            It’s not a marketing problem. It’s a readiness problem.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                tag: 'External',
                title: 'You’re losing jobs you should be winning.',
                desc: 'New techs freeze on objections. BD reps walk out of plumber visits empty-handed. Every miss is revenue you already paid to acquire.',
              },
              {
                tag: 'Internal',
                title: 'You’re tired of being the only closer in the company.',
                desc: 'You can’t scale yourself. Riding along, re-listening to calls, coaching the same lessons over and over — it’s exhausting and it doesn’t stick.',
              },
              {
                tag: 'Philosophical',
                title: 'It’s not right that better-trained companies win the same job.',
                desc: 'Two trucks. Same homeowner. Same flood. The company with the better-trained rep gets the work. Skill should be teachable — it shouldn’t be a lottery.',
              },
            ].map((p) => (
              <div
                key={p.title}
                className="bg-slate-800/60 border border-white/5 rounded-2xl p-7 backdrop-blur"
              >
                <div className="inline-block bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-bold tracking-[2px] uppercase px-2 py-0.5 rounded-full mb-4">
                  {p.tag}
                </div>
                <h3 className="text-lg font-bold mb-3 leading-snug">{p.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GUIDE (Authority + Empathy) ── */}
      <section className="py-24 px-6 bg-[#080d1a]">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-12 items-center">
            <div className="md:col-span-2">
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-white/5 flex items-center justify-center text-7xl">
                🎓
              </div>
            </div>
            <div className="md:col-span-3">
              <p className="text-xs font-semibold tracking-[3px] text-indigo-400 uppercase mb-4">
                Meet Your Guide
              </p>
              <h2 className="text-4xl font-extrabold mb-6 leading-tight">
                25 years teaching restoration sales.<br />
                Now built into voice AI.
              </h2>
              <p className="text-slate-400 leading-relaxed mb-4">
                TechRP isn’t generic AI sales fluff retrofitted for restoration. Every persona,
                every objection, every playbook is built from the ground up for water and mold —
                designed by a sales coach with over two decades of experience training the exact
                people you employ.
              </p>
              <p className="text-slate-400 leading-relaxed">
                We’ve sat at the kitchen table during the awkward silence. We’ve been ghosted by
                the property manager. We know what works — and we built TechRP to put that
                experience in your team’s pocket, on demand.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PLAN (3 simple steps) ── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold tracking-[3px] text-indigo-400 uppercase mb-4 text-center">
            The Plan
          </p>
          <h2 className="text-4xl font-extrabold text-center mb-4 leading-tight">
            A simple path to a team that closes.
          </h2>
          <p className="text-slate-400 text-center max-w-2xl mx-auto mb-16 leading-relaxed">
            No new CRM. No multi-day onboarding. Three steps and your team is practicing today.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                n: '1',
                t: 'Sign Your Team Up',
                d: 'Add your techs and BD reps in minutes. Individual plans or 5+ seat business plans — your call.',
              },
              {
                n: '2',
                t: 'They Practice. Live Voice. Real Objections.',
                d: 'Inbound calls, in-home walkthroughs, plumber visits, insurance discoveries — every scenario, every persona, on demand.',
              },
              {
                n: '3',
                t: 'You Watch The Close Rate Climb.',
                d: 'Every call scored, every recording saved, every rep tracked. You see who’s ready and who needs another rep — before it shows up in revenue.',
              },
            ].map((step) => (
              <div
                key={step.n}
                className="bg-slate-800/40 border border-white/5 rounded-2xl p-7 backdrop-blur"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-lg mb-5">
                  {step.n}
                </div>
                <h3 className="text-lg font-bold mb-3 leading-snug">{step.t}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{step.d}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link
              href="/signup"
              className="inline-block px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl font-bold shadow-[0_4px_24px_rgba(99,102,241,0.4)] hover:shadow-[0_4px_36px_rgba(99,102,241,0.6)] transition-shadow"
            >
              Start Step 1 →
            </Link>
          </div>
        </div>
      </section>

      {/* ── ROI CALCULATOR ── */}
      <section id="roi" className="py-28 px-6 bg-[#080d1a] scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-[3px] text-indigo-400 uppercase mb-4">
              See What’s At Stake
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
            Multiply by your number of trained reps for company-wide impact.
          </p>
        </div>
      </section>

      {/* ── SUCCESS vs FAILURE (Stakes) ── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold tracking-[3px] text-indigo-400 uppercase mb-4 text-center">
            The Choice
          </p>
          <h2 className="text-4xl font-extrabold text-center mb-16 leading-tight">
            Two roads. Same business. Same leads.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Failure */}
            <div className="bg-slate-800/30 border border-red-500/20 rounded-2xl p-8">
              <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-bold tracking-[2px] uppercase px-3 py-1 rounded-full mb-5">
                Without TechRP
              </div>
              <ul className="space-y-3 text-slate-400">
                {[
                  'You keep losing jobs you already paid to acquire.',
                  'New hires learn on real customers — and real revenue.',
                  'You’re still the only person in the company who can close.',
                  'BD relationships stall. Referrals dry up.',
                  'Marketing spend goes up. Close rate stays flat.',
                ].map((item) => (
                  <li key={item} className="flex gap-3 leading-relaxed">
                    <span className="text-red-400 font-bold mt-0.5">✕</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Success */}
            <div className="bg-gradient-to-br from-emerald-500/5 to-blue-500/5 border border-emerald-500/30 rounded-2xl p-8 shadow-[0_0_40px_rgba(16,185,129,0.08)]">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold tracking-[2px] uppercase px-3 py-1 rounded-full mb-5">
                With TechRP
              </div>
              <ul className="space-y-3 text-slate-300">
                {[
                  'Reps walk into every call already having had it 50 times.',
                  'New hires start producing in week one, not month three.',
                  'You stop being the bottleneck — your team closes without you.',
                  'BD reps build referral sources that actually send work.',
                  'Same leads. 5–10% better close rate. Six-figure annual lift.',
                ].map((item) => (
                  <li key={item} className="flex gap-3 leading-relaxed">
                    <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 px-6 bg-[#080d1a]">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold tracking-[3px] text-indigo-400 uppercase mb-4 text-center">
            Common Questions
          </p>
          <h2 className="text-4xl font-extrabold text-center mb-12 leading-tight">
            Before you start.
          </h2>
          <div className="space-y-4">
            {[
              {
                q: 'How is this different from a chatbot or a video course?',
                a: 'TechRP is voice. Your reps actually talk — the AI listens, responds in real time, throws curveballs, and pushes back. Reading bullet points doesn’t build muscle memory. Hearing a homeowner say “I need to call my husband” does.',
              },
              {
                q: 'How long until I see a difference?',
                a: 'Most teams notice changes inside the first two weeks. A 5-minute roleplay before the workday saves them from blowing the next real call.',
              },
              {
                q: 'Can I use it to screen people I’m hiring?',
                a: 'Yes — it’s one of the most popular use cases. Send a candidate a single skill test before you make an offer. You’ll know in 10 minutes whether they can actually sell.',
              },
              {
                q: 'Will this replace my coach?',
                a: 'No. It frees your coach (or you) up to focus on the high-leverage feedback instead of running drills. Coaches can also have their own account and bring their restoration clients onto the platform.',
              },
              {
                q: 'Can I customize the playbooks?',
                a: 'Yes. Every playbook is editable. Add your branded talk tracks, your service offerings, your local market language.',
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

      {/* ── FINAL CTA (Direct) ── */}
      <section className="py-28 px-6 bg-gradient-to-b from-[#080d1a] to-[#0f172a]">
        <div className="max-w-3xl mx-auto text-center relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.15),transparent_65%)] pointer-events-none" />
          <h2 className="relative text-5xl font-extrabold mb-4 leading-tight">
            Stop letting jobs slip away.<br />
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              Build a team that closes.
            </span>
          </h2>
          <p className="relative text-slate-400 text-lg mb-10 leading-relaxed">
            The next call your rep takes is worth thousands. Make sure they’re ready.
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
