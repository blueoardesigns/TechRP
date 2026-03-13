import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AssessmentRequest {
  messages: Message[];
}

export async function POST(request: NextRequest) {
  try {
    const body: AssessmentRequest = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid messages array' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // Format transcript for analysis
    const transcriptText = messages
      .map((msg) => `${msg.role === 'user' ? 'Technician' : 'Homeowner'}: ${msg.content}`)
      .join('\n\n');

    // Create the assessment prompt
    const assessmentPrompt = `You are evaluating a training session where a field technician is practicing selling drying equipment drop-off services to a homeowner. The homeowner roleplays as skeptical and raises objections.

Here is the conversation transcript:

${transcriptText}

Please provide a detailed assessment of the technician's performance. Evaluate them on:

1. Objection handling - How well did they address concerns (cost, need to think, other quotes, etc.)?
2. Rapport building - Did they build trust and connection with the homeowner?
3. Tone and approach - Were they pushy/aggressive or patient/consultative?
4. Value communication - Did they clearly explain the benefits and value of the service?
5. Cost/insurance handling - How did they address financial concerns?

Respond in the following JSON format (valid JSON only, no markdown):
{
  "score": <number 1-10>,
  "strengths": [<array of strings, 2-4 items>],
  "improvements": [<array of strings, 2-4 items>],
  "summary": "<2-3 sentence overall feedback>"
}

Be specific and constructive. Focus on actionable feedback.`;

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: assessmentPrompt,
        },
      ],
    });

    // Extract the response text
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    
    // Try to parse JSON from the response
    let assessment;
    try {
      // Remove markdown code blocks if present
      const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      assessment = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Error parsing assessment JSON:', parseError);
      console.error('Response text:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse assessment response' },
        { status: 500 }
      );
    }

    // Validate assessment structure
    if (!assessment.score || !assessment.strengths || !assessment.improvements || !assessment.summary) {
      return NextResponse.json(
        { error: 'Invalid assessment structure from API' },
        { status: 500 }
      );
    }

    return NextResponse.json({ assessment });
  } catch (error) {
    console.error('Error generating assessment:', error);
    return NextResponse.json(
      { error: 'Failed to generate assessment' },
      { status: 500 }
    );
  }
}

