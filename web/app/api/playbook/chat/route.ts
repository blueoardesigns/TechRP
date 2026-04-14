import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const CHAT_SYSTEM_PROMPT = `You are helping a sales coach build a training playbook from a document they uploaded. Your job is to extract the information needed to generate a playbook by asking one focused question at a time.

The playbook needs these inputs:
- name: a short title for this playbook (e.g. "Homeowner Inbound Call")
- description: one sentence describing the scenario this playbook covers
- openingLine: the ideal first words the technician says when starting the call
- first30Seconds: what the technician should accomplish in the first 30 seconds
- objections: 3–5 common objections and the best response to each
- mustMention: 3–5 key talking points the technician must always cover
- neverSay: 2–4 phrases or approaches the technician should always avoid
- closingAsk: the exact ask used to close — what the technician asks for at the end
- idealOutcome: what a successful call looks like (e.g. "Homeowner agrees to a free inspection today")

INSTRUCTIONS:
1. On the first message, analyze the uploaded document carefully. Extract what you can already determine with confidence, then identify the most important gap.
2. Ask ONE specific, conversational question at a time to fill that gap. Reference the document when relevant.
3. After each user answer, either ask the next most important missing question OR — if you have enough for all fields — output the completion signal below.
4. When you have solid values for all fields, output EXACTLY this (nothing after the JSON):
__READY__
{"name":"...","description":"...","openingLine":"...","first30Seconds":"...","objections":[{"objection":"...","response":"..."}],"mustMention":["...","..."],"neverSay":["...","..."],"closingAsk":"...","idealOutcome":"..."}

Keep questions short and specific. Do not ask about multiple things in one message.`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { messages: ChatMessage[]; extractedText: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { messages, extractedText } = body;

  if (!messages || !Array.isArray(messages) || !extractedText) {
    return NextResponse.json({ error: 'messages array and extractedText are required' }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const systemWithDoc = `${CHAT_SYSTEM_PROMPT}\n\n---\nDOCUMENT CONTENT:\n${extractedText}`;

  let responseText: string;
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemWithDoc,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    responseText = response.content[0].type === 'text' ? response.content[0].text : '';
  } catch (err) {
    console.error('Playbook chat error:', err);
    return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 });
  }

  const isReady = responseText.includes('__READY__');
  let generateInputs: Record<string, unknown> | null = null;

  if (isReady) {
    const jsonPart = responseText.split('__READY__')[1]?.trim();
    if (jsonPart) {
      try {
        generateInputs = JSON.parse(jsonPart);
      } catch {
        // Malformed JSON — continue chatting rather than failing
      }
    }
  }

  return NextResponse.json({
    message: isReady
      ? (responseText.split('__READY__')[0].trim() || "I have everything I need. Generating your playbook now...")
      : responseText,
    ready: isReady && !!generateInputs,
    generateInputs,
  });
}
