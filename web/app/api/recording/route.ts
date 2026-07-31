import { NextRequest, NextResponse } from 'next/server';
import { requireUser, canAccessOwned } from '@/lib/api-auth';

interface RecordingRequest {
  sessionId: string;
}

/**
 * Resolve a playable recording URL for a training session.
 *
 * Takes a session id (never a raw Vapi call id): the call id is read from the
 * session row only after the caller's access to that session is verified.
 * Accepting a caller-supplied call id would let any authenticated user mint a
 * recording URL for any call, including other organizations'.
 */
export async function POST(request: NextRequest) {
  try {
    // Reachable from mobile (no cookies), so accept a Bearer token too. This
    // route is in the middleware PUBLIC_PREFIXES and enforces auth itself.
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const auth = await requireUser({ bearerToken });
    if (!auth.ok) return auth.response;
    const { user, service } = auth;

    const body = await request.json().catch(() => null) as RecordingRequest | null;
    const sessionId = body && typeof body.sessionId === 'string' ? body.sessionId : null;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!process.env.VAPI_API_KEY) {
      return NextResponse.json(
        { error: 'VAPI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const { data: session, error: loadErr } = await service
      .from('training_sessions')
      .select('vapi_call_id, user_id, organization_id')
      .eq('id', sessionId)
      .maybeSingle();

    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canAccessOwned(user, session.user_id, session.organization_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!session.vapi_call_id) {
      return NextResponse.json({ error: 'Session has no recording' }, { status: 404 });
    }

    // Vapi requires authenticated access to recordings as of Jul 2026: the old
    // public recordingUrl field no longer resolves, so we hit the auth'd
    // redirect endpoint and hand back the short-lived signed URL it 302s to.
    const response = await fetch(`https://api.vapi.ai/call/${session.vapi_call_id}/mono-recording`, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      },
    });

    if (response.status !== 302 && response.status !== 301) {
      console.error('Vapi recording redirect error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch recording from Vapi API' },
        { status: response.status === 0 ? 502 : response.status }
      );
    }

    const recordingUrl = response.headers.get('location');

    return NextResponse.json({ recordingUrl });
  } catch (error) {
    console.error('Error fetching recording:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recording' },
      { status: 500 }
    );
  }
}
