'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SeatCalculator } from '@/components/pricing/seat-calculator'

const INDIVIDUAL_PLANS = [
  { key: 'individual_starter', label: 'Starter', price: '$34.99', minutes: '120 min/mo', addl: '$14.99/hr', weeklyNote: '~30 min/wk' },
  { key: 'individual_growth', label: 'Growth', price: '$57.99', minutes: '240 min/mo', addl: '$12.99/hr', weeklyNote: '~60 min/wk', popular: true },
  { key: 'individual_pro', label: 'Pro', price: '$89.99', minutes: '400 min/mo', addl: '$10.99/hr', weeklyNote: '~100 min/wk' },
]

export default function PricingPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'individual' | 'company'>('individual')

  function handleIndividualSelect(planKey: string) {
    router.push(`/signup?plan=${planKey}`)
  }

  function handleCompanySelect(planKey: string, seats: number) {
    router.push(`/signup?plan=${planKey}&seats=${seats}&type=company`)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">Simple, transparent pricing</h1>
          <p className="text-gray-400 text-lg">7-day free trial on all plans. No charge until your trial ends.</p>
        </div>

        <div className="flex justify-center mb-10">
          <div className="bg-gray-900 border border-white/10 rounded-xl p-1 flex gap-1">
            {(['individual', 'company'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {t === 'individual' ? 'Individual' : 'Company'}
              </button>
            ))}
          </div>
        </div>

        {tab === 'individual' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {INDIVIDUAL_PLANS.map(plan => (
              <div
                key={plan.key}
                className={`relative bg-gray-900 rounded-2xl p-6 border flex flex-col ${
                  (plan as any).popular ? 'border-indigo-500' : 'border-white/10'
                }`}
              >
                {(plan as any).popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-semibold mb-1">{plan.label}</h3>
                <div className="text-3xl font-bold text-white mb-1">
                  {plan.price}<span className="text-base text-gray-400 font-normal">/mo</span>
                </div>
                <p className="text-sm text-gray-400 mb-6">
                  {plan.minutes} <span className="text-gray-600">({plan.weeklyNote})</span>
                </p>
                <ul className="space-y-2 text-sm text-gray-300 mb-8 flex-1">
                  <li>&#10003; All scenario types</li>
                  <li>&#10003; AI scoring &amp; feedback</li>
                  <li>&#10003; Session history</li>
                  <li>&#10003; Additional hours: {plan.addl}</li>
                </ul>
                <button
                  onClick={() => handleIndividualSelect(plan.key)}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
                >
                  Start Free Trial
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'company' && (
          <div className="max-w-xl mx-auto">
            <SeatCalculator onSelect={handleCompanySelect} />
            <p className="text-center text-sm text-gray-500 mt-4">
              Minutes shared as a pool across your team. Each user capped at 150% of their plan allocation.
            </p>
          </div>
        )}

        <p className="text-center text-sm text-gray-600 mt-12">
          Already have an account?{' '}
          <a href="/login" className="text-indigo-400 hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  )
}
