-- web/supabase/share-referral-migration.sql
-- Share tokens + referrals + global broadcast audit
-- Run in Supabase SQL Editor. Idempotent where practical.

-- ── 1. Share tokens on training_sessions ────────────────────────────
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS share_token       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS share_enabled_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_training_sessions_share_token
  ON training_sessions(share_token) WHERE share_token IS NOT NULL;

-- ── 2. Referrals ────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code              TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referral_credits_minutes   INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS referrals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id       UUID NOT NULL REFERENCES users(id),
  referred_id       UUID NOT NULL REFERENCES users(id) UNIQUE,
  source            TEXT NOT NULL,
  credited_minutes  INTEGER NOT NULL DEFAULT 60,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

-- ── 3. Backfill referral codes for existing users ──────────────────
-- 8-char base32 derived from the user's UUID.
UPDATE users
SET referral_code = UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;

-- ── 4. Global broadcasts audit log ──────────────────────────────────
CREATE TABLE IF NOT EXISTS global_broadcasts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by          UUID NOT NULL REFERENCES users(id),
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  link             TEXT,
  recipient_count  INTEGER NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_global_broadcasts_created ON global_broadcasts(created_at DESC);

-- ── 5. Enable Realtime on notifications for bell subscription ──────
-- Safe to run repeatedly; Supabase ignores if already added.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  EXCEPTION WHEN duplicate_object THEN
    -- already in publication
    NULL;
  END;
END $$;
