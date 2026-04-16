import { describe, it, expect } from 'vitest'
import { checkMinuteGate, type MinuteGateInput } from '../lib/minute-gate'

const base: MinuteGateInput = {
  role: 'individual',
  subscriptionStatus: 'active',
  trialEndsAt: null,
  minutesUsed: 0,
  bonusMinutes: 0,
  planId: 'individual_growth',   // 240 min
  orgMinutesPool: null,
  orgBonusMinutes: null,
  perUserCap: null,
}

describe('checkMinuteGate', () => {
  it('allows superuser unconditionally', () => {
    const result = checkMinuteGate({ ...base, role: 'superuser', subscriptionStatus: 'canceled' })
    expect(result.allowed).toBe(true)
  })

  it('blocks canceled subscription', () => {
    const result = checkMinuteGate({ ...base, subscriptionStatus: 'canceled' })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('subscription_inactive')
  })

  it('blocks past_due subscription', () => {
    const result = checkMinuteGate({ ...base, subscriptionStatus: 'past_due' })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('subscription_past_due')
  })

  it('blocks expired trial', () => {
    const pastDate = new Date(Date.now() - 1000).toISOString()
    const result = checkMinuteGate({ ...base, subscriptionStatus: 'trialing', trialEndsAt: pastDate })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('trial_expired')
  })

  it('allows active trial within date and minutes', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString()
    const result = checkMinuteGate({ ...base, subscriptionStatus: 'trialing', trialEndsAt: futureDate, minutesUsed: 10 })
    expect(result.allowed).toBe(true)
  })

  it('blocks individual with no minutes remaining', () => {
    const result = checkMinuteGate({ ...base, minutesUsed: 240, bonusMinutes: 0 })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('minutes_exhausted')
    expect(result.minutesRemaining).toBe(0)
  })

  it('allows individual with bonus minutes remaining', () => {
    const result = checkMinuteGate({ ...base, minutesUsed: 240, bonusMinutes: 60 })
    expect(result.allowed).toBe(true)
    expect(result.minutesRemaining).toBe(60)
  })

  it('allows individual with plan minutes partially used', () => {
    const result = checkMinuteGate({ ...base, minutesUsed: 100 })
    expect(result.allowed).toBe(true)
    expect(result.minutesRemaining).toBe(140)
  })

  it('blocks company user when org pool is empty', () => {
    const result = checkMinuteGate({
      ...base,
      role: 'company_admin',
      planId: 'co_pro_t1',
      orgMinutesPool: 0,
      orgBonusMinutes: 0,
      perUserCap: 360,
      minutesUsed: 0,
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('minutes_exhausted')
  })

  it('blocks company user at per-user cap even with pool remaining', () => {
    const result = checkMinuteGate({
      ...base,
      role: 'company_admin',
      planId: 'co_pro_t1',
      orgMinutesPool: 1000,
      orgBonusMinutes: 0,
      perUserCap: 360,
      minutesUsed: 360,
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('user_cap_reached')
  })

  it('allows company user with pool and under cap', () => {
    const result = checkMinuteGate({
      ...base,
      role: 'company_admin',
      planId: 'co_pro_t1',
      orgMinutesPool: 500,
      orgBonusMinutes: 0,
      perUserCap: 360,
      minutesUsed: 100,
    })
    expect(result.allowed).toBe(true)
    expect(result.minutesRemaining).toBe(260) // min(cap_remaining=260, pool=500)
  })
})
