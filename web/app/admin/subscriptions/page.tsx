import { createServiceRoleClient } from '@/lib/supabase'
import { PLAN_LABEL } from '@/lib/plans'
import { AppShell } from '@/components/app-shell'

export const dynamic = 'force-dynamic'

export default async function AdminSubscriptionsPage() {
  const db = createServiceRoleClient()

  const { data: subs } = await (db as any).from('subscriptions')
    .select(`
      *,
      users(id, email, full_name, app_role),
      organizations(id, name, seat_count)
    `)
    .order('created_at', { ascending: false })

  const { data: skippedPayouts } = await (db as any).from('coach_referrals')
    .select('id, percentage, users!coach_referrals_coach_id_fkey(email, stripe_connect_account_id), organizations(name)')
    .eq('type', 'affiliate')
    .eq('is_active', true)

  // Filter in JS — Supabase .is() on nested columns is unreliable without RLS
  const missingConnect = (skippedPayouts ?? []).filter(
    (r: any) => !r.users?.stripe_connect_account_id
  )

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold">Subscriptions</h1>

        {missingConnect.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
            <p className="text-yellow-400 font-medium mb-2">
              ⚠ Coaches with affiliate referrals but no Stripe Connect account
            </p>
            <ul className="text-sm text-yellow-300 space-y-1">
              {missingConnect.map((r: any) => (
                <li key={r.id}>
                  {r.users?.email} → {r.organizations?.name} ({r.percentage}%)
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-left">
                <th className="pb-3 pr-4">Account</th>
                <th className="pb-3 pr-4">Plan</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Seats</th>
                <th className="pb-3">Period End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(subs ?? []).map((sub: any) => {
                const name =
                  sub.organizations?.name ??
                  sub.users?.full_name ??
                  sub.users?.email ??
                  '—'
                const seats = sub.organizations?.seat_count ?? null
                return (
                  <tr key={sub.id} className="text-gray-300">
                    <td className="py-3 pr-4">
                      <p className="text-white">{name}</p>
                      <p className="text-xs text-gray-500">{sub.users?.app_role ?? 'company'}</p>
                    </td>
                    <td className="py-3 pr-4">{PLAN_LABEL[sub.plan_id] ?? sub.plan_id}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        sub.status === 'active'    ? 'bg-green-500/20 text-green-400' :
                        sub.status === 'trialing'  ? 'bg-yellow-500/20 text-yellow-400' :
                        sub.status === 'past_due'  ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4">{seats ?? '—'}</td>
                    <td className="py-3 text-gray-500">
                      {sub.current_period_end
                        ? new Date(sub.current_period_end).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
