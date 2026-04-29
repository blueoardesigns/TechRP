# Marketing Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current app root (`/`) with a public marketing homepage and move the dashboard to `/dashboard`, adding Pricing and About pages.

**Architecture:** All pages live in the existing Next.js `web/` app. The current `app/page.tsx` (dashboard) moves to `app/dashboard/page.tsx`. A new marketing homepage replaces `app/page.tsx`. Middleware adds `/about` to public routes and redirects logged-in users away from marketing pages to `/dashboard`. A shared `MarketingNav` component is extracted for reuse across all three marketing pages.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, TypeScript. No new dependencies.

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `web/app/dashboard/page.tsx` | Current dashboard moved here |
| Rewrite | `web/app/page.tsx` | Marketing homepage (8 sections) |
| Create | `web/app/pricing/page.tsx` | Pricing page |
| Create | `web/app/about/page.tsx` | About page |
| Create | `web/components/marketing-nav.tsx` | Shared marketing nav |
| Modify | `web/middleware.ts` | Add `/about`, redirect logged-in users |
| Modify | `web/components/nav.tsx:85` | `href="/"` → `href="/dashboard"` |
| Modify | `web/app/team/page.tsx:78` | `router.replace('/')` → `'/dashboard'` |
| Modify | `web/app/playbooks/page.tsx:131` | `router.push('/')` → `'/dashboard'` |
| Modify | `web/app/training/page.tsx:561,572,915` | `router.push('/')` → `'/dashboard'` (3 occurrences) |
| Modify | `web/app/personas/page.tsx:273` | `router.push('/')` → `'/dashboard'` |
| Modify | `web/app/sessions/page.tsx:215` | `router.push('/')` → `'/dashboard'` |
| Modify | `web/app/coach/page.tsx:47` | `router.replace('/')` → `'/dashboard'` |
| Modify | `web/app/admin/notifications/page.tsx:29` | `router.replace('/')` → `'/dashboard'` |

---

## Task 1: Move Dashboard to `/dashboard` and Update Internal Links

**Files:**
- Create: `web/app/dashboard/page.tsx`
- Modify: `web/middleware.ts`
- Modify: `web/components/nav.tsx`
- Modify: `web/app/team/page.tsx`
- Modify: `web/app/playbooks/page.tsx`
- Modify: `web/app/training/page.tsx`
- Modify: `web/app/personas/page.tsx`
- Modify: `web/app/sessions/page.tsx`
- Modify: `web/app/coach/page.tsx`
- Modify: `web/app/admin/notifications/page.tsx`

- [ ] **Step 1: Copy the current dashboard to `/dashboard`**

```bash
cp web/app/page.tsx web/app/dashboard/page.tsx
```

The file is an exact copy — no changes to its content yet.

- [ ] **Step 2: Update middleware — add `/about` to public routes and redirect logged-in users from marketing pages**

In `web/middleware.ts`, replace the PUBLIC_ROUTES line and add the logged-in redirect block:

```typescript
// Replace line 4:
const PUBLIC_ROUTES = ['/', '/login', '/signup', '/pending', '/pricing', '/about'];

// After line 74 (after the public routes early-return), add:
  // Redirect authenticated users away from marketing pages to the dashboard
  const MARKETING_ROUTES = ['/', '/pricing', '/about'];
  if (MARKETING_ROUTES.includes(pathname)) {
    const supabaseCheck = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
    );
    const { data: { user: sbUser } } = await supabaseCheck.auth.getUser();
    if (sbUser) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = '/dashboard';
      return NextResponse.redirect(dashboardUrl);
    }
    return NextResponse.next();
  }
```

Full updated `web/middleware.ts` after changes:

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/pending', '/pricing', '/about'];
const PUBLIC_PREFIXES = ['/api/auth/', '/api/stripe/webhook', '/api/stripe/seed', '/_next/', '/favicon'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/api/seed') {
    const key = request.nextUrl.searchParams.get('key') ?? request.cookies.get('admin_key')?.value;
    if (key && key === process.env.ADMIN_SECRET) return NextResponse.next({ request });
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin/')) {
    if (pathname === '/admin/login') return NextResponse.next();
    const secret = process.env.ADMIN_SECRET;
    if (!secret) {
      if (pathname.startsWith('/api/admin/')) return new NextResponse('Admin not configured', { status: 503 });
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/admin/login';
      return NextResponse.redirect(loginUrl);
    }
    const key = request.nextUrl.searchParams.get('key') ?? request.cookies.get('admin_key')?.value;
    if (key === secret) {
      const res = NextResponse.next({ request });
      res.cookies.set('admin_key', key!, { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' });
      return res;
    }
    const supabaseCheck = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
    );
    const { data: { user: sbUser } } = await supabaseCheck.auth.getUser();
    if (sbUser) return NextResponse.next({ request });
    if (pathname.startsWith('/api/admin/')) return new NextResponse('Unauthorized', { status: 401 });
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/admin/login';
    return NextResponse.redirect(loginUrl);
  }

  // For marketing routes: allow public access, but redirect logged-in users to /dashboard
  const MARKETING_ROUTES = ['/', '/pricing', '/about'];
  if (MARKETING_ROUTES.includes(pathname)) {
    const supabaseCheck = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
    );
    const { data: { user: sbUser } } = await supabaseCheck.auth.getUser();
    if (sbUser) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = '/dashboard';
      return NextResponse.redirect(dashboardUrl);
    }
    return NextResponse.next();
  }

  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

