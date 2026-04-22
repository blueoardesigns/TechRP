# Spec: Nine Issues — Demo Prep

## 1. Sidebar Redesign (Issue 4)
- Default: **collapsed** (`w-[52px]`) — icon strip only
- Pinned open: `w-52` (208px) — icons + `text-sm` labels
- Thumbtack/pin icon in header — filled = pinned, outline = collapsed
- Hover tooltips on icons when collapsed
- `localStorage` persists pin state
- Install `lucide-react` for nav icons

## 2. API Auth — Allow Superuser (Issues 1, 2, 3)
- `/api/company/coaches` `getCompanyAdminProfile`: allow `superuser` role
- `/api/team/candidates` `getAdminContext`: allow `superuser` role
- `/api/team/members` (to check): allow `superuser` role
- Fix `loading` never resolving when `user.organizationId` is null in `web/app/team/page.tsx`

## 3. Demo Seeding (Issues 1, 2)
- New `POST /api/admin/seed-demo` (superuser only, idempotent)
- Creates demo org for superuser if missing
- Inserts 5 team members (approved/pending/rejected mix)
- Inserts 5 candidates (pending/signed_up/in_progress/complete/upgraded mix, various BD scenario types)
- Inserts 2 coach connections (pending + active)

## 4. Toggle Fix (Issue 5)
- Off-state: `bg-white/20` → `bg-gray-600`
- Add `overflow-hidden` to button
- Fix knob to use standard `w-11 h-6` container, `w-5 h-5` knob, `translate-x-0.5` / `translate-x-[22px]`

## 5. Buy Button Message (Issue 6)
- When `!planId`, show "An active subscription is required to purchase extra hours" below button
- Button stays disabled — this is correct behavior

## 6. Stripe Portal 404 (Issue 7)
- `web/lib/stripe.ts` throws at module level if `STRIPE_SECRET_KEY` missing, crashing route registration
- Fix: move key validation inside a `getStripe()` lazy function; export `getStripe` instead of `stripe`
- Update portal route to use `getStripe()`

## 7. Billing Link in Sidebar (Issue 8)
- Add `<Link href="/billing">` between user name and Sign out in sidebar footer

## 8. Password Change in Account Settings (Issue 9)
- Add "Change Password" section for all users
- Fields: new password + confirm password
- Calls `supabase.auth.updateUser({ password })`
- Shows success/error inline
