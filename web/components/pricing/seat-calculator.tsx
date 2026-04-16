'use client'
import { useState } from 'react'
import { getCompanyPlanId, PLAN_PRICE_CENTS } from '@/lib/plans'

type Props = { onSelect: (planKey: string, seats: number) => void }

export function SeatCalculator({ onSelect }: Props) {
  const [seats, setSeats] = useState(2)
  const [tier, setTier] = useState<'std' | 'pro'>('pro')

  const planKey = getCompanyPlanId(tier, seats)
  const pricePerSeat = PLAN_PRICE_CENTS[planKey] / 100
  const total = pricePerSeat * seats

  return (
    <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-5">
      <h3 className="text-lg font-semibold text-white">Company Plan Calculator</h3>

      <div className="flex gap-2">
        {(['std', 'pro'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTier(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tier === t
                ? 'bg-indigo-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {t === 'std' ? 'Standard (120 min/user)' : 'Pro (240 min/user)'}
          </button>
        ))}
      </div>

      <div>
        <label className="text-sm text-gray-400 block mb-2">
          Number of seats: <span className="text-white font-semibold">{seats}</span>
        </label>
        <input
          type="range" min={2} max={100} value={seats}
          onChange={e => setSeats(Number(e.target.value))}
          className="w-full accent-indigo-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>2</span><span>5</span><span>20</span><span>50</span><span>100</span>
        </div>
      </div>

      <div className="bg-white/5 rounded-xl p-4">
        <div className="flex justify-between text-sm text-gray-400">
          <span>Per seat/month</span>
          <span className="text-white font-semibold">${pricePerSeat.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold text-white mt-2">
          <span>Monthly total ({seats} seats)</span>
          <span className="text-green-400">${total.toFixed(2)}/mo</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">7-day free trial · Cancel anytime</p>
      </div>

      <button
        onClick={() => onSelect(planKey, seats)}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
      >
        Get Started — ${total.toFixed(2)}/mo
      </button>
    </div>
  )
}
