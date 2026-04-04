import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

// GET /api/insights?days=30&user_id=xxx
// Returns aggregate strengths + improvements from all session assessments in the window
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days'); // null = all time

    const supabaseAuth = createServerSupabase();
    const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const supabase = createServiceSupabase();
    const { data: profile } = await (supabase as any)
      .from('users')
      .select('id, app_role, organization_id, coach_instance_id')
      .eq('auth_user_id', authUser.id)
      .single();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (profile as any).id as string;
    const appRole = (profile as any).app_role as string;
    const organizationId = (profile as any).organization_id as string | null;
    const coachInstanceId = (profile as any).coach_instance_id as string | null;

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
        metrics: { totalSessions: 0, avgScore: null, activeUsers: 0, byScenario: {} },
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
        metrics: { totalSessions: sessions.length, avgScore: null, activeUsers: 0, byScenario: {} },
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

    // Aggregate org/coach metrics
    let orgSessionsQuery = (supabase as any)
      .from('training_sessions')
      .select('id, started_at, user_id, persona_scenario_type')
      .order('started_at', { ascending: false })
      .limit(500);

    if (appRole === 'company_admin' && organizationId) {
      // Get user IDs in this org
      const { data: orgUsers } = await (supabase as any)
        .from('users')
        .select('id')
        .eq('organization_id', organizationId);
      const orgUserIds = (orgUsers ?? []).map((u: any) => u.id);
      if (orgUserIds.length > 0) {
        orgSessionsQuery = orgSessionsQuery.in('user_id', orgUserIds);
      }
    } else if (appRole === 'coach' && coachInstanceId) {
      const { data: coachUsers } = await (supabase as any)
        .from('users')
        .select('id')
        .eq('coach_instance_id', coachInstanceId);
      const coachUserIds = (coachUsers ?? []).map((u: any) => u.id);
      if (coachUserIds.length > 0) {
        orgSessionsQuery = orgSessionsQuery.in('user_id', coachUserIds);
      }
    } else {
      orgSessionsQuery = orgSessionsQuery.eq('user_id', userId);
    }

    const { data: orgSessions } = await orgSessionsQuery;
    const totalSessions = (orgSessions ?? []).length;
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const activeUserIds = new Set(
      (orgSessions ?? []).filter((s: any) => s.started_at > cutoff).map((s: any) => s.user_id)
    );
    const byScenario: Record<string, number> = {};
    (orgSessions ?? []).forEach((s: any) => {
      const t = s.persona_scenario_type || 'unknown';
      byScenario[t] = (byScenario[t] ?? 0) + 1;
    });

    return NextResponse.json({
      sessionCount: assessments.length,
      avgScore,
      topStrengths: insights.topStrengths || [],
      topImprovements: insights.topImprovements || [],
      summary: insights.summary || '',
      period: daysParam ? `Last ${daysParam} days` : 'All time',
      metrics: {
        totalSessions,
        avgScore: avgScore !== null ? String(avgScore) : null,
        activeUsers: activeUserIds.size,
        byScenario,
      },
    });
  } catch (error) {
    console.error('Error generating insights:', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
