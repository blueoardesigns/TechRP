# Auth & Users Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement session limit enforcement, password reset flow, email verification toggle, and individual user account settings editing.

**Architecture:** All auth logic lives in Next.js API routes using service-role Supabase client. Client-side auth state managed via `AuthProvider` context. No test framework exists — verification uses `npm run build` + `npm run lint` + manual browser checks. Each task is independently deployable.

**Tech Stack:** Next.js 14 App Router, Supabase Auth + DB (service role), TypeScript, Tailwind CSS, Resend (existing), `@supabase/supabase-js`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `web/supabase/session-limit-migration.sql` | Create | Adds `sessions_used`, `session_limit` columns; adds `suspended` to status constraint |
| `web/app/api/sessions/route.ts` | Modify | POST handler increments `sessions_used`, auto-suspends when limit hit |
| `web/components/auth-provider.tsx` | Modify | Adds `suspended` to `UserStatus`; redirects suspended users; exposes `refreshUser` |
| `web/app/pending/page.tsx` | Modify | Adds `suspended` UI branch |
| `web/app/login/page.tsx` | Modify | Adds "Forgot password?" link |
| `web/app/forgot-password/page.tsx` | Create | Email input form → `resetPasswordForEmail` |
| `web/app/reset-password/page.tsx` | Create | Handles Supabase code exchange → new password form |
| `web/app/api/auth/signup/route.ts` | Modify | `email_confirm` driven by `SKIP_EMAIL_CONFIRM` env var |
| `web/.env.local` | Modify | Documents `SKIP_EMAIL_CONFIRM` |
| `web/app/api/account/route.ts` | Create | PATCH: updates `full_name` + `email` in users table + Supabase Auth |
| `web/app/account/page.tsx` | Create | Account Settings page — edit name/email for individuals, read-only for others |
| `web/components/nav.tsx` | Modify | Adds Account link for individuals; name in top-right becomes link for others |

---

## Task 1: Schema migration — session limit + suspended status

**Files:**
- Create: `web/supabase/session-limit-migration.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- web/supabase/session-limit-migration.sql
-- Run in Supabase SQL Editor → New Query

-- 1. Add session tracking columns to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sessions_used INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS session_limit INT NULL; -- NULL = unlimited

-- 2. Extend status to include 'suspended'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'));
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Go to Supabase Dashboard → SQL Editor → New Query, paste and run the file.

Expected: no errors. Verify by running:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'users' AND column_name IN ('sessions_used', 'session_limit');
```
Expected: 2 rows returned.

- [ ] **Step 3: Commit**

```bash
cd /path/to/worktree
git add web/supabase/session-limit-migration.sql
git commit -m "feat: add sessions_used, session_limit, suspended status to users schema"
```

---

## Task 2: Session limit enforcement in POST /api/sessions

**Files:**
- Modify: `web/app/api/sessions/route.ts`

- [ ] **Step 1: Read current file**

Read `web/app/api/sessions/route.ts` fully before editing.

- [ ] **Step 2: Add session limit enforcement to POST handler**

Replace the entire `POST` function with:

