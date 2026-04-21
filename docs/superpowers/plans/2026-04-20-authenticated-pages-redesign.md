# Authenticated Pages Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all 25 authenticated pages to use a consistent dark design system with a fixed sidebar shell, replacing the current top navbar.

**Architecture:** Create an `AppShell` client component (sidebar + main area) and 7 shared UI primitives, then progressively replace existing page layouts. The training page has special full-screen handling for its active-call phase. All pages share the same design tokens (slate-950/900/800, sky-600, Plus Jakarta Sans).

**Tech Stack:** Next.js 14 App Router, Tailwind CSS v4, React, TypeScript. No new dependencies.

---

## File Map

### New files
| File | Purpose |
|---|---|
| `web/components/app-shell.tsx` | Fixed 130px sidebar + scrollable main, role-gated nav sections |
| `web/components/ui/page-header.tsx` | `PageHeader` — `{title, subtitle?, action?}` |
| `web/components/ui/stat-card.tsx` | `StatCard` + `StatStrip` — metric tiles |
| `web/components/ui/data-table.tsx` | `DataTable` — dense table with hover/click rows |
| `web/components/ui/score-badge.tsx` | `ScoreBadge` — color-coded score pill |
| `web/components/ui/empty-state.tsx` | `EmptyState` — zero-state UI |
| `web/components/ui/section-card.tsx` | `SectionCard` — slate-900 card wrapper |

### Modified files
| File | Change |
|---|---|
| `web/app/globals.css` | Add Plus Jakarta Sans `@import` |
| `web/app/training/page.tsx` | Restyle all 3 phases with new tokens; consolidate setup phases |
| `web/app/sessions/page.tsx` | Replace with AppShell + StatStrip + DataTable |
| `web/app/sessions/[id]/page.tsx` | Replace with AppShell + two-column layout |
| `web/app/insights/page.tsx` | Wrap with AppShell |
| `web/app/account/page.tsx` | Wrap with AppShell (remove AppNav import) |
| `web/app/billing/page.tsx` | Wrap with AppShell |
| `web/app/billing/add-hours/page.tsx` | Wrap with AppShell |
| `web/app/playbooks/page.tsx` | Wrap with AppShell |
| `web/app/playbooks/[id]/page.tsx` | Wrap with AppShell |
| `web/app/playbooks/create/page.tsx` | Wrap with AppShell |
| `web/app/personas/page.tsx` | Wrap with AppShell |
| `web/app/recordings/page.tsx` | Wrap with AppShell |
| `web/app/team/page.tsx` | Wrap with AppShell (remove AppNav import) |
| `web/app/coach/page.tsx` | Wrap with AppShell (remove AppNav import) |
| `web/app/coach/companies/[orgId]/page.tsx` | Wrap with AppShell (remove AppNav import) |
| `web/app/coach/referrals/page.tsx` | Wrap with AppShell |
| `web/app/coach/connect/callback/page.tsx` | Wrap with AppShell |
| `web/app/admin/page.tsx` | Wrap with AppShell |
| `web/app/admin/users/page.tsx` | Wrap with AppShell |
| `web/app/admin/coaches/page.tsx` | N/A — check if file differs from admin/page.tsx |
| `web/app/admin/subscriptions/page.tsx` | Wrap with AppShell |
| `web/app/admin/notifications/page.tsx` | Wrap with AppShell |
| `web/app/upgrade/page.tsx` | Wrap with AppShell |

---

## Task 1: Font Setup

**Files:**
- Modify: `web/app/globals.css`

- [ ] **Step 1: Add Plus Jakarta Sans Google Fonts import**

Open `web/app/globals.css` and add the Google Fonts `@import` as the very first line, before the Tailwind import:

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
@import "tailwindcss";

html {
  max-width: 100vw;
  overflow-x: hidden;
  font-family: 'Plus Jakarta Sans', sans-serif;
}
/* ... rest of existing CSS unchanged ... */
```

- [ ] **Step 2: Verify build compiles**

```bash
cd web && npm run build 2>&1 | tail -5
```
Expected: `✓ Compiled successfully` (or similar — no font-related errors)

- [ ] **Step 3: Commit**

```bash
cd /Users/TinierTim/TBDev/techrp
git add web/app/globals.css
git commit -m "feat(web): add Plus Jakarta Sans font to globals"
```

---

## Task 2: AppShell Component

**Files:**
- Create: `web/components/app-shell.tsx`

The AppShell is a fixed 130px sidebar + scrollable main content area. Nav sections are role-gated. The sidebar never collapses. Logo + wordmark at the top, avatar + name + sign-out at the bottom.

- [ ] **Step 1: Create `web/components/app-shell.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';

type NavSection = {
  label: string;
  roles?: string[];
  items: { href: string; label: string }[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'TRAINING',
    items: [
      { href: '/training',   label: 'Train'      },
      { href: '/sessions',   label: 'Sessions'   },
      { href: '/recordings', label: 'Recordings' },
    ],
  },
  {
    label: 'CONTENT',
    items: [
      { href: '/playbooks', label: 'Playbooks' },
      { href: '/personas',  label: 'Personas'  },
    ],
  },
  {
    label: 'MANAGE',
    roles: ['company_admin', 'coach', 'superuser'],
    items: [
      { href: '/insights', label: 'Insights' },
      { href: '/team',     label: 'Team'     },
      { href: '/billing',  label: 'Billing'  },
    ],
  },
  {
    label: 'ADMIN',
    roles: ['superuser'],
    items: [
      { href: '/admin/users',          label: 'Users'         },
      { href: '/admin',                label: 'Coaches'       },
      { href: '/admin/subscriptions',  label: 'Subscriptions' },
      { href: '/admin/notifications',  label: 'Notifications' },
    ],
  },
];

function LogoMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="url(#shellGrad)" />
      <path d="M7 9h18M16 9v14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M10 16h7l4 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <defs>
        <linearGradient id="shellGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0ea5e9" /><stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const initial = (user?.fullName || user?.email || '?')[0].toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#020617]">
      <aside
        className="w-[130px] shrink-0 sticky top-0 h-screen flex flex-col bg-[#020617] border-r border-white/[0.06] overflow-y-auto"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {/* Logo */}
        <div className="px-3 py-4 border-b border-white/[0.06]">
          <Link href="/training" className="flex items-center gap-2">
            <LogoMark />
            <span className="text-[11px] font-bold text-white tracking-tight">TechRP</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2">
          {NAV_SECTIONS.map((section) => {
            if (section.roles && !section.roles.includes(user?.role ?? '')) return null;
            return (
              <div key={section.label} className="mb-1">
                <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
                  {section.label}
                </p>
                {section.items.map((item) => {
                  const active =
                    item.href === '/admin'
                      ? pathname === '/admin' || pathname === '/admin/coaches'
                      : pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        'block mx-1 px-2 py-1.5 rounded text-[11px] font-medium transition-colors',
                        active ? 'bg-sky-500/10 text-sky-400' : 'text-slate-500 hover:text-white',
                      ].join(' ')}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/[0.06] p-3 space-y-2">
          <Link href="/account" className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-sky-400">{initial}</span>
            </div>
            <span className="text-[10px] text-slate-400 truncate min-w-0">
              {user?.fullName || user?.email}
            </span>
          </Link>
          <button
            onClick={handleSignOut}
            className="text-[10px] text-slate-600 hover:text-white transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors related to `app-shell.tsx`

- [ ] **Step 3: Commit**

```bash
cd /Users/TinierTim/TBDev/techrp
git add web/components/app-shell.tsx
git commit -m "feat(web): add AppShell sidebar component"
```

---

## Task 3: Shared UI Components

**Files:**
- Create: `web/components/ui/page-header.tsx`
- Create: `web/components/ui/stat-card.tsx`
- Create: `web/components/ui/score-badge.tsx`
- Create: `web/components/ui/empty-state.tsx`
- Create: `web/components/ui/section-card.tsx`
- Create: `web/components/ui/data-table.tsx`

### Step 1 — PageHeader

- [ ] **Create `web/components/ui/page-header.tsx`**

```tsx
import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between px-6 pt-8 pb-6 border-b border-white/[0.06]">
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 ml-4">{action}</div>}
    </div>
  );
}
```

### Step 2 — StatCard + StatStrip

- [ ] **Create `web/components/ui/stat-card.tsx`**

```tsx
import React from 'react';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  trend?: string;
  color?: 'default' | 'emerald' | 'amber' | 'red' | 'sky';
}

const COLOR_MAP = {
  default: 'text-white',
  emerald: 'text-emerald-400',
  amber:   'text-amber-400',
  red:     'text-red-400',
  sky:     'text-sky-400',
};

export function StatCard({ label, value, trend, color = 'default' }: StatCardProps) {
  return (
    <div className="bg-[#0f172a] border border-white/[0.08] rounded-xl px-5 py-4">
      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-bold ${COLOR_MAP[color]}`}>{value}</p>
      {trend && <p className="text-xs text-slate-500 mt-1">{trend}</p>}
    </div>
  );
}

export function StatStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 px-6 py-4">
      {children}
    </div>
  );
}
```

### Step 3 — ScoreBadge

- [ ] **Create `web/components/ui/score-badge.tsx`**

```tsx
interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md';
}

