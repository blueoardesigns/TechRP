# TechRP Mobile App

Fresh Expo SDK 54 project with expo-router.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Verify environment variables:**
   Make sure your `.env` file has:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_VAPI_API_KEY`

3. **Start the development server:**
   ```bash
   npm start
   ```

## Project Structure

```
mobile/
├── app/
│   ├── _layout.tsx      # Root layout with expo-router
│   └── index.tsx        # Home screen with "Start Training" button
├── lib/
│   └── supabase.ts      # Supabase client configuration
├── assets/              # App icons and images
├── .env                 # Environment variables (preserved)
└── package.json         # Expo SDK 54 dependencies
```

## Features

- ✅ Expo SDK 54
- ✅ expo-router for navigation
- ✅ TypeScript configured
- ✅ Supabase client ready
- ✅ Home screen with "Start Training" button placeholder

## Next Steps

1. Add authentication screens
2. Implement Vapi.ai voice call integration
3. Add training session management
4. Create session history screen




