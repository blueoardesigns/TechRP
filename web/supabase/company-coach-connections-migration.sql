-- ============================================================
-- Company–Coach Connections
-- Allows companies to invite consulting coaches with scoped
-- permissions. Separate from coach-owned companies.
--
-- Run AFTER all previous migrations.
-- ============================================================

CREATE TABLE IF NOT EXISTS company_coach_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  coach_instance_id UUID NOT NULL REFERENCES coach_instances(id) ON DELETE CASCADE,
  permission_level  TEXT NOT NULL
                    CHECK (permission_level IN ('edit_playbooks', 'readonly')),
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'declined')),
  approval_token    TEXT UNIQUE NOT NULL
                    DEFAULT encode(gen_random_bytes(32), 'hex'),
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at       TIMESTAMPTZ,
  UNIQUE(organization_id, coach_instance_id)
);

CREATE INDEX IF NOT EXISTS idx_ccc_org    ON company_coach_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_ccc_coach  ON company_coach_connections(coach_instance_id);
CREATE INDEX IF NOT EXISTS idx_ccc_token  ON company_coach_connections(approval_token);
CREATE INDEX IF NOT EXISTS idx_ccc_status ON company_coach_connections(status);

-- RLS
ALTER TABLE company_coach_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ccc: service role bypass"
  ON company_coach_connections FOR ALL
  USING (auth.role() = 'service_role');

-- Company admins can read their org's connections
CREATE POLICY "ccc: company_admin select"
  ON company_coach_connections FOR SELECT
  USING (organization_id = _my_org_id());

-- Coaches can read connections for their instance
CREATE POLICY "ccc: coach select"
  ON company_coach_connections FOR SELECT
  USING (coach_instance_id = _my_coach_instance_id());
