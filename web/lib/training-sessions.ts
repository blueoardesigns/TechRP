import { supabase } from './supabase';
import type { Database } from '../../shared/types/database';

type TrainingSessionInsert = Database['public']['Tables']['training_sessions']['Insert'];
type TrainingSessionUpdate = Database['public']['Tables']['training_sessions']['Update'];

interface SaveTrainingSessionParams {
  userId: string;
  organizationId: string;
  transcript: string | null;
  startedAt: Date;
  endedAt: Date;
  vapiCallId?: string | null;
  recordingUrl?: string | null;
  personaId?: string | null;
  personaName?: string | null;
  personaScenarioType?: string | null;
}

/**
 * Save a training session to Supabase
 */
export async function saveTrainingSession({
  userId,
  organizationId,
  transcript,
  startedAt,
  endedAt,
  vapiCallId = null,
  recordingUrl = null,
  personaId = null,
  personaName = null,
  personaScenarioType = null,
}: SaveTrainingSessionParams) {
  try {
    const sessionData: TrainingSessionInsert & {
      persona_id?: string | null;
      persona_name?: string | null;
      persona_scenario_type?: string | null;
    } = {
      user_id: userId,
      organization_id: organizationId,
      vapi_call_id: vapiCallId,
      recording_url: recordingUrl,
      transcript: transcript,
      assessment: null,
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      persona_id: personaId,
      persona_name: personaName,
      persona_scenario_type: personaScenarioType,
    };

    const { data, error } = await supabase
      .from('training_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error) {
      console.error('Error saving training session:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to save training session:', error);
    throw error;
  }
}

/**
 * Update a training session's assessment
 */
export async function updateSessionAssessment(
  sessionId: string,
  assessment: string
) {
  try {
    const { data, error } = await supabase
      .from('training_sessions')
      .update({ assessment })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating session assessment:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to update session assessment:', error);
    throw error;
  }
}

/**
 * Update a training session's recording URL and call ID
 */
export async function updateSessionRecording(
  sessionId: string,
  recordingUrl: string | null,
  vapiCallId: string
) {
  try {
    const { data, error } = await supabase
      .from('training_sessions')
      .update({ recording_url: recordingUrl, vapi_call_id: vapiCallId })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating session recording:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to update session recording:', error);
    throw error;
  }
}
