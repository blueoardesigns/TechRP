-- ============================================================
-- TechRP — Candidate Invites + Notifications + RLS Fix
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Create candidate_invites ──────────────────────────────
CREATE TABLE IF NOT EXISTS candidate_invites (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 TEXT NOT NULL,
  full_name             TEXT,
  personal_token        TEXT UNIQUE NOT NULL,
  invited_by_user_id    UUID NOT NULL REFERENCES users(id),
  organization_id       UUID NOT NULL REFERENCES organizations(id),
  coach_instance_id     UUID REFERENCES coach_instances(id),
  assigned_scenarios    JSONB NOT NULL DEFAULT '[]',
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','signed_up','in_progress','complete','upgraded')),
  signed_up_user_id     UUID REFERENCES users(id),
  notification_sent_at  TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email, organization_id)
);

-- ── 2. Extend users ──────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS user_type TEXT NOT NULL DEFAULT 'standard'
    CHECK (user_type IN ('standard', 'candidate')),
  ADD COLUMN IF NOT EXISTS candidate_invite_id UUID REFERENCES candidate_invites(id),
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT false;

-- ── 3. Create notifications ──────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread
  ON notifications(user_id, read) WHERE NOT read;

-- ── 4. RLS fix — SECURITY DEFINER to avoid recursion ────────
CREATE OR REPLACE FUNCTION is_company_admin_of_org(check_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_user_id = auth.uid()
      AND app_role = 'company_admin'
      AND organization_id = check_org_id
  );
$$;

-- Drop old recursive policies (use common names)
DROP POLICY IF EXISTS "company_admin_view_org_users" ON users;
DROP POLICY IF EXISTS "Users can view their org members" ON users;
DROP POLICY IF EXISTS "Team members can view org users" ON users;

CREATE POLICY "company_admin_view_org_users"
ON users FOR SELECT
USING (is_company_admin_of_org(organization_id));

-- ── 5. RLS on candidate_invites ──────────────────────────────
ALTER TABLE candidate_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_admin_manage_candidates"
ON candidate_invites FOR ALL
USING (is_company_admin_of_org(organization_id));

-- ── 6. RLS on notifications ──────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper to get own user id without recursion
CREATE OR REPLACE FUNCTION get_my_user_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE POLICY "user_view_own_notifications"
ON notifications FOR SELECT
USING (user_id = get_my_user_id());

CREATE POLICY "user_update_own_notifications"
ON notifications FOR UPDATE
USING (user_id = get_my_user_id());
