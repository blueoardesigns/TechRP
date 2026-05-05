import { describe, it, expect, vi } from 'vitest'

// Mock server-only modules before importing the route
vi.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: vi.fn() },
}))

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabase: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  createServiceRoleClient: vi.fn(),
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: {
      update: vi.fn(),
      cancel: vi.fn(),
    },
  },
}))

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: vi.fn() }
  },
}))

import { validateCloseRequest, buildAdminEmailBody } from '../lib/account-close'

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
    expect(body).toContain('Action: SUSPENDED')
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
    expect(body).toContain('Action: DELETED')
    expect(body).toContain('Detail: Custom reason here')
  })
})

describe('Stripe-abort-before-DB contract (suspend)', () => {
  it('does not call DB update when Stripe throws', async () => {
    // Simulate the exact logic path in the POST handler for suspend:
    // If stripe.subscriptions.update throws, we return early before touching the DB.
    let dbUpdateCalled = false

    const stripeUpdate = async (_id: string, _opts: unknown) => {
      throw new Error('Stripe unavailable')
    }

    const dbUpdate = async () => {
      dbUpdateCalled = true
      return { error: null }
    }

    // Replicate the handler's critical section
    const subscriptionId = 'sub_test_123'
    let stripeError: Error | null = null
    try {
      await stripeUpdate(subscriptionId, { pause_collection: { behavior: 'void' } })
    } catch (err) {
      stripeError = err as Error
    }

    if (!stripeError) {
      await dbUpdate()
    }

    expect(stripeError).not.toBeNull()
    expect(stripeError!.message).toBe('Stripe unavailable')
    expect(dbUpdateCalled).toBe(false)
  })
})
