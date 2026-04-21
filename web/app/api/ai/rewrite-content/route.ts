import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerSupabase } from '@/lib/supabase-server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

/**
 * POST /api/ai/rewrite-content
 * Body: { content: string; prompt: string }
 * Returns: { content: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content, prompt } = await req.json();
    if (!content || !prompt) {
      return NextResponse.json({ error: 'content and prompt are required' }, { status: 400 });
    }

    const systemMessage = `You are a professional sales training content editor.
Rewrite or transform the provided content according to the user's instruction.
Return ONLY the rewritten content — no preamble, no explanation, no markdown fences.
Preserve the general structure and intent unless explicitly told to change it.
If the original content is in HTML, return valid HTML. If plain text or markdown, return the same format.`;

    const userMessage = `Instruction: ${prompt}\n\nContent to rewrite:\n${content}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemMessage,
      messages: [{ role: 'user', content: userMessage }],
    });

    const rewritten = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    return NextResponse.json({ content: rewritten });
  } catch (error) {
    console.error('Error in /api/ai/rewrite-content:', error);
    return NextResponse.json({ error: 'Failed to rewrite content' }, { status: 500 });
  }
}
