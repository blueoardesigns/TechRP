# Environment Variables Setup Guide

This guide will help you configure your environment variables for both the mobile and web apps.

## Quick Setup

1. **Mobile App**: Edit `mobile/.env`
2. **Web Dashboard**: Edit `web/.env.local`

## Where to Get Your Keys

### Supabase Keys

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** > **API**
4. You'll find:
   - **Project URL** → Use for `SUPABASE_URL`
   - **anon/public key** → Use for `SUPABASE_ANON_KEY`
   - **service_role key** → Use for `SUPABASE_SERVICE_ROLE_KEY` (web only, keep secret!)

### Vapi.ai API Key

1. Go to [Vapi.ai Dashboard](https://dashboard.vapi.ai)
2. Navigate to **Settings** > **API Keys**
3. Copy your API key

### Anthropic API Key

1. Go to [Anthropic Console](https://console.anthropic.com/settings/keys)
2. Create a new API key if you don't have one
3. Copy the key (you can only see it once!)

### NextAuth Secret

Generate a random secret for NextAuth:

```bash
openssl rand -base64 32
```

Or use an online generator: https://generate-secret.vercel.app/32

## Mobile App Environment Variables

File: `mobile/.env`

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
EXPO_PUBLIC_VAPI_API_KEY=your_vapi_key_here
```

**Note**: All variables must start with `EXPO_PUBLIC_` to be accessible in the Expo app.

## Web Dashboard Environment Variables

File: `web/.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
VAPI_API_KEY=your_vapi_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_generated_secret_here
```

**Important**: 
- Variables starting with `NEXT_PUBLIC_` are exposed to the browser
- `SUPABASE_SERVICE_ROLE_KEY` should NEVER be exposed to the browser (don't use `NEXT_PUBLIC_` prefix)
- `VAPI_API_KEY` and `ANTHROPIC_API_KEY` are server-side only (no `NEXT_PUBLIC_` prefix)

## Verification

After setting up your environment variables:

### Mobile App
```bash
cd mobile
npm start
# Check that the app loads without errors
```

### Web Dashboard
```bash
cd web
npm run dev
# Visit http://localhost:3000 and check for errors in the console
```

## Security Notes

- ✅ **DO** commit `.env.example` files (they're templates)
- ❌ **DON'T** commit `.env` or `.env.local` files (they contain secrets)
- ✅ **DO** use different keys for development and production
- ❌ **DON'T** share your service role key or API keys publicly

## Troubleshooting

### "Missing Supabase environment variables" error
- Check that your `.env` file exists in the correct location
- Verify variable names match exactly (case-sensitive)
- For Expo: Ensure variables start with `EXPO_PUBLIC_`
- Restart your development server after changing `.env` files

### "Invalid API key" errors
- Double-check you copied the entire key (no extra spaces)
- Verify you're using the correct key type (anon vs service role)
- Check that your Supabase project is active

### Next.js can't find environment variables
- Make sure the file is named `.env.local` (not `.env`)
- Server-side variables don't need `NEXT_PUBLIC_` prefix
- Client-side variables MUST have `NEXT_PUBLIC_` prefix
- Restart the dev server after changes




