import { createClient } from '@supabase/supabase-js'
import type { Database } from './types/database'

// These will be set via environment variables in each app
export const createSupabaseClient = (url: string, anonKey: string) => {
  return createClient<Database>(url, anonKey)
}

// Re-export database types for convenience
export type { Database } from './types/database'
export type { Organization, User, TrainingSession, Playbook, UserRole } from './types/database'

