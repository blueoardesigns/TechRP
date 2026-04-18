# CLAUDE.md

## What This Project Is

TechRP is a voice AI roleplay training platform for field technicians selling drying/restoration services. Technicians practice sales calls against AI personas; managers review scores and create playbooks.

- **`web/`** — Next.js 14 dashboard (managers view sessions, create playbooks, manage personas)
- **`mobile/`** — React Native/Expo SDK 52 app (technicians conduct training calls via Vapi.ai)
- **`shared/`** — TypeScript types and Supabase configuration shared across apps

## Tech Stack
- **Voice AI:** Vapi.ai (Assistant ID: `a2a54457-a2b0-4046-82b5-c7506ab9a401`) using Groq 8b in call
- **LLM:** Claude API (`claude-sonnet-4-20250514`)
- **Database:** Supabase (PostgreSQL, multi-tenant)

Do not make any changes until you have 95% confidence in what you need to build. Ask me follow up questions until you reach that confidence.

## Commands
```bash
# Web
cd web && npm run dev        # localhost:3000
cd web && npm run build
cd web && npm run lint

# Mobile
cd mobile && npx expo start --clear
cd mobile && npx expo start --ios
cd mobile && npx expo start --android
```

## Environment Variables

**`web/.env.local`:**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only
NEXT_PUBLIC_VAPI_PUBLIC_KEY=
VAPI_API_KEY=                     # server-only
ANTHROPIC_API_KEY=                # server-only
```

**`mobile/.env`:**
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_VAPI_API_KEY=
```

## Architecture

### Data Flow
1. Technician starts call in mobile → Vapi.ai handles voice using persona's `system_prompt` and `first_message`
2. On call end, transcript sent to `/api/assess` → Claude grades against active playbook for that scenario type
3. Session (transcript + assessment) saved to Supabase `training_sessions`
4. Manager reviews scores in web dashboard at `/sessions`

### Database (Supabase)
Multi-tenant: `organizations` → `users`, `playbooks`, `personas`, `training_sessions`. RLS enabled on most tables (see Known Issues).

Key relationships:
- `training_sessions` links to `persona_id`, stores `transcript`, `assessment` (JSON), `vapi_call_id`
- `personas` drive Vapi via `system_prompt`, `first_message`, `speaker_label`, `scenario_type`
- `playbooks` serve as scoring rubrics; `/api/assess` fetches active playbook by `scenario_type`
- `training_sessions.share_token` (nullable) enables a public read-only share page at `/share/session/[token]`
- `users.referral_code` (unique) powers `/signup?ref=CODE` referral tracking; `users.referral_credits_minutes` holds earned bonus minutes

### Supabase Client Pattern
```ts
import { createClient, createServiceRoleClient } from '@/lib/supabase'
// createClient()            → anon key, browser or public routes
// createServiceRoleClient() → service role key, admin operations only
```

### Persona & Playbook System
- `web/lib/all-personas.ts` — 150+ persona seeds. Seeded via `POST /api/seed`
- `web/lib/default-playbooks.ts` — Default playbook content per scenario type, also seeded via `POST /api/seed`
- `ScenarioType` enum in `web/lib/personas.ts` defines all valid scenario categories
- Personas passed to Vapi as `assistantOverrides` so each call uses the selected persona's voice config

### AI Assessment (`/api/assess`)
Uses `@anthropic-ai/sdk`. Receives transcript (`messages[]`) and `PersonaContext`, fetches matching playbook, returns: `score` (1–10), `strengths[]`, `improvements[]`, `summary`.

### Web API Routes
| Route | Purpose |
|---|---|
| `POST /api/assess` | Grade a transcript with Claude |
| `GET /api/playbook?scenario_type=` | Fetch active playbook |
| `GET/POST /api/personas` | List or create personas |
| `DELETE /api/personas/[id]` | Remove a persona |
| `POST /api/seed` | Seed default playbooks and personas (idempotent) |
| `POST /api/recordings/upload` | Upload field recordings |
| `GET /api/insights` | Analytics/insights |
| `PATCH /api/account` | Update individual user's name/email |
| `POST /api/auth/signup` | Signup (supports `?coach=TOKEN`, `?org=TOKEN`) |
| `POST /api/sessions/[id]/share` | Toggle public share link for a session (owner-only) |
| `POST /api/admin/notifications/broadcast` | Superuser: send a notification to all approved users |
| `GET /api/admin/notifications/broadcast` | Superuser: list broadcast history |

