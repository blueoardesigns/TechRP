import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../shared/types/database';

/**
 * Module-level singleton.
 *
 * Every `createBrowserClient` shares the same auth storage key, so returning a
 * fresh one per caller makes GoTrue warn about "Multiple GoTrueClient
 * instances" and risks concurrent writes to the same session. One instance per
 * browser context is the supported shape.
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createBrowserSupabase() {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browserClient;
}
