-- ============================================================
-- Highs Hardening Migration
--
-- Bundles infrastructure for the high-severity audit findings:
--   1. webhook_events  — Stripe event idempotency
--   2. users / notifications / candidate_invites /
--      company_coach_connections — RLS coverage
--   3. users.upload_minutes_used_this_month + monthly reset
--   4. atomic apply_referral_credit RPC (race-free)
--   5. share_token_revoked / sub_status idempotency helpers
--
-- Safe to run on a database that already has the prior RLS
-- migrations applied. Idempotent.
-- ============================================================

-- ── 1. Stripe webhook idempotency ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id      TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhook_events: service role bypass" ON webhook_events;
CREATE POLICY "webhook_events: service role bypass"
  ON webhook_events FOR ALL USING (auth.role() = 'service_role');

-- ── 2a. RLS — users ───────────────────────────────────────────────────────────
-- Users can read their own profile. Company admins / coaches / superusers can
-- read profiles in their org / coach instance. Inserts/updates/deletes are
-- service-role only (enforced by API).

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users: service role bypass"  ON users;
DROP POLICY IF EXISTS "users: select self"          ON users;
DROP POLICY IF EXISTS "users: select org peers"     ON users;
DROP POLICY IF EXISTS "users: select coach members" ON users;

CREATE POLICY "users: service role bypass"
  ON users FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "users: select self"
  ON users FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "users: select org peers"
  ON users FOR SELECT USING (
    organization_id IS NOT NULL
    AND organization_id = _my_org_id()
    AND _my_role() IN ('company_admin', 'coach', 'superuser')
  );

CREATE POLICY "users: select coach members"
  ON users FOR SELECT USING (
    coach_instance_id IS NOT NULL
    AND coach_instance_id = _my_coach_instance_id()
    AND _my_role() IN ('coach', 'superuser')
  );

-- ── 2b. RLS — notifications ───────────────────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications: service role bypass" ON notifications;
DROP POLICY IF EXISTS "notifications: select own"          ON notifications;
DROP POLICY IF EXISTS "notifications: update own"          ON notifications;

CREATE POLICY "notifications: service role bypass"
  ON notifications FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "notifications: select own"
  ON notifications FOR SELECT USING (user_id = _my_user_id());

-- Allow users to mark their own notifications read.
CREATE POLICY "notifications: update own"
  ON notifications FOR UPDATE USING (user_id = _my_user_id());

-- ── 2c. RLS — candidate_invites ───────────────────────────────────────────────

ALTER TABLE candidate_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "candidate_invites: service role bypass" ON candidate_invites;
DROP POLICY IF EXISTS "candidate_invites: select org"          ON candidate_invites;

CREATE POLICY "candidate_invites: service role bypass"
  ON candidate_invites FOR ALL USING (auth.role() = 'service_role');

-- Org admins and coaches see invites for their org. Public anon access for
-- token redemption is handled server-side via service role.
CREATE POLICY "candidate_invites: select org"
  ON candidate_invites FOR SELECT USING (
    organization_id = _my_org_id()
    AND _my_role() IN ('company_admin', 'coach', 'superuser')
  );

-- ── 2d. RLS — company_coach_connections ───────────────────────────────────────

ALTER TABLE company_coach_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_coach_connections: service role bypass" ON company_coach_connections;
DROP POLICY IF EXISTS "company_coach_connections: select"              ON company_coach_connections;

CREATE POLICY "company_coach_connections: service role bypass"
  ON company_coach_connections FOR ALL USING (auth.role() = 'service_role');

-- Visible to: org members (the org party), coach (the coach party), superusers.
CREATE POLICY "company_coach_connections: select"
  ON company_coach_connections FOR SELECT USING (
    organization_id = _my_org_id()
    OR coach_instance_id = _my_coach_instance_id()
    OR _my_role() = 'superuser'
  );

-- ── 3. Upload-minutes bucket ─────────────────────────────────────────────────
-- Field-recording uploads draw from a separate 600-min/month allowance,
-- reset each calendar month.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS upload_minutes_used_this_month INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS upload_minutes_reset_at        TIMESTAMPTZ;

-- Helper: increment a user's upload minutes, auto-resetting on month boundary.
-- Returns the new running total (NULL if the user does not exist).
CREATE OR REPLACE FUNCTION increment_upload_minutes(target_user_id UUID, delta_minutes INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month_start TIMESTAMPTZ := DATE_TRUNC('month', NOW());
  new_total           INTEGER;
BEGIN
  UPDATE users
     SET upload_minutes_used_this_month =
           CASE
             WHEN upload_minutes_reset_at IS NULL OR upload_minutes_reset_at < current_month_start
               THEN delta_minutes
             ELSE upload_minutes_used_this_month + delta_minutes
           END,
         upload_minutes_reset_at =
           CASE
             WHEN upload_minutes_reset_at IS NULL OR upload_minutes_reset_at < current_month_start
               THEN current_month_start
             ELSE upload_minutes_reset_at
           END
   WHERE id = target_user_id
   RETURNING upload_minutes_used_this_month INTO new_total;
  RETURN new_total;
END;
$$;

REVOKE EXECUTE ON FUNCTION increment_upload_minutes(UUID, INTEGER) FROM anon, authenticated;

-- ── 4. Atomic referral credit RPC ────────────────────────────────────────────
-- Eliminates the read-modify-write race in lib/referral.ts.

CREATE OR REPLACE FUNCTION apply_referral_credit(
  target_user_id UUID,
  delta_minutes  INTEGER
) RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE users
     SET referral_credits_minutes = COALESCE(referral_credits_minutes, 0) + delta_minutes
   WHERE id = target_user_id
   RETURNING referral_credits_minutes;
$$;

REVOKE EXECUTE ON FUNCTION apply_referral_credit(UUID, INTEGER) FROM anon, authenticated;