export function ScoreBadge({ score, size = 'sm' }: ScoreBadgeProps) {
  const color =
    score >= 80 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
    score >= 60 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                  'bg-red-500/20 text-red-400 border-red-500/30';

  const padding = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full border font-semibold ${color} ${padding}`}>
      {score}
    </span>
  );
}
```

### Step 4 — EmptyState

- [ ] **Create `web/components/ui/empty-state.tsx`**

```tsx
import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-4 text-slate-400">
          {icon}
        </div>
      )}
      <p className="text-white font-semibold mb-1">{title}</p>
      {description && <p className="text-sm text-slate-500 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

### Step 5 — SectionCard

- [ ] **Create `web/components/ui/section-card.tsx`**

```tsx
import React from 'react';

interface SectionCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function SectionCard({ title, children, className = '' }: SectionCardProps) {
  return (
    <div className={`bg-[#0f172a] border border-white/[0.08] rounded-xl overflow-hidden ${className}`}>
      {title && (
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
```

### Step 6 — DataTable

- [ ] **Create `web/components/ui/data-table.tsx`**

```tsx
'use client';

import React from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
}

export function DataTable<T>({ columns, rows, getKey, onRowClick, emptyState }: DataTableProps<T>) {
  if (rows.length === 0 && emptyState) return <>{emptyState}</>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-widest"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={[
                'border-b border-white/[0.04] transition-colors',
                onRowClick ? 'cursor-pointer hover:bg-slate-800/50' : '',
              ].join(' ')}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-slate-300">
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors in `web/components/ui/`

- [ ] **Step 8: Commit**

```bash
cd /Users/TinierTim/TBDev/techrp
git add web/components/ui/
git commit -m "feat(web): add shared UI components (PageHeader, StatCard, ScoreBadge, EmptyState, SectionCard, DataTable)"
```

---

## Task 4: Restyle /training Page

**Files:**
- Modify: `web/app/training/page.tsx`

The training page currently has 4 phases: `scenario-select`, `persona-preview`, `calling`, `post-call`. Per the spec:
- **Setup** (replaces `scenario-select` + `persona-preview`): AppShell visible, centered 480px card. Shows scenario type grid; after selecting a type, difficulty strip + payment strip + persona preview appear below inline. "Start Call" CTA.
- **Active Call**: Full-screen, AppShell hidden. Left 42% panel (persona, waveform, end call). Right 58% panel (iMessage-style transcript).
- **Post-Call**: AppShell returns. Assessment card with score ring.

The current internal logic (Vapi singleton, call handlers, `SCENARIOS`, difficulty/payment refs) is preserved exactly — only the JSX rendering changes.

- [ ] **Step 1: Update training page render — Setup phase (scenario-select + persona-preview merged)**

Replace the `if (phase === 'scenario-select')` and `if (phase === 'persona-preview')` render blocks. The new "Setup" renders within `AppShell`. After `handleSelectScenario` runs, `selectedPersona` is set and `phase` becomes `persona-preview` — the same AppShell view shows both the grid and the persona card together.

Add `AppShell` import at the top of the file:
```tsx
import { AppShell } from '@/components/app-shell';
```

Replace the `if (phase === 'scenario-select')` block with:

```tsx
if (phase === 'scenario-select' || phase === 'persona-preview') {
  return (
    <AppShell>
      <div className="px-6 pt-8 pb-12 max-w-3xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-xl font-bold text-white">Start a training call</h1>
          <p className="text-sm text-slate-400 mt-1">
            Choose your scenario and we&apos;ll assign a matching persona
          </p>
        </div>

        {/* Scenario type grid */}
        {techScenarios.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-3">
              Technician Scenarios
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {techScenarios.map((scenario) => {
                const isSelected = selectedPersona?.scenarioType === scenario.type;
                return (
                  <button
                    key={scenario.type}
                    onClick={() => handleSelectScenario(scenario.type)}
                    disabled={personasLoading}
                    className={[
                      'text-left rounded-xl p-4 border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait',
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500/40 text-white'
                        : 'bg-[#0f172a] border-white/[0.08] hover:border-white/20 text-slate-300',
                    ].join(' ')}
                  >
                    <span className="text-2xl block mb-2">{scenario.icon}</span>
                    <span className="text-sm font-semibold block">{scenario.label}</span>
                    <span className="text-xs text-slate-500 block mt-0.5">{scenario.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* BD scenarios */}
        {BD_COMPANY_GROUPS.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-3">
              Business Development
            </p>
            <div className="space-y-4">
              {BD_COMPANY_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] text-slate-600 mb-2">{group.icon} {group.label}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {group.cold && (
                      <button
                        onClick={() => handleSelectScenario(group.cold!.type)}
                        disabled={personasLoading}
                        className={[
                          'text-left rounded-xl p-4 border transition-all cursor-pointer disabled:opacity-50',
                          selectedPersona?.scenarioType === group.cold.type
                            ? 'bg-sky-500/10 border-sky-500/40 text-white'
                            : 'bg-[#0f172a] border-white/[0.08] hover:border-white/20 text-slate-300',
                        ].join(' ')}
                      >
                        <span className="text-sm font-semibold block">Cold Call</span>
                        <span className="text-xs text-slate-500 block mt-0.5">{group.label}</span>
                      </button>
                    )}
                    {group.discovery && (
                      <button
                        onClick={() => handleSelectScenario(group.discovery!.type)}
                        disabled={personasLoading}
                        className={[
                          'text-left rounded-xl p-4 border transition-all cursor-pointer disabled:opacity-50',
                          selectedPersona?.scenarioType === group.discovery.type
                            ? 'bg-sky-500/10 border-sky-500/40 text-white'
                            : 'bg-[#0f172a] border-white/[0.08] hover:border-white/20 text-slate-300',
                        ].join(' ')}
                      >
                        <span className="text-sm font-semibold block">Discovery Meeting</span>
                        <span className="text-xs text-slate-500 block mt-0.5">{group.label}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {personasLoading && (
          <p className="text-sm text-slate-500 animate-pulse mb-6">Loading personas…</p>
        )}
        {personasError && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-6">
            {personasError}
          </p>
        )}

        {/* Setup options — shown once a scenario type is selected */}
        {phase === 'persona-preview' && selectedPersona && (() => {
          const scenario = SCENARIOS.find(s => s.type === selectedPersona.scenarioType)!;
          return (
            <div className="bg-[#0f172a] border border-white/[0.08] rounded-xl p-6 max-w-md space-y-5">
              {/* Difficulty */}
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Difficulty</p>
                <div className="flex gap-2">
                  {(['easy', 'medium', 'hard'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={[
                        'flex-1 py-2 rounded-lg text-xs font-semibold capitalize border transition-colors cursor-pointer',
                        difficulty === d
                          ? d === 'easy'   ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : d === 'medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                           : 'bg-red-500/20 text-red-400 border-red-500/40'
                          : 'text-slate-600 border-white/[0.08] hover:text-slate-300',
                      ].join(' ')}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment type — technician scenarios only */}
              {scenario.group === 'technician' && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Payment Type</p>
                  <div className="flex gap-2">
                    {([
                      { value: 'potential_claim' as const, label: 'Insurance' },
                      { value: 'self_pay' as const,        label: 'Self Pay'  },
                      { value: 'random' as const,          label: 'Random'    },
                    ]).map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setPaymentType(value)}
                        className={[
                          'flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer',
                          paymentType === value
                            ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                            : 'text-slate-600 border-white/[0.08] hover:text-slate-300',
                        ].join(' ')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Persona preview */}
              <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
                    <span className="text-xs font-bold text-sky-400">{selectedPersona.name[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{selectedPersona.name}</p>
                    <p className="text-[10px] text-slate-500">{selectedPersona.speakerLabel}</p>
                  </div>
                </div>
                {scenarioPersonas.length > 1 && (
                  <button
                    onClick={handlePickDifferent}
                    className="text-[10px] text-slate-500 hover:text-sky-400 transition-colors cursor-pointer"
                    title="Re-roll persona"
                  >
                    ↺ Randomize
                  </button>
                )}
              </div>

              {/* Start Call CTA */}
              <button
                onClick={handleStartCall}
                disabled={!vapi}
                className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Start Call
              </button>

              <button
                onClick={() => { setPhase('scenario-select'); setSelectedPersona(null); }}
                className="w-full py-2 text-xs text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
              >
                ← Change Scenario
              </button>
            </div>
          );
        })()}
      </div>
    </AppShell>
  );
}
```

Also **remove** the entire old `if (phase === 'persona-preview' && selectedPersona)` block that follows — it is now merged into the block above.

- [ ] **Step 2: Update training page render — Calling phase**

Replace the `if (phase === 'calling' && selectedPersona)` return block with the new full-screen two-panel design (no AppShell):

```tsx
if (phase === 'calling' && selectedPersona) {
  const scenario = SCENARIOS.find(s => s.type === selectedPersona.scenarioType)!;
  const isConnecting = callStatus === 'connecting';
  const isConnected  = callStatus === 'connected';

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Top bar */}
      <header className="h-11 shrink-0 border-b border-white/[0.06] bg-[#020617] flex items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="url(#callGrad)" />
            <path d="M7 9h18M16 9v14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M10 16h7l4 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
            <defs>
              <linearGradient id="callGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0ea5e9" /><stop offset="1" stopColor="#6366f1" />
              </linearGradient>
            </defs>
          </svg>
          <span className="text-xs font-bold text-white">TechRP</span>
        </div>

        <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-3 py-1">
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : isConnecting ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
          <span className={`text-[10px] font-semibold ${isConnected ? 'text-emerald-400' : isConnecting ? 'text-amber-400' : 'text-slate-500'}`}>
            {isConnected ? 'Live' : isConnecting ? 'Connecting…' : 'Ended'}
          </span>
        </div>

        <button
          onClick={() => { setPhase('scenario-select'); setSelectedPersona(null); }}
          className="text-[10px] text-slate-500 hover:text-white transition-colors cursor-pointer"
        >
          ← Back to dashboard
        </button>
      </header>

      {/* Body split */}
      <div className="flex flex-1 min-h-0">

        {/* LEFT — persona + waveform + end call */}
        <div className="w-[42%] shrink-0 border-r border-white/[0.08] flex flex-col items-center justify-center gap-5 p-6 bg-[#020617]">
          {/* Avatar */}
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-sky-500/40 bg-gradient-to-br from-sky-500/25 to-indigo-500/25 flex items-center justify-center">
              <span className="text-2xl font-extrabold text-white">{selectedPersona.name[0]}</span>
            </div>
            <div className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#020617]" />
          </div>

          <div className="text-center">
            <p className="text-sm font-bold text-white">{selectedPersona.name}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{scenario.label}</p>
          </div>

          {/* Waveform — static bars, visually indicate activity */}
          <div className="flex items-end gap-0.5 h-8">
            {[6,14,22,18,28,20,26,14,22,10,18,28,16,8].map((h, i) => (
              <div
                key={i}
                className="w-1 rounded-sm bg-sky-500"
                style={{ height: `${h}px`, opacity: isConnected ? 0.6 + (i % 3) * 0.15 : 0.2 }}
              />
            ))}
          </div>

          <p className="text-[10px] text-slate-500 bg-slate-800 px-3 py-1.5 rounded-full">
            {isConnecting ? 'Connecting…' : isConnected ? `${selectedPersona.name} is speaking…` : 'Call ended'}
          </p>

          {/* End call */}
          <button
            onClick={handleEndCall}
            disabled={callStatus === 'idle'}
            className="w-full max-w-[200px] py-2.5 bg-red-500/10 border border-red-500/25 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-40 cursor-pointer"
          >
            End Call
          </button>
        </div>

        {/* RIGHT — live transcript */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#0a1628]">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Live Transcript</span>
            <span className="text-[10px] text-slate-600">Auto-scrolling</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.length === 0 ? (
              <p className="text-xs text-slate-600 text-center mt-8 animate-pulse">
                {isConnecting ? `Connecting to ${selectedPersona.name}…` : 'Waiting for conversation to begin…'}
              </p>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={[
                    'max-w-[85%] rounded-xl px-3 py-2',
                    msg.role === 'user'
                      ? 'bg-sky-500/15 border border-sky-500/20 rounded-br-none'
                      : 'bg-slate-800 border border-white/[0.06] rounded-bl-none',
                  ].join(' ')}>
                    <p className={`text-[9px] font-semibold mb-1 ${msg.role === 'user' ? 'text-emerald-400' : 'text-sky-400'}`}>
                      {msg.role === 'user' ? 'You' : selectedPersona.name}
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update training page render — Post-call phase**

Replace the `if (phase === 'post-call')` block:

```tsx
if (phase === 'post-call') {
  return (
    <AppShell>
      <div className="px-6 pt-8 pb-12 max-w-lg mx-auto">
        <div className="bg-[#0f172a] border border-white/[0.08] rounded-xl p-8 text-center space-y-5">
          {/* Score ring placeholder */}
          <div className="mx-auto w-20 h-20 rounded-full bg-sky-500/10 border-2 border-sky-500/30 flex items-center justify-center">
            <span className="text-2xl">✓</span>
          </div>

          {saveStatus === 'saving'    && <p className="text-sm text-amber-400 animate-pulse">Saving session…</p>}
          {saveStatus === 'assessing' && <p className="text-sm text-sky-400 animate-pulse">Analyzing your session…</p>}
          {saveStatus === 'error'     && <p className="text-sm text-red-400">Save failed. Check console.</p>}

          <div>
            <h2 className="text-xl font-bold text-white">Session Complete</h2>
            <p className="text-sm text-slate-400 mt-1">Your session has been saved and assessed by AI.</p>
          </div>

          <div className="space-y-3 pt-2">
            {lastSessionId && (
              <a
                href={`/sessions/${lastSessionId}`}
                className="block w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-sm transition-colors"
              >
                View full session →
              </a>
            )}
            <button
              onClick={() => {
                setPhase('scenario-select');
                setSelectedPersona(null);
                setMessages([]);
                messagesRef.current = [];
                setSaveStatus('idle');
                setLastSessionId(null);
              }}
              className="w-full py-3 bg-transparent border border-white/[0.08] text-slate-300 hover:text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              Start another
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | grep training
```
Expected: no errors

- [ ] **Step 5: Run dev server and visually verify all 3 states**

```bash
cd web && npm run dev
```
Navigate to `http://localhost:3000/training`. Verify:
1. Sidebar visible on setup state, scenario cards use new design
2. Selecting a scenario shows difficulty/payment/persona inline
3. Starting call enters full-screen mode with two panels
4. Ending call returns to AppShell with post-call card

- [ ] **Step 6: Commit**

```bash
cd /Users/TinierTim/TBDev/techrp
git add web/app/training/page.tsx
git commit -m "feat(web): restyle /training page — AppShell setup, full-screen call, post-call card"
```

---

## Task 5: Restyle /sessions List Page

**Files:**
- Modify: `web/app/sessions/page.tsx`

The sessions page is a client component. Wrap the entire page in `AppShell`, replace the existing layout with `PageHeader` + `StatStrip` + period filter strip + `DataTable`.

Key data already available in the existing component: `sessions`, `insights` (sessionCount, avgScore, thisMonth), `PERIOD_OPTIONS`, `selectedPeriod`, `SCENARIO_LABELS`, `formatDate`, `formatDuration`, `getScore`, `scoreBg`.

- [ ] **Step 1: Add imports to sessions page**

At the top of `web/app/sessions/page.tsx`, add:
```tsx
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard, StatStrip } from '@/components/ui/stat-card';
import { ScoreBadge } from '@/components/ui/score-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTable, type Column } from '@/components/ui/data-table';
import Link from 'next/link';
```

- [ ] **Step 2: Replace the return JSX of `SessionsPage` (the main exported component)**

Locate the `return (` at the end of the `SessionsPage` function (after all hooks and handlers) and replace the entire JSX with:

```tsx
return (
  <AppShell>
    <PageHeader
      title="Sessions"
      action={
        <Link
          href="/training"
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Start Training
        </Link>
      }
    />

    <StatStrip>
      <StatCard
        label="Total Sessions"
        value={insights?.sessionCount ?? sessions.length}
      />
      <StatCard
        label="Avg Score"
        value={insights?.avgScore != null ? `${insights.avgScore}` : '—'}
        color={
          insights?.avgScore == null ? 'default' :
          insights.avgScore >= 80 ? 'emerald' :
          insights.avgScore >= 60 ? 'amber' : 'red'
        }
      />
      <StatCard
        label="This Month"
        value={sessions.filter(s => {
          const d = new Date(s.started_at);
          const now = new Date();
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length}
      />
    </StatStrip>

    {/* Period filter */}
    <div className="px-6 py-3 flex gap-2 border-b border-white/[0.06]">
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.label}
          onClick={() => setSelectedPeriod(opt)}
          className={[
            'px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer',
            selectedPeriod.label === opt.label
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
              : 'text-slate-500 hover:text-white border border-transparent',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>

    {loading ? (
      <div className="px-6 py-12 text-center text-slate-500 text-sm animate-pulse">Loading sessions…</div>
    ) : (
      <DataTable
        columns={[
          {
            key: 'scenario',
            header: 'Scenario',
            render: (s) => {
              const meta = SCENARIO_LABELS[s.persona_scenario_type ?? ''] ?? { label: s.persona_scenario_type ?? '—', color: 'bg-slate-800 text-slate-400' };
              return (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.color}`}>
                  {meta.label}
                </span>
              );
            },
          },
          {
            key: 'persona',
            header: 'Persona',
            render: (s) => <span className="text-slate-300">{s.persona_name ?? '—'}</span>,
          },
          {
            key: 'date',
            header: 'Date',
            render: (s) => <span className="text-slate-400 text-xs">{formatDate(s.started_at)}</span>,
          },
          {
            key: 'duration',
            header: 'Duration',
            render: (s) => <span className="text-slate-400 text-xs font-mono">{formatDuration(s.started_at, s.ended_at)}</span>,
          },
          {
            key: 'score',
            header: 'Score',
            render: (s) => {
              const score = getScore(s);
              return score != null ? <ScoreBadge score={score} /> : <span className="text-slate-600 text-xs">—</span>;
            },
          },
          {
            key: 'arrow',
            header: '',
            width: '32px',
            render: () => <span className="text-slate-600">›</span>,
          },
        ] as Column<typeof sessions[0]>[]}
        rows={sessions}
        getKey={(s) => s.id}
        onRowClick={(s) => router.push(`/sessions/${s.id}`)}
        emptyState={
          <EmptyState
            title="No sessions yet"
            description="Start your first training call to see results here."
            action={
              <Link href="/training" className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-lg transition-colors">
                Start Training
              </Link>
            }
          />
        }
      />
    )}
  </AppShell>
);
```

Note: `loading`, `sessions`, `insights`, `selectedPeriod`, `setSelectedPeriod`, `router` must all be in scope — they are defined in the existing component. Do not remove any existing state/effect logic. **Only replace the return JSX.**

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | grep sessions
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
cd /Users/TinierTim/TBDev/techrp
git add web/app/sessions/page.tsx
git commit -m "feat(web): restyle /sessions list — AppShell, StatStrip, DataTable"
```