```ts
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // organization_id is NOT NULL — fall back to placeholder if user has no org
    if (!body.organization_id) body.organization_id = FALLBACK_ORG;
    const supabase = createServiceSupabase();
    const { data, error } = await (supabase as any)
      .from('training_sessions')
      .insert(body)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Increment sessions_used and auto-suspend if limit reached
    const userId = body.user_id;
    if (userId) {
      await (supabase as any).rpc('increment_sessions_used', { target_user_id: userId });

      const { data: userRow } = await (supabase as any)
        .from('users')
        .select('sessions_used, session_limit')
        .eq('id', userId)
        .single();

      if (
        userRow &&
        (userRow as any).session_limit !== null &&
        (userRow as any).sessions_used >= (userRow as any).session_limit
      ) {
        await (supabase as any)
          .from('users')
          .update({ status: 'suspended' })
          .eq('id', userId);
      }
    }

    return NextResponse.json({ session: data }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Add the `increment_sessions_used` RPC function in Supabase**

Run in Supabase SQL Editor:

```sql
CREATE OR REPLACE FUNCTION increment_sessions_used(target_user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE users SET sessions_used = sessions_used + 1 WHERE id = target_user_id;
$$;
```

This uses `SECURITY DEFINER` so RLS doesn't block the update.

- [ ] **Step 4: Verify lint passes**

```bash
cd web && npm run lint
```
Expected: no errors on `app/api/sessions/route.ts`.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/sessions/route.ts
git commit -m "feat: increment sessions_used and auto-suspend user when session limit reached"
```

---

## Task 3: Auth provider — suspended status + refreshUser

**Files:**
- Modify: `web/components/auth-provider.tsx`

- [ ] **Step 1: Read the current file**

Read `web/components/auth-provider.tsx` fully before editing.

- [ ] **Step 2: Update `UserStatus` type and `AuthContextValue`**

Change the `UserStatus` type:
```ts
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
```

Add `refreshUser` to the `AuthContextValue` interface:
```ts
interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
```

Update the context default value:
```ts
const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => {},
});
```

- [ ] **Step 3: Add suspended redirect in loadUser and expose refreshUser**

In the `loadUser` function, after the existing `rejected` redirect block, add:
```ts
// Redirect suspended users to /pending (shows limit-reached UI)
if (appUser.status === 'suspended' && !PUBLIC_PATHS.includes(pathname)) {
  router.replace('/pending');
}
```

In the `AuthProvider` component body, expose `loadUser` as `refreshUser`:
```ts
return (
  <AuthContext.Provider value={{ user, loading, signOut, refreshUser: loadUser }}>
    {children}
  </AuthContext.Provider>
);
```

- [ ] **Step 4: Verify lint passes**

```bash
cd web && npm run lint
```
Expected: no errors on `components/auth-provider.tsx`.

- [ ] **Step 5: Commit**

```bash
git add web/components/auth-provider.tsx
git commit -m "feat: add suspended UserStatus, redirect suspended users, expose refreshUser"
```

---

## Task 4: Pending page — suspended UI branch

**Files:**
- Modify: `web/app/pending/page.tsx`

- [ ] **Step 1: Read the current file**

Read `web/app/pending/page.tsx` fully before editing.

- [ ] **Step 2: Add suspended branch**

Add `isSuspended` alongside the existing `isRejected` check (two lines at the top of the component body):
```ts
const isRejected = user?.status === 'rejected';
const isSuspended = user?.status === 'suspended';
```

The existing JSX has a single `{isRejected ? (...rejected...) : (...pending...)}` block. Wrap it to add the `suspended` case first. Replace that entire conditional with:
```tsx
{isSuspended ? (
  <>
    <div className="w-16 h-16 bg-orange-500/15 border border-orange-500/20 rounded-full flex items-center justify-center mx-auto">
      <span className="text-3xl">🔒</span>
    </div>
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Session Limit Reached</h1>
      <p className="text-gray-400 text-sm leading-relaxed">
        You&apos;ve used all your available training sessions. Contact your admin to upgrade your account.
      </p>
    </div>
    <a
      href="mailto:tim@blueoardesigns.com"
      className="inline-block text-sm text-blue-400 hover:text-blue-300 transition-colors"
    >
      Contact your admin →
    </a>
  </>
) : isRejected ? (
  <>
    <div className={`w-16 h-16 bg-red-500/15 border-red-500/20 border rounded-full flex items-center justify-center mx-auto`}>
      <span className="text-3xl">✋</span>
    </div>
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Application Not Approved</h1>
      <p className="text-gray-400 text-sm leading-relaxed">
        Your account request was not approved at this time. If you believe this is an error, please reach out directly.
      </p>
    </div>
    <a
      href="mailto:tim@blueoardesigns.com"
      className="inline-block text-sm text-blue-400 hover:text-blue-300 transition-colors"
    >
      Contact tim@blueoardesigns.com →
    </a>
  </>
) : (
  <>
    <div className="w-16 h-16 bg-yellow-500/15 border border-yellow-500/20 rounded-full flex items-center justify-center mx-auto">
      <span className="text-3xl">⏳</span>
    </div>
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Pending Approval</h1>
      <p className="text-gray-400 text-sm leading-relaxed">
        Your account is being reviewed. You&apos;ll receive an email at{' '}
        <span className="text-white font-medium">{user?.email ?? 'your email'}</span>{' '}
        once you&apos;re approved — usually within 24 hours.
      </p>
    </div>
    <div className="bg-gray-900 border border-white/10 rounded-xl px-5 py-4 text-left space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">What happens next</p>
      <ul className="text-sm text-gray-400 space-y-1.5">
        <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">→</span> Your request has been sent for review</li>
        <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">→</span> You&apos;ll get an email when approved</li>
        <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">→</span> Sign back in to start training</li>
      </ul>
    </div>
    {resent ? (
      <p className="text-sm text-green-400">Approval request resent.</p>
    ) : (
      <div className="space-y-1">
        <button
          onClick={handleResend}
          disabled={resending}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
        >
          {resending ? 'Resending…' : 'Resend approval request'}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    )}
  </>
)}
```

The sign-out button below this block remains unchanged.

- [ ] **Step 3: Verify build passes**

```bash
cd web && npm run build
```
Expected: no TypeScript or JSX errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/pending/page.tsx
git commit -m "feat: add suspended session-limit-reached UI to pending page"
```

---

## Task 5: Forgot password page

**Files:**
- Create: `web/app/forgot-password/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase-browser';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createBrowserSupabase();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    });
    // Always show success to prevent email enumeration
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2.5">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#g)" />
              <path d="M7 9h18M16 9v14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M10 16h7l4 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3B82F6" /><stop offset="1" stopColor="#6366F1" />
                </linearGradient>
              </defs>
            </svg>
            <span className="font-bold text-lg tracking-tight">TechRP</span>
          </div>
        </div>

        <div className="bg-gray-900 border border-white/10 rounded-2xl p-8">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                <span className="text-2xl">✉️</span>
              </div>
              <h1 className="text-xl font-bold text-white">Check your email</h1>
              <p className="text-sm text-gray-400">
                If an account exists for <span className="text-white">{email}</span>, you&apos;ll receive a password reset link shortly.
              </p>
              <Link href="/login" className="block text-sm text-blue-400 hover:text-blue-300 transition-colors mt-2">
                Back to sign in →
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-white mb-1">Reset your password</h1>
              <p className="text-sm text-gray-500 mb-6">
                Enter your email and we&apos;ll send you a reset link.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          )}
        </div>

        {!submitted && (
          <p className="text-center text-sm text-gray-500 mt-5">
            <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Back to sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
cd web && npm run build
```
Expected: no TypeScript errors. Route `/forgot-password` appears in build output.

- [ ] **Step 3: Commit**

```bash
git add web/app/forgot-password/page.tsx
git commit -m "feat: add forgot-password page with Supabase resetPasswordForEmail"
```

---

## Task 6: Reset password page

**Files:**
- Create: `web/app/reset-password/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase-browser';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [exchanged, setExchanged] = useState(false);
  const [exchangeError, setExchangeError] = useState(false);

  useEffect(() => {
    if (!code) {
      setExchangeError(true);
      return;
    }
    const supabase = createBrowserSupabase();
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setExchangeError(true);
      } else {
        setExchanged(true);
      }
    });
  }, [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    const supabase = createBrowserSupabase();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    router.push('/training');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2.5">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#g)" />
              <path d="M7 9h18M16 9v14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M10 16h7l4 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3B82F6" /><stop offset="1" stopColor="#6366F1" />
                </linearGradient>
              </defs>
            </svg>
            <span className="font-bold text-lg tracking-tight">TechRP</span>
          </div>
        </div>

        <div className="bg-gray-900 border border-white/10 rounded-2xl p-8">
          {exchangeError ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-red-400">This reset link is invalid or has expired.</p>
              <Link href="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                Request a new link →
              </Link>
            </div>
          ) : !exchanged ? (
            <p className="text-sm text-gray-400 text-center animate-pulse">Verifying link…</p>
          ) : (
            <>
              <h1 className="text-xl font-bold text-white mb-1">Set new password</h1>
              <p className="text-sm text-gray-500 mb-6">Choose a strong password for your account.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">New password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {loading ? 'Saving…' : 'Set new password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
cd web && npm run build
```
Expected: no TypeScript errors. Route `/reset-password` appears in build output.

- [ ] **Step 3: Commit**

```bash
git add web/app/reset-password/page.tsx
git commit -m "feat: add reset-password page with code exchange and password update"
```

---

## Task 7: Login page — forgot password link

**Files:**
- Modify: `web/app/login/page.tsx`

- [ ] **Step 1: Read the current file**

Read `web/app/login/page.tsx` fully before editing.

- [ ] **Step 2: Add the forgot password link**

Inside the `<form>`, after the password `<div>` block and before the `{error && ...}` block, add:

```tsx
<div className="flex justify-end">
  <Link
    href="/forgot-password"
    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
  >
    Forgot password?
  </Link>
</div>
```

Ensure `Link` is already imported from `'next/link'` — it is in the existing file.

- [ ] **Step 3: Verify build passes**

```bash
cd web && npm run build
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/login/page.tsx
git commit -m "feat: add forgot password link to login page"
```

---

## Task 8: Email verification toggle

**Files:**
- Modify: `web/app/api/auth/signup/route.ts`
- Modify: `web/.env.local`

- [ ] **Step 1: Update signup route**

In `web/app/api/auth/signup/route.ts`, find:
```ts
email_confirm: true, // skip confirmation email — we approve manually
```

Replace with:
```ts
// SKIP_EMAIL_CONFIRM=false in production to require email verification.
// Defaults to true (skip verification) to preserve current behaviour.
email_confirm: process.env.SKIP_EMAIL_CONFIRM !== 'false',
```

- [ ] **Step 2: Document in .env.local**

Add to `web/.env.local` (below the existing variables):
```
# Email verification on signup.
# Set to 'false' in production to require users to confirm their email before signing in.
# Omit or set to 'true' to skip verification (current default — manual approval flow).
# SKIP_EMAIL_CONFIRM=true
```

- [ ] **Step 3: Verify lint passes**

```bash
cd web && npm run lint
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/auth/signup/route.ts web/.env.local
git commit -m "feat: make email verification configurable via SKIP_EMAIL_CONFIRM env var"
```

---

## Task 9: /api/account PATCH route

**Files:**
- Create: `web/app/api/account/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

export async function PATCH(req: NextRequest) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { fullName, email } = await req.json();
  if (!fullName && !email) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const supabase = createServiceSupabase();

  // Update users table
  const updates: Record<string, string> = {};
  if (fullName) { updates.full_name = fullName; updates.name = fullName; }
  if (email) updates.email = email;

  const { data: updatedProfile, error: profileError } = await (supabase as any)
    .from('users')
    .update(updates)
    .eq('auth_user_id', authUser.id)
    .select('id, full_name, email, app_role, status, scenario_access, coach_instance_id, organization_id')
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Sync email change to Supabase Auth
  if (email && email !== authUser.email) {
    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
      authUser.id,
      { email }
    );
    if (authUpdateError) {
      // Profile already updated — log but don't fail the request
      console.error('Failed to sync email to Supabase Auth:', authUpdateError);
    }
  }

  return NextResponse.json({ profile: updatedProfile });
}
```

- [ ] **Step 2: Verify lint passes**

```bash
cd web && npm run lint
```
Expected: no errors on `app/api/account/route.ts`.

- [ ] **Step 3: Verify build passes**

```bash
cd web && npm run build
```
Expected: route `/api/account` appears.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/account/route.ts
git commit -m "feat: add /api/account PATCH route for name/email updates"
```

