// Database types matching the Supabase schema
// This should match the schema defined in shared/schema.sql

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
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
        }
        Insert: {
          id?: string
          auth_user_id?: string | null
          email: string
          name: string
          role: 'technician' | 'manager'
          organization_id: string
          created_at?: string
          updated_at?: string
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
        }
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
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          scenario_type: string
          name: string
          personality_type: string
          brief_description?: string
          speaker_label?: string
          first_message: string
          system_prompt: string
          is_default?: boolean
          is_active?: boolean
          gender?: 'male' | 'female' | null
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
          created_at?: string
          updated_at?: string
        }
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
        }
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
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          name?: string | null
          content: string
          file_url?: string | null
          uploaded_by?: string | null
          scenario_type?: string | null
          is_active?: boolean
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
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

// Helper types for easier access
export type Organization = Database['public']['Tables']['organizations']['Row']
export type User = Database['public']['Tables']['users']['Row']
export type Persona = Database['public']['Tables']['personas']['Row']
export type TrainingSession = Database['public']['Tables']['training_sessions']['Row']
export type Playbook = Database['public']['Tables']['playbooks']['Row']

export type UserRole = 'technician' | 'manager'