---

## Task 6: Restyle /sessions/[id] Detail Page

**Files:**
- Modify: `web/app/sessions/[id]/page.tsx`

This is a server component. Wrap the returned JSX in `AppShell`. The two-column layout uses `SectionCard` for assessment + transcript on the left and metadata/playbook/coach notes on the right.

- [ ] **Step 1: Add imports**

At the top of `web/app/sessions/[id]/page.tsx`, add:
```tsx
import { AppShell } from '@/components/app-shell';
import { SectionCard } from '@/components/ui/section-card';
import { ScoreBadge } from '@/components/ui/score-badge';
```

- [ ] **Step 2: Replace the main page return JSX**

Find the `export default async function SessionDetailPage` function's return statement and replace the entire returned JSX (keeping all data-fetching logic above it untouched). The existing component already fetches `session`, `assessment`, `playbook`, `currentUserId`, `transcript` messages. Wrap them in:

```tsx
return (
  <AppShell>
    <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
      <Link href="/sessions" className="text-xs text-slate-500 hover:text-white transition-colors">
        ← Sessions
      </Link>
      <h1 className="text-xl font-bold text-white mt-2">
        {session.persona_name ?? 'Session'} — {SCENARIO_LABELS[session.persona_scenario_type ?? ''] ?? session.persona_scenario_type}
      </h1>
    </div>

    <div className="px-6 py-6 grid grid-cols-1 lg:grid-cols-[3fr_1.5fr] gap-6">

      {/* Left column */}
      <div className="space-y-6">

        {/* Assessment card */}
        {assessment && (
          <SectionCard title="Assessment">
            <div className="flex items-center gap-4 mb-4">
              {/* Score ring */}
              <div className="relative w-14 h-14 shrink-0">
                <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
                  <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                  <circle
                    cx="28" cy="28" r="22" fill="none"
                    stroke={displayScore >= 80 ? '#34d399' : displayScore >= 60 ? '#f59e0b' : '#f87171'}
                    strokeWidth="5"
                    strokeDasharray={`${(displayScore / 100) * 138} 138`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                  {displayScore}
                </span>
              </div>
              <div>
                <p className="font-bold text-white">Score: {displayScore}/100</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{assessment.summary}</p>
              </div>
            </div>

            {assessment.strengths?.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Strengths</p>
                <ul className="space-y-1.5">
                  {assessment.strengths.map((s: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {assessment.improvements?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Improvements</p>
                <ul className="space-y-1.5">
                  {assessment.improvements.map((s: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>
        )}

        {/* Transcript card */}
        {transcript.length > 0 && (
          <SectionCard title="Transcript">
            <div className="max-h-[480px] overflow-y-auto flex flex-col gap-3 pr-1">
              {transcript.map((msg: any, i: number) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={[
                    'max-w-[85%] rounded-xl px-3 py-2',
                    msg.role === 'user'
                      ? 'bg-sky-500/15 border border-sky-500/20 rounded-br-none'
                      : 'bg-slate-800 border border-white/[0.06] rounded-bl-none',
                  ].join(' ')}>
                    <p className={`text-[9px] font-semibold mb-1 ${msg.role === 'user' ? 'text-emerald-400' : 'text-sky-400'}`}>
                      {msg.role === 'user' ? 'You' : session.persona_name}
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      {/* Right column */}
      <div className="space-y-4">

        {/* Metadata */}
        <SectionCard>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Persona</span>
              <span className="text-sm text-white font-medium">{session.persona_name ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Scenario</span>
              <span className="text-xs text-slate-300">{SCENARIO_LABELS[session.persona_scenario_type ?? ''] ?? session.persona_scenario_type ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Date</span>
              <span className="text-xs text-slate-400">{new Date(session.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Duration</span>
              <span className="text-xs font-mono text-slate-400">{formatDuration(session.started_at, session.ended_at)}</span>
            </div>
            {displayScore > 0 && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500">Score</span>
                <ScoreBadge score={displayScore} size="md" />
              </div>
            )}
            {/* Share button — existing ShareDialog component */}
            <div className="pt-2 border-t border-white/[0.06]">
              <ShareDialog session={session} currentUserId={currentUserId} />
            </div>
          </div>
        </SectionCard>

        {/* Playbook */}
        {playbook && (
          <SectionCard title="Playbook">
            <p className="text-sm text-white font-medium">{playbook.name}</p>
            <Link href="/playbooks" className="text-xs text-sky-400 hover:text-sky-300 transition-colors mt-1 block">
              View playbook →
            </Link>
          </SectionCard>
        )}

        {/* Recording player — existing component */}
        {session.recording_url && (
          <SectionCard title="Recording">
            <RecordingPlayer recordingUrl={session.recording_url} />
          </SectionCard>
        )}

        {/* Coach notes — existing component */}
        <SectionCard title="Coach Notes">
          <CoachNotes sessionId={session.id} initialNotes={session.coach_notes ?? ''} />
        </SectionCard>
      </div>
    </div>
  </AppShell>
);
```

