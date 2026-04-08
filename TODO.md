# TechRP — Backlog & TODO

Last updated: 2026-04-04

> **Auth + Coach Role build complete.** All 16 tasks shipped: coach schema, Tim's `/admin`, coach dashboard, invite flows, role-based nav, content isolation, scenario access enforcement, real `user_id` wiring, loading skeletons, mobile-responsive sessions, Sentry, analytics dashboard.

---

## Auth & Users

- [x] Training page: save sessions with real `user_id` (currently uses hardcoded `00000000-0000-0000-0000-000000000001`)
- [x] Wire real `user_id` in recordings and insights API routes (same placeholder issue)
- [x] Rejected user UI — `/pending` shows same message for pending and rejected; rejected users need distinct state + contact link
- [x] Surface "Resend approval email" button on `/pending` page (API route exists, not wired to UI)
- [ ] Session limit enforcement: increment `sessions_used` after each session; auto-suspend temp accounts when limit reached
- [ ] Password reset flow (Supabase "forgot password" email)
- [ ] Email verification toggle (currently disabled — consider re-enabling for production)
- [ ] Individual users: allow name/email edit in Account Settings

---

## Company Admin (Module 3)

- [x] SQL: Add RLS policy so company admins can view users in their org without infinite recursion
  - Use a `SECURITY DEFINER` function to avoid recursive policy
- [x] Admin panel: assign/edit modules per team member
- [x] Admin panel: deactivate / remove team members
- [x] Candidate invites: auto-suspend account when `sessions_used >= session_limit`
- [x] Candidate invites: "Send Upgrade Email" (invite suspended temp users to create full account)
- [x] Candidate upgrade: pre-fill email on signup page from invite link

---

## Billing & Pricing

- [ ] Define seat/subscription fee structures per plan tier
- [ ] Assign seat limits per plan (currently admin sets manually)
- [ ] Payment integration (Stripe or similar)
- [ ] Billing portal in Account Settings for company admins
- [ ] Usage-based pricing exploration (per session vs flat seat fee)

---

## Personas & Playbooks

- [x] Seed insurance objections into personas: add realistic insurance-related objections (coverage limits, deductible disputes, supplement negotiations, adjuster conflicts) to relevant homeowner and property manager personas so techs can practice handling them
- [x] Plumber BD playbooks: update cold call + discovery with YouTube video content
  - Qualify-first approach, never lead with money, triangulating questions
  - Service vs construction targeting, 4:1 value ratio
- [x] Plumber personas: add construction-heavy (wrong target), shadow plumber (relationship), advertiser persona
- [x] DB seeds: hit `/api/seed` for new discovery personas + playbooks, `/api/seed-gender` for gender updates
- [x] Plumber Leads playbook merge: PATCH seeded ID `a0310662-7a97-49f2-b738-563b54994c83`, DELETE custom `deb506ea-1644-49dd-b85d-38a9da55bc04`
- [x] Playbook UI: edit + delete (company admin only)
- [x] Company admins can request new playbooks from admin panel

---

## Coach Role

> All items below are **in the current build** except where noted.

- [x] New `coach` app_role + `coach_instances` table (invite token, content toggles, auto-approve setting)
- [x] Tim's `/admin` interface: create/deactivate coaches, generate their instance
- [x] Coach dashboard (`/coach`): invite link, client companies panel, users panel, content panel
- [x] Coach onboarding: upload playbooks → Claude API suggests scenario types → seeds personas for coach instance
- [x] Signup flow: `/signup?coach=TOKEN` (company admin invite), `/signup?org=TOKEN` (individual via org), `?coach=TOKEN&type=individual` (standalone individual)
- [x] Company admin team panel: manage invited individuals, view their sessions/scores
- [x] Coach-based assessments: assessment scoped to coach's playbooks first, falls back to global
- [x] Coach instance isolation: content queries filter by `coach_instance_id` + global toggle settings
- [ ] Per-playbook/per-persona content toggle for coaches (more granular than instance-level)
- [ ] Allow coaches to upload PDFs or Document files to base playbooks on. Take them through AI Queries, ask questions about the playbooks they upload to build out playbooks with all the necessary information.

---

## Candidate Invites Feature (Complete)

- [x] Candidate invites: full lifecycle (invite, signup, complete, upgrade)
- [x] Notification bell for company admins (in-app + email on candidate completion)
- [x] Auto-suspend candidates when session limit reached
- [x] Upgrade email flow for suspended candidates
- [x] Pre-fill email from invite token on signup page

---

## Candidate & Certificate Feature (Future)

- [ ] Certificate generation: PDF showing session count, scenario types, avg score
- [ ] Public certificate verification page (for job seekers to share)
- [ ] Job-seeker-facing landing page and positioning
- [ ] Candidate invite: one-time links (as alternative to email+password flow)

--

## Email & Marketing

- [ ] Capture `email_consent` on all signup flows (regular + temp users) ← in progress
- [ ] Post-session performance email (weekly digest for team members)
- [ ] Upgrade funnel: sequence for suspended temp users who opted into marketing
- [ ] Integrate marketing-consent user list into Klaviyo or Resend broadcasts
- [ ] TOS: final legal review (currently placeholder text)
- [ ] Improve welcome email to include "How to use" with screenshots and explanation encourating the user to engage with app.
- [ ] Build out funnel for new users for email
- [ ] Give users an opportunity to share a referral code that gives them a free month or something similar
- [ ] Candidates sent a "join free and get 3 hours of role playing free" after completing assessment.

---

## Mobile App

- [ ] Expo dev build for Vapi integration (requires custom native module)
- [ ] Field recording upload (audio file → transcript → assessment)
- [ ] Mobile session history

---

## Infrastructure & Polish

- [x] Enable RLS on `training_sessions` and `playbooks` tables ← blocked until auth+coach build is complete
- [ ] Implement minute cap per month on users by plan using session-limit-migration.sql
- [x] Switch in call LLM to Groq Llama 3.3 70B with Fallback to Claude Haiku 3
- [ ] Claude sonnet performs post call assessment
- [ ] improve UI of post call analysis, add a scoring system, gamify the call progression
- [ ] Let users share their high score on LinkedIn with a referral link that rewards users for sharing and getting others to sign up
- [x] Error monitoring (Sentry)
- [x] Analytics (session counts, avg score, active users, by-scenario — `/insights` page)
- [x] Loading skeletons on sessions / playbooks pages
- [x] Mobile-responsive admin panel
- [x] Playbook/Persona editor add formatting options for bullets, numbering and AI Prompt to change them
- [x] improve ability for call handler to interrupt-voice chat is finishing and not letting the user interrupt
- [x] When a session loads, display the playbook below it in case user wants a refresh before starting
- [x] Let a user choose easy, medium, hard scenarios to overcome
- [x] Prefer Voice agents with accents you'd hear in America (not British)
- [ ] when user suspends account, give them option to retain their data or delete account completely.
- [ ] build a way for superadmin to send notifications to certain types of users or all users
- [ ] build tutorial videos for new users

## Bugs