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
          email: string
          name: string
          role: 'technician' | 'manager'
          organization_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          role: 'technician' | 'manager'
          organization_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: 'technician' | 'manager'
          organization_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      training_sessions: {
        Row: {
          id: string
          user_id: string
          organization_id: string
          vapi_call_id: string | null
          started_at: string
          ended_at: string | null
          recording_url: string | null
          transcript: string | null
          assessment: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          organization_id: string
          vapi_call_id?: string | null
          started_at?: string
          ended_at?: string | null
          recording_url?: string | null
          transcript?: string | null
          assessment?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          organization_id?: string
          vapi_call_id?: string | null
          started_at?: string
          ended_at?: string | null
          recording_url?: string | null
          transcript?: string | null
          assessment?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      playbooks: {
        Row: {
          id: string
          organization_id: string
          name: string
          content: string
          file_url: string | null
          uploaded_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          content: string
          file_url?: string | null
          uploaded_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          content?: string
          file_url?: string | null
          uploaded_by?: string
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
export type TrainingSession = Database['public']['Tables']['training_sessions']['Row']
export type Playbook = Database['public']['Tables']['playbooks']['Row']

export type UserRole = 'technician' | 'manager'