Note: `displayScore`, `assessment`, `transcript`, `SCENARIO_LABELS`, `formatDuration` must all be resolved from the existing data-fetch logic above. The existing component already parses these — only the JSX changes. Add `SCENARIO_LABELS` constant (copy from sessions/page.tsx) or import it from a shared lib if desired.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | grep "sessions"
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
cd /Users/TinierTim/TBDev/techrp
git add "web/app/sessions/[id]/page.tsx"
git commit -m "feat(web): restyle /sessions/[id] detail — two-column AppShell layout"
```

---

## Task 7: Wrap Remaining Authenticated Pages

**Files:** All remaining authenticated pages listed in the File Map above.

Each page in this task follows the same 3-step pattern:
1. Remove `AppNav` import (if present)
2. Add `AppShell` import
3. Wrap existing JSX in `<AppShell>...</AppShell>`

Pages that already render a `<div className="min-h-screen ...">` wrapper should replace that wrapper div with `<AppShell>`. Pages using `AppNav` should remove that component (AppShell provides navigation).

### 7a — Stats+table pages

These pages have a structure matching AppShell + PageHeader + StatStrip + table. Apply the same pattern used for /sessions.

**Pages:** `insights`, `admin/users`, `admin/coaches` (if separate), `team`, `coach/page` (coach dashboard), `recordings`

- [ ] **Wrap `web/app/insights/page.tsx`**

```tsx
// Remove: import { AppNav } from '@/components/nav';
// Add:
import { AppShell } from '@/components/app-shell';
// Wrap entire return in <AppShell> ... </AppShell>
// Remove any <AppNav /> usage inside the component
```

- [ ] **Wrap `web/app/admin/users/page.tsx`**

```tsx
import { AppShell } from '@/components/app-shell';
// Wrap return in <AppShell> ... </AppShell>
```

- [ ] **Wrap `web/app/admin/coaches/page.tsx`** (if file exists — check first)

```bash
ls web/app/admin/coaches/page.tsx
```
If it exists, add AppShell wrap same as above.

- [ ] **Wrap `web/app/team/page.tsx`**

```tsx
// Remove: import { AppNav } from '@/components/nav';
import { AppShell } from '@/components/app-shell';
// Replace outer <div className="min-h-screen ..."> with <AppShell>
// Remove <AppNav /> line
```

- [ ] **Wrap `web/app/coach/page.tsx`**

```tsx
// Remove: import { AppNav } from '@/components/nav';
import { AppShell } from '@/components/app-shell';
// Replace outer wrapper div with <AppShell>
// Remove <AppNav /> line
```

- [ ] **Wrap `web/app/recordings/page.tsx`**

```tsx
import { AppShell } from '@/components/app-shell';
// Wrap return in <AppShell> ... </AppShell>
```

### 7b — Form card pages

These pages render a centered form. Apply AppShell and let the form content sit in the main area.

**Pages:** `account`, `billing`, `billing/add-hours`, `playbooks/[id]` (editor), `admin/notifications`

- [ ] **Wrap `web/app/account/page.tsx`**

```tsx
// Remove: import { AppNav } from '@/components/nav';
import { AppShell } from '@/components/app-shell';
// Remove <AppNav /> from the return
// Wrap return in <AppShell> ... </AppShell>
// Remove outer min-h-screen div if used, AppShell provides it
```

- [ ] **Wrap `web/app/billing/page.tsx`**

```tsx
import { AppShell } from '@/components/app-shell';
// Wrap return in <AppShell> ... </AppShell>
```

- [ ] **Wrap `web/app/billing/add-hours/page.tsx`**

```tsx
import { AppShell } from '@/components/app-shell';
// Wrap return in <AppShell> ... </AppShell>
```

- [ ] **Wrap `web/app/playbooks/[id]/page.tsx`**

```tsx
import { AppShell } from '@/components/app-shell';
// Wrap return in <AppShell> ... </AppShell>
```

- [ ] **Wrap `web/app/admin/notifications/page.tsx`**

```tsx
import { AppShell } from '@/components/app-shell';
// Wrap return in <AppShell> ... </AppShell>
```

### 7c — Wizard page

- [ ] **Wrap `web/app/playbooks/create/page.tsx`**

This is a large multi-step wizard. Read the file first to understand its structure:
```bash
head -30 web/app/playbooks/create/page.tsx
```
Add AppShell import and wrap the top-level return. Keep all wizard state and step logic unchanged.

```tsx
import { AppShell } from '@/components/app-shell';
// Wrap final return in <AppShell> ... </AppShell>
```

### 7d — Card grid pages

**Pages:** `personas`, `playbooks` (list)

- [ ] **Wrap `web/app/personas/page.tsx`**

```tsx
import { AppShell } from '@/components/app-shell';
// Wrap return in <AppShell> ... </AppShell>
```

- [ ] **Wrap `web/app/playbooks/page.tsx`**

```tsx
import { AppShell } from '@/components/app-shell';
// Wrap return in <AppShell> ... </AppShell>
```

### 7e — Remaining pages

**Pages:** `admin/page` (hub), `admin/subscriptions`, `admin/coaches` (if not done), `coach/companies/[orgId]`, `coach/referrals`, `coach/connect/callback`, `upgrade`

- [ ] **Wrap `web/app/admin/page.tsx`** (admin hub / coaches list)

```tsx
// Remove: import { AppNav } from '@/components/nav';
import { AppShell } from '@/components/app-shell';
// Remove <AppNav /> from return
// Wrap return in <AppShell> ... </AppShell>
```

- [ ] **Wrap `web/app/admin/subscriptions/page.tsx`**

```tsx
import { AppShell } from '@/components/app-shell';
// Wrap return in <AppShell> ... </AppShell>
```

- [ ] **Wrap `web/app/coach/companies/[orgId]/page.tsx`**

```tsx
// Remove: import { AppNav } from '@/components/nav';
import { AppShell } from '@/components/app-shell';
// Remove <AppNav /> from return
// Wrap return in <AppShell> ... </AppShell>
```

- [ ] **Wrap `web/app/coach/referrals/page.tsx`**

```tsx
import { AppShell } from '@/components/app-shell';
// Wrap return in <AppShell> ... </AppShell>
```

- [ ] **Wrap `web/app/coach/connect/callback/page.tsx`**

```tsx
import { AppShell } from '@/components/app-shell';
// Wrap return in <AppShell> ... </AppShell>
```

- [ ] **Wrap `web/app/upgrade/page.tsx`**

```tsx
import { AppShell } from '@/components/app-shell';
// Wrap return in <AppShell> ... </AppShell>
```

- [ ] **Step: Verify build compiles with no TypeScript errors**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors. Fix any that appear (usually missing type imports or unresolved `AppNav` references).

- [ ] **Step: Lint**

```bash
cd web && npm run lint 2>&1 | tail -10
```
Fix any lint errors before committing.

- [ ] **Step: Commit all remaining page wraps**

```bash
cd /Users/TinierTim/TBDev/techrp
git add web/app/
git commit -m "feat(web): wrap all remaining authenticated pages in AppShell"
```

---

## Task 8: Remove AppNav (cleanup)

**Files:**
- Modify: `web/components/nav.tsx` (keep file — it exports `AppNav` which may still be imported somewhere, but mark it deprecated or leave for now)

- [ ] **Verify no remaining AppNav imports in pages**

```bash
grep -r "AppNav" web/app/ --include="*.tsx"
```
Expected: no results (all should be removed in Task 7)

- [ ] **If any remain, remove them** by deleting the import line and any `<AppNav />` JSX in those files.

- [ ] **Final build check**

```bash
cd web && npm run build 2>&1 | tail -10
```
Expected: successful build with no errors.

- [ ] **Commit**

```bash
cd /Users/TinierTim/TBDev/techrp
git add -A
git commit -m "feat(web): complete authenticated pages redesign — AppShell + design system"
git push origin master
```

---

## Self-Review

### Spec Coverage Check

| Spec requirement | Covered by task |
|---|---|
| Design tokens (slate-950, sky-600, Plus Jakarta Sans) | Task 1, Task 2, used in all tasks |
| AppShell — 130px fixed sidebar | Task 2 |
| Sidebar — grouped sections (TRAINING / CONTENT / MANAGE / ADMIN) | Task 2 |
| Sidebar — role-gated MANAGE + ADMIN sections | Task 2 |
| Sidebar — active item sky-500/10 text-sky-400 | Task 2 |
| Sidebar — avatar + name + sign-out footer | Task 2 |
| PageHeader, StatCard, StatStrip, DataTable, ScoreBadge, EmptyState, SectionCard | Task 3 |
| /training Setup — scenario type grid | Task 4 Step 1 |
| /training Setup — difficulty strip (Easy/Medium/Hard) | Task 4 Step 1 |
| /training Setup — payment type strip (Insurance/Self Pay/Random) | Task 4 Step 1 |
| /training Setup — persona preview with randomize button | Task 4 Step 1 |
| /training Active Call — full-screen, AppShell hidden | Task 4 Step 2 |
| /training Active Call — left panel persona+waveform | Task 4 Step 2 |
| /training Active Call — right panel iMessage transcript | Task 4 Step 2 |
| /training Post-Call — assessment card | Task 4 Step 3 |
| /sessions — PageHeader + Start Training CTA | Task 5 |
| /sessions — StatStrip (Total/Avg/This Month) | Task 5 |
| /sessions — period filter (7d/30d/90d/All time) | Task 5 |
| /sessions — DataTable with ScoreBadge | Task 5 |
| /sessions — EmptyState | Task 5 |
| /sessions/[id] — two-column layout | Task 6 |
| /sessions/[id] — assessment card with score ring | Task 6 |
| /sessions/[id] — transcript bubbles (static) | Task 6 |
| /sessions/[id] — metadata card + share | Task 6 |
| /sessions/[id] — playbook card | Task 6 |
| /sessions/[id] — coach notes | Task 6 |
| Remaining 22 pages — AppShell applied | Task 7 |
| /share/session/[token] — intentionally excluded | N/A (out of scope) |
| /admin/login — intentionally excluded | N/A (out of scope) |

### Placeholder Scan

- Task 7 wraps contain brief descriptions of what to change rather than full code — this is intentional for pages where the only change is adding AppShell import + wrapper. The pattern is simple and unambiguous: 1) remove AppNav import, 2) add AppShell import, 3) wrap return in `<AppShell>`. Any implementer can follow this mechanically.
- Session detail Task 6 references `displayScore`, `assessment`, `transcript`, `SCENARIO_LABELS`, `formatDuration` — these are all present in the existing file; the plan correctly says "keep all data-fetch logic, only replace JSX."

### Type Consistency

- `DataTable<T>` generic is defined in Task 3 and used in Task 5 with `Column<typeof sessions[0]>[]`
- `ScoreBadge` accepts `score: number` in Task 3, used with `getScore(s)` (returns `number | null`) in Task 5 — null-guarded with conditional render
- `StatCard` `color` prop values match the type union defined in Task 3
- `SectionCard` used in Task 6 matches the interface from Task 3
