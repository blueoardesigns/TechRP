# Authenticated Pages Redesign

**Date:** 2026-04-20
**Status:** Approved — ready for implementation

## Overview

Redesign all 25 authenticated pages to be visually consistent with the new landing/signup design system. Introduce a sidebar shell, improve usability on the three highest-priority session pages first, then extend the system to remaining pages.

---

## Section 1 — Design System & Shell

### Tokens (carry over from landing/signup)
| Token | Value |
|---|---|
| Font | Plus Jakarta Sans (Google Fonts) |
| Background | `slate-950` (#020617) |
| Surface | `slate-900` (#0f172a) |
| Card | `slate-800` / `#1e293b` |
| Border | `white/8` (rgba 255,255,255,0.08) |
| CTA | `sky-600` (#0284c7), hover `sky-500` |
| Text primary | `white` |
| Text secondary | `slate-400` (#94a3b8) |
| Text muted | `slate-500` / `slate-600` |
| Success | `emerald-400` (#34d399) |
| Warning | `amber-400` (#f59e0b) |
| Danger | `red-400` (#f87171) |
| Focus ring | `sky-500` |

### AppShell Component (`web/components/app-shell.tsx`)

Replaces `AppNav` as the authenticated layout wrapper. Fixed left sidebar (130px wide) + scrollable `main` content area. Sidebar never collapses.

**Sidebar structure:**
```
[Logo + TechRP wordmark]
─────────────────────
TRAINING
  • Train
  • Sessions
  • Recordings
─────────────────────
CONTENT
  • Playbooks
  • Personas
─────────────────────
MANAGE            (company_admin, coach, superuser only)
  • Insights
  • Team
  • Billing
─────────────────────
ADMIN             (superuser only)
  • Users
  • Coaches
  • Subscriptions
  • Notifications
─────────────────────
[Avatar] Name
[Sign out]
```

Section labels are `text-[10px] font-semibold text-slate-600 uppercase tracking-widest` dividers. Active item: `bg-sky-500/10 text-sky-400`. Inactive: `text-slate-500 hover:text-white`.

### Shared Page Components
These are built once and reused across all pages:

- **`PageHeader`** — `{title, subtitle?, action?}` — consistent h1 + optional CTA button
- **`StatCard`** — `{label, value, trend?, color?}` — compact metric tile
- **`StatStrip`** — row of 2–4 `StatCard`s, used at the top of list pages
- **`DataTable`** — `{columns, rows, onRowClick?, emptyState?}` — dense table with hover states and score badges
- **`ScoreBadge`** — color-coded score pill: green ≥80, amber 60–79, red <60
- **`EmptyState`** — `{icon, title, description, action?}` — consistent zero-state UI
- **`SectionCard`** — `{title, children}` — slate-900 card wrapper used in detail views

---

## Section 2 — Training Page (`/training`)

### State 1: Setup (within AppShell)

**Layout:** Centered content card, max-width 480px.

**Scenario selector:**
- Heading: "Start a training call"
- Subtitle: "Choose your scenario and we'll assign a matching persona"
- **Scenario type grid** — cards for each `ScenarioType` the user has access to (Homeowner, Property Manager, Insurance, Plumber BD). Selected card gets `border-sky-500/40 bg-sky-500/10`.
- **Difficulty strip** (shown after scenario type selected) — segmented control: Easy / Medium / Hard. Default: Medium.
- **Payment type strip** — segmented control: Insurance / Self Pay / Random. Default: Random.
- Assigned persona preview: once all selections made, a small card appears showing the randomly assigned persona name + a "Randomize" icon button to re-roll.
- **"Start Call" CTA** — sky-600, full width, disabled until scenario selected.

### State 2: Active Call (full-screen, AppShell hidden)

**Top bar** (44px, `bg-slate-950`, border-bottom):
- Left: TechRP logo mark + wordmark
- Center: Live badge (green pulse dot + "Live · MM:SS" timer)
- Right: "← Back to dashboard" text link (aborts call with confirmation)

**Body** (flex row, fills remaining height):

**Left panel** (42% width, `bg-slate-950`, right border):
- Centered vertically: persona avatar circle (gradient border, initials), persona name + scenario type label below
- Animated waveform bars (sky-500, varying heights, opacity-pulsed)
- Speaking indicator pill: "Sarah is speaking…" or "Your turn…"
- **End Call button** — full width, `bg-red-500/10 border-red-500/25 text-red-400`, bottom of panel

**Right panel** (58% width, `bg-slate-950/50`):
- Header: "Live Transcript" label (uppercase, muted) + "Auto-scrolling" indicator
- Scrollable bubble feed:
  - AI bubbles: left-aligned, `bg-slate-800`, `rounded-tl-none`, speaker name in `sky-400`
  - User bubbles: right-aligned, `bg-sky-500/15 border-sky-500/20`, `rounded-br-none`, "You" label in `emerald-400`
  - Typing indicator (three dots) while Vapi is processing

### State 3: Post-Call (AppShell returns)

Transitions back to AppShell after call ends + assessment loads. Shows an assessment result card:
- Score ring (SVG, sky→emerald gradient)
- Overall score headline + summary paragraph
- Strengths list (emerald dots) + Improvements list (amber dots)
- Two CTAs: "View full session →" (primary) + "Start another" (ghost)

---

## Section 3 — Sessions List (`/sessions`)

Within AppShell.

**Layout (top to bottom):**

1. **PageHeader** — "Sessions" + "Start Training" sky-600 button
2. **StatStrip** — 3 stat cards: Total Sessions | Avg Score (color-coded) | This Month
3. **Filter strip** — period selector: 7d / 30d / 90d / All time (pill toggles, sky active state)
4. **DataTable** columns:
   - Scenario (badge with scenario color)
   - Persona name
   - Date (relative: "2 hours ago", "Yesterday")
   - Duration (MM:SS)
   - Score (ScoreBadge)
   - Chevron arrow (navigates to detail)
5. **EmptyState** when no sessions — icon, "No sessions yet", "Start your first training call" CTA

Row hover: `bg-slate-800/50`, `cursor-pointer`. Clicking anywhere on row navigates to `/sessions/[id]`.

---

## Section 4 — Session Detail (`/sessions/[id]`)

Within AppShell. Server component (existing).

**Layout:** Two columns on desktop (≥1024px), single column on mobile.

**Left column (flex-[3]):**

1. **Assessment card** (`SectionCard`):
   - Score ring (56px SVG) + "Score: 84/100" headline side by side
   - Summary paragraph (`text-slate-400`)
   - Strengths section: emerald dot list
   - Improvements section: amber dot list

2. **Transcript card** (`SectionCard`, title "Transcript"):
   - Same bubble style as the live call view (static, not streaming)
   - AI bubbles left, user bubbles right
   - Scrollable, max-height 480px

**Right column (flex-[1.5]):**

1. **Session metadata card**:
   - Persona name + scenario type badge
   - Date + duration
   - Share button (toggle public link)

2. **Playbook card** (if active playbook found):
   - Playbook name + scenario type
   - Link: "View playbook →"

3. **Coach notes card** (if applicable):
   - Editable textarea for coach to add notes
   - Save button

**Back navigation:** "← Sessions" link in PageHeader subtitle position.

---

## Section 5 — Remaining 22 Pages

All remaining authenticated pages get `AppShell` applied and design tokens updated. No new layout patterns are introduced — every page maps to one of:

| Pattern | Pages |
|---|---|
| Stats strip + table | Insights, Admin Users, Admin Coaches, Team, Coach Dashboard, Recordings |
| Form card | Account, Billing, Add Hours, Playbook Editor, Admin Notifications |
| Wizard / multi-step | Playbook Create (existing 6-step wizard restyled) |
| Card grid | Personas, Admin Hub, Playbooks list |
| Status / callback | Pending, Upgrade, Coach Connect Callback |

Admin pages and coach pages follow the same shell and token system — no special admin theme.

---

## Implementation Order

**Phase 1 — Foundation (prerequisite for everything)**
1. Build `AppShell` + sidebar component (replaces `AppNav`)
2. Build shared components: `PageHeader`, `StatCard`, `StatStrip`, `DataTable`, `ScoreBadge`, `EmptyState`, `SectionCard`

**Phase 2 — Session pages (highest priority)**
3. `/training` — all three states (setup, active call, post-call)
4. `/sessions` — list with stats strip + table
5. `/sessions/[id]` — two-column detail view

**Phase 3 — Extend to remaining pages**
6. Apply `AppShell` + tokens to all other authenticated pages using the pattern map above
7. Update `middleware.ts` public routes if needed (no changes expected)

---

## Out of Scope

- `/share/session/[token]` — public page, intentionally no sidebar
- `/admin/login` — standalone gate page, no shell
- Mobile (React Native) app — separate project
- Any new features beyond visual/UX improvements
