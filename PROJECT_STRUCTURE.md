# Project Structure Guide

This document provides a detailed overview of the project structure and where to add new features.

## Directory Structure

```
techrp/
├── mobile/                    # React Native/Expo mobile app
│   ├── App.tsx               # Main app entry point
│   ├── app.json              # Expo configuration
│   ├── package.json          # Mobile dependencies
│   ├── tsconfig.json         # TypeScript config
│   ├── babel.config.js       # Babel config
│   ├── env.example           # Environment variables template
│   ├── assets/               # Images, fonts, etc.
│   ├── screens/              # Screen components (to be created)
│   │   ├── LoginScreen.tsx
│   │   ├── TrainingScreen.tsx
│   │   └── SessionsScreen.tsx
│   ├── components/           # Reusable components (to be created)
│   │   ├── Button.tsx
│   │   └── SessionCard.tsx
│   └── lib/                  # Utilities and configs
│       └── supabase.ts       # Supabase client
│
├── web/                      # Next.js web dashboard
│   ├── app/                  # Next.js App Router
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Home page
│   │   ├── globals.css       # Global styles
│   │   ├── login/            # Login page (to be created)
│   │   ├── dashboard/        # Dashboard pages (to be created)
│   │   │   ├── technicians/
│   │   │   ├── sessions/
│   │   │   └── playbooks/
│   │   └── api/              # API routes
│   │       ├── sessions/     # Session endpoints (to be created)
│   │       ├── playbooks/    # Playbook endpoints (to be created)
│   │       └── webhooks/     # Vapi.ai webhooks (to be created)
│   ├── components/           # React components
│   │   ├── Layout.tsx        # Main layout (to be created)
│   │   ├── SessionList.tsx   # Session list (to be created)
│   │   └── PlaybookUpload.tsx # Upload component (to be created)
│   ├── lib/                  # Utilities
│   │   ├── supabase.ts       # Supabase client
│   │   └── vapi.ts           # Vapi.ai helpers (to be created)
│   ├── package.json          # Web dependencies
│   └── next.config.js        # Next.js config
│
└── shared/                   # Shared code
    ├── supabase.ts           # Supabase types and client factory
    └── types.ts              # Shared TypeScript types (to be created)
```

## Where to Add New Features

### Mobile App Features

**Authentication:**
- Create `mobile/screens/LoginScreen.tsx`
- Add auth logic in `mobile/lib/auth.ts`

**Training Sessions:**
- Create `mobile/screens/TrainingScreen.tsx` for the voice call
- Create `mobile/lib/vapi.ts` for Vapi.ai integration
- Create `mobile/screens/SessionsScreen.tsx` for session history
- Create `mobile/screens/SessionDetailScreen.tsx` for viewing a session

**Components:**
- Reusable UI components go in `mobile/components/`
- Navigation components, buttons, cards, etc.

### Web Dashboard Features

**Authentication:**
- Create `web/app/login/page.tsx`
- Add auth middleware in `web/middleware.ts`

**Dashboard Pages:**
- `web/app/dashboard/page.tsx` - Main dashboard
- `web/app/dashboard/technicians/page.tsx` - Technician list
- `web/app/dashboard/sessions/page.tsx` - All sessions
- `web/app/dashboard/sessions/[id]/page.tsx` - Session detail
- `web/app/dashboard/playbooks/page.tsx` - Playbook management

**API Routes:**
- `web/app/api/sessions/route.ts` - Session CRUD
- `web/app/api/playbooks/route.ts` - Playbook upload/management
- `web/app/api/webhooks/vapi/route.ts` - Vapi.ai webhook handler
- `web/app/api/assessments/route.ts` - Generate assessments

**Components:**
- Layout components in `web/components/layout/`
- Feature components in `web/components/`
- Shared UI components (buttons, modals, etc.)

## Database Schema

The database uses three main tables:

1. **technicians** - User accounts for technicians
2. **training_sessions** - Records of training calls
3. **playbooks** - Training scripts uploaded by managers

See the README.md for SQL schema setup.

## Environment Variables

Each app has its own environment variables:
- Mobile: `mobile/.env` (copy from `mobile/env.example`)
- Web: `web/.env.local` (copy from `web/env.example`)

Never commit `.env` files to git!

## Next Development Steps

1. Set up authentication (Supabase Auth)
2. Create database tables in Supabase
3. Build mobile login screen
4. Integrate Vapi.ai for voice calls
5. Build web dashboard layout
6. Add playbook upload functionality
7. Create session recording playback
8. Implement AI assessment generation




