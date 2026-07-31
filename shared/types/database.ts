// Database types matching the Supabase schema.
//
// Source of truth: shared/schema.sql (base tables) plus the ALTER TABLE
// migrations under web/supabase/*.sql. This file is hand-maintained — when you
// add a column in a migration, mirror it here.
//
// Coverage note: only the five core tables (organizations, users, personas,
// training_sessions, playbooks) are fully typed. Other tables referenced by API
// routes (subscriptions, coach_instances, minute_transactions, notifications,
// webhook_events, etc.) are not yet modelled here, so queries against them must
// still be cast. Row types are complete for reads; Insert/Update fields are all
// optional to stay permissive for existing write call-sites.

export type AppRole = 'individual' | 'company_admin' | 'coach' | 'superuser'

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
          // coach + billing extensions (web/supabase/coach-migration, billing-migration)
          coach_instance_id: string | null
          invite_token: string | null
          plan_id: string | null
          seat_count: number | null
          minutes_pool: number | null
          bonus_minutes: number | null
          auto_refill_enabled: boolean | null
          subscription_status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
          coach_instance_id?: string | null
          invite_token?: string | null
          plan_id?: string | null
          seat_count?: number | null
          minutes_pool?: number | null
          bonus_minutes?: number | null
          auto_refill_enabled?: boolean | null
          subscription_status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
          coach_instance_id?: string | null
          invite_token?: string | null
          plan_id?: string | null
          seat_count?: number | null
          minutes_pool?: number | null
          bonus_minutes?: number | null
          auto_refill_enabled?: boolean | null
          subscription_status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          auth_user_id: string | null
          email: string
          name: string
          role: 'technician' | 'manager'
          organization_id: string
          created_at: string
          updated_at: string
          // auth extension (web/supabase/auth-migration, coach-migration)
          app_role: AppRole | null
          status: string | null
          full_name: string | null
          user_type: string | null
          coach_instance_id: string | null
          candidate_invite_id: string | null
          scenario_access: string[] | null
          tos_accepted_at: string | null
          marketing_consent: boolean | null
          // billing extension (web/supabase/billing-migration, session-limit)
          minutes_used: number | null
          bonus_minutes: number | null
          trial_ends_at: string | null
          stripe_customer_id: string | null
          stripe_connect_account_id: string | null
          auto_refill_enabled: boolean | null
          sessions_used: number | null
          session_limit: number | null
          upload_minutes_used_this_month: number | null
          upload_minutes_reset_at: string | null
          // referral extension (web/supabase/share-referral-migration)
          referral_code: string | null
          referral_credits_minutes: number | null
        }
        Insert: {
          id?: string
          auth_user_id?: string | null
          email?: string
          name?: string
          role?: 'technician' | 'manager'
          organization_id?: string
          created_at?: string
          updated_at?: string
          app_role?: AppRole | null
          status?: string | null
          full_name?: string | null
          user_type?: string | null
          coach_instance_id?: string | null
          candidate_invite_id?: string | null
          scenario_access?: string[] | null
          tos_accepted_at?: string | null
          marketing_consent?: boolean | null
          minutes_used?: number | null
          bonus_minutes?: number | null
          trial_ends_at?: string | null
          stripe_customer_id?: string | null
          stripe_connect_account_id?: string | null
          auto_refill_enabled?: boolean | null
          sessions_used?: number | null
          session_limit?: number | null
          upload_minutes_used_this_month?: number | null
          upload_minutes_reset_at?: string | null
          referral_code?: string | null
          referral_credits_minutes?: number | null
        }
        Update: {
          id?: string
          auth_user_id?: string | null
          email?: string
          name?: string
          role?: 'technician' | 'manager'
          organization_id?: string
          created_at?: string
          updated_at?: string
          app_role?: AppRole | null
          status?: string | null
          full_name?: string | null
          user_type?: string | null
          coach_instance_id?: string | null
          candidate_invite_id?: string | null
          scenario_access?: string[] | null
          tos_accepted_at?: string | null
          marketing_consent?: boolean | null
          minutes_used?: number | null
          bonus_minutes?: number | null
          trial_ends_at?: string | null
          stripe_customer_id?: string | null
          stripe_connect_account_id?: string | null
          auto_refill_enabled?: boolean | null
          sessions_used?: number | null
          session_limit?: number | null
          upload_minutes_used_this_month?: number | null
          upload_minutes_reset_at?: string | null
          referral_code?: string | null
          referral_credits_minutes?: number | null
        }
        Relationships: []
      }
      personas: {
        Row: {
          id: string
          organization_id: string
          scenario_type: string
          name: string
          personality_type: string
          brief_description: string
          speaker_label: string
          first_message: string
          system_prompt: string
          is_default: boolean
          is_active: boolean
          gender: 'male' | 'female' | null
          coach_instance_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          scenario_type?: string
          name?: string
          personality_type?: string
          brief_description?: string
          speaker_label?: string
          first_message?: string
          system_prompt?: string
          is_default?: boolean
          is_active?: boolean
          gender?: 'male' | 'female' | null
          coach_instance_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          scenario_type?: string
          name?: string
          personality_type?: string
          brief_description?: string
          speaker_label?: string
          first_message?: string
          system_prompt?: string
          is_default?: boolean
          is_active?: boolean
          gender?: 'male' | 'female' | null
          coach_instance_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_sessions: {
        Row: {
          id: string
          user_id: string | null
          organization_id: string | null
          vapi_call_id: string | null
          persona_id: string | null
          persona_name: string | null
          persona_scenario_type: string | null
          started_at: string
          ended_at: string | null
          recording_url: string | null
          transcript: unknown | null
          assessment: unknown | null
          created_at: string
          updated_at: string
          // field-recording + share extensions
          source: string | null
          original_filename: string | null
          share_token: string | null
          share_enabled_at: string | null
          share_expires_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          organization_id?: string | null
          vapi_call_id?: string | null
          persona_id?: string | null
          persona_name?: string | null
          persona_scenario_type?: string | null
          started_at?: string
          ended_at?: string | null
          recording_url?: string | null
          transcript?: unknown | null
          assessment?: unknown | null
          created_at?: string
          updated_at?: string
          source?: string | null
          original_filename?: string | null
          share_token?: string | null
          share_enabled_at?: string | null
          share_expires_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          organization_id?: string | null
          vapi_call_id?: string | null
          persona_id?: string | null
          persona_name?: string | null
          persona_scenario_type?: string | null
          started_at?: string
          ended_at?: string | null
          recording_url?: string | null
          transcript?: unknown | null
          assessment?: unknown | null
          created_at?: string
          updated_at?: string
          source?: string | null
          original_filename?: string | null
          share_token?: string | null
          share_enabled_at?: string | null
          share_expires_at?: string | null
        }
        Relationships: []
      }
      playbooks: {
        Row: {
          id: string
          organization_id: string
          name: string | null
          content: string
          file_url: string | null
          uploaded_by: string | null
          scenario_type: string | null
          is_active: boolean
          coach_instance_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          name?: string | null
          content?: string
          file_url?: string | null
          uploaded_by?: string | null
          scenario_type?: string | null
          is_active?: boolean
          coach_instance_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string | null
          content?: string
          file_url?: string | null
          uploaded_by?: string | null
          scenario_type?: string | null
          is_active?: boolean
          coach_instance_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    // The Supabase client generic requires these keys to resolve query result
    // types. They are intentionally empty until modelled (mirrors the shape that
    // `supabase gen types typescript` emits).
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

// Helper types for easier access
export type Organization = Database['public']['Tables']['organizations']['Row']
export type User = Database['public']['Tables']['users']['Row']
export type Persona = Database['public']['Tables']['personas']['Row']
export type TrainingSession = Database['public']['Tables']['training_sessions']['Row']
export type Playbook = Database['public']['Tables']['playbooks']['Row']

export type UserRole = 'technician' | 'manager'
