-- ============================================================
-- Playbook Company Access — Per-company playbook visibility
-- Whitelist model: rows present = restrict to those playbooks
--                  no rows for an org = see all coach playbooks
--
-- Run in Supabase SQL Editor after all previous migrations.
-- ============================================================

CREATE TABLE IF NOT EXISTS playbook_company_access (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id      UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(playbook_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_pca_org ON playbook_company_access(organization_id);
CREATE INDEX IF NOT EXISTS idx_pca_playbook ON playbook_company_access(playbook_id);

-- RLS
ALTER TABLE playbook_company_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pca: service role bypass"
  ON playbook_company_access FOR ALL
  USING (auth.role() = 'service_role');

-- Coaches can read whitelist rows for playbooks in their instance
CREATE POLICY "pca: coach select"
  ON playbook_company_access FOR SELECT
  USING (
    playbook_id IN (
      SELECT id FROM playbooks WHERE coach_instance_id = _my_coach_instance_id()
    )
  );

-- Company admins can read their own org's whitelist
CREATE POLICY "pca: company_admin select"
  ON playbook_company_access FOR SELECT
  USING (organization_id = _my_org_id());
