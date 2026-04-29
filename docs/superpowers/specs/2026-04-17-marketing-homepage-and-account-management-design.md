# Design Spec: Marketing Homepage & Account Management
**Date:** 2026-04-17
**Status:** Approved for implementation

---

## Overview

Three independent features:

1. **Marketing homepage** — Public-facing landing site with Home, Pricing, and About pages before login
2. **Account suspension & deletion** — Self-serve flow for users to pause or close their account
3. **PDF upload access** — No change needed; feature already available to all authenticated users at `/playbooks/create`

---

## Feature 1: Marketing Homepage

### Architecture

The existing `/` route becomes the public marketing homepage. The current dashboard moves to `/dashboard`. Auth middleware redirects authenticated users from `/`, `/pricing`, and `/about` to `/dashboard`. All pages live in the existing Next.js `web/` app — no separate site.

**Route changes:**

| Route | Before | After |
|---|---|---|
| `/` | Dashboard (auth required) | Marketing homepage (public) |
| `/dashboard` | — | Current dashboard content |
| `/pricing` | — | New pricing page (public) |
| `/about` | — | New about page (public) |
| `/login` | Login page | Unchanged |

**Middleware update:** Add `/`, `/pricing`, `/about` as public routes. Add redirect: authenticated user hitting these routes → `/dashboard`.

**Internal link audit required:** All existing internal links and `router.push('/')` calls across the app must be updated to `/dashboard`. Key places to check: `AppNav` home link, post-login redirect in auth provider, any `href="/"` in authenticated pages.

### Visual Design

**Style:** Dark Glassmorphic Premium
- Background: `#0f172a` → `#1e293b` gradient
- Accent: Blue-to-indigo gradient (`#3b82f6` → `#6366f1`)
- Glass cards: `rgba(30,41,59,0.8)` with `border: 1px solid rgba(99,102,241,0.3)`
- Glow orbs: `radial-gradient` purple/blue at 20–30% opacity
- Gradient text: `linear-gradient(90deg, #60a5fa, #a78bfa)` on key phrases
- Body text: `#94a3b8`; headings: `#ffffff`

**Navigation (shared across all marketing pages):**
- Left: TechRP logo (gradient icon + wordmark)
- Center: `Pricing` · `About`
- Right: `Log In` (ghost button) · `Start Free Trial →` (filled gradient button)

---

### Page 1: Homepage

**Section 1 — Hero**
- Badge pill: `AI-POWERED SALES TRAINING FOR RESTORATION TEAMS`
- Headline: *"Your team is losing deals they should be winning."*
- Subtext: *"AI-powered role-play training built for restoration sales teams. Field reps, BD, and estimators practice the conversations that close jobs — before they count."*
- CTAs: `Start Free Trial` (primary) + `See Pricing` (ghost)
- Fine print: `No credit card required · 7-day free trial`
- Decorative: glow orb top-right, subtle grid pattern background

**Section 2 — Pain Point ("Traditional training doesn't work")**
- Section label: `THE PROBLEM`
- Headline: *"Your team learns on real customers. That's a problem."*
- Subtext citing role-play research: lectures deliver 5% knowledge retention; role-play delivers 75% (ATD)
- Three stat cards (dark glass):
  - `5%` — Retention from traditional lecture-based training (ATD)
  - `75%` — Retention when teams learn through active role-play (ATD)
  - `[STAT]` — Placeholder: Tim to supply a restoration-specific stat (e.g. % of jobs lost at the door, avg close rate lift, etc.)
- Transition line: *"TechRP closes that gap."*

**Section 3 — Solution pillars**
- Section label: `HOW IT WORKS`
- Headline: *"Practice. Score. Improve. Repeat."*
- Three glass cards with gradient icon backgrounds:
  1. **Practice** — 150+ AI personas modeled on real homeowners, adjusters, and property managers. Skeptics, price-shoppers, insurance fighters — all there.
  2. **Score** — Every session graded automatically by Claude AI against your playbook. No manager time required.
  3. **Improve** — Managers review sessions, assign targeted playbooks, and track progress over time.

**Section 4 — Screenshots ("See it in action")**
- Section label: `THE PLATFORM`
- Headline: *"Built for the restoration industry. Not adapted from generic software."*
- Three screenshot placeholder frames, labeled:
  1. `[SCREENSHOT: Training session in progress — AI persona voice call]`
  2. `[SCREENSHOT: Session review — transcript + AI score breakdown]`
  3. `[SCREENSHOT: Manager dashboard — team performance over time]`
- Note: Replace with actual screenshots before launch.

**Section 5 — Video placeholder**
- Headline: *"Watch a live training session"*
- Large play-button frame with caption: `[VIDEO: 90-second screen recording of a full TechRP training call — persona intro, live voice roleplay, AI score report]`
- Suggested video content:
  - *Video 1 (Hero):* Full training session walkthrough — show the persona picking, the voice call, and the scored results
  - *Video 2 (Testimonial):* Tim speaking to camera about why he built TechRP and what changed for restoration teams
  - *Video 3 (How-to):* Manager setting up a playbook and assigning it to their team
  - *Video 4 (Results):* Before/after framing — what a call sounds like without training vs. with

**Section 6 — Stats bar**
- Four stats in a horizontal strip:
  - `150+` AI personas
  - `10` scenario types
  - `75%` avg. retention with role-play
  - `Scored by Claude AI`

