-- ============================================================
-- RLS Migration — Enable Row Level Security on all tables
-- Fixes public exposure of: training_sessions, playbooks,
--                           personas, coach_instances
--
-- IMPORTANT: Run AFTER all other migrations have been applied.
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- ── Helper functions ─────────────────────────────────────────────────────────
-- SECURITY DEFINER bypasses RLS on the users table itself, preventing
-- infinite recursion and allowing policy evaluation for any caller.

CREATE OR REPLACE FUNCTION _my_user_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION _my_org_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION _my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_role FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION _my_coach_instance_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coach_instance_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- ── training_sessions ────────────────────────────────────────────────────────

ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;

-- Drop stale policies from original schema.sql (wrong auth_user_id assumption)
DROP POLICY IF EXISTS "Technicians can view their own sessions"    ON training_sessions;
DROP POLICY IF EXISTS "Technicians can create their own sessions"  ON training_sessions;
DROP POLICY IF EXISTS "Technicians can update their own sessions"  ON training_sessions;
DROP POLICY IF EXISTS "Managers can update sessions in their organization" ON training_sessions;

CREATE POLICY "training_sessions: service role bypass"
  ON training_sessions FOR ALL
  USING (auth.role() = 'service_role');

-- Individuals see own sessions; admins/coaches see full org
CREATE POLICY "training_sessions: select"
  ON training_sessions FOR SELECT
  USING (
    user_id = _my_user_id()
    OR (
      _my_role() IN ('company_admin', 'coach', 'superuser')
      AND organization_id = _my_org_id()
    )
  );

-- Users can only insert sessions for themselves in their own org
CREATE POLICY "training_sessions: insert"
  ON training_sessions FOR INSERT
  WITH CHECK (
    user_id = _my_user_id()
    AND organization_id = _my_org_id()
  );

-- Users can update their own; admins/coaches can update within org
CREATE POLICY "training_sessions: update"
  ON training_sessions FOR UPDATE
  USING (
    user_id = _my_user_id()
    OR (
      _my_role() IN ('company_admin', 'coach', 'superuser')
      AND organization_id = _my_org_id()
    )
  );

-- Only admins/coaches can delete
CREATE POLICY "training_sessions: delete"
  ON training_sessions FOR DELETE
  USING (
    _my_role() IN ('company_admin', 'coach', 'superuser')
    AND organization_id = _my_org_id()
  );

-- ── playbooks ─────────────────────────────────────────────────────────────────

ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;

-- Drop stale policies from original schema.sql
DROP POLICY IF EXISTS "Users can view playbooks in their organization"       ON playbooks;
DROP POLICY IF EXISTS "Managers can create playbooks"                        ON playbooks;
DROP POLICY IF EXISTS "Managers can update playbooks in their organization"  ON playbooks;
DROP POLICY IF EXISTS "Managers can delete playbooks in their organization"  ON playbooks;

CREATE POLICY "playbooks: service role bypass"
  ON playbooks FOR ALL
  USING (auth.role() = 'service_role');

-- All authenticated users can read playbooks for their org or coach instance
CREATE POLICY "playbooks: select"
  ON playbooks FOR SELECT
  USING (
    organization_id = _my_org_id()
    OR (coach_instance_id IS NOT NULL AND coach_instance_id = _my_coach_instance_id())
  );

-- Only company_admin (for org) or coach (for coach_instance) can write
CREATE POLICY "playbooks: insert"
  ON playbooks FOR INSERT
  WITH CHECK (
    (organization_id = _my_org_id()            AND _my_role() IN ('company_admin', 'superuser'))
    OR (coach_instance_id = _my_coach_instance_id() AND _my_role() IN ('coach', 'superuser'))
  );

CREATE POLICY "playbooks: update"
  ON playbooks FOR UPDATE
  USING (
    (organization_id = _my_org_id()            AND _my_role() IN ('company_admin', 'superuser'))
    OR (coach_instance_id = _my_coach_instance_id() AND _my_role() IN ('coach', 'superuser'))
  );

CREATE POLICY "playbooks: delete"
  ON playbooks FOR DELETE
  USING (
    (organization_id = _my_org_id()            AND _my_role() IN ('company_admin', 'superuser'))
    OR (coach_instance_id = _my_coach_instance_id() AND _my_role() IN ('coach', 'superuser'))
  );

-- ── personas ──────────────────────────────────────────────────────────────────

ALTER TABLE personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personas: service role bypass"
  ON personas FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "personas: select"
  ON personas FOR SELECT
  USING (
    organization_id = _my_org_id()
    OR (coach_instance_id IS NOT NULL AND coach_instance_id = _my_coach_instance_id())
  );

CREATE POLICY "personas: insert"
  ON personas FOR INSERT
  WITH CHECK (
    (organization_id = _my_org_id()            AND _my_role() IN ('company_admin', 'superuser'))
    OR (coach_instance_id = _my_coach_instance_id() AND _my_role() IN ('coach', 'superuser'))
  );

CREATE POLICY "personas: update"
  ON personas FOR UPDATE
  USING (
    (organization_id = _my_org_id()            AND _my_role() IN ('company_admin', 'superuser'))
    OR (coach_instance_id = _my_coach_instance_id() AND _my_role() IN ('coach', 'superuser'))
  );

CREATE POLICY "personas: delete"
  ON personas FOR DELETE
  USING (
    (organization_id = _my_org_id()            AND _my_role() IN ('company_admin', 'superuser'))
    OR (coach_instance_id = _my_coach_instance_id() AND _my_role() IN ('coach', 'superuser'))
  );

-- ── coach_instances ───────────────────────────────────────────────────────────

ALTER TABLE coach_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_instances: service role bypass"
  ON coach_instances FOR ALL
  USING (auth.role() = 'service_role');

-- Coaches can see and update their own instance;
-- users can read the instance they belong to (for invite flow etc.)
CREATE POLICY "coach_instances: select"
  ON coach_instances FOR SELECT
  USING (
    id = _my_coach_instance_id()
    OR coach_user_id = _my_user_id()
  );

CREATE POLICY "coach_instances: insert"
  ON coach_instances FOR INSERT
  WITH CHECK (
    coach_user_id = _my_user_id()
    AND _my_role() IN ('coach', 'superuser')
  );

CREATE POLICY "coach_instances: update"
  ON coach_instances FOR UPDATE
  USING (coach_user_id = _my_user_id());
