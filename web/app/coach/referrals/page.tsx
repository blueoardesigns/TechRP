'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'

type Referral = {
  id: string
  type: 'affiliate' | 'discount'
  percentage: number
  is_active: boolean
  organizations?: { name: string; subscription_status: string }
}

export default function CoachReferralsPage() {
  const { user } = useAuth()
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [form, setForm] = useState({ type: 'affiliate' as 'affiliate' | 'discount', percentage: 15 })
  const [inviteUrl, setInviteUrl] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    fetch(`/api/coach/referrals?coachId=${user.id}`)
      .then(r => r.json())
      .then((d: { referrals?: Referral[] }) => setReferrals(d.referrals ?? []))
  }, [user?.id])

  async function generateLink() {
    setLoading(true)
    const res = await fetch('/api/coach/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId: user?.id, ...form }),
    })
    const d = await res.json() as { inviteUrl?: string }
    setInviteUrl(d.inviteUrl ?? '')
    setLoading(false)
  }

  async function toggleActive(id: string, currentActive: boolean) {
    await fetch(`/api/coach/referrals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !currentActive }),
    })
    setReferrals(r => r.map(ref => ref.id === id ? { ...ref, is_active: !currentActive } : ref))
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Referrals</h1>
          <a
            href={`/api/coach/connect?coachId=${user?.id}`}
            className="text-sm px-4 py-2 bg-gray-800 border border-white/10 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Connect Stripe for Payouts &#8594;
          </a>
        </div>

        <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold">Create Invite Link</h2>
          <div className="flex gap-3 flex-wrap">
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as 'affiliate' | 'discount' }))}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white min-w-[180px]"
            >
              <option value="affiliate">Affiliate &mdash; I earn %</option>
              <option value="discount">Discount &mdash; Company gets %</option>
            </select>
            <div className="flex items-center gap-2">
              <input
                type="number" min={1} max={100} value={form.percentage}
                onChange={e => setForm(f => ({ ...f, percentage: Number(e.target.value) }))}
                className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              />
              <span className="text-gray-400 text-sm">%</span>
            </div>
            <button
              onClick={generateLink}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Generate
            </button>
          </div>
          {inviteUrl && (
            <div className="flex gap-2">
              <input
                readOnly value={inviteUrl}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono"
              />
              <button
                onClick={() => navigator.clipboard.writeText(inviteUrl)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10"
              >
                Copy
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {referrals.length === 0 && (
            <p className="text-gray-500 text-sm">No referrals yet. Generate a link above to invite a company.</p>
          )}
          {referrals.map(ref => (
            <div key={ref.id} className="bg-gray-900 border border-white/10 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{ref.organizations?.name ?? 'Company'}</p>
                <p className="text-sm text-gray-400">
                  {ref.type === 'affiliate' ? `You earn ${ref.percentage}%` : `They get ${ref.percentage}% off`}
                  {' · '}
                  <span className={ref.organizations?.subscription_status === 'active' ? 'text-green-400' : 'text-gray-500'}>
                    {ref.organizations?.subscription_status ?? 'pending'}
                  </span>
                </p>
              </div>
              <button
                onClick={() => toggleActive(ref.id, ref.is_active)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                  ref.is_active
                    ? 'bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400'
                    : 'bg-gray-700 text-gray-400 hover:bg-green-500/20 hover:text-green-400'
                }`}
              >
                {ref.is_active ? 'Active — click to revoke' : 'Revoked — click to restore'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
