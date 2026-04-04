import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PersonaContext {
  name: string;
  personalityType: string;
  scenarioType: string;
  speakerLabel: string;
}

interface AssessmentRequest {
  messages: Message[];
  persona?: PersonaContext;
  playbookContent?: string | null;  // Active scenario playbook, if available
}

export async function POST(request: NextRequest) {
  try {
    const body: AssessmentRequest = await request.json();
    const { messages, persona, playbookContent } = body;

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

    // Resolve playbook with coach isolation if not provided by client
    let resolvedPlaybookContent = playbookContent ?? null;
    if (!resolvedPlaybookContent && persona?.scenarioType) {
      try {
        const supabaseAuth = createServerSupabase();
        const { data: { user: authUser } } = await supabaseAuth.auth.getUser();

        let coachInstanceId: string | null = null;
        const sb = createServiceSupabase();
        if (authUser) {
          const { data: profile } = await (sb as any)
            .from('users').select('coach_instance_id').eq('auth_user_id', authUser.id).single();
          coachInstanceId = (profile as any)?.coach_instance_id ?? null;
        }
        let playbook: any = null;
        if (coachInstanceId) {
          // Try coach's own playbook first
          const { data: coachPb } = await (sb as any)
            .from('playbooks')
            .select('content')
            .eq('scenario_type', persona.scenarioType)
            .eq('coach_instance_id', coachInstanceId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (coachPb) {
            playbook = coachPb;
          } else {
            // Fall back to global if enabled
            const { data: inst } = await (sb as any)
              .from('coach_instances').select('global_playbooks_enabled').eq('id', coachInstanceId).single();
            if ((inst as any)?.global_playbooks_enabled) {
              const { data: globalPb } = await (sb as any)
                .from('playbooks')
                .select('content')
                .eq('scenario_type', persona.scenarioType)
                .is('coach_instance_id', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              playbook = globalPb;
            }
          }
        } else {
          const { data: globalPb } = await (sb as any)
            .from('playbooks')
            .select('content')
            .eq('scenario_type', persona.scenarioType)
            .is('coach_instance_id', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          playbook = globalPb;
        }
        if (playbook?.content) resolvedPlaybookContent = playbook.content;
      } catch (e) {
        console.error('Failed to resolve playbook for assessment:', e);
      }
    }

    // Determine speaker labels from persona or use defaults
    const techLabel = 'Rep';
    const contactLabel = persona?.speakerLabel || 'Contact';

    // Format transcript
    const transcriptText = messages
      .map((msg) => `${msg.role === 'user' ? techLabel : contactLabel}: ${msg.content}`)
      .join('\n\n');

    // Build scenario-aware context
    const scenarioContext = persona
      ? `The rep is practicing a "${persona.personalityType}" scenario — talking to ${persona.name}, a ${persona.speakerLabel}. Scenario type: ${persona.scenarioType}.`
      : 'The rep is practicing a water damage restoration sales/service scenario.';

    const scenarioEvalCriteria = persona?.scenarioType.startsWith('homeowner')
      ? `1. Objection handling — How well did they address cost, urgency, insurance, and skepticism concerns?
2. Rapport and empathy — Did they connect with the homeowner and make them feel at ease?
3. Explanation quality — Did they clearly explain the restoration process and why it's needed?
4. Insurance/billing clarity — How well did they address financial concerns?
5. Closing — Did they move toward scheduling or commitment appropriately?`
      : `1. Opening and hook — Did they earn the contact's attention quickly?
2. Objection handling — How well did they address pushback (existing vendor, no time, not interested)?
3. Value proposition — Did they articulate a clear, differentiated reason to consider them?
4. Active listening — Did they ask questions and respond to what was actually said?
5. Next step — Did they successfully move toward a meeting, lunch, or continued conversation?`;

    // If a playbook is provided, use it as the rubric
    const playbookSection = resolvedPlaybookContent
      ? `\n\nACTIVE PLAYBOOK FOR THIS SCENARIO (evaluate the rep against this):\n${resolvedPlaybookContent}\n`
      : '';

    // Create the assessment prompt
    const assessmentPrompt = `You are a sales manager evaluating a training call. ${scenarioContext}${playbookSection}

Here is the conversation transcript:

${transcriptText}

Please provide a detailed assessment of the rep's performance. Evaluate them on:

${scenarioEvalCriteria}

Be encouraging but direct — like a good sales manager. Give specific, actionable feedback including example lines they could have used.

Respond in the following JSON format (valid JSON only, no markdown):
{
  "score": <number 1-10>,
  "strengths": [<array of strings, 2-4 items>],
  "improvements": [<array of strings, 2-4 items>],
  "summary": "<2-3 sentence overall feedback in a sales manager voice>"
}

Be specific and constructive. Reference actual moments from the conversation where possible.`;

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

