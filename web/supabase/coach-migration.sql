-- ============================================================
-- Coach Migration — TechRP
-- Run in Supabase SQL editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- 1. Extend app_role to include 'coach'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_app_role_check;
ALTER TABLE users ADD CONSTRAINT users_app_role_check
  CHECK (app_role IN ('individual', 'company_admin', 'coach'));

-- 2. Add coach_instance_id and organization_id to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS coach_instance_id UUID,
  ADD COLUMN IF NOT EXISTS organization_id   UUID;

-- 3. Create coach_instances table
CREATE TABLE IF NOT EXISTS coach_instances (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL,
  invite_token             TEXT NOT NULL UNIQUE,
  global_playbooks_enabled BOOLEAN NOT NULL DEFAULT false,
  global_personas_enabled  BOOLEAN NOT NULL DEFAULT false,
  auto_approve_users       BOOLEAN NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Add FK from users.coach_instance_id → coach_instances
ALTER TABLE users
  ADD CONSTRAINT users_coach_instance_id_fkey
  FOREIGN KEY (coach_instance_id) REFERENCES coach_instances(id)
  ON DELETE SET NULL;

-- 5. Extend organizations with coach link + invite token
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS coach_instance_id UUID REFERENCES coach_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invite_token      TEXT UNIQUE;

-- 6. Add coach_instance_id to playbooks and personas
ALTER TABLE playbooks
  ADD COLUMN IF NOT EXISTS coach_instance_id UUID REFERENCES coach_instances(id) ON DELETE CASCADE;

ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS coach_instance_id UUID REFERENCES coach_instances(id) ON DELETE CASCADE;

-- 7. Index for fast token lookups
CREATE INDEX IF NOT EXISTS coach_instances_invite_token_idx ON coach_instances(invite_token);
CREATE INDEX IF NOT EXISTS organizations_invite_token_idx   ON organizations(invite_token);
CREATE INDEX IF NOT EXISTS users_coach_instance_id_idx      ON users(coach_instance_id);
