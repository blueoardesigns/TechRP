import { NextRequest, NextResponse } from 'next/server';
import { requireUser, canAccessOwned } from '@/lib/api-auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user, service } = auth;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const recordingUrl = body && typeof body.recording_url === 'string' ? body.recording_url : null;
  if (!recordingUrl) {
    return NextResponse.json({ error: 'recording_url required' }, { status: 400 });
  }

  // Disallow non-https URLs to limit phishing/SSRF surface. (Storage signed
  // URLs from Supabase / Vapi are always https.)
  try {
    const u = new URL(recordingUrl);
    if (u.protocol !== 'https:') {
      return NextResponse.json({ error: 'recording_url must be https' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'recording_url is not a valid URL' }, { status: 400 });
  }

  // Verify ownership
  const { data: existing, error: loadErr } = await (service as any)
    .from('training_sessions')
    .select('user_id, organization_id')
    .eq('id', params.id)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canAccessOwned(user, existing.user_id, existing.organization_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await (service as any)
    .from('training_sessions')
    .update({ recording_url: recordingUrl })
    .eq('id', params.id);

  return NextResponse.json({ ok: true });
}
