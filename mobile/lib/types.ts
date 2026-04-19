export interface Persona {
  id: string;
  name: string;
  scenario_type: string;
  personality_type: string;
  brief_description: string;
  system_prompt: string;
  first_message: string;
  speaker_label: string;
  gender?: 'male' | 'female';
}

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
}

export interface Assessment {
  score: number;
  letter_grade?: string;
  strengths: string[];
  improvements: string[];
  summary: string;
  actions_to_take?: Array<{
    ai_said: string;
    suggested_response: string;
    technique?: string;
  }>;
}

export interface TrainingSession {
  id: string;
  user_id: string;
  persona_id?: string;
  persona_name?: string;
  persona_scenario_type?: string;
  transcript: TranscriptEntry[];
  assessment: Assessment;
  vapi_call_id?: string;
  created_at: string;
}

export interface Playbook {
  id: string;
  scenario_type: string;
  content: string;
  is_active: boolean;
  name?: string;
}

export type ScenarioGroup = 'technician' | 'bizdev';

export interface ScenarioConfig {
  type: string;
  group: ScenarioGroup;
  callType: 'cold_call' | 'discovery';
  label: string;
  description: string;
  icon: string;
  techRole: string;
}
