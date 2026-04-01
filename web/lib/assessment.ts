interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date | string;
}

interface PersonaContext {
  name: string;
  personalityType: string;
  scenarioType: string;
  speakerLabel: string;
}

export interface Assessment {
  score: number;
  strengths: string[];
  improvements: string[];
  summary: string;
}

/**
 * Fetch the active playbook content for a given scenario type.
 * Returns null if none found.
 */
async function fetchScenarioPlaybook(scenarioType: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/playbook?scenario_type=${encodeURIComponent(scenarioType)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.playbook?.content ?? null;
  } catch {
    return null;
  }
}

/**
 * Generate an AI assessment of a training session using Claude.
 * Automatically fetches the scenario playbook to use as the rubric.
 */
export async function generateAssessment(messages: Message[], persona?: PersonaContext): Promise<Assessment> {
  try {
    // Try to load the active playbook for this scenario to use as rubric
    const playbookContent = persona?.scenarioType
      ? await fetchScenarioPlaybook(persona.scenarioType)
      : null;

    const response = await fetch('/api/assess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, persona, playbookContent }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate assessment');
    }

    const data = await response.json();
    return data.assessment;
  } catch (error) {
    console.error('Error generating assessment:', error);
    throw error;
  }
}
