import { getPlanMinutes } from './plans'

export type MinuteGateInput = {
  role: string
  subscriptionStatus: string | null
  trialEndsAt: string | null
  minutesUsed: number
  bonusMinutes: number
  planId: string
  // Company-only — null for individual
  orgMinutesPool: number | null
  orgBonusMinutes: number | null
  perUserCap: number | null
}

export type MinuteGateResult = {
  allowed: boolean
  reason?: 'subscription_inactive' | 'subscription_past_due' | 'trial_expired' | 'minutes_exhausted' | 'user_cap_reached'
  minutesRemaining: number
}

export function checkMinuteGate(input: MinuteGateInput): MinuteGateResult {
  const {
    role, subscriptionStatus, trialEndsAt,
    minutesUsed, bonusMinutes, planId,
    orgMinutesPool, orgBonusMinutes, perUserCap,
  } = input

  // Superuser bypass
  if (role === 'superuser') {
    return { allowed: true, minutesRemaining: Infinity }
  }

  // Check subscription status
  if (subscriptionStatus === 'canceled' || subscriptionStatus === 'inactive') {
    return { allowed: false, reason: 'subscription_inactive', minutesRemaining: 0 }
  }
  if (subscriptionStatus === 'past_due') {
    return { allowed: false, reason: 'subscription_past_due', minutesRemaining: 0 }
  }

  // Check trial expiry
  if (subscriptionStatus === 'trialing' && trialEndsAt) {
    if (new Date() > new Date(trialEndsAt)) {
      return { allowed: false, reason: 'trial_expired', minutesRemaining: 0 }
    }
  }

  // Company minute check
  if (orgMinutesPool !== null) {
    const totalPool = orgMinutesPool + (orgBonusMinutes ?? 0)
    if (totalPool <= 0) {
      return { allowed: false, reason: 'minutes_exhausted', minutesRemaining: 0 }
    }
    if (perUserCap !== null && minutesUsed >= perUserCap) {
      return { allowed: false, reason: 'user_cap_reached', minutesRemaining: 0 }
    }
    const capRemaining = perUserCap !== null ? perUserCap - minutesUsed : totalPool
    const minutesRemaining = Math.min(capRemaining, totalPool)
    return { allowed: true, minutesRemaining }
  }

  // Individual minute check
  const planMinutes = getPlanMinutes(planId)
  const totalAllowance = planMinutes + bonusMinutes
  const remaining = totalAllowance - minutesUsed

  if (remaining <= 0) {
    return { allowed: false, reason: 'minutes_exhausted', minutesRemaining: 0 }
  }
  return { allowed: true, minutesRemaining: remaining }
}
