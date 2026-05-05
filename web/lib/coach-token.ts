import { createHmac, timingSafeEqual } from 'crypto'

const SECRET = process.env.COACH_INVITE_SECRET
if (!SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('COACH_INVITE_SECRET is required in production')
}
const RESOLVED_SECRET = SECRET ?? 'change-me-dev-only'

/** Hard caps enforced at sign + verify time. Use Stripe directly for anything larger. */
export const MAX_DISCOUNT_PERCENTAGE = 50
export const MAX_AFFILIATE_PERCENTAGE = 50

export type CoachTokenPayload = {
  coachId: string
  type: 'discount' | 'affiliate'
  percentage: number
  issuedAt: number
}

function isValidPayload(p: CoachTokenPayload | null | undefined): p is CoachTokenPayload {
  if (!p) return false
  if (typeof p.coachId !== 'string' || !p.coachId) return false
  if (p.type !== 'discount' && p.type !== 'affiliate') return false
  if (typeof p.percentage !== 'number' || !Number.isFinite(p.percentage)) return false
  if (typeof p.issuedAt !== 'number' || !Number.isFinite(p.issuedAt)) return false
  if (p.percentage <= 0) return false
  const cap = p.type === 'discount' ? MAX_DISCOUNT_PERCENTAGE : MAX_AFFILIATE_PERCENTAGE
  if (p.percentage > cap) return false
  return true
}

export function signCoachToken(payload: CoachTokenPayload): string {
  if (!isValidPayload(payload)) {
    throw new Error('Invalid coach token payload')
  }
  const data = JSON.stringify(payload)
  const encoded = Buffer.from(data).toString('base64url')
  const sig = createHmac('sha256', RESOLVED_SECRET).update(encoded).digest('base64url')
  return `${encoded}.${sig}`
}

export function verifyCoachToken(token: string): CoachTokenPayload | null {
  try {
    const [encoded, sig] = token.split('.')
    if (!encoded || !sig) return null
    const expected = createHmac('sha256', RESOLVED_SECRET).update(encoded).digest('base64url')
    // Constant-time comparison
    const sigBuf = Buffer.from(sig)
    const expectedBuf = Buffer.from(expected)
    if (sigBuf.length !== expectedBuf.length) return null
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as CoachTokenPayload
    if (!isValidPayload(payload)) return null
    // Tokens expire after 30 days
    if (Date.now() - payload.issuedAt > 30 * 24 * 60 * 60 * 1000) return null
    return payload
  } catch {
    return null
  }
}
