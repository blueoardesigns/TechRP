// web/__tests__/plans.test.ts
import { describe, it, expect } from 'vitest'
import {
  getCompanyPlanId,
  getPerUserCap,
  getAddonPriceKey,
  getPlanMinutes,
  TRIAL_DAYS,
  TRIAL_MINUTES,
} from '../lib/plans'

describe('getCompanyPlanId', () => {
  it('returns t1 for 2 seats', () => expect(getCompanyPlanId('std', 2)).toBe('co_std_t1'))
  it('returns t1 for 4 seats', () => expect(getCompanyPlanId('std', 4)).toBe('co_std_t1'))
  it('returns t2 for 5 seats', () => expect(getCompanyPlanId('pro', 5)).toBe('co_pro_t2'))
  it('returns t2 for 19 seats', () => expect(getCompanyPlanId('pro', 19)).toBe('co_pro_t2'))
  it('returns t3 for 20 seats', () => expect(getCompanyPlanId('std', 20)).toBe('co_std_t3'))
  it('returns t4 for 50 seats', () => expect(getCompanyPlanId('pro', 50)).toBe('co_pro_t4'))
  it('returns t4 for 100 seats', () => expect(getCompanyPlanId('std', 100)).toBe('co_std_t4'))
})

describe('getPlanMinutes', () => {
  it('returns 120 for individual_starter', () => expect(getPlanMinutes('individual_starter')).toBe(120))
  it('returns 240 for individual_growth', () => expect(getPlanMinutes('individual_growth')).toBe(240))
  it('returns 400 for individual_pro', () => expect(getPlanMinutes('individual_pro')).toBe(400))
  it('returns 120 for co_std_t1', () => expect(getPlanMinutes('co_std_t1')).toBe(120))
  it('returns 240 for co_pro_t1', () => expect(getPlanMinutes('co_pro_t1')).toBe(240))
})

describe('getPerUserCap', () => {
  it('returns 180 for standard plan (120 * 1.5)', () => expect(getPerUserCap('co_std_t1')).toBe(180))
  it('returns 360 for pro plan (240 * 1.5)', () => expect(getPerUserCap('co_pro_t1')).toBe(360))
})

describe('getAddonPriceKey', () => {
  it('maps individual_starter', () => expect(getAddonPriceKey('individual_starter')).toBe('addon_hr_individual_starter'))
  it('maps co_std_t2', () => expect(getAddonPriceKey('co_std_t2')).toBe('addon_hr_co_t2'))
  it('maps co_pro_t3', () => expect(getAddonPriceKey('co_pro_t3')).toBe('addon_hr_co_t3'))
})

describe('constants', () => {
  it('TRIAL_DAYS is 7', () => expect(TRIAL_DAYS).toBe(7))
  it('TRIAL_MINUTES is 25', () => expect(TRIAL_MINUTES).toBe(25))
})
