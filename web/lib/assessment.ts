interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date | string;
}

export interface Assessment {
  score: number;
  strengths: string[];
  improvements: string[];
  summary: string;
}

/**
 * Generate an AI assessment of a training session using Claude
 */
export async function generateAssessment(messages: Message[]): Promise<Assessment> {
  try {
    const response = await fetch('/api/assess', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
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


