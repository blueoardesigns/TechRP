import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerSupabase } from '@/lib/supabase-server';
import { createServiceRoleClient } from '@/lib/supabase';
import { SCENARIOS } from '@/lib/personas';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();
  const { data: coach } = await (supabase as any)
    .from('users')
    .select('coach_instance_id, app_role')
    .eq('auth_user_id', authUser.id)
    .single();

  if (!coach || (coach as any).app_role !== 'coach' && (coach as any).app_role !== 'superuser') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const playbookName = body.playbookName;
  const playbookContent = body.playbookContent;
  if (!playbookName || !playbookContent || typeof playbookName !== 'string' || typeof playbookContent !== 'string') {
    return NextResponse.json({ error: 'playbookName and playbookContent are required strings' }, { status: 400 });
  }
  const validTypes = SCENARIOS.map(s => s.type);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `Given this sales training playbook, which scenario types does it apply to?

Playbook name: ${playbookName}
Content summary: ${String(playbookContent).slice(0, 800)}

Valid scenario types: ${validTypes.join(', ')}

Reply with a JSON array of matching scenario type strings only. Example: ["homeowner_inbound","property_manager"]`,
    }],
  });

  let suggestedTypes: string[] = [];
  try {
    const text = (message.content[0] as any).text ?? '';
    const match = text.match(/\[.*\]/s);
    if (match) suggestedTypes = JSON.parse(match[0]).filter((t: string) => (validTypes as string[]).includes(t));
  } catch {
    suggestedTypes = [];
  }

  return NextResponse.json({ suggestedTypes });
}
