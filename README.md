# TechRP - Voice AI Roleplay Training App

A voice AI training application for field technicians selling drying equipment drop-off services to homeowners. The app consists of a mobile app for technicians and a web dashboard for managers.

## Project Structure

```
techrp/
├── mobile/              # React Native/Expo app for technicians
│   ├── App.tsx         # Main app entry point
│   ├── app.json        # Expo configuration
│   ├── package.json    # Mobile app dependencies
│   └── env.example     # Environment variables template
│
├── web/                # Next.js dashboard for managers
│   ├── app/            # Next.js app directory
│   │   ├── layout.tsx  # Root layout
│   │   ├── page.tsx    # Home page
│   │   └── globals.css # Global styles
│   ├── api/            # API routes (to be implemented)
│   ├── components/     # React components (to be implemented)
│   ├── lib/            # Utility functions (to be implemented)
│   ├── package.json    # Web app dependencies
│   └── env.example     # Environment variables template
│
└── shared/             # Shared configuration and types
    ├── supabase.ts     # Supabase client setup and types
    └── package.json    # Shared dependencies
```

## Tech Stack

- **Mobile App**: React Native with Expo (TypeScript)
- **Web Dashboard**: Next.js 14 with App Router (TypeScript)
- **Database & Auth**: Supabase
- **Voice AI**: Vapi.ai
- **LLM**: Claude (Anthropic) via Vapi.ai
- **Storage**: Supabase Storage

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- A Supabase account and project
- A Vapi.ai account
- An Anthropic API key

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Install mobile app dependencies
cd mobile
npm install

# Install web app dependencies
cd ../web
npm install

# Install shared dependencies
cd ../shared
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Create the following tables in your Supabase SQL editor:

```sql
-- Technicians table
CREATE TABLE technicians (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Training sessions table
CREATE TABLE training_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  technician_id UUID REFERENCES technicians(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  recording_url TEXT,
  transcript TEXT,
  assessment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Playbooks table
CREATE TABLE playbooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  file_url TEXT,
  uploaded_by UUID REFERENCES technicians(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (you'll configure policies later)
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
```

4. Set up Supabase Storage buckets:
   - Create a bucket named `recordings` for training session recordings
   - Create a bucket named `playbooks` for uploaded playbook files

### 3. Configure Environment Variables

#### Mobile App (`mobile/.env`)

Copy `mobile/env.example` to `mobile/.env` and fill in your values:

```bash
cd mobile
cp env.example .env
```

Required variables:
- `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon/public key
- `EXPO_PUBLIC_VAPI_API_KEY`: Your Vapi.ai API key

#### Web Dashboard (`web/.env.local`)

Copy `web/env.example` to `web/.env.local` and fill in your values:

```bash
cd web
cp env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (keep secret!)
- `VAPI_API_KEY`: Your Vapi.ai API key
- `ANTHROPIC_API_KEY`: Your Anthropic API key (for assessments)
- `NEXTAUTH_URL`: Your app URL (e.g., `http://localhost:3000`)
- `NEXTAUTH_SECRET`: A random secret string for NextAuth

### 4. Set Up Vapi.ai

1. Create an account at [vapi.ai](https://vapi.ai)
2. Get your API key from the dashboard
3. Configure a voice assistant that:
   - Uses Claude (Anthropic) as the LLM
   - Roleplays as a skeptical homeowner
   - Handles common objections (cost, need to think, other quotes, etc.)
   - Records conversations for later review

### 5. Run the Applications

#### Mobile App (Development)

```bash
cd mobile
npm start
```

This will start the Expo development server. You can:
- Press `i` to open in iOS simulator
- Press `a` to open in Android emulator
- Scan the QR code with Expo Go app on your phone

#### Web Dashboard (Development)

```bash
cd web
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Next Steps

Now that the project is scaffolded, you can start building:

1. **Mobile App Features:**
   - Authentication screen
   - Training session start/stop
   - Vapi.ai voice call integration
   - Session history list
   - Session detail view

2. **Web Dashboard Features:**
   - Manager authentication
   - Playbook upload (PDF/text)
   - Technician list
   - Training session list
   - Session detail with recording, transcript, and assessment

3. **Backend/API:**
   - API routes for starting/ending sessions
   - Webhook handlers for Vapi.ai callbacks
   - Assessment generation using Anthropic API
   - File upload handling for playbooks

4. **Database:**
   - Set up Row Level Security policies
   - Create indexes for performance
   - Add any additional tables as needed

## Development Tips

- Use TypeScript strictly - it will help catch errors early
- The `shared/` folder contains types and utilities that both apps can use
- Test the mobile app on a real device for best voice call experience
- Use Supabase's real-time features for live updates in the dashboard
- Consider using Expo's development builds for testing native features

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Vapi.ai Documentation](https://docs.vapi.ai/)
- [Anthropic API Documentation](https://docs.anthropic.com/)

## License

Private project - All rights reserved




