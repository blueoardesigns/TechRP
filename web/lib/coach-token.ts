import { createHmac } from 'crypto'

const SECRET = process.env.COACH_INVITE_SECRET ?? 'change-me'

export type CoachTokenPayload = {
  coachId: string
  type: 'discount' | 'affiliate'
  percentage: number
  issuedAt: number
}

export function signCoachToken(payload: CoachTokenPayload): string {
  const data = JSON.stringify(payload)
  const encoded = Buffer.from(data).toString('base64url')
  const sig = createHmac('sha256', SECRET).update(encoded).digest('base64url')
  return `${encoded}.${sig}`
}

export function verifyCoachToken(token: string): CoachTokenPayload | null {
  try {
    const [encoded, sig] = token.split('.')
    if (!encoded || !sig) return null
    const expected = createHmac('sha256', SECRET).update(encoded).digest('base64url')
    if (sig !== expected) return null
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as CoachTokenPayload
    // Tokens expire after 30 days
    if (Date.now() - payload.issuedAt > 30 * 24 * 60 * 60 * 1000) return null
    return payload
  } catch {
    return null
  }
}
