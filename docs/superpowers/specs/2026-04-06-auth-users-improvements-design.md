# Auth & Users Improvements — Design Spec

Date: 2026-04-06

## Overview

Four auth/user features from the TODO backlog:
1. Session limit enforcement — increment `sessions_used`, auto-suspend when limit reached
2. Password reset flow — Supabase "forgot password" email
3. Email verification toggle — env-var driven, currently disabled
4. Account Settings — individual users can edit name/email

---

## 1. Session Limit Enforcement

### Schema Migration

New file: `web/supabase/session-limit-migration.sql`

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sessions_used  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS session_limit  INT NULL;  -- NULL = unlimited

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'));
```

### `/api/sessions` POST Logic

After inserting a training session, if `user_id` is present:
1. Increment `sessions_used` on the user row via `UPDATE users SET sessions_used = sessions_used + 1 WHERE id = user_id`
2. Fetch back `sessions_used` and `session_limit`
3. If `session_limit IS NOT NULL AND sessions_used >= session_limit`, set `status = 'suspended'`

### Auth Provider

- Add `suspended` to `UserStatus` type
- Redirect `suspended` users to `/pending` (same as `rejected`)

### `/pending` Page

Add a third branch for `status === 'suspended'`:
- Icon: 🔒
- Title: "Session Limit Reached"
- Message: "You've used all your available training sessions. Contact your admin to upgrade your account."

### `session_limit` assignment

`session_limit` starts as `NULL` (unlimited) for all users. Company admins or coaches set it manually via the DB or admin panel (out of scope for this spec — just the enforcement logic here).

---

## 2. Password Reset Flow

### No backend API routes needed — all client-side Supabase Auth.

### `/login` page

Add a "Forgot password?" link below the password field:
```
<Link href="/forgot-password">Forgot password?</Link>
```

### `/forgot-password` page

- Single email input form
- On submit: `supabase.auth.resetPasswordForEmail(email, { redirectTo: process.env.NEXT_PUBLIC_APP_URL + '/reset-password' })` — requires `NEXT_PUBLIC_APP_URL` in `.env.local` (already referenced in signup route)
- Always shows success message after submit ("Check your email for a reset link") regardless of whether the email exists — prevents account enumeration
- Link back to `/login`

### `/reset-password` page

Handles the redirect from Supabase's password reset email (arrives with `?code=...`):
1. On mount: `supabase.auth.exchangeCodeForSession(code)` to establish a session
2. Shows new-password + confirm-password form
3. On submit: `supabase.auth.updateUser({ password: newPassword })`
4. On success: redirect to `/training`
5. If `code` param is missing or exchange fails: show error with link back to `/forgot-password`

---

## 3. Email Verification Toggle

### `web/app/api/auth/signup/route.ts`

Change line:
```ts
// Before
email_confirm: true,

// After
email_confirm: process.env.SKIP_EMAIL_CONFIRM !== 'false',
```

- `SKIP_EMAIL_CONFIRM` unset (default): `true` — skips email verification, current behavior preserved
- `SKIP_EMAIL_CONFIRM=false` in production: requires users to confirm their email before signing in

### `web/.env.local`

Add documentation comment:
```
# Set to 'false' in production to require email verification on signup
# SKIP_EMAIL_CONFIRM=true
```

---

## 4. Account Settings

### `/api/account` PATCH route

Authenticated endpoint:
1. Get `authUser` from Supabase session
2. Accept `{ fullName, email }` in request body
3. Update `users` table: `full_name`, `email` where `auth_user_id = authUser.id`
4. If email changed: call `supabase.auth.admin.updateUserById(authUserId, { email })` to keep Supabase Auth in sync
5. Return updated profile

### `/account` page

- Accessible to all approved users
- Pre-fills form with current `user.fullName` and `user.email` from auth context
- **Individual role**: full name + email fields are editable, submit calls `/api/account` PATCH
- **Other roles** (company_admin, coach, superuser): read-only display of name and email
- On email change: show info note — "A confirmation will be sent to your new email address"
- On success: expose `refreshUser` from `AuthContext` (wraps the existing `loadUser` callback) and call it so the nav name/email updates immediately

### Nav changes

- `individual` role: add "Account" link to nav items
- All other approved roles: make the name/email display in the top-right corner a link to `/account`

---

## Files Affected

| File | Change |
|---|---|
| `web/supabase/session-limit-migration.sql` | New — adds `sessions_used`, `session_limit`, `suspended` status |
| `web/app/api/sessions/route.ts` | Increment `sessions_used`, auto-suspend on limit |
| `web/components/auth-provider.tsx` | Add `suspended` to `UserStatus` type + redirect logic + expose `refreshUser` |
| `web/app/pending/page.tsx` | Add `suspended` UI branch |
| `web/app/login/page.tsx` | Add "Forgot password?" link |
| `web/app/forgot-password/page.tsx` | New — email input, calls `resetPasswordForEmail` |
| `web/app/reset-password/page.tsx` | New — handles code exchange + new password form |
| `web/app/api/auth/signup/route.ts` | Email confirm env-var toggle |
| `web/.env.local` | Document `SKIP_EMAIL_CONFIRM` |
| `web/app/api/account/route.ts` | New — PATCH name/email |
| `web/app/account/page.tsx` | New — Account Settings page |
| `web/components/nav.tsx` | Add Account link for individuals; name → link for others |
