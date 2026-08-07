import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireUser, canAccessOwned } from '@/lib/api-auth';

interface RecordingRequest {
  sessionId: string;
}

/** Playback links are short-lived; long enough to start and scrub a long call. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Turn a Vapi-reported recording URL into an R2 object key.
 *
 * Vapi stores the object at the bucket root, so the key is just the path. Some
 * responses include the bucket as the first segment — strip it when present so
 * both shapes resolve to the same key.
 */
function objectKeyFromUrl(rawUrl: string, bucket: string): string | null {
  try {
    const { pathname } = new URL(rawUrl);
    const key = decodeURIComponent(pathname.replace(/^\/+/, ''));
    if (!key) return null;
    return key.startsWith(`${bucket}/`) ? key.slice(bucket.length + 1) : key;
  } catch {
    return null;
  }
}

/**
 * Resolve a playable recording URL for a training session.
 *
 * Takes a session id (never a raw Vapi call id): the call id is read from the
 * session row only after the caller's access to that session is verified.
 * Accepting a caller-supplied call id would let any authenticated user mint a
 * recording URL for any call, including other organizations'.
 *
 * Recordings live in our own R2 bucket (Vapi custom storage). Vapi's
 * /mono-recording endpoint redirects to an *unsigned* R2 URL, which the browser
 * cannot read — R2 requires SigV4 on every object read and returns an
 * InvalidArgument/Authorization XML error instead of audio. So we read the
 * object location from the call artifact and presign it ourselves.
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
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }
    if (!process.env.VAPI_API_KEY) {
      return NextResponse.json({ error: 'VAPI_API_KEY is not configured' }, { status: 500 });
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

    const callRes = await fetch(`https://api.vapi.ai/call/${session.vapi_call_id}`, {
      headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}` },
    });
    if (!callRes.ok) {
      console.error('Vapi call lookup failed:', callRes.status, callRes.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch recording from Vapi API' },
        { status: callRes.status },
      );
    }

    const call = await callRes.json();
    // Vapi populates these only once the recording has finished uploading.
    const recordingUrl: string | null =
      call?.artifact?.recording?.mono?.combinedUrl ?? call?.artifact?.recordingUrl ?? null;
    if (!recordingUrl) {
      return NextResponse.json({ error: 'Recording not available yet' }, { status: 404 });
    }

    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
      console.error('R2 storage env vars are not configured');
      return NextResponse.json({ error: 'Recording storage is not configured' }, { status: 500 });
    }

    const key = objectKeyFromUrl(recordingUrl, R2_BUCKET);
    if (!key) {
      return NextResponse.json({ error: 'Recording location is unreadable' }, { status: 502 });
    }

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });

    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );

    return NextResponse.json({ recordingUrl: signedUrl });
  } catch (error) {
    console.error('Error fetching recording:', error);
    return NextResponse.json({ error: 'Failed to fetch recording' }, { status: 500 });
  }
}
