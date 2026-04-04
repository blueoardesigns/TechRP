import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceRoleClient } from '@/lib/supabase';

export const maxDuration = 120; // Allow up to 2 min for large files

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const ORG_ID  = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000001';

// ─── Whisper Transcription ─────────────────────────────────────────────────────

async function transcribeAudio(file: File): Promise<string> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const form = new FormData();
  form.append('file', file, file.name);
  form.append('model', 'whisper-1');
  form.append('language', 'en');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.text || '';
}

// ─── Claude Assessment ─────────────────────────────────────────────────────────

async function assessTranscript(transcript: string): Promise<{
  score: number;
  strengths: string[];
  improvements: string[];
  summary: string;
}> {
  const prompt = `You are a sales manager evaluating a field recording from a water damage restoration technician.

The following is a transcript of the conversation:

${transcript}

Note: This is a real field recording, so the transcript may be imperfect. Speaker labels may be missing or unclear — use context to identify the rep vs. the contact.

Please provide a detailed assessment of the rep's performance. Evaluate them on:
1. Objection handling — How well did they address cost, urgency, insurance, and skepticism concerns?
2. Rapport and empathy — Did they connect with the homeowner/contact and make them feel at ease?
3. Explanation quality — Did they clearly explain the restoration process and why it's needed?
4. Insurance/billing clarity — How well did they address financial concerns?
5. Closing — Did they move toward scheduling or commitment appropriately?

Be encouraging but direct — like a good sales manager. Give specific, actionable feedback including example lines they could have used.

Respond in the following JSON format (valid JSON only, no markdown):
{
  "score": <number 1-10>,
  "strengths": [<array of strings, 2-4 items>],
  "improvements": [<array of strings, 2-4 items>],
  "summary": "<2-3 sentence overall feedback in a sales manager voice>"
}`;

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }

    const file = formData.get('audio') as File | null;
    const consentConfirmed = formData.get('consent') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }
    if (!consentConfirmed) {
      return NextResponse.json({ error: 'Recording consent is required' }, { status: 400 });
    }

    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/x-m4a'];
    const allowedExts = ['.mp3', '.wav', '.m4a', '.mp4'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!allowedExts.includes(ext) && !allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only MP3, WAV, and M4A files are supported' }, { status: 400 });
    }

    // 50 MB limit
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 400 });
    }

    // Step 1: Transcribe
    let transcript: string;
    try {
      transcript = await transcribeAudio(file);
    } catch (err: any) {
      console.error('Transcription error:', err);
      return NextResponse.json({ error: 'Transcription failed: ' + err.message }, { status: 500 });
    }

    if (!transcript.trim()) {
      return NextResponse.json({ error: 'No speech detected in the recording' }, { status: 422 });
    }

    // Step 2: Assess
    let assessment: { score: number; strengths: string[]; improvements: string[]; summary: string };
    try {
      assessment = await assessTranscript(transcript);
    } catch (err: any) {
      console.error('Assessment error:', err);
      return NextResponse.json({ error: 'Assessment failed: ' + err.message }, { status: 500 });
    }

    // Step 3: Estimate duration from file size (rough: ~1 MB/min for MP3)
    const durationMs = Math.round((file.size / (128 * 1024)) * 60 * 1000);
    const startedAt = new Date();
    const endedAt = new Date(startedAt.getTime() + durationMs);

    // Step 4: Save to DB
    const supabase = createServiceRoleClient();
    const { data, error } = await (supabase as any)
      .from('training_sessions')
      .insert({
        user_id: USER_ID,
        organization_id: ORG_ID,
        transcript: transcript,
        assessment: assessment as any,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        source: 'field_recording',
        original_filename: file.name,
      } as any)
      .select()
      .single();

    if (error) {
      console.error('DB insert error:', error);
      // If source column doesn't exist yet, retry without it
      if (error.code === '42703') {
        const { data: data2, error: error2 } = await (supabase as any)
          .from('training_sessions')
          .insert({
            user_id: USER_ID,
            organization_id: ORG_ID,
            transcript: transcript,
            assessment: assessment as any,
            started_at: startedAt.toISOString(),
            ended_at: endedAt.toISOString(),
          })
          .select()
          .single();
        if (error2) return NextResponse.json({ error: 'Failed to save session: ' + error2.message }, { status: 500 });
        return NextResponse.json({ session: data2, assessment, transcript });
      }
      return NextResponse.json({ error: 'Failed to save session: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ session: data, assessment, transcript });
  } catch (err: any) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}
