import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Recordings live in our own R2 bucket (Vapi custom storage). Vapi's redirect
// endpoint hands back an *unsigned* R2 URL, which the browser cannot read, so
// this route presigns the object itself. That makes it the sole access-control
// boundary for recording audio — hence the ownership tests below.

const mockRequireUser = vi.fn()
const mockCanAccessOwned = vi.fn()
const mockGetSignedUrl = vi.fn()

vi.mock('@/lib/api-auth', () => ({
  requireUser: (...a: unknown[]) => mockRequireUser(...a),
  canAccessOwned: (...a: unknown[]) => mockCanAccessOwned(...a),
}))
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...a: unknown[]) => mockGetSignedUrl(...a),
}))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { constructor(public cfg: unknown) {} },
  GetObjectCommand: class { constructor(public input: { Bucket: string; Key: string }) {} },
}))

const { POST } = await import('../app/api/recording/route')

const SIGNED = 'https://acct.r2.cloudflarestorage.com/abc-mono.wav?X-Amz-Signature=deadbeef'
const R2_URL = 'https://acct.r2.cloudflarestorage.com/019f-1786-92c3-mono.wav'
const SESSION = { vapi_call_id: 'call-123', user_id: 'owner-1', organization_id: 'org-1' }

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/recording', {
    method: 'POST', headers, body: JSON.stringify(body),
  }) as any
}

function serviceReturning(row: unknown, error: unknown = null) {
  return { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error }) }) }) }) }
}

let fetchMock: ReturnType<typeof vi.fn>

function vapiCallOk(recording: unknown) {
  return new Response(JSON.stringify({ artifact: { recording } }), {
    status: 200, headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  process.env.VAPI_API_KEY = 'test-key'
  process.env.R2_ACCOUNT_ID = 'acct'
  process.env.R2_ACCESS_KEY_ID = 'ak'
  process.env.R2_SECRET_ACCESS_KEY = 'sk'
  process.env.R2_BUCKET = 'techrp'
  fetchMock = vi.fn().mockResolvedValue(vapiCallOk({ mono: { combinedUrl: R2_URL } }))
  vi.stubGlobal('fetch', fetchMock)
  mockGetSignedUrl.mockResolvedValue(SIGNED)
  mockRequireUser.mockResolvedValue({
    ok: true,
    user: { profileId: 'owner-1', appRole: 'individual', organizationId: 'org-1' },
    service: serviceReturning(SESSION),
  })
  mockCanAccessOwned.mockReturnValue(true)
})

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('POST /api/recording', () => {
  it('returns a presigned R2 URL for the session recording', async () => {
    const res = await POST(req({ sessionId: 'sess-1' }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ recordingUrl: SIGNED })
  })

  it('signs the exact object key from the call artifact', async () => {
    // A bare Vapi redirect URL is unreadable by the browser (R2 needs SigV4),
    // so the key must reach the presigner intact or playback returns XML.
    await POST(req({ sessionId: 'sess-1' }))
    const cmd = mockGetSignedUrl.mock.calls[0][1]
    expect(cmd.input).toEqual({ Bucket: 'techrp', Key: '019f-1786-92c3-mono.wav' })
  })

  it('strips a leading bucket segment from the object key', async () => {
    fetchMock.mockResolvedValue(vapiCallOk({ mono: { combinedUrl: 'https://acct.r2.cloudflarestorage.com/techrp/nested-mono.wav' } }))
    await POST(req({ sessionId: 'sess-1' }))
    expect(mockGetSignedUrl.mock.calls[0][1].input.Key).toBe('nested-mono.wav')
  })

  it('uses the call id from the session row, not one supplied by the caller', async () => {
    await POST(req({ sessionId: 'sess-1', callId: 'someone-elses-call' }))
    expect(fetchMock.mock.calls[0][0]).toContain('call-123')
    expect(fetchMock.mock.calls[0][0]).not.toContain('someone-elses-call')
  })

  it('refuses a session the caller does not have access to', async () => {
    mockCanAccessOwned.mockReturnValue(false)
    const res = await POST(req({ sessionId: 'sess-1' }))
    expect(res.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockGetSignedUrl).not.toHaveBeenCalled()
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

  it('forwards a mobile Bearer token to the auth layer', async () => {
    await POST(req({ sessionId: 'sess-1' }, { authorization: 'Bearer mobile-token' }))
    expect(mockRequireUser).toHaveBeenCalledWith({ bearerToken: 'mobile-token' })
  })

  it('falls back to cookie auth when no Bearer header is present', async () => {
    await POST(req({ sessionId: 'sess-1' }))
    expect(mockRequireUser).toHaveBeenCalledWith({ bearerToken: null })
  })

  it('404s when the session does not exist', async () => {
    mockRequireUser.mockResolvedValue({ ok: true, user: { profileId: 'owner-1' }, service: serviceReturning(null) })
    const res = await POST(req({ sessionId: 'missing' }))
    expect(res.status).toBe(404)
  })

  it('404s when the session has no associated call', async () => {
    mockRequireUser.mockResolvedValue({
      ok: true, user: { profileId: 'owner-1' },
      service: serviceReturning({ ...SESSION, vapi_call_id: null }),
    })
    const res = await POST(req({ sessionId: 'sess-1' }))
    expect(res.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('404s while the recording is still uploading', async () => {
    // Vapi returns an empty artifact until the upload to R2 finishes.
    fetchMock.mockResolvedValue(vapiCallOk({ mono: {} }))
    const res = await POST(req({ sessionId: 'sess-1' }))
    expect(res.status).toBe(404)
    expect(mockGetSignedUrl).not.toHaveBeenCalled()
  })

  it('500s rather than signing with missing storage credentials', async () => {
    delete process.env.R2_SECRET_ACCESS_KEY
    const res = await POST(req({ sessionId: 'sess-1' }))
    expect(res.status).toBe(500)
    expect(mockGetSignedUrl).not.toHaveBeenCalled()
  })

  it('rejects a request with no sessionId', async () => {
    const res = await POST(req({}))
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