---

## Task 10: Account Settings page

**Files:**
- Create: `web/app/account/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { AppNav } from '@/components/nav';

export default function AccountPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const isIndividual = user?.role === 'individual';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    const res = await fetch('/api/account', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? 'Failed to save changes.');
      return;
    }

    await refreshUser();
    setSuccess(true);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AppNav />
      <div className="max-w-xl mx-auto px-6 sm:px-10 py-12">
        <h1 className="text-2xl font-bold text-white mb-1">Account Settings</h1>
        <p className="text-sm text-gray-500 mb-8">
          {isIndividual ? 'Update your name and email address.' : 'Your account details.'}
        </p>

        <div className="bg-gray-900 border border-white/10 rounded-2xl p-8">
          {isIndividual ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Full name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
                {email !== user.email && (
                  <p className="text-xs text-yellow-400 mt-1.5">
                    A confirmation will be sent to your new email address.
                  </p>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              {success && (
                <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  Changes saved.
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Full name</p>
                <p className="text-sm text-white">{user.fullName || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Email</p>
                <p className="text-sm text-white">{user.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Role</p>
                <p className="text-sm text-white capitalize">{user.role.replace('_', ' ')}</p>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => router.back()}
          className="mt-6 text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
cd web && npm run build
```
Expected: no TypeScript errors. Route `/account` appears in build output.