### Notes
- Transcript filtering: use `transcriptType === 'final'` to avoid partials
- Vapi recordings expire after 7 days
- `@/*` maps to `web/` root in path aliases

## Auth System
Role-based auth is live. Roles: `individual`, `company_admin`, `coach`, `superuser`. Status flow: `pending` → `approved` | `rejected` | `suspended`. Auth context in `web/components/auth-provider.tsx` exposes `user`, `refreshUser`. Pending SQL migration required to enable session limit enforcement: run `web/supabase/session-limit-migration.sql` in Supabase SQL Editor.

Password reset uses Supabase native email flow (`/forgot-password` → `/reset-password`). Email verification skipped by default; set `SKIP_EMAIL_CONFIRM=false` in production to require it.

## Known Issues
- RLS disabled on `playbooks` and `training_sessions` (pending — blocked on auth, which is now complete)
- Mobile Vapi integration not yet working (needs Expo dev build)
- Field recording upload not yet built

## Codebase Index
Pre-built index files are in `.ai-codex/`. Read these FIRST before exploring the codebase:
- `.ai-codex/routes.md` -- all API routes
- `.ai-codex/pages.md` -- page tree
- `.ai-codex/lib.md` -- library exports
- `.ai-codex/schema.md` -- database schema
- `.ai-codex/components.md` -- component tree

## Future Revisions
Future Revisions/Plans are found and should be stored when suggested by me in TODO.md
Please mark items in TODO.md as complete when finished

<!-- headroom:learn:start -->
## Headroom Learned Patterns
*Auto-generated by `headroom learn` on 2026-04-18 — do not edit manually*

### Large Files
*~15,000 tokens/session saved*
- `docs/superpowers/plans/2026-04-16-pricing-stripe.md` exceeds 25,000 tokens — always use `offset`/`limit` parameters when reading it, never read the whole file at once
- `web/app/playbooks/create/page.tsx` is very large (~33,000 tokens) — read with offset/limit or use Grep to find specific sections before editing

### API Routes — Common Errors
*~5,000 tokens/session saved*
- Several API route files (~100–200 lines) hit the Read tool's runtime_error threshold; always use `offset`/`limit` to read them in chunks rather than retrying the whole file
- The subagent type string `'code-reviewer'` is invalid — use `'superpowers:code-reviewer'` instead

### Git / Worktrees
*~4,000 tokens/session saved*
- Worktrees are stored under `.worktrees/` (user-managed) and `.claude/worktrees/` (Claude-managed); both are gitignored
- When merging a worktree branch from INSIDE the worktree, `git checkout master` fails because `master` is locked by the parent; run `cd /Users/TinierTim/TBDev/techrp && git merge <branch>` from the parent repo instead
- Deleting a worktree branch with `-d` fails if not yet pushed to remote; use `-D` and remove the worktree first with `git worktree remove`

### File Paths
*~3,000 tokens/session saved*
- `.ai-codex/schema.md` does NOT exist — do not attempt to read it
- SQL migrations live in `web/supabase/*.sql` (not a `migrations/` folder)
- Supabase client files: `web/lib/supabase.ts` (client) and `web/lib/supabase-server.ts` (server); use `createServiceRoleClient` from supabase.ts and `createServerSupabase`/`createServiceSupabase` from supabase-server.ts

### Shell / Commands
*~3,000 tokens/session saved*
- Never pass glob patterns with `[brackets]` (e.g., `[orgId]`, `[id]`) directly in shell arguments — zsh expands them and returns `no matches found`; always quote them or use `git add "web/app/api/..."` with double quotes
- `npm run lint` inside a worktree may fail with `sh: next: command not found` — run `npx next lint` or run from a directory where `node_modules/.bin` is on PATH

### Preview Server
*~2,000 tokens/session saved*
- The Next.js dev server runs on port 3000; if port 3000 is in use, find and kill the process (`lsof -i :3000`, then `kill <PID>`) before starting a new preview server — the preview MCP will not start on an alternative port
- The app requires OAuth-compatible port 3000 specifically; do not attempt to change the port in `.claude/launch.json`

### Git — Tracked Files
*~1,500 tokens/session saved*
- `TODO.md` is listed in `.gitignore`; use `git add -f TODO.md` to force-add it when needed
- The `web/lib/all-personas.ts` and `web/lib/default-playbooks.ts` files are large data files that should be checked out with `--theirs` during merge conflicts to avoid losing content

<!-- headroom:learn:end -->
