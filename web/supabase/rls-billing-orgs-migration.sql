-- ============================================================
-- RLS Migration — billing tables + organizations
-- Fixes Supabase security alerts:
--   rls_disabled_in_public     (no RLS on table)
--   sensitive_columns_exposed  (stripe keys publicly readable)
--
-- Tables covered:
--   organizations, subscriptions, coach_referrals,
--   minute_transactions, referrals, global_broadcasts
--
-- Run in Supabase SQL Editor after rls-migration.sql
-- ============================================================

-- ── organizations ─────────────────────────────────────────────────────────────

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organizations: service role bypass" ON organizations;
DROP POLICY IF EXISTS "organizations: select"              ON organizations;
DROP POLICY IF EXISTS "organizations: update"              ON organizations;

CREATE POLICY "organizations: service role bypass"
  ON organizations FOR ALL
  USING (auth.role() = 'service_role');

-- Any member of the org can read it
CREATE POLICY "organizations: select"
  ON organizations FOR SELECT
  USING (id = _my_org_id());

-- Only company_admin or superuser can update their own org
CREATE POLICY "organizations: update"
  ON organizations FOR UPDATE
  USING (
    id = _my_org_id()
    AND _my_role() IN ('company_admin', 'superuser')
  );

-- ── subscriptions ─────────────────────────────────────────────────────────────

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions: service role bypass" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions: select"              ON subscriptions;

CREATE POLICY "subscriptions: service role bypass"
  ON subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- Individual users see their own subscription; admins see their org's
CREATE POLICY "subscriptions: select"
  ON subscriptions FOR SELECT
  USING (
    user_id = _my_user_id()
    OR (
      org_id = _my_org_id()
      AND _my_role() IN ('company_admin', 'coach', 'superuser')
    )
  );

-- ── coach_referrals ───────────────────────────────────────────────────────────

ALTER TABLE coach_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_referrals: service role bypass" ON coach_referrals;
DROP POLICY IF EXISTS "coach_referrals: select"              ON coach_referrals;

CREATE POLICY "coach_referrals: service role bypass"
  ON coach_referrals FOR ALL
  USING (auth.role() = 'service_role');

-- Coaches see their own referral agreements; admins/superusers see by org
CREATE POLICY "coach_referrals: select"
  ON coach_referrals FOR SELECT
  USING (
    coach_id = _my_user_id()
    OR (
      org_id = _my_org_id()
      AND _my_role() IN ('company_admin', 'superuser')
    )
  );

-- ── minute_transactions ───────────────────────────────────────────────────────

ALTER TABLE minute_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "minute_transactions: service role bypass" ON minute_transactions;
DROP POLICY IF EXISTS "minute_transactions: select"              ON minute_transactions;

CREATE POLICY "minute_transactions: service role bypass"
  ON minute_transactions FOR ALL
  USING (auth.role() = 'service_role');

-- Users see their own transactions; admins/coaches see their org's
CREATE POLICY "minute_transactions: select"
  ON minute_transactions FOR SELECT
  USING (
    user_id = _my_user_id()
    OR (
      org_id = _my_org_id()
      AND _my_role() IN ('company_admin', 'coach', 'superuser')
    )
  );

-- ── referrals ─────────────────────────────────────────────────────────────────

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals: service role bypass" ON referrals;
DROP POLICY IF EXISTS "referrals: select"              ON referrals;

CREATE POLICY "referrals: service role bypass"
  ON referrals FOR ALL
  USING (auth.role() = 'service_role');

-- Users see referrals where they are the referrer or the referred party
CREATE POLICY "referrals: select"
  ON referrals FOR SELECT
  USING (
    referrer_id = _my_user_id()
    OR referred_id = _my_user_id()
    OR _my_role() = 'superuser'
  );

-- ── global_broadcasts ─────────────────────────────────────────────────────────

ALTER TABLE global_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "global_broadcasts: service role bypass" ON global_broadcasts;
DROP POLICY IF EXISTS "global_broadcasts: select"              ON global_broadcasts;

CREATE POLICY "global_broadcasts: service role bypass"
  ON global_broadcasts FOR ALL
  USING (auth.role() = 'service_role');

-- All authenticated users can read broadcast records (they are the recipients)
CREATE POLICY "global_broadcasts: select"
  ON global_broadcasts FOR SELECT
  USING (auth.uid() IS NOT NULL);
