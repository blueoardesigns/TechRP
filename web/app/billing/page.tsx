'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { AppShell } from '@/components/app-shell'
import { UsageBar } from '@/components/billing/usage-bar'
import { getPlanMinutes, PLAN_LABEL } from '@/lib/plans'

export default function BillingPage() {
  const { user } = useAuth()
  const [billing, setBilling] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    fetch('/api/billing/summary?userId=' + user.id)
      .then(r => r.json())
      .then(d => { setBilling(d); setLoading(false) })
  }, [user?.id])

  async function openPortal() {
    if (!user) return
    setPortalLoading(true)
    const res = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, orgId: (user as any).organizationId }),
    })
    const { url } = await res.json() as { url?: string }
    if (url) window.location.href = url
    else setPortalLoading(false)
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading...</div>
  }

  const planId = (billing?.planId as string) ?? ''
  const planMinutes = getPlanMinutes(planId)
  const planLabel = PLAN_LABEL[planId] ?? 'No active plan'
  const status = billing?.status as string
  const minutesUsed = (billing?.minutesUsed as number) ?? 0
  const bonusMinutes = (billing?.bonusMinutes as number) ?? 0
  const autoRefill = billing?.autoRefill as boolean
  const nextReset = billing?.nextReset as string | undefined
  const trialEnd = billing?.trialEnd as string | undefined

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Billing &amp; Usage</h1>

        <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400">Current plan</p>
              <p className="text-xl font-semibold">{planLabel}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              status === 'active' ? 'bg-green-500/20 text-green-400' :
              status === 'trialing' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {status ?? 'inactive'}
            </span>
          </div>

          {status === 'trialing' && trialEnd && (
            <p className="text-sm text-yellow-400">
              Trial ends {new Date(trialEnd).toLocaleDateString()} or at 25 minutes used.
            </p>
          )}

          <UsageBar used={minutesUsed} total={planMinutes} bonus={bonusMinutes} label="This billing period" />

          {nextReset && (
            <p className="text-xs text-gray-500">Resets {new Date(nextReset).toLocaleDateString()}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href="/billing/add-hours"
            className="bg-gray-900 border border-white/10 rounded-2xl p-5 hover:border-indigo-500/50 transition-colors group"
          >
            <p className="font-semibold group-hover:text-indigo-400 transition-colors">Add Training Hours</p>
            <p className="text-sm text-gray-400 mt-1">Purchase extra minutes that never expire</p>
          </a>

          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="bg-gray-900 border border-white/10 rounded-2xl p-5 text-left hover:border-indigo-500/50 transition-colors group disabled:opacity-50"
          >
            <p className="font-semibold group-hover:text-indigo-400 transition-colors">
              {portalLoading ? 'Redirecting...' : 'Manage Subscription'}
            </p>
            <p className="text-sm text-gray-400 mt-1">Change plan, view invoices, update payment</p>
          </button>
        </div>

        <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="font-medium">Auto-refill</p>
            <p className="text-sm text-gray-400">Automatically buy 1 hour when minutes run out</p>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/billing/auto-refill', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user?.id, orgId: (user as any)?.organizationId, enabled: !autoRefill }),
              })
              setBilling(b => b ? { ...b, autoRefill: !b.autoRefill } : b)
            }}
            className={`relative w-12 h-6 rounded-full transition-colors ${autoRefill ? 'bg-indigo-600' : 'bg-white/20'}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${autoRefill ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>
    </AppShell>
  )
}
