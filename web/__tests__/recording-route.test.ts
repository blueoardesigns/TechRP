import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Vapi stopped serving recordings from public URLs in Jul 2026; the authed
// endpoint 302s to a short-lived signed URL. Because that URL is now the only
// way to reach the audio, this route is the access-control boundary for
// recordings — hence the ownership tests below.

const mockRequireUser = vi.fn()
const mockCanAccessOwned = vi.fn()

vi.mock('@/lib/api-auth', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  canAccessOwned: (...args: unknown[]) => mockCanAccessOwned(...args),
}))

const { POST } = await import('../app/api/recording/route')

const SIGNED = 'https://storage.vapi.ai/signed/abc.wav?token=xyz'
const SESSION = { vapi_call_id: 'call-123', user_id: 'owner-1', organization_id: 'org-1' }

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/recording', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }) as any
}

/** Minimal stub of the service-role query chain used by the route. */
function serviceReturning(row: unknown, error: unknown = null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: row, error }) }),
      }),
    }),
  }
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  process.env.VAPI_API_KEY = 'test-key'
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  mockRequireUser.mockResolvedValue({
    ok: true,
    user: { profileId: 'owner-1', appRole: 'individual', organizationId: 'org-1' },
    service: serviceReturning(SESSION),
  })
  mockCanAccessOwned.mockReturnValue(true)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('POST /api/recording', () => {
  it('returns the signed URL from the redirect Location header', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { location: SIGNED } }))

    const res = await POST(req({ sessionId: 'sess-1' }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ recordingUrl: SIGNED })
  })

  it('requests the authenticated endpoint without following the redirect', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { location: SIGNED } }))

    await POST(req({ sessionId: 'sess-1' }))

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.vapi.ai/call/call-123/mono-recording')
    expect(init.redirect).toBe('manual')
    expect(init.headers.Authorization).toBe('Bearer test-key')
  })

  it('uses the call id from the session row, not one supplied by the caller', async () => {
    // A caller-supplied callId must never reach Vapi — that was the IDOR.
    fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { location: SIGNED } }))

    await POST(req({ sessionId: 'sess-1', callId: 'someone-elses-call' }))

    expect(fetchMock.mock.calls[0][0]).toContain('call-123')
    expect(fetchMock.mock.calls[0][0]).not.toContain('someone-elses-call')
  })

  it('refuses a session the caller does not have access to', async () => {
    mockCanAccessOwned.mockReturnValue(false)

    const res = await POST(req({ sessionId: 'sess-1' }))

    expect(res.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('propagates the auth failure response for an unauthenticated caller', async () => {
    mockRequireUser.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const res = await POST(req({ sessionId: 'sess-1' }))

    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('404s when the session does not exist', async () => {
    mockRequireUser.mockResolvedValue({
      ok: true,
      user: { profileId: 'owner-1' },
      service: serviceReturning(null),
    })

    const res = await POST(req({ sessionId: 'missing' }))

    expect(res.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('404s when the session has no associated call', async () => {
    mockRequireUser.mockResolvedValue({
      ok: true,
      user: { profileId: 'owner-1' },
      service: serviceReturning({ ...SESSION, vapi_call_id: null }),
    })

    const res = await POST(req({ sessionId: 'sess-1' }))

    expect(res.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces an error when Vapi rejects the request instead of redirecting', async () => {
    // e.g. 401 (bad key) or 400 (call outside the retention window)
    fetchMock.mockResolvedValue(new Response('nope', { status: 401 }))

    const res = await POST(req({ sessionId: 'sess-1' }))

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toHaveProperty('error')
  })

  it('forwards a mobile Bearer token to the auth layer', async () => {
    // Mobile has no cookies, so the token is the only proof of identity; if it
    // is dropped the app silently loses recording playback.
    fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { location: SIGNED } }))

    await POST(req({ sessionId: 'sess-1' }, { authorization: 'Bearer mobile-token' }))

    expect(mockRequireUser).toHaveBeenCalledWith({ bearerToken: 'mobile-token' })
  })

  it('falls back to cookie auth when no Bearer header is present', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { location: SIGNED } }))

    await POST(req({ sessionId: 'sess-1' }))

    expect(mockRequireUser).toHaveBeenCalledWith({ bearerToken: null })
  })

  it('rejects a request with no sessionId', async () => {
    const res = await POST(req({}))
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
