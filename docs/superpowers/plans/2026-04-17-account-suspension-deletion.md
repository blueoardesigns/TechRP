# Account Suspension & Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to suspend (pause billing, block access) or permanently delete their account, with reason collection and email notification to the admin.

**Architecture:** New `POST /api/account/close` route handles both actions server-side — Stripe pause/cancel first, then DB update, then admin email via Resend. The UI is a "Danger Zone" section added to the existing `/account` page with a 3-step modal (action choice → reason → confirm). Auth provider already redirects `status = 'suspended'` users to `/pending`, so suspension access blocking is free.

**Tech Stack:** Stripe SDK (`@/lib/stripe`), Resend, Supabase service role client (`@/lib/supabase`), React state for modal steps. All already installed — no new dependencies.

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `web/app/api/account/close/route.ts` | Server action: Stripe pause/cancel + DB update + Resend email |
| Create | `web/__tests__/account-close.test.ts` | Unit tests for the route's business logic |
| Modify | `web/app/account/page.tsx` | Add Danger Zone section + 3-step modal |

---

## Task 1: API Route — `POST /api/account/close`

**Files:**
- Create: `web/app/api/account/close/route.ts`
- Create: `web/__tests__/account-close.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `web/__tests__/account-close.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

// Pure logic helpers extracted from the route for testing.
// We test the business rules, not the HTTP layer.

function validateCloseRequest(body: unknown): { action: 'suspend' | 'delete'; reason: string; reasonDetail?: string } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Invalid request body' }
  const { action, reason, reasonDetail } = body as Record<string, unknown>
  if (action !== 'suspend' && action !== 'delete') return { error: 'action must be suspend or delete' }
  if (!reason || typeof reason !== 'string' || reason.trim() === '') return { error: 'reason is required' }
  if (reasonDetail !== undefined && typeof reasonDetail !== 'string') return { error: 'reasonDetail must be a string' }
  return { action, reason: reason.trim(), reasonDetail: reasonDetail?.trim() }
}

function buildAdminEmailBody(opts: {
  action: 'suspend' | 'delete'
  fullName: string
  email: string
  planLabel: string
  reason: string
  reasonDetail?: string
  timestamp: string
}): string {
  const lines = [
    `Action: ${opts.action.toUpperCase()}`,
    `User: ${opts.fullName} <${opts.email}>`,
    `Plan: ${opts.planLabel}`,
    `Reason: ${opts.reason}`,
  ]
  if (opts.reasonDetail) lines.push(`Detail: ${opts.reasonDetail}`)
  lines.push(`Timestamp: ${opts.timestamp}`)
  return lines.join('\n')
}

describe('validateCloseRequest', () => {
  it('accepts valid suspend request', () => {
    const result = validateCloseRequest({ action: 'suspend', reason: 'Price is too high' })
    expect(result).toEqual({ action: 'suspend', reason: 'Price is too high', reasonDetail: undefined })
  })

  it('accepts valid delete request with detail', () => {
    const result = validateCloseRequest({ action: 'delete', reason: 'Other', reasonDetail: 'Moving to competitor' })
    expect(result).toEqual({ action: 'delete', reason: 'Other', reasonDetail: 'Moving to competitor' })
  })

  it('rejects missing action', () => {
    const result = validateCloseRequest({ reason: 'test' })
    expect(result).toHaveProperty('error')
  })

  it('rejects invalid action', () => {
    const result = validateCloseRequest({ action: 'cancel', reason: 'test' })
    expect(result).toHaveProperty('error')
  })

  it('rejects missing reason', () => {
    const result = validateCloseRequest({ action: 'suspend' })
    expect(result).toHaveProperty('error')
  })

  it('rejects blank reason', () => {
    const result = validateCloseRequest({ action: 'suspend', reason: '   ' })
    expect(result).toHaveProperty('error')
  })
})

