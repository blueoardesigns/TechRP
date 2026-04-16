import { type PlanId, type AddonPriceKey } from './plans'

// Populated by running POST /api/stripe/seed once after deploy.
// Copy the returned priceIds object here.
export const STRIPE_PRICE_IDS: Partial<Record<PlanId | AddonPriceKey, string>> = {
  // individual_starter: 'price_...',
  // individual_growth:  'price_...',
  // individual_pro:     'price_...',
  // co_std_t1: 'price_...', co_std_t2: 'price_...', co_std_t3: 'price_...', co_std_t4: 'price_...',
  // co_pro_t1: 'price_...', co_pro_t2: 'price_...', co_pro_t3: 'price_...', co_pro_t4: 'price_...',
  // addon_hr_individual_starter: 'price_...',
  // addon_hr_individual_growth:  'price_...',
  // addon_hr_individual_pro:     'price_...',
  // addon_hr_co_t1: 'price_...', addon_hr_co_t2: 'price_...', addon_hr_co_t3: 'price_...', addon_hr_co_t4: 'price_...',
}

export function getPriceId(planKey: PlanId | AddonPriceKey): string {
  const id = STRIPE_PRICE_IDS[planKey]
  if (!id) throw new Error(`No Stripe price ID found for plan key: ${planKey}`)
  return id
}
