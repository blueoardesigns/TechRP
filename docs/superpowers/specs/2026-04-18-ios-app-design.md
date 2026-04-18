# iOS App Design — TechRP Mobile

**Date:** 2026-04-18
**Status:** Approved

## Overview

Build out the existing `mobile/` Expo app (SDK 52, expo-router v4) into a full iOS training app for field technicians. Users sign up on the website only; the app handles login, training sessions via Vapi, session review, and playbook reference.

**Visual style:** Dark & Bold — dark navy (`#1a1a2e`) background, `#0f3460` card surfaces, `#e94560` accent, white body text.

## Tech Stack

- **Framework:** Expo SDK 52, React Native 0.76, expo-router v4
- **Auth:** Supabase email/password (`@supabase/supabase-js` already in `mobile/lib/supabase.ts`)
- **Voice:** `@vapi-ai/react-native` — requires Expo Dev Build (not Expo Go)
- **Assessment:** Calls existing `POST /api/assess` web endpoint after call ends
- **Navigation:** expo-router file-based routing with bottom tab layout

## File Structure

```
mobile/
  app/
    _layout.tsx                  # Root layout — auth gate
    (auth)/
      login.tsx
      forgot-password.tsx
    (tabs)/
      _layout.tsx                # Bottom tab navigator
      train/
        index.tsx                # Scenario picker
        pre-call.tsx             # Persona preview + Start Call
        call.tsx                 # Active call + live transcript
        assessment.tsx           # Post-call score + feedback
      sessions/
        index.tsx                # Sessions list
        [id].tsx                 # Session detail
      playbooks/
        index.tsx                # Playbooks list
        [id].tsx                 # Playbook detail
  lib/
    supabase.ts                  # (existing) Supabase client
    vapi.ts                      # Vapi client singleton
  components/
    TranscriptMessage.tsx        # Single transcript line
    ScoreBadge.tsx               # Colored score pill
    PersonaCard.tsx              # Persona preview card
```

## Auth Flow

**Login screen** (`/login`):
- Email + password fields
- "Sign In" button — calls `supabase.auth.signInWithPassword()`
- "Forgot password?" link → `/forgot-password`
- "Don't have an account? Sign up at techrp.com" link → opens web URL in browser via `Linking.openURL()`
- On success: redirects to `/(tabs)/train`

**Forgot Password screen** (`/forgot-password`):
- Email field
- Calls `supabase.auth.resetPasswordForEmail()`
- Shows confirmation message: "Check your email for a reset link"

**Auth gate** (root `_layout.tsx`):
- Listens to `supabase.auth.onAuthStateChange()`
- Redirects unauthenticated users to `/login`
- Redirects authenticated users away from `/login`

## Navigation

Bottom tab bar with three tabs:

| Tab | Icon | Route |
|-----|------|-------|
| Train | 🎙️ | `/(tabs)/train` |
| Sessions | 📋 | `/(tabs)/sessions` |
| Playbooks | 📖 | `/(tabs)/playbooks` |

Tab bar styled dark: `#0f3460` background, `#e94560` active tint, `#555` inactive tint.

## Train Tab

### Scenario Picker (`train/index.tsx`)
- Grouped `SectionList`: **Technician** and **BizDev** sections
- Each row shows scenario icon, label, and description from `mobile/lib/scenarios.ts` (a copy of the `SCENARIOS` array from `web/lib/personas.ts` — static config, no DB query needed)
- Tap → queries Supabase `personas` table for all personas matching `scenario_type`, picks one at random → navigates to `pre-call` with `scenarioType` + `personaId` params

### Pre-Call Preview (`train/pre-call.tsx`)
- Receives `scenarioType` + `personaId` via route params
- Shows persona `name`, `personalityType`, `briefDescription`
- "Start Call" button — initializes Vapi and navigates to `call`

### Active Call (`train/call.tsx`)
- Initializes `@vapi-ai/react-native` with `assistantId` + `assistantOverrides` (persona's `system_prompt`, `first_message`, voice config)
- Live transcript: `FlatList` that auto-scrolls to bottom on new messages, filtered to `transcriptType === 'final'` only
- Each message shows speaker label + text
- Speaking indicator (animated pulse) when Vapi reports assistant is speaking
- "End Call" button (red) → calls `vapi.stop()` → navigates to `assessment`
- On `call-end` event: (1) POST transcript + persona context to `/api/assess` → receive assessment JSON, (2) save row to Supabase `training_sessions` with transcript + assessment, (3) navigate to `assessment` screen with the new `sessionId`

### Assessment (`train/assessment.tsx`)
- Receives `sessionId` via route params
- Displays: score (1–10), strengths list, improvements list, summary paragraph
- "Done" button → back to scenario picker

## Sessions Tab

### Sessions List (`sessions/index.tsx`)
- Queries `training_sessions` for current user, ordered by `created_at` desc
- Each row: persona name, scenario label, score badge, date
- `ScoreBadge` colors: green ≥ 8, yellow 5–7, red ≤ 4

### Session Detail (`sessions/[id].tsx`)
- Full assessment display (score, strengths, improvements, summary)
- Transcript replay — same `TranscriptMessage` component, not live
- **"Train on Same Scenario" button** (accent red, bottom of screen) → queries Supabase for a fresh random persona matching the session's `scenario_type`, then navigates to `/(tabs)/train/pre-call` with both `scenarioType` + new `personaId`

## Playbooks Tab

### Playbooks List (`playbooks/index.tsx`)
- Queries Supabase `playbooks` table for active playbooks
- Grouped by `scenario_type`
- Each row shows scenario label + icon

### Playbook Detail (`playbooks/[id].tsx`)
- Renders playbook `content` field
- Read-only reference view

## Vapi Integration

`lib/vapi.ts` exports a singleton Vapi instance initialized with `EXPO_PUBLIC_VAPI_API_KEY`.

Call setup uses `assistantOverrides`:
```ts
vapi.start(VAPI_ASSISTANT_ID, {
  assistantOverrides: {
    model: { provider: 'groq', model: 'llama3-8b-8192' },
    firstMessage: persona.first_message,
    instructions: persona.system_prompt,
    voice: { /* gender-based voice config */ },
  }
})
```

Transcript events: listen to `vapi.on('message', ...)` and filter for `message.type === 'transcript' && message.transcriptType === 'final'`.

Call end: listen to `vapi.on('call-end', ...)` to trigger assessment and save.

## Data

All data fetched from Supabase using the existing anon client in `mobile/lib/supabase.ts`. No new endpoints needed except the existing `POST /api/assess` (web) called with the base URL from env.

New env var needed: `EXPO_PUBLIC_API_BASE_URL` pointing to the web app (e.g., `https://techrp.com` or `http://localhost:3000` for dev) so the mobile app can POST to `/api/assess`.

## Out of Scope

- Manager/admin features (web only)
- Push notifications
- Offline mode
- Android-specific testing (iOS focus for now)
