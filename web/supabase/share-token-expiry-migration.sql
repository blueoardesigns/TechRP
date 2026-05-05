-- Add share-link expiry to training_sessions.
--
-- Existing share_token rows (if any) are left untouched. New shares created
-- via /api/sessions/[id]/share automatically populate share_expires_at to
-- (now + 90 days). The /share/session/[token] page rejects requests where
-- share_expires_at is set and in the past.

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ;

-- Helpful for the public share page lookup (token + expiry filter).
CREATE INDEX IF NOT EXISTS idx_training_sessions_share_token_expires
  ON training_sessions (share_token)
  WHERE share_token IS NOT NULL;