- [ ] **Step 3: Update AppNav logo link**

In `web/components/nav.tsx` line 85, change:
```tsx
// Before:
<Link href="/" className="flex items-center gap-2.5">
// After:
<Link href="/dashboard" className="flex items-center gap-2.5">
```

- [ ] **Step 4: Update all internal `router.push('/')` and `router.replace('/')` references**

`web/app/team/page.tsx:78`:
```tsx
// Before:
router.replace('/');
// After:
router.replace('/dashboard');
```

`web/app/playbooks/page.tsx:131`:
```tsx
// Before:
<button onClick={() => router.push('/')} className="text-sm text-gray-400 hover:text-white transition-colors">
// After:
<button onClick={() => router.push('/dashboard')} className="text-sm text-gray-400 hover:text-white transition-colors">
```

`web/app/training/page.tsx` — 3 occurrences at lines ~561, ~572, ~915 (all `router.push('/')`):
```tsx
// Before (all 3):
router.push('/')
// After (all 3):
router.push('/dashboard')
```

`web/app/personas/page.tsx:273`:
```tsx
// Before:
<button onClick={() => router.push('/')} className="text-sm text-gray-400 hover:text-white transition-colors">
// After:
<button onClick={() => router.push('/dashboard')} className="text-sm text-gray-400 hover:text-white transition-colors">
```

`web/app/sessions/page.tsx:215`:
```tsx
// Before:
<button onClick={() => router.push('/')} className="text-sm text-gray-400 hover:text-white transition-colors">
// After:
<button onClick={() => router.push('/dashboard')} className="text-sm text-gray-400 hover:text-white transition-colors">
```

`web/app/coach/page.tsx:47`:
```tsx
// Before:
if (user.role !== 'coach' && user.role !== 'superuser') { router.replace('/'); return; }
// After:
if (user.role !== 'coach' && user.role !== 'superuser') { router.replace('/dashboard'); return; }
```

`web/app/admin/notifications/page.tsx:29`:
```tsx
// Before:
if (user && user.role !== 'superuser') router.replace('/');
// After:
if (user && user.role !== 'superuser') router.replace('/dashboard');
```

- [ ] **Step 5: Verify the app still builds**

```bash
cd web && npm run build 2>&1 | tail -20
```

Expected: no type errors, build succeeds.

- [ ] **Step 6: Smoke-test manually**

Start dev server (`npm run dev`). Verify:
- Visiting `http://localhost:3000/` while logged out → sees current dashboard content (will be replaced in Task 3)
- Visiting `http://localhost:3000/dashboard` while logged in → sees dashboard
- AppNav logo links to `/dashboard`

- [ ] **Step 7: Commit**

```bash
cd web && git add app/dashboard/page.tsx middleware.ts components/nav.tsx app/team/page.tsx app/playbooks/page.tsx app/training/page.tsx app/personas/page.tsx app/sessions/page.tsx app/coach/page.tsx app/admin/notifications/page.tsx
git commit -m "feat: move dashboard to /dashboard, add marketing route middleware"
```

---

## Task 2: MarketingNav Component

**Files:**
- Create: `web/components/marketing-nav.tsx`

- [ ] **Step 1: Create the component**

Create `web/components/marketing-nav.tsx`:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
cd web && git add components/marketing-nav.tsx
git commit -m "feat: add MarketingNav component for marketing pages"
```

---

## Task 3: Marketing Homepage

**Files:**
- Rewrite: `web/app/page.tsx`

- [ ] **Step 1: Replace `web/app/page.tsx` with the marketing homepage**

```tsx
import Link from 'next/link';
import { MarketingNav } from '@/components/marketing-nav';

