import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

// GET /api/insights?days=30&user_id=xxx
// Returns aggregate strengths + improvements from all session assessments in the window
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days'); // null = all time
    const userId = searchParams.get('user_id') || '00000000-0000-0000-0000-000000000001';

    const supabase = createServiceRoleClient();

    let query = (supabase as any)
      .from('training_sessions')
      .select('id, started_at, ended_at, assessment, persona_name, persona_scenario_type')
      .eq('user_id', userId)
      .not('assessment', 'is', null)
      .order('started_at', { ascending: false });

    if (daysParam) {
      const days = parseInt(daysParam, 10);
      const since = new Date();
      since.setDate(since.getDate() - days);
      query = query.gte('started_at', since.toISOString());
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Error fetching sessions for insights:', error);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        sessionCount: 0,
        avgScore: null,
        topStrengths: [],
        topImprovements: [],
        summary: null,
        period: daysParam ? `${daysParam} days` : 'all time',
      });
    }

    // Pull out all assessment data
    const assessments = sessions
      .map((s: any) => {
        try {
          const a = typeof s.assessment === 'string' ? JSON.parse(s.assessment) : s.assessment;
          return {
            score: a?.score ?? null,
            strengths: a?.strengths ?? [],
            improvements: a?.improvements ?? [],
            summary: a?.summary ?? '',
            date: s.started_at,
            scenario: s.persona_scenario_type || 'unknown',
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    if (assessments.length === 0) {
      return NextResponse.json({
        sessionCount: sessions.length,
        avgScore: null,
        topStrengths: [],
        topImprovements: [],
        summary: 'No completed assessments found in this period.',
        period: daysParam ? `${daysParam} days` : 'all time',
      });
    }

    // Compute average score
    const scores = assessments.map((a: any) => a.score).filter((s: any) => s !== null);
    const avgScore = scores.length > 0
      ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10
      : null;

    // Build a prompt for Claude to synthesize the patterns
    const allStrengths = assessments.flatMap((a: any) => a.strengths);
    const allImprovements = assessments.flatMap((a: any) => a.improvements);
    const allSummaries = assessments.map((a: any) => a.summary).filter(Boolean);

    const insightPrompt = `You are a sales training director analyzing a rep's training session history.

Period: ${daysParam ? `Last ${daysParam} days` : 'All time'}
Sessions analyzed: ${assessments.length}
Average score: ${avgScore ?? 'N/A'} / 10

INDIVIDUAL STRENGTHS NOTED ACROSS ALL SESSIONS:
${allStrengths.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}

INDIVIDUAL AREAS FOR IMPROVEMENT NOTED ACROSS ALL SESSIONS:
${allImprovements.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}

ASSESSMENT SUMMARIES:
${allSummaries.map((s: string, i: number) => `Session ${i + 1}: ${s}`).join('\n\n')}

Based on ALL of this data, identify the consistent patterns. Respond in valid JSON only (no markdown):
{
  "topStrengths": [<3-5 consolidated, specific recurring strengths as strings>],
  "topImprovements": [<3-5 consolidated, specific recurring areas to improve as strings>],
  "summary": "<2-3 sentence overall coaching observation — what this rep consistently does well, and the #1 thing to focus on to level up>"
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: insightPrompt }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const insights = JSON.parse(cleaned);

    return NextResponse.json({
      sessionCount: assessments.length,
      avgScore,
      topStrengths: insights.topStrengths || [],
      topImprovements: insights.topImprovements || [],
      summary: insights.summary || '',
      period: daysParam ? `Last ${daysParam} days` : 'All time',
    });
  } catch (error) {
    console.error('Error generating insights:', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
