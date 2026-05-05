import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

/**
 * Plain anon-key Supabase client.
 *
 * NAMED `supabaseAnon` (not `supabase`) so callers can't accidentally treat
 * this as an elevated server client. Only use this from browser code or
 * truly-public routes; for cookie-aware SSR, prefer `createBrowserSupabase`
 * (`web/lib/supabase-browser.ts`) and `createServerSupabase`
 * (`web/lib/supabase-server.ts`).
 */
export const supabaseAnon = createClient<Database>(supabaseUrl, supabaseAnonKey)

/** @deprecated Use `supabaseAnon`. Kept temporarily for migration. */
export const supabase = supabaseAnon

/**
 * Service-role Supabase client. Bypasses RLS — only call from server-only
 * code paths (route handlers, server components). Never expose this to the
 * browser. Prefer `createServiceSupabase` (`web/lib/supabase-server.ts`)
 * which is cookie-aware.
 */
export const createServiceRoleClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey)
}
