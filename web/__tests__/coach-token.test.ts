import { describe, it, expect } from 'vitest'
import { signCoachToken, verifyCoachToken, MAX_DISCOUNT_PERCENTAGE } from '../lib/coach-token'

describe('coach-token', () => {
  it('round-trips a valid discount token', () => {
    const t = signCoachToken({ coachId: 'c1', type: 'discount', percentage: 20, issuedAt: Date.now() })
    const v = verifyCoachToken(t)
    expect(v).not.toBeNull()
    expect(v?.percentage).toBe(20)
    expect(v?.coachId).toBe('c1')
  })

  it('rejects percentage above cap on signing', () => {
    expect(() =>
      signCoachToken({ coachId: 'c1', type: 'discount', percentage: 99, issuedAt: Date.now() })
    ).toThrow()
  })

  it('rejects percentage of zero', () => {
    expect(() =>
      signCoachToken({ coachId: 'c1', type: 'discount', percentage: 0, issuedAt: Date.now() })
    ).toThrow()
  })

  it('rejects negative percentage', () => {
    expect(() =>
      signCoachToken({ coachId: 'c1', type: 'discount', percentage: -10, issuedAt: Date.now() })
    ).toThrow()
  })

  it('rejects token with tampered signature', () => {
    const t = signCoachToken({ coachId: 'c1', type: 'discount', percentage: 20, issuedAt: Date.now() })
    const [enc] = t.split('.')
    const tampered = enc + '.AAAAA'
    expect(verifyCoachToken(tampered)).toBeNull()
  })

  it('rejects token whose payload exceeds cap (defense-in-depth)', () => {
    // Hand-craft a token with percentage > cap, signed correctly. verifyCoachToken
    // should still reject it because verify also runs isValidPayload.
    const { createHmac } = require('crypto') as typeof import('crypto')
    const SECRET = process.env.COACH_INVITE_SECRET ?? 'change-me-dev-only'
    const payload = JSON.stringify({ coachId: 'c1', type: 'discount', percentage: 99, issuedAt: Date.now() })
    const encoded = Buffer.from(payload).toString('base64url')
    const sig = createHmac('sha256', SECRET).update(encoded).digest('base64url')
    expect(verifyCoachToken(`${encoded}.${sig}`)).toBeNull()
  })

  it('rejects expired tokens', () => {
    const t = signCoachToken({
      coachId: 'c1',
      type: 'discount',
      percentage: 20,
      issuedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
    })
    expect(verifyCoachToken(t)).toBeNull()
  })

  it('caps enforced for affiliate tokens too', () => {
    expect(() =>
      signCoachToken({ coachId: 'c1', type: 'affiliate', percentage: MAX_DISCOUNT_PERCENTAGE + 1, issuedAt: Date.now() })
    ).toThrow()
  })
})