- [ ] **Step 3: Commit**

```bash
git add web/app/account/page.tsx
git commit -m "feat: add account settings page with name/email editing for individual users"
```

---

## Task 11: Nav — Account link

**Files:**
- Modify: `web/components/nav.tsx`

- [ ] **Step 1: Read the current file**

Read `web/components/nav.tsx` fully before editing.

- [ ] **Step 2: Add Account link for individual role**

In the `getNavItems` function, update the `individual` return value:
```ts
// individual
return [
  { href: '/training',   label: 'Train'    },
  { href: '/sessions',   label: 'Sessions' },
  { href: '/recordings', label: 'Upload'   },
  { href: '/account',    label: 'Account'  },
];
```

- [ ] **Step 3: Make the name in the top-right a link to /account for other roles**

In `AppNav`, find the `{user && ...}` span in the top-right div and replace it:
```tsx
{user && (
  <Link
    href="/account"
    className="text-xs text-gray-500 hover:text-white transition-colors hidden sm:block"
  >
    {user.fullName || user.email}
  </Link>
)}
```

This applies to all roles — `individual` also gets their name as a link, complementing the nav item.

- [ ] **Step 4: Verify build passes**

```bash
cd web && npm run build
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/components/nav.tsx
git commit -m "feat: add Account link to nav for individuals; make user name a link for all roles"
```

---

## Final verification

- [ ] **Run full build and lint**

```bash
cd web && npm run lint && npm run build
```
Expected: clean output, no errors or warnings.

- [ ] **Manual smoke test checklist**

1. Log in as an individual user → nav shows "Account" link → click it → see edit form
2. Edit name → save → nav name updates immediately
3. Go to `/forgot-password` → enter email → see confirmation message
4. Check Supabase Auth dashboard confirms a reset email was dispatched
5. Open reset link from email → set new password → redirected to `/training`
6. Log in → click "Forgot password?" link on login page → reaches `/forgot-password`
7. Set `SKIP_EMAIL_CONFIRM=false` in `.env.local`, restart dev server, sign up a new user → email confirmation required before login
8. Set a `session_limit` on a test user via Supabase dashboard, complete that many sessions → status changes to `suspended` → redirected to `/pending` with lock icon

- [ ] **Mark TODO items complete**

In `TODO.md`, check off:
```
- [x] Session limit enforcement: increment `sessions_used` after each session; auto-suspend temp accounts when limit reached
- [x] Password reset flow (Supabase "forgot password" email)
- [x] Email verification toggle (currently disabled — consider re-enabling for production)
- [x] Individual users: allow name/email edit in Account Settings
```