describe('buildAdminEmailBody', () => {
  it('includes all fields for suspend', () => {
    const body = buildAdminEmailBody({
      action: 'suspend',
      fullName: 'Jane Smith',
      email: 'jane@example.com',
      planLabel: 'Individual Growth',
      reason: 'Price is too high',
      timestamp: '2026-04-17T12:00:00Z',
    })
    expect(body).toContain('Action: SUSPEND')
    expect(body).toContain('Jane Smith <jane@example.com>')
    expect(body).toContain('Individual Growth')
    expect(body).toContain('Price is too high')
    expect(body).toContain('2026-04-17T12:00:00Z')
    expect(body).not.toContain('Detail:')
  })

  it('includes detail line when provided', () => {
    const body = buildAdminEmailBody({
      action: 'delete',
      fullName: 'Bob',
      email: 'bob@example.com',
      planLabel: 'Starter',
      reason: 'Other',
      reasonDetail: 'Custom reason here',
      timestamp: '2026-04-17T12:00:00Z',
    })
    expect(body).toContain('Action: DELETE')
    expect(body).toContain('Detail: Custom reason here')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web && npx vitest run __tests__/account-close.test.ts
```

Expected: FAIL — `validateCloseRequest` and `buildAdminEmailBody` are not defined.

- [ ] **Step 3: Create the route with extracted helpers**

Create `web/app/api/account/close/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { createServiceRoleClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { Resend } from 'resend'
import { PLAN_LABEL } from '@/lib/plans'

const resend = new Resend(process.env.RESEND_API_KEY)
const ADMIN_EMAIL = 'tbauertext@gmail.com'

export function validateCloseRequest(body: unknown): { action: 'suspend' | 'delete'; reason: string; reasonDetail?: string } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Invalid request body' }
  const { action, reason, reasonDetail } = body as Record<string, unknown>
  if (action !== 'suspend' && action !== 'delete') return { error: 'action must be suspend or delete' }
  if (!reason || typeof reason !== 'string' || reason.trim() === '') return { error: 'reason is required' }
  if (reasonDetail !== undefined && typeof reasonDetail !== 'string') return { error: 'reasonDetail must be a string' }
  return { action, reason: reason.trim(), reasonDetail: reasonDetail?.trim() }
}

export function buildAdminEmailBody(opts: {
  action: 'suspend' | 'delete'
  fullName: string
  email: string
  planLabel: string
  reason: string
  reasonDetail?: string
  timestamp: string
}): string {
  const lines = [
    `Action: ${opts.action.toUpperCase()}`,
    `User: ${opts.fullName} <${opts.email}>`,
    `Plan: ${opts.planLabel}`,
    `Reason: ${opts.reason}`,
  ]
  if (opts.reasonDetail) lines.push(`Detail: ${opts.reasonDetail}`)
  lines.push(`Timestamp: ${opts.timestamp}`)
  return lines.join('\n')
}

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const supabaseAuth = createServerSupabase()
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Parse + validate body
  const body = await request.json().catch(() => null)
  const parsed = validateCloseRequest(body)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { action, reason, reasonDetail } = parsed

  // 3. Fetch user record
  const db = createServiceRoleClient()
  const { data: userRecord, error: userErr } = await (db as any)
    .from('users')
    .select('id, full_name, email, stripe_customer_id, stripe_subscription_id, stripe_price_id')
    .eq('id', authUser.id)
    .single()

  if (userErr || !userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const planLabel = PLAN_LABEL[userRecord.stripe_price_id] ?? userRecord.stripe_price_id ?? 'Unknown plan'
  const timestamp = new Date().toISOString()

  // 4. Stripe operation — must succeed before touching the DB
  if (userRecord.stripe_subscription_id) {
    try {
      if (action === 'suspend') {
        await stripe.subscriptions.update(userRecord.stripe_subscription_id, {
          pause_collection: { behavior: 'void' },
        })
      } else {
        await stripe.subscriptions.cancel(userRecord.stripe_subscription_id)
      }
    } catch (err: any) {
      return NextResponse.json({ error: `Billing update failed: ${err.message}` }, { status: 502 })
    }
  }

  // 5. DB update
  if (action === 'suspend') {
    await (db as any).from('users').update({ status: 'suspended' }).eq('id', authUser.id)
  } else {
    // Delete in dependency order
    await (db as any).from('training_sessions').delete().eq('user_id', authUser.id)
    await (db as any).from('playbooks').delete().eq('created_by', authUser.id)
    await (db as any).from('users').delete().eq('id', authUser.id)
    // Delete Supabase Auth user
    await db.auth.admin.deleteUser(authUser.id)
  }

  // 6. Admin email (best-effort — don't fail the request if email fails)
  const emailBody = buildAdminEmailBody({
    action,
    fullName: userRecord.full_name ?? 'Unknown',
    email: userRecord.email ?? authUser.email ?? '',
    planLabel,
    reason,
    reasonDetail,
    timestamp,
  })

  await resend.emails.send({
    from: 'TechRP <noreply@techrp.com>',
    to: ADMIN_EMAIL,
    subject: `[TechRP] Account ${action} — ${userRecord.email ?? authUser.email}`,
    text: emailBody,
  }).catch(() => { /* email failure is non-fatal */ })

  return NextResponse.json({ success: true, action })
}
```

- [ ] **Step 4: Update the test file to import from the route**

Update `web/__tests__/account-close.test.ts` — change the import block at the top:

```typescript
import { describe, it, expect } from 'vitest'
import { validateCloseRequest, buildAdminEmailBody } from '../app/api/account/close/route'

// Remove the local function definitions — they are now imported from the route.
// Keep all describe/it blocks exactly as written in Step 1.
```

The full updated file (imports + all tests, no local function definitions):

```typescript
import { describe, it, expect } from 'vitest'
import { validateCloseRequest, buildAdminEmailBody } from '../app/api/account/close/route'

describe('validateCloseRequest', () => {
  it('accepts valid suspend request', () => {
    const result = validateCloseRequest({ action: 'suspend', reason: 'Price is too high' })
    expect(result).toEqual({ action: 'suspend', reason: 'Price is too high', reasonDetail: undefined })
  })

  it('accepts valid delete request with detail', () => {
    const result = validateCloseRequest({ action: 'delete', reason: 'Other', reasonDetail: 'Moving to competitor' })
    expect(result).toEqual({ action: 'delete', reason: 'Other', reasonDetail: 'Moving to competitor' })
  })

  it('rejects missing action', () => {
    const result = validateCloseRequest({ reason: 'test' })
    expect(result).toHaveProperty('error')
  })

  it('rejects invalid action', () => {
    const result = validateCloseRequest({ action: 'cancel', reason: 'test' })
    expect(result).toHaveProperty('error')
  })

  it('rejects missing reason', () => {
    const result = validateCloseRequest({ action: 'suspend' })
    expect(result).toHaveProperty('error')
  })

  it('rejects blank reason', () => {
    const result = validateCloseRequest({ action: 'suspend', reason: '   ' })
    expect(result).toHaveProperty('error')
  })
})

describe('buildAdminEmailBody', () => {
  it('includes all fields for suspend', () => {
    const body = buildAdminEmailBody({
      action: 'suspend',
      fullName: 'Jane Smith',
      email: 'jane@example.com',
      planLabel: 'Individual Growth',
      reason: 'Price is too high',
      timestamp: '2026-04-17T12:00:00Z',
    })
    expect(body).toContain('Action: SUSPEND')
    expect(body).toContain('Jane Smith <jane@example.com>')
    expect(body).toContain('Individual Growth')
    expect(body).toContain('Price is too high')
    expect(body).toContain('2026-04-17T12:00:00Z')
    expect(body).not.toContain('Detail:')
  })

  it('includes detail line when provided', () => {
    const body = buildAdminEmailBody({
      action: 'delete',
      fullName: 'Bob',
      email: 'bob@example.com',
      planLabel: 'Starter',
      reason: 'Other',
      reasonDetail: 'Custom reason here',
      timestamp: '2026-04-17T12:00:00Z',
    })
    expect(body).toContain('Action: DELETE')
    expect(body).toContain('Detail: Custom reason here')
  })
})
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
cd web && npx vitest run __tests__/account-close.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 6: Verify full test suite still passes**

```bash
cd web && npm test
```

Expected: all existing tests pass.

- [ ] **Step 7: Commit**

```bash
cd web && git add app/api/account/close/route.ts __tests__/account-close.test.ts
git commit -m "feat: add POST /api/account/close — suspend/delete with Stripe + Resend"
```

---

## Task 2: Account Page — Danger Zone UI

**Files:**
- Modify: `web/app/account/page.tsx`

The existing page has a form for `individual` users and read-only display for other roles. We append a "Danger Zone" section below the existing card for all roles, with a 3-step modal.

- [ ] **Step 1: Add modal state and handlers to `web/app/account/page.tsx`**

Add these imports at the top of the file (after existing imports):

```tsx
// No new imports needed — useState is already imported
```

Add modal state variables after the existing state declarations (after line ~24, near `const [error, setError] = useState('')`):

```tsx
  // Danger Zone modal state
  const [showDangerModal, setShowDangerModal] = useState(false);
  const [dangerStep, setDangerStep] = useState<1 | 2 | 3>(1);
  const [dangerAction, setDangerAction] = useState<'suspend' | 'delete' | null>(null);
  const [dangerReason, setDangerReason] = useState('');
  const [dangerReasonDetail, setDangerReasonDetail] = useState('');
  const [dangerConfirmText, setDangerConfirmText] = useState('');
  const [dangerLoading, setDangerLoading] = useState(false);
  const [dangerError, setDangerError] = useState('');

  function openDangerModal() {
    setShowDangerModal(true);
    setDangerStep(1);
    setDangerAction(null);
    setDangerReason('');
    setDangerReasonDetail('');
    setDangerConfirmText('');
    setDangerError('');
  }

  async function handleDangerConfirm() {
    if (!dangerAction || !dangerReason) return;
    if (dangerAction === 'delete' && dangerConfirmText !== 'DELETE') return;
    setDangerLoading(true);
    setDangerError('');
    try {
      const res = await fetch('/api/account/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: dangerAction, reason: dangerReason, reasonDetail: dangerReasonDetail || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDangerError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      // Sign out and redirect
      window.location.href = '/';
    } catch {
      setDangerError('Network error. Please try again.');
    } finally {
      setDangerLoading(false);
    }
  }
```

- [ ] **Step 2: Add Danger Zone section and modal JSX to the page return**

After the existing `<button onClick={() => router.back()} ...>← Back</button>` (the last element before the closing `</div>`), add:

```tsx
        {/* Danger Zone */}
        <div className="mt-12 border border-red-500/20 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wide mb-1">Danger Zone</h2>
          <p className="text-sm text-gray-500 mb-4">
            Suspend or permanently delete your account. Suspending pauses your billing and blocks access — your data is preserved. Deletion is permanent and cannot be undone.
          </p>
          <button
            onClick={openDangerModal}
            className="px-4 py-2 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/10 transition-colors"
          >
            Manage Account Status
          </button>
        </div>

        {/* Danger Zone Modal */}
        {showDangerModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-md w-full">

              {/* Step 1: Choose action */}
              {dangerStep === 1 && (
                <>
                  <h3 className="text-lg font-bold text-white mb-1">What would you like to do?</h3>
                  <p className="text-sm text-gray-500 mb-6">Choose an option below.</p>
                  <div className="space-y-3 mb-6">
                    <button
                      onClick={() => setDangerAction('suspend')}
                      className={`w-full text-left p-4 rounded-xl border transition-colors ${dangerAction === 'suspend' ? 'border-indigo-500/60 bg-indigo-500/10' : 'border-white/10 hover:border-white/20'}`}
                    >
                      <div className="font-semibold text-white text-sm mb-1">Temporarily suspend</div>
                      <p className="text-xs text-gray-500">Pause your subscription and block access. Your data is preserved. You can reactivate anytime by contacting us.</p>
                    </button>
                    <button
                      onClick={() => setDangerAction('delete')}
                      className={`w-full text-left p-4 rounded-xl border transition-colors ${dangerAction === 'delete' ? 'border-red-500/60 bg-red-500/10' : 'border-white/10 hover:border-white/20'}`}
                    >
                      <div className="font-semibold text-red-400 text-sm mb-1">Permanently delete</div>
                      <p className="text-xs text-gray-500">Cancel your subscription and erase all records. This cannot be undone.</p>
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowDangerModal(false)} className="flex-1 py-2.5 border border-white/10 text-gray-400 rounded-xl text-sm hover:border-white/20 transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={() => dangerAction && setDangerStep(2)}
                      disabled={!dangerAction}
                      className="flex-1 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                    >
                      Continue →
                    </button>
                  </div>
                </>
              )}

              {/* Step 2: Reason */}
              {dangerStep === 2 && (
                <>
                  <h3 className="text-lg font-bold text-white mb-1">Tell us why</h3>
                  <p className="text-sm text-gray-500 mb-6">Your feedback helps us improve.</p>
                  <div className="space-y-2 mb-4">
                    {[
                      'Price is too high',
                      'No time to use the software',
                      "I've gotten as much out of it as I can",
                      "I don't enjoy using the software",
                      'Other',
                    ].map((r) => (
                      <label key={r} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="reason"
                          value={r}
                          checked={dangerReason === r}
                          onChange={() => { setDangerReason(r); setDangerReasonDetail(''); }}
                          className="accent-indigo-500"
                        />
                        <span className="text-sm text-gray-300">{r}</span>
                      </label>
                    ))}
                  </div>
                  {dangerReason === 'Other' && (
                    <textarea
                      value={dangerReasonDetail}
                      onChange={e => setDangerReasonDetail(e.target.value)}
                      placeholder="Tell us more…"
                      rows={3}
                      className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none mb-4"
                    />
                  )}
                  <div className="flex gap-3">
                    <button onClick={() => setDangerStep(1)} className="flex-1 py-2.5 border border-white/10 text-gray-400 rounded-xl text-sm hover:border-white/20 transition-colors">
                      Back
                    </button>
                    <button
                      onClick={() => dangerReason && setDangerStep(3)}
                      disabled={!dangerReason}
                      className="flex-1 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                    >
                      Continue →
                    </button>
                  </div>
                </>
              )}

              {/* Step 3: Confirm */}
              {dangerStep === 3 && (
                <>
                  <h3 className="text-lg font-bold text-white mb-1">
                    {dangerAction === 'suspend' ? 'Confirm suspension' : 'Confirm deletion'}
                  </h3>
                  <p className="text-sm text-gray-500 mb-6">
                    {dangerAction === 'suspend'
                      ? 'Your subscription will be paused and you will be signed out immediately. Contact us to reactivate.'
                      : 'This will permanently delete your account, all session history, and all playbooks. Type DELETE to confirm.'}
                  </p>
                  {dangerAction === 'delete' && (
                    <input
                      type="text"
                      value={dangerConfirmText}
                      onChange={e => setDangerConfirmText(e.target.value)}
                      placeholder="Type DELETE to confirm"
                      className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors mb-4"
                    />
                  )}
                  {dangerError && (
                    <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
                      {dangerError}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <button onClick={() => setDangerStep(2)} className="flex-1 py-2.5 border border-white/10 text-gray-400 rounded-xl text-sm hover:border-white/20 transition-colors">
                      Back
                    </button>
                    <button
                      onClick={handleDangerConfirm}
                      disabled={dangerLoading || (dangerAction === 'delete' && dangerConfirmText !== 'DELETE')}
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {dangerLoading
                        ? 'Processing…'
                        : dangerAction === 'suspend'
                          ? 'Suspend My Account'
                          : 'Permanently Delete My Account'}
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        )}
```

- [ ] **Step 3: Verify build**

```bash
cd web && npm run build 2>&1 | tail -10
```

Expected: no type errors.

- [ ] **Step 4: Manual smoke-test**

Start the dev server (`npm run dev`). Log in as any user. Navigate to `/account`. Verify:
1. "Danger Zone" section appears at the bottom
2. "Manage Account Status" button opens the modal
3. Step 1: Can select suspend or delete, Continue button only enables after selection
4. Step 2: Radio buttons work, "Other" reveals text area, Continue only enables after selection
5. Step 3 (suspend): Shows confirm button immediately, no text input required
6. Step 3 (delete): Requires typing `DELETE` before button enables
7. Cancel button closes modal at any step, Back button goes to previous step
8. **Do NOT complete the flow against a real account** — verify UI only

- [ ] **Step 5: Commit**

```bash
cd web && git add app/account/page.tsx
git commit -m "feat: add account suspension/deletion flow with 3-step modal"
```
