import { type PlanId, type AddonPriceKey } from './plans'

// Populated by running POST /api/stripe/seed once after deploy.
// Copy the returned priceIds object here.
export const STRIPE_PRICE_IDS: Partial<Record<PlanId | AddonPriceKey, string>> = {
  individual_starter:          'price_1TMzu4C19S7odKA8NqXYynsW',
  individual_growth:           'price_1TMzu5C19S7odKA8namaQ8yO',
  individual_pro:              'price_1TMzu5C19S7odKA8db1BKRwK',
  co_std_t1:                   'price_1TMzu7C19S7odKA8TmCFDxf8',
  co_std_t2:                   'price_1TMzu7C19S7odKA8CoTOKCch',
  co_std_t3:                   'price_1TMzu8C19S7odKA8H93bejdK',
  co_std_t4:                   'price_1TMzu8C19S7odKA8OT4SxjAn',
  co_pro_t1:                   'price_1TMzu9C19S7odKA8uVHGUPh8',
  co_pro_t2:                   'price_1TMzuAC19S7odKA8APIkmIlK',
  co_pro_t3:                   'price_1TMzuAC19S7odKA8FFsErBTZ',
  co_pro_t4:                   'price_1TMzuBC19S7odKA8gOssNo7L',
  addon_hr_individual_starter: 'price_1TMzuCC19S7odKA8CD3YR07u',
  addon_hr_individual_growth:  'price_1TMzuDC19S7odKA8qneH4ch3',
  addon_hr_individual_pro:     'price_1TMzuEC19S7odKA8nhyVhMk4',
  addon_hr_co_t1:              'price_1TMzuEC19S7odKA8uqea6WQM',
  addon_hr_co_t2:              'price_1TMzuEC19S7odKA8WKlBE2D7',
  addon_hr_co_t3:              'price_1TMzuFC19S7odKA8GsGZYLXC',
  addon_hr_co_t4:              'price_1TMzuFC19S7odKA86TphqvNx',
}

export function getPriceId(planKey: PlanId | AddonPriceKey): string {
  const id = STRIPE_PRICE_IDS[planKey]
  if (!id) throw new Error(`No Stripe price ID found for plan key: ${planKey}`)
  return id
}
