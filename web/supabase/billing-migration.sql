-- web/supabase/billing-migration.sql

-- ── users ──────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS minutes_used            integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_minutes           integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_ends_at           timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id      text,
  ADD COLUMN IF NOT EXISTS auto_refill_enabled     boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text;

-- ── organizations ──────────────────────────────────────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id      text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  text,
  ADD COLUMN IF NOT EXISTS plan_id                 text,
  ADD COLUMN IF NOT EXISTS seat_count              integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minutes_pool            integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_minutes           integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_status     text         NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS auto_refill_enabled     boolean      NOT NULL DEFAULT false;

-- ── subscriptions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid        REFERENCES users(id) ON DELETE CASCADE,
  org_id                  uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_subscription_id  text        UNIQUE NOT NULL,
  stripe_price_id         text        NOT NULL,
  plan_id                 text        NOT NULL,
  status                  text        NOT NULL DEFAULT 'trialing',
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  trial_end               timestamptz,
  canceled_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_owner_check CHECK (
    (user_id IS NOT NULL AND org_id IS NULL) OR
    (user_id IS NULL AND org_id IS NOT NULL)
  )
);

-- ── coach_referrals ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coach_referrals (
  id               uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id         uuid     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id           uuid     NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type             text     NOT NULL CHECK (type IN ('discount', 'affiliate')),
  percentage       integer  NOT NULL CHECK (percentage BETWEEN 1 AND 100),
  stripe_coupon_id text,
  is_active        boolean  NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, org_id)
);

-- ── minute_transactions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS minute_transactions (
  id               uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id           uuid     REFERENCES organizations(id) ON DELETE SET NULL,
  type             text     NOT NULL CHECK (type IN (
                     'call_usage','purchase','monthly_reset',
                     'trial_grant','affiliate_payout_skipped')),
  delta            integer  NOT NULL,
  session_id       uuid     REFERENCES training_sessions(id) ON DELETE SET NULL,
  stripe_charge_id text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id   ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id    ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_coach_referrals_coach   ON coach_referrals(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_referrals_org     ON coach_referrals(org_id);
CREATE INDEX IF NOT EXISTS idx_minute_tx_user          ON minute_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_minute_tx_created       ON minute_transactions(created_at);