export const metadata = {
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
            AI Sales Training for Restoration Teams
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
            Your team learns on real customers.<br />That's a problem.
          </h2>
          <p className="text-slate-400 text-center max-w-2xl mx-auto mb-16 leading-relaxed">
            Without structured practice, every live call is your team's training session.
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
                desc: 'Managers review sessions, assign targeted playbooks, and track each rep's progress over time. Know who's ready before the call.',
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
            Built for restoration.<br />Not adapted from generic software.
          </h2>
          <p className="text-slate-400 text-center max-w-2xl mx-auto mb-16 leading-relaxed">
            Purpose-built for the conversations your team actually faces — on job sites, over the phone, and in front of skeptical homeowners.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              'Training session in progress — AI persona voice call',
              'Session review — transcript + AI score breakdown',
              'Manager dashboard — team performance over time',
            ].map((caption, i) => (
              <div
                key={i}
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
                    : 'border-white/8 bg-slate-800/30'
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

      {/* ── FOOTER ── */}
      <footer className="py-8 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md" />
            <span className="font-bold text-sm">TechRP</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link href="/pricing" className="hover:text-slate-300 transition-colors">Pricing</Link>
            <Link href="/about"   className="hover:text-slate-300 transition-colors">About</Link>
            <Link href="/login"   className="hover:text-slate-300 transition-colors">Log In</Link>
          </div>
          <p className="text-slate-600 text-sm">© {new Date().getFullYear()} TechRP</p>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd web && npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Manual smoke-test**

Visit `http://localhost:3000/` while logged out. Verify all 8 sections render, CTAs link correctly, and nav shows Pricing/About/Log In/Start Free Trial.

- [ ] **Step 4: Commit**

```bash
cd web && git add app/page.tsx
git commit -m "feat: add marketing homepage with 8 sections"
```

---

## Task 4: Pricing Page

**Files:**
- Create: `web/app/pricing/page.tsx`

- [ ] **Step 1: Create `web/app/pricing/page.tsx`**

```tsx
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
    q: 'Can managers review their team\'s sessions?',
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
          Start free. No credit card required. Upgrade when you're ready.
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
                      : 'border-white/8 bg-slate-800/30'
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
                      : 'border-white/8 bg-slate-800/30'
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
          {tab === 'team' && (
            <p className="text-center text-slate-500 text-sm mt-6">
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
```

- [ ] **Step 2: Verify build and smoke-test**

```bash
cd web && npm run build 2>&1 | tail -10
```

Visit `http://localhost:3000/pricing`. Toggle Individual/Team. Verify plan cards, FAQ, and CTAs render correctly.

- [ ] **Step 3: Commit**

```bash
cd web && git add app/pricing/page.tsx
git commit -m "feat: add pricing page with individual/team toggle and FAQ"
```

---

## Task 5: About Page

**Files:**
- Create: `web/app/about/page.tsx`

- [ ] **Step 1: Create `web/app/about/page.tsx`**

```tsx
import Link from 'next/link';
import { MarketingNav } from '@/components/marketing-nav';

export const metadata = {
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
          Built by someone who's<br />
          <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            been in the field.
          </span>
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          20+ years developing, training, and leading sales teams for restoration companies.
          TechRP is the tool I wish I'd had.
        </p>
      </section>

      {/* Story */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-10 mb-10 flex flex-col sm:flex-row gap-8 items-start">
            <div className="w-24 h-24 rounded-2xl bg-slate-700/60 border border-white/10 flex-shrink-0 flex items-center justify-center">
              <span className="text-slate-500 text-xs text-center leading-snug px-2">[PHOTO: Tim headshot]</span>
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

          <div className="prose prose-invert max-w-none space-y-6 text-slate-300 leading-relaxed">
            <p>
              I've spent more than 20 years inside restoration companies — developing sales processes, training field teams,
              and leading the people who walk into someone's worst day and try to help them through it.
              The technical skills were rarely the problem. The conversations were.
            </p>
            <p>
              Great technicians would get to a job site and freeze up when a homeowner pushed back on price.
              BD reps would get nervous in front of a property manager and lose accounts they should have won.
              The problem wasn't knowledge — it was practice. They'd never had a safe place to rehearse
              the hard conversations before they were standing in front of a real customer.
            </p>
            <p>
              Traditional role-play training was expensive, inconsistent, and hard to scale.
              You needed a manager available, a willing partner, and someone to give meaningful feedback afterward.
              Most teams did it once a quarter if they were lucky. It wasn't enough.
            </p>
            <p>
              TechRP is the tool I kept wishing existed. AI personas that sound like the real homeowners and
              property managers your team faces every day. Automatic scoring against your actual playbooks.
              A manager dashboard that shows you exactly who's improving and who needs more reps — without
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
              Start Free Trial
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

      <footer className="py-8 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md" />
            <span className="font-bold text-sm">TechRP</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link href="/"        className="hover:text-slate-300 transition-colors">Home</Link>
            <Link href="/pricing" className="hover:text-slate-300 transition-colors">Pricing</Link>
            <Link href="/login"   className="hover:text-slate-300 transition-colors">Log In</Link>
          </div>
          <p className="text-slate-600 text-sm">© {new Date().getFullYear()} TechRP</p>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verify build and smoke-test**

```bash
cd web && npm run build 2>&1 | tail -10
```

Visit `http://localhost:3000/about`. Verify story, credentials grid, mission section, and CTAs render.

- [ ] **Step 3: Final integration check**

Verify the full user journey:
1. Visit `http://localhost:3000/` → marketing homepage (logged out) ✓
2. Click "Log In" → goes to `/login` ✓
3. Log in as any user → redirected to `/dashboard` (not `/`) ✓
4. Logged-in user navigates to `http://localhost:3000/` → redirected to `/dashboard` ✓
5. Nav logo in the app (`AppNav`) links to `/dashboard` ✓
6. Visit `http://localhost:3000/pricing` and `http://localhost:3000/about` while logged out ✓

- [ ] **Step 4: Commit**

```bash
cd web && git add app/about/page.tsx
git commit -m "feat: add about page with Tim's story, credentials, and mission"
```
