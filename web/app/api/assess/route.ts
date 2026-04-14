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

    // Technician scenarios: homeowner calls + plumber-referred leads (sign the job)
    // BD scenarios: referral partner outreach (earn future referrals)
    const isTechnicianScenario = persona
      ? persona.scenarioType.startsWith('homeowner') || persona.scenarioType === 'plumber_lead'
      : true;

    const primaryOutcome = isTechnicianScenario
      ? `Did the rep set this job up to sign? Would a homeowner in this situation agree to move forward with the company by the end of this call or visit?`
      : `Did the rep build a relationship that will generate referrals? How likely is this contact to send work their way in the future?`;

    const primaryCriteria = isTechnicianScenario
      ? `- Did they earn trust and move the homeowner toward a clear YES (schedule, sign, or firm next step)?
- Did they handle objections (cost, insurance, urgency) in a way that removed barriers to signing?
- Did they create urgency without being pushy — making inaction feel riskier than acting now?
- Did they close or attempt to close at the right moment?`
      : `- Did they make a memorable, positive impression that a busy referral source would remember?
- Did they give the contact a real reason to send work their way (differentiation, trust, likability)?
- Did they handle pushback (existing vendor, no time) without damaging the relationship?
- Did they land a concrete next step (lunch, follow-up, intro) that keeps the door open?`;

    const playbookSection = resolvedPlaybookContent
      ? `\n\nPLAYBOOK FOR THIS SCENARIO (use as a secondary reference — see scoring weights below):\n${resolvedPlaybookContent}\n`
      : '';

    // Create the assessment prompt
    const assessmentPrompt = `You are an experienced sales manager grading a training call for a water damage restoration company. ${scenarioContext}${playbookSection}

Here is the conversation transcript:

${transcriptText}

## Scoring Framework

Your score (1–10) must reflect these weights:

**75% — Sales Outcome**
${primaryOutcome}

${primaryCriteria}

**25% — Playbook Execution**
${resolvedPlaybookContent
  ? `How closely did the rep follow the playbook above? Use it as a helpful guide, not a rigid checklist — give credit for the intent even if the exact phrasing differed.`
  : `No playbook is loaded for this scenario. Base this 25% on general best practices: structured opener, active listening, clear value prop, and a defined close.`}

## Scoring Guide
- 9–10: Would almost certainly sign/refer. Handled objections confidently, created urgency, strong close.
- 7–8: Likely outcome is positive. Good fundamentals, minor missed opportunities.
- 5–6: Uncertain outcome. Some good moments but left key objections unaddressed or failed to close.
- 3–4: Unlikely to sign/refer. Lost control of the conversation or failed to build trust.
- 1–2: Call was damaging. Would likely cost the company the job or relationship.

Be encouraging but direct — like a good sales manager who wants the rep to improve. Give specific, actionable feedback and include example lines they could have used.

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