**Section 7 — Pricing teaser**
- Headline: *"Simple, transparent pricing"*
- Abbreviated individual plan cards (Starter · Growth · Pro) with prices
- 7-day free trial badge on each
- `See full pricing →` link to `/pricing`

**Section 8 — Final CTA banner**
- Headline: *"Ready to build a team that closes?"*
- Subtext: *"Join restoration companies already training smarter with TechRP."*
- CTA: `Start your 7-day free trial` · `No credit card required`

---

### Page 2: Pricing

**Layout:** Full pricing page at `/pricing`

- Toggle: `Individual` / `Team` — switches between plan sets
- **Individual plans:**
  | Plan | Price | Minutes |
  |---|---|---|
  | Starter | $34.99/mo | 120 min/mo |
  | Growth | $57.99/mo | 240 min/mo |
  | Pro | $89.99/mo | 400 min/mo |
- **Team plans:** Seat-based pricing pulled from `web/lib/plans.ts` at build time — Standard and Pro tiers with 4 seat-count buckets each. Displayed as a simplified "starting from" price with a "contact us for larger teams" note.
- Every plan card: 7-day free trial badge, feature list, `Start Free Trial` CTA
- Add-on note: Additional training hours available ($10.99–$14.99/hr depending on plan)
- FAQ section (5–6 questions): What happens after the trial? Can I switch plans? What's a training minute? Does it work for BD reps? Can managers review sessions?
- Bottom CTA: `Still have questions? Contact us.` → mailto link

---

### Page 3: About

**Layout:** Single-column, personal tone at `/about`

- Section 1 — **Tim's story**
  - Headline: *"Built by someone who's been in the field."*
  - Subtext: 20+ years developing, training, and leading sales teams for restoration companies
  - Body copy (2–3 paragraphs): The problem Tim kept seeing — restoration companies with great technicians who struggled to convert jobs because they'd never been trained to handle the conversation. Traditional training failed. Role-play was expensive and inconsistent. TechRP is the tool he wished existed.
  - `[PHOTO: Tim headshot placeholder]`
  - LinkedIn link: `https://www.linkedin.com/in/tiniertim`

- Section 2 — **What Tim brings**
  - 3–4 credential bullets drawn from LinkedIn: team leadership, sales process development, restoration-specific domain expertise, track record of measurable results

- Section 3 — **The mission**
  - 1-paragraph mission statement: Give every restoration tech the training reps that top performers get — on-demand, scored, and built for their specific conversations.

- Section 4 — **CTA**
  - `Start your free trial` + `Have a question? Reach out.`

---

## Feature 2: Account Suspension & Deletion

### Where it lives

Bottom of `/account` page, separated by a divider labeled "Danger Zone". Visible to all authenticated roles.

### UI Flow

**Entry:** Red-bordered section with heading "Suspend or Delete Account" and a single button: `Manage Account Status`

**Modal — Step 1: Choose action**

Two options with descriptions:
- **Temporarily suspend** — *"Pause your subscription and block access. Your data is preserved. You can reactivate anytime."*
- **Permanently delete** — *"Cancel your subscription and erase all records. This cannot be undone."*

**Modal — Step 2: Tell us why (required)**

Radio buttons:
- Price is too high
- No time to use the software
- I've gotten as much out of it as I can
- I don't enjoy using the software
- Other → reveals free-text input

**Modal — Step 3: Confirm**

- *Suspend:* Red `Suspend My Account` button
- *Delete:* User must type `DELETE` into a confirmation input, then red `Permanently Delete My Account` button activates

### API: `POST /api/account/close`

**Request body:**
```ts
{ action: 'suspend' | 'delete', reason: string, reasonDetail?: string }
```

**Suspend flow:**
1. Fetch user's Stripe `customer_id` from `users` table
2. Fetch active subscription via Stripe API
3. Call `stripe.subscriptions.update(subId, { pause_collection: { behavior: 'void' } })` to pause billing
4. Set `users.status = 'suspended'` in Supabase (service role client)
5. Send email to `tbauertext@gmail.com` via Resend: user name, email, plan, reason, timestamp
6. Return `{ success: true, action: 'suspended' }`
7. Client signs out user, redirects to `/` (marketing homepage)

**Delete flow:**
1. Fetch user's Stripe `customer_id`
2. Cancel subscription: `stripe.subscriptions.cancel(subId)`
3. Delete user records in order: `training_sessions`, `playbooks` (user-created), `users`
4. Delete Supabase Auth user via service role
5. Send email to `tbauertext@gmail.com` via Resend: same fields + "DELETED" label
6. Return `{ success: true, action: 'deleted' }`
7. Client redirects to `/` (marketing homepage)

**Error handling:** If Stripe call fails, abort and return error — do not update DB status. Show user-friendly error in modal.

### Email format (both actions)

**Subject:** `[TechRP] Account {{action}} — {{user email}}`

**Body:**
```
Action: SUSPENDED / DELETED
User: {{full name}} <{{email}}>
Plan: {{plan name}}
Reason: {{reason}}
{{reasonDetail if provided}}
Timestamp: {{ISO date}}
```

---

## Feature 3: PDF Upload Access

**No implementation needed.** The PDF upload feature is already available to all authenticated users at `/playbooks/create` → "Upload a document." There is no role check on the upload button or the `/api/playbook/upload` API route. The user can access this immediately.

---

## Out of Scope

- Email verification flow changes
- Self-serve reactivation for suspended accounts (Tim reactivates manually via Stripe dashboard + Supabase for now; the UI tells users to email support)
- Bulk team account deletion
- Data export before deletion
