import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { PLAN_PRICE_CENTS, ADDON_PRICE_CENTS, PLAN_LABEL } from '@/lib/plans'

// Helper: get or create a product by metadata seed_key
async function getOrCreateProduct(
  seedKey: string,
  name: string,
  description: string,
): Promise<string> {
  const existing = await stripe.products.search({
    query: `metadata['seed_key']:'${seedKey}'`,
    limit: 1,
  })
  if (existing.data.length > 0) return existing.data[0].id

  const product = await stripe.products.create({
    name,
    description,
    metadata: { seed_key: seedKey },
  })
  return product.id
}

// Helper: get or create a price by lookup_key
async function getOrCreatePrice(params: {
  lookupKey: string
  productId: string
  unitAmount: number
  currency: string
  recurring?: { interval: 'month' | 'year' }
  metadata: Record<string, string>
}): Promise<string> {
  const existing = await stripe.prices.list({
    lookup_keys: [params.lookupKey],
    limit: 1,
  })
  if (existing.data.length > 0) return existing.data[0].id

  const price = await stripe.prices.create({
    product: params.productId,
    unit_amount: params.unitAmount,
    currency: params.currency,
    ...(params.recurring ? { recurring: params.recurring } : {}),
    lookup_key: params.lookupKey,
    transfer_lookup_key: true,
    metadata: params.metadata,
  })
  return price.id
}

// POST /api/stripe/seed
// Creates all Stripe products and prices. Safe to re-run (idempotent via lookup_key + seed_key metadata).
// Returns { priceIds } — copy into web/lib/stripe-prices.ts
export async function POST(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET
  const auth = req.headers.get('authorization')
  // Block if ADMIN_SECRET not configured (endpoint should never be open in prod)
  if (!adminSecret || auth !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const priceIds: Record<string, string> = {}

  try {
    // ── Individual subscription prices ──────────────────────────────────────
    const individualProductId = await getOrCreateProduct(
      'techRP_individual',
      'TechRP Individual',
      'Voice AI sales training for individual technicians',
    )

    const individualPlans = ['individual_starter', 'individual_growth', 'individual_pro'] as const
    for (const planKey of individualPlans) {
      priceIds[planKey] = await getOrCreatePrice({
        lookupKey: planKey,
        productId: individualProductId,
        unitAmount: PLAN_PRICE_CENTS[planKey],
        currency: 'usd',
        recurring: { interval: 'month' },
        metadata: { plan_key: planKey, label: PLAN_LABEL[planKey] },
      })
    }

    // ── Company Standard subscription prices ────────────────────────────────
    const stdProductId = await getOrCreateProduct(
      'techRP_co_std',
      'TechRP Company Standard',
      '120 min/user/month — shared pool',
    )

    for (const t of ['t1', 't2', 't3', 't4'] as const) {
      const planKey = `co_std_${t}` as string
      priceIds[planKey] = await getOrCreatePrice({
        lookupKey: planKey,
        productId: stdProductId,
        unitAmount: PLAN_PRICE_CENTS[planKey],
        currency: 'usd',
        recurring: { interval: 'month' },
        metadata: { plan_key: planKey, label: PLAN_LABEL[planKey] },
      })
    }

    // ── Company Pro subscription prices ─────────────────────────────────────
    const proProductId = await getOrCreateProduct(
      'techRP_co_pro',
      'TechRP Company Pro',
      '240 min/user/month — shared pool',
    )

    for (const t of ['t1', 't2', 't3', 't4'] as const) {
      const planKey = `co_pro_${t}` as string
      priceIds[planKey] = await getOrCreatePrice({
        lookupKey: planKey,
        productId: proProductId,
        unitAmount: PLAN_PRICE_CENTS[planKey],
        currency: 'usd',
        recurring: { interval: 'month' },
        metadata: { plan_key: planKey, label: PLAN_LABEL[planKey] },
      })
    }

    // ── Add-on hour one-time prices ─────────────────────────────────────────
    // Note: no label in metadata — PLAN_LABEL doesn't include addon keys by design
    const addonProductId = await getOrCreateProduct(
      'techRP_addon_hr',
      'TechRP Add-on Hour',
      '60 extra training minutes — never expire',
    )

    const addonKeys = [
      'addon_hr_individual_starter',
      'addon_hr_individual_growth',
      'addon_hr_individual_pro',
      'addon_hr_co_t1',
      'addon_hr_co_t2',
      'addon_hr_co_t3',
      'addon_hr_co_t4',
    ] as const

    for (const addonKey of addonKeys) {
      priceIds[addonKey] = await getOrCreatePrice({
        lookupKey: addonKey,
        productId: addonProductId,
        unitAmount: ADDON_PRICE_CENTS[addonKey],
        currency: 'usd',
        metadata: { addon_key: addonKey },
      })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Stripe seed failed:', message)
    return NextResponse.json(
      { error: 'Seed failed', details: message, partialPriceIds: priceIds },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    message: 'Copy priceIds into web/lib/stripe-prices.ts',
    priceIds,
  })
}
