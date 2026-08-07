# TechRP — Backlog & TODO

Last updated: 2026-04-14

---

## Auth & Users


---

## Referrals & Billing


---

## Company Admin (Module 3)


---

## Billing & Pricing


---

## Personas & Playbooks


---

## Coach Role


---

## Candidate & Certificate Feature (Future)

- [ ] Certificate generation: PDF showing session count, scenario types, avg score
- [ ] Public certificate verification page (for job seekers to share)
- [ ] Job-seeker-facing landing page and positioning

--

## Email & Marketing

- [ ] Post-session performance email (weekly digest for team members)
- [ ] Upgrade funnel: sequence for suspended temp users who opted into marketing
- [ ] Integrate marketing-consent user list into Klaviyo or Resend broadcasts
- [ ] TOS: final legal review (currently placeholder text)
- [ ] Improve welcome email to include "How to use" with screenshots and explanation encourating the user to engage with app.
- [ ] Build out funnel for new users for email
- [ ] Candidates sent a "join free and get 3 hours of role playing free" after completing assessment.

---

## Mobile App

- [ ] Expo dev build for Vapi integration (requires custom native module)
- [ ] Field recording upload (audio file → transcript → assessment)
- [ ] Mobile session history
- [ ] **Ship TestFlight build for recording playback** — mobile `RecordingPlayer` now posts `sessionId` (not `callId`) and sends a Supabase bearer token, matching the reworked `/api/recording`. Playback stays broken on device until a build ships: `cd mobile && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 fastlane ios beta`.
- [x] **Call recordings moved to own R2 storage** — Vapi retired public recording URLs (Jul 2026) and its pay-as-you-go tier only keeps calls 14 days. Recordings now write to Cloudflare R2 (`techrp`) via Vapi custom storage; `/api/recording` presigns objects with a read-only R2 token, gated on session ownership. Format set to `mp3` via assistantOverrides (5.09 MB/min → 0.49 MB/min, ~10x smaller). 12-month object lifecycle rule applied in Cloudflare. Implemented 2026-08-07.
- [x] **Timestamped recording links in session notes** — Practice Moments now show play buttons that seek the recording to the relevant moment. Implemented 2026-05-26.
- [x] **Gamification Phase A: score reveal + practice streaks** — animated count-up/grade stamp/confetti/haptics on assessment, streak card on Train tab. Spec: `docs/superpowers/specs/2026-07-10-gamification-phase-a-design.md`. Implemented 2026-07-10.
- [x] **Gamification Phase B: scenario mastery medals** — bronze/silver/gold per scenario type, medals on scenario picker rows + mastery summary, unlock/progress lines on assessment reveal. Spec: `docs/superpowers/specs/2026-07-10-gamification-phase-b-mastery-design.md`. Implemented 2026-07-10.
- [x] **Gamification Phase C: XP, levels & rank titles** — 30+score XP per session, ranks Rookie → Rainmaker, rank pill + XP progress bar on profile, +XP/level-up lines on assessment reveal. Spec: `docs/superpowers/specs/2026-07-13-gamification-phase-c-xp-levels-design.md`. Implemented 2026-07-13.

---

## Infrastructure & Polish

- [ ] **Verify atomic minute deduction in production** — `/api/calls/record-usage` now goes through the `record_call_usage` RPC (migration applied 2026-08-07). Run one call and confirm `organizations.minutes_pool` drops and a `minute_transactions` row is written.
- [ ] **Upgrade `@anthropic-ai/sdk` from 0.27.3** — Sept 2024 release, two years behind the `claude-sonnet-5` model it now calls. Predates the `thinking` param (why max_tokens headroom was used instead of disabling thinking) and refusal handling. Needs its own testing pass across the 9 Anthropic call sites.
- [ ] **Decide on Supabase Free tier** — Free pauses projects after ~7 days idle and has no daily backups, with live Stripe billing and 89 users. Pro is $25/mo. Unrelated to storage (recordings live in R2).
- [ ] **Pin `@vapi-ai/web` at 2.6.1** — 2.5.2 caused a `KrispSDK is duplicated` loop that forced a page refresh before every call. Don't downgrade; re-test call start-up before any future bump.
- [ ] build tutorial videos for new users
- [ ] solicit feedback while the session is analyzing-- "WHile we're anazlying, any quick feedback for us?" Send this feedback to me with a link to the recording (get consdent from user to share recording when they send feedback with a checkbox)
- [ ] embed a youtube video in a playbook

## Homepage Launch Assets (`/`)

*Items only you can provide — needed before driving real traffic to `/`.*

- [ ] **Capture 3 product screenshots** for the homepage Platform section: (1) training session in progress — AI persona voice call, (2) session review with transcript + AI score breakdown, (3) manager dashboard showing team performance over time
- [ ] **Record a 90-second walkthrough video** showing a full training session from start to scored result (replaces the `[VIDEO]` placeholder)
- [ ] **Decide on a restoration-specific stat** for the third pain-point card (currently `[STAT]`) — options: % of jobs lost on first call, average close-rate gap between top vs bottom rep, or remove that card entirely
- [ ] **Collect first testimonials/social proof** as soon as you have paying customers — the current homepage claim “Join restoration companies already training smarter with TechRP” is false pre-launch and should be replaced with real quotes
- [ ] **Provide a headshot** for the StoryBrand `/lp2` Guide section (currently a 🎓 emoji placeholder)
- [ ] **Confirm marketing claims** — do you actually have 150+ AI personas seeded in production today, or is that aspirational? Adjust the homepage stats bar accordingly.

---

## Bugs