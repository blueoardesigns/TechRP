'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'

function CallbackInner() {
  const params = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const code = params.get('code')
    const coachId = params.get('state')
    if (!code || !coachId) { setStatus('error'); return }

    fetch('/api/coach/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, coachId }),
    })
      .then(r => r.json())
      .then((d: { success?: boolean }) => {
        if (d.success) {
          setStatus('success')
          setTimeout(() => router.push('/coach/referrals'), 2000)
        } else {
          setStatus('error')
        }
      })
      .catch(() => setStatus('error'))
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppShell>
      <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-3">
        {status === 'loading' && <p className="text-gray-400">Connecting your Stripe account...</p>}
        {status === 'success' && (
          <>
            <p className="text-green-400 text-lg font-semibold">&#10003; Stripe account connected!</p>
            <p className="text-gray-400 text-sm">Redirecting to referrals...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-red-400">Connection failed.</p>
            <a href="/coach/referrals" className="text-indigo-400 text-sm hover:underline">Go back</a>
          </>
        )}
      </div>
      </div>
    </AppShell>
  )
}

export default function ConnectCallbackPage() {
  return <Suspense><CallbackInner /></Suspense>
}
