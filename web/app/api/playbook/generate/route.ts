import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface PlaybookGenerateRequest {
  name: string;
  description: string;
  openingLine: string;
  first30Seconds: string;
  objections: { objection: string; response: string }[];
  mustMention: string[];
  neverSay: string[];
  closingAsk: string;
  idealOutcome: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: PlaybookGenerateRequest = await request.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      );
    }

    if (!body?.name) {
      return NextResponse.json(
        { error: 'Playbook name is required' },
        { status: 400 }
      );
    }

    const objectionsText = (body.objections || [])
      .map((o, i) => `${i + 1}. ${o.objection}\n   Best response: ${o.response}`)
      .join('\n');

    const mustMentionText = (body.mustMention || [])
      .map((item, i) => `${i + 1}. ${item}`)
      .join('\n');

    const neverSayText = (body.neverSay || [])
      .map((item, i) => `${i + 1}. ${item}`)
      .join('\n');

    const prompt = `You are a sales training expert helping create a playbook for field technicians who sell drying equipment drop-off services to homeowners. Generate a polished, well-structured playbook in Markdown.\n\nUse the following inputs:\n\nPlaybook name: ${body.name}\nDescription: ${body.description}\n\nOpening & Introduction:\n- Ideal opening line: ${body.openingLine}\n- First 30 seconds: ${body.first30Seconds}\n\nCommon Objections:\n${objectionsText || 'None provided'}\n\nKey Talking Points:\nMust mention:\n${mustMentionText || 'None provided'}\n\nNever say:\n${neverSayText || 'None provided'}\n\nClosing:\n- Ask for commitment: ${body.closingAsk}\n- Ideal outcome: ${body.idealOutcome}\n\nRequirements:\n- Use clear headings and bullet points.\n- Include an opening section, objection handling section, key talking points, and closing guidance.\n- Keep it concise but actionable.\n\nReturn ONLY the Markdown content.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1800,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    return NextResponse.json({ content: responseText });
  } catch (error) {
    console.error('Error generating playbook:', error);
    return NextResponse.json(
      { error: 'Failed to generate playbook' },
      { status: 500 }
    );
  }
}

