import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { extractedText } = await req.json();
  if (!extractedText) return NextResponse.json({ error: 'extractedText required' }, { status: 400 });

  const prompt = `You are extracting structured playbook data from a sales training document for restoration/water-damage technicians.

Given the document text below, extract the following fields as JSON. Be concise and practical. If a field isn't clearly covered, infer a reasonable value or leave it empty.

Return ONLY valid JSON with exactly these keys:
{
  "name": "Short playbook name (5 words max)",
  "description": "One sentence describing the playbook's purpose",
  "openingLine": "The ideal opening line when meeting a homeowner or prospect",
  "first30Seconds": "What techs should establish in the first 30 seconds",
  "objections": [
    { "objection": "objection text", "response": "how to handle it" }
  ],
  "mustMention": ["key point 1", "key point 2"],
  "neverSay": ["phrase to avoid 1", "phrase to avoid 2"],
  "closingAsk": "How techs should ask for the commitment",
  "idealOutcome": "What a successful call looks like"
}

Include 2-5 objections, 3-6 must-mention items, and 2-4 never-say items.

Document:
${extractedText.slice(0, 10000)}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = (message.content[0] as any).text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: 'Could not parse response' }, { status: 500 });

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ wizardData: parsed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Parse failed' }, { status: 500 });
  }
}
