/**
 * Pure helpers for /api/account/close, extracted so tests can import them
 * without dragging in the route handler (Next.js 14 forbids non-handler
 * named exports from route files).
 */

export function validateCloseRequest(body: unknown):
  | { action: 'suspend' | 'delete'; reason: string; reasonDetail?: string }
  | { error: string } {
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
    `Action: ${opts.action === 'suspend' ? 'SUSPENDED' : 'DELETED'}`,
    `User: ${opts.fullName} <${opts.email}>`,
    `Plan: ${opts.planLabel}`,
    `Reason: ${opts.reason}`,
  ]
  if (opts.reasonDetail) lines.push(`Detail: ${opts.reasonDetail}`)
  lines.push(`Timestamp: ${opts.timestamp}`)
  return lines.join('\n')
}
