# TechRP - Voice AI Training Platform

## Project Overview
Voice AI roleplay training app for restoration technicians. Techs practice sales conversations with AI homeowner, get AI assessments, and follow playbooks.

## Tech Stack
- **Mobile:** React Native / Expo SDK 52
- **Web:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Voice AI:** Vapi.ai (Assistant ID: a2a54457-a2b0-4046-82b5-c7506ab9a401)
- **LLM:** Claude API (claude-sonnet-4-20250514)

## Project Structure
```
/Users/TinierTim/TBDev/techrp/
├── mobile/          # React Native Expo app
├── web/             # Next.js dashboard
└── shared/          # Shared types
```

## Key Directories
- `web/app/training/` - Voice training interface
- `web/app/sessions/` - Session history & details
- `web/app/playbooks/` - Playbook management
- `web/app/api/` - API routes (assessment, recording, playbook generation)

## Environment Variables
Web needs: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_VAPI_PUBLIC_KEY, VAPI_API_KEY, ANTHROPIC_API_KEY

## Database Schema
- `organizations` - Company/team data
- `users` - Technicians and managers
- `training_sessions` - Completed training calls (transcript, assessment, recording_url)
- `playbooks` - Sales playbooks (RLS currently disabled)

## Current Status (Jan 2026)
### ✅ Working Features
1. Voice training with Vapi (homeowner AI roleplay)
2. Transcript capture and storage
3. AI assessment (Claude API generates score, strengths, improvements)
4. Recording playback (7-day Vapi expiration)
5. Session history dashboard
6. Playbook creation wizard (multi-step form)
7. Playbook generation (Claude API)
8. Playbook viewing (markdown rendered via react-markdown)

### 🔴 Known Issues
- RLS disabled on `playbooks` and `training_sessions` tables (temporary until auth built)
- No authentication system yet (using placeholder user IDs)

### ⚪ Not Yet Built
- Authentication (login for techs/managers)
- Mobile app Vapi integration (needs Expo dev build)
- Field recording upload
- Playbook integration with assessments
- UI polish

## Important Notes
- Use `npm install --legacy-peer-deps` for mobile app (React Native dependency conflicts)
- Expo SDK 52 (not 54) due to dependency issues
- Vapi recordings expire after 7 days
- Transcript filtering: `transcriptType === 'final'` (avoid partial transcripts)

## Test Data
- Organization ID: `00000000-0000-0000-0000-000000000001`
- User ID: `00000000-0000-0000-0000-000000000001`

## Development Commands
```bash
# Web
cd /Users/TinierTim/TBDev/techrp/web && npm run dev

# Mobile
cd /Users/TinierTim/TBDev/techrp/mobile && npx expo start --clear
```

## Next Priorities
1. Add authentication system
2. Connect playbooks to assessments
3. Polish playbook UI (edit/delete)
4. Field recording upload
5. Mobile dev build for Vapi