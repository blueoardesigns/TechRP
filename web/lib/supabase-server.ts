import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '../../shared/types/database';

export function createServerSupabase() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (e) {
            // Expected in Server Components where headers are read-only.
            // Log at debug level so the error is visible during local dev
            // and in production log streams without being noisy in tests.
            if (process.env.NODE_ENV === 'development') {
              console.debug('[supabase-server] cookie set skipped (read-only context):', e);
            }
          }
        },
      },
    }
  );
}

export function createServiceSupabase() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (e) {
            // Expected in Server Components where headers are read-only.
            // Log at debug level so the error is visible during local dev
            // and in production log streams without being noisy in tests.
            if (process.env.NODE_ENV === 'development') {
              console.debug('[supabase-server] cookie set skipped (read-only context):', e);
            }
          }
        },
      },
    }
  );
}
