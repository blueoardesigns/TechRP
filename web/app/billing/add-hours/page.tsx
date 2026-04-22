'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth-provider'
import { AppShell } from '@/components/app-shell'
import { ADDON_PRICE_CENTS, getAddonPriceKey } from '@/lib/plans'

export default function AddHoursPage() {
  const { user } = useAuth()
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(false)
  const [planId, setPlanId] = useState<string>('')

  useEffect(() => {
    if (!user) return
    fetch('/api/billing/summary?userId=' + user.id)
      .then(r => r.json())
      .then((d: { planId?: string }) => setPlanId(d.planId ?? ''))
  }, [user?.id])

  const addonKey = getAddonPriceKey(planId)
  const pricePerHour = planId ? (ADDON_PRICE_CENTS[addonKey] ?? 0) / 100 : 0
  const total = pricePerHour * qty

  async function handlePurchase() {
    if (!user || !planId) return
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planKey: addonKey,
          userId: user.id,
          orgId: (user as any).organizationId,
          mode: 'addon',
          addonQty: qty,
        }),
      })
      const { url } = await res.json() as { url?: string }
      if (url) window.location.href = url
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="max-w-md mx-auto">
        <a href="/billing" className="text-sm text-gray-400 hover:text-white mb-6 block">&#8592; Back to Billing</a>
        <h1 className="text-2xl font-bold mb-6">Add Training Hours</h1>

        <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-5">
          <p className="text-sm text-gray-400">Extra hours never expire and carry over each month.</p>

          <div>
            <label className="text-sm text-gray-400 block mb-2">
              Hours to add: <span className="text-white font-semibold">{qty} hour{qty !== 1 ? 's' : ''} ({qty * 60} minutes)</span>
            </label>
            <input
              type="range" min={1} max={20} value={qty}
              onChange={e => setQty(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>

          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex justify-between text-sm text-gray-400">
              <span>Price per hour</span>
              <span className="text-white">${pricePerHour.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-white mt-2">
              <span>Total</span>
              <span className="text-green-400">${total.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handlePurchase}
            disabled={loading || !planId}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? 'Redirecting...' : `Buy ${qty} hour${qty !== 1 ? 's' : ''} — $${total.toFixed(2)}`}
          </button>
          {!planId && (
            <p className="text-sm text-amber-400 text-center">
              An active subscription is required to purchase extra hours.{' '}
              <a href="/pricing" className="underline hover:text-amber-300">View plans →</a>
            </p>
          )}
        </div>
      </div>
    </AppShell>
  )
}
