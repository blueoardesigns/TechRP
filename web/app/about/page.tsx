import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingNav } from '@/components/marketing-nav';
import { MarketingFooter } from '@/components/marketing-footer';

export const metadata: Metadata = {
  title: 'About — TechRP',
  description: 'Built by someone who has spent 20+ years developing, training, and leading sales teams for restoration companies.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <MarketingNav />

      {/* Hero */}
      <section className="pt-24 pb-16 px-6 text-center">
        <p className="text-xs font-semibold tracking-[3px] text-indigo-400 uppercase mb-4">About</p>
        <h1 className="text-5xl font-extrabold mb-4 leading-tight">
          Built by someone who&apos;s<br />
          <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            been in the field.
          </span>
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          20+ years developing, training, and leading sales teams for restoration companies.
          TechRP is the tool I wish I&apos;d had.
        </p>
      </section>

      {/* Story */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-10 mb-10 flex flex-col sm:flex-row gap-8 items-start">
            <div className="w-24 h-24 rounded-2xl bg-slate-700/60 border border-white/10 flex-shrink-0 flex items-center justify-center">
              <span className="text-slate-500 text-xs text-center leading-snug px-2">[PHOTO: Tim headshot placeholder]</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">Tim Bauer</h2>
              <p className="text-indigo-400 text-sm font-medium mb-1">Founder, TechRP</p>
              <a
                href="https://www.linkedin.com/in/tiniertim"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 text-sm hover:text-indigo-400 transition-colors"
              >
                linkedin.com/in/tiniertim →
              </a>
            </div>
          </div>

          <div className="space-y-6 text-slate-300 leading-relaxed">
            <p>
              I&apos;ve spent more than 20 years inside restoration companies — developing sales processes, training field teams,
              and leading the people who walk into someone&apos;s worst day and try to help them through it.
              The technical skills were rarely the problem. The conversations were.
            </p>
            <p>
              Great technicians would get to a job site and freeze up when a homeowner pushed back on price.
              BD reps would get nervous in front of a property manager and lose accounts they should have won.
              The problem wasn&apos;t knowledge — it was practice. They&apos;d never had a safe place to rehearse
              the hard conversations before they were standing in front of a real customer.
            </p>
            <p>
              Traditional role-play training was expensive, inconsistent, and hard to scale.
              You needed a manager available, a willing partner, and someone to give meaningful feedback afterward.
              Most teams did it once a quarter if they were lucky. It wasn&apos;t enough.
            </p>
            <p>
              TechRP is the tool I kept wishing existed. AI personas that sound like the real homeowners and
              property managers your team faces every day. Automatic scoring against your actual playbooks.
              A manager dashboard that shows you exactly who&apos;s improving and who needs more reps — without
              anyone having to sit in on every call.
            </p>
          </div>
        </div>
      </section>

      {/* Credentials */}
      <section className="py-16 px-6 bg-[#080d1a] border-y border-white/5">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">What I bring to this</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              '20+ years in restoration sales leadership',
              'Built and scaled sales teams from the ground up',
              'Developed training programs that measurably improved close rates',
              'Deep experience with insurance, mitigation, and reconstruction sales cycles',
              'Coached both field technicians and dedicated BD reps',
              'Founded TechRP to make high-quality training accessible to every restoration company',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 bg-slate-800/40 border border-white/5 rounded-xl p-4">
                <span className="text-indigo-400 mt-0.5 flex-shrink-0">◆</span>
                <p className="text-slate-300 text-sm leading-snug">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">The mission</h2>
          <p className="text-slate-300 leading-relaxed text-lg">
            Give every restoration sales rep the training reps that top performers get — on-demand,
            scored by AI, and built specifically for the conversations that win restoration jobs.
            No scheduling. No inconsistency. Just deliberate practice that translates to the field.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-[#080d1a] border-t border-white/5">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold mb-4">Try it yourself</h2>
          <p className="text-slate-400 mb-8">
            7-day free trial. No credit card. See exactly what your team would experience.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl font-bold shadow-[0_4px_24px_rgba(99,102,241,0.4)] hover:shadow-[0_4px_36px_rgba(99,102,241,0.6)] transition-shadow"
            >
              Start your free trial
            </Link>
            <a
              href="mailto:tbauertext@gmail.com"
              className="px-8 py-4 border border-white/10 rounded-xl font-semibold text-slate-300 hover:border-white/25 hover:text-white transition-colors"
            >
              Have a question? Reach out.
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter current="about" />
    </div>
  );
}
