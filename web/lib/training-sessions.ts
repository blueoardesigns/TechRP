interface SaveTrainingSessionParams {
  userId: string | null;
  organizationId: string | null;
  transcript: string | null;
  startedAt: Date;
  endedAt: Date;
  vapiCallId?: string | null;
  recordingUrl?: string | null;
  personaId?: string | null;
  personaName?: string | null;
  personaScenarioType?: string | null;
}

export async function saveTrainingSession(params: SaveTrainingSessionParams) {
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: params.userId,
      organization_id: params.organizationId,
      vapi_call_id: params.vapiCallId ?? null,
      recording_url: params.recordingUrl ?? null,
      transcript: params.transcript,
      assessment: null,
      started_at: params.startedAt.toISOString(),
      ended_at: params.endedAt.toISOString(),
      persona_id: params.personaId ?? null,
      persona_name: params.personaName ?? null,
      persona_scenario_type: params.personaScenarioType ?? null,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to save session');
  return data.session;
}

export async function updateSessionAssessment(sessionId: string, assessment: string) {
  const res = await fetch('/api/sessions', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: sessionId, assessment }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to update assessment');
  return data.session;
}

export async function updateSessionRecording(
  sessionId: string,
  recordingUrl: string | null,
  vapiCallId: string
) {
  const res = await fetch('/api/sessions', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: sessionId, recording_url: recordingUrl, vapi_call_id: vapiCallId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to update recording');
  return data.session;
}
