-- Allow any authenticated user to read personas and playbooks from the default
-- seed org (00000000-0000-0000-0000-000000000001). This enables the mobile app's
-- fallback: when a user's own org has no content seeded, they fall back to the
-- shared default-org data instead of seeing an empty state.

-- Drop and recreate personas select policy
DROP POLICY IF EXISTS "personas: select" ON personas;
CREATE POLICY "personas: select"
  ON personas FOR SELECT
  USING (
    organization_id = _my_org_id()
    OR (coach_instance_id IS NOT NULL AND coach_instance_id = _my_coach_instance_id())
    OR organization_id = '00000000-0000-0000-0000-000000000001'
  );

-- Drop and recreate playbooks select policy
DROP POLICY IF EXISTS "playbooks: select" ON playbooks;
CREATE POLICY "playbooks: select"
  ON playbooks FOR SELECT
  USING (
    organization_id = _my_org_id()
    OR (coach_instance_id IS NOT NULL AND coach_instance_id = _my_coach_instance_id())
    OR organization_id = '00000000-0000-0000-0000-000000000001'
  );
