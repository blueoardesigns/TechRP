// web/app/api/ai/rewrite-content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerSupabase } from '@/lib/supabase-server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { content, prompt } = await req.json();
    if (!content || !prompt) {
      return NextResponse.json({ error: 'content and prompt are required' }, { status: 400 });
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: 'You are an editor. Rewrite the provided content according to the instruction. Return only the rewritten content — no preamble, explanation, or surrounding quotes.',
      messages: [{ role: 'user', content: `Instruction: ${prompt}\n\n---\n\n${content}` }],
    });

    const result = message.content[0].type === 'text' ? message.content[0].text : '';
    return NextResponse.json({ content: result });
  } catch (e: any) {
    console.error('AI rewrite error:', e);
    return NextResponse.json({ error: e.message ?? 'Rewrite failed' }, { status: 500 });
  }
}
