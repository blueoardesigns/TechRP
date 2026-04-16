export const TRIAL_DAYS = 7
export const TRIAL_MINUTES = 25

export const PLAN_MINUTES: Record<string, number> = {
  individual_starter: 120,
  individual_growth:  240,
  individual_pro:     400,
  co_std_t1: 120, co_std_t2: 120, co_std_t3: 120, co_std_t4: 120,
  co_pro_t1: 240, co_pro_t2: 240, co_pro_t3: 240, co_pro_t4: 240,
}

export const PLAN_PRICE_CENTS: Record<string, number> = {
  individual_starter: 3499,
  individual_growth:  5799,
  individual_pro:     8999,
  co_std_t1: 2799, co_std_t2: 2499, co_std_t3: 2199, co_std_t4: 1899,
  co_pro_t1: 4499, co_pro_t2: 4299, co_pro_t3: 3999, co_pro_t4: 3499,
}

export const ADDON_PRICE_CENTS: Record<string, number> = {
  addon_hr_individual_starter: 1499,
  addon_hr_individual_growth:  1299,
  addon_hr_individual_pro:     1099,
  addon_hr_co_t1: 1099,
  addon_hr_co_t2:  999,
  addon_hr_co_t3:  899,
  addon_hr_co_t4:  849,
}

export const PLAN_LABEL: Record<string, string> = {
  individual_starter: 'Individual Starter',
  individual_growth:  'Individual Growth',
  individual_pro:     'Individual Pro',
  co_std_t1: 'Company Standard (2–4)',
  co_std_t2: 'Company Standard (5–19)',
  co_std_t3: 'Company Standard (20–49)',
  co_std_t4: 'Company Standard (50+)',
  co_pro_t1: 'Company Pro (2–4)',
  co_pro_t2: 'Company Pro (5–19)',
  co_pro_t3: 'Company Pro (20–49)',
  co_pro_t4: 'Company Pro (50+)',
}

export function getPlanMinutes(planId: string): number {
  return PLAN_MINUTES[planId] ?? 0
}

export function getPerUserCap(planId: string): number {
  return Math.floor(getPlanMinutes(planId) * 1.5)
}

export function getCompanyPlanId(tier: 'std' | 'pro', seats: number): string {
  const t = seats >= 50 ? 't4' : seats >= 20 ? 't3' : seats >= 5 ? 't2' : 't1'
  return `co_${tier}_${t}`
}

export function getAddonPriceKey(planId: string): string {
  if (planId.startsWith('individual_')) return `addon_hr_${planId}`
  const tier = planId.match(/_(t[1-4])$/)?.[1] ?? 't1'
  return `addon_hr_co_${tier}`
}

export function isCompanyPlan(planId: string): boolean {
  return planId.startsWith('co_')
}

export function isIndividualPlan(planId: string): boolean {
  return planId.startsWith('individual_')
}

export type PlanId =
  | 'individual_starter' | 'individual_growth' | 'individual_pro'
  | 'co_std_t1' | 'co_std_t2' | 'co_std_t3' | 'co_std_t4'
  | 'co_pro_t1' | 'co_pro_t2' | 'co_pro_t3' | 'co_pro_t4'

export type AddonPriceKey =
  | 'addon_hr_individual_starter' | 'addon_hr_individual_growth' | 'addon_hr_individual_pro'
  | 'addon_hr_co_t1' | 'addon_hr_co_t2' | 'addon_hr_co_t3' | 'addon_hr_co_t4'
